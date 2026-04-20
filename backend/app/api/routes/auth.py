"""Authentication + Gmail OAuth routes."""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/google/start")
async def google_oauth_start() -> dict:
    """Redirect URL for the Gmail OAuth consent screen."""
    # TODO: build Google OAuth URL with GMAIL_SCOPES + state
    return {"url": ""}


@router.get("/google/callback")
async def google_oauth_callback(code: str, state: str | None = None) -> dict:
    """Exchange the auth code for tokens and persist to Supabase."""
    _ = (code, state)
    return {"status": "ok"}


@router.post("/logout")
async def logout() -> dict:
    return {"status": "ok"}
