# Economic calendar Edge Function

This function fetches the current ForexFactory calendar export on the server,
caches it in `economic_calendar_cache`, and serves only last week (`-1`), this
week (`0`), or next week (`1`) to signed-in journal users.

## Deploy

1. Run `supabase/economic_calendar_cache_migration.sql` in the Supabase SQL editor.
2. Deploy: `supabase functions deploy economic-calendar`.
3. The function uses Supabase's built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` environment variables; no browser key or CORS proxy
   is required.

The cache refreshes after 15 minutes. If the upstream export is unavailable,
the function returns the last real cached week with source `stale-cache` rather
than manufacturing sample news.
