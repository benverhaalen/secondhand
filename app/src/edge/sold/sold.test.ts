import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPublicPage, publicCheck, confirm, LADDER } from './sold.ts';
import { memoryStore, fakeHarness } from '../events/ports.ts';
import { orderBook } from '../orders/orders.ts';
import type { ItemListing } from '../delist/delist.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const log = () => createLog({ src: 'test', build: 'test', sink: memorySink() });
const jsonld = (a: string) => `<html><script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","availability":"https://schema.org/${a}"}}</script></html>`;
const listings: ItemListing[] = [
  { listing_id: 'L-posh', item_id: 'i1', site: 'poshmark', account_id: 'a-posh', state: 'live' },
  { listing_id: 'L-ebay', item_id: 'i1', site: 'ebay', account_id: 'a-ebay', state: 'live' },
  { listing_id: 'L-dep', item_id: 'i1', site: 'depop', account_id: 'a-dep', state: 'live' },
];
const job = { user_id: 'u1', site: 'poshmark' as const, account_id: 'a-posh', listing_id: 'L-posh', item_id: 'i1', trace_id: 't1' };

test('public page readings: JSON-LD, the meta tag, the banner', () => {
  assert.equal(readPublicPage(jsonld('SoldOut')).state, 'sold');
  assert.equal(readPublicPage(jsonld('InStock')).state, 'live');
  assert.equal(readPublicPage('<meta property="product:availability" content="oos">').state, 'sold');
  assert.equal(readPublicPage('<meta content="in stock" property="product:availability">').state, 'live');
  assert.equal(readPublicPage('<h2>This item is sold, check out other similar items</h2>').state, 'sold');
});

test('a bot wall is unknown, never sold or live', () => {
  assert.deepEqual(readPublicPage('Just a moment...', 403), { state: 'unknown', why: 'bot_wall' });
  assert.equal(readPublicPage('<div id="cf-chl-widget"></div>' + jsonld('SoldOut')).state, 'unknown');
  assert.equal(readPublicPage('', 404).state, 'unknown');
});

test('a public sold mark writes one listing.sold event and one poll_orders job, twice read', async () => {
  const s = memoryStore(), f = async () => ({ status: 200, text: jsonld('SoldOut') });
  const l = { ...job, url: 'https://poshmark.com/listing/x' };
  await publicCheck(s, log(), f, l); await publicCheck(s, log(), f, l);
  assert.equal(s.events().length, 1);
  assert.deepEqual(s.jobs().map(j => j.kind), ['poll_orders']);
  assert.equal(s.jobs({ kind: 'delist' }).length, 0); // nothing acts on the public mark alone
});

test('public page shows sold falsely: the signed-in read confirms first, no delist', async () => {
  const s = memoryStore(), h = fakeHarness({ 'poshmark:read_orders': () => ({ ok: true, data: { orders: [] }, meta: { route_id: 'f', ms: 1, fell_back: false } }) });
  const r = await confirm({ store: s, log: log(), harness: h, orders: orderBook(), listingsOf: () => listings }, job);
  assert.equal(r.outcome, 'not_sold');
  assert.equal(s.jobs({ kind: 'delist' }).length, 0);
});

test('a confirmed sale records the order and delists the other sites', async () => {
  const s = memoryStore(), orders = orderBook();
  const h = fakeHarness({ 'poshmark:read_orders': () => ({ ok: true, data: { orders: [{ external_order_id: 'P1', listing_id: 'L-posh', state: 'paid', price_cents: 5000, fees_cents: 1000, shipping_cents: 0 }] }, meta: { route_id: 'f', ms: 1, fell_back: false } }) });
  const r = await confirm({ store: s, log: log(), harness: h, orders, listingsOf: () => listings }, job);
  assert.equal(r.outcome, 'sold');
  assert.deepEqual(s.jobs({ kind: 'delist' }).map(j => j.site).sort(), ['depop', 'ebay']);
  assert.equal(orders.all().length, 1);
  assert.equal(h.calls[0].args.account_id, 'a-posh'); // the read ran in the person's signed-in session
});

test('a background job stalls waiting for the person: never prompts, it pauses', async () => {
  const s = memoryStore();
  const h = fakeHarness({ 'poshmark:read_orders': () => ({ ok: false, error: { code: 'auth_expired', message: 'login wall', hint: { do: 'relink' } }, meta: { route_id: 'f', ms: 1, fell_back: false } }) });
  const r = await confirm({ store: s, log: log(), harness: h, orders: orderBook(), listingsOf: () => listings }, job);
  assert.equal(r.outcome, 'paused');
  assert.equal(s.decisions().length, 0); // the relink decision is as-1's, raised once per account, not here
});

test('the ladder: a public route is used only as a trigger, every site confirms signed in or from our own state', () => {
  for (const [site, rung] of Object.entries(LADDER)) {
    if (rung.trigger === 'public_page') assert.equal(rung.confirm, 'read_orders', site);
    if (site === 'facebook') assert.equal(rung.confirm, 'appointment_done');
  }
});
