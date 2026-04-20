"""Supabase-backed user record (multi-user in Option 3)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class UserRecord:
    id: str
    email: str
    role: str = "analyst"
    gmail_refresh_token: str | None = None
