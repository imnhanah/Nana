// This is a browser-local navigation preference, never an authorization source.
export function readActiveAccount(userId, storage = globalThis.localStorage) {
  try { return storage?.getItem(`tj:active-account:${userId}`) || null; } catch { return null; }
}

export function rememberActiveAccount(userId, accountId, storage = globalThis.localStorage) {
  if (!userId || !accountId) return;
  try { storage?.setItem(`tj:active-account:${userId}`, accountId); } catch { /* Storage may be unavailable in private browsing. */ }
}

export function resolveActiveAccount(accounts, currentId, savedId) {
  // Only select IDs actually returned for the authenticated user.
  return accounts.find(account => account.id === currentId)?.id
    || accounts.find(account => account.id === savedId)?.id
    || accounts[0]?.id || null;
}
