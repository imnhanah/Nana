// Serialize writes per account, including when its page is unmounted/reopened.
const writes = new Map();
export function queueChallengeWrite(key, write) {
  const next = (writes.get(key) || Promise.resolve()).catch(() => {}).then(write);
  writes.set(key, next);
  next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => {});
  return next;
}
export async function waitForChallengeWrites(key) {
  await writes.get(key);
}
