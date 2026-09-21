import test from 'node:test';
import assert from 'node:assert/strict';
import {tradeTimingError} from './tradeTiming.js';
test('close date and time are required',()=>{
  assert.match(tradeTimingError({date:'2026-09-14',time:'09:30'}),/Choose a close date/);
  assert.match(tradeTimingError({date:'2026-09-14',time:'09:30',closeDate:'2026-09-14'}),/Choose a close time/);
});
test('earlier close day and same-day earlier time are rejected',()=>{
  assert.match(tradeTimingError({date:'2026-09-14',time:'09:30',closeDate:'2026-09-13',closeTime:'12:30'}),/before/);
  assert.match(tradeTimingError({date:'2026-09-14',time:'09:30',closeDate:'2026-09-14',closeTime:'08:30'}),/before/);
});
test('overnight trades are valid',()=>{
  assert.equal(tradeTimingError({date:'2026-09-14',time:'23:30',closeDate:'2026-09-15',closeTime:'00:30'}),'');
});
