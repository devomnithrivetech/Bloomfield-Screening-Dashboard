"""Screener Generator Agent — populates the Origination Screener .xlsx."""
from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are the Screener Generator Agent. Produce the three
narrative text boxes for the Deal Summary section:
  * Property Overview (neutral description)
  * Investment Highlights (navy header bar)
  * Investment Risks & Underwriting Flags (red header bar)
Each section ≤ 180 words, in Bloomfield's analyst voice."""


class ScreenerGeneratorAgent(BaseAgent):
    name = "screener_generator"
    system_prompt = SYSTEM_PROMPT

    async def run(self, context: AgentContext) -> AgentResult:
        # TODO:
        #   1. Load screener template via openpyxl
        #   2. Write extracted values to the mapped cells from FinancialExtractionAgent
        #   3. Compute derived fields (total units/beds, weighted occupancy, proforma NOI)
        #   4. Use Claude (system_prompt) to draft the three narrative text boxes
        #   5. Inject text boxes, preserve formula cells (LTV/DSCR/D/Y)
        #   6. Upload .xlsx to Supabase Storage, write context.screener_path
        self.log.info("screener_start", deal_id=context.deal_id)
        return AgentResult(success=True, agent=self.name, detail="stub")
