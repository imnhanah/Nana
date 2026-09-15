-- Apply after challenge_migration.sql. No existing levels or trades are removed.
alter table public.challenge_progress
  add column if not exists automation jsonb;
comment on column public.challenge_progress.automation is
  'Replay checkpoint: mode, local starting timestamp, IDs closed before the checkpoint. active_level and statuses store the manual baseline.';
notify pgrst, 'reload schema';
