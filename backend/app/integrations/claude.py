"""Anthropic Claude client wrapper used by every agent."""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from anthropic import AsyncAnthropic

from app.core.config import get_settings


@lru_cache
def get_claude_client() -> AsyncAnthropic:
    settings = get_settings()
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


async def complete(
    system: str,
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    max_tokens: int = 4096,
    tools: list[dict[str, Any]] | None = None,
) -> Any:
    """Thin pass-through to Claude Messages API.

    Agents should call this with their agent-specific system prompt. Prompt
    caching, tool use, and extended thinking are configured per-agent.
    """
    client = get_claude_client()
    settings = get_settings()
    return await client.messages.create(
        model=model or settings.claude_model,
        system=system,
        messages=messages,
        max_tokens=max_tokens,
        tools=tools or [],
    )
