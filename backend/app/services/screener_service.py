"""Screener workbook population (consumed by ScreenerGeneratorAgent)."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.config import get_settings


def load_template() -> Any:
    """Load the Bloomfield Origination Screener template as an openpyxl workbook."""
    # TODO: from openpyxl import load_workbook; return load_workbook(path)
    settings = get_settings()
    path = Path(settings.screener_template_path)
    if not path.exists():
        raise FileNotFoundError(f"screener template not found: {path}")
    return path


def write_cells(workbook: Any, mapping: dict[str, Any]) -> None:
    """Write a {cell_ref: value} mapping into the workbook. Never overwrite formula cells."""
    # TODO: iterate mapping, look up sheet + cell ref, assign value
    _ = (workbook, mapping)


def inject_summary_textboxes(workbook: Any, *, overview: str, highlights: str, risks: str) -> None:
    """Insert the three Deal Summary text boxes with navy/red header bars."""
    # TODO: use openpyxl.drawing.graphic to insert shapes with formatted headers
    _ = (workbook, overview, highlights, risks)


def save_to_bytes(workbook: Any) -> bytes:
    """Serialize workbook to bytes for Supabase Storage upload."""
    # TODO: workbook.save(BytesIO) and return .getvalue()
    _ = workbook
    return b""
