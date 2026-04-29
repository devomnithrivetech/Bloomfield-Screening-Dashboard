-- =====================================================================
-- Bloomfield Deal Screener — extended deal schema for demo processing
-- Adds property_info, financials, s3_folder_key columns to deals;
-- adds unique index on emails(user_id, gmail_message_id) for caching.
-- Safe to run more than once (IF NOT EXISTS / DO NOTHING everywhere).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Unique index on emails so we can upsert by (user_id, gmail_message_id)
-- Uses a partial index to allow NULL gmail_message_id rows.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS emails_user_gmail_unique
    ON public.emails (user_id, gmail_message_id)
    WHERE gmail_message_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Add property_info jsonb to deals
-- Stores all property metadata extracted by the LLM.
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS property_info jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------
-- 3. Add financials jsonb to deals
-- Stores the full T-12 / proforma financial data extracted by the LLM.
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS financials jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------
-- 4. Add s3_folder_key to deals
-- Stores the S3 folder prefix (= gmail_message_id) for easy attachment lookup.
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS s3_folder_key text;

-- ---------------------------------------------------------------------
-- 5. Add key_metrics jsonb to deals
-- Stores the [{label, value, flag}] array for the frontend metrics grid.
-- Separate from the legacy `metrics` column so we don't break existing code.
-- ---------------------------------------------------------------------
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS key_metrics jsonb NOT NULL DEFAULT '[]'::jsonb;
