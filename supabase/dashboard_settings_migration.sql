-- AAICOREFX Dashboard + Account Settings evolution
-- Run this once in Supabase SQL Editor before deploying this update.
-- Existing accounts keep their data; all new guardrail values default to 0 (off).

alter table public.accounts add column if not exists profile_image text;
alter table public.accounts add column if not exists monthly_goal_pct numeric not null default 0;
alter table public.accounts add column if not exists yearly_goal_pct numeric not null default 0;
alter table public.accounts add column if not exists daily_loss_limit_pct numeric not null default 0;
alter table public.accounts add column if not exists monthly_loss_limit_pct numeric not null default 0;
