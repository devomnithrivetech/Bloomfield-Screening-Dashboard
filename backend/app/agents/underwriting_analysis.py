"""Underwriting Analysis Agent — the analytical brain."""
from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are the Underwriting Analysis Agent applying Bloomfield
Capital's proprietary senior-housing screening methodology:
  * T-12 line-by-line review with explicit NOI normalization adjustments
  * Labor cost benchmark: 55–65% of revenue for AL/MC
  * Management-fee validation (typical 5% of revenue)
  * Insurance + real-estate-tax normalization
  * Cap-rate derivation from comps and trailing NOI
  * Payor-mix analysis; flag Medicaid concentration > 70%
  * Occupancy trend across T-12 / T-11M / T-3M

Output:
  * risk_rating: Low / Moderate / Moderate-High / High
  * recommendation: Proceed / Negotiate / Pass
  * confidence: 0.0–1.0
  * highlights[], risks[], diligence_flags[]
Narrative language must match the Bloomfield analyst voice."""


class UnderwritingAnalysisAgent(BaseAgent):
    name = "underwriting_analysis"
    system_prompt = SYSTEM_PROMPT

    async def run(self, context: AgentContext) -> AgentResult:
        self.log.info("analysis_start", deal_id=context.deal_id)
        # TODO: Claude call using financials + market; write to context.analysis
        return AgentResult(success=True, agent=self.name, detail="stub")
