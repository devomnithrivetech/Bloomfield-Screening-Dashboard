"""Application settings loaded from environment."""
from __future__ import annotations

from enum import Enum
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EngagementOption(str, Enum):
    """Proposal engagement tiers — gates agentic features + multi-user."""

    CLOSED = "option_1"        # monolithic engine, single user, senior housing only
    EXTENSIBLE = "option_2"    # 8-agent framework, single user, multi asset class
    SCALABLE = "option_3"      # 8-agent framework, multi-user, multi asset class


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:8080"

    engagement_option: EngagementOption = EngagementOption.SCALABLE

    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-4-7"
    claude_fast_model: str = "claude-sonnet-4-6"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "deal-artifacts"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    screener_template_path: str = "templates/bloomfield_origination_screener.xlsx"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def agentic_enabled(self) -> bool:
        return self.engagement_option in (EngagementOption.EXTENSIBLE, EngagementOption.SCALABLE)

    @property
    def multi_user_enabled(self) -> bool:
        return self.engagement_option == EngagementOption.SCALABLE


@lru_cache
def get_settings() -> Settings:
    return Settings()
