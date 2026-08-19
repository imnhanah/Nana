-- ============================================================================
-- AAICOREFX Trading Journal — Supabase schema
--
-- Run this whole file once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- It is safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS guards, so re-running it won't duplicate anything
-- or error out on objects that already exist.
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PROFILES — one row per authenticated user, keyed by their auth.users id
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Profiles are created automatically by the trigger below, not by the
-- client directly, so there is intentionally no insert policy here.

-- ----------------------------------------------------------------------------
-- 2. USER SETTINGS — one row per user: custom tag lists etc.
-- ----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  custom_type_tags   jsonb not null default '[]'::jsonb,
  custom_mistake_tags jsonb not null default '[]'::jsonb,
  migrated_local_data boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select using (user_id = auth.uid());

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (user_id = auth.uid());

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. TRADING ACCOUNTS
-- ----------------------------------------------------------------------------
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  icon           text not null default '🦈',
  balance        numeric not null default 0,
  breakeven_cap  numeric not null default 20,
  rating_style   text not null default 'stars',
  theme          text not null default 'dark',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
  for select using (user_id = auth.uid());

drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own" on public.accounts
  for insert with check (user_id = auth.uid());

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own" on public.accounts
  for delete using (user_id = auth.uid());

create index if not exists accounts_user_id_idx on public.accounts(user_id);

-- ----------------------------------------------------------------------------
-- 4. TRADES
-- ----------------------------------------------------------------------------
create table if not exists public.trades (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  trade_date   date not null,
  asset        text not null,
  direction    text not null default 'BUY',
  pnl          numeric not null default 0,
  rr           numeric not null default 0,
  session      text,
  rating       int not null default 0,
  types        jsonb not null default '[]'::jsonb,
  mistakes     jsonb not null default '[]'::jsonb,
  mood_before  text,
  mood_after   text,
  context      text,
  screenshots  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.trades enable row level security;

drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own" on public.trades
  for select using (user_id = auth.uid());

drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own" on public.trades
  for insert with check (user_id = auth.uid());

drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own" on public.trades
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own" on public.trades
  for delete using (user_id = auth.uid());

create index if not exists trades_user_id_idx on public.trades(user_id);
create index if not exists trades_account_id_idx on public.trades(account_id);

-- ----------------------------------------------------------------------------
-- 5. RULES (a per-account list of trading rules)
-- ----------------------------------------------------------------------------
create table if not exists public.rules (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rule_text   text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.rules enable row level security;

drop policy if exists "rules_select_own" on public.rules;
create policy "rules_select_own" on public.rules
  for select using (user_id = auth.uid());

drop policy if exists "rules_insert_own" on public.rules;
create policy "rules_insert_own" on public.rules
  for insert with check (user_id = auth.uid());

drop policy if exists "rules_update_own" on public.rules;
create policy "rules_update_own" on public.rules
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "rules_delete_own" on public.rules;
create policy "rules_delete_own" on public.rules
  for delete using (user_id = auth.uid());

create index if not exists rules_user_id_idx on public.rules(user_id);

-- ----------------------------------------------------------------------------
-- 6. JOURNAL ENTRIES — daily rule check-ins (the "Rules" page's check-in log)
-- ----------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rule_id     uuid not null references public.rules(id) on delete cascade,
  entry_date  date not null,
  checked     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (account_id, rule_id, entry_date)
);

alter table public.journal_entries enable row level security;

drop policy if exists "journal_entries_select_own" on public.journal_entries;
create policy "journal_entries_select_own" on public.journal_entries
  for select using (user_id = auth.uid());

drop policy if exists "journal_entries_insert_own" on public.journal_entries;
create policy "journal_entries_insert_own" on public.journal_entries
  for insert with check (user_id = auth.uid());

drop policy if exists "journal_entries_update_own" on public.journal_entries;
create policy "journal_entries_update_own" on public.journal_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "journal_entries_delete_own" on public.journal_entries;
create policy "journal_entries_delete_own" on public.journal_entries
  for delete using (user_id = auth.uid());

create index if not exists journal_entries_user_id_idx on public.journal_entries(user_id);
create index if not exists journal_entries_account_date_idx on public.journal_entries(account_id, entry_date);

-- ----------------------------------------------------------------------------
-- 7. Auto-create a profile + default settings row whenever someone signs up
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 8. Keep updated_at columns current automatically
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.user_settings;
create trigger set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.accounts;
create trigger set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.trades;
create trigger set_updated_at before update on public.trades
  for each row execute function public.set_updated_at();

-- 9. Journal evolution migration (safe for existing installations)
alter table public.accounts add column if not exists default_commission numeric not null default 0;
alter table public.user_settings add column if not exists custom_confluence_sessions jsonb not null default '[]'::jsonb;
alter table public.trades add column if not exists gross_pnl numeric;
alter table public.trades add column if not exists commission numeric not null default 0;
alter table public.trades add column if not exists swap numeric not null default 0;
alter table public.trades add column if not exists net_pnl numeric;
alter table public.trades add column if not exists confluence_session text;
alter table public.trades add column if not exists premarket_markup_id uuid;
alter table public.trades add column if not exists rule_evaluations jsonb not null default '[]'::jsonb;
update public.trades set gross_pnl = pnl where gross_pnl is null;
update public.trades set net_pnl = gross_pnl - commission - swap where net_pnl is null;

create table if not exists public.premarket_markups (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, markup_date date not null, market text, instrument text,
  bias text, levels text, market_structure text, notes text, screenshots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.trades drop constraint if exists trades_premarket_markup_id_fkey;
alter table public.trades add constraint trades_premarket_markup_id_fkey foreign key (premarket_markup_id) references public.premarket_markups(id) on delete set null;
create table if not exists public.trade_reviews (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, trade_id uuid not null references public.trades(id) on delete cascade,
  review_date date not null, done_well text, went_wrong text, execution_review text, rule_adherence text, psychology text,
  lessons text, action_items text, notes text, screenshots jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.premarket_markups enable row level security;
alter table public.trade_reviews enable row level security;
drop policy if exists "markups_own" on public.premarket_markups; create policy "markups_own" on public.premarket_markups for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "reviews_own" on public.trade_reviews; create policy "reviews_own" on public.trade_reviews for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop trigger if exists set_updated_at on public.premarket_markups; create trigger set_updated_at before update on public.premarket_markups for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.trade_reviews; create trigger set_updated_at before update on public.trade_reviews for each row execute function public.set_updated_at();

-- ============================================================================
-- Done. Every table above has RLS enabled with policies scoped to
-- `user_id = auth.uid()` (or `id = auth.uid()` for profiles), so Postgres
-- itself refuses cross-user reads/writes no matter what the frontend does —
-- there is no way to bypass this from client-side code with the anon key.
-- ============================================================================
