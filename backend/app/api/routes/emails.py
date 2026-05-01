"""Email inbox endpoints — powers the Dashboard home page."""
from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
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
    ProcessEmailRequest,
    ProcessEmailResponse,
)
from app.services import deal_service, email_service

# Validation constants for extra attached files
_ALLOWED_EXTRA_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".xlsx", ".xls", ".csv"})
_EXTRA_EXT_TO_TYPE: dict[str, str] = {".pdf": "pdf", ".xlsx": "excel", ".xls": "excel", ".csv": "other"}
_MAX_EXTRA_FILES = 10
_MAX_EXTRA_BYTES = 50 * 1024 * 1024  # 50 MB per file

router = APIRouter()


def _upsert_screened_stub(
    user_id: str,
    gmail_message_id: str,
    meta: ProcessEmailRequest,
) -> None:
    """Create or refresh screened_emails + emails rows immediately so the card
    appears in the Screening Queue and the inbox shows 'Processing' before the
    background pipeline starts. Uses metadata sent by the frontend."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # ── screened_emails card ────────────────────────────────────────────────
    stub: dict = {
        "user_id":               user_id,
        "gmail_message_id":      gmail_message_id,
        "subject":               meta.subject,
        "sender":                meta.sender,
        "sender_email":          meta.sender_email,
        "received_at":           meta.received_at or now,
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

    # ── emails table — set status=processing immediately ───────────────────
    # This ensures the inbox overlay shows "Processing" on the next poll even
    # before the background task has a chance to run _mark_email_processing.
    email_row: dict = {
        "user_id":          user_id,
        "gmail_message_id": gmail_message_id,
        "sender":           meta.sender,
        "subject":          meta.subject,
        "received_at":      meta.received_at or now,
        "status":           "processing",
        "attachments":      [],
    }
    try:
        existing_email = (
            supabase.table("emails")
            .select("id")
            .eq("user_id", user_id)
            .eq("gmail_message_id", gmail_message_id)
            .limit(1)
            .execute()
        )
        if existing_email.data:
            supabase.table("emails").update({"status": "processing"}).eq(
                "id", existing_email.data[0]["id"]
            ).execute()
        else:
            supabase.table("emails").insert(email_row).execute()
    except Exception:
        pass


@router.get("", response_model=EmailListResponse)
async def list_emails(
    page_token: str | None = Query(default=None),
    q: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
) -> EmailListResponse:
    emails, next_token = await email_service.list_inbox(
        user["id"], page_token=page_token, query=q or None
    )
    return EmailListResponse(emails=emails, next_page_token=next_token)


@router.post("/batch", response_model=list[EmailDetail])
async def batch_get_emails(
    body: BatchEmailRequest,
    user: dict = Depends(get_current_user),
) -> list[EmailDetail]:
    return await email_service.batch_get_emails(user["id"], body.ids)


@router.get("/stats")
async def get_inbox_stats(user: dict = Depends(get_current_user)) -> dict:
    """Aggregate stats for the dashboard stats bar."""
    supabase = get_supabase()
    uid = user["id"]
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        total_screened_res = (
            supabase.table("screened_emails")
            .select("id", count="exact")
            .eq("user_id", uid)
            .eq("processing_status", "complete")
            .limit(0)
            .execute()
        )
        screened_this_week_res = (
            supabase.table("screened_emails")
            .select("id", count="exact")
            .eq("user_id", uid)
            .eq("processing_status", "complete")
            .gte("sent_for_screening_at", week_ago)
            .limit(0)
            .execute()
        )
        in_progress_res = (
            supabase.table("screened_emails")
            .select("id", count="exact")
            .eq("user_id", uid)
            .neq("processing_status", "complete")
            .neq("processing_status", "failed")
            .limit(0)
            .execute()
        )
        inbox_this_week_res = (
            supabase.table("emails")
            .select("id", count="exact")
            .eq("user_id", uid)
            .gte("received_at", week_ago)
            .limit(0)
            .execute()
        )
        return {
            "total_screened": total_screened_res.count or 0,
            "screened_this_week": screened_this_week_res.count or 0,
            "in_progress": in_progress_res.count or 0,
            "inbox_this_week": inbox_this_week_res.count or 0,
        }
    except Exception:
        return {"total_screened": 0, "screened_this_week": 0, "in_progress": 0, "inbox_this_week": 0}


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
    extra_files: list[UploadFile] = File(default=[]),
    subject: str = Form(default="(no subject)"),
    sender: str = Form(default="Unknown"),
    sender_email: str | None = Form(default=None),
    received_at: str | None = Form(default=None),
    additional_instructions: str | None = Form(default=None),
    user: dict = Depends(get_current_user),
) -> ProcessEmailResponse:
    """Process a Gmail email through the AI screening pipeline.

    Accepts multipart/form-data.  `extra_files` (optional) are uploaded to S3
    alongside the email's own attachments and included in the LLM context.
    `additional_instructions` is injected into the analyst prompt verbatim.
    """
    # Validate extra files up-front (cheap, no reads yet)
    if len(extra_files) > _MAX_EXTRA_FILES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {_MAX_EXTRA_FILES} additional files per submission.",
        )
    for f in extra_files:
        if not f.filename:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Every uploaded file must have a filename.",
            )
        ext = ("." + f.filename.rsplit(".", 1)[-1].lower()) if "." in f.filename else ""
        if ext not in _ALLOWED_EXTRA_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"'{f.filename}' has an unsupported type. "
                    "Allowed: PDF, XLSX, XLS, CSV."
                ),
            )

    # Read file bytes and enforce per-file size limit
    raw_extra: list[dict] = []
    for f in extra_files:
        data = await f.read()
        if len(data) > _MAX_EXTRA_BYTES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"'{f.filename}' exceeds the 50 MB limit.",
            )
        ext = ("." + f.filename.rsplit(".", 1)[-1].lower()) if "." in f.filename else ""  # type: ignore[union-attr]
        raw_extra.append({
            "filename": f.filename,
            "type":     _EXTRA_EXT_TO_TYPE.get(ext, "other"),
            "data":     data,
        })

    # Rebuild a ProcessEmailRequest from form fields for the stub helper
    meta = ProcessEmailRequest(
        subject=subject,
        sender=sender,
        sender_email=sender_email,
        received_at=received_at,
    )

    # Write the screened_emails card NOW so it appears in the Screening Queue
    # before the background pipeline starts.
    _upsert_screened_stub(user["id"], email_id, meta)

    # Run the full pipeline in the background — response returns immediately.
    background_tasks.add_task(
        deal_service.start_screening,
        user["id"],
        email_id,
        raw_extra or None,
        additional_instructions or None,
    )
    return ProcessEmailResponse(deal_id=None, status="processing")


@router.post("/sync")
async def sync_inbox(user: dict = Depends(get_current_user)) -> dict:
    count = await email_service.sync_gmail_inbox(user["id"])
    return {"new_emails": count}
