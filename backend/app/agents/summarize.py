"""Lightweight email summarize agent — single Claude call, no document downloads.

Receives the email subject, sender, body text, and attachment filenames, then
asks Claude (fast model) to produce a 3-5 sentence plain-text summary for the
analyst.  Kept intentionally cheap and fast — this is a pre-screening aid,
not a full underwriting pipeline.
"""
from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.claude import get_claude_client

log = get_logger(__name__)

_SYSTEM = (
    "You are a concise commercial real estate deal-screening assistant. "
    "Your job is to write brief, factual summaries of deal emails for an analyst. "
    "Do NOT add recommendations, scores, or editorial commentary — only summarize the facts: "
    "property type, location, deal/loan size, key terms, and what the sender is requesting. "
    "Write in clear, professional prose. Plain text only, no bullet points or markdown."
)


async def summarize_email(
    subject: str,
    sender: str,
    body_text: str,
    attachment_names: list[str],
) -> str:
    """Call Claude to produce a 3-5 sentence summary of a deal email.

    Returns plain-text summary string. Never raises — returns an empty string
    on failure so callers can decide how to handle it.
    """
    settings = get_settings()
    client = get_claude_client()

    attachments_line = (
        f"Attachments: {', '.join(attachment_names)}" if attachment_names
        else "No attachments."
    )

    # Truncate body to keep the prompt cheap; first 8 000 chars covers virtually
    # all real estate deal emails.
    truncated_body = body_text[:8_000] if body_text else "(no body text)"

    user_message = (
        f"Subject: {subject}\n"
        f"From: {sender}\n"
        f"{attachments_line}\n\n"
        f"Email body:\n{truncated_body}\n\n"
        "Write a 3-5 sentence plain-text summary for the analyst. "
        "Include: property type, location, deal/loan size, key financial terms, "
        "and what the sender is requesting."
    )

    try:
        response = await client.messages.create(
            model=settings.claude_fast_model,
            system=_SYSTEM,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=400,
        )
        for block in response.content:
            if block.type == "text":
                return block.text.strip()
        return ""
    except Exception as exc:
        log.warning("summarize_email_llm_failed", error=str(exc))
        return ""
