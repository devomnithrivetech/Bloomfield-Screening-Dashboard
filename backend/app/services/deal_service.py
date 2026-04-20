"""Deal service — kicks off screening pipelines and serves Deal Detail data."""
from __future__ import annotations

import uuid

from app.agents import AgentContext, OrchestratorAgent
from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.deal import DealDetail, DealListResponse, KPIStats

log = get_logger(__name__)


async def start_screening(user_id: str, email_id: str) -> str:
    """Create a deal record and launch the orchestrated pipeline.

    Returns the new `deal_id`. Safe to fire-and-forget — the frontend subscribes
    to Supabase Realtime on `deals:<deal_id>` for live stage updates.
    """
    deal_id = str(uuid.uuid4())
    context = AgentContext(deal_id=deal_id, user_id=user_id, email_id=email_id)

    settings = get_settings()
    if settings.agentic_enabled:
        orchestrator = OrchestratorAgent()
        # TODO: enqueue this via a background task / worker queue instead of awaiting inline
        result = await orchestrator.run(context)
        log.info("pipeline_result", deal_id=deal_id, success=result.success)
    else:
        await _run_monolithic_screening(context)
    return deal_id


async def _run_monolithic_screening(context: AgentContext) -> None:
    """Option 1 path — single Claude call that replaces the full pipeline."""
    # TODO: implement the monolithic flow (one large Claude call + openpyxl write)
    log.info("monolithic_run", deal_id=context.deal_id)


async def list_deals(user_id: str) -> DealListResponse:
    _ = user_id
    return DealListResponse(deals=[], total=0)


async def get_deal(user_id: str, deal_id: str) -> DealDetail | None:
    _ = (user_id, deal_id)
    return None


async def get_kpis(user_id: str) -> KPIStats:
    _ = user_id
    return KPIStats(received_this_week=0, screened=0, pending=0, avg_loan_size=0.0)
