import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEED_URLS: Record<string, string> = {
  "-1": "https://nfs.faireconomy.media/ff_calendar_lastweek.json",
  "0": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "1": "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
};
const CACHE_TTL_MS = 15 * 60 * 1000;

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function validOffset(value: unknown) {
  const offset = Number(value);
  return Number.isInteger(offset) && offset >= -1 && offset <= 1 ? offset : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reply({ error: "Calendar function configuration is incomplete." }, 500);

  // Economic-calendar data is public and this endpoint accepts only the three
  // fixed weekly exports below. Keeping it callable without a journal session
  // lets the News screen load before auth restoration completes and avoids a
  // false "unavailable" state for an otherwise healthy public feed.

  // A GET query works reliably from the public browser client.  POST remains
  // supported for the Supabase dashboard tester and other API consumers.
  const rawBody = request.method === "POST" ? await request.text() : "";
  let body: Record<string, unknown> = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { return reply({ error: "Request body must be JSON." }, 400); }
  const requestedOffset = new URL(request.url).searchParams.get("weekOffset") ?? body?.weekOffset ?? 0;
  const weekOffset = validOffset(requestedOffset);
  if (weekOffset === null) return reply({ error: "weekOffset must be -1, 0, or 1." }, 400);

  const service = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: cached } = await service
    .from("economic_calendar_cache")
    .select("events, fetched_at")
    .eq("week_offset", weekOffset)
    .maybeSingle();

  const cachedAt = cached?.fetched_at ? new Date(cached.fetched_at).getTime() : 0;
  if (cached && Number.isFinite(cachedAt) && Date.now() - cachedAt < CACHE_TTL_MS) {
    return reply({ events: cached.events, source: "cache", fetchedAt: cached.fetched_at });
  }

  try {
    const upstream = await fetch(FEED_URLS[String(weekOffset)], {
      headers: { "User-Agent": "AAICOREFX Economic Calendar/1.0" },
    });
    if (!upstream.ok) throw new Error(`Upstream returned ${upstream.status}.`);
    const events = await upstream.json();
    if (!Array.isArray(events)) throw new Error("Upstream returned an invalid calendar payload.");

    const fetchedAt = new Date().toISOString();
    const { error: saveError } = await service.from("economic_calendar_cache").upsert({
      week_offset: weekOffset,
      events,
      source: "forexfactory",
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    });
    if (saveError) console.error("Calendar cache write failed:", saveError.message);
    return reply({ events, source: "live", fetchedAt });
  } catch (error) {
    // A stale real result is safer and more useful than fabricated sample data.
    if (cached) return reply({ events: cached.events, source: "stale-cache", fetchedAt: cached.fetched_at });
    return reply({ error: "Live calendar is temporarily unavailable." }, 503);
  }
});
