-- =====================================================================
-- Bloomfield Deal Screener — initial schema
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste → Run
-- Safe to run more than once (IF NOT EXISTS everywhere).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles
-- Mirrors auth.users so we can store app-specific fields (display name,
-- role, avatar) alongside Supabase's auth data.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'analyst'     -- analyst | originator | admin
    check (role in ('analyst', 'originator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each user can read/update their own profile row.
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- Trigger: when a new auth user is created, insert a matching profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. user_settings
-- One row per user, stores per-user dashboard preferences.
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  filter_keywords text[] not null default array[
    'assisted living', 'memory care', 'senior housing', 'AL/MC', 'bridge loan'
  ],
  auto_tag boolean not null default true,
  model text not null default 'claude-sonnet-4-6',
  interest_rate numeric not null default 11,
  points_bloomfield numeric not null default 2,
  points_broker numeric not null default 1,
  interest_reserve_months int not null default 12,
  default_cap_rate numeric not null default 9,
  notif_on_complete boolean not null default true,
  notif_on_proceed boolean not null default true,
  notif_daily_digest boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_rw_self" on public.user_settings;
create policy "user_settings_rw_self" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. (placeholder) deals + emails
-- The real schema lives alongside the backend agent work. These stubs
-- exist so row-level security is wired up from day one; expand columns
-- as the backend ingestion pipeline lands.
-- ---------------------------------------------------------------------
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gmail_message_id text,
  sender text not null,
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz not null default now(),
  status text not null default 'unprocessed'
    check (status in ('unprocessed', 'processing', 'processed', 'failed')),
  attachments jsonb not null default '[]'::jsonb,
  deal_id uuid
);

create index if not exists emails_user_received_idx
  on public.emails (user_id, received_at desc);

alter table public.emails enable row level security;

drop policy if exists "emails_rw_self" on public.emails;
create policy "emails_rw_self" on public.emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_id uuid references public.emails(id) on delete set null,
  property_name text,
  asset_class text,
  recommendation text check (recommendation in ('proceed', 'negotiate', 'pass')),
  confidence numeric,
  risk_rating text
    check (risk_rating in ('low', 'moderate', 'moderate_high', 'high')),
  screener_storage_path text,
  email_draft text,
  metrics jsonb not null default '{}'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  pipeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_user_created_idx
  on public.deals (user_id, created_at desc);

alter table public.deals enable row level security;

drop policy if exists "deals_rw_self" on public.deals;
create policy "deals_rw_self" on public.deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. updated_at auto-bump
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch_updated on public.profiles;
create trigger profiles_touch_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_settings_touch_updated on public.user_settings;
create trigger user_settings_touch_updated before update on public.user_settings
  for each row execute function public.set_updated_at();

drop trigger if exists deals_touch_updated on public.deals;
create trigger deals_touch_updated before update on public.deals
  for each row execute function public.set_updated_at();
