// Economic calendar data is retrieved through the Supabase Edge Function.
// That keeps the ForexFactory export and its cache on the server rather than
// relying on an in-browser CORS proxy. The browser cache is only an offline
// convenience layer; the server cache is the shared source of truth.
const FEED_URLS = {
  "-1": "https://nfs.faireconomy.media/ff_calendar_lastweek.json",
  "0": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "1": "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
};

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeEvents(raw) {
  return raw.map((e) => {
    const d = new Date(e.date);
    return {
      dateKey: d.toDateString(),
      isoDate: d.toISOString(),
      time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      currency: e.country,
      impact: (e.impact || "").toLowerCase(), // 'high' | 'medium' | 'low' | 'holiday'
      title: e.title,
      forecast: e.forecast || "—",
      previous: e.previous || "—",
    };
  });
}

async function fetchLive(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("bad status " + res.status);
  return normalizeEvents(await res.json());
}

async function fetchFromCalendarFunction(offset) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/economic-calendar?weekOffset=${encodeURIComponent(offset)}`;
  const response = await fetch(url, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.events) throw new Error(data?.error || "Calendar function returned no events.");
  return { events: normalizeEvents(data.events), source: data.source || "live", fetchedAt: data.fetchedAt || Date.now() };
}

/**
 * Get calendar events for a given week offset (-1 = last week, 0 = this
 * week, 1 = next week — those are the only three the feed provides).
 * Returns { events, source, fetchedAt } where source is one of
 * 'live' | 'cache' | 'stale-cache' | 'unavailable'. No mock calendar data is
 * returned here: an unavailable source stays visibly unavailable in the UI.
 */
export async function getCalendarWeek(offset) {
  const key = `ff-cache:${offset}`;
  let cache = null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) cache = JSON.parse(raw);
  } catch (e) { /* no cache yet */ }

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CLIENT_CACHE_TTL_MS) {
    return { events: cache.events, source: "cache", fetchedAt: cache.fetchedAt };
  }

  try {
    const result = await fetchFromCalendarFunction(offset);
    const events = result.events;
    try { window.localStorage.setItem(key, JSON.stringify({ events, fetchedAt: now })); } catch (e) {}
    return { events, source: result.source, fetchedAt: result.fetchedAt };
  } catch (e) {
    // The direct export is a development-only rescue path until the function
    // is deployed. It has no proxy and is never treated as the primary source.
    const url = FEED_URLS[String(offset)];
    try {
      if (!url) throw new Error("Unknown calendar week.");
      const events = await fetchLive(url);
      try { window.localStorage.setItem(key, JSON.stringify({ events, fetchedAt: now })); } catch (ignore) {}
      return { events, source: "live", fetchedAt: now };
    } catch (directError) {
      if (cache) return { events: cache.events, source: "stale-cache", fetchedAt: cache.fetchedAt };
      return { events: null, source: "unavailable", fetchedAt: null };
    }
  }
}
