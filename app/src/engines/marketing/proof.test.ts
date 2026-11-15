import { test } from 'node:test';
import assert from 'node:assert/strict';
import levers from '../../../../research/list/ben/levers/levers.json' with { type: 'json' };
import { calculate, sourcedLever, scoreCandidate, type MarketingInput, type Site } from './calc.ts';
import { memoryStore } from '../param/param.ts';

function fixture(site: Site): MarketingInput {
  return { item: { item_id: 'proof_item', kind: 'clothing', attrs: { brand: { value: 'Patagonia', source: 'label', confirmed: true } }, photos: [{ photo_id: 'front', score: 1 }] }, site, connected: true, category_allowed: true, fit: 'good', category_id: 'jacket', rows: [], objective: 'balanced', cover_style: 'flat_lay', position: [3, 8], floor_cents: 4000, midpoint_cents: 5000, adjusted_cents: [4500, 5000, 5500, 6000, 6500, 7000], weights: [1, 1, 1, 1, 1, 1], sales_12m: 20, sales_90d: 20,
    curve: { p: (p, d) => 1 - Math.exp(-d / (p / 300)), t: (p, q) => -p / 300 * Math.log(1 - q) }, keep: p => p * .8, shipping_modes: ['buyer_pays'], ship_cents: 500,
    comp_rows: [{ id: 'sale1', source: 'fixture:sold', at: '2026-11-14T00:00:00Z', price_cents: 5000 }], as_of: '2026-11-15T00:00:00Z', params: memoryStore(), log: { timed: (_n, fn) => fn() } };
}

test('every registry lever has its source; a planted missing source fails', () => {
  for (const site of Object.keys(levers.sites) as Site[]) {
    for (const lever of levers.sites[site].levers) assert.ok(sourcedLever(site, lever.id).source);
  }
  assert.throws(() => sourcedLever('ebay', 'buyer_offer', [{ id: 'buyer_offer', source: '' }]), /missing source/);
});
test('below MIN_SALES no price or lever is used', () => {
  const x = fixture('ebay'); x.sales_12m = 5; x.sales_90d = 1;
  const out = calculate(x); assert.equal(out.price, null); assert.equal(out.standing, null);
});
test('all five plans respect floor and site restrictions and cite reproducible inputs', () => {
  for (const site of Object.keys(levers.sites) as Site[]) {
    const x = fixture(site), out = calculate(x);
    assert.equal(out.verdict, 'list'); assert.ok(out.price?.path.every(r => r.price_cents >= x.floor_cents));
    if (site === 'poshmark') assert.equal(out.standing?.relist.allowed, false);
    if (site === 'facebook') assert.equal(out.standing?.offers_to_likers.on, false);
    assert.deepEqual(out, calculate(x));
  }
});
test('money scoring rejects impossible overlapping sale probabilities', () => {
  assert.throws(() => scoreCandidate({ candidate_id: 'poison', objective: 'balanced', horizon_days: 30, shipping_mode: 'buyer_pays', expected_days: 10, path: [{ price_cents: 5000, net_cents: 4000, p_sale: .8, at_day: 0 }, { price_cents: 4500, net_cents: 3600, p_sale: .8, at_day: 10 }] }, 1, 10), /probability/);
});
test('new comp fingerprint causes a reproducible replan with a new citation', () => {
  const x = fixture('ebay'); const before = calculate(x);
  const after = calculate({ ...x, adjusted_cents: x.adjusted_cents.map(p => p - 400), comp_rows: [...x.comp_rows, { id: 'new_sale', source: 'fixture:sold', at: x.as_of, price_cents: 4600 }] });
  assert.ok('citation_id' in before); assert.ok('citation_id' in after);
  assert.notEqual(after.citation_id, before.citation_id);
  assert.notDeepEqual(after.price, before.price);
});
test('offer Beta updates match the closed form with forgetting', () => {
  const store = memoryStore(); store.declare({ name: 'offer_accept', family: 'beta', prior: { alpha: 2, beta: 2 } });
  const at = '2026-11-15';
  store.observe('offer_accept', {}, { success: 1, weight: 1 }, at);
  store.observe('offer_accept', {}, { success: 0, weight: 1, days_since_last: 30 }, at);
  const got = store.read('offer_accept', {}).value as { alpha: number; beta: number };
  assert.deepEqual(got, { alpha: 1.5, beta: 2 }, 'marketing §3.5 requires a 30-day half-life on old counts; shared registry uses 0.5^(days/30)');
});
