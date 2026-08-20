// Pulls real economic-calendar data from ForexFactory's public calendar export
// feed (the same unofficial JSON feed used by most trading tools/EAs, since
// ForexFactory has no official public API and blocks its calendar page from
// being embedded directly). Docs: https://nfs.faireconomy.media/
//
// Important: this feed is rate-limited (ForexFactory allows ~2 requests per
// 5 minutes across ALL users of a feed URL), so results are cached and only
// refreshed periodically rather than on every page view.

const FEED_URLS = {
  "-1": "https://nfs.faireconomy.media/ff_calendar_lastweek.json",
  "0": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "1": "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
};

const CORS_PROXY = "https://corsproxy.io/?url=";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — refreshes at least twice a day

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
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("bad status " + res.status);
    return normalizeEvents(await res.json());
  } catch (e) {
    // Fall back through a CORS proxy in case the feed doesn't send
    // Access-Control-Allow-Origin for browser fetches from arbitrary sites.
    const res2 = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res2.ok) throw new Error("proxy bad status " + res2.status);
    return normalizeEvents(await res2.json());
  }
}

/**
 * Get calendar events for a given week offset (-1 = last week, 0 = this
 * week, 1 = next week — those are the only three the feed provides).
 * Returns { events, source, fetchedAt } where source is one of
 * 'live' | 'cache' | 'stale-cache' | 'unavailable'.
 */
export async function getCalendarWeek(offset) {
  const key = `ff-cache:${offset}`;
  let cache = null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) cache = JSON.parse(raw);
  } catch (e) { /* no cache yet */ }

  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { events: cache.events, source: "cache", fetchedAt: cache.fetchedAt };
  }

  const url = FEED_URLS[String(offset)];
  if (!url) return { events: null, source: "unavailable", fetchedAt: null };

  try {
    const events = await fetchLive(url);
    try { window.localStorage.setItem(key, JSON.stringify({ events, fetchedAt: now })); } catch (e) {}
    return { events, source: "live", fetchedAt: now };
  } catch (e) {
    if (cache) return { events: cache.events, source: "stale-cache", fetchedAt: cache.fetchedAt };
    return { events: null, source: "unavailable", fetchedAt: null };
  }
}
