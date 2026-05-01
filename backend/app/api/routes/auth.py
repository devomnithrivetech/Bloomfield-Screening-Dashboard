"""Authentication + Gmail OAuth routes."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
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


# ---------------------------------------------------------------------------
# HMAC-signed OAuth state — binds the OAuth callback to the initiating user
# ---------------------------------------------------------------------------

def _make_state(user_id: str, secret: str) -> str:
    """Return a tamper-evident state string encoding user_id."""
    payload = base64.urlsafe_b64encode(json.dumps({"uid": user_id}).encode()).decode()
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify_state(state: str, secret: str) -> str | None:
    """Return the user_id if the state is valid, else None."""
    try:
        payload_b64, sig = state.rsplit(".", 1)
        expected = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        uid = data.get("uid")
        return uid if isinstance(uid, str) and uid else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/google/start")
async def google_oauth_start(user: dict = Depends(get_current_user)) -> dict:
    """Return the Google OAuth consent URL.

    In multi-user mode the current user's ID is embedded in a signed state
    parameter so the callback can store the token under the correct user key.
    """
    settings = get_settings()
    if settings.multi_user_enabled:
        if not settings.supabase_jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server misconfigured: SUPABASE_JWT_SECRET not set",
            )
        state = _make_state(user["id"], settings.supabase_jwt_secret)
        url = get_oauth_url(state=state)
    else:
        url = get_oauth_url()
    return {"url": url}


@router.get("/google/callback")
async def google_oauth_callback(code: str, state: str | None = None) -> RedirectResponse:
    """Exchange auth code for tokens, persist to Supabase, redirect to frontend."""
    settings = get_settings()

    if settings.multi_user_enabled:
        if not state:
            return RedirectResponse(url=f"{_FRONTEND_SETTINGS}?gmail=error&reason=missing_state")
        user_id = _verify_state(state, settings.supabase_jwt_secret)
        if not user_id:
            return RedirectResponse(url=f"{_FRONTEND_SETTINGS}?gmail=error&reason=invalid_state")
    else:
        user_id = "single-user"

    token_data = await exchange_code_for_tokens(code)
    try:
        creds = credentials_from_token_data(token_data)
        profile = await get_gmail_profile(creds)
        token_data["email"] = profile.get("emailAddress", "")
    except Exception:
        pass

    await save_token(user_id, token_data)
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
