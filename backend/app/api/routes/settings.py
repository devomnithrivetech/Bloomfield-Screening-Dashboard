"""Settings endpoints — powers the Settings page."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.core.token_store import load_token
from app.schemas.settings import (
    AIScreeningSettings,
    EmailFilterRule,
    GmailIntegrationStatus,
    NotificationSettings,
    UserSettings,
)

router = APIRouter()


@router.get("", response_model=UserSettings)
async def get_settings(user: dict = Depends(get_current_user)) -> UserSettings:
    token_data = await load_token(user["id"])
    gmail = GmailIntegrationStatus(
        connected=bool(token_data),
        email=token_data.get("email") if token_data else None,
        last_synced_at=str(token_data.get("updated_at")) if token_data else None,
    )
    return UserSettings(
        gmail=gmail,
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
