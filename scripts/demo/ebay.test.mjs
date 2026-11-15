import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appToken, ebayReader, facts, row } from './ebay.mjs';
import { trial } from './alert-trial.mjs';

const want = JSON.parse(readFileSync(new URL('./wants/brewers-jersey.json', import.meta.url), 'utf8'));
// The shapes of Browse's item_summary and item (field names from eBay's method pages; values made up).
const summary = (id, title, price, created) => ({ itemId: `v1|${id}|0`, legacyItemId: id, title, price: { value: String(price), currency: 'USD' },
  itemWebUrl: `https://www.ebay.com/itm/${id}`, itemCreationDate: created, shippingOptions: [{ shippingCost: { value: '5.00', currency: 'USD' } }] });
const item = (s, aspects) => ({ ...s, localizedAspects: Object.entries(aspects).map(([name, value]) => ({ type: 'STRING', name, value })),
  estimatedAvailabilities: [{ estimatedAvailabilityStatus: 'IN_STOCK' }] });

test('appToken: one token request, cached until a minute before it expires', async () => {
  let calls = 0, t = 0;
  const fetchFn = async (url, o) => { calls++; assert.match(o.headers.Authorization, /^Basic /); return { ok: true, status: 200, json: async () => ({ access_token: `tok${calls}`, expires_in: 7200 }) }; };
  const token = appToken({ clientId: 'id', clientSecret: 'secret', fetchFn, now: () => t });
  assert.equal(await token(), 'tok1');
  t = 7_000_000; assert.equal(await token(), 'tok1');
  t = 7_200_000; assert.equal(await token(), 'tok2');
});

test("row and facts: eBay's creation time, and its Department and Product decide the cut and the kind", () => {
  const s = summary('111', 'Milwaukee Brewers Jersey', 45, '2026-11-15T09:00:00.000Z');
  assert.deepEqual([row(s).price, row(s).shipping, row(s).published_at], [45, 5, Date.parse('2026-11-15T09:00:00Z')]);
  const f = facts(item(s, { Size: 'L', Department: 'Boys', Product: 'Jersey' }));
  assert.deepEqual([f.size, f.department, f.category, f.jsonld_price, f.available], ['L', 'Kids', 'Jerseys', 45, true]);
  assert.equal(facts(item(s, { Department: 'Unisex Adult' })).department, 'Unisex');
});

test('trial on eBay: seeds silently, times the new jersey from its creation, and the price-only rule pings a boys jersey too', async () => {
  let t = Date.parse('2026-11-15T09:00:00Z'), reads = 0;
  const old = summary('100', 'Old Brewers Jersey', 80, '2026-11-14T09:00:00.000Z');
  const fits = summary('101', 'Milwaukee Brewers Majestic Jersey', 45, '2026-11-15T09:00:30.000Z');
  const boys = summary('102', 'Brewers Jersey', 20, '2026-11-15T09:00:35.000Z');
  const pages = [[old], [old], [boys, fits, old]];
  const items = { [fits.itemId]: item(fits, { Size: 'XL', Department: 'Men', Product: 'Jersey' }), [boys.itemId]: item(boys, { Size: 'L', Department: 'Boys', Product: 'Jersey' }) };
  const fetchFn = async url => {
    if (url.includes('/item_summary/search')) { assert.match(url, /sort=newlyListed/); return { ok: true, status: 200, json: async () => ({ itemSummaries: pages[Math.min(reads++, 2)] }) }; }
    const id = decodeURIComponent(url.split('/item/')[1]);
    return { ok: true, status: 200, json: async () => items[id] };
  };
  const readers = { ebay: ebayReader({ token: async () => 'tok', fetchFn }) };
  const out = mkdtempSync(join(tmpdir(), 'trial-'));
  const s = await trial({ want, searches: [{ name: want.search, site: 'ebay', q: 'brewers jersey' }], every_s: 20, for_min: 1, out, readers,
    now: () => t, sleep: async ms => { t += ms; }, say: () => {} });
  const b = s.per[want.search];
  assert.equal(b.want_alerts, 1);
  assert.equal(b.price_only_alerts, 2);
  assert.equal(b.price_only_alerts_that_do_not_fit, 1);
  assert.equal(b.seconds_listed_to_seen.n, 2);
  assert.equal(b.missed, 0);
});
