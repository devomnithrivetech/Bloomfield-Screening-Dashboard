"""Authentication dependencies.

In multi-user mode (ENGAGEMENT_OPTION=option_3) resolves the current user from
a Supabase JWT.  Supports both:
  - HS256/384/512  — verified against SUPABASE_JWT_SECRET (base64-decoded)
  - RS256/384/512 / ES256/384/512 / EdDSA — verified against the project's
    public JWKS endpoint at <SUPABASE_URL>/auth/v1/.well-known/jwks.json

The algorithm is determined from the token header so no manual config is needed.
In single-user mode returns the fixed dev identity unchanged.
"""
from __future__ import annotations

import asyncio
import base64
from functools import lru_cache

import jwt as pyjwt
from jwt import PyJWKClient
from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_HS_ALGOS = frozenset({"HS256", "HS384", "HS512"})
_ASYM_ALGOS = frozenset({"RS256", "RS384", "RS512", "ES256", "ES384", "ES512", "EdDSA"})


@lru_cache
def _jwks_client(supabase_url: str) -> PyJWKClient:
    """One cached JWKS client per project — fetches & rotates keys automatically."""
    return PyJWKClient(
        f"{supabase_url}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
    )


def _hs_secret(raw: str) -> bytes:
    """Supabase stores the JWT secret as a base64-encoded string; decode it."""
    try:
        return base64.b64decode(raw)
    except Exception:
        return raw.encode("utf-8")


def _verify_token_sync(token: str, settings: Settings) -> dict:
    """Synchronous verification — runs in a thread-pool executor."""
    try:
        alg = pyjwt.get_unverified_header(token).get("alg", "")
    except Exception as exc:
        raise pyjwt.InvalidTokenError(f"Cannot parse token header: {exc}")

    if alg in _HS_ALGOS:
        if not settings.supabase_jwt_secret:
            raise pyjwt.InvalidTokenError("SUPABASE_JWT_SECRET not configured")
        return pyjwt.decode(
            token,
            _hs_secret(settings.supabase_jwt_secret),
            algorithms=[alg],
            audience="authenticated",
        )

    if alg in _ASYM_ALGOS:
        client = _jwks_client(settings.supabase_url)
        signing_key = client.get_signing_key_from_jwt(token)
        return pyjwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            audience="authenticated",
        )

    raise pyjwt.InvalidAlgorithmError(f"Unsupported JWT algorithm: {alg!r}")


async def get_current_user(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> dict:
    if not settings.multi_user_enabled:
        return {"id": "single-user", "email": "admin@bloomfield.local"}

    if not authorization or not authorization.lower().startswith("bearer "):
        log.warning("auth_missing_header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]
    loop = asyncio.get_event_loop()
    try:
        payload: dict = await loop.run_in_executor(
            None, _verify_token_sync, token, settings
        )
    except pyjwt.ExpiredSignatureError:
        log.warning("auth_token_expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except pyjwt.InvalidTokenError as exc:
        log.warning("auth_token_invalid", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        log.warning("auth_token_missing_sub")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub claim",
        )

    return {"id": user_id, "email": payload.get("email", "")}
