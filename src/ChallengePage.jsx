import React, { useRef, useState } from 'react';
import { Trophy, CheckCircle2, ArrowDown, Target } from 'lucide-react';
import { buildChallengePlan, isChallengeEnabled } from './challengeModel';
import './challenge.css';
import JournalSignalHeader from './JournalSignalHeader';

const currencySymbols = { USD: '$', EUR: '€', GBP: '£', GHS: '₵' };
const money = (value, currency = 'USD') => `${currencySymbols[currency] || '$'}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusClass = status => status === 'Pass' ? 'pass' : status === 'Step back' ? 'back' : status === 'In progress' ? 'progress' : '';

export default function ChallengePage({ account, challenge, loginQuote }) {
  if (!isChallengeEnabled(account)) return null;
  return <ActiveChallengePage account={account} challenge={challenge} loginQuote={loginQuote}/>;
}
function ActiveChallengePage({ account, challenge, loginQuote }) {
  const accountMoney = value => money(value, account.baseCurrency || 'USD');
  const {state, loading, saving, error} = challenge;
  const mode = state.automation?.mode || 'risk';
  const CHALLENGE_PLAN = buildChallengePlan(account.challengeStartingBalance, mode);
  const [details, setDetails] = useState(false);
  const activeRow = useRef(null);
  const passed = Object.values(state.statuses).filter(status => status === 'Pass').length;
  const current = CHALLENGE_PLAN[Math.min(state.activeLevel, 30) - 1];
  const complete = state.activeLevel === 31;
  return <section className="tj-challenge">
    <JournalSignalHeader page="challenge" challenge={{...state, loading, error}} loginQuote={loginQuote}/>
    <header className="tj-challenge-heading"><div><h2><Trophy size={21}/> Challenge</h2><p>{account.name}</p></div></header>
    {error && <div role="alert" className="tj-panel">{error} <button type="button" onClick={challenge.retry}>Retry</button></div>}
    {state.automation?.mode && !loading && <div className="tj-panel tj-challenge-auto-progress" role="status"><strong>{state.automation.mode === "risk" ? "Mode 1 — Risk Limit" : "Mode 2 — Two-Loss Streak"}</strong><span>Level gross P&L: {accountMoney(state.levelPnl)} · Loss streak: {state.lossStreak} · {state.counted} logged trades</span><small>Progress recalculates when you edit or delete a counted trade.</small></div>}
    <div className="tj-challenge-metrics">
      <article className="tj-panel"><small>STARTING BALANCE</small><strong>{accountMoney(account.challengeStartingBalance)}</strong><span>Build the life you want, one disciplined step at a time.</span></article>
      <article className="tj-panel"><small>ACTIVE LEVEL</small><strong>{complete ? 'Complete' : `${state.activeLevel} / 30`}</strong><span>{complete ? 'All levels reached' : `${accountMoney(current.risk)} planned risk`}</span></article>
      <article className="tj-panel"><small>LEVELS PASSED</small><strong>{passed} / 30</strong><progress aria-label="Levels passed" value={passed} max={30}/></article>
      <article className="tj-panel"><small>PLANNED FINAL BALANCE</small><strong className="tj-challenge-positive">{accountMoney(CHALLENGE_PLAN.at(-1).end)}</strong><span>Small beginnings can grow into a life you are proud of.</span></article>
    </div>
    <div className="tj-panel tj-challenge-current"><Target size={22}/><div><strong>{complete ? 'Challenge complete' : `Level ${current.level} · ${accountMoney(current.start)} → ${accountMoney(current.end)}`}</strong></div><button className="tj-btn" onClick={() => activeRow.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><ArrowDown size={14}/> {complete ? 'Final level' : 'Active level'}</button></div>
    <div className="tj-panel tj-challenge-plan"><div className="tj-challenge-table-head"><div><h3>Compounding plan</h3><p>One step at a time, build the life you once only imagined.</p></div><label><input type="checkbox" checked={details} onChange={event => setDetails(event.target.checked)}/> Show sizing details</label></div>
      {loading ? <p role="status" className="tj-challenge-loading">Loading Challenge…</p> : <div className="tj-challenge-scroll" role="region" aria-label="30-level compounding plan" tabIndex={0}><table><thead><tr><th>Level</th><th>Starting balance</th><th>Risk amount</th><th>Profit amount</th><th>Ending balance</th>{details && <><th>Risk %</th><th>Profit %</th><th>SL pips</th><th>TP pips</th><th>Std. lots</th></>}<th>Status</th><th>Notes</th></tr></thead><tbody>{CHALLENGE_PLAN.map(row => <tr data-milestone={[10, 20, 30].includes(row.level) ? row.level : undefined} key={row.level} ref={row.level === Math.min(state.activeLevel, 30) ? activeRow : null} className={row.level === state.activeLevel ? 'tj-challenge-active' : ''}>
        <th scope="row">{row.level}{[10, 20, 30].includes(row.level) && <span className="tj-challenge-milestone-badge"><Trophy size={12} aria-hidden="true"/> Milestone</span>}<span>{row.level === state.activeLevel ? 'Active' : state.statuses[row.level] === 'Pass' ? <CheckCircle2 size={14} aria-label="Passed"/> : ''}</span></th>
        <td>{accountMoney(row.start)}</td><td className="tj-challenge-negative">{accountMoney(row.risk)}</td><td className="tj-challenge-positive">{accountMoney(row.profit)}</td><td><b>{accountMoney(row.end)}</b></td>
        {details && <><td>{row.riskPct.toFixed(2)}%</td><td>{row.profitPct.toFixed(2)}%</td><td>{row.sl.toFixed(2)}</td><td>{row.tp}</td><td>{row.lots.toFixed(2)}</td></>}
        <td><select disabled={loading || saving || !!error} aria-label={`Level ${row.level} status`} className={`tj-challenge-status ${statusClass(state.statuses[row.level])}`} value={state.statuses[row.level] || ''} onChange={event => challenge.setStatus(row.level, event.target.value)}><option value="">Not started</option><option>Pass</option><option>In progress</option><option>Step back</option></select></td>
        <td><input disabled={loading || saving || !!error} className="tj-input" aria-label={`Level ${row.level} notes`} placeholder="Add a note…" maxLength={2000} defaultValue={state.notes[row.level] || ''} onBlur={event => {if(event.target.value !== (state.notes[row.level] || '')) challenge.setNote(row.level,event.target.value);}}/></td>
      </tr>)}</tbody></table></div>}
      <p className={`tj-challenge-footnote ${passed === 30 ? 'tj-challenge-celebration' : ''}`} role="status">{passed === 30 ? '“Thirty levels complete. Celebrate the patience, courage, and discipline that brought you here—this milestone is yours!”' : '“Every step forward is a reason to keep believing in the life you are building.”'}</p>
    </div>
  </section>;
}
