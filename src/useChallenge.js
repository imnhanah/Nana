import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {supabase} from './supabaseClient';
import {emptyChallenge, isChallengeEnabled, changeChallengeStatus} from './challengeModel';
import {resetAutomation, replayChallenge} from './challengeAutomation';
import {queueChallengeWrite, waitForChallengeWrites} from './challengeAutosave';

export default function useChallenge(account, userId) {
  const key=account?.id ? `${userId}:${account.id}` : '';
  const currentKey=useRef(key); currentKey.current=key;
  const [record,setRecord]=useState(null);
  const [loading,setLoading]=useState(false), [saving,setSaving]=useState(false), [error,setError]=useState('');
  const ready=record?.key === key;
  const baseline=ready ? record.state : emptyChallenge();
  const state=useMemo(()=>replayChallenge(baseline, account),[baseline,account]);
  const latest=useRef(null);
  const flight=useRef(null);
  useEffect(()=>{
    const warn=event=>{if(flight.current || latest.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  const reload=useCallback(async()=>{
    if (!key) return;
    setLoading(true);setError('');
    try {
      await waitForChallengeWrites(key);
      const {data,error:failure}=await supabase.from('challenge_progress').select('*').eq('account_id',account.id).eq('user_id',userId).maybeSingle();
      if(failure)throw failure;
      // A zero-row column query distinguishes an old schema from a fresh account.
      const probe=await supabase.from('challenge_progress').select('automation').eq('account_id',account.id).limit(0);
      if(currentKey.current!==key)return;
      const next=data ? {activeLevel:data.active_level,statuses:data.statuses || {},notes:data.notes || {},automation:data.automation || null} : emptyChallenge();
      setRecord({key,state:next,modesReady:!probe.error});latest.current=null;
    } catch(failure) {if(currentKey.current===key)setError(`Could not load challenge: ${failure.message}. Check that the Challenge SQL migrations are applied.`);}
    finally {if(currentKey.current===key)setLoading(false);}
  },[key,account?.id,userId]);
  useEffect(()=>{setRecord(null);latest.current=null;flight.current=null;setSaving(false);if(key)void reload();},[key,reload]);
  async function persist(next) {
    if(!ready || loading || flight.current===key) return false;
    flight.current=key;
    setSaving(true);setError('');latest.current={key,next};
    try {
      await queueChallengeWrite(key,async()=>{
        const payload={account_id:account.id,user_id:userId,active_level:next.activeLevel,statuses:next.statuses,notes:next.notes,updated_at:new Date().toISOString()};
        if(record.modesReady)payload.automation=next.automation || null;
        const {error:failure}=await supabase.from('challenge_progress').upsert(payload,{onConflict:'account_id'});
        if(failure)throw failure;
      });
      if(currentKey.current===key){setRecord({...record,state:next});latest.current=null;}
      return true;
    } catch(failure) {if(currentKey.current===key)setError(`Could not save challenge: ${failure.message}`);return false;}
    finally {if(currentKey.current===key){flight.current=null;setSaving(false);}}
  }
  const reset=(mode,level)=>persist(resetAutomation(state,account.trades || [],mode,level));
  return {state, loading:loading || !ready, saving, error, modesReady:ready && record.modesReady,
    reload, retry:()=>latest.current?.key===key ? persist(latest.current.next) : reload(),
    setMode:mode=>reset(mode,state.activeLevel),
    configure:(mode,level)=>reset(mode,level),
    setLevel:level=>reset(baseline.automation?.mode,level),
    setStatus:(level,status)=>{
      const next=changeChallengeStatus(state,level,status);
      return persist(resetAutomation(next,account.trades || [],baseline.automation?.mode,next.activeLevel));
    },
    setNote:(level,note)=>persist({...baseline,notes:{...baseline.notes,[level]:note}})
  };
}
