import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./orders/', import.meta.url));
const PINNED = { version: 1, sha256: '8646a07848e7eac7fea7508dc542a70898e0fcf69425101f5f1518714bf907d5' };
const read = (f) => JSON.parse(fs.readFileSync(dir + f, 'utf8'));
const manifest = read('manifest.json'), orders = read('orders.json'), listings = read('listings.json'), expected = read('expected.json');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(dir + f)).digest('hex');
const SITES = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];

// Reference arithmetic the analytics and sold tasks must agree with (platform-analytics step 4).
export function reference(orders, listings) {
  const sales = orders.filter((o) => o.kind === 'sale' && o.state !== 'cancelled');
  const kept = (o) => (o.payout_cents == null ? null : o.payout_cents - o.lines.filter((l) => ['label', 'promotion_spend'].includes(l.kind)).reduce((s, l) => s + l.amount_cents, 0));
  const per_order_kept_cents = Object.fromEntries(sales.map((o) => [o.id, kept(o)]));
  const per_site = {};
  for (const o of sales) {
    const s = (per_site[o.site] ??= { sales: 0, kept_cents: 0, kept_unknown: 0, days_to_sell: [] });
    s.sales++;
    const k = per_order_kept_cents[o.id];
    k == null ? s.kept_unknown++ : (s.kept_cents += k);
    const l = listings.find((x) => x.id === o.listing_id);
    if (l.ended_at) s.days_to_sell.push((Date.parse(l.ended_at) - Date.parse(l.posted_at)) / 864e5);
  }
  const soldItems = new Set(sales.map((o) => o.item_id));
  const censored_listing_ids = listings.filter((l) => l.state === 'ended' && soldItems.has(l.item_id) && !sales.some((o) => o.listing_id === l.id)).map((l) => l.id);
  return { per_order_kept_cents, per_site, censored_listing_ids };
}

test('hash pinned: a changed fixture needs a new version and a new pin', () => {
  assert.equal(manifest.version, PINNED.version, 'version moved: update PINNED with the new hash');
  for (const [f, h] of Object.entries(manifest.sha256)) assert.equal(sha(f), h, `${f} changed without a manifest update`);
  assert.equal(dirHash(dir), PINNED.sha256, 'fixture bytes changed: bump version and re-pin');
});

test('rows use the order and listing names from product.md and cover every site and the edge states', () => {
  for (const o of orders) {
    for (const k of ['id', 'kind', 'item_id', 'site', 'state', 'price_cents', 'fees_cents', 'shipping_cents', 'lines', 'clocks', 'external_order_id']) assert.ok(k in o, `${o.id} ${k}`);
    assert.match(o.id, /^ord_/);
    assert.ok(['sale', 'purchase'].includes(o.kind) && SITES.includes(o.site));
    for (const l of o.lines) assert.ok(Number.isInteger(l.amount_cents) && ['site_report', 'computed', 'estimated'].includes(l.source));
  }
  assert.equal(new Set(orders.map((o) => `${o.site}/${o.external_order_id}`)).size, orders.length, 'unique (site, external_order_id)');
  assert.deepEqual([...new Set(orders.filter((o) => o.kind === 'sale').map((o) => o.site))].sort(), [...SITES].sort());
  assert.ok(orders.some((o) => o.state === 'cancelled') && orders.some((o) => o.kind === 'purchase') && orders.some((o) => o.kind === 'sale' && o.payout_cents == null && o.state !== 'cancelled'));
});

test('expected answer beside the input: kept per order, per site, days to sell, censored listings', () => {
  const r = reference(orders, listings);
  assert.deepEqual(r.per_order_kept_cents, expected.per_order_kept_cents);
  assert.deepEqual(r.per_site, expected.per_site);
  assert.deepEqual(r.censored_listing_ids, expected.censored_listing_ids);
  assert.equal(expected.per_order_kept_cents.ord_fx1, 3550);
  assert.equal(expected.per_order_kept_cents.ord_fx7, null, 'an unreported payout is unknown, not zero');
  assert.deepEqual(expected.censored_listing_ids, ['ls_fx2e']);
});

test('no PII: no email, phone, street, token or location in any file', () => {
  for (const f of filesUnder(dir, '.json')) assert.deepEqual(piiHits(fs.readFileSync(f, 'utf8')), [], f);
  assert.ok(!orders.some((o) => 'buyer' in o || 'address' in o || 'name' in o), 'no person fields on an order');
});

test('planted PII is caught', () => {
  assert.ok(piiHits('{"buyer":"jane.doe@example.com"}').includes('email'));
  assert.ok(piiHits('ship to 42 Maple Street').length > 0);
});
