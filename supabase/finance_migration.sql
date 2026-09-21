-- AAICOREFX Finance feature. Run once in Supabase SQL Editor.
-- The tables are account-scoped and protected by the same ownership rules as trades.

create table if not exists public.finance_settings (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  trading_target numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target numeric not null default 0,
  allocation_pct numeric not null default 0,
  transfer_interval text not null default 'Manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_type text not null check (movement_type in ('deposit', 'withdrawal', 'transfer')),
  amount numeric not null check (amount > 0),
  movement_date date not null,
  note text not null default '',
  source text not null default 'trading' check (source in ('trading', 'savings')),
  savings_account_id uuid references public.savings_accounts(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.finance_settings enable row level security;
alter table public.savings_accounts enable row level security;
alter table public.finance_movements enable row level security;

drop policy if exists "finance_settings_own" on public.finance_settings;
create policy "finance_settings_own" on public.finance_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "savings_accounts_own" on public.savings_accounts;
create policy "savings_accounts_own" on public.savings_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "finance_movements_own" on public.finance_movements;
create policy "finance_movements_own" on public.finance_movements for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists savings_accounts_account_id_idx on public.savings_accounts(account_id);
create index if not exists finance_movements_account_date_idx on public.finance_movements(account_id, movement_date desc);

drop trigger if exists set_finance_settings_updated_at on public.finance_settings;
create trigger set_finance_settings_updated_at before update on public.finance_settings for each row execute function public.set_updated_at();
drop trigger if exists set_savings_accounts_updated_at on public.savings_accounts;
create trigger set_savings_accounts_updated_at before update on public.savings_accounts for each row execute function public.set_updated_at();
