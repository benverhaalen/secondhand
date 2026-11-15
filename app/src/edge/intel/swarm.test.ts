import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableNow, bestByRelation, listingSwarm, mergeSwarm, plannable, type Offer, type SwarmResult } from './swarm.ts';

const SITES = ['ebay', 'poshmark', 'mercari', 'depop', 'facebook'] as const;

test('the merge yields one per_site row per planned site, and a risk block removes its site from planning', () => {
  const r = mergeSwarm(SITES, {
    identity: { product_id: 'pr_1' },
    per_site: { winners: { ebay: [{ id: 'w1' }], depop: [] }, rules_fees: { ebay: { rules: ['r'], fees: { pct: 13.25 } } }, terms: { grailed: ['not planned'] } },
    risk: { blocks: { poshmark: 'brand_rights' }, flags: [] },
  });
  assert.deepEqual(Object.keys(r.per_site), [...SITES]);
  assert.equal(r.per_site.poshmark!.blocked, 'brand_rights');
  assert.deepEqual(plannable(r), ['ebay', 'mercari', 'depop', 'facebook']);
  assert.deepEqual(r.per_site.ebay!.fees, { pct: 13.25 });
  assert.equal(r.product_id, 'pr_1');
});

test('the swarm starts every specialist at once, streams partials, and a late specialist is cut at its deadline', async () => {
  const started: number[] = [], t0 = Date.now(), partials: SwarmResult[] = [];
  const at = (ms: number, v: unknown) => async () => { started.push(Date.now() - t0); await new Promise(r => setTimeout(r, ms)); return v; };
  const r = await listingSwarm({}, SITES, {
    identity: at(10, { product_id: 'pr_1' }), photo_rules: at(5, { ebay: { count: 12 } }), demand: at(500, { d: 1 }),
  }, p => partials.push(p), { identity: 100, comps: 100, winners: 100, terms: 100, photo_rules: 100, rules_fees: 100, demand: 50, risk: 100 });
  assert.ok(started.every(ms => ms < 20), 'all start together');
  assert.equal(partials.length, 3);
  assert.equal(r.demand, null, 'cut at its deadline');
  assert.deepEqual(r.per_site.ebay!.photo_rules, { count: 12 });
});

const o = (x: Partial<Offer> & { id: string }): Offer => ({ site: 'ebay', listing_id: x.id, title: 'levi 501 32x32', price_cents: 4000, route_id: 'r', url: `https://x/${x.id}`,
  condition: 'used_good', relation: 'same_product', shipping_cents: 800, tax_rate: 0.08, ...x });

test('a listing sold between reads is dropped, never shown as available', () => {
  const rows = availableNow([o({ id: 'a' }), o({ id: 'b', listing_id: 'b', sold: true }), o({ id: 'c', listing_id: 'c' })], { soldIds: new Set(['c']), medianShipping: 900 });
  assert.deepEqual(rows.map(r => r.id), ['a']);
});

test('a duplicate across sites merges into one offer, the cheaper delivered copy first', () => {
  const rows = availableNow([
    o({ id: 'e', site: 'ebay', phash: 'f0f0f0f0f0f0f0f0', price_cents: 4000, shipping_cents: 1200 }),
    o({ id: 'p', site: 'poshmark', listing_id: 'p', phash: 'f0f0f0f0f0f0f0f0', price_cents: 4100, shipping_cents: 0 }),
  ], { medianShipping: 900 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.id, 'p');
  assert.deepEqual(rows[0]!.also_on, ['ebay']);
  assert.equal(rows[0]!.delivered_cents, Math.round(4100 * 1.08));
});

test('unknown shipping is priced at the median and marked; one offer per relation and condition', () => {
  const rows = availableNow([o({ id: 'u', shipping_cents: null }), o({ id: 'n', listing_id: 'n', relation: 'same_product', condition: 'new', price_cents: 9000 }), o({ id: 'v', listing_id: 'v', price_cents: 5000 })], { medianShipping: 900 });
  assert.equal(rows.find(r => r.id === 'u')!.shipping_estimated, true);
  assert.deepEqual(bestByRelation(rows).map(r => r.id), ['u', 'n']);
});
