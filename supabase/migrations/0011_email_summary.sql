-- =====================================================================
-- Bloomfield Deal Screener — add AI summary cache column (migration 0011)
-- Safe to run more than once (IF NOT EXISTS guard).
-- =====================================================================

-- Store the AI-generated summary on the emails row so subsequent
-- "Summarise" clicks return the cached result without an LLM call.
alter table public.emails add column if not exists summary text;
