"""Email inbox service — list, fetch, sync from Gmail."""
from __future__ import annotations

from app.core.logging import get_logger
from app.core.token_store import load_token
from app.integrations.gmail import (
    batch_get_message_details,
    credentials_from_token_data,
    get_message_detail,
    list_inbox_messages,
)
from app.schemas.email import EmailDetail, EmailStatus

log = get_logger(__name__)


async def _get_credentials(user_id: str):
    token_data = await load_token(user_id)
    if not token_data:
        return None
    return credentials_from_token_data(token_data)


async def _overlay_supabase_status(
    user_id: str,
    emails: list[EmailDetail],
) -> list[EmailDetail]:
    """Overlay processing status and deal_id from Supabase onto Gmail-fetched emails.

    Gmail never knows about our processing pipeline — every email would otherwise
    come back as 'unprocessed' after a page reload.  This reads the emails table
    and merges status + deal_id so the dashboard reflects the real state across
    navigation events.
    """
    if not emails:
        return emails
    from app.integrations.supabase import get_supabase
    try:
        gmail_ids = [e.id for e in emails]
        resp = (
            get_supabase()
            .table("emails")
            .select("gmail_message_id, status, deal_id")
            .eq("user_id", user_id)
            .in_("gmail_message_id", gmail_ids)
            .execute()
        )
        status_map: dict[str, tuple[str, str | None]] = {
            r["gmail_message_id"]: (r["status"], r.get("deal_id"))
            for r in (resp.data or [])
        }
        result: list[EmailDetail] = []
        for email in emails:
            if email.id in status_map:
                db_status, deal_id = status_map[email.id]
                try:
                    mapped_status = EmailStatus(db_status)
                except ValueError:
                    mapped_status = EmailStatus.UNPROCESSED
                email = email.model_copy(update={
                    "status":  mapped_status,
                    "deal_id": deal_id,
                })
            result.append(email)
        return result
    except Exception as exc:
        log.warning("overlay_status_failed", user_id=user_id, error=str(exc))
        return emails


async def list_inbox(
    user_id: str,
    *,
    limit: int = 20,
    page_token: str | None = None,
) -> tuple[list[EmailDetail], str | None]:
    credentials = await _get_credentials(user_id)
    if credentials is None:
        return [], None
    try:
        emails, next_token = await list_inbox_messages(
            credentials, max_results=limit, page_token=page_token
        )
        emails = await _overlay_supabase_status(user_id, emails)
        return emails, next_token
    except Exception as e:
        log.warning("list_inbox_failed", user_id=user_id, error=str(e))
        return [], None


async def batch_get_emails(user_id: str, email_ids: list[str]) -> list[EmailDetail]:
    credentials = await _get_credentials(user_id)
    if credentials is None:
        return []
    try:
        emails = await batch_get_message_details(credentials, email_ids)
        emails = await _overlay_supabase_status(user_id, emails)
        return emails
    except Exception as e:
        log.warning("batch_get_emails_failed", user_id=user_id, error=str(e))
        return []


async def get_email(user_id: str, email_id: str) -> EmailDetail | None:
    credentials = await _get_credentials(user_id)
    if credentials is None:
        return None
    try:
        email = await get_message_detail(credentials, email_id)
        if email is None:
            return None
        [email] = await _overlay_supabase_status(user_id, [email])
        return email
    except Exception as e:
        log.warning("get_email_failed", user_id=user_id, email_id=email_id, error=str(e))
        return None


async def ai_summarize(user_id: str, email_id: str) -> str:
    _ = (user_id, email_id)
    return ""


async def sync_gmail_inbox(user_id: str) -> int:
    emails, _ = await list_inbox(user_id)
    return len(emails)
