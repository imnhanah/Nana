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
export function getLoginQuote() {
  // A page reload starts a fresh journal session, so the reminder refreshes too.
  return TRADING_QUOTES[Math.floor(Math.random() * TRADING_QUOTES.length)];
}
