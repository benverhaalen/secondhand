import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keep, priceForKeep } from './keep.ts';
import { bestSites, ladder, planOf, pricePath, staleStep, type Curve, type StaleInput } from './path.ts';

const noTax = { tax_rate: 0 };

test('D9 worked example: a $20 shirt with $6 buyer-paid shipping keeps $16.06 on eBay and $18.69 on Depop', () => {
  const sale = { ...noTax, buyer_shipping_cents: 600 };
  assert.equal(keep('ebay', 2000, sale).keep_cents, 1606);
  assert.equal(keep('depop', 2000, sale).keep_cents, 1869);
});

test('valuation worked example: keep(48) on eBay with $9 seller shipping, fee on the item only, is $32.07', () => {
  assert.equal(keep('ebay', 4800, { ...noTax, seller_shipping_cents: 900 }).keep_cents, 3207);
});

test('fee rounding is to the cent, once: every keep is a whole number of cents', () => {
  for (let p = 0; p < 20000; p += 37) for (const s of ['ebay', 'depop', 'poshmark', 'mercari', 'facebook'] as const) {
    assert.ok(Number.isInteger(keep(s, p, { buyer_shipping_cents: 599 }).keep_cents));
  }
  assert.throws(() => keep('ebay', 48.5));
});

test('site rules: Poshmark $2.95 under $15, Facebook $0.80 minimum, local free, eBay 2.35% past $7,500', () => {
  assert.equal(keep('poshmark', 1000).keep_cents, 705);
  assert.equal(keep('poshmark', 1500).keep_cents, 1200);
  assert.equal(keep('facebook', 500, noTax).fee_cents, 80);
  assert.equal(keep('facebook_local', 500).keep_cents, 500);
  assert.equal(keep('ebay', 1_000_000, noTax).fee_cents, 102000 + 5875 + 40);
});

test('D13 table: the price that keeps $40 per site, solved from the formula', () => {
  assert.equal(priceForKeep('ebay', 4000, noTax), 4676);
  assert.equal(priceForKeep('depop', 4000, noTax), 4183);
  assert.equal(priceForKeep('poshmark', 4000, noTax), 5000);
  assert.equal(priceForKeep('mercari', 4000, noTax), 4444);
});

test('a fee row older than 30 days says fees may have changed', () => {
  assert.equal(keep('ebay', 4800, { as_of: '2026-11-20' }).fees_may_have_changed, false);
  assert.equal(keep('ebay', 4800, { as_of: '2027-01-01' }).fees_may_have_changed, true);
});

// A falling price-speed curve: half the items sell by 10 days at $40, slower above, faster below.
const curve: Curve = {
  p: (price, days) => Math.min(0.95, (days / (days + 10)) * Math.min(1.5, 4000 / price)),
  t: (price, q) => { const r = Math.min(1.5, 4000 / price); const d = (10 * q) / (r - q); return d > 0 && d <= 90 ? d : null; },
};
const comps = [3000, 3400, 3800, 4000, 4200, 4500, 4800, 5200, 6000];
const w = comps.map(() => 1);

test('D15 ladder runs p10 to p90 on site endings, high to low', () => {
  const l = ladder(comps, w);
  assert.ok(l.length >= 3);
  assert.deepEqual([...l].sort((a, b) => b - a), l);
  for (const p of l) assert.ok(p % 100 === 0 && (p <= 2000 || [5, 8].includes((p / 100) % 10)));
});

test('the path: start, list, floor and always accept, with always accept never under the floor', () => {
  const path = pricePath({ site: 'ebay', rungs: ladder(comps, w), curve, objective: 'balanced', sale: noTax, q90_cents: 6000 });
  assert.ok(path);
  assert.ok(path.floor <= path.always_accept && path.always_accept <= path.ladder[0].price);
  assert.ok(path.list >= path.start && path.list <= 6000);
  assert.ok(path.expected_keep > 0);
});

test('PLANTED: a person floor above the whole ladder holds for start, list and always accept', () => {
  const path = pricePath({ site: 'mercari', rungs: ladder(comps, w), curve, objective: 'quick', q90_cents: 6000, person_floor_cents: 9000 });
  assert.ok(path);
  for (const v of [path.start, path.list, path.floor, path.always_accept]) assert.ok(v >= 9000, `${v} under the floor`);
});

test('no ladder, no suggested price', () => {
  assert.equal(pricePath({ site: 'ebay', rungs: [], curve, objective: 'balanced', q90_cents: 0 }), null);
});

test('quick starts no higher than max_return', () => {
  const at = (o: 'quick' | 'max_return') => pricePath({ site: 'depop', rungs: ladder(comps, w), curve, objective: o, q90_cents: 6000 })!.start;
  assert.ok(at('quick') <= at('max_return'));
});

const stale = (o: Partial<StaleInput>): StaleInput => ({
  site: 'ebay', age_days: 0, m_days: 10, price_cents: 5000, p50_cents: 4200, interest: 1, interest_median: 5,
  next_rung_cents: 4500, floor_cents: 4000, on_sites: ['ebay'], best_sites: ['ebay', 'mercari'], has_watchers_verb: true, ...o,
});

test('D15 stale path: markdown, relist, watchers, next site, then ask', () => {
  assert.deepEqual(staleStep(stale({ age_days: 5 })), { kind: 'none' });
  assert.deepEqual(staleStep(stale({ age_days: 10 })), { kind: 'markdown', price_cents: 4500 });
  assert.deepEqual(staleStep(stale({ age_days: 10, price_cents: 4000 })), { kind: 'relist', ask: false });
  assert.deepEqual(staleStep(stale({ age_days: 10, price_cents: 4000, site: 'poshmark' })), { kind: 'relist', ask: true });
  assert.deepEqual(staleStep(stale({ age_days: 15 })), { kind: 'offer_to_watchers' });
  assert.deepEqual(staleStep(stale({ age_days: 20 })), { kind: 'first_post', site: 'mercari' });
  assert.deepEqual(staleStep(stale({ age_days: 30 })), { kind: 'end_unsold' });
});

test('PLANTED: a markdown never goes under the floor; a next rung below it asks', () => {
  assert.deepEqual(staleStep(stale({ age_days: 10, next_rung_cents: 3500 })), { kind: 'price_below_floor' });
});

test('packet 47 plan choices: reserve builds no path and never goes stale', () => {
  assert.deepEqual(planOf('fast'), { objective: 'quick', path: true, accept_mode: 'auto' });
  assert.deepEqual(planOf('reserve'), { objective: 'max_return', path: false, accept_mode: 'auto' });
  assert.equal(planOf('check').accept_mode, 'ask_all');
  assert.deepEqual(staleStep(stale({ age_days: 40, plan_choice: 'reserve' })), { kind: 'none' });
});

test('D12: a second site joins only when its marginal gain beats the double-sale cost', () => {
  const a = { site: 'ebay' as const, E: 3000, P: 0.6, keep: 3200, cancel_cost: 2500 };
  assert.deepEqual(bestSites([a, { site: 'mercari', E: 2800, P: 0.5, keep: 3300, cancel_cost: 2500 }]), ['ebay', 'mercari']);
  assert.deepEqual(bestSites([a, { site: 'mercari', E: 1, P: 0.0001, keep: 100, cancel_cost: 2500 }]), ['ebay']);
});
