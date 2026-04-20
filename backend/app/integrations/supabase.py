"""Supabase client factory (auth, Postgres, storage, realtime)."""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Service-role client for backend writes and realtime broadcasts."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@lru_cache
def get_supabase_anon() -> Client:
    """Anon client for operations that must respect row-level security."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


async def broadcast_stage(deal_id: str, stage: str, status: str, payload: dict | None = None) -> None:
    """Push a pipeline-stage update to the frontend via Supabase Realtime.

    The frontend subscribes to `deals:<deal_id>` to drive the 5-stage progress bar
    on the Deal Detail page.
    """
    # TODO: implement once realtime channel names are finalized
    _ = (deal_id, stage, status, payload)
