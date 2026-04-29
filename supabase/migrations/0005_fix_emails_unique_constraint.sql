-- =====================================================================
-- Bloomfield Deal Screener — fix emails ON CONFLICT upsert (migration 0005)
-- =====================================================================
-- Root cause: migration 0004 created a PARTIAL unique index
--   (WHERE gmail_message_id IS NOT NULL)
-- PostgREST translates Python upsert(on_conflict="user_id,gmail_message_id")
-- into SQL:  INSERT … ON CONFLICT (user_id, gmail_message_id) DO UPDATE …
-- PostgreSQL rejects this with error 42P10 ("no unique or exclusion constraint
-- matching the ON CONFLICT specification") because a partial index cannot be
-- used without its WHERE clause in the ON CONFLICT target.
--
-- Fix: replace the partial index with a full UNIQUE constraint.
-- PostgreSQL allows multiple NULL gmail_message_id values under this constraint
-- (NULL ≠ NULL semantics) so nullable rows are unaffected.
-- =====================================================================

-- ─── 1. Remove duplicate (user_id, gmail_message_id) rows ─────────────────────
-- Keep the most complete row per pair:
--   deal_id set > status=processed > status=processing > most recent id
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, gmail_message_id
            ORDER BY
                (deal_id IS NOT NULL)                     DESC,
                CASE status
                    WHEN 'processed'  THEN 1
                    WHEN 'processing' THEN 2
                    ELSE 3
                END                                       ASC,
                id                                        DESC
        ) AS rn
    FROM public.emails
    WHERE gmail_message_id IS NOT NULL
)
DELETE FROM public.emails
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── 2. Drop the partial index from migration 0004 ────────────────────────────
DROP INDEX IF EXISTS public.emails_user_gmail_unique;

-- ─── 3. Add a full UNIQUE constraint that PostgREST recognises for upserts ────
ALTER TABLE public.emails
    ADD CONSTRAINT emails_user_gmail_unique
    UNIQUE (user_id, gmail_message_id);
