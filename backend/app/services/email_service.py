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
    query: str | None = None,
) -> tuple[list[EmailDetail], str | None]:
    credentials = await _get_credentials(user_id)
    if credentials is None:
        return [], None
    try:
        emails, next_token = await list_inbox_messages(
            credentials, max_results=limit, page_token=page_token, query=query
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
    """Return a brief AI-generated summary of a Gmail email.

    First checks the emails table for a cached summary; on a cache miss it
    fetches the email from Gmail, calls the summarize agent, persists the
    result, and returns it.  Never raises — callers receive an empty string
    on any failure.
    """
    from datetime import datetime, timezone as tz
    from app.integrations.supabase import get_supabase
    from app.agents.summarize import summarize_email

    supabase = get_supabase()

    # ── 1. Cache check ─────────────────────────────────────────────────────────
    existing_db_id: str | None = None
    try:
        resp = (
            supabase.table("emails")
            .select("id, summary")
            .eq("user_id", user_id)
            .eq("gmail_message_id", email_id)
            .limit(1)
            .execute()
        )
        if resp.data:
            row = resp.data[0]
            existing_db_id = row["id"]
            if row.get("summary"):
                return row["summary"]
    except Exception as exc:
        log.warning("ai_summarize_cache_check_failed", email_id=email_id, error=str(exc))

    # ── 2. Fetch email from Gmail ───────────────────────────────────────────────
    credentials = await _get_credentials(user_id)
    if credentials is None:
        log.warning("ai_summarize_no_credentials", user_id=user_id)
        return ""

    try:
        email = await get_message_detail(credentials, email_id)
    except Exception as exc:
        log.warning("ai_summarize_fetch_failed", email_id=email_id, error=str(exc))
        return ""

    if email is None:
        return ""

    # ── 3. Call LLM ────────────────────────────────────────────────────────────
    body_text = email.body_text or ""
    attachment_names = [a.filename for a in (email.attachments or [])]
    sender_label = (
        f"{email.sender} <{email.sender_email}>"
        if email.sender_email
        else email.sender
    )

    summary = await summarize_email(
        subject=email.subject,
        sender=sender_label,
        body_text=body_text,
        attachment_names=attachment_names,
    )

    if not summary:
        return ""

    # ── 4. Persist to emails table ─────────────────────────────────────────────
    try:
        if existing_db_id:
            supabase.table("emails").update({"summary": summary}).eq(
                "id", existing_db_id
            ).execute()
        else:
            received = (
                email.received_at.isoformat()
                if email.received_at
                else datetime.now(tz.utc).isoformat()
            )
            supabase.table("emails").insert({
                "user_id":          user_id,
                "gmail_message_id": email_id,
                "sender":           email.sender,
                "subject":          email.subject,
                "body_text":        body_text[:50_000],  # store body for future use
                "received_at":      received,
                "status":           "unprocessed",
                "attachments":      [],
                "summary":          summary,
            }).execute()
    except Exception as exc:
        log.warning("ai_summarize_store_failed", email_id=email_id, error=str(exc))
        # Non-fatal — still return the summary we computed

    return summary


async def sync_gmail_inbox(user_id: str) -> int:
    emails, _ = await list_inbox(user_id)
    return len(emails)
