"""Financial Extraction Agent — T-12, rent roll, loan terms."""
from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are the Financial Extraction Agent for Bloomfield Capital.
Extract these fields from normalized documents and map each to its Origination
Screener cell reference:
  * Property info: name, address, county, MSA, year built, unit/bed counts
  * Unit mix + rent roll: occupancy, rent, care revenue per unit type
  * Loan terms: requested amount, purchase price, use of proceeds
  * Historical financials: YE 2022–2024, T-11M, T-3M annualized
  * Proforma projections

Missing values must be returned as `null` and flagged in `missing_items` so the
Underwriting Agent can surface them as diligence flags. NEVER fabricate values."""


class FinancialExtractionAgent(BaseAgent):
    name = "financial_extraction"
    system_prompt = SYSTEM_PROMPT

    async def run(self, context: AgentContext) -> AgentResult:
        self.log.info("financials_start", deal_id=context.deal_id)
        # TODO: Claude call with context.parsed_documents; write to context.financials
        return AgentResult(success=True, agent=self.name, detail="stub")
