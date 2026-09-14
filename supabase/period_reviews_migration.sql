-- Add persistent monthly, quarterly, and annual review workspaces.
-- Run this migration in Supabase before deploying the accompanying frontend.

create table if not exists public.period_reviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('monthly', 'quarterly', 'annual')),
  period_key text not null,
  content jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, period_type, period_key)
);

create index if not exists period_reviews_account_period_idx
  on public.period_reviews (account_id, period_type, period_key);

alter table public.period_reviews enable row level security;
drop policy if exists "period_reviews_own" on public.period_reviews;
create policy "period_reviews_own" on public.period_reviews
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists set_updated_at on public.period_reviews;
create trigger set_updated_at before update on public.period_reviews
  for each row execute function public.set_updated_at();
