import React, { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './journal-controls.css';

export const ThemedFields = React.createContext(false);

function Popup({ label, text, children, disabled = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null), panel = useRef(null);
  const [position, setPosition] = useState(null);
  const id = useId();
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useLayoutEffect(() => {
    if (!open) {setPosition(null); return;}
    const place = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      if (box.bottom < 0 || box.top > window.innerHeight) {setOpen(false);return;}
      const width = Math.min(Math.max(box.width, 250), window.innerWidth - 24);
      const height = Math.min(panel.current?.scrollHeight || 280, 330);
      const below = window.innerHeight - box.bottom - 12;
      const above = box.top - 12;
      const up = below < height && above > below;
      const maxHeight = Math.max(80, Math.min(330, up ? above : below));
      setPosition({position:'fixed',width,left:Math.max(12, Math.min(box.left,window.innerWidth-width-12)),top:up ? Math.max(12,box.top-Math.min(height,maxHeight)-6) : box.bottom+6,maxHeight,visibility:'visible'});
    };
    place();
    const scroll = event => { if (!panel.current?.contains(event.target)) place(); };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', scroll, true);
    return () => {window.removeEventListener('resize',place);document.removeEventListener('scroll',scroll,true);};
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div ref={root} className="tj-themed-control" onBlur={event => { if (!root.current?.contains(event.relatedTarget) && !panel.current?.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') {event.stopPropagation(); close();} }}>
    <button ref={trigger} type="button" className="tj-input tj-picker-trigger" disabled={disabled} aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>{text || 'Select…'}<span aria-hidden="true">⌄</span></button>
    {open && createPortal(<div ref={panel} id={id} className="tj-picker-panel tj-floating-picker" style={position || {position:'fixed',visibility:'hidden',width:250}} role="group" aria-label={label}>{children(close)}</div>, root.current?.closest('.tj-root') || document.body)}
  </div>;
}

function ChoiceList({ options, value, onSelect, label }) {
  const root = useRef(null);
  useEffect(() => { const selected=root.current?.querySelector('[aria-checked="true"]'); if(selected)root.current.scrollTop=selected.offsetTop-root.current.offsetTop; }, []);
  const move = event => {
    const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    let index = buttons.indexOf(document.activeElement);
    if (['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(event.key)) {
      event.preventDefault();
      index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index]?.focus();
    } else if (event.key.length === 1 && event.key !== ' ') {
      buttons.find(button => button.textContent.toLowerCase().startsWith(event.key.toLowerCase()))?.focus();
    }
  };
  return <div ref={root} className="tj-picker-options" role="radiogroup" aria-label={label} onKeyDown={move}>{options.map(option => <button type="button" key={option.value} role="radio" aria-checked={String(value) === String(option.value)} disabled={option.disabled} onClick={() => onSelect(option.value)}>{option.label}</button>)}</div>;
}

export function ThemeSelect({ value, onChange, children, label, disabled }) {
  const options = React.Children.toArray(children).filter(React.isValidElement).map(child => ({value:child.props.value ?? child.props.children, label:child.props.children, disabled:child.props.disabled}));
  const entry = /entry type|entry model/i.test(label || '');
  return <Popup label={label} disabled={disabled} text={options.find(item => String(item.value) === String(value))?.label}>{close => <><strong>{label}</strong>{entry && <p>Attach the setup model that led to this trade.</p>}{label === 'Markup' && <p>Choose from the three most recent pre-session plans.</p>}<div className={entry ? 'tj-choice-grid' : ''}><ChoiceList options={options} value={value} label={label} onSelect={next => {onChange({target:{value:String(next)}}); close();}}/></div></>}</Popup>;
}

const pad = value => String(value).padStart(2,'0');
export function ThemeInstrument({value, onChange, options}) {
  const [query,setQuery] = useState('');
  const compact = text => String(text || '').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const matches = options.filter(item => compact(item).includes(compact(query)));
  return <Popup label="Instrument" text={value || 'Select an instrument…'}>{close => <><strong>Instrument</strong><input autoFocus className="tj-input tj-picker-search" aria-label="Search instruments" placeholder="Search instruments" value={query} onChange={event=>setQuery(event.target.value)}/><ChoiceList label="Instruments" options={matches.map(item=>({value:item,label:item}))} value={value} onSelect={next=>{onChange(next);setQuery('');close();}}/>{!matches.length && <p>No matching instruments.</p>}</>}</Popup>;
}
export function ThemeTime({ value = '', onChange, label = 'Time' }) {
  const [hour, minute] = value.split(':');
  return <Popup label={label} text={value || '--:--'}>{close => <><strong>{label}</strong><p>Choose the hour, then the minute.</p><div className="tj-time-columns">{[['Hour',24,hour],['Minute',60,minute]].map(([name,count,selected]) => <div key={name}><small>{name}</small><ChoiceList label={name} options={Array.from({length:count},(_,i)=>({value:pad(i),label:pad(i)}))} value={selected} onSelect={next => {onChange({target:{value:name === 'Hour' ? `${next}:${minute || '00'}` : `${hour || '00'}:${next}`}}); if(name === 'Minute') close();}}/></div>)}</div><button type="button" className="tj-picker-clear" onClick={() => {onChange({target:{value:''}});close();}}>Clear time</button></>}</Popup>;
}

export function ThemeDate({ value = '', onChange, label = 'Date' }) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(parsed.getFullYear(),parsed.getMonth(),1));
  useEffect(() => { if(value) setMonth(new Date(`${value.slice(0,7)}-01T12:00:00`)); }, [value]);
  const year=month.getFullYear(), index=month.getMonth(), days=new Date(year,index+1,0).getDate();
  return <Popup label={label} text={value || 'Choose date'}>{close => <><div className="tj-date-heading"><button type="button" aria-label="Previous month" onClick={()=>setMonth(new Date(year,index-1,1))}>‹</button><strong>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next month" onClick={()=>setMonth(new Date(year,index+1,1))}>›</button></div><input className="tj-input" aria-label={`Enter ${label} as YYYY-MM-DD`} placeholder="YYYY-MM-DD" defaultValue={value} key={value} onBlur={event => {const next=event.target.value;const date=new Date(`${next}T12:00:00`);if(/^\d{4}-\d{2}-\d{2}$/.test(next)&&!isNaN(date)&&`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`===next)onChange({target:{value:next}});}}/><div className="tj-date-days">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><small key={day}>{day}</small>)}{Array.from({length:month.getDay()},(_,i)=><span key={`blank${i}`}/>)}{Array.from({length:days},(_,i)=>{const next=`${year}-${pad(index+1)}-${pad(i+1)}`;return <button type="button" key={next} aria-label={next} aria-pressed={value===next} onClick={()=>{onChange({target:{value:next}});close();}}>{i+1}</button>;})}</div><button type="button" className="tj-picker-clear" onClick={()=>{onChange({target:{value:''}});close();}}>Clear date</button></>}</Popup>;
}

export function ConfirmDeleteButton({children, onClick, className='', title, disabled, ...props}) {
  const [armed,setArmed] = useState(false);
  const [busy,setBusy] = useState(false);
  const button = useRef(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!armed) return;
    const cancel = event => {if (!button.current?.contains(event.target)) setArmed(false);};
    const other = event => {if (event.detail !== button.current) setArmed(false);};
    const timeout = window.setTimeout(()=>setArmed(false),6000);
    document.addEventListener('pointerdown',cancel);
    window.addEventListener('tj:delete-armed',other);
    return ()=>{clearTimeout(timeout);document.removeEventListener('pointerdown',cancel);window.removeEventListener('tj:delete-armed',other);};
  }, [armed]);
  return <button {...props} ref={button} type="button" disabled={disabled || busy} className={`${className} ${armed ? 'tj-inline-delete-confirm' : ''}`} aria-label={armed ? `Confirm ${title || props['aria-label'] || 'deletion'}` : props['aria-label'] || title} title={armed ? 'Click again to confirm deletion. Escape cancels.' : title} onBlur={()=>setArmed(false)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setArmed(false);}}} onClick={async event=>{
    event.stopPropagation();
    if (inFlight.current) return;
    if (!armed) {window.dispatchEvent(new CustomEvent('tj:delete-armed',{detail:button.current}));setArmed(true);return;}
    inFlight.current=true;setBusy(true);setArmed(false);
    try {await onClick?.(event);} finally {inFlight.current=false;setBusy(false);}
  }}>{armed ? 'Confirm' : children}</button>;
}
