"""Pydantic schemas for deal + screening output (mirrors frontend Deal Detail page)."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

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
    EMAIL_RECEIVED       = "email_received"
    PARSING_ATTACHMENTS  = "parsing_attachments"
    EXTRACTING_FINANCIALS = "extracting_financials"
    RUNNING_SCREENER     = "running_screener"
    COMPLETE             = "complete"


class StageStatus(str, Enum):
    PENDING     = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED   = "completed"
    FAILED      = "failed"


class PipelineStageState(BaseModel):
    stage:       PipelineStage | str
    status:      StageStatus   | str
    started_at:  datetime | None = None
    finished_at: datetime | None = None
    detail:      str      | None = None


class DealMetrics(BaseModel):
    """Legacy structured metrics — kept for backward compatibility."""
    loan_request:   float | None = None
    property_type:  str   | None = None
    unit_count:     int   | None = None
    as_is_value:    float | None = None
    ltv:            float | None = None
    dscr:           float | None = None
    borrower:       str   | None = None
    sponsor:        str   | None = None
    location_risk:  str   | None = None


class KeyMetric(BaseModel):
    """One row in the Deal Metrics display grid."""
    label:    str
    value:    str
    flag:     str       # "ok" | "warn"
    per_unit: str | None = None


class FinancialSummaryRow(BaseModel):
    label: str
    value: str
    dy:    str | None = None


class SourceUseRow(BaseModel):
    item:     str
    total:    str
    per_unit: str
    pct:      str


class SourcesAndUses(BaseModel):
    sources: list[SourceUseRow] = []
    uses:    list[SourceUseRow] = []


class Highlight(BaseModel):
    title:  str
    detail: str


class RiskFlag(BaseModel):
    title:    str
    detail:   str
    severity: RiskRating | str


class DealSummary(BaseModel):
    id:             str
    property_name:  str
    address:        str | None = None
    county:         str | None = None
    msa:            str | None = None
    asset_class:    str | None = None
    recommendation: Recommendation | str | None = None
    confidence:     float | None = None
    risk_rating:    RiskRating | str | None = None
    created_at:     datetime


class DealDetail(DealSummary):
    # Legacy field — kept for schema compat; use key_metrics instead
    metrics:               DealMetrics          = DealMetrics()
    # Rich [{label, value, flag, per_unit?}] array produced by the demo agent
    key_metrics:           list[dict[str, Any]] = []
    highlights:            list[Highlight]      = []
    risks:                 list[RiskFlag]       = []
    pipeline:              list[PipelineStageState] = []
    screener_s3_key:       str | None = None
    screening_email_draft: str | None = None
    # Full property info dict for frontend display
    property_info:         dict[str, Any] = {}
    # New structured financial fields
    financial_summary:     list[dict[str, Any]] | None = None
    sources_and_uses:      dict[str, Any] | None = None
    sponsor_overview:      str | None = None
    location_summary:      str | None = None


class DealListResponse(BaseModel):
    deals: list[DealSummary]
    total: int


class KPIStats(BaseModel):
    received_this_week: int
    screened:           int
    pending:            int
    avg_loan_size:      float
