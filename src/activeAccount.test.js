import test from 'node:test';
import assert from 'node:assert/strict';
import { readActiveAccount, rememberActiveAccount, resolveActiveAccount } from './activeAccount.js';

const accounts = [{id:'first'}, {id:'second'}];
function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
}
test('last account survives a fresh load and another login', () => {
  const storage = memoryStorage();
  rememberActiveAccount('user-a', 'second', storage);
  for (let login = 0; login < 2; login++) {
    assert.equal(resolveActiveAccount(accounts, null, readActiveAccount('user-a', storage)), 'second');
  }
});
test('preferences are isolated between users', () => {
  const storage = memoryStorage();
  rememberActiveAccount('user-a', 'second', storage);
  assert.equal(readActiveAccount('user-b', storage), null);
});
test('refresh preserves current selection and deleted/foreign IDs fall back safely', () => {
  assert.equal(resolveActiveAccount(accounts, 'second', 'first'), 'second');
  assert.equal(resolveActiveAccount(accounts, 'deleted', 'second'), 'second');
  assert.equal(resolveActiveAccount(accounts, null, 'foreign'), 'first');
  assert.equal(resolveActiveAccount([], 'second', 'second'), null);
});
test('unavailable storage does not prevent using the journal', () => {
  const storage = {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}};
  assert.equal(readActiveAccount('user-a', storage), null);
  assert.doesNotThrow(() => rememberActiveAccount('user-a', 'second', storage));
});
