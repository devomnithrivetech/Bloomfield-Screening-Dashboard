# Bloomfield AI Deal Screening Dashboard

Monorepo for the AI-powered deal screening platform described in
`Deal_Screening_Dashboard_Proposal_v2.pdf`. The system ingests broker emails,
parses financial attachments, runs Bloomfield Capital's proprietary screening
methodology through an agentic AI framework, and produces a populated
Origination Screener (`.xlsx`) plus a draft screening email for review.

## Layout

```
.
├── frontend/     React + Vite + shadcn/ui dashboard (exported from Lovable)
├── backend/      FastAPI + 8 Claude-powered agents coordinated by the Orchestrator
├── docs/         Proposal, architecture notes
└── README.md     (this file)
```

- [frontend/README.md](frontend/README.md) — dashboard setup, scripts, env
- [backend/README.md](backend/README.md) — FastAPI setup, agent pipeline, env

## Architecture at a glance

```
User (browser)
    │  HTTPS
Next/Vite frontend  ──────────────►  FastAPI backend (Railway)
    │                                     │
    │                                     ▼
    │                            Orchestrator Agent
    │                                     │
    │               ┌─────────────────────┼────────────────────┐
    │               ▼          ▼          ▼          ▼         ▼
    │          Triage      Documents   Financials   Market   Underwriting
    │               └──────────┬─────────────────────┴──────────┘
    │                          ▼
    │                     Screener Gen ──► .xlsx
    │                          ▼
    │                     Email Compose ──► screening email draft
    │                          │
    ▼                          ▼
Supabase (Postgres · Auth · Storage · Realtime)
Claude API · Gmail API · Web Search
```

## Running locally

Two terminals:

```bash
# 1. backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ANTHROPIC_API_KEY, SUPABASE_*, GOOGLE_*
uvicorn app.main:app --reload
# → http://localhost:8000/docs

# 2. frontend
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
# → http://localhost:8080
```

## Engagement options (see proposal §8)

The `ENGAGEMENT_OPTION` env flag in the backend gates feature tiers:

| Flag         | Option | Agents        | Users       | Asset classes |
| ------------ | ------ | ------------- | ----------- | ------------- |
| `option_1`   | Closed | Monolithic    | Single      | Senior housing |
| `option_2`   | Extensible | 8 + orchestrator | Single | Multi |
| `option_3`   | Scalable (recommended) | 8 + orchestrator | Multi | Multi |

## Deployment

Both services deploy to Railway as separate containers. Supabase is managed
separately. See each sub-project's README for production-specific notes.
