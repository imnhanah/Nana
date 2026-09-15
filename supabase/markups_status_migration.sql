-- AAICOREFX Premarket Markup status evolution
-- Safe for existing journals: every previous markup becomes Planned.

alter table public.premarket_markups
  add column if not exists status text not null default 'Planned';
