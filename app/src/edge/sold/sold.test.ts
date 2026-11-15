import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPublicPage, publicCheck, confirm, LADDER } from './sold.ts';
import { memoryStore, fakeHarness, type Store } from '../events/ports.ts';
import { orderBook } from '../orders/orders.ts';
import { confirmedOrder, type ItemListing } from '../delist/delist.ts';
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
  // a real Poshmark sold page loads a captcha script and is still read (observed 2026-11-14)
  assert.equal(readPublicPage('<script src="/recaptcha.js"></script>' + jsonld('OutOfStock')).state, 'sold');
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
  if (r.outcome !== 'sold') throw new Error('expected a confirmed sale');
  assert.equal(s.get('order', job.user_id, r.order.id)?.external_order_id, 'P1', 'confirm must persist the order outside the watcher');
  for (const delist of s.jobs({ kind: 'delist' })) {
    assert.equal(delist.args.order_id, r.order.id, 'every delist must carry the confirmed order id');
    assert.equal(delist.args.sold_listing_id, job.listing_id, 'every delist must name the sold listing');
    assert.ok(confirmedOrder(s, delist), 'the persisted order must authorize the delist');
  }
  for (const event of s.events()) assert.equal(event.payload?.order_id, r.order.id, 'the event must preserve the order authorizing it');
  assert.equal(h.calls[0].args.account_id, 'a-posh'); // the read ran in the person's signed-in session
});

const saleHarness = () => fakeHarness({ 'poshmark:read_orders': () => ({ ok: true, data: { orders: [
  { external_order_id: 'P1', listing_id: 'L-posh', state: 'paid', price_cents: 5000, fees_cents: null, shipping_cents: 0 },
] }, meta: { route_id: 'f', ms: 1, fell_back: false } }) });

test('confirmation persists the order even when there are no other listings to delist', async () => {
  const store = memoryStore();
  const result = await confirm({ store, log: log(), harness: saleHarness(), orders: orderBook(), listingsOf: () => [] }, job);
  assert.equal(result.outcome, 'sold');
  assert.equal(store.rows('order', { user_id: job.user_id }).length, 1, 'an empty fan-out must still persist the sale');
  assert.equal(store.jobs().length, 0);
});

test('confirmation and replay after restart preserve the durable order id without duplicating delists', async () => {
  const store = memoryStore();
  store.put('order', { id: 'ord_existing', user_id: job.user_id, site: job.site, external_order_id: 'P1', kind: 'sale',
    item_id: job.item_id, listing_id: job.listing_id, state: 'paid' });
  for (let restart = 0; restart < 2; restart++) {
    const orders = orderBook();
    const result = await confirm({ store, log: log(), harness: saleHarness(), orders, listingsOf: () => listings }, job);
    if (result.outcome !== 'sold') throw new Error('expected a confirmed sale');
    assert.equal(result.order.id, 'ord_existing', 'a restarted order book must reuse the durable order id');
    assert.equal(orders.all()[0].id, result.order.id);
    assert.equal(store.rows('order', { user_id: job.user_id }).length, 1, 'the same external order must have one durable row');
    for (const delist of store.jobs()) assert.ok(confirmedOrder(store, delist));
  }
  assert.equal(store.jobs().length, 2, 'repeated confirmation must not double the delist jobs');
});

test('a fresh order book cannot overwrite an unrelated durable order', async () => {
  const store = memoryStore();
  store.put('order', { id: 'ord_1', user_id: job.user_id, site: job.site, external_order_id: 'older', kind: 'sale' });
  const result = await confirm({ store, log: log(), harness: saleHarness(), orders: orderBook(), listingsOf: () => listings }, job);
  if (result.outcome !== 'sold') throw new Error('expected a confirmed sale');
  assert.equal(store.get('order', job.user_id, 'ord_1')?.external_order_id, 'older', 'ordinal ids from a fresh book must not replace another order');
  assert.equal(store.rows('order', { user_id: job.user_id }).length, 2);
});

test('a stale paid read after restart preserves the released order, payout and history', async () => {
  const store = memoryStore(), orders = orderBook();
  const history = [{ state: 'paid' as const, at: '2026-11-14T00:00:00Z' }, { state: 'released' as const, at: '2026-11-15T00:00:00Z' }];
  const saved = { id: 'ord_released', user_id: job.user_id, site: job.site, external_order_id: 'P1', kind: 'sale' as const,
    item_id: job.item_id, listing_id: job.listing_id, state: 'released' as const, price_cents: 5000, fees_cents: 1000,
    shipping_cents: 0, payout_cents: 4000, payout_recorded_at: '2026-11-15T00:00:00Z', history };
  store.put('order', saved);
  const result = await confirm({ store, log: log(), harness: saleHarness(), orders, listingsOf: () => listings }, job);
  if (result.outcome !== 'sold') throw new Error('expected a confirmed sale');
  assert.deepEqual(result.order, saved, 'a stale signed-in read must not replace durable state or money');
  assert.deepEqual(orders.all()[0], saved, 'the caller order book must retain the durable history');
  assert.equal(store.get('order', job.user_id, saved.id)?.state, 'released');
});

