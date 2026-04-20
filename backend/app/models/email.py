"""Supabase-backed email record."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class EmailRecord:
    id: str
    user_id: str
    gmail_message_id: str
    sender: str
    subject: str
    body_text: str | None
    body_html: str | None
    received_at: datetime
    status: str = "unprocessed"
    attachments: list[dict] = field(default_factory=list)
    deal_id: str | None = None
