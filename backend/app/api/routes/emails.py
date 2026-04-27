"""Email inbox endpoints — powers the Dashboard home page."""
from __future__ import annotations

import io

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user
from app.core.token_store import load_token
from app.integrations.gmail import credentials_from_token_data
from app.integrations.gmail import download_attachment as gmail_download_attachment
from app.schemas.email import (
    AISummarizeResponse,
    BatchEmailRequest,
    EmailDetail,
    EmailListResponse,
    ProcessEmailResponse,
)
from app.services import deal_service, email_service

router = APIRouter()


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
    email_id: str, user: dict = Depends(get_current_user)
) -> ProcessEmailResponse:
    deal_id = await deal_service.start_screening(user["id"], email_id)
    return ProcessEmailResponse(deal_id=deal_id, status="processing")


@router.post("/sync")
async def sync_inbox(user: dict = Depends(get_current_user)) -> dict:
    count = await email_service.sync_gmail_inbox(user["id"])
    return {"new_emails": count}
