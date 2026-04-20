"""Gmail API integration via Google OAuth.

Responsibilities:
  * Exchange OAuth code for credentials and persist them (Supabase).
  * List and fetch deal emails for a user's inbox.
  * Download attachments into the document-processing pipeline.
  * Send the generated screening email with `.xlsx` attached.
"""
from __future__ import annotations

from typing import Any

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.config import get_settings

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]


def build_gmail_service(credentials: Credentials) -> Any:
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


async def list_messages(credentials: Credentials, query: str, max_results: int = 50) -> list[dict]:
    """List messages matching a Gmail search query (e.g. `label:INBOX is:unread`)."""
    service = build_gmail_service(credentials)
    result = service.users().messages().list(userId="me", q=query, maxResults=max_results).execute()
    return result.get("messages", [])


async def get_message(credentials: Credentials, message_id: str) -> dict:
    service = build_gmail_service(credentials)
    return service.users().messages().get(userId="me", id=message_id, format="full").execute()


async def download_attachment(
    credentials: Credentials, message_id: str, attachment_id: str
) -> bytes:
    service = build_gmail_service(credentials)
    attachment = (
        service.users()
        .messages()
        .attachments()
        .get(userId="me", messageId=message_id, id=attachment_id)
        .execute()
    )
    import base64

    return base64.urlsafe_b64decode(attachment["data"])


async def send_message(credentials: Credentials, raw_mime: str) -> dict:
    service = build_gmail_service(credentials)
    return service.users().messages().send(userId="me", body={"raw": raw_mime}).execute()


def oauth_config() -> dict:
    settings = get_settings()
    return {
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "scopes": GMAIL_SCOPES,
    }
