import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveConversation, readConversation, createConversationLoader } from './handoff.ts';
import { newTurn } from './events.ts';
test('Continue carries the turn and its recording label; reading consumes the handoff', () => {
  const map = new Map<string, string>();
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
  const turn = { ...newTurn('turn_one', 'Find this'), recorded: 'words-fixture-prices-counts' };
  saveConversation(storage, [turn]);
  assert.deepEqual(readConversation(storage), [turn]);
  assert.deepEqual(readConversation(storage), []);
});
test('malformed handoffs and unavailable session storage report a useful failure', () => {
  assert.throws(() => readConversation({ getItem: () => '{bad', removeItem() {} }), /JSON/);
  assert.throws(() => readConversation({ getItem: () => '[{"id":2}]', removeItem() {} }), /conversation/);
  const corrupt = { ...newTurn('one', 'Ask'), tools: [null] };
  assert.throws(() => readConversation({ getItem: () => JSON.stringify([corrupt]), removeItem() {} }), /conversation/);
  assert.throws(() => saveConversation({ setItem() { throw new Error('Storage full'); } }, []), /Storage full/);
});
test('mount-effect replay uses the first handoff instead of consuming and clearing it twice', () => {
  let reads = 0;
  const turns = [newTurn('one', 'Find this')];
  const load = createConversationLoader(() => ++reads === 1 ? turns : []);
  assert.deepEqual(load(), turns);
  assert.deepEqual(load(), turns);
  assert.equal(reads, 1);
});
