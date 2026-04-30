"""Screened emails queue endpoint — powers the Screening Results page."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.integrations.supabase import get_supabase

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
            .limit(200)
            .execute()
        )
        return resp.data or []
    except Exception:
        return []
