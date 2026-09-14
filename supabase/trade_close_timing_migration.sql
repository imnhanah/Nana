-- Run once in the Supabase SQL Editor before using the new trade close fields.
-- Existing trade_date / trade_time remain the open date and time.
begin;
alter table public.trades add column if not exists close_date date;
alter table public.trades add column if not exists close_time time;
do $$ begin
if not exists (select 1 from pg_constraint where conname = 'trades_close_timing_valid' and conrelid = 'public.trades'::regclass) then
alter table public.trades add constraint trades_close_timing_valid
  check (
    (close_time is null or close_date is not null)
    and (close_date is null or close_date >= trade_date)
    and (close_date is distinct from trade_date or close_time is null
         or trade_time is null or close_time >= trade_time)
  ) not valid;
end if;
end $$;
commit;
notify pgrst, 'reload schema';
