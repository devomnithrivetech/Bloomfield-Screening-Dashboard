"""Base agent contract shared by every specialized agent."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger


@dataclass
class AgentContext:
    """Shared state that flows through the pipeline.

    Each agent reads what it needs and appends its output. The Orchestrator owns
    the context object for a given deal run.
    """

    deal_id: str
    user_id: str
    email_id: str
    raw_email: dict[str, Any] = field(default_factory=dict)
    attachments: list[dict[str, Any]] = field(default_factory=list)
    parsed_documents: list[dict[str, Any]] = field(default_factory=list)
    financials: dict[str, Any] = field(default_factory=dict)
    market: dict[str, Any] = field(default_factory=dict)
    analysis: dict[str, Any] = field(default_factory=dict)
    screener_path: str | None = None
    email_draft: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    success: bool
    agent: str
    detail: str | None = None
    error: str | None = None


class BaseAgent(ABC):
    """Every agent subclass implements `run`.

    Subclasses SHOULD declare:
      * `name`: stable identifier used in logs and pipeline status.
      * `system_prompt`: agent-specific Claude system prompt.
    """

    name: str = "base"
    system_prompt: str = ""

    def __init__(self) -> None:
        self.log = get_logger(f"agent.{self.name}")

    @abstractmethod
    async def run(self, context: AgentContext) -> AgentResult:
        ...
