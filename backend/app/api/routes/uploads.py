"""Manual deal upload endpoint.

Allows users to submit deal documents directly from their local device
without requiring a Gmail connection.  Accepts up to 10 files (PDF / XLSX /
XLS / CSV) plus optional pasted body text, creates the necessary database
rows immediately, then kicks off the same AI screening pipeline used for
Gmail emails in the background.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.integrations.supabase import get_supabase
from app.services import deal_service

router = APIRouter()

# ---------------------------------------------------------------------------
# Validation constants
# ---------------------------------------------------------------------------
_ALLOWED_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".xlsx", ".xls", ".csv", ".docx", ".doc"})
_EXT_TO_TYPE: dict[str, str] = {
    ".pdf":  "pdf",
    ".xlsx": "excel",
    ".xls":  "excel",
    ".csv":  "other",
    ".docx": "word",
    ".doc":  "word",
}
_MAX_FILES    = 10
_MAX_BYTES    = 50 * 1024 * 1024  # 50 MB per file


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------
class UploadDealResponse(BaseModel):
    screened_email_id: str
    email_id: str
    status: str = "processing"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _create_upload_stub(
    supabase,
    user_id: str,
    subject: str,
    sender: str,
    sender_email: str | None,
    body_text: str | None,
) -> tuple[str, str]:
    """Insert emails + screened_emails rows for a manual upload.

    Returns (email_id, screened_email_id) as UUID strings.
    Both rows are written synchronously so the Screening Queue card is
    visible before the background pipeline starts.
    """
    now = datetime.now(timezone.utc).isoformat()

    # emails row — no gmail_message_id, source='manual_upload'
    email_row: dict = {
        "user_id":          user_id,
        "sender":           sender,
        "subject":          subject,
        "body_text":        body_text,
        "received_at":      now,
        "status":           "processing",
        "attachments":      [],
        "source":           "manual_upload",
    }
    email_resp = supabase.table("emails").insert(email_row).execute()
    email_id = str(email_resp.data[0]["id"])

    # screened_emails stub — pipeline array initialised to empty;
    # the background task will fill it once it starts.
    stub: dict = {
        "user_id":               user_id,
        "subject":               subject,
        "sender":                sender,
        "sender_email":          sender_email,
        "received_at":           now,
        "sent_for_screening_at": now,
        "processing_status":     "queued",
        "pipeline":              [],
        "source":                "manual_upload",
    }
    screened_resp = supabase.table("screened_emails").insert(stub).execute()
    screened_email_id = str(screened_resp.data[0]["id"])

    return email_id, screened_email_id


def _validate_file(f: UploadFile) -> None:
    if not f.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Every file must have a filename.",
        )
    ext = ("." + f.filename.rsplit(".", 1)[-1].lower()) if "." in f.filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"'{f.filename}' has an unsupported type. "
                "Allowed extensions: PDF, XLSX, XLS, CSV, DOCX, DOC."
            ),
        )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@router.post("", response_model=UploadDealResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_deal(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(default=[]),
    subject: str = Form(default="Manual Upload"),
    sender: str = Form(default="Manual Upload"),
    sender_email: str | None = Form(default=None),
    body_text: str | None = Form(default=None),
    user: dict = Depends(get_current_user),
) -> UploadDealResponse:
    """Accept deal documents uploaded directly from the user's device.

    At least one file **or** body_text must be provided.  Files are read into
    memory here (fast, bounded by _MAX_BYTES), then passed to the background
    screening pipeline — no temporary files are written to disk.
    """
    if not files and not (body_text and body_text.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide at least one file or paste some body text.",
        )
    if len(files) > _MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {_MAX_FILES} files per upload.",
        )

    # Validate extensions up-front (cheap, no reads yet)
    for f in files:
        _validate_file(f)

    # Read file data — enforce size limit per file
    raw_attachments: list[dict] = []
    for f in files:
        data = await f.read()
        if len(data) > _MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"'{f.filename}' exceeds the 50 MB limit.",
            )
        ext = ("." + f.filename.rsplit(".", 1)[-1].lower()) if "." in f.filename else ""  # type: ignore[union-attr]
        raw_attachments.append({
            "filename": f.filename,
            "type":     _EXT_TO_TYPE.get(ext, "other"),
            "data":     data,
        })

    # Write DB stubs synchronously so the queue card appears immediately
    supabase = get_supabase()
    try:
        email_id, screened_email_id = _create_upload_stub(
            supabase,
            user_id=user["id"],
            subject=subject,
            sender=sender,
            sender_email=sender_email,
            body_text=body_text,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create upload record: {exc}",
        )

    # Fire-and-forget: same AI pipeline as Gmail flow
    background_tasks.add_task(
        deal_service.start_manual_screening,
        user["id"],
        email_id,
        screened_email_id,
        raw_attachments,
        {
            "subject":      subject,
            "sender":       sender,
            "sender_email": sender_email,
            "body_text":    body_text,
        },
    )

    return UploadDealResponse(
        screened_email_id=screened_email_id,
        email_id=email_id,
        status="processing",
    )
