-- =====================================================================
-- Bloomfield Deal Screener — multi-user data migration
-- Run this in the Supabase SQL Editor BEFORE switching to
-- ENGAGEMENT_OPTION=option_3 in your backend .env.
--
-- PURPOSE:
--   The app previously ran in single-user mode, storing all data under
--   the synthetic key "single-user".  This script re-parents that data
--   to a real Supabase auth.users UUID so the admin user can still
--   access their existing deals and emails after the switch.
--
-- HOW TO RUN:
--   1. Run the query in Step 1 below to find your Supabase user UUID.
--   2. Copy the UUID.
--   3. Replace 'PASTE-YOUR-UUID-HERE' with that UUID in Steps 2-5.
--   4. Execute Steps 2-5 in the SQL Editor.
-- =====================================================================


-- ─── Step 1: Find your Supabase user UUID ─────────────────────────────────────
--   Run this query first, copy the `id` value for your account.
SELECT id, email, created_at
FROM   auth.users
ORDER  BY created_at
LIMIT  10;


-- ─── Step 2: Migrate gmail_tokens ─────────────────────────────────────────────
--   Moves the OAuth token from the "single-user" key to your real UUID.
--   If you have already connected Gmail under your real account, skip this step
--   (it would overwrite the existing token).
UPDATE public.gmail_tokens
SET    user_key = 'PASTE-YOUR-UUID-HERE'
WHERE  user_key = 'single-user';


-- ─── Step 3: Migrate emails ───────────────────────────────────────────────────
UPDATE public.emails
SET    user_id = 'PASTE-YOUR-UUID-HERE'
WHERE  user_id = 'single-user';


-- ─── Step 4: Migrate screened_emails ──────────────────────────────────────────
UPDATE public.screened_emails
SET    user_id = 'PASTE-YOUR-UUID-HERE'
WHERE  user_id = 'single-user';


-- ─── Step 5: Migrate deals ────────────────────────────────────────────────────
UPDATE public.deals
SET    user_id = 'PASTE-YOUR-UUID-HERE'
WHERE  user_id = 'single-user';


-- ─── Verification ─────────────────────────────────────────────────────────────
--   After running Steps 2-5, verify no orphaned "single-user" rows remain:
SELECT 'gmail_tokens'    AS tbl, COUNT(*) AS remaining FROM public.gmail_tokens   WHERE user_key = 'single-user'
UNION ALL
SELECT 'emails'          AS tbl, COUNT(*) AS remaining FROM public.emails          WHERE user_id  = 'single-user'
UNION ALL
SELECT 'screened_emails' AS tbl, COUNT(*) AS remaining FROM public.screened_emails WHERE user_id  = 'single-user'
UNION ALL
SELECT 'deals'           AS tbl, COUNT(*) AS remaining FROM public.deals           WHERE user_id  = 'single-user';
-- All counts should be 0.
