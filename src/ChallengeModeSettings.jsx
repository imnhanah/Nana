import React from 'react';
import {ThemeSelect} from './JournalControls';
export default function ChallengeModeSettings({challenge, enabled}) {
  const {state,loading,saving,error,modesReady}=challenge;
  const mode=state.automation?.mode;
  const disabled=!enabled || loading || saving || !modesReady;
  return <div className="tj-challenge-mode-settings">
    <strong>Challenge Mode</strong>
    <div className="tj-challenge-mode-buttons">{[['risk','Mode 1 — Risk Limit'],['streak','Mode 2 — Two-Loss Streak']].map(([value,label])=><button key={value} type="button" disabled={disabled} aria-pressed={mode===value} onClick={()=>challenge.setMode(mode===value ? null : value)}>{label}</button>)}</div>
    {(!enabled || loading || !modesReady || mode) && <p>{!enabled ? 'Enable Challenge and save the account first.' : loading ? 'Loading saved mode…' : !modesReady ? 'Apply challenge_modes_migration.sql to enable modes. Manual challenge controls remain available.' : mode==='risk' ? 'Gross P&L accumulates at each level. Reach the profit target to advance, or the risk limit to step back.' : 'Reach the gross profit target to advance. Any two losses step back; wins reset the streak and breakevens leave it unchanged.'}</p>}
    <label>Current level</label>
    <ThemeSelect label="Current challenge level" disabled={!enabled || loading || saving} value={state.activeLevel} onChange={event=>challenge.setLevel(Number(event.target.value))}>{Array.from({length:30},(_,i)=><option key={i+1} value={i+1}>Level {i+1}</option>)}{state.activeLevel===31 && <option value={31}>Complete</option>}</ThemeSelect>
    <small>Mode and level changes save immediately and reset progress and streaks. Only trades closed afterward count. Gross P&amp;L excludes commission and swap. Excess is not carried forward.</small>
    {saving && <p role="status">Saving challenge…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={challenge.retry}>Retry</button></p>}
  </div>;
}
