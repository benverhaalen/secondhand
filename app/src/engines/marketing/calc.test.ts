import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, scoreCandidate, type MarketingInput, type MoneyCandidate } from './calc.ts';
import { memoryStore } from '../param/param.ts';
const as_of = '2026-11-15T00:00:00Z';
export const fixture = (site: MarketingInput['site'] = 'ebay'): MarketingInput => ({
  item: { item_id: 'i1', kind: 'clothing', attrs: { brand: { value: 'Patagonia', source: 'label', confirmed: true }, model: { value: 'Better Sweater', source: 'label', confirmed: true } }, photos: [{ photo_id: 'front', score: .9 }] },
  site, connected: true, category_allowed: true, fit: 'good', category_id: 'jacket', rows: [], objective: 'balanced',
  cover_style: 'flat_lay', position: [3, 8], floor_cents: 4200, midpoint_cents: 5300, adjusted_cents: [4400, 4800, 5100, 5400, 5800, 6200], weights: [1, 1, 1, 1, 1, 1], sales_12m: 38, sales_90d: 38,
  curve: { p: (_p, d) => 1 - Math.exp(-d / 20), t: (_p, q) => -20 * Math.log(1 - q) },
  keep: p => Math.round(.8675 * p - 40), shipping_modes: ['buyer_pays'], ship_cents: 850,
  comp_rows: [{ id: 'c1', source: 'sold:1', at: as_of, price_cents: 4800 }], as_of, params: memoryStore(),
  log: { timed: (_n, fn) => fn() },
});
const example: MoneyCandidate = { candidate_id: '54', objective: 'balanced', horizon_days: 30, shipping_mode: 'buyer_pays', path: [
  { price_cents: 5400, p_sale: .38, net_cents: 4644, at_day: 0 }, { price_cents: 4900, p_sale: .20, net_cents: 4211, at_day: 10 }, { price_cents: 4500, p_sale: .13, net_cents: 3864, at_day: 20 }], expected_days: 14 };
test('worked example selects $54 with $31.09 expected net and $29.61 utility', () => {
  const a = scoreCandidate(example, 1, 5300 * .002);
  assert.equal(a.e_net_cents, 3109); assert.equal(a.utility_cents, 2961);
  const x = fixture(); x.candidates = [example, { ...example, candidate_id: '59', path: [{ price_cents: 5900, p_sale: .25, net_cents: 5078, at_day: 0 }, { price_cents: 5400, p_sale: .20, net_cents: 4644, at_day: 10 }, { price_cents: 4900, p_sale: .14, net_cents: 4211, at_day: 20 }], expected_days: 18 }];
  const p = calculate(x); assert.equal(p.verdict, 'list'); assert.equal(p.price?.start_cents, 5400);
});
test('forbidden lever and missing provenance fail with their cause', () => {
  assert.throws(() => calculate({ ...fixture('poshmark'), requested_levers: ['relist'] }), /forbidden lever/);
  assert.throws(() => calculate({ ...fixture(), comp_rows: [{ id: 'c1', source: '', at: as_of }] }), /basis/);
});
test('planted path and likers offer below the floor cannot execute', () => {
  const x = fixture(); x.candidates = [{ ...example, path: [...example.path, { price_cents: 100, p_sale: .1, net_cents: 1, at_day: 25 }] }];
  const p = calculate(x); assert.equal(p.verdict, 'skip');
  const safe = calculate({ ...fixture('poshmark'), floor_cents: 6100 });
  assert.ok(safe.price?.path.every(r => r.price_cents >= 6100));
  assert.equal(safe.standing?.offers_to_likers.on, false);
  assert.equal(safe.standing?.relist.allowed, false);
});
test('fixed gates and sales minimum abstain before scoring', () => {
  assert.equal(calculate({ ...fixture(), connected: false }).skip_reason, 'not_connected');
  assert.equal(calculate({ ...fixture(), sales_12m: 5, sales_90d: 1 }).price, null);
  assert.equal(calculate({ ...fixture(), category_allowed: false }).skip_reason, 'site_bars_category');
});
test('same inputs reconstruct the same citation and plan', () => {
  const x = fixture(); assert.deepEqual(calculate(x), calculate(x));
});

test('the final price rung keeps selling through the full horizon', () => {
  const x = fixture(); x.adjusted_cents = [5000]; x.weights = [1];
  x.curve = { p: (_p, d) => 1 - Math.exp(-d / 20), t: () => 20 * Math.log(2) };
  const plan = calculate(x);
  assert.equal(plan.verdict, 'list'); assert.ok('scores' in plan); assert.ok(plan.scores); assert.ok(Math.abs(plan.scores.p_sale.d30! - (1 - Math.exp(-30 / 20))) < 1e-9);
});
test('greater visibility lowers holding time using the same survival curve', () => {
  const curve = { p: (_p: number, d: number) => 1 - Math.exp(-d / 20), t: () => 14 };
  const c: MoneyCandidate = { candidate_id: 'one', objective: 'balanced', horizon_days: 30, shipping_mode: 'buyer_pays', path: [{ price_cents: 5000, net_cents: 4000, p_sale: curve.p(5000, 30), at_day: 0 }], expected_days: 16 };
  const base = scoreCandidate(c, 1, 10, curve), visible = scoreCandidate(c, 2, 10, curve);
  assert.ok(visible.expected_days < base.expected_days); assert.ok(visible.p_sale > base.p_sale);
});

test('Poshmark liker offers stay off without the required shipping discount', () => {
  const x = fixture('poshmark');
  assert.equal(calculate(x).standing?.offers_to_likers.on, false);
  assert.equal(calculate({ ...x, shipping_discount_cents: 200 }).standing?.offers_to_likers.on, true);
});
