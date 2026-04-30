-- =====================================================================
-- Bloomfield Deal Screener — financial detail fields
-- Adds financial_summary, sources_and_uses, sponsor_overview, and
-- location_summary to deals so the new DealDetail sections are
-- persisted after the LLM agent runs.
-- Safe to run more than once (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. financial_summary — [{label, value, dy?}] rows for the
--    Financial Summary Highlights table (T-12 NOI, T-3M NOI, etc.)
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS financial_summary jsonb DEFAULT NULL;

-- ---------------------------------------------------------------------
-- 2. sources_and_uses — {sources: [...], uses: [...]} each row has
--    {item, total, per_unit, pct}; drives the Sources & Uses card.
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS sources_and_uses jsonb DEFAULT NULL;

-- ---------------------------------------------------------------------
-- 3. sponsor_overview — plain-text description of the proposed
--    borrower/sponsor entity extracted by the LLM.
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS sponsor_overview text DEFAULT NULL;

-- ---------------------------------------------------------------------
-- 4. location_summary — plain-text market and location narrative
--    extracted by the LLM.
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS location_summary text DEFAULT NULL;
