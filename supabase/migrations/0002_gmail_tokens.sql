-- =====================================================================
-- Gmail OAuth token storage
-- Run after 0001_initial.sql
-- =====================================================================

-- Stores OAuth tokens for Gmail integration per user.
-- Uses service_role access from the backend; no user-level RLS needed.
create table if not exists public.gmail_tokens (
  user_key  text primary key,           -- "single-user" in Option 1/2, UUID in Option 3
  access_token  text,
  refresh_token text not null,
  token_expiry  timestamptz,
  email         text,                   -- connected Gmail address
  scopes        text[] not null default '{}',
  updated_at    timestamptz not null default now()
);

-- No RLS — this table is accessed exclusively via the service_role key.
-- Analyst users never query it directly.
alter table public.gmail_tokens disable row level security;

create or replace function public.set_gmail_tokens_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists gmail_tokens_touch_updated on public.gmail_tokens;
create trigger gmail_tokens_touch_updated
  before update on public.gmail_tokens
  for each row execute function public.set_gmail_tokens_updated_at();
