import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGE_PLAN as plan, STREAK_CHALLENGE_PLAN, emptyChallenge, changeChallengeStatus as change } from './challengeModel.js';
import { buildChallengePlan, isChallengeEnabled } from './challengeModel.js';

test('Custom deposit preserves the original ladder; absent balance keeps challenge off', () => {
  for (const value of [1, 100, 1000, 12.5]) {
    const scaled = buildChallengePlan(value);
    assert.deepEqual(scaled, plan);
    assert.equal(scaled.at(-1).end, 52404);
  }
  for (const value of ['', 0, -1, Infinity, undefined]) {
    assert.deepEqual(buildChallengePlan(value), []);
    assert.equal(isChallengeEnabled({ challengeEnabled: true, challengeStartingBalance: value }), false);
  }
  assert.equal(isChallengeEnabled({ challengeEnabled: false, challengeStartingBalance: 100 }), false);
  assert.equal(isChallengeEnabled({ challengeEnabled: true, challengeStartingBalance: 100 }), true);
});
test('Passing level five completes all preceding levels without discarding notes', () => {
  const original = { ...emptyChallenge(), notes: { 2: 'Keep my note' } };
  const next = change(original, 5, 'Pass');
  for (let i = 1; i <= 5; i++) assert.equal(next.statuses[i], 'Pass');
  assert.equal(next.activeLevel, 6);
  assert.equal(next.statuses[6], 'In progress');
  assert.equal(next.notes[2], 'Keep my note');
  assert.deepEqual(original.statuses, {});
});

test('30 worksheet levels retain exact dollar calculations', () => {
  assert.equal(plan.length, 30);
  assert.equal(plan[0].start, 20);
  assert.equal(plan[0].risk, 4.5);
  assert.equal(plan[0].profit, 6);
  assert.equal(plan[0].end, 26);
  assert.equal(plan.at(-1).end, 52404);
  plan.forEach((row, i) => {
    assert.equal(row.end, row.start + row.profit);
    assert.equal(row.tp, 20);
    if (i) {
      assert.equal(row.start, plan[i - 1].end);
      assert.equal(row.risk, plan[i - 1].profit);
    }
  });
});
test('Mode 2 retains the old risk, stop-loss and lot ladder but uses 3.1R profits', () => {
  const streak = buildChallengePlan(20, 'streak');
  assert.equal(streak.length, 30);
  assert.equal(streak[0].risk, 4.5);
  assert.equal(streak[0].sl, 15);
  assert.equal(streak[0].lots, .03);
  assert.equal(streak[0].tp, 46.5);
  assert.equal(streak[0].profit, 13.95);
  assert.equal(streak[1].risk, 6);
  assert.equal(streak[1].start, 33.95);
  assert.equal(streak.at(-1).end, 124939.15);
  assert.deepEqual(streak, STREAK_CHALLENGE_PLAN);
});
test('Pass advances, step back reactivates previous level without changing plan', () => {
  let state = change(emptyChallenge(), 1, 'Pass');
  assert.equal(state.activeLevel, 2);
  assert.equal(state.statuses[2], 'In progress');
  state = change(state, 2, 'Step back');
  assert.equal(state.activeLevel, 1);
  assert.equal(state.statuses[1], 'In progress');
  assert.equal(state.statuses[2], 'Step back');
  assert.equal(plan.at(-1).end, 52404);
});
test('Only one level in progress and first-level step back remains in range', () => {
  let state = change(emptyChallenge(), 4, 'In progress');
  state = change(state, 7, 'In progress');
  assert.equal(Object.values(state.statuses).filter(s => s === 'In progress').length, 1);
  assert.equal(change(state, 1, 'Step back').activeLevel, 1);
});
test('Completion requires every level passed; clearing a pass reopens challenge', () => {
  assert.equal(change(emptyChallenge(), 30, 'Pass').activeLevel, 31);
  let state = emptyChallenge();
  for (let i = 1; i <= 30; i++) state = change(state, i, 'Pass');
  assert.equal(state.activeLevel, 31);
  assert.equal(Object.values(state.statuses).filter(s => s === 'Pass').length, 30);
  assert.equal(change(state, 30, '').activeLevel, 29);
});
test('Notes survive transitions and progress serializes for persistence', () => {
  const state = change({ ...emptyChallenge(), notes: { 1: 'First attempt' } }, 1, 'Pass');
  assert.equal(state.notes[1], 'First attempt');
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.throws(() => change(state, 0, 'Pass'));
  assert.throws(() => change(state, 1, 'invalid'));
});
test('Not started activates the previous level, with only one in progress', () => {
  const state = change(change(emptyChallenge(), 5, 'Pass'), 5, '');
  assert.equal(state.statuses[5], '');
  assert.equal(state.statuses[4], 'In progress');
  assert.equal(state.activeLevel, 4);
  assert.equal(Object.values(state.statuses).filter(s => s === 'In progress').length, 1);
  const first = change(state, 1, '');
  assert.equal(first.activeLevel, 1);
  assert.equal(first.statuses[1], 'In progress');
});
test('stepping back at an earlier level clears later passed levels and keeps notes',()=>{
  const passed=change({...emptyChallenge(),notes:{15:'Keep this'}},15,'Pass');
  const next=change(passed,5,'Step back');
  assert.equal(next.activeLevel,4);
  assert.equal(next.statuses[4],'In progress');
  for(let level=6;level<=16;level++)assert.equal(next.statuses[level],'');
  assert.equal(next.notes[15],'Keep this');
});
