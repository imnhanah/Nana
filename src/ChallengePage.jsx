import React, { useEffect, useRef, useState } from 'react';
import { Trophy, CheckCircle2, Save, ArrowDown, Target } from 'lucide-react';
import { supabase } from './supabaseClient';
import { CHALLENGE_PLAN, emptyChallenge, changeChallengeStatus } from './challengeModel';
import './challenge.css';

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const statusClass = status => status === 'Pass' ? 'pass' : status === 'Step back' ? 'back' : status === 'In progress' ? 'progress' : '';

export default function ChallengePage({ account, userId }) {
  const [state, setState] = useState(emptyChallenge);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [details, setDetails] = useState(false);
  const activeRow = useRef(null);

  async function load(cancelled = () => false) {
    setLoading(true); setError('');
    try {
      const { data, error: failure } = await supabase.from('challenge_progress').select('active_level,statuses,notes').eq('account_id', account.id).eq('user_id', userId).maybeSingle();
      if (failure) throw failure;
      if (!cancelled()) {
        setState(data ? { activeLevel: data.active_level, statuses: data.statuses || {}, notes: data.notes || {} } : emptyChallenge());
        setDirty(false); setSaved(false);
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

  function edit(next) { setState(next); setDirty(true); setSaved(false); }
  async function save() {
    setSaving(true); setSaved(false); setError('');
    try {
      const { error: failure } = await supabase.from('challenge_progress').upsert({ account_id: account.id, user_id: userId, active_level: state.activeLevel, statuses: state.statuses, notes: state.notes, updated_at: new Date().toISOString() }, { onConflict: 'account_id' });
      if (failure) throw failure;
      setDirty(false); setSaved(true);
    } catch (failure) { setError(`Could not save Challenge: ${failure.message || 'Please try again.'}`); }
    finally { setSaving(false); }
  }
  const passed = Object.values(state.statuses).filter(status => status === 'Pass').length;
  const current = CHALLENGE_PLAN[Math.min(state.activeLevel, 30) - 1];
  const complete = state.activeLevel === 31;
  return <section className="tj-challenge">
    <header className="tj-challenge-heading"><div><h2><Trophy size={21}/> Challenge</h2><p>20-pip compounding · 30 levels · {account.name}</p></div><div className="tj-challenge-actions"><span role="status">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : saved ? 'Saved' : ''}</span><button className="tj-btn-primary" disabled={loading || saving || !dirty} onClick={save}><Save size={15}/> Save progress</button></div></header>
    {error && <div role="alert" className="tj-challenge-error">{error} <button className="tj-btn" onClick={() => { if (dirty) { setError(''); save(); } else load(); }}>Retry</button></div>}
    <div className="tj-challenge-metrics">
      <article className="tj-panel"><small>STARTING BALANCE</small><strong>{money(20)}</strong><span>Separate from your trading account</span></article>
      <article className="tj-panel"><small>ACTIVE LEVEL</small><strong>{complete ? 'Complete' : `${state.activeLevel} / 30`}</strong><span>{complete ? 'All levels reached' : `${money(current.risk)} planned risk`}</span></article>
      <article className="tj-panel"><small>LEVELS PASSED</small><strong>{passed} / 30</strong><progress aria-label="Levels passed" value={passed} max={30}/></article>
      <article className="tj-panel"><small>PLANNED FINAL BALANCE</small><strong className="tj-challenge-positive">{money(52404)}</strong><span>Target, not actual account equity</span></article>
    </div>
    <div className="tj-panel tj-challenge-current"><Target size={22}/><div><strong>{complete ? 'Challenge complete' : `Level ${current.level} · ${money(current.start)} → ${money(current.end)}`}</strong><p>{complete ? 'Your planned 30-level ladder is complete.' : `Target profit ${money(current.profit)} becomes the next level’s risk.`} No commissions or swaps.</p></div><button className="tj-btn" onClick={() => activeRow.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><ArrowDown size={14}/> {complete ? 'Final level' : 'Active level'}</button></div>
    <div className="tj-panel tj-challenge-plan"><div className="tj-challenge-table-head"><div><h3>Compounding plan</h3><p>Pass advances one level. Step back returns one level. The planned amounts stay unchanged.</p></div><label><input type="checkbox" checked={details} onChange={event => setDetails(event.target.checked)}/> Show sizing details</label></div>
      {loading ? <p role="status" className="tj-challenge-loading">Loading Challenge…</p> : <div className="tj-challenge-scroll" role="region" aria-label="30-level compounding plan" tabIndex={0}><table><thead><tr><th>Level</th><th>Starting balance</th><th>Risk dollars</th><th>Profit dollars</th><th>Ending balance</th>{details && <><th>Risk %</th><th>Profit %</th><th>SL pips</th><th>TP pips</th><th>Std. lots</th></>}<th>Status</th><th>Notes</th></tr></thead><tbody>{CHALLENGE_PLAN.map(row => <tr key={row.level} ref={row.level === Math.min(state.activeLevel, 30) ? activeRow : null} className={row.level === state.activeLevel ? 'tj-challenge-active' : ''}>
        <th scope="row">{row.level}<span>{row.level === state.activeLevel ? 'Active' : state.statuses[row.level] === 'Pass' ? <CheckCircle2 size={14} aria-label="Passed"/> : ''}</span></th>
        <td>{money(row.start)}</td><td className="tj-challenge-negative">{money(row.risk)}</td><td className="tj-challenge-positive">{money(row.profit)}</td><td><b>{money(row.end)}</b></td>
        {details && <><td>{row.riskPct.toFixed(2)}%</td><td>{row.profitPct.toFixed(2)}%</td><td>{row.sl.toFixed(2)}</td><td>{row.tp}</td><td>{row.lots.toFixed(2)}</td></>}
        <td><select disabled={saving || (!!error && !dirty)} aria-label={`Level ${row.level} status`} className={`tj-challenge-status ${statusClass(state.statuses[row.level])}`} value={state.statuses[row.level] || ''} onChange={event => edit(changeChallengeStatus(state, row.level, event.target.value))}><option value="">Not started</option><option>Pass</option><option>In progress</option><option>Step back</option></select></td>
        <td><input disabled={saving || (!!error && !dirty)} className="tj-input" aria-label={`Level ${row.level} notes`} placeholder="Add a note…" maxLength={2000} value={state.notes[row.level] || ''} onChange={event => edit({ ...state, notes: { ...state.notes, [row.level]: event.target.value } })}/></td>
      </tr>)}</tbody></table></div>}
      <p className="tj-challenge-footnote">Sizing reproduces the worksheet’s fixed $10-per-pip assumption per standard lot. This is a planned ladder, not an instrument-specific position-size calculator.</p>
    </div>
  </section>;
}
