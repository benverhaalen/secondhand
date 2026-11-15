import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeSource, validateEvent, type EventRow, type Snapshot } from './event.ts';

const ev = (n: number): Omit<EventRow, 'id'> => ({
  user_id: 'u1', source: 'watcher_signed_in', site: 'depop', account_id: 'a1', action: 'listing.sold',
  dedupe_key: `depop:a1:sold:L${n}`, actor: 'site', observed_at: '2026-11-14T22:00:00Z',
  effective_at: '2026-11-14T22:00:00Z', trace_id: `t${n}`, payload: { listing_external_id: `L${n}` },
});

test('a valid event passes; a missing dedupe key is named', () => {
  assert.deepEqual(validateEvent(ev(1)), []);
  assert.deepEqual(validateEvent({ ...ev(1), dedupe_key: '' }), ['dedupe_key']);
  assert.ok(validateEvent({ ...ev(1), action: 'nope' as never }).includes('action'));
});

test('the fake source pages through every event once', async () => {
  const src = fakeSource('watcher_signed_in', [ev(1), ev(2), ev(3)]);
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const r = await src.read(cursor);
    seen.push(...r.events.map(e => e.dedupe_key));
    if (r.cursor === cursor) break;
    cursor = r.cursor;
  }
  assert.deepEqual(seen, ['depop:a1:sold:L1', 'depop:a1:sold:L2', 'depop:a1:sold:L3']);
});

test('a snapshot section not read is absent, not empty', () => {
  const s: Snapshot = { site: 'mercari', account_id: 'a2', user_id: 'u1', taken_at: 'x', route: 'public', listings: [] };
  assert.equal(s.offers, undefined);
  assert.deepEqual(s.listings, []);
});
