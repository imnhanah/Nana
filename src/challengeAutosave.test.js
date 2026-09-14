import test from 'node:test';
import assert from 'node:assert/strict';
import { queueChallengeWrite, waitForChallengeWrites } from './challengeAutosave.js';
test('Rapid edits persist in order and reopening waits for the latest write', async () => {
  const saved = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = queueChallengeWrite('one', async () => { await gate; saved.push(1); });
  const second = queueChallengeWrite('one', async () => { saved.push(2); });
  release();
  await waitForChallengeWrites('one');
  await Promise.all([first, second]);
  assert.deepEqual(saved, [1, 2]);
});
test('A failed write is reported and does not block retry or another account', async () => {
  await assert.rejects(queueChallengeWrite('failed', async () => { throw Error('offline'); }));
  let retried = false;
  await queueChallengeWrite('failed', async () => { retried = true; });
  await queueChallengeWrite('other', async () => {});
  assert.equal(retried, true);
});
