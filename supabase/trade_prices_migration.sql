-- Optional broker execution prices for manual and imported trades.
alter table public.trades add column if not exists entry_price numeric;
alter table public.trades add column if not exists exit_price numeric;
