"""Pydantic schemas for deal + screening output (mirrors frontend Deal Detail page)."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class Recommendation(str, Enum):
    PROCEED = "proceed"
    NEGOTIATE = "negotiate"
    PASS = "pass"


class RiskRating(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    MODERATE_HIGH = "moderate_high"
    HIGH = "high"


class PipelineStage(str, Enum):
    EMAIL_RECEIVED = "email_received"
    PARSING_ATTACHMENTS = "parsing_attachments"
    EXTRACTING_FINANCIALS = "extracting_financials"
    RUNNING_SCREENER = "running_screener"
    COMPLETE = "complete"


class StageStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class PipelineStageState(BaseModel):
    stage: PipelineStage
    status: StageStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    detail: str | None = None


class DealMetrics(BaseModel):
    loan_request: float | None = None
    property_type: str | None = None
    unit_count: int | None = None
    as_is_value: float | None = None
    ltv: float | None = None
    dscr: float | None = None
    borrower: str | None = None
    sponsor: str | None = None
    location_risk: str | None = None


class Highlight(BaseModel):
    title: str
    detail: str


class RiskFlag(BaseModel):
    title: str
    detail: str
    severity: RiskRating


class DealSummary(BaseModel):
    id: str
    property_name: str
    address: str | None = None
    county: str | None = None
    msa: str | None = None
    asset_class: str | None = None
    recommendation: Recommendation | None = None
    confidence: float | None = None
    risk_rating: RiskRating | None = None
    created_at: datetime


class DealDetail(DealSummary):
    metrics: DealMetrics = DealMetrics()
    highlights: list[Highlight] = []
    risks: list[RiskFlag] = []
    pipeline: list[PipelineStageState] = []
    screener_url: str | None = None
    screening_email_draft: str | None = None


class DealListResponse(BaseModel):
    deals: list[DealSummary]
    total: int


class KPIStats(BaseModel):
    received_this_week: int
    screened: int
    pending: int
    avg_loan_size: float
