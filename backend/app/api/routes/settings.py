"""Settings endpoints — powers the Settings page."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.schemas.settings import (
    AIScreeningSettings,
    EmailFilterRule,
    NotificationSettings,
    UserSettings,
)

router = APIRouter()


@router.get("", response_model=UserSettings)
async def get_settings(user: dict = Depends(get_current_user)) -> UserSettings:
    # TODO: load from Supabase `user_settings` table
    _ = user
    return UserSettings(
        gmail={"connected": False},
        filters=[],
        screening=AIScreeningSettings(
            model="claude-opus-4-7",
            interest_rate=0.095,
            points=1.0,
            interest_reserve_months=6,
            cap_rate=0.085,
        ),
        notifications=NotificationSettings(),
    )


@router.put("/filters", response_model=list[EmailFilterRule])
async def update_filters(
    filters: list[EmailFilterRule], user: dict = Depends(get_current_user)
) -> list[EmailFilterRule]:
    _ = user
    return filters


@router.put("/screening", response_model=AIScreeningSettings)
async def update_screening(
    screening: AIScreeningSettings, user: dict = Depends(get_current_user)
) -> AIScreeningSettings:
    _ = user
    return screening


@router.put("/notifications", response_model=NotificationSettings)
async def update_notifications(
    notifications: NotificationSettings, user: dict = Depends(get_current_user)
) -> NotificationSettings:
    _ = user
    return notifications
