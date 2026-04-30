"""Email inbox endpoints — powers the Dashboard home page."""
from __future__ import annotations

import io
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user
from app.core.token_store import load_token
from app.integrations.gmail import credentials_from_token_data
from app.integrations.gmail import download_attachment as gmail_download_attachment
from app.integrations.supabase import get_supabase
from app.schemas.email import (
    AISummarizeResponse,
    BatchEmailRequest,
    EmailDetail,
    EmailListResponse,
    ProcessEmailResponse,
)
from app.services import deal_service, email_service

router = APIRouter()


def _upsert_screened_stub(user_id: str, gmail_message_id: str) -> None:
    """Create or refresh a 'queued' screened_emails row so it appears in the
    Screening Queue page immediately — before the pipeline even starts."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Try to pull subject/sender from the emails table (populated on inbox sync)
    subject, sender, sender_email, received_at = "(loading…)", "Loading…", None, now
    try:
        row = (
            supabase.table("emails")
            .select("subject, sender, sender_email, received_at")
            .eq("user_id", user_id)
            .eq("gmail_message_id", gmail_message_id)
            .limit(1)
            .execute()
        )
        if row.data:
            r = row.data[0]
            subject     = r.get("subject")     or subject
            sender      = r.get("sender")      or sender
            sender_email = r.get("sender_email")
            received_at = r.get("received_at") or received_at
    except Exception:
        pass

    stub: dict = {
        "user_id":               user_id,
        "gmail_message_id":      gmail_message_id,
        "subject":               subject,
        "sender":                sender,
        "sender_email":          sender_email,
        "received_at":           received_at,
        "sent_for_screening_at": now,
        "processing_status":     "queued",
        "pipeline":              [],
    }
    try:
        existing = (
            supabase.table("screened_emails")
            .select("id")
            .eq("user_id", user_id)
            .eq("gmail_message_id", gmail_message_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            supabase.table("screened_emails").update(stub).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("screened_emails").insert(stub).execute()
    except Exception:
        pass


@router.get("", response_model=EmailListResponse)
async def list_emails(
    page_token: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
) -> EmailListResponse:
    emails, next_token = await email_service.list_inbox(user["id"], page_token=page_token)
    return EmailListResponse(emails=emails, next_page_token=next_token)


@router.post("/batch", response_model=list[EmailDetail])
async def batch_get_emails(
    body: BatchEmailRequest,
    user: dict = Depends(get_current_user),
) -> list[EmailDetail]:
    return await email_service.batch_get_emails(user["id"], body.ids)


@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(email_id: str, user: dict = Depends(get_current_user)) -> EmailDetail:
    email = await email_service.get_email(user["id"], email_id)
    if email is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="email not found")
    return email


@router.get("/{email_id}/attachments/{attachment_id}")
async def download_attachment(
    email_id: str,
    attachment_id: str,
    filename: str = Query(default="attachment"),
    user: dict = Depends(get_current_user),
) -> StreamingResponse:
    token_data = await load_token(user["id"])
    if not token_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Gmail not connected")
    creds = credentials_from_token_data(token_data)
    data = await gmail_download_attachment(creds, email_id, attachment_id)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{email_id}/summarize", response_model=AISummarizeResponse)
async def summarize_email(
    email_id: str, user: dict = Depends(get_current_user)
) -> AISummarizeResponse:
    summary = await email_service.ai_summarize(user["id"], email_id)
    return AISummarizeResponse(summary=summary)


@router.post("/{email_id}/process", response_model=ProcessEmailResponse)
async def process_email(
    email_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> ProcessEmailResponse:
    # Insert the screened_emails stub NOW so the card is visible immediately.
    _upsert_screened_stub(user["id"], email_id)
    # Run the full pipeline in the background — response returns immediately.
    background_tasks.add_task(deal_service.start_screening, user["id"], email_id)
    return ProcessEmailResponse(deal_id=None, status="processing")


@router.post("/sync")
async def sync_inbox(user: dict = Depends(get_current_user)) -> dict:
    count = await email_service.sync_gmail_inbox(user["id"])
    return {"new_emails": count}
