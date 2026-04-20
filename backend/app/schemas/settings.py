"""Pydantic schemas backing the Settings page."""
from __future__ import annotations

from pydantic import BaseModel


class GmailIntegrationStatus(BaseModel):
    connected: bool
    email: str | None = None
    last_synced_at: str | None = None


class EmailFilterRule(BaseModel):
    id: str | None = None
    keyword: str
    asset_class: str | None = None
    enabled: bool = True


class AIScreeningSettings(BaseModel):
    model: str
    interest_rate: float
    points: float
    interest_reserve_months: int
    cap_rate: float


class NotificationSettings(BaseModel):
    notify_on_complete: bool = True
    notify_on_proceed: bool = True
    daily_digest: bool = False


class UserSettings(BaseModel):
    gmail: GmailIntegrationStatus
    filters: list[EmailFilterRule]
    screening: AIScreeningSettings
    notifications: NotificationSettings
