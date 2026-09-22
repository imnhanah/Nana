const VERSION = 1;
const keyFor = (userId) => `tj:journal-cache:${VERSION}:${userId}`;

// Screenshots can be large data URLs. Cache the journal records locally but
// deliberately leave image payloads out so localStorage stays small.
const withoutImages = (items = []) => items.map((item) => {
  if (!item || typeof item !== "object") return item;
  if (Array.isArray(item.screenshots)) return { ...item, screenshots: [] };
  if (item.screenshots && typeof item.screenshots === "object") {
    const screenshots = Object.fromEntries(Object.entries(item.screenshots).map(([key, value]) => [key, Array.isArray(value) ? [] : value]));
    return { ...item, screenshots };
  }
  return item;
});

export function readJournalCache(userId) {
  try {
    const cached = JSON.parse(localStorage.getItem(keyFor(userId)) || "null");
    return cached?.data?.accounts ? cached : null;
  } catch { return null; }
}

export function writeJournalCache(userId, data, syncSignature = null) {
  try {
    const compact = {
      ...data,
      accounts: (data.accounts || []).map((account) => ({ ...account, trades: withoutImages(account.trades) })),
      markups: withoutImages(data.markups),
      reviews: withoutImages(data.reviews),
    };
    localStorage.setItem(keyFor(userId), JSON.stringify({ cachedAt: new Date().toISOString(), syncSignature, data: compact }));
    return true;
  } catch { return false; }
}

export function clearJournalCache(userId) {
  try { localStorage.removeItem(keyFor(userId)); } catch {}
}
