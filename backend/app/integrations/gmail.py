"""Gmail API integration via Google OAuth.

Responsibilities:
  * Build the OAuth consent URL and exchange the callback code for tokens.
  * List and fetch inbox messages for a connected user.
  * Download attachment bytes for a given message + attachment ID.
  * Send the generated screening email with .xlsx attached.
"""
from __future__ import annotations

import asyncio
import base64
import email.utils
import urllib.parse
from datetime import datetime, timezone
from email.header import decode_header as _decode_rfc2047
from typing import Any

import httpx
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.core.config import get_settings
from app.schemas.email import Attachment, AttachmentType, EmailDetail, EmailStatus, EmailSummary

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
]

_AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
_TOKEN_URI = "https://oauth2.googleapis.com/token"


# ---------------------------------------------------------------------------
# OAuth helpers — built manually to avoid google_auth_oauthlib's PKCE injection
# ---------------------------------------------------------------------------

def get_oauth_url() -> str:
    """Return the Google OAuth consent screen URL (no PKCE)."""
    s = get_settings()
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": s.google_oauth_redirect_uri_clean,
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    return f"{_AUTH_URI}?{urllib.parse.urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> dict:
    """POST directly to Google's token endpoint — no PKCE, no requests_oauthlib."""
    s = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _TOKEN_URI,
            data={
                "code": code,
                "client_id": s.google_client_id,
                "client_secret": s.google_client_secret,
                "redirect_uri": s.google_oauth_redirect_uri_clean,
                "grant_type": "authorization_code",
            },
        )
    token = resp.json()
    if "error" in token:
        raise ValueError(f"Token exchange failed: {token['error']} — {token.get('error_description', '')}")
    return {
        "access_token": token.get("access_token"),
        "refresh_token": token.get("refresh_token"),
        "token_uri": _TOKEN_URI,
        "scopes": token.get("scope", "").split(),
    }


def credentials_from_token_data(token_data: dict) -> Credentials:
    """Rebuild a Credentials object from a stored token row."""
    s = get_settings()
    return Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", _TOKEN_URI),
        client_id=s.google_client_id,
        client_secret=s.google_client_secret,
        scopes=token_data.get("scopes", GMAIL_SCOPES),
    )


def build_gmail_service(credentials: Credentials) -> Any:
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


# ---------------------------------------------------------------------------
# Message parsing helpers
# ---------------------------------------------------------------------------

