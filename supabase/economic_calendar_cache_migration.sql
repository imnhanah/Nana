-- Shared, short-lived cache for the real economic-calendar export.
-- It is written only by the economic-calendar Edge Function (service role)
-- and is deliberately not exposed to the browser through RLS policies.
begin;

create table if not exists public.economic_calendar_cache (
  week_offset smallint primary key check (week_offset between -1 and 1),
  events jsonb not null default '[]'::jsonb,
  source text not null default 'forexfactory',
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.economic_calendar_cache enable row level security;

commit;
