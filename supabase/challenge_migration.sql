-- Additive migration: existing trading records and balances are not modified.
create table if not exists public.challenge_progress (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active_level integer not null default 1 check (active_level between 1 and 31),
  statuses jsonb not null default '{}'::jsonb check (jsonb_typeof(statuses) = 'object'),
  notes jsonb not null default '{}'::jsonb check (jsonb_typeof(notes) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.challenge_progress enable row level security;
drop policy if exists challenge_owner on public.challenge_progress;
create policy challenge_owner on public.challenge_progress
  for all to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()
  ))
  with check (user_id = auth.uid() and exists (
    select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid()
  ));
grant select, insert, update, delete on public.challenge_progress to authenticated;
