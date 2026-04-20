# Bloomfield Deal Screener — Frontend

React + Vite + TypeScript + shadcn/ui dashboard for the AI-Powered Deal Screening Dashboard.

Originally exported from Lovable as a static UI demo; now wired to the FastAPI backend in [../backend](../backend).

## Stack

- **React 18** with TypeScript
- **Vite** dev server / build
- **Tailwind CSS** + **shadcn/ui** (Radix primitives)
- **React Router** for client-side routing
- **TanStack Query** for server state
- **Vitest** for unit tests, **Playwright** for e2e

## Scripts

```bash
npm install
npm run dev        # dev server on http://localhost:8080
npm run build      # production build
npm run test       # vitest run
npm run lint       # eslint
```

## Environment

Create `.env.local` with the backend API URL:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Structure

```
src/
├── components/       # Reusable UI components (EmailRow, EmailDetail, Layout, NavLink)
│   └── ui/           # shadcn/ui primitives
├── pages/            # Route-level pages (Dashboard, DealDetail, Settings, NotFound)
├── hooks/            # Custom React hooks
├── data/             # Mock data (will be replaced by API calls)
├── lib/              # Utilities (cn helper, etc.)
└── test/             # Test setup
```

## Migration Notes

- `src/data/mockEmails.ts` is mock data from the Lovable export. It will be replaced
  by live calls to the FastAPI backend once the `emails` and `deals` endpoints are wired up.
- The processing pipeline visualization on the Deal Detail page should subscribe to
  Supabase Realtime (or a websocket) for live orchestrator stage updates.
