"""Orchestrator Agent — coordinates the 5-stage screening pipeline.

Maps agents onto the pipeline stages shown on the Deal Detail page:
  1. Email Received           → EmailTriageAgent
  2. Parsing Attachments      → DocumentProcessingAgent
  3. Extracting Financials    → FinancialExtractionAgent (+ MarketResearchAgent in parallel)
  4. Running Screener         → UnderwritingAnalysisAgent → ScreenerGeneratorAgent
  5. Complete                 → EmailCompositionAgent
"""
from __future__ import annotations

import asyncio

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.agents.document_processing import DocumentProcessingAgent
from app.agents.email_composition import EmailCompositionAgent
from app.agents.email_triage import EmailTriageAgent
from app.agents.financial_extraction import FinancialExtractionAgent
from app.agents.market_research import MarketResearchAgent
from app.agents.screener_generator import ScreenerGeneratorAgent
from app.agents.underwriting_analysis import UnderwritingAnalysisAgent
from app.integrations.supabase import broadcast_stage
from app.schemas.deal import PipelineStage, StageStatus


class OrchestratorAgent(BaseAgent):
    name = "orchestrator"
    system_prompt = ""  # orchestrator does not call Claude directly

    def __init__(self) -> None:
        super().__init__()
        self.triage = EmailTriageAgent()
        self.documents = DocumentProcessingAgent()
        self.financials = FinancialExtractionAgent()
        self.market = MarketResearchAgent()
        self.underwriting = UnderwritingAnalysisAgent()
        self.screener = ScreenerGeneratorAgent()
        self.email = EmailCompositionAgent()

    async def run(self, context: AgentContext) -> AgentResult:
        self.log.info("pipeline_start", deal_id=context.deal_id)

        try:
            await self._stage(context, PipelineStage.EMAIL_RECEIVED, self.triage.run)
            await self._stage(context, PipelineStage.PARSING_ATTACHMENTS, self.documents.run)

            # Financial extraction and market research run in parallel.
            await self._broadcast(context, PipelineStage.EXTRACTING_FINANCIALS, StageStatus.IN_PROGRESS)
            fin_result, mkt_result = await asyncio.gather(
                self.financials.run(context),
                self.market.run(context),
            )
            if not fin_result.success:
                raise RuntimeError(fin_result.error or "financial extraction failed")
            await self._broadcast(context, PipelineStage.EXTRACTING_FINANCIALS, StageStatus.COMPLETED)

            await self._stage(context, PipelineStage.RUNNING_SCREENER, self.underwriting.run)
            await self._stage(context, PipelineStage.RUNNING_SCREENER, self.screener.run)
            await self._stage(context, PipelineStage.COMPLETE, self.email.run)

            return AgentResult(success=True, agent=self.name, detail="pipeline complete")
        except Exception as exc:  # noqa: BLE001
            self.log.exception("pipeline_failed", deal_id=context.deal_id)
            return AgentResult(success=False, agent=self.name, error=str(exc))

    async def _stage(self, context: AgentContext, stage: PipelineStage, runner) -> None:
        await self._broadcast(context, stage, StageStatus.IN_PROGRESS)
        result = await runner(context)
        if not result.success:
            await self._broadcast(context, stage, StageStatus.FAILED, {"error": result.error})
            raise RuntimeError(f"{result.agent}: {result.error}")
        await self._broadcast(context, stage, StageStatus.COMPLETED, {"detail": result.detail})

    async def _broadcast(
        self, context: AgentContext, stage: PipelineStage, status: StageStatus, payload: dict | None = None
    ) -> None:
        await broadcast_stage(context.deal_id, stage.value, status.value, payload)
