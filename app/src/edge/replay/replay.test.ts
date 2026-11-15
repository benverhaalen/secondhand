import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayItem } from './replay.ts';
import { memoryStore } from '../events/ports.ts';
import type { EventRow } from '../events/event.ts';

const ev = (o: Partial<EventRow>): Omit<EventRow, 'id'> => ({ user_id: 'u1', source: 'app', action: 'app.list', item_id: 'i1', dedupe_key: Math.random().toString(), actor: 'user', observed_at: '2026-01-01T00:00:00Z', effective_at: '2026-01-01T00:00:00Z', trace_id: 't', ...o });

test('events come back ordered by effective_at, then observed_at, then id', () => {
  const s = memoryStore();
  s.insertEvent(ev({ dedupe_key: 'c', effective_at: '2026-01-03T00:00:00Z' }));
  s.insertEvent(ev({ dedupe_key: 'b2', effective_at: '2026-01-02T00:00:00Z', observed_at: '2026-01-05T00:00:00Z' }));
  s.insertEvent(ev({ dedupe_key: 'b1', effective_at: '2026-01-02T00:00:00Z', observed_at: '2026-01-04T00:00:00Z' }));
  const r = replayItem(s, { user_id: 'u1', item_id: 'i1' });
  assert.ok('events' in r);
  assert.deepEqual(r.events.map(e => e.dedupe_key), ['b1', 'b2', 'c']);
});

test('same times fall back to id order', () => {
  const s = memoryStore();
  const a = s.insertEvent(ev({ dedupe_key: 'x' })).row, b = s.insertEvent(ev({ dedupe_key: 'y' })).row;
  const r = replayItem(s, { user_id: 'u1', item_id: 'i1' });
  assert.ok('events' in r);
  assert.deepEqual(r.events.map(e => e.id), [a.id, b.id].sort());
});

test("another person's item is refused as not_found, same as an item that does not exist", () => {
  const s = memoryStore();
  s.insertEvent(ev({ user_id: 'u2', item_id: 'i9' }));
  assert.deepEqual(replayItem(s, { user_id: 'u1', item_id: 'i9' }), { refused: 'not_found' });
  assert.deepEqual(replayItem(s, { user_id: 'u1', item_id: 'nope' }), { refused: 'not_found' });
});

test("a shared item id never leaks the other person's events", () => {
  const s = memoryStore();
  s.insertEvent(ev({ user_id: 'u2', dedupe_key: 'theirs' }));
  s.insertEvent(ev({ dedupe_key: 'mine' }));
  const r = replayItem(s, { user_id: 'u1', item_id: 'i1' });
  assert.ok('events' in r);
  assert.deepEqual(r.events.map(e => e.dedupe_key), ['mine']);
});
