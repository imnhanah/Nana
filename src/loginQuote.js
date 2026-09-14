// Original trading reminders, not attributed quotations or financial promises.
export const TRADING_QUOTES = [
  'Focus on the process, not the outcome.',
  'Protect your capital. Let patience guide your next trade.',
  'A clear plan is worth more than an impulsive entry.',
  'Review the decision, not just the result.',
  'Not every market move needs to become your trade.',
  'Consistency begins with the rules you choose to follow.',
  'Trade what you planned. Learn from what you recorded.',
  'Small, disciplined decisions build a stronger process.',
  'Know your risk before you consider the reward.',
  'The next opportunity is not a reason to abandon your plan.',
];
const memory = new Map();

export function getLoginQuote(user, suppliedStorage) {
  const key = `tj:login-quote:${user.id}`;
  const login = user.last_sign_in_at || 'restored-session';
  let storage = suppliedStorage;
  try { if (!storage && typeof window !== 'undefined') storage = window.sessionStorage; } catch { /* Private browsing may block storage. */ }
  let previous = memory.get(key);
  try { previous = JSON.parse(storage?.getItem(key) || 'null') || previous; } catch { /* Ignore malformed or inaccessible storage. */ }
  const valid = Number.isInteger(previous?.index) && previous.index >= 0 && previous.index < TRADING_QUOTES.length;
  if (valid && previous.login === login) return TRADING_QUOTES[previous.index];
  // Exclude the previous quote so a new login always feels fresh.
  const candidates = TRADING_QUOTES.map((_, i) => i).filter(i => !valid || i !== previous.index);
  const index = candidates[Math.floor(Math.random() * candidates.length)];
  const record = { login, index };
  memory.set(key, record);
  try { storage?.setItem(key, JSON.stringify(record)); } catch { /* In-memory fallback still survives page/account changes. */ }
  return TRADING_QUOTES[index];
}
