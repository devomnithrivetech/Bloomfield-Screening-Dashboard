"""Agentic AI framework (Section 4.5 of the proposal).

Eight specialized agents coordinated by the Orchestrator. Each agent exposes a
`run(context: AgentContext) -> AgentResult` coroutine; the Orchestrator chains
them together, handles retries, and broadcasts pipeline-stage updates to the
frontend via Supabase Realtime.
"""
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.agents.document_processing import DocumentProcessingAgent
from app.agents.email_composition import EmailCompositionAgent
from app.agents.email_triage import EmailTriageAgent
from app.agents.financial_extraction import FinancialExtractionAgent
from app.agents.market_research import MarketResearchAgent
from app.agents.orchestrator import OrchestratorAgent
from app.agents.screener_generator import ScreenerGeneratorAgent
from app.agents.underwriting_analysis import UnderwritingAnalysisAgent

__all__ = [
    "AgentContext",
    "AgentResult",
    "BaseAgent",
    "OrchestratorAgent",
    "EmailTriageAgent",
    "DocumentProcessingAgent",
    "FinancialExtractionAgent",
    "MarketResearchAgent",
    "UnderwritingAnalysisAgent",
    "ScreenerGeneratorAgent",
    "EmailCompositionAgent",
]
