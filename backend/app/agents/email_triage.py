"""Email Triage Agent — classifies deal emails and detects asset class."""
from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are the Email Triage Agent for Bloomfield Capital.
Given a broker deal email, extract: sender, property name, deal type, asset class
(senior housing / multifamily / hospitality / other), requested loan amount.
Return strict JSON. Flag non-deal emails with `is_deal_email: false`."""


class EmailTriageAgent(BaseAgent):
    name = "email_triage"
    system_prompt = SYSTEM_PROMPT

    async def run(self, context: AgentContext) -> AgentResult:
        # TODO: call Claude with system_prompt + raw email, parse JSON into context.metadata
        self.log.info("triage_start", email_id=context.email_id)
        return AgentResult(success=True, agent=self.name, detail="stub")
