import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, type CheckInput } from './check.ts';
import type { Comp } from './comps.ts';
import { MARKS } from './posture.ts';
import { planOf, weightedPercentile } from './path.ts';
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

test('unsupported fee sites are refused at the Check boundary', async () => {
  const x = input(); x.sites = [{ site: 'facebook_local', curve: x.sites[0].curve }];
  await assert.rejects(check(x), /unsupported valuation site/);
});

test('F8: fractional conformal widening produces whole cent range endpoints', async () => {
  const out = await check({ ...input(), calibration: { Q_g: 12.4, group: 'jacket', coverage: .8, passes: true } });
  assert.ok(Number.isInteger(out.range.q10)); assert.ok(Number.isInteger(out.range.q90));
});

const modeInput = (): CheckInput => ({ ...input(), floor_cents: 0,
  warm_comps: Array.from({ length: 30 }, (_, i) => ({ ...comps[0], comp_id: `mode${i}`, price_cents: 20500 + i * 1000 })),
});

test('modes use the posture quantiles of the kept adjusted sold basis', async () => {
  const out = await check(modeInput());
  assert.ok(out.modes);
  assert.ok(out.modes.fast.ask_cents < out.modes.sell.ask_cents);
  assert.ok(out.modes.sell.ask_cents < out.modes.best.ask_cents);
  for (const mode of ['fast', 'sell', 'best'] as const) {
    const mark = MARKS[planOf(mode).objective];
    assert.equal(out.modes[mode].ask_cents, weightedPercentile(out.comps.map(c => c.adjusted_cents), out.comps.map(c => c.w), .2 + .65 * mark));
    assert.equal(out.modes[mode].per_site.length, 1);
  }
  assert.notEqual(out.modes.fast.ask_cents, out.range.q10);
});

test('modes without a fitted curve have no probability, days or price path', async () => {
  const x = modeInput(); x.sites = [{ site: 'ebay' }];
  const out = await check(x);
  assert.ok(out.modes);
  for (const mode of Object.values(out.modes)) {
    assert.equal(mode.p_sale_30, null); assert.equal(mode.days_t50, null);
  }
  assert.equal(out.per_site[0].p_sale, null); assert.equal(out.per_site[0].days, null);
  assert.equal(out.price_path, null);
  const fitted = await check(modeInput());
  assert.equal(typeof fitted.modes!.sell.p_sale_30, 'number');
  assert.equal(typeof fitted.modes!.sell.days_t50, 'number');
});

test('a floor above fast holds the mode at the floor', async () => {
  const x = modeInput(); x.floor_cents = 35000;
  const out = await check(x);
  assert.equal(out.modes!.fast.ask_cents, 35000);
  assert.equal(out.modes!.fast.held_by, 'floor');
});

test('too few comps hides the modes', async () => {
  const x = modeInput(); x.warm_comps = x.warm_comps.slice(0, 2);
  assert.equal((await check(x)).modes, null);
});

test('each mode selects the site with the highest keep and retains every site point', async () => {
  const x = modeInput();
  x.warm_comps.push(...x.warm_comps.map(c => ({ ...c, comp_id: `fb:${c.comp_id}`, site: 'facebook' as const })));
  x.sites.push({ site: 'facebook', curve: x.sites[0].curve });
  const out = await check(x);
  for (const mode of Object.values(out.modes!)) {
    assert.equal(mode.site, 'facebook'); assert.equal(mode.per_site.length, 2);
    assert.equal(mode.keep_cents, Math.max(...mode.per_site.map(p => p.keep_cents)));
  }
});
