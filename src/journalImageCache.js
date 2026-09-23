const DATABASE = "tj-journal-images";
const STORE = "snapshots";

const requestValue = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const openDatabase = () => new Promise((resolve, reject) => {
  if (!window.indexedDB) { reject(new Error("IndexedDB is unavailable")); return; }
  const request = window.indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const imageSnapshot = (data = {}) => ({
  trades: Object.fromEntries((data.accounts || []).flatMap(account => (account.trades || []).map(trade => [trade.id, trade.screenshots]))),
  markups: Object.fromEntries((data.markups || []).map(markup => [markup.id, markup.screenshots])),
  reviews: Object.fromEntries((data.reviews || []).map(review => [review.id, review.screenshots])),
});

export async function writeJournalImageCache(userId, data) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(imageSnapshot(data), userId);
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    database.close();
    return true;
  } catch { return false; }
}

export async function hydrateJournalImages(userId, data) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE, "readonly");
    const images = await requestValue(transaction.objectStore(STORE).get(userId));
    database.close();
    if (!images) return { data, found: false };
    return {
      found: true,
      data: {
        ...data,
        accounts: (data.accounts || []).map(account => ({ ...account, trades: (account.trades || []).map(trade => ({ ...trade, screenshots: images.trades?.[trade.id] ?? trade.screenshots })) })),
        markups: (data.markups || []).map(markup => ({ ...markup, screenshots: images.markups?.[markup.id] ?? markup.screenshots })),
        reviews: (data.reviews || []).map(review => ({ ...review, screenshots: images.reviews?.[review.id] ?? review.screenshots })),
      },
    };
  } catch { return { data, found: false }; }
}
