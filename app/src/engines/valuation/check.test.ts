import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, type CheckInput } from './check.ts';
import type { Comp } from './comps.ts';
const as_of = '2026-11-15T00:00:00Z';
const comps: Comp[] = Array.from({ length: 8 }, (_, i) => ({ comp_id: `c${i}`, site: 'ebay', sold_at: '2026-11-10T00:00:00Z', price_cents: 4000 + i * 100, kind: 'sold', level: 'variant', condition: 'good', w_match: 1, w_extract: 1, may_model: true, citation: `source:${i}` }));
const input = (): CheckInput => ({ product_id: 'p1', condition: 'good', as_of, floor_cents: 6000, param_version: 1, objective: 'balanced', warm_comps: comps, sources: [], sites: [{ site: 'ebay', curve: { p: () => .6, t: () => 10 } }], log: { timed: (_n, fn) => fn(), error: () => {} } });
test('stalled source answers from cited warm comps at the budget and aborts work', async () => {
  let aborted = false;
  const x = input(); x.budget_ms = 15;
  x.sources = [signal => { signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); }];
  const start = performance.now(); const out = await check(x);
  assert.ok(performance.now() - start < 250);
  assert.equal(out.basis.count, 8); assert.equal(out.partial, true); assert.equal(aborted, true);
});
test('no comps keeps the rough wide band and its basis, without inventing a path', async () => {
  const x = input(); x.warm_comps = []; x.fast = { low: 2000, high: 9000, n: 24, as_of, basis: 'category', state: 'rough' };
  const out = await check(x);
  assert.equal(out.range.state, 'not_checked_yet'); assert.equal(out.range.q10, 2000);
  assert.equal(out.range.q90, 9000); assert.equal(out.basis.count, 24); assert.equal(out.price_path, null);
});
test('no basis hides all estimated numbers', async () => {
  const x = input(); x.warm_comps = [];
  const out = await check(x); assert.equal(out.range.state, 'hidden'); assert.equal(out.range.q50, null);
});
test('planted high floor beats every price rung and auto accept threshold', async () => {
  const out = await check(input()); assert.ok(out.price_path);
  for (const p of [out.price_path.start, out.price_path.list, out.price_path.always_accept, ...out.price_path.ladder.map(r => r.price)]) assert.ok(p >= 6000);
});
test('a failing source names its error instead of silently becoming thin data', async () => {
  const x = input(); x.sources = [async () => { throw new Error('source failed'); }];
  await assert.rejects(check(x), /source failed/);
});
test('fresh rows merge without duplicate basis and deterministically assemble', async () => {
  const x = input(); x.sources = [async () => comps];
  const a = await check(x), b = await check(x);
  assert.deepEqual(a, b); assert.equal(a.basis.count, 8); assert.ok(a.citation);
});

test('a planted missing comp citation refuses the object instead of returning unbased prices', async () => {
  const x = input(); x.warm_comps = comps.map(c => ({ ...c, citation: '' }));
  await assert.rejects(check(x), /basis/);
});
