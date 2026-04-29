-- =====================================================================
-- Bloomfield Deal Screener — single-user dev compatibility
-- =====================================================================

-- ─── 1. Drop RLS policies FIRST (they reference user_id, blocking type change) ─
DROP POLICY IF EXISTS "emails_rw_self" ON public.emails;
DROP POLICY IF EXISTS "deals_rw_self"  ON public.deals;

-- ─── 2. Drop FK constraints ───────────────────────────────────────────────────
ALTER TABLE public.emails DROP CONSTRAINT IF EXISTS emails_user_id_fkey;
ALTER TABLE public.deals  DROP CONSTRAINT IF EXISTS deals_user_id_fkey;

-- ─── 3. Change user_id columns from uuid to text ─────────────────────────────
ALTER TABLE public.emails ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.deals  ALTER COLUMN user_id TYPE text USING user_id::text;

-- ─── 4. Recreate RLS policies with auth.uid()::text for text comparison ───────
CREATE POLICY "emails_rw_self" ON public.emails
  FOR ALL
  USING      (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "deals_rw_self" ON public.deals
  FOR ALL
  USING      (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- ─── 5. Unique index for upsert-on-conflict caching (from migration 0003) ─────
DROP INDEX IF EXISTS emails_user_gmail_unique;
CREATE UNIQUE INDEX emails_user_gmail_unique
    ON public.emails (user_id, gmail_message_id)
    WHERE gmail_message_id IS NOT NULL;

-- ─── 6. Extended columns on deals (from migration 0003) ──────────────────────
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS property_info jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS financials    jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS s3_folder_key text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS key_metrics   jsonb NOT NULL DEFAULT '[]'::jsonb;
