"""Email inbox endpoints — powers the Dashboard home page."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.email import (
    AISummarizeResponse,
    EmailDetail,
    EmailSummary,
    ProcessEmailResponse,
)
from app.services import deal_service, email_service

router = APIRouter()


@router.get("", response_model=list[EmailSummary])
async def list_emails(user: dict = Depends(get_current_user)) -> list[EmailSummary]:
    return await email_service.list_inbox(user["id"])


@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(email_id: str, user: dict = Depends(get_current_user)) -> EmailDetail:
    email = await email_service.get_email(user["id"], email_id)
    if email is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="email not found")
    return email


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
