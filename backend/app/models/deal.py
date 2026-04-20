"""Domain model placeholders for the Supabase-backed deal record.

Schema lives in Supabase migrations; this module mirrors the columns the backend
reads and writes. Keep in sync with `supabase/migrations/*.sql`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DealRecord:
    id: str
    user_id: str
    email_id: str
    property_name: str | None = None
    asset_class: str | None = None
    recommendation: str | None = None
    confidence: float | None = None
    risk_rating: str | None = None
    screener_storage_path: str | None = None
    email_draft: str | None = None
    metrics: dict = field(default_factory=dict)
    highlights: list[dict] = field(default_factory=list)
    risks: list[dict] = field(default_factory=list)
    pipeline: list[dict] = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
