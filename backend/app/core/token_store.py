"""Supabase-backed OAuth token storage.

The `gmail_tokens` table uses `user_key` as the primary key so it works in
both single-user mode (key = "single-user") and multi-user mode (key = UUID).
All access uses the service_role key to bypass RLS.
"""
from __future__ import annotations

import asyncio
from functools import lru_cache
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_TABLE = "gmail_tokens"


@lru_cache
def _get_supabase_client() -> Any | None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        log.warning("supabase_not_configured", msg="Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable Gmail token storage")
        return None
    from supabase import create_client
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def _run(fn):
    """Run a sync Supabase call in the default thread pool."""
    return await asyncio.get_event_loop().run_in_executor(None, fn)


async def load_token(user_id: str) -> dict | None:
    client = _get_supabase_client()
    if not client:
        return None
    try:
        def _fetch():
            result = (
                client.table(_TABLE)
                .select("*")
                .eq("user_key", user_id)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None

        return await _run(_fetch)
    except Exception as e:
        log.warning("token_load_failed", user_id=user_id, error=str(e))
        return None


async def save_token(user_id: str, token_data: dict) -> None:
    client = _get_supabase_client()
    if not client:
        log.warning("token_save_skipped", msg="Supabase not configured")
        return
    try:
        row = {
            "user_key": user_id,
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "email": token_data.get("email"),
            "scopes": token_data.get("scopes") or [],
        }
        await _run(lambda: client.table(_TABLE).upsert(row).execute())
    except Exception as e:
        log.error("token_save_failed", user_id=user_id, error=str(e))


async def delete_token(user_id: str) -> None:
    client = _get_supabase_client()
    if not client:
        return
    try:
        await _run(lambda: client.table(_TABLE).delete().eq("user_key", user_id).execute())
    except Exception as e:
        log.warning("token_delete_failed", user_id=user_id, error=str(e))
