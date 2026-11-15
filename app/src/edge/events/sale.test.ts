// Stream 2's done test: a sale on a fixture site produces the event, the job and the delist jobs for the other
// sites, run in parallel through harness.call, with none dropped when an account is stale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore, memoryLeases, memoryParams, fakeHarness, type Envelope, type JobRow } from './ports.ts';
import { createPipeline } from './pipeline.ts';
import { markStale, markRelinked } from './stale.ts';
import { publicCheck, confirm } from '../sold/sold.ts';
import { orderBook } from '../orders/orders.ts';
import type { ItemListing } from '../delist/delist.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const meta = { route_id: 'fake', ms: 1, fell_back: false };
const listings: ItemListing[] = [
  { listing_id: 'L-posh', item_id: 'i1', site: 'poshmark', account_id: 'a-posh', state: 'live' },
  { listing_id: 'L-ebay', item_id: 'i1', site: 'ebay', account_id: 'a-ebay', state: 'live' },
  { listing_id: 'L-dep', item_id: 'i1', site: 'depop', account_id: 'a-dep', state: 'live' },
  { listing_id: 'L-merc', item_id: 'i1', site: 'mercari', account_id: 'a-merc', state: 'live' },
];

test('a sale on Poshmark plans a Depop delist and ends eBay and Mercari; a stale eBay account is paused and resumed, not dropped', async () => {
  const store = memoryStore(), log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  let ebayLinked = false;
  const harness = fakeHarness({
    'poshmark:read_orders': () => ({ ok: true, data: { orders: [{ external_order_id: 'P1', listing_id: 'L-posh', state: 'paid', price_cents: 5000, fees_cents: 1000, shipping_cents: 0 }] }, meta }),
    'depop:end': () => ({ ok: true, data: { dry: true, request: { slug: 'fixture' } }, meta }),
    'ebay:end': (): Envelope => ebayLinked ? { ok: true, data: { landed: true }, meta }
      : { ok: false, error: { code: 'auth_expired', message: 'login wall', hint: { do: 'relink' } }, meta },
  }, 15);
  const orders = orderBook();
  const pipe = createPipeline({
    store, harness, leases: memoryLeases(), params: memoryParams({ delist_max_attempts: 3, job_lease_ttl_ms: 120000 }), log, now: Date.now, worker: 'w1',
    engines: { poll_orders: (j: JobRow) => confirm({ store, log, harness, orders, listingsOf: () => listings },
      { user_id: j.user_id, site: j.site!, account_id: j.account_id!, listing_id: j.listing_id!, item_id: j.item_id!, trace_id: j.trace_id }) },
    onStale: j => { markStale(store, log, { user_id: j.user_id, account_id: j.account_id!, site: j.site }); },
  });

  // 1. the public page shows sold: one event, one poll_orders job, nothing delisted yet
  const sold = `<script type="application/ld+json">{"offers":{"availability":"https://schema.org/SoldOut"}}</script>`;
  await publicCheck(store, log, async () => ({ status: 200, text: sold }),
    { user_id: 'u1', listing_id: 'L-posh', item_id: 'i1', site: 'poshmark', account_id: 'a-posh', url: 'https://poshmark.com/listing/x', trace_id: 't1' });
  assert.deepEqual(store.events().map(e => e.action), ['listing.sold']);
  assert.deepEqual(store.jobs().map(j => j.kind), ['poll_orders']);

  // 2. the pipeline runs it: the signed-in read confirms, the order is written, three delist jobs are created
  await pipe.runOnce(10);
  assert.equal(orders.all().length, 1);
  const delists = store.jobs({ kind: 'delist' });
  assert.deepEqual(delists.map(j => j.site).sort(), ['depop', 'ebay', 'mercari']);

  // 3. the delists run in parallel; eBay's session has expired
  const t0 = Date.now();
  await pipe.runOnce(10);
  assert.ok(Date.now() - t0 < 15 * 3, 'the three delists ran at once, not one after another');
  const ends = harness.calls.filter(c => c.verb === 'end').map(c => c.site).sort();
  assert.deepEqual(ends, ['depop', 'ebay', 'mercari']);
  const ebay = store.jobs({ kind: 'delist', site: 'ebay' })[0];
  assert.equal(ebay.paused, 'account_stale');
  assert.notEqual(ebay.state, 'failed');
  assert.equal(store.decisions({ kind: 'relink' }).length, 1);
  assert.equal(store.jobs({ kind: 'delist' }).filter(j => j.state === 'done').length, 2);

  // 4. the person re-links eBay: the paused delist resumes and lands; nothing was dropped
  ebayLinked = true;
  markRelinked(store, log, { user_id: 'u1', account_id: 'a-ebay' });
  await pipe.runOnce(10);
  assert.equal(store.jobs({ kind: 'delist' }).filter(j => j.state === 'done').length, 3);
  assert.equal(store.jobs({ kind: 'delist' }).length, 3, 'no delist job was doubled');
  const planned = store.jobs({ kind: 'delist', site: 'depop' })[0];
  assert.equal(planned.stages[0].state, 'planned');
  assert.deepEqual(planned.result, { planned: true, plan: { dry: true, request: { slug: 'fixture' } } });
  assert.equal(store.getJob(ebay.id)!.stages[0].state, 'arrived');
  assert.equal(store.decisions({ kind: 'delist_after_sale', subject: 'L-dep', state: 'open' }).length, 1);
  assert.equal(store.events().filter(e => e.action === 'listing.ended').length, 0);
  assert.equal(store.rows('order', { user_id: 'u1' }).length, 1);
});
