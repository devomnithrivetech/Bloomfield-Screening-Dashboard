-- =====================================================================
-- Bloomfield Deal Screener — screened emails queue
-- Tracks every email that has been sent for AI screening so users can
-- monitor live pipeline progress and revisit results without scrolling
-- through the inbox.
-- Safe to run more than once (IF NOT EXISTS / DO NOTHING everywhere).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.screened_emails (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_message_id       text,
  subject                text        NOT NULL DEFAULT '(no subject)',
  sender                 text        NOT NULL DEFAULT 'Unknown',
  sender_email           text,
  received_at            timestamptz,
  sent_for_screening_at  timestamptz NOT NULL DEFAULT now(),
  -- Mirrors the pipeline stage keys used in deals.pipeline
  processing_status      text        NOT NULL DEFAULT 'queued'
    CHECK (processing_status IN (
      'queued', 'email_received', 'parsing_attachments',
      'extracting_financials', 'running_screener', 'complete', 'failed'
    )),
  pipeline               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  deal_id                uuid,                       -- set once the deal row exists
  screened_title         text,                       -- property name from LLM output
  screener_s3_key        text,                       -- S3 path to the generated .xlsx
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS screened_emails_user_created_idx
  ON public.screened_emails (user_id, created_at DESC);

ALTER TABLE public.screened_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "screened_emails_rw_self" ON public.screened_emails;
CREATE POLICY "screened_emails_rw_self" ON public.screened_emails
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS screened_emails_touch_updated ON public.screened_emails;
CREATE TRIGGER screened_emails_touch_updated
  BEFORE UPDATE ON public.screened_emails
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
