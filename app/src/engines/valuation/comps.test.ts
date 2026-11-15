import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, weigh, nEff, backOff, adjust, trim, weightedQuantile, translate, comparables } from './comps.ts';
import type { Comp } from './comps.ts';

const as_of = '2026-11-14T00:00:00Z';
const comp = (comp_id: string, price_cents: number, fields: Partial<Comp> = {}): Comp => ({
  comp_id, price_cents, site: 'ebay', sold_at: as_of, kind: 'sold', level: 'variant',
  condition: 'good', w_match: 1, w_extract: 1, may_model: false, citation: `sale:${comp_id}`, ...fields,
});
const fixture = [4200, 4500, 4800, 5000, 5500, 6000].map((p, i) => comp(String(i), p, { w_match: [0.9, 0.7, 1, 0.8, 0.6, 0.5][i] }));
const family = [4600, 5200].map((p, i) => comp(`family${i}`, p, { level: 'family', w_match: 0.25 }));
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('worked example: 5.70 backs off to 6.80 and cumulative weighted median is exactly 4800 cents', () => {
  close(nEff(weigh(fixture, as_of).map(c => c.w)), 20.25 / 3.55);
  const result = backOff(weigh([...fixture, ...family, comp('category', 7000, { level: 'category' })], as_of));
  assert.equal(result.level, 'family');
  assert.equal(result.comps.length, 8);
  close(result.n_eff, 25 / 3.675);
  assert.equal(weightedQuantile(result.comps.map(c => c.price_cents), result.comps.map(c => c.w), 0.5), 4800);
  assert.deepEqual(comparables({ condition: 'good' }, [...fixture, ...family], as_of).range, { q10: 4200, q50: 4800, q90: 5500 });
});

test('D1: unknown kinds, asks, retail, stale, future, duplicate and zero-match rows never enter', () => {
  const rows = ['asking', 'retail', 'ended_unsold'].map(kind => comp(kind, 1, { kind: kind as Comp['kind'] }));
  const valid = comp('valid', 4800);
  assert.deepEqual(weigh([...rows, comp('old', 4800, { sold_at: '2025-01-01' }), comp('future', 4800, { sold_at: '2027-01-01' }), comp('no-match', 4800, { w_match: 0 }), valid, valid], as_of).map(c => c.comp_id), ['valid']);
});

test('D1: type multiplication, half-life and learned overrides retain may_model false rows', () => {
  const c = comp('own', 4800, { kind: 'own_order', sold_at: '2026-08-16T00:00:00Z', w_match: 0.5, w_extract: 0.7 });
  close(weigh([c], as_of)[0].w, 1.2 * 0.5 * 0.5 * 0.7);
  close(weigh([c], as_of, { ...DEFAULTS, category_speed: 'fast' })[0].w_age, 0.125);
  close(weigh([c], as_of, { ...DEFAULTS, w_type: { ...DEFAULTS.w_type, own_order: 1 } })[0].w_type, 1);
  assert.equal(nEff([]), 0);
  assert.equal(nEff([0, 0]), 0);
});

test('D2/D3: condition and learned size ratios have target/source direction; drift is capped', () => {
  assert.equal(adjust(comp('a', 4000), { condition: 'excellent' }, () => 0), 4400);
  assert.equal(adjust(comp('b', 4400, { condition: 'excellent' }), { condition: 'good' }, () => 0), 4000);
  assert.equal(adjust(comp('c', 4000, { size: 'S' }), { condition: 'good', size: 'M' }, () => 0, { ...DEFAULTS, size_ratios: { S: 1, M: 1.05 } }), 4200);
  assert.equal(adjust(comp('d', 4000), { condition: 'good' }, () => Math.log(2)), 5000);
  assert.equal(adjust(comp('e', 4000), { condition: 'good' }, () => Math.log(0.5)), 3200);
  assert.equal(adjust(comp('offer', 5000, { kind: 'best_offer' }), { condition: 'good' }, () => 0, { ...DEFAULTS, d_offer_cat: 0.1 }), 4500);
});