def _decode_header_value(value: str) -> str:
    parts = []
    for raw, charset in _decode_rfc2047(value):
        if isinstance(raw, bytes):
            parts.append(raw.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(raw)
    return "".join(parts)


def _get_header(headers: list[dict], name: str) -> str:
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def _parse_from(from_header: str) -> tuple[str, str]:
    """Return (display_name, email_address)."""
    name, addr = email.utils.parseaddr(from_header)
    return (_decode_header_value(name) if name else addr), addr


def _parse_date(date_str: str) -> datetime:
    try:
        parsed = email.utils.parsedate_to_datetime(date_str)
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def _attachment_type(mime_type: str, filename: str) -> AttachmentType:
    fn = filename.lower()
    if "spreadsheet" in mime_type or fn.endswith((".xlsx", ".xls", ".csv")):
        return AttachmentType.EXCEL
    if "pdf" in mime_type or fn.endswith(".pdf"):
        return AttachmentType.PDF
    return AttachmentType.OTHER


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


def _extract_parts(payload: dict) -> tuple[str, str, list[dict]]:
    """Recursively extract (plain_text, html_text, attachments) from payload."""
    text, html = "", ""
    attachments: list[dict] = []

    mime = payload.get("mimeType", "")
    body = payload.get("body", {})
    parts = payload.get("parts", [])
    filename = payload.get("filename", "")

    if mime == "text/plain" and not filename:
        data = body.get("data", "")
        if data:
            text = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    elif mime == "text/html" and not filename:
        data = body.get("data", "")
        if data:
            html = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    elif filename and body.get("attachmentId"):
        attachments.append({
            "id": body["attachmentId"],
            "filename": filename,
            "mimeType": mime,
            "size": body.get("size", 0),
        })

    for part in parts:
        t, h, a = _extract_parts(part)
        if t and not text:
            text = t
        if h and not html:
            html = h
        attachments.extend(a)

    return text, html, attachments


def _msg_to_summary(msg: dict) -> EmailSummary:
    headers = msg.get("payload", {}).get("headers", [])
    sender_name, sender_email_addr = _parse_from(_get_header(headers, "From"))
    subject = _decode_header_value(_get_header(headers, "Subject")) or "(no subject)"
    received_at = _parse_date(_get_header(headers, "Date"))
    snippet = msg.get("snippet", "")

    _, _, raw_atts = _extract_parts(msg.get("payload", {}))
    attachments = [
        Attachment(
            id=a["id"],
            filename=a["filename"],
            type=_attachment_type(a["mimeType"], a["filename"]),
            size_bytes=a["size"],
        )
        for a in raw_atts
    ]

    return EmailSummary(
        id=msg["id"],
        sender=sender_name,
        sender_email=sender_email_addr,
        subject=subject,
        preview=snippet,
        received_at=received_at,
        status=EmailStatus.UNPROCESSED,
        attachments=attachments,
    )


def _msg_to_detail(msg: dict) -> EmailDetail:
    summary = _msg_to_summary(msg)
    text, html, _ = _extract_parts(msg.get("payload", {}))
    return EmailDetail(
        **summary.model_dump(),
        body_text=text or None,
        body_html=html or None,
    )


# ---------------------------------------------------------------------------
# Async Gmail API calls
# ---------------------------------------------------------------------------

async def get_gmail_profile(credentials: Credentials) -> dict:
    loop = asyncio.get_event_loop()

    def _do():
        svc = build_gmail_service(credentials)
        return svc.users().getProfile(userId="me").execute()

    return await loop.run_in_executor(None, _do)


async def list_inbox_messages(
    credentials: Credentials,
    max_results: int = 20,
    page_token: str | None = None,
    query: str | None = None,
) -> tuple[list[EmailDetail], str | None]:
    """Fetch inbox summaries using metadata format (headers + snippet only).

    Uses a Gmail batch HTTP request so all per-message metadata fetches are
    sent in a single round-trip instead of one request per message.
    When `query` is provided, searches all mail (no INBOX restriction) to
    match Gmail UI search behaviour.
    Returns (emails, next_page_token).
    """
    loop = asyncio.get_event_loop()

    def _fetch_all() -> tuple[list[dict], str | None]:
        svc = build_gmail_service(credentials)
        list_kwargs: dict[str, Any] = {
            "userId": "me",
            "maxResults": max_results,
        }
        if not query:
            list_kwargs["labelIds"] = ["INBOX"]
        if page_token:
            list_kwargs["pageToken"] = page_token
        if query:
            list_kwargs["q"] = query

        list_res = svc.users().messages().list(**list_kwargs).execute()
        refs = list_res.get("messages", [])
        next_token: str | None = list_res.get("nextPageToken")

        if not refs:
            return [], next_token

        ordered_ids = [r["id"] for r in refs]
        results: dict[str, dict] = {}

        def _cb(request_id: str, response: dict | None, exception: Exception | None) -> None:
            if response is not None:
                results[request_id] = response

        batch = svc.new_batch_http_request(callback=_cb)
        for mid in ordered_ids:
            batch.add(
                svc.users().messages().get(
                    userId="me",
                    id=mid,
                    format="metadata",
                    metadataHeaders=["From", "Subject", "Date"],
                ),
                request_id=mid,
            )
        batch.execute()

        return [results[mid] for mid in ordered_ids if mid in results], next_token

    try:
        raw_msgs, next_token = await loop.run_in_executor(None, _fetch_all)
    except Exception:
        return [], None

    return [_msg_to_detail(msg) for msg in raw_msgs], next_token


async def get_message_detail(credentials: Credentials, message_id: str) -> EmailDetail | None:
    """Fetch a single message with full MIME content (body + attachments)."""
    loop = asyncio.get_event_loop()
    try:
        def _do():
            svc = build_gmail_service(credentials)
            return svc.users().messages().get(
                userId="me", id=message_id, format="full"
            ).execute()

        msg = await loop.run_in_executor(None, _do)
        return _msg_to_detail(msg)
    except Exception:
        return None


async def batch_get_message_details(
    credentials: Credentials, message_ids: list[str]
) -> list[EmailDetail]:
    """Fetch full MIME content for multiple messages in a single batch HTTP call."""
    if not message_ids:
        return []
    loop = asyncio.get_event_loop()

    def _do_all() -> list[EmailDetail]:
        svc = build_gmail_service(credentials)
        results: dict[str, dict] = {}

        def _cb(request_id: str, response: dict | None, exception: Exception | None) -> None:
            if response is not None:
                results[request_id] = response

        batch = svc.new_batch_http_request(callback=_cb)
        for mid in message_ids:
            batch.add(
                svc.users().messages().get(userId="me", id=mid, format="full"),
                request_id=mid,
            )
        batch.execute()

        return [_msg_to_detail(results[mid]) for mid in message_ids if mid in results]

    try:
        return await loop.run_in_executor(None, _do_all)
    except Exception:
        return []


async def download_attachment(
    credentials: Credentials, message_id: str, attachment_id: str
) -> bytes:
    loop = asyncio.get_event_loop()

    def _do():
        svc = build_gmail_service(credentials)
        return (
            svc.users()
            .messages()
            .attachments()
            .get(userId="me", messageId=message_id, id=attachment_id)
            .execute()
        )

    att = await loop.run_in_executor(None, _do)
    return base64.urlsafe_b64decode(att.get("data", "") + "==")


async def send_message(credentials: Credentials, raw_mime: str) -> dict:
    loop = asyncio.get_event_loop()

    def _do():
        svc = build_gmail_service(credentials)
        return svc.users().messages().send(
            userId="me", body={"raw": raw_mime}
        ).execute()

    return await loop.run_in_executor(None, _do)


def oauth_config() -> dict:
    s = get_settings()
    return {
        "client_id": s.google_client_id,
        "client_secret": s.google_client_secret,
        "redirect_uri": s.google_oauth_redirect_uri_clean,
        "scopes": GMAIL_SCOPES,
    }
