import test from 'node:test';
import assert from 'node:assert/strict';
import {tradeTimingError} from './tradeTiming.js';
test('close timing is optional',()=>assert.equal(tradeTimingError({date:'2026-09-14',time:'09:30'}),''));
test('close time requires a date',()=>assert.match(tradeTimingError({date:'2026-09-14',closeTime:'12:30'}),/Choose a close date/));
test('earlier close day and same-day earlier time are rejected',()=>{
  assert.match(tradeTimingError({date:'2026-09-14',closeDate:'2026-09-13'}),/before/);
  assert.match(tradeTimingError({date:'2026-09-14',time:'09:30',closeDate:'2026-09-14',closeTime:'08:30'}),/before/);
});
test('overnight trades and clearing optional timing are valid',()=>{
  assert.equal(tradeTimingError({date:'2026-09-14',time:'23:30',closeDate:'2026-09-15',closeTime:'00:30'}),'');
  assert.equal(tradeTimingError({date:'2026-09-14',time:'23:30',closeDate:'',closeTime:''}),'');
});
