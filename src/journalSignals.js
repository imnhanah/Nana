const signal = (title, subtitle, detail) => ({ title, subtitle, detail });
export function journalSignal({page, trades = [], markups = [], reviews = [], guardrails = {}, monthCursor = new Date(), challenge}) {
  const n = trades.length;
  const reviewed = new Set(reviews.map(r => r.tradeId));
  const pending = trades.filter(t => !reviewed.has(t.id)).length;
  if (page === 'challenge') {
    if (challenge.loading) return signal('Reading your progress.', 'One level at a time.', 'Your saved challenge is loading.');
    if (challenge.error) return signal('Progress needs attention.', 'Check the saved record.', 'Resolve the loading or saving error below before relying on these levels.');
    const passed = Object.values(challenge.statuses).filter(s => s === 'Pass').length;
    const setbacks = Object.values(challenge.statuses).filter(s => s === 'Step back').length;
    if (passed === 30) return signal('Thirty levels recorded.', 'Review the journey.', 'All 30 levels are marked passed. Reflect on the decisions behind your progress.');
    if (setbacks) return signal('A setback is recorded.', 'Learn before moving on.', `${setbacks} levels are marked Step back; ${passed} are passed. Add notes on what changed and review your plan.`);
    return signal(passed ? 'Progress is building.' : 'Start with a plan.', 'Respect each level.', `${passed} of 30 levels are marked passed. Planned balances are targets, not guaranteed outcomes.`);
  }
  if (page === 'markups') {
    if (!markups.length) return signal('Start with context.', 'Build the plan.', 'Create a markup before your next session so setup, levels, and expectations are visible before execution.');
    const incomplete = markups.filter(m => !m.structure?.trim() || !m.levels?.trim() || !m.notes?.trim()).length;
    const linked = trades.filter(t => markups.some(m => m.id === t.premarketMarkupId)).length;
    if (incomplete) return signal('Make the plan visible.', 'Fill the missing context.', `${incomplete} of ${markups.length} markups need structure, levels, or expectations. ${linked} trades are linked to a plan.`);
    return signal(linked ? 'Context is connected.' : 'Your plans are captured.', linked ? 'Keep refining.' : 'Connect the execution.', `${markups.length} markups have their planning fields filled; ${linked} trades are linked. Compare the plan with what actually happened.`);
  }
  if (page === 'calendar') {
    const date = new Date(monthCursor);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    const rows = trades.filter(t => t.date?.startsWith(key));
    const days = new Set(rows.map(t => t.date)).size;
    if (!rows.length) return signal('A clear month ahead.', 'Let the record grow.', 'No trades are logged for the selected month. Dates will reveal your rhythm as you record decisions.');
    const net = rows.reduce((sum,t) => sum + Number(t.pnl || 0),0);
    return signal('Your rhythm is taking shape.', net < 0 ? 'Review the difficult days.' : 'Study the pattern.', `${rows.length} trades across ${days} days in the selected month; recorded net P&L is ${net < 0 ? 'negative' : net > 0 ? 'positive' : 'flat'}. Calendar placement uses the open date.`);
  }
  if (!n) return signal(page === 'reviews' ? 'Nothing to review yet.' : page === 'tradelog' ? 'Start with one trade.' : 'Start with one decision.', 'Build the record.', 'Log a trade with its context first. Your journal needs evidence before it can identify patterns.');
  if (page === 'reviews') return pending ? signal('Turn records into lessons.', 'Close the review gap.', `${pending} of ${n} trades have no saved review. Capture the decision, not just the result.`) : signal('Your reviews are up to date.', 'Look for repeat patterns.', `All ${n} trades have a saved review. Compare recurring setups and mistakes across your monthly and annual reflections.`);
  if (page === 'tradelog') {
    const missing = trades.filter(t => !t.closeDate || !t.closeTime || !t.time).length;
    if (missing) return signal('Complete the trade story.', 'Make timing visible.', `${missing} of ${n} trades lack full open/close timing. Add optional exit details to unlock holding-time comparisons.`);
    return signal('The trade record is connected.', 'Review the decisions.', `${n} trades have full timing. ${pending} still need a saved review; compare execution and outcomes together.`);
  }
  if (guardrails.tradeEntryLocked) return signal('Your loss limit is active.', 'Pause and review.', 'Trade entry is paused by an account guardrail. Use this time to review your decisions and prepare your next plan.');
  const mistakes = trades.filter(t => t.mistakes?.length).length;
  if (mistakes) return signal('A pattern needs attention.', 'Review the process.', `${mistakes} of ${n} trades carry mistake tags. Check which behaviors recur before drawing conclusions from P&L.`);
  if (n < 10) return signal('Your record is growing.', 'Keep the context clear.', `${n} trades are logged. This is an early sample, not proof of an edge. Record plans, timing, and reviews consistently.`);
  if (pending) return signal('There is more to learn.', 'Finish the reflections.', `${pending} of ${n} trades still need a review. Fill the gaps before judging the process by results alone.`);
  const net = trades.reduce((sum,t) => sum + Number(t.pnl || 0),0);
  return signal(net > 0 ? 'Results are positive.' : 'Results need a closer look.', net > 0 ? 'Protect the process.' : 'Study the decisions.', `${n} trades are reviewed and recorded net P&L is ${net > 0 ? 'positive' : net < 0 ? 'negative' : 'flat'}. Compare repeatable decisions, risk, and outcomes; results alone do not prove an edge.`);
}
