"""Deal service — kicks off screening pipelines and serves Deal Detail data."""
from __future__ import annotations

from datetime import datetime

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.deal import (
    DealDetail,
    DealListResponse,
    DealMetrics,
    DealSummary,
    Highlight,
    KPIStats,
    PipelineStageState,
    RiskFlag,
)

log = get_logger(__name__)


async def start_screening(user_id: str, email_id: str) -> str:
    """Kick off the deal screening pipeline.

    `email_id` is the Gmail message ID (the string that Gmail assigns).
    Returns the deal_id UUID string — safe to return to the frontend immediately
    since processing is awaited inline here.  Move to a background task queue
    once the demo matures.
    """
    settings = get_settings()

    if settings.agentic_enabled:
        # Full 8-agent pipeline (option_2 / option_3) — not yet wired end-to-end.
        from app.agents import AgentContext, OrchestratorAgent
        import uuid
        deal_id = str(uuid.uuid4())
        context = AgentContext(deal_id=deal_id, user_id=user_id, email_id=email_id)
        orchestrator = OrchestratorAgent()
        result = await orchestrator.run(context)
        log.info("pipeline_result", deal_id=deal_id, success=result.success)
        return deal_id

    return await _run_monolithic_screening(user_id, email_id)


async def _run_monolithic_screening(user_id: str, email_id: str) -> str:
    """Option 1 path — single Claude call that handles the full pipeline."""
    from app.agents.demo import run_demo_screening
    return await run_demo_screening(user_id, email_id)


async def list_deals(user_id: str) -> DealListResponse:
    from app.integrations.supabase import get_supabase
    supabase = get_supabase()
    try:
        resp = (
            supabase.table("deals")
            .select("id, property_name, asset_class, recommendation, confidence, "
                    "risk_rating, created_at, property_info")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        deals = [_row_to_summary(r) for r in (resp.data or [])]
        return DealListResponse(deals=deals, total=len(deals))
    except Exception as exc:
        log.warning("list_deals_failed", user_id=user_id, error=str(exc))
        return DealListResponse(deals=[], total=0)


async def get_deal(user_id: str, deal_id: str) -> DealDetail | None:
    from app.integrations.supabase import get_supabase
    supabase = get_supabase()
    try:
        resp = (
            supabase.table("deals")
            .select("*")
            .eq("id", deal_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not resp.data:
            return None
        return _row_to_deal_detail(resp.data)
    except Exception as exc:
        log.warning("get_deal_failed", deal_id=deal_id, error=str(exc))
        return None


async def get_kpis(user_id: str) -> KPIStats:
    from app.integrations.supabase import get_supabase
    supabase = get_supabase()
    try:
        resp = (
            supabase.table("deals")
            .select("id, recommendation, created_at, property_info, key_metrics")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        rows = resp.data or []
        from datetime import timezone, timedelta
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        received  = sum(1 for r in rows if r.get("created_at", "") >= week_ago)
        screened  = sum(1 for r in rows if r.get("recommendation") in ("proceed", "negotiate", "pass"))
        pending   = 0  # no background queue yet

        # Average loan size from key_metrics
        loan_sizes = []
        for r in rows:
            for m in (r.get("key_metrics") or []):
                if "loan" in (m.get("label") or "").lower():
                    raw = (m.get("value") or "").replace("$", "").replace(",", "").split()[0]
                    try:
                        loan_sizes.append(float(raw))
                    except ValueError:
                        pass
                    break
        avg_loan = sum(loan_sizes) / len(loan_sizes) if loan_sizes else 0.0

        return KPIStats(
            received_this_week=received,
            screened=screened,
            pending=pending,
            avg_loan_size=avg_loan,
        )
    except Exception as exc:
        log.warning("get_kpis_failed", user_id=user_id, error=str(exc))
        return KPIStats(received_this_week=0, screened=0, pending=0, avg_loan_size=0.0)


# ─────────────────────────────────────────────────────────────────────────────
#  ROW → SCHEMA MAPPERS
# ─────────────────────────────────────────────────────────────────────────────

def _row_to_summary(row: dict) -> DealSummary:
    prop = row.get("property_info") or {}
    try:
        created = datetime.fromisoformat(row["created_at"])
    except Exception:
        created = datetime.utcnow()
    return DealSummary(
        id=str(row["id"]),
        property_name=row.get("property_name") or "Unknown Property",
        address=prop.get("address"),
        county=prop.get("county"),
        msa=None,
        asset_class=row.get("asset_class"),
        recommendation=row.get("recommendation"),
        confidence=row.get("confidence"),
        risk_rating=row.get("risk_rating"),
        created_at=created,
    )


def _row_to_deal_detail(row: dict) -> DealDetail:
    prop        = row.get("property_info") or {}
    highlights  = row.get("highlights") or []
    risks       = row.get("risks") or []
    pipeline    = row.get("pipeline") or []
    key_metrics = row.get("key_metrics") or row.get("metrics") or []

    try:
        created = datetime.fromisoformat(row["created_at"])
    except Exception:
        created = datetime.utcnow()

    highlight_objs = [
        Highlight(title=h.get("title", ""), detail=h.get("detail", ""))
        for h in highlights if isinstance(h, dict)
    ]
    risk_objs = [
        RiskFlag(
            title=r.get("title", ""),
            detail=r.get("detail", ""),
            severity=r.get("severity", "moderate"),
        )
        for r in risks if isinstance(r, dict)
    ]
    pipeline_objs: list[PipelineStageState] = []
    for s in pipeline:
        if not isinstance(s, dict):
            continue
        try:
            pipeline_objs.append(
                PipelineStageState(
                    stage=s.get("stage"),
                    status=s.get("status"),
                    started_at=s.get("started_at"),
                    finished_at=s.get("finished_at"),
                    detail=s.get("detail"),
                )
            )
        except Exception:
            pass

    return DealDetail(
        id=str(row["id"]),
        property_name=row.get("property_name") or "Unknown Property",
        address=prop.get("address"),
        county=prop.get("county"),
        msa=None,
        asset_class=row.get("asset_class"),
        recommendation=row.get("recommendation"),
        confidence=row.get("confidence"),
        risk_rating=row.get("risk_rating"),
        created_at=created,
        metrics=DealMetrics(),       # legacy field — keep for schema compat
        key_metrics=key_metrics,     # rich [{label, value, flag}] list
        highlights=highlight_objs,
        risks=risk_objs,
        pipeline=pipeline_objs,
        screener_s3_key=row.get("screener_storage_path"),
        screening_email_draft=row.get("email_draft"),
        property_info=prop,
    )
