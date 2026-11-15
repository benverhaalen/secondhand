import test from 'node:test';
import assert from 'node:assert/strict';
import { productTrend, productSnapshot, priceChange, marketIndex, weeklyDigest, followedProducts } from './market.ts';
import type { SoldComp, IndexProduct, Follow, FollowEvent } from './market.ts';
import type { Fact, Evidence } from '../intel/answer.ts';

const now = new Date('2026-11-14T12:00:00Z');
const day = 86_400_000;
const evidence: Evidence = { source_url: 'https://example.com/sold', read_at: now.toISOString(), snapshot_ref: 'snap', fingerprint: 'row', extractor_version: '1', rights: { may_share: true } };
const context = { now, citation_id: 'cit' };
function rows(product_id: string, price_cents: number, count: number, age: number): SoldComp[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${product_id}-${age}-${i}`, product_id, kind: 'sneakers', price_cents, sold_at: new Date(+now - age * day).toISOString(), site: 'ebay', evidence }));
}
function fact(value: unknown, basis_count = 10): Fact {
  return { name: 'p50', value, guarded: { state: 'shown', basis_count, as_of: now.toISOString(), citation_id: 'cit' }, sources: [evidence] };
}
const hidden: Fact = { name: 'p50', guarded: { state: 'hidden', hide_reason: 'too_few', basis_count: 0, as_of: null, citation_id: null }, sources: [] };
function basket(): IndexProduct[] {
  return Array.from({ length: 10 }, (_, i) => ({ product_id: `p${i}`, weight: i === 0 ? 2 : 1, sales_quarter: 6, current: fact(i === 0 ? 200 : 100), prior: fact(100) }));
}
const follow: Follow = { id: 'f1', user_id: 'u1', product_id: 'p1', state: 'active' };
const priceEvent = (recent = 120, band90 = 0.1, sales = 10): FollowEvent => ({ product_id: 'p1', movement: { p50_recent: fact(recent, sales), p50_prior: fact(100), band90: fact(band90) } });

test('product p50 windows and direction use only the requested product and sold time', () => {
  const input = [...rows('p1', 12000, 10, 2), ...rows('p1', 10000, 10, 20), ...rows('other', 1, 30, 2), ...rows('p1', 1, 20, -1)];
  const trend = productTrend('p1', input, { ...context, band90: 0.1 });
  assert.equal(trend.p50_recent.value, 12000);
  assert.equal(trend.p50_prior.value, 10000);
  assert.equal(trend.change.value, 0.2 - Number.EPSILON / 4);
  assert.equal(trend.direction.value, 'up');
  assert.equal(trend.p50_recent.guarded.basis_count, 10);
  assert.equal(trend.p50_recent.guarded.citation_id, 'cit');
});

test('thin product windows and direction hide too_few without leaking a value', () => {
  const trend = productTrend('p1', rows('p1', 10000, 5, 2), { ...context, band90: 0 });
  for (const f of [trend.p50_recent, trend.p50_prior, trend.change, trend.direction]) {
    assert.equal(f.guarded.state, 'hidden'); assert.equal(f.guarded.hide_reason, 'too_few'); assert.equal(f.value, undefined);
  }
});

test('price direction is held inside its band, missing band hides noise', () => {
  const input = [...rows('p1', 10500, 10, 2), ...rows('p1', 10000, 10, 20)];
  assert.equal(productTrend('p1', input, { ...context, band90: 0.1 }).direction.value, 'held');
  assert.equal(productTrend('p1', input, context).direction.guarded.hide_reason, 'noise');
});

test('stale, too wide, missing provenance and invalid comps never yield an unguarded p50', () => {
  assert.equal(productTrend('p1', rows('p1', 100, 10, 30), context).p50_prior.guarded.hide_reason, 'stale');
  const noEvidence = rows('p1', 100, 10, 2).map(({ evidence: _e, ...r }) => r);
  assert.equal(productTrend('p1', noEvidence, context).p50_recent.guarded.hide_reason, 'source_gap');
  assert.throws(() => productTrend('p1', [{ ...rows('p1', 100, 1, 2)[0]!, price_cents: NaN }], context));
});

test('index per kind states every weight and basis count and recomputes geometrically', () => {
  const out = marketIndex('sneakers', basket(), { ...context, index_id: 'sneakers', basket_version: '1', era: '1', previous_value: 1000 });
  assert.equal(out.kind, 'sneakers'); assert.equal(out.flagged, false);
  assert.equal(out.value.guarded.basis_count, 200);
  assert.ok(Math.abs(Number(out.value.value) - 1000 * 2 ** (2 / 11)) < 1e-9);
  assert.equal(out.weights.length, 10);
  assert.equal(out.weights[0]!.weight, 2);
  assert.equal(out.weights[0]!.effective_weight, 2 / 11);
  assert.ok(out.weights.every(w => w.product_id && w.basis_count > 0));
});

test('thin kind is flagged and hidden too_few: products, quarterly sales, coverage', () => {
  for (const products of [basket().slice(0, 9), basket().map(p => ({ ...p, sales_quarter: 5 })), basket().map((p, i) => i < 6 ? { ...p, current: hidden } : p)]) {
    const out = marketIndex('sneakers', products, { ...context, index_id: 'i', basket_version: '1', era: '1', previous_value: 1000 });
    assert.equal(out.flagged, true); assert.equal(out.value.guarded.hide_reason, 'too_few'); assert.equal(out.value.value, undefined); assert.equal(out.weights.length, products.length);
  }
});

test('missing products are excluded and stated effective weights sum to one', () => {
  const products = basket().map((p, i) => i === 9 ? { ...p, current: hidden } : p);
  const out = marketIndex('sneakers', products, { ...context, index_id: 'i', basket_version: '1', era: '1', previous_value: 900 });
  assert.equal(out.flagged, false); assert.equal(out.weights[9]!.effective_weight, 0);
  assert.ok(Math.abs(out.weights.reduce((s, w) => s + w.effective_weight, 0) - 1) < 1e-12);
});

test('an index without valid weights is never returned', () => {
  for (const weight of [NaN, 0, -1, Infinity]) assert.throws(() => marketIndex('sneakers', [{ ...basket()[0]!, weight }], { ...context, index_id: 'i', basket_version: '1', era: '1', previous_value: 1000 }));
  assert.throws(() => marketIndex('sneakers', [basket()[0]!, basket()[0]!], { ...context, index_id: 'i', basket_version: '1', era: '1', previous_value: 1000 }));
});

test('follow price alert reuses M19 band and ten-sale gate in both directions', () => {
  for (const event of [priceEvent(), priceEvent(80), priceEvent(125, 0.25)]) assert.equal(weeklyDigest('u1', [follow], [event], [], now).digest.length, 1);
  for (const event of [priceEvent(109), priceEvent(120, 0.3), priceEvent(120, 0.1, 9), { ...priceEvent(), movement: { ...priceEvent().movement!, p50_recent: hidden } }]) assert.equal(weeklyDigest('u1', [follow], [event], [], now).digest.length, 0);
});

test('release or restock needs rank 1 or 2; top ten needs two weekly reads', () => {
  for (const event of [{ product_id: 'p1', release: fact({ kind: 'restock', rank: 2 }) }, { product_id: 'p1', riser: fact({ rank: 10, weekly_reads: 2 }) }]) assert.equal(weeklyDigest('u1', [follow], [event], [], now).digest.length, 1);
  for (const event of [{ product_id: 'p1', release: fact({ kind: 'release', rank: 3 }) }, { product_id: 'p1', riser: fact({ rank: 11, weekly_reads: 2 }) }, { product_id: 'p1', riser: fact({ rank: 1, weekly_reads: 1 }) }, { product_id: 'p1', release: hidden }]) assert.equal(weeklyDigest('u1', [follow], [event], [], now).digest.length, 0);
});

test('follows are scoped to the person, active and unmuted; nothing moved no digest', () => {
  const follows: Follow[] = [follow, { ...follow, id: 'f2', user_id: 'u2', product_id: 'p2' }, { ...follow, id: 'f3', product_id: 'p3', state: 'removed' }, { ...follow, id: 'f4', product_id: 'p4', state: 'muted' }];
  assert.deepEqual(followedProducts('u1', follows), ['p1']);
  assert.deepEqual(weeklyDigest('u1', follows, [], [], now).digest, []);
});

test('one mention per person and product per week across duplicate follows, events and runs', () => {
  const follows = [follow, { ...follow, id: 'duplicate' }];
  const first = weeklyDigest('u1', follows, [priceEvent(), priceEvent(80)], [], now);
  assert.equal(first.digest.length, 1);
  assert.equal(weeklyDigest('u1', follows, [priceEvent()], first.mentions, now).digest.length, 0);
  assert.equal(weeklyDigest('u1', follows, [priceEvent()], first.mentions, new Date(+now + 7 * day)).digest.length, 1);
  assert.equal(weeklyDigest('u2', [{ ...follow, user_id: 'u2' }], [priceEvent()], first.mentions, now).digest.length, 1);
});

test('M3 weighted p50, duplicate IDs and window boundaries are reproducible', () => {
  const low = rows('p1', 10000, 10, 2);
  const high = rows('p1', 11000, 10, 2).map(r => ({ ...r, id: `high-${r.id}`, weight: 3 }));
  const boundary = rows('p1', 500, 10, 14);
  const input = [...low, ...high, ...low, ...boundary];
  const trend = productTrend('p1', input, { ...context, band90: 0.1 });
  assert.equal(trend.p50_recent.value, 11000);
  assert.equal(trend.p50_recent.guarded.basis_count, 20);
  assert.equal(trend.p50_prior.guarded.basis_count, 10);
  assert.equal(trend.p50_prior.value, 500);
});

test('M3 p50 hides a wide sold range', () => {
  const input = [100, 1000, 10000].flatMap((price, i) => rows('p1', price, 10, 2).map(r => ({ ...r, id: `${i}-${r.id}` })));
  const out = productTrend('p1', input, context).p50_recent;
  assert.equal(out.guarded.hide_reason, 'too_wide');
  assert.equal(out.value, undefined);
});

test('one digest product includes all passing reasons and respects last_notified_at', () => {
  const event = { ...priceEvent(), release: fact({ kind: 'release', rank: 1 }), riser: fact({ rank: 1, weekly_reads: 2 }) };
  const out = weeklyDigest('u1', [follow], [event], [], now);
  assert.deepEqual(out.digest[0]!.reasons, ['price', 'release', 'riser']);
  assert.equal(weeklyDigest('u1', [{ ...follow, last_notified_at: now.toISOString() }], [event], [], now).digest.length, 0);
  assert.equal(follow.last_notified_at, undefined);
});

test('D1 fast kinds use a 30-day half-life; taxonomy mappings can inject it', () => {
  const input = [...rows('p1', 10000, 10, 2), ...rows('p1', 11000, 10, 20).map(r => ({ ...r, weight: 1.3 }))];
  assert.equal(productSnapshot('p1', input, context).value, 10000);
  assert.equal(productSnapshot('p1', input.map(r => ({ ...r, kind: 'furniture' })), context).value, 11000);
  assert.equal(productSnapshot('p1', input.map(r => ({ ...r, kind: 'taxonomy-id' })), { ...context, half_life_days: 30 }).value, 10000);
});

test('M22 endpoint price changes stay separate from the M19 digest windows', () => {
  const input = [...rows('p1', 12000, 20, 2), ...rows('p1', 10000, 10, 32)];
  const change = priceChange('p1', input, { ...context, days: 30, band90: 0.1 });
  assert.equal(change.p50.value, 12000);
  assert.equal(change.p50_prior.value, 10000);
  assert.equal(change.direction.value, 'up');
  const trend = productTrend('p1', input, { ...context, bands90: { 30: 0.1 } });
  assert.deepEqual(trend.changes.map(c => c.days), [30, 90, 365]);
  assert.equal(trend.changes[0]!.direction.value, 'up');
  assert.equal(trend.changes[1]!.change.guarded.hide_reason, 'too_few');
});
