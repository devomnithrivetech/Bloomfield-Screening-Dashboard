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
from app.schemas.email import EmailDetail

log = get_logger(__name__)


async def _get_credentials(user_id: str):
    token_data = await load_token(user_id)
    if not token_data:
        return None
    return credentials_from_token_data(token_data)


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
        return await list_inbox_messages(credentials, max_results=limit, page_token=page_token)
    except Exception as e:
        log.warning("list_inbox_failed", user_id=user_id, error=str(e))
        return [], None


async def batch_get_emails(user_id: str, email_ids: list[str]) -> list[EmailDetail]:
    credentials = await _get_credentials(user_id)
    if credentials is None:
        return []
    try:
        return await batch_get_message_details(credentials, email_ids)
    except Exception as e:
        log.warning("batch_get_emails_failed", user_id=user_id, error=str(e))
        return []


async def get_email(user_id: str, email_id: str) -> EmailDetail | None:
    credentials = await _get_credentials(user_id)
    if credentials is None:
        return None
    try:
        return await get_message_detail(credentials, email_id)
    except Exception as e:
        log.warning("get_email_failed", user_id=user_id, email_id=email_id, error=str(e))
        return None


async def ai_summarize(user_id: str, email_id: str) -> str:
    _ = (user_id, email_id)
    return ""


async def sync_gmail_inbox(user_id: str) -> int:
    emails, _ = await list_inbox(user_id)
    return len(emails)
