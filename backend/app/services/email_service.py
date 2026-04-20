"""Email inbox service — list, fetch, summarize, trigger processing."""
from __future__ import annotations

from app.core.logging import get_logger
from app.schemas.email import EmailDetail, EmailSummary

log = get_logger(__name__)


async def list_inbox(user_id: str, *, limit: int = 50) -> list[EmailSummary]:
    # TODO: query Supabase `emails` table filtered by user_id, order by received_at desc
    _ = (user_id, limit)
    return []


async def get_email(user_id: str, email_id: str) -> EmailDetail | None:
    _ = (user_id, email_id)
    return None


async def ai_summarize(user_id: str, email_id: str) -> str:
    """One-shot email summary using the fast Claude model (Sonnet)."""
    # TODO: fetch email body, call Claude with a short summary prompt
    _ = (user_id, email_id)
    return ""


async def sync_gmail_inbox(user_id: str) -> int:
    """Pull new messages from Gmail into Supabase. Called by cron + on-demand."""
    # TODO: use integrations.gmail to list new messages matching filter rules
    _ = user_id
    return 0
