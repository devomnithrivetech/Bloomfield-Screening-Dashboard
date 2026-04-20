"""Low-level PDF / Excel parsing helpers (consumed by DocumentProcessingAgent)."""
from __future__ import annotations

from io import BytesIO


def parse_pdf_text(content: bytes) -> dict:
    """Extract text + tables from a PDF using pdfplumber."""
    # TODO: implement with pdfplumber; return {"pages": [{"text": ..., "tables": [...]}]}
    _ = BytesIO(content)
    return {"pages": []}


def parse_xlsx_workbook(content: bytes) -> dict:
    """Open a workbook and return sheet → rows mapping, preserving merged cells."""
    # TODO: implement with openpyxl load_workbook(data_only=False)
    _ = BytesIO(content)
    return {"sheets": {}}
