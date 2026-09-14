import React, { useEffect, useId, useRef, useState } from 'react';
import './journal-controls.css';

export const ThemedFields = React.createContext(false);

function Popup({ label, text, children, disabled = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null);
  const id = useId();
  useEffect(() => {
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div ref={root} className="tj-themed-control" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') {event.stopPropagation(); close();} }}>
    <button ref={trigger} type="button" className="tj-input tj-picker-trigger" disabled={disabled} aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>{text || 'Select…'}<span aria-hidden="true">⌄</span></button>
    {open && <div id={id} className="tj-picker-panel" role="group" aria-label={label}>{children(close)}</div>}
  </div>;
}

function ChoiceList({ options, value, onSelect, label }) {
  const root = useRef(null);
  useEffect(() => { root.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({block:'nearest'}); }, []);
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
  return <Popup label={label} disabled={disabled} text={options.find(item => String(item.value) === String(value))?.label}>{close => <ChoiceList options={options} value={value} label={label} onSelect={next => {onChange({target:{value:String(next)}}); close();}}/>}</Popup>;
}

const pad = value => String(value).padStart(2,'0');
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

export function confirmDelete(message) {
  return new Promise(resolve => window.dispatchEvent(new CustomEvent('tj:confirm-delete',{detail:{message,resolve}})));
}
export function DeleteConfirmation() {
  const [request,setRequest]=useState(null);
  const dialog=useRef(null), pending=useRef(null), previous=useRef(null);
  const finish = result => {pending.current?.resolve(result);pending.current=null;dialog.current?.close();setRequest(null);previous.current?.focus();};
  useEffect(()=>{const receive=event=>{pending.current?.resolve(false);previous.current=document.activeElement;pending.current=event.detail;setRequest(event.detail);};window.addEventListener('tj:confirm-delete',receive);return()=>{window.removeEventListener('tj:confirm-delete',receive);pending.current?.resolve(false);};},[]);
  useEffect(()=>{if(request)dialog.current?.showModal();},[request]);
  return <dialog ref={dialog} className="tj-delete-confirm" aria-labelledby="delete-title" onCancel={event=>{event.preventDefault();finish(false);}}><h2 id="delete-title">Confirm deletion</h2><p>{request?.message}</p><div><button type="button" autoFocus onClick={()=>finish(false)}>Cancel</button><button type="button" className="tj-delete-confirm-red" onClick={()=>finish(true)}>Confirm delete</button></div></dialog>;
}
