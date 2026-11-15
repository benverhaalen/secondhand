import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dropped, storable } from './keep.ts';

const now = Date.parse('2026-11-15T12:00:00Z');

test('rights absent, refused, expired, invalid or exactly at expiry cannot be stored', () => {
  const rows = [
    { site: 'dupe', may_store: false, url: 'https://example.test/refused' },
    { site: 'poshmark', may_store: true },
    { site: 'x' },
    ...['2026-11-15T11:59:59Z', '2026-11-15T12:00:00Z', 'invalid'].map(keep_until => ({ site: 'x', may_store: true, keep_until })),
    { site: 'x', may_store: true, keep_until: '2026-11-15T12:00:01Z' },
  ];
  assert.deepEqual(storable(rows, now), [rows[1], rows[6]]);
  assert.equal(dropped(rows, now), 5);
  assert.equal(rows.length, 7);
});

test('nested listing arrays are filtered without changing counts, stages, searched or identity', () => {
  const value = { results: [{ site: 'x', may_store: false }], batches: [{ results: [{ site: 'y', may_store: true }] }],
    found: { results_found: 2, sites: { x: 1, y: 1 } }, stages: [{ name: 'site:x', state: 'failed', found: { results_found: 1 } }],
    searched: [{ site: 'x', outcome: 'blocked', count: 1 }], identity: { by: 'codes' }, other: [null, 'x', 2, { found: 1 }] };
  const saved = storable(value, now);
  assert.deepEqual(saved, { ...value, results: [] });
  assert.equal(dropped(value, now), 1);
  assert.notEqual(saved, value);
  assert.notEqual(saved.found, value.found);
  assert.notEqual(saved.batches[0].results[0], value.batches[0].results[0]);
  saved.batches[0].results[0].site = 'changed';
  assert.equal(value.batches[0].results[0].site, 'y');
});

test('retention follows row rights rather than the source name', () => {
  const value = [{ site: 'dupe', may_store: true }, { site: 'poshmark', may_store: false }];
  assert.deepEqual(storable(value, now), [value[0]]);
  assert.equal(dropped(value, now), 1);
});

test('an inherited storage grant is absent from the row itself and cannot authorize retention', () => {
  const row: { site: string; may_store?: boolean } = Object.assign(Object.create({ may_store: true }), { site: 'x' });
  assert.deepEqual(storable([row], now), []);
  assert.equal(dropped([row], now), 1);
});

test('a row whose keep_until is null has no time limit and is kept', () => {
  const kept = storable({ results: [{ site: 'poshmark', may_store: true, keep_until: null }, { site: 'x', may_store: false, keep_until: null }] }, Date.parse('2026-11-15T00:00:00Z'));
  assert.deepEqual(kept.results.map(row => row.site), ['poshmark']);
});


test('a refused listing in a single-object slot becomes null, including a root row', () => {
  const row = { site: 'dupe', may_store: false, url: 'https://example.test/refused' };
  const value = { result: row, allowed: { site: 'x', may_store: true }, metadata: { count: 1 } };
  assert.deepEqual(storable(value, now), { ...value, result: null });
  assert.equal(storable(row, now), null);
  assert.equal(dropped(value, now), 1);
  assert.equal(dropped(row, now), 1);
  assert.equal(value.result, row);
});

test('source-keyed rows with rights are filtered in arrays and single-object slots', () => {
  const refused = { source: 'dupe', may_store: false };
  const expired = { source: 'x', may_store: true, keep_until: '2026-11-15T12:00:00Z' };
  const ungranted = { source: 'x', keep_until: null };
  const allowed = { source: 'x', may_store: true, keep_until: null };
  const value = { results: [refused, expired, ungranted, allowed], by_source: { dupe: refused, x: allowed } };
  assert.deepEqual(storable(value, now), { results: [allowed], by_source: { dupe: null, x: allowed } });
  assert.equal(dropped(value, now), 4);
});

test('only searched entries are exempt; nested listing rows still need storage rights', () => {
  const value = { searched: [{ site: 'x', may_store: false, result: { site: 'x' } }], result: { site: 'x' } };
  assert.deepEqual(storable(value, now), { searched: [{ site: 'x', may_store: false, result: null }], result: null });
  assert.equal(dropped(value, now), 2);
});

test('a frame whose root names its site keeps the frame and filters the rows inside it', () => {
  const kept = { site: 'ebay', may_store: true, keep_until: null };
  const refused = { site: 'dupe', may_store: false };
  const frame = { site: 'ebay', product: null, results: [kept, refused], offer: { site: 'x' } };
  assert.deepEqual(storable(frame, now), { site: 'ebay', product: null, results: [kept], offer: null });
  assert.equal(dropped(frame, now), 2);
  assert.equal(storable({ site: 'dupe', may_store: false }, now), null, 'a root that states its own rights is still a row');
});
