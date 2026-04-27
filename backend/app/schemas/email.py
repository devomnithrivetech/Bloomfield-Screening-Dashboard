"""Pydantic schemas for email inbox endpoints."""
from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class EmailStatus(str, Enum):
    UNPROCESSED = "unprocessed"
    PROCESSING = "processing"
    PROCESSED = "processed"


class AttachmentType(str, Enum):
    EXCEL = "excel"
    PDF = "pdf"
    OTHER = "other"


class Attachment(BaseModel):
    id: str
    filename: str
    type: AttachmentType
    size_bytes: int | None = None


class EmailSummary(BaseModel):
    id: str
    sender: str
    sender_email: str | None = None
    subject: str
    preview: str
    received_at: datetime
    status: EmailStatus
    attachments: list[Attachment] = []
    deal_id: str | None = None


class EmailDetail(EmailSummary):
    body_html: str | None = None
    body_text: str | None = None


class AISummarizeRequest(BaseModel):
    email_id: str


class AISummarizeResponse(BaseModel):
    summary: str


class ProcessEmailRequest(BaseModel):
    email_id: str


class ProcessEmailResponse(BaseModel):
    deal_id: str
    status: EmailStatus


class EmailListResponse(BaseModel):
    emails: list[EmailDetail]
    next_page_token: str | None = None


class BatchEmailRequest(BaseModel):
    ids: list[str]
