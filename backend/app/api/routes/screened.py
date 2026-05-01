"""Screened emails queue endpoint — powers the Screening Results page."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.security import get_current_user
from app.integrations.supabase import get_supabase
from app.services import deal_service

router = APIRouter()


@router.get("")
async def list_screened_emails(user: dict = Depends(get_current_user)) -> list[dict]:
    """Return all emails that have been sent for screening, newest first."""
    supabase = get_supabase()
    try:
        resp = (
            supabase.table("screened_emails")
            .select("*")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .limit(500)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []


@router.post("/{screened_email_id}/reprocess")
async def reprocess_screened_email(
    screened_email_id: str,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict:
    """Reset a screened email's pipeline state and restart the AI screening process."""
    supabase = get_supabase()

    try:
        resp = (
            supabase.table("screened_emails")
            .select("*")
            .eq("id", screened_email_id)
            .eq("user_id", user["id"])
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    if not resp.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening record not found")

    entry = resp.data[0]
    gmail_message_id = entry.get("gmail_message_id")

    # Reset the screened_emails row to queued state
    try:
        supabase.table("screened_emails").update({
            "processing_status":   "queued",
            "pipeline":            [],
            "deal_id":             None,
            "screener_s3_key":     None,
            "sent_for_screening_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", screened_email_id).execute()
    except Exception:
        pass

    if gmail_message_id:
        # Gmail-sourced email: clear the result cache so the pipeline re-runs in full
        try:
            supabase.table("emails").update({
                "deal_id": None,
                "status":  "processing",
            }).eq("user_id", user["id"]).eq("gmail_message_id", gmail_message_id).execute()
        except Exception:
            pass
        background_tasks.add_task(
            deal_service.start_screening,
            user["id"], gmail_message_id, None, None,
        )
    else:
        # Manual upload: re-download files from S3 and re-run
        background_tasks.add_task(
            deal_service.reprocess_manual_screening,
            user["id"], screened_email_id, entry,
        )

    return {"status": "reprocessing"}
