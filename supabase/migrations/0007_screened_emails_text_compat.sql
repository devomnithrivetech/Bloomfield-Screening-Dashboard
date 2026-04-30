-- =====================================================================
-- Bloomfield Deal Screener — fix screened_emails user_id type
-- Migration 0004 changed emails.user_id and deals.user_id to text for
-- single-user dev mode. Migration 0006 created screened_emails with
-- user_id as uuid, causing 400 errors when querying with a text user_id
-- (e.g. "single-user"). This migration applies the same text conversion.
-- Safe to run more than once.
-- =====================================================================

-- 1. Drop FK constraint (references auth.users(id) which is uuid)
ALTER TABLE public.screened_emails
  DROP CONSTRAINT IF EXISTS screened_emails_user_id_fkey;

-- 2. Drop RLS policy that references the column (required before type change)
DROP POLICY IF EXISTS "screened_emails_rw_self" ON public.screened_emails;

-- 3. Change user_id from uuid to text
ALTER TABLE public.screened_emails
  ALTER COLUMN user_id TYPE text USING user_id::text;

-- 4. Recreate RLS policy with text comparison
CREATE POLICY "screened_emails_rw_self" ON public.screened_emails
  FOR ALL
  USING      (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