test('D1: adjustment at 25 percent is kept; beyond it is dropped with its cause', () => {
  const rows = [comp('edge', 4000), comp('beyond', 4000)].map((c, i) => ({ ...c, adjusted_cents: i ? 5001 : 5000 }));
  assert.deepEqual(trim(rows).dropped, [{ comp_id: 'beyond', reason: 'adjustment' }]);
});

test('D1: one wild comp is trimmed before quantiles and cannot move the median', () => {
  const result = comparables({ condition: 'good' }, [...fixture, ...family, comp('wild', 99999999)], as_of);
  assert.deepEqual(result.dropped, [{ comp_id: 'wild', reason: 'outlier' }]);
  assert.equal(result.range.q50, 4800);
  const flat = [1, 2, 3, 4, 5, 6].map(i => comp(String(i), 4800));
  assert.deepEqual(comparables({ condition: 'good' }, [...flat, comp('wild', 99999999)], as_of).dropped, [{ comp_id: 'wild', reason: 'outlier' }]);
});

test('D4: absent site uses family back-off and supported translation with endpoint spread', () => {
  const params = { ...DEFAULTS, site_ratios: { depop: { ratio: 1.1, q25: 1, q75: 1.2, n: 20 } } };
  const result = comparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of, params);
  assert.equal(result.level, 'family');
  assert.equal(result.state, 'ok');
  assert.deepEqual(result.range, { q10: 4200, q50: 5300, q90: 6600 });
  assert.equal(translate(4800, 1.1), 5280);
  assert.equal(comparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of).state, 'too_few');
  assert.equal(comparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of, { ...params, site_ratios: { depop: { ...params.site_ratios.depop, n: 19 } } }).state, 'too_few');
});

test('D1: thin and old-only bases stay too_few; empty quantiles have no invented price', () => {
  assert.equal(comparables({ condition: 'good' }, [], as_of).state, 'too_few');
  const old = Array.from({ length: 8 }, (_, i) => comp(String(i), 4800, { sold_at: '2026-06-01' }));
  assert.equal(comparables({ condition: 'good' }, old, as_of).state, 'too_few');
  assert.equal(weightedQuantile([], [], 0.5), null);
  assert.equal(weightedQuantile([100, 200], [1, 1], 0.5), 100);
  assert.equal(weightedQuantile([100, 200], [0, 1], 0), 200);
});

test('determinism: same inputs give identical objects without mutating candidates or params', () => {
  const candidates = [...fixture, ...family];
  const before = JSON.stringify({ candidates, params: DEFAULTS });
  const first = comparables({ condition: 'good' }, candidates, as_of);
  assert.deepEqual(first, comparables({ condition: 'good' }, candidates, as_of));
  assert.equal(JSON.stringify({ candidates, params: DEFAULTS }), before);
});

test('D4: sufficient own-site sales win; supported parent ratio replaces a thin category ratio', () => {
  const own = Array.from({ length: 6 }, (_, i) => comp(`depop${i}`, 4849, { site: 'depop' }));
  const params = { ...DEFAULTS,
    site_ratios: { depop: { ratio: 2, q25: 2, q75: 2, n: 19 } },
    parent_site_ratios: { depop: { ratio: 1.1, q25: 1, q75: 1.2, n: 20 } },
  };
  const direct = comparables({ condition: 'good', site: 'depop' }, [...fixture, ...family, ...own], as_of, params);
  assert.equal(direct.state, 'ok');
  assert.deepEqual(direct.range, { q10: 4800, q50: 4800, q90: 4800 });
  assert.equal(direct.comps.length, 6);
  assert.equal(comparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of, params).range.q50, 5300);
});

test('D1: back-off adds a coarser level when effective count passes but recent sales do not', () => {
  const old = Array.from({ length: 8 }, (_, i) => comp(`old${i}`, 4800, { sold_at: '2026-06-01' }));
  const recent = family.map(c => ({ ...c, w_match: 1 }));
  const result = backOff(weigh([...old, ...recent], as_of));
  assert.equal(result.level, 'family');
  assert.equal(result.comps.length, 10);
});
