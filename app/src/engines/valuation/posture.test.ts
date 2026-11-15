import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Curve } from './path.ts';
import { ceiling, pointOnSite, MARKS, OPENS_AT, slider, stance, ticks, type PostureInput, type SiteInput } from './posture.ts';

const curve: Curve = {
  p: (price, days) => Math.min(0.95, (days / (days + 10)) * Math.min(1.5, 4000 / price)),
  t: (price, q) => { const r = Math.min(1.5, 4000 / price); const d = (10 * q) / (r - q); return d > 0 && d <= 90 ? d : null; },
};
const sold = [3000, 3400, 3800, 4000, 4200, 4500, 4800, 5200, 6000].map((p, i) => ({ price_cents: p, w: 1, sold_at: `2026-10-${10 + i}` }));
const site = (o: Partial<SiteInput> = {}): SiteInput => ({ site: 'ebay', sold, top: [], curve, offer_discount: 0.1, sale: { tax_rate: 0 }, ...o });
const input = (o: Partial<PostureInput> = {}): PostureInput => ({
  sites: [site()], floor_cents: 2500, as_of: '2026-11-14',
  retail: [{ source: 'brand.com', price_cents: 9000, in_stock: true, url: 'https://brand.example' }], discounts: [], ...o,
});

test('the slider opens at the middle and marks quick 0.15, balanced 0.5, max_return 0.85', () => {
  assert.equal(OPENS_AT, 0.5);
  assert.deepEqual(MARKS, { quick: 0.15, balanced: 0.5, max_return: 0.85 });
  assert.equal(slider(input()).posture, 0.5);
});

test('the ask rises with the posture; at 0 the price is the ask, with no offer room', () => {
  const at = (t: number) => slider(input(), t).sites[0].point!;
  assert.ok(at(0).ask_cents <= at(0.5).ask_cents && at(0.5).ask_cents <= at(1).ask_cents);
  assert.equal(at(0).list_cents, at(0).ask_cents);
  assert.ok(at(1).list_cents > at(1).ask_cents);
  const low = at(0).p_sale_30, high = at(1).p_sale_30;
  assert.ok(low !== null && high !== null && low >= high);
});

test('each point gives the ask per site, the keep, the chance of sale and the days', () => {
  const p = slider(input({ sites: [site(), site({ site: 'mercari' })] }), 0.3).sites.map(s => s.point!);
  for (const x of p) for (const k of ['ask_cents', 'list_cents', 'keep_cents', 'p_sale_30'] as const) assert.equal(typeof x[k], 'number');
  assert.deepEqual(p.map(x => x.site), ['ebay', 'mercari']);
});

test('PLANTED: slider at 0 with the floor above the whole sold range holds the floor', () => {
  const p = slider(input({ floor_cents: 7000 }), 0).sites[0].point!;
  assert.equal(p.ask_cents, 7000);
  assert.ok(p.list_cents >= 7000);
  assert.equal(p.held_by, 'floor');
});

test('PLANTED: no slider point anywhere prices under the floor or over the ceiling', () => {
  for (let i = 0; i <= 100; i++) {
    const t = i / 100, floor = 2000 + ((i * 731) % 5000);
    const s = slider(input({ floor_cents: floor, sites: [site({ top: [{ site: 'ebay', price_cents: 1500 + i * 40, url: 'x' }] })] }), t);
    const p = s.sites[0].point!;
    assert.ok(p.ask_cents >= floor && p.list_cents >= floor, `t ${t}: under the floor`);
    if (floor <= 9000) assert.ok(p.list_cents <= 9000, `t ${t}: over the ceiling`);
  }
});

test('a credible discount lowers the ceiling; one that ended, or a rumour, does not', () => {
  const retail = [{ source: 'brand.com', price_cents: 9000, in_stock: true, url: 'x' }];
  assert.equal(ceiling(retail, [{ source: 'brand.com', credible: true, price_cents: 4400, ends_at: '2026-11-30' }], '2026-11-14')!.cents, 4400);
  assert.equal(ceiling(retail, [{ source: 'brand.com', credible: true, price_cents: 4400, ends_at: '2026-11-01' }], '2026-11-14')!.cents, 9000);
  assert.equal(ceiling(retail, [{ source: 'forum', credible: false, price_cents: 1000 }], '2026-11-14')!.cents, 9000);
  const p = slider(input({ discounts: [{ source: 'brand.com', credible: true, price_cents: 4400 }] }), 1).sites[0].point!;
  assert.ok(p.list_cents <= 4400);
  assert.equal(p.held_by, 'ceiling');
});

test('out of stock new means no ceiling', () => {
  assert.equal(ceiling([{ source: 'brand.com', price_cents: 3000, in_stock: false, url: 'x' }], [], '2026-11-14'), null);
});

test('at 0 the ask sits under the cheapest comparable top listing', () => {
  const p = slider(input({ sites: [site({ top: [{ site: 'ebay', price_cents: 3200, url: 'a' }, { site: 'ebay', price_cents: 5000, url: 'b' }] })] }), 0).sites[0].point!;
  assert.ok(p.ask_cents < 3200);
});

test('sold prices land on the track as ticks with the count and dates', () => {
  const t = ticks(sold);
  assert.equal(t.count, 9);
  assert.equal(t.from, '2026-10-10');
  assert.equal(t.to, '2026-10-18');
  assert.ok(t.ticks.every((x, i, a) => i === 0 || x.position >= a[i - 1].position));
});

test('the negotiation stance: midpoint counter at balanced; no counter under the floor at the hard end', () => {
  assert.equal(stance(0.5).counter_share, 0.5);
  assert.equal(stance(0).accept_line_share, 0);
  assert.equal(stance(1).counter_under_floor_offers, false);
  assert.equal(stance(0.15).counter_under_floor_offers, true);
});

test('signal rows: top listings, official listings and credible discounts only', () => {
  const s = slider(input({ discounts: [{ source: 'forum', credible: false, price_cents: 100 }], sites: [site({ top: [{ site: 'ebay', price_cents: 4000, url: 'a' }] })] }));
  assert.equal(s.signals.top_listings.length, 1);
  assert.equal(s.signals.retail_offers.length, 1);
  assert.equal(s.signals.discounts.length, 0);
});

test('a site without a curve prices the point without inventing sale speed', () => {
  const p = pointOnSite(site({ curve: undefined }), MARKS.balanced, 0, null)!;
  assert.equal(p.p_sale_30, null); assert.equal(p.days_t50, null);
  const fitted = pointOnSite(site(), MARKS.balanced, 0, null)!;
  assert.equal(typeof fitted.p_sale_30, 'number'); assert.equal(typeof fitted.days_t50, 'number');
});
