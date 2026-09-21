import {buildChallengePlan, isChallengeEnabled} from './challengeModel.js';
export const validMode = mode => mode === 'risk' || mode === 'streak' ? mode : null;
export function localCheckpoint(now = new Date()) {
  const pad = n => String(n).padStart(2,'0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
// A checkpoint freezes prior progress. Closing information is purely metadata.
export function resetAutomation(state, trades, mode, level = state.activeLevel, now = new Date()) {
  if (!Number.isInteger(level) || level < 1 || level > 31) throw new Error('Choose a valid challenge level.');
  const statuses = {...state.statuses};
  for (const key of Object.keys(statuses)) if (statuses[key] === 'In progress') statuses[key] = '';
  if (level <= 30) statuses[level] = 'In progress';
  return {activeLevel:level, statuses, notes:{...state.notes}, automation:{
    mode:validMode(mode), startedAt:now.toISOString(), version:2,
    excludedIds:trades.map(t=>t.id)
  }};
}
export function replayChallenge(baseline, account) {
  const state = {...baseline, statuses:{...baseline.statuses}, notes:{...baseline.notes}, levelPnl:0, lossStreak:0, counted:0};
  const config=baseline.automation;
  if (!isChallengeEnabled(account) || !validMode(config?.mode) || !config.startedAt) return state;
  const excluded=new Set(config.excludedIds || []);
  const plan=buildChallengePlan(account.challengeStartingBalance, config.mode);
  const loggedAt=t=>Date.parse(t.createdAt || `${t.date}T${t.time || '00:00'}`);
  const rows=(account.trades || []).filter(t=>{
    if (excluded.has(t.id) || (t.accountId && t.accountId !== account.id)) return false;
    return loggedAt(t) >= Date.parse(config.startedAt) && t.grossPnl != null && Number.isFinite(Number(t.grossPnl));
  }).sort((a,b)=>loggedAt(a)-loggedAt(b) || String(a.id).localeCompare(String(b.id)));
  let cents=0;
  for (const trade of rows) {
    if (state.activeLevel > 30) break;
    const row=plan[state.activeLevel-1];
    const amount=Number(trade.grossPnl);
    const gross=Math.round(amount*100);
    cents+=gross; state.counted++;
    if (amount < 0) state.lossStreak++; else if (amount > 0) state.lossStreak=0;
    const pass=cents >= Math.round(row.profit*100);
    const back=config.mode === 'risk' ? cents <= -Math.round(row.risk*100) : state.lossStreak >= 2;
    if (pass || back) {
      const previous=state.activeLevel;
      state.statuses[previous]=pass ? 'Pass' : 'Step back';
      state.activeLevel=pass ? Math.min(31,previous+1) : Math.max(1,previous-1);
      if (state.activeLevel <= 30) state.statuses[state.activeLevel]='In progress';
      cents=0; state.lossStreak=0;
    }
  }
  state.levelPnl=cents/100;
  return state;
}
