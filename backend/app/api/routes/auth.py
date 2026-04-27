"""Authentication + Gmail OAuth routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from app.core.security import get_current_user
from app.core.token_store import delete_token, load_token, save_token
from app.integrations.gmail import (
    credentials_from_token_data,
    exchange_code_for_tokens,
    get_gmail_profile,
    get_oauth_url,
)

router = APIRouter()

_FRONTEND_SETTINGS = "http://localhost:8080/settings"


@router.get("/google/start")
async def google_oauth_start() -> dict:
    """Return the Google OAuth consent screen URL."""
    return {"url": get_oauth_url()}


@router.get("/google/callback")
async def google_oauth_callback(code: str, state: str | None = None) -> RedirectResponse:
    """Exchange auth code for tokens, persist to Supabase, redirect to frontend."""
    token_data = await exchange_code_for_tokens(code)
    try:
        creds = credentials_from_token_data(token_data)
        profile = await get_gmail_profile(creds)
        token_data["email"] = profile.get("emailAddress", "")
    except Exception:
        pass
    await save_token("single-user", token_data)
    return RedirectResponse(url=f"{_FRONTEND_SETTINGS}?gmail=connected")


@router.post("/google/disconnect")
async def google_oauth_disconnect(user: dict = Depends(get_current_user)) -> dict:
    await delete_token(user["id"])
    return {"status": "disconnected"}


@router.get("/google/status")
async def google_oauth_status(user: dict = Depends(get_current_user)) -> dict:
    token_data = await load_token(user["id"])
    if not token_data:
        return {"connected": False, "email": None, "last_synced_at": None}
    return {
        "connected": True,
        "email": token_data.get("email"),
        "last_synced_at": token_data.get("updated_at"),
    }


@router.post("/logout")
async def logout() -> dict:
    return {"status": "ok"}
