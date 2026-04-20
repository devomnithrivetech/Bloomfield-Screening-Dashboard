"""Authentication dependencies.

In Option 3 this resolves the current user from a Supabase JWT. In Options 1/2
it returns the single configured user.
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


async def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> dict:
    if not settings.multi_user_enabled:
        return {"id": "single-user", "email": "admin@bloomfield.local"}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    # TODO: verify Supabase JWT and return user claims
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Auth not wired")
