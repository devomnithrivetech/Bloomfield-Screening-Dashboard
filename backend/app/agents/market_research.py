"""Market Research Agent — web search for demographics + competitors."""
from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are the Market Research Agent. Using the web search tool,
gather for the subject property:
  * Demographics within 3/5/7-mile radii (75+ population, median household
    income, median home values)
  * Top 3 direct competitors with unit count, pricing, occupancy
  * Market positioning (needs-driven vs. lifestyle-driven demand)

Cite sources for every data point. If data is unavailable, say so rather than
guessing."""


class MarketResearchAgent(BaseAgent):
    name = "market_research"
    system_prompt = SYSTEM_PROMPT

    async def run(self, context: AgentContext) -> AgentResult:
        # TODO: invoke Claude with web_search tool; persist results in context.market
        self.log.info("market_start", deal_id=context.deal_id)
        return AgentResult(success=True, agent=self.name, detail="stub")
