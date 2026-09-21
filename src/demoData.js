// Synthetic educational history; never represents live executions or deposits.
export function buildDemoHistory() {
  let seed = 202501;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const shuffle = (items) => { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };
  const trades = [];
  let equity = 1000;
  for (let month = 0; month < 12; month++) {
    const count = month < 4 ? 18 : 16;
    const wins = [9, 2, 10, 3, 8, 9, 2, 7, 8, 3, 9, 10][month];
    const flat = [2, 1, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2][month];
    const outcomes = shuffle(Array.from({length: count}, (_, i) => i < wins ? 'win' : i < wins + flat ? 'be' : 'loss'));
    const days = [];
    for (let day = 1; day <= 31; day++) {
      const date = new Date(Date.UTC(2025, month, day));
      if (date.getUTCMonth() === month && ![0, 6].includes(date.getUTCDay())) days.push(date.toISOString().slice(0, 10));
    }
    const dates = shuffle(days).slice(0, count).sort();
    dates.forEach((date, i) => {
      const win = outcomes[i] === 'win';
      const be = outcomes[i] === 'be';
      const risk = Math.round(equity * .01 * 100) / 100;
      const pnl = win ? Math.round(risk * 3.2 * 100) / 100 : be ? 0 : -risk;
      const asset = ["XAU/USD", "GBP/USD", "EUR/USD"][Math.floor(random() * 3)];
      const session = random() < .5 ? "London" : "NY AM";
      const time = session === "London" ? "09:30" : "14:30";
      const entryType = ['EM1 — Trend Pullback', 'EM2 — Breakout Retest', 'EM3 — Reversal'][Math.floor(random() * 3)];
      const types = shuffle(['Trend', 'Liquidity', 'Breakout']).slice(0, 1 + Math.floor(random() * 3));
      trades.push({date, time, asset, entryType, types, direction: random() < .5 ? "BUY" : "SELL", session, pnl, rr: win ? 3.2 : be ? 0 : -1, risk, openingEquity: equity,
        context: `Synthetic demo trade. Opening equity $${equity.toFixed(2)}; 1% risk $${risk.toFixed(2)}; planned target 3.2R; outcome ${win ? '+3.2R' : be ? '0R (breakeven exit)' : '-1R'}.`});
      equity = Math.round((equity + pnl) * 100) / 100;
    });
  }
  // Add a compact 2026 sample: 70 completed demo trades from January through
  // September 18, all planned with the requested 3.1R reward-to-risk target.
  const demo2026Plan = [
    [0, 8, 4, 1], [1, 8, 3, 1], [2, 8, 4, 1], [3, 8, 3, 1], [4, 8, 4, 1],
    [5, 8, 3, 1], [6, 8, 4, 1], [7, 7, 3, 1], [8, 7, 3, 1],
  ];
  demo2026Plan.forEach(([month, count, wins, flat]) => {
    const outcomes = shuffle(Array.from({ length: count }, (_, i) => i < wins ? "win" : i < wins + flat ? "be" : "loss"));
    const days = [];
    for (let day = 1; day <= 31; day++) {
      const date = new Date(Date.UTC(2026, month, day));
      const iso = date.toISOString().slice(0, 10);
      if (date.getUTCMonth() === month && ![0, 6].includes(date.getUTCDay()) && iso <= "2026-09-18") days.push(iso);
    }
    const dates = shuffle(days).slice(0, count).sort();
    // Make the final requested endpoint visible in the demo timeline.
    if (month === 8 && !dates.includes("2026-09-18")) {
      dates[dates.length - 1] = "2026-09-18";
      dates.sort();
    }
    dates.forEach((date, i) => {
      const win = outcomes[i] === "win";
      const be = outcomes[i] === "be";
      const risk = Math.round(equity * .01 * 100) / 100;
      const pnl = win ? Math.round(risk * 3.1 * 100) / 100 : be ? 0 : -risk;
      const asset = ["XAU/USD", "GBP/USD", "EUR/USD", "US30"][Math.floor(random() * 4)];
      const session = random() < .5 ? "London" : "NY AM";
      const time = session === "London" ? "09:30" : "14:30";
      const entryType = ["EM1 — Trend Pullback", "EM2 — Breakout Retest", "EM3 — Reversal"][Math.floor(random() * 3)];
      const types = shuffle(["Trend", "Liquidity", "Breakout"]).slice(0, 1 + Math.floor(random() * 3));
      trades.push({ date, time, asset, entryType, types, direction: random() < .5 ? "BUY" : "SELL", session, pnl, rr: 3.1, targetR: 3.1, risk, openingEquity: equity,
        context: `Synthetic demo trade. Opening equity $${equity.toFixed(2)}; 1% risk $${risk.toFixed(2)}; planned target 3.1R; outcome ${win ? "+3.1R" : be ? "0R (breakeven exit)" : "-1R"}.` });
      equity = Math.round((equity + pnl) * 100) / 100;
    });
  });
  const periods = [];
  const addPeriod = (type, key, selected) => {
    const wins = selected.filter(t => t.pnl > 0).length;
    const pnl = selected.reduce((sum, t) => sum + t.pnl, 0);
    const losses = selected.filter(t => t.pnl < 0).length;
    const targetR = Math.max(...selected.map((trade) => Number(trade.targetR || trade.rr) || 0), 0);
    const summary = `Synthetic demonstration: ${selected.length} trades, ${wins} wins, ${losses} losses, ${selected.length - wins - losses} breakevens, ${(wins / selected.length * 100).toFixed(1)}% win rate, $${pnl.toFixed(2)} net P&L. Risk was 1% of running equity with a ${targetR.toFixed(1)}R target. Three entry models and varied confluences were used.`;
    periods.push({type, key, completed: true, content: {
      overview: summary, invalid: "Stopped trades respected their original invalidation level.", missedTrades: "No missed trades are modelled in this demonstration.", strategyPerformance: summary,
      technicalWins: `Winning examples reached the planned ${targetR.toFixed(1)}R target.`, technicalLosses: "Losing examples closed at the planned 1R stop.", technicalRules: `Keep the 1% risk cap and ${targetR.toFixed(1)}R target consistent.`,
      mistakes: "No discretionary execution mistakes are modelled.", mistakePatterns: "Avoid treating a planned stop as a reason to increase risk.", mistakeInterrupt: "Recalculate 1% risk before every entry.",
      habits: "Position risk was recalculated using the running balance.", habitDrift: "No routine deviations are modelled.", habitChange: "Continue recording risk and reviewing each outcome.",
      markups: "Directional bias accuracy is not modelled; this dataset has no linked market charts.", markupMisalignment: "No chart evidence is supplied for this synthetic history.", markupExecution: "Both buy and sell examples follow the same risk framework.",
      goals: "Completed the planned trade sample and reviews.", goalImpact: "Consistent sizing kept losses proportional to equity.", goalNext: "Maintain the review routine and fixed risk percentage.",
      overallWell: summary, overallLessons: "Monthly win rates vary; losing months and breakeven exits are part of this 40% overall win-rate sample.", overallAdjustment: "Preserve disciplined risk sizing; synthetic results are not a forecast."
    }});
  };
  for (let m = 1; m <= 12; m++) { const key = `2025-${String(m).padStart(2, '0')}`; addPeriod("monthly", key, trades.filter(t => t.date.startsWith(key))); }
  for (let q = 1; q <= 4; q++) addPeriod("quarterly", `2025-Q${q}`, trades.filter((trade) => trade.date.startsWith("2025-") && Math.ceil(Number(trade.date.slice(5,7)) / 3) === q));
  addPeriod("annual", "2025", trades.filter((trade) => trade.date.startsWith("2025-")));
  for (let m = 1; m <= 9; m++) { const key = `2026-${String(m).padStart(2, "0")}`; addPeriod("monthly", key, trades.filter((trade) => trade.date.startsWith(key))); }
  for (let q = 1; q <= 3; q++) addPeriod("quarterly", `2026-Q${q}`, trades.filter((trade) => trade.date.startsWith("2026-") && Math.ceil(Number(trade.date.slice(5, 7)) / 3) === q));
  addPeriod("annual", "2026", trades.filter((trade) => trade.date.startsWith("2026-")));
  return {trades, periods, equity};
}
