-- =====================================================================
-- Bloomfield Deal Screener — manual upload support
-- Adds a `source` discriminator to emails and screened_emails so manual
-- uploads (files dragged in from the dashboard) are distinguishable from
-- Gmail-sourced emails throughout the pipeline.
-- Safe to run more than once (ADD COLUMN IF NOT EXISTS).
-- =====================================================================

ALTER TABLE public.emails
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'gmail'
    CONSTRAINT emails_source_check CHECK (source IN ('gmail', 'manual_upload'));

ALTER TABLE public.screened_emails
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'gmail'
    CONSTRAINT screened_emails_source_check CHECK (source IN ('gmail', 'manual_upload'));
