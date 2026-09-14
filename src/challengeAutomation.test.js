import test from 'node:test';
import assert from 'node:assert/strict';
import {resetAutomation,replayChallenge} from './challengeAutomation.js';
import {emptyChallenge,CHALLENGE_PLAN} from './challengeModel.js';
const now=new Date(2026,8,14,10,0);
const account={id:'a',challengeEnabled:true,challengeStartingBalance:20};
const row=(id,grossPnl,extra={})=>({id,grossPnl,pnl:grossPnl-99,closeDate:'2026-09-14',closeTime:`11:${String(id).padStart(2,'0')}`,...extra});
const start=(mode,level=1,old=[])=>resetAutomation(emptyChallenge(),old,mode,level,now);
const replay=(base,trades,patch={})=>replayChallenge(base,{...account,trades,...patch});
test('manual and disabled accounts never move',()=>{
  assert.equal(replay(start(null),[row(1,100)]).activeLevel,1);
  assert.equal(replay(start('risk'),[row(1,100)],{challengeEnabled:false}).activeLevel,1);
});
test('gross profits accumulate, ignore costs, and excess advances one level only',()=>{
  const state=replay(start('risk'),[row(1,2),row(2,4)]);
  assert.equal(state.activeLevel,2);assert.equal(state.levelPnl,0);
  assert.equal(replay(start('risk'),[row(1,100000)]).activeLevel,2);
});
test('Mode 1 accumulates signed gross P&L until risk threshold',()=>{
  const state=replay(start('risk',4),[row(1,-4),row(2,-6)]);
  assert.equal(state.activeLevel,3);assert.equal(state.levelPnl,0);
  assert.equal(replay(start('risk',4),[row(1,-4),row(2,2),row(3,-6)]).activeLevel,4);
});
test('Mode 2 steps back on any two losses, including tiny ones',()=>{
  const state=replay(start('streak',4),[row(1,-.01),row(2,-.01)]);
  assert.equal(state.activeLevel,3);assert.equal(state.lossStreak,0);
  assert.equal(replay(start('streak',4),[row(1,-100)]).activeLevel,4);
});
test('breakeven preserves streak; a win resets it',()=>{
  assert.equal(replay(start('streak',4),[row(1,-1),row(2,0),row(3,-1)]).activeLevel,3);
  const state=replay(start('streak',4),[row(1,-1),row(2,.1),row(3,-1)]);
  assert.equal(state.activeLevel,4);assert.equal(state.lossStreak,1);
});
test('manual checkpoint freezes prior progress and resets counters',()=>{
  const trades=[row(1,-1)];
  const state=replay(start('streak',4),trades);
  const base=resetAutomation(state,trades,'streak',5,new Date(2026,8,14,12));
  const result=replay(base,[...trades,row(2,-1,{closeTime:'13:00'})]);
  assert.equal(result.activeLevel,5);assert.equal(result.lossStreak,1);
  assert.equal(result.counted,1);
});
test('mode changes start fresh and preserve manually selected level',()=>{
  const base=resetAutomation({...emptyChallenge(),activeLevel:5},[row(1,200)],'risk',5,now);
  assert.equal(replay(base,[row(1,200),row(2,18)]).activeLevel,6);
});
test('open, pre-checkpoint, and foreign-account trades do not count',()=>{
  const result=replay(start('risk'),[row(1,100,{closeDate:''}),row(2,100,{closeTime:'09:59'}),row(3,100,{accountId:'b'})]);
  assert.equal(result.counted,0);
  assert.equal(replay(start('risk'),[row(4,6,{closeTime:''})]).activeLevel,2);
});
test('edits, deletions, and reopening counted trades replay from baseline',()=>{
  const base=start('risk');const trade=row(1,6);
  assert.equal(replay(base,[trade]).activeLevel,2);
  assert.equal(replay(base,[{...trade,grossPnl:1}]).activeLevel,1);
  assert.equal(replay(base,[]).activeLevel,1);
  assert.equal(replay(base,[{...trade,closeDate:''}]).activeLevel,1);
  assert.deepEqual(replay(base,[trade]),replay(base,[trade]));
});
test('bounds stop at level one and complete after level thirty',()=>{
  assert.equal(replay(start('risk'),[row(1,-10)]).activeLevel,1);
  const state=replay(start('risk',30),[row(1,CHALLENGE_PLAN[29].profit),row(2,-100000)]);
  assert.equal(state.activeLevel,31);
});
test('chronological replay is stable regardless of input order',()=>{
  const trades=[row(1,-.1),row(2,.1),row(3,-.1)];
  assert.deepEqual(replay(start('streak',4),trades),replay(start('streak',4),[...trades].reverse()));
});
