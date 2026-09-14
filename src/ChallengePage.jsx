import React, { useEffect, useRef, useState } from 'react';
import { Trophy, CheckCircle2, ArrowDown, Target } from 'lucide-react';
import { supabase } from './supabaseClient';
import { buildChallengePlan, isChallengeEnabled, emptyChallenge, changeChallengeStatus } from './challengeModel';
import './challenge.css';
import { queueChallengeWrite, waitForChallengeWrites } from './challengeAutosave';
import JournalSignalHeader from './JournalSignalHeader';

const currencySymbols = { USD: '$', EUR: '€', GBP: '£', GHS: '₵' };
const money = (value, currency = 'USD') => `${currencySymbols[currency] || '$'}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusClass = status => status === 'Pass' ? 'pass' : status === 'Step back' ? 'back' : status === 'In progress' ? 'progress' : '';

export default function ChallengePage({ account, userId, loginQuote }) {
  if (!isChallengeEnabled(account)) return null;
  return <ActiveChallengePage account={account} userId={userId} loginQuote={loginQuote}/>;
}
function ActiveChallengePage({ account, userId, loginQuote }) {
  const CHALLENGE_PLAN = buildChallengePlan(account.challengeStartingBalance);
  const accountCurrency = account.baseCurrency || 'USD';
  const accountMoney = value => money(value, accountCurrency);
  const [state, setState] = useState(emptyChallenge);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const revision = useRef(0);
  const latest = useRef(null);
  const writeKey = `${userId}:${account.id}`;
  const [details, setDetails] = useState(false);
  const activeRow = useRef(null);

  async function load(cancelled = () => false) {
    setLoading(true); setError('');
    try {
      await waitForChallengeWrites(writeKey);
      const { data, error: failure } = await supabase.from('challenge_progress').select('active_level,statuses,notes').eq('account_id', account.id).eq('user_id', userId).maybeSingle();
      if (failure) throw failure;
      if (!cancelled()) {
        setState(data ? { activeLevel: data.active_level, statuses: data.statuses || {}, notes: data.notes || {} } : emptyChallenge());
        setDirty(false);
      }
    } catch (failure) {
      if (!cancelled()) setError(`Challenge progress could not be loaded. ${['42P01', 'PGRST205'].includes(failure.code) ? 'The Challenge database migration needs to be applied.' : failure.message || 'Please try again.'}`);
    } finally { if (!cancelled()) setLoading(false); }
  }
  useEffect(() => { let cancelled = false; load(() => cancelled); return () => { cancelled = true; }; }, [account.id, userId]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function edit(next) {
    latest.current = next;
    setState(next); setDirty(true);
    void save(next);
  }
  async function save(snapshot = latest.current || state) {
    const version = ++revision.current;
    setError('');
    try {
      await queueChallengeWrite(writeKey, async () => {
        const { error: failure } = await supabase.from('challenge_progress').upsert({ account_id: account.id, user_id: userId, active_level: snapshot.activeLevel, statuses: snapshot.statuses, notes: snapshot.notes, updated_at: new Date().toISOString() }, { onConflict: 'account_id' });
        if (failure) throw failure;
      });
      if (version === revision.current) setDirty(false);
    } catch (failure) {
      if (version === revision.current) setError(`Could not automatically save Challenge: ${failure.message || 'Please try again.'}`);
    }
  }
  const passed = Object.values(state.statuses).filter(status => status === 'Pass').length;
  const current = CHALLENGE_PLAN[Math.min(state.activeLevel, 30) - 1];
  const complete = state.activeLevel === 31;
  return <section className="tj-challenge">
    <JournalSignalHeader page="challenge" challenge={{...state, loading, error}} loginQuote={loginQuote}/>
    <header className="tj-challenge-heading"><div><h2><Trophy size={21}/> Challenge</h2><p>20-pip compounding · 30 levels · {account.name}</p></div></header>
    {error && <div role="alert" className="tj-challenge-error">{error} <button className="tj-btn" onClick={() => { if (dirty) { setError(''); save(); } else load(); }}>Retry</button></div>}
    <div className="tj-challenge-metrics">
      <article className="tj-panel"><small>STARTING BALANCE</small><strong>{accountMoney(account.challengeStartingBalance)}</strong><span>Build the life you want, one disciplined step at a time.</span></article>
      <article className="tj-panel"><small>ACTIVE LEVEL</small><strong>{complete ? 'Complete' : `${state.activeLevel} / 30`}</strong><span>{complete ? 'All levels reached' : `${accountMoney(current.risk)} planned risk`}</span></article>
      <article className="tj-panel"><small>LEVELS PASSED</small><strong>{passed} / 30</strong><progress aria-label="Levels passed" value={passed} max={30}/></article>
      <article className="tj-panel"><small>PLANNED FINAL BALANCE</small><strong className="tj-challenge-positive">{accountMoney(CHALLENGE_PLAN.at(-1).end)}</strong><span>Small beginnings can grow into a life you are proud of.</span></article>
    </div>
    <div className="tj-panel tj-challenge-current"><Target size={22}/><div><strong>{complete ? 'Challenge complete' : `Level ${current.level} · ${accountMoney(current.start)} → ${accountMoney(current.end)}`}</strong><p>{complete ? 'Your planned 30-level ladder is complete.' : `Target profit ${accountMoney(current.profit)} becomes the next level’s risk.`} No commissions or swaps.</p></div><button className="tj-btn" onClick={() => activeRow.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><ArrowDown size={14}/> {complete ? 'Final level' : 'Active level'}</button></div>
    <div className="tj-panel tj-challenge-plan"><div className="tj-challenge-table-head"><div><h3>Compounding plan</h3><p>One step at a time, build the life you once only imagined.</p></div><label><input type="checkbox" checked={details} onChange={event => setDetails(event.target.checked)}/> Show sizing details</label></div>
      {loading ? <p role="status" className="tj-challenge-loading">Loading Challenge…</p> : <div className="tj-challenge-scroll" role="region" aria-label="30-level compounding plan" tabIndex={0}><table><thead><tr><th>Level</th><th>Starting balance</th><th>Risk amount</th><th>Profit amount</th><th>Ending balance</th>{details && <><th>Risk %</th><th>Profit %</th><th>SL pips</th><th>TP pips</th><th>Std. lots</th></>}<th>Status</th><th>Notes</th></tr></thead><tbody>{CHALLENGE_PLAN.map(row => <tr data-milestone={[10, 20, 30].includes(row.level) ? row.level : undefined} key={row.level} ref={row.level === Math.min(state.activeLevel, 30) ? activeRow : null} className={row.level === state.activeLevel ? 'tj-challenge-active' : ''}>
        <th scope="row">{row.level}{[10, 20, 30].includes(row.level) && <span className="tj-challenge-milestone-badge"><Trophy size={12} aria-hidden="true"/> Milestone</span>}<span>{row.level === state.activeLevel ? 'Active' : state.statuses[row.level] === 'Pass' ? <CheckCircle2 size={14} aria-label="Passed"/> : ''}</span></th>
        <td>{accountMoney(row.start)}</td><td className="tj-challenge-negative">{accountMoney(row.risk)}</td><td className="tj-challenge-positive">{accountMoney(row.profit)}</td><td><b>{accountMoney(row.end)}</b></td>
        {details && <><td>{row.riskPct.toFixed(2)}%</td><td>{row.profitPct.toFixed(2)}%</td><td>{row.sl.toFixed(2)}</td><td>{row.tp}</td><td>{row.lots.toFixed(2)}</td></>}
        <td><select disabled={loading || (!!error && !dirty)} aria-label={`Level ${row.level} status`} className={`tj-challenge-status ${statusClass(state.statuses[row.level])}`} value={state.statuses[row.level] || ''} onChange={event => edit(changeChallengeStatus(state, row.level, event.target.value))}><option value="">Not started</option><option>Pass</option><option>In progress</option><option>Step back</option></select></td>
        <td><input disabled={loading || (!!error && !dirty)} className="tj-input" aria-label={`Level ${row.level} notes`} placeholder="Add a note…" maxLength={2000} value={state.notes[row.level] || ''} onChange={event => edit({ ...state, notes: { ...state.notes, [row.level]: event.target.value } })}/></td>
      </tr>)}</tbody></table></div>}
      <p className={`tj-challenge-footnote ${passed === 30 ? 'tj-challenge-celebration' : ''}`} role="status">{passed === 30 ? '“Thirty levels complete. Celebrate the patience, courage, and discipline that brought you here—this milestone is yours!”' : '“Every step forward is a reason to keep believing in the life you are building.”'}</p>
    </div>
  </section>;
}
