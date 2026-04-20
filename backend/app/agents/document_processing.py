"""Document Processing Agent — normalizes PDF + Excel attachments."""
from __future__ import annotations

from app.agents.base import AgentContext, AgentResult, BaseAgent

SYSTEM_PROMPT = """You are the Document Processing Agent. Receive raw PDF/Excel
content and emit a normalized JSON representation capturing sheets/pages, tables,
and free text. Preserve table structure; do not guess missing values."""


class DocumentProcessingAgent(BaseAgent):
    name = "document_processing"
    system_prompt = SYSTEM_PROMPT

    async def run(self, context: AgentContext) -> AgentResult:
        # TODO:
        #   1. For each attachment, dispatch to _parse_pdf or _parse_xlsx
        #   2. Append normalized output to context.parsed_documents
        self.log.info("parse_start", attachments=len(context.attachments))
        return AgentResult(success=True, agent=self.name, detail="stub")

    async def _parse_pdf(self, content: bytes) -> dict:
        # TODO: PyMuPDF / pdfplumber → text + tables
        return {}

    async def _parse_xlsx(self, content: bytes) -> dict:
        # TODO: openpyxl → sheet-by-sheet cells + merged ranges
        return {}
