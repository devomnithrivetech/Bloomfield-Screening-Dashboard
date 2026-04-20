# Bloomfield Deal Screener — Backend

FastAPI backend hosting the agentic AI framework described in Section 4.5 of the proposal:
eight specialized Claude-powered agents coordinated by an Orchestrator Agent, fronted by
REST endpoints consumed by the Next.js/Vite frontend.

## Architecture

```
app/
├── main.py                 # FastAPI app + startup/shutdown
├── api/
│   └── routes/             # REST endpoints (auth, emails, deals, settings)
├── agents/                 # 8 specialized agents + orchestrator
│   ├── orchestrator.py
│   ├── email_triage.py
│   ├── document_processing.py
│   ├── financial_extraction.py
│   ├── market_research.py
│   ├── underwriting_analysis.py
│   ├── screener_generator.py
│   └── email_composition.py
├── integrations/           # Claude, Gmail, Supabase clients
├── services/               # Business logic (deal, email, document, screener)
├── models/                 # DB-facing dataclasses / ORM mappings
├── schemas/                # Pydantic request/response schemas
├── core/                   # Config, security, logging
└── utils/
```

## Agent pipeline

1. **Orchestrator Agent** — coordinates the full 5-stage pipeline, retries, status updates.
2. **Email Triage Agent** — extracts metadata, detects asset class, routes to pipeline.
3. **Document Processing Agent** — normalizes PDFs (PyMuPDF/pdfplumber) + Excel (openpyxl).
4. **Financial Extraction Agent** — pulls T-12, rent roll, loan terms; maps to screener cells.
5. **Market Research Agent** — web search for demographics, competitors, market positioning.
6. **Underwriting Analysis Agent** — NOI normalization, labor benchmarks, risk rating, recommendation.
7. **Screener Generator Agent** — populates `.xlsx`, injects narrative text boxes, preserves formulas.
8. **Email Composition Agent** — drafts the screening email with deal summary table.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in secrets
uvicorn app.main:app --reload
```

API docs are auto-generated at `http://localhost:8000/docs`.

## Engagement-option toggles

Per the proposal, Options 2 and 3 enable the agentic framework. Option 1 runs a
monolithic path (`services/deal_service.py::run_monolithic_screening`) instead of
the orchestrator. The choice is controlled by `ENGAGEMENT_OPTION` in config.

## Templates

Drop the Bloomfield Origination Screener `.xlsx` into `templates/` and point
`SCREENER_TEMPLATE_PATH` at it. Option 2/3 supports multiple templates keyed by asset class.
