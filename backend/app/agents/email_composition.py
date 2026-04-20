"""Email Composition Agent — drafts the screening email."""
from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are the Email Composition Agent. Draft the screening email
in Bloomfield Capital's standard format:
  1. One-line subject with property + asset class + loan request.
  2. Opening paragraph: property, location, sponsor.
  3. Deal summary table: property, location, asset type, units, loan request,
     LTV, DSCR, recommendation.
  4. Investment Highlights bullet list.
  5. Risks / Underwriting Flags bullet list.
  6. Sign-off.
Tone: concise, neutral, analyst-grade. No emojis. No marketing language."""


class EmailCompositionAgent(BaseAgent):
    name = "email_composition"
    system_prompt = SYSTEM_PROMPT

    async def run(self, context: AgentContext) -> AgentResult:
        # TODO: Claude call using context.analysis + context.metrics; store draft
        #       in context.email_draft. Do NOT send — the user reviews and sends
        #       from the dashboard.
        self.log.info("email_compose_start", deal_id=context.deal_id)
        return AgentResult(success=True, agent=self.name, detail="stub")
