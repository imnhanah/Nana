// Exact lot ladder from Compouding 2 Alpha.xlsx, sheet 20pip.
const LOTS = [0.03,0.04,0.05,0.07,0.09,0.11,0.14,0.19,0.24,0.32,0.41,0.54,0.7,0.91,1.18,1.54,2,2.6,3.37,4.39,5.7,7.41,9.64,12.53,16.28,21.17,27.52,35.78,46.51,60.46];
export const CHALLENGE_PLAN = (() => {
  let balance = 20, previousProfit = 4.5;
  return LOTS.map((lots, index) => {
    const profit = Math.round(lots * 200 * 100) / 100;
    const row = { level: index + 1, start: balance, risk: previousProfit, profit,
      end: balance + profit, lots, tp: 20, sl: previousProfit / (lots * 10),
      riskPct: previousProfit / balance * 100, profitPct: profit / balance * 100 };
    balance = row.end;
    previousProfit = profit;
    return row;
  });
})();
export const emptyChallenge = () => ({ activeLevel: 1, statuses: {}, notes: {} });
export const isChallengeEnabled = account => !!account?.challengeEnabled && Number.isFinite(Number(account.challengeStartingBalance)) && Number(account.challengeStartingBalance) > 0;
export function buildChallengePlan(startingBalance) {
  const start = Number(startingBalance);
  if (!Number.isFinite(start) || start <= 0) return [];
  return CHALLENGE_PLAN.map(row => ({ ...row }));
}
export function changeChallengeStatus(state, level, status) {
  if (!Number.isInteger(level) || level < 1 || level > 30 || !['', 'Pass', 'In progress', 'Step back'].includes(status)) throw new Error('Invalid challenge status');
  const statuses = { ...state.statuses, [level]: status };
  if (status === 'Step back') for (const key of Object.keys(statuses)) if (+key > level) statuses[key] = '';
  if (status === 'Pass') for (let previous = 1; previous < level; previous++) statuses[previous] = 'Pass';
  let activeLevel = state.activeLevel;
  if (status) {
    Object.keys(statuses).forEach(key => { if (+key !== level && statuses[key] === 'In progress') statuses[key] = ''; });
    activeLevel = status === 'Pass' ? Math.min(31, level + 1) : status === 'Step back' ? Math.max(1, level - 1) : level;
    if (activeLevel === 31) activeLevel = CHALLENGE_PLAN.find(row => statuses[row.level] !== 'Pass')?.level || 31;
    if (activeLevel <= 30 && activeLevel !== level) statuses[activeLevel] = 'In progress';
  }
  if (!status) {
    Object.keys(statuses).forEach(key => { if (statuses[key] === 'In progress') statuses[key] = ''; });
    activeLevel = Math.max(1, level - 1);
    statuses[activeLevel] = 'In progress';
  }
  return { ...state, statuses, activeLevel };
}