for (const state of ['cancelled', 'refunded'] as const) test(`a stale paid read cannot revive a durable ${state} order or authorize delists`, async () => {
  const store = memoryStore();
  store.put('order', { id: 'ord_closed', user_id: job.user_id, site: job.site, external_order_id: 'P1', kind: 'sale',
    item_id: job.item_id, listing_id: job.listing_id, state, price_cents: 5000, fees_cents: null, shipping_cents: 0,
    history: [{ state, at: '2026-11-15T00:00:00Z' }] });
  const result = await confirm({ store, log: log(), harness: saleHarness(), orders: orderBook(), listingsOf: () => listings }, job);
  assert.equal(result.outcome, 'not_sold');
  assert.equal(store.get('order', job.user_id, 'ord_closed')?.state, state, 'a terminal order must not become paid again');
  assert.equal(store.jobs().length, 0, 'a terminal order cannot authorize delists');
});

test('a newly reported refund persists before existing delist authorization is checked', async () => {
  const store = memoryStore();
  await confirm({ store, log: log(), harness: saleHarness(), orders: orderBook(), listingsOf: () => listings }, job);
  const harness = fakeHarness({ 'poshmark:read_orders': () => ({ ok: true, data: { orders: [
    { external_order_id: 'P1', listing_id: 'L-posh', state: 'refunded', price_cents: 5000, fees_cents: null, shipping_cents: 0 },
  ] }, meta: { route_id: 'f', ms: 1, fell_back: false } }) });
  await confirm({ store, log: log(), harness, orders: orderBook(), listingsOf: () => listings }, job);
  assert.equal(store.rows('order', { user_id: job.user_id })[0].state, 'refunded', 'a reported refund must reach the durable order');
  for (const delist of store.jobs()) assert.equal(confirmedOrder(store, delist), false, 'a refunded order cannot authorize its queued delists');
});

test('retry after a rolled-back release cannot persist a payout on the durable paid order', async () => {
  const store = memoryStore(), orders = orderBook();
  await confirm({ store, log: log(), harness: saleHarness(), orders, listingsOf: () => [] }, job);
  const harness = fakeHarness({ 'poshmark:read_orders': () => ({ ok: true, data: { orders: [
    { external_order_id: 'P1', listing_id: 'L-posh', state: 'released', price_cents: 5000, fees_cents: 1000, shipping_cents: 0, payout_cents: 4000 },
  ] }, meta: { route_id: 'f', ms: 1, fell_back: false } }) });
  const failing: Store = { ...store, tx: fn => store.tx(t => fn({ ...t, insertJob() { throw new Error('release fan-out failed'); } })) };
  await assert.rejects(confirm({ store: failing, log: log(), harness, orders, listingsOf: () => listings }, job), /release fan-out failed/);
  await confirm({ store, log: log(), harness: saleHarness(), orders, listingsOf: () => listings }, job);
  const saved = store.rows('order', { user_id: job.user_id })[0];
  assert.equal(saved.state, 'paid');
  assert.equal(saved.payout_cents, undefined, 'a failed release must not leak its payout into a retry');
  assert.equal(saved.payout_recorded_at, undefined, 'a failed release must not mark the paid order settled');
});

test('a failed delist insert rolls back the order and all fan-out writes, then a retry succeeds', async () => {
  const store = memoryStore(), orders = orderBook();
  const failing: Store = { ...store, tx: fn => store.tx(t => fn({ ...t, insertJob() { throw new Error('delist insert failed'); } })) };
  await assert.rejects(confirm({ store: failing, log: log(), harness: saleHarness(), orders, listingsOf: () => listings }, job), /delist insert failed/);
  assert.equal(store.rows('order', { user_id: job.user_id }).length, 0, 'failed fan-out must roll back the confirmed order');
  assert.equal(store.events().length, 0, 'failed fan-out must roll back its events');
  assert.equal(store.jobs().length, 0, 'failed fan-out must roll back its jobs');
  await confirm({ store, log: log(), harness: saleHarness(), orders, listingsOf: () => listings }, job);
  assert.equal(store.rows('order', { user_id: job.user_id }).length, 1, 'retry must persist even if the book already saw this order');
  for (const delist of store.jobs()) assert.ok(confirmedOrder(store, delist));
});

test('an order persistence failure cannot leave unauthorized delist jobs', async () => {
  const store = memoryStore();
  const failing: Store = { ...store, tx: fn => store.tx(t => fn({ ...t, put() { throw new Error('order insert failed'); } })) };
  await assert.rejects(confirm({ store: failing, log: log(), harness: saleHarness(), orders: orderBook(), listingsOf: () => listings }, job), /order insert failed/);
  assert.equal(store.events().length, 0);
  assert.equal(store.jobs().length, 0, 'order persistence and delists must commit together');
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
