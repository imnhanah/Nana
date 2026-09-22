-- Enables the low-egress manual Sync button.
-- It adds an update timestamp to each journal table so the app can check a
-- tiny metadata signature before downloading full account data.
begin;

create or replace function public.tj_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'accounts', 'trades', 'rules', 'journal_entries', 'user_settings',
    'premarket_markups', 'trade_reviews', 'period_reviews',
    'finance_settings', 'savings_accounts', 'finance_movements'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', table_name);
      execute format('drop trigger if exists %I on public.%I', 'tj_' || table_name || '_updated_at', table_name);
      execute format('create trigger %I before update on public.%I for each row execute function public.tj_set_updated_at()', 'tj_' || table_name || '_updated_at', table_name);
    end if;
  end loop;
end;
$$;

commit;
