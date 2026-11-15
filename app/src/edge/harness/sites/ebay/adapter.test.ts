// eBay harness on fixtures shaped like the documented responses. Run: node --test --test-concurrency=1 app/src/edge/harness/sites/ebay/adapter.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { VERBS, type AdapterResult, type CallArgs, type Verb } from '../../protocol.ts';
import { appTokenSource, ebayAdapters, readItem, readEligible, consentUrl, promotedProposal, pushLatency, toWatchSnapshot, retryAfter, SCOPES, USER_SCOPES, type Client, type Reply, type Req } from './adapter.ts';

const raw = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const fx = (f: string): unknown => JSON.parse(raw(f));
const signal = new AbortController().signal;
const NOW = new Date('2026-11-15T20:00:00.000Z'); // 12:00 Pacific, so midnight Pacific is 43200 s away

function route(req: Req): Reply {
  const u = new URL(req.url), p = u.pathname, ok = (body: unknown): Reply => ({ status: 200, headers: {}, body });
  if (p.endsWith('/item_summary/search')) return ok(fx('search.json'));
  if (p.endsWith('/get_item_by_legacy_id')) return ok(fx('item.json'));
  if (p.includes('/marketplace_insights/')) return ok(fx('insights-sales.json'));
  if (p.endsWith('/inventory_item')) return ok(fx('inventory-items.json'));
  if (p.endsWith('/sell/inventory/v1/offer')) {
    const o = (fx('offers.json') as Record<string, unknown>)[u.searchParams.get('sku') ?? ''];
    return o ? ok(o) : { status: 404, headers: {}, body: { errors: [{ errorId: 25713, message: 'not found' }] } };
  }
  if (p.endsWith('/ws/api.dll')) return ok(raw('best-offers.xml'));
  if (p.includes('/sell/fulfillment/')) return ok(fx('orders.json'));
  if (p.includes('/commerce/message/')) return ok(fx('conversations.json'));
  if (p.includes('/sell/analytics/')) return ok(fx('traffic.json'));
  if (p.includes('/commerce/identity/')) return ok(fx('identity.json'));
  if (p.endsWith('/find_eligible_items')) return ok(fx('eligible.json'));
  throw new Error(`no fixture for ${p}`);
}
function client(o: { over?: (r: Req) => Reply | undefined; keys?: boolean; linked?: boolean; insights?: boolean } = {}) {
  const sent: Req[] = [];
  const c: Client = { env: 'production', insights: o.insights, now: () => NOW,
    app_token: async () => (o.keys === false ? undefined : 'app-test-token'),
    user_token: async () => (o.linked === false ? { ok: false } : { ok: true, token: 'user-test-token' }),
    send: async r => { sent.push(r); return o.over?.(r) ?? route(r); } };
  return { c, sent };
}
const run = (verb: Verb, a: CallArgs, c: Client) => ebayAdapters(c).find(x => x.manifest.verb === verb)!.run(a, signal);
const rows = (r: AdapterResult) => { assert.ok(r.ok, JSON.stringify(r)); return r.data as Record<string, unknown>[]; };
const err = (r: AdapterResult) => { assert.ok(!r.ok, 'expected a failure'); return r.error; };

test('an invalid eBay token response has no token', async () => {
  const token = appTokenSource({ client_id: 'id', client_secret: 'secret', fetchFn: async () => new Response('{') });
  assert.equal(await token(signal, SCOPES.public), undefined);
});

test('manifest: every kernel verb, site ebay, an endpoint route, session per verb and field', () => {
  const a = ebayAdapters(client().c);
  assert.deepEqual(a.map(x => x.manifest.verb).sort(), [...VERBS].sort());
  for (const x of a) {
    assert.equal(x.manifest.site, 'ebay');
    assert.equal(x.manifest.route_kind, 'endpoint');
    assert.equal(x.route_id, `ebay.${x.manifest.verb}.endpoint`);
    assert.ok(['public', 'signed_in'].includes(x.manifest.session));
    for (const f of x.manifest.fields) assert.equal(typeof f.needs_session, 'boolean');
  }
  assert.equal(a.find(x => x.manifest.verb === 'search')!.manifest.session, 'public');
  assert.ok(a.find(x => x.manifest.verb === 'read_storefront')!.manifest.fields.find(f => f.name === 'sold_count')!.needs_session);
});

test('consent URL asks for the sell scopes, never marketing', () => {
  const u = new URL(consentUrl({ client_id: 'cid', redirect_uri: 'Our_App-RuName' }, 'st-1'));
  assert.equal(u.origin, 'https://auth.ebay.com');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('redirect_uri'), 'Our_App-RuName');
  assert.equal(u.searchParams.get('scope'), USER_SCOPES.join(' '));
  assert.ok(!u.searchParams.get('scope')!.includes('sell.marketing'));
});

test('search: Browse rows, hashed seller, no seller name', async () => {
  const { c, sent } = client();
  const r = rows(await run('search', { q: 'levis 501' }, c));
  assert.equal(r.length, 2);
  assert.deepEqual([r[0]!.external_id, r[0]!.price_cents, r[0]!.watchers, r[0]!.state], ['110551234567', 3499, 7, 'live']);
  assert.match(String(r[0]!.seller_ref_hash), /^h[0-9a-f]{8}$/);
  assert.ok(!JSON.stringify(r).includes('fixture_seller'));
  assert.equal(r[1]!.watchers, undefined);
  assert.equal(sent[0]!.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_US');
});

test('an empty result is ok and empty', async () => {
  const { c } = client({ over: r => (r.url.includes('item_summary') ? { status: 200, headers: {}, body: fx('search-empty.json') } : undefined) });
  assert.deepEqual(await run('search', { q: 'nothing' }, c), { ok: true, data: [] });
});

test('search needs q or category_ids; no keys hands off to the eBay search page', async () => {
  assert.equal(err(await run('search', {}, client().c)).hint.do, 'raise_decision');
  const e = err(await run('search', { q: 'x' }, client({ keys: false }).c));
  assert.equal(e.code, 'no_route');
});

test('sold data: Marketplace Insights when approved, else no_route with a handoff', async () => {
  const e = err(await run('search', { q: 'levis 501', status: 'sold' }, client().c));
  assert.equal(e.code, 'no_route');
  assert.ok(e.hint.do === 'handoff' && e.hint.url.includes('LH_Sold=1'));
  const r = rows(await run('search', { q: 'levis 501', status: 'sold' }, client({ insights: true }).c));
  assert.deepEqual([r[0]!.state, r[0]!.price_cents, r[0]!.sold_at], ['sold', 4100, '2026-11-02T19:00:00.000Z']);
});

test('read item by legacy id', async () => {
  const { c, sent } = client();
  const r = await readItem(c, '110551234567', signal);
  assert.ok(r.ok);
  assert.equal((r.data as Record<string, unknown>).external_id, '110551234567');
  assert.ok(sent[0]!.url.includes('legacy_item_id=110551234567'));
});

test('read_storefront: rating, reviews and active count from Browse', async () => {
  const { c, sent } = client();
  const r = await run('read_storefront', { username: 'fixture_seller_a' }, c);
  assert.ok(r.ok);
  assert.equal((r.data as Record<string, unknown>).rating, 99.6);
  assert.equal((r.data as Record<string, unknown>).review_count, 1204);
  assert.equal(new URL(sent[0]!.url).searchParams.get('filter'), 'sellers:{fixture_seller_a}');
});

test('read_listings: inventory offers become live, sold and draft', async () => {
  const r = rows(await run('read_listings', {}, client().c));
  assert.deepEqual(r.map(x => [x.external_id, x.state, x.price_cents]), [['110551234567', 'live', 3499], ['110552222222', 'sold', 6000], ['9000000003', 'draft', 7500]]);
});

test('read_offers: Trading Best Offers with hashed buyers', async () => {
  const r = rows(await run('read_offers', {}, client().c));
  assert.deepEqual(r.map(x => [x.external_id, x.listing_external_id, x.amount_cents, x.state]), [['5011111111', '110551234567', 3000, 'open'], ['5011111112', '110551234567', 2000, 'declined']]);
  assert.ok(!JSON.stringify(r).includes('fixture_buyer'));
});

test('Trading error 931 in HTTP 200 becomes auth_expired', async () => {
  const { c } = client({ over: r => (r.url.endsWith('/ws/api.dll') ? { status: 200, headers: {}, body: raw('trading-error.xml') } : undefined) });
  assert.equal(err(await run('read_offers', {}, c)).code, 'auth_expired');
});

test('read_orders: total and the accepted item price', async () => {
  const r = rows(await run('read_orders', {}, client().c));
  assert.deepEqual([r[0]!.external_order_id, r[0]!.listing_external_id, r[0]!.price_cents, r[0]!.item_cents], ['12-34567-89012', '110551234567', 3750, 3000]);
  assert.ok(!JSON.stringify(r).includes('fixture_buyer'));
});

test('read_inbox: who sent last and when, no names or text', async () => {
  const r = rows(await run('read_inbox', {}, client().c));
  assert.deepEqual(r.map(x => [x.thread_ref, x.from, x.listing_external_id]), [['c-1001', 'buyer', '110551234567'], ['c-1002', 'us', '110552222222']]);
  assert.ok(!JSON.stringify(r).includes('fixture_'));
});

test('read_stats: traffic_report views per listing', async () => {
  const { c, sent } = client();
  const r = rows(await run('read_stats', {}, c));
  assert.deepEqual(r.map(x => [x.external_id, x.views, x.impressions, x.transactions]), [['110551234567', 41, 1290, 0], ['110552222222', 63, 2210, 1]]);
  assert.match(new URL(sent[0]!.url).searchParams.get('filter')!, /date_range:\[20261108\.\.20261115\]/);
});

test('readEligible: listings an offer can go to', async () => {
  assert.deepEqual(await readEligible(client().c, signal), { ok: true, data: ['110551234567'] });
});

test('401 becomes auth_expired; no link is relink', async () => {
  const { c } = client({ over: () => ({ status: 401, headers: {}, body: {} }) });
  assert.deepEqual(err(await run('search', { q: 'x' }, c)).hint, { do: 'relink', site: 'ebay' });
  assert.equal(err(await run('read_orders', {}, client({ linked: false }).c)).code, 'auth_expired');
});

test('429 becomes rate_limited and honours Retry-After, else midnight Pacific', async () => {
  const body = fx('error-429.json');
  const e1 = err(await run('search', { q: 'x' }, client({ over: () => ({ status: 429, headers: { 'retry-after': '30' }, body }) }).c));
  assert.deepEqual([e1.code, e1.hint], ['rate_limited', { do: 'retry_after', after_s: 30 }]);
  const e2 = err(await run('search', { q: 'x' }, client({ over: () => ({ status: 429, headers: {}, body }) }).c));
  assert.deepEqual(e2.hint, { do: 'retry_after', after_s: 43200 });
  assert.equal(retryAfter({}, new Date('2026-11-16T07:59:00.000Z')), 60);
});

test('a documented field error passes through as the hint', async () => {
  const e = err(await run('read_listings', {}, client({ over: () => ({ status: 400, headers: {}, body: fx('error-400.json') }) }).c));
  assert.equal(e.code, 'policy_refused');
  assert.deepEqual(e.hint, { do: 'raise_decision', kind: 'ebay_25709:price' });
  assert.equal(e.message, 'Invalid value for price. The price must be greater than 0.99.');
});

const WRITES: [Verb, CallArgs][] = [
  ['post', { sku: 'SH-0004', title: 'Levi 501', category_id: '11483', price_cents: 4000, floor_cents: 3000 }],
  ['revise', { offer_id: '9000000001', sku: 'SH-0001', price_cents: 3200, floor_cents: 3000 }],
  ['end', { offer_id: '9000000001' }],
  ['relist', { offer_id: '9000000002' }],
  ['send_message', { conversation_id: 'c-1001', text: 'Yes, still here.' }],
  ['answer_offer', { offer_id: '5011111111', item_id: '110551234567', action: 'counter', amount_cents: 3200, floor_cents: 3000, received_at: '2026-11-15T10:00:00.000Z' }],
  ['make_offer', { listing_external_id: '110551234567', list_cents: 3499, offer_cents: 3100, floor_cents: 3000 }],
  ['save', { item_id: '110559876543' }],
];

test('a dry write sends nothing and returns the documented request with a token placeholder', async () => {
  for (const [verb, a] of WRITES) {
    const { c, sent } = client();
    const r = await run(verb, a, c);
    assert.ok(r.ok, `${verb}: ${JSON.stringify(r)}`);
    const plan = r.data as { dry: boolean; request: { calls: Req[] } };
    assert.equal(plan.dry, true);
    assert.equal(sent.length, 0, `${verb} sent a request`);
    assert.ok(plan.request.calls.length > 0);
    assert.ok(!JSON.stringify(plan).includes('test-token'), `${verb} leaked a token`);
  }
});

test('the documented request bodies', async () => {
  const plan = async (v: Verb, a: CallArgs) => ((await run(v, a, client().c)) as { data: { request: { calls: Req[] } } }).data.request.calls;
  const post = await plan(...WRITES[0]!);
  assert.deepEqual(post.map(x => [x.method, new URL(x.url).pathname]), [['PUT', '/sell/inventory/v1/inventory_item/SH-0004'], ['POST', '/sell/inventory/v1/offer'], ['POST', '/sell/inventory/v1/offer/%7BofferId%7D/publish']]);
  assert.deepEqual(JSON.parse(post[1]!.body!).pricingSummary, { price: { value: '40.00', currency: 'USD' } });
  const ans = await plan(...WRITES[5]!);
  assert.equal(ans[0]!.headers['X-EBAY-API-CALL-NAME'], 'RespondToBestOffer');
  assert.match(ans[0]!.body!, /<Action>Counter<\/Action><CounterOfferPrice currencyID="USD">32\.00<\/CounterOfferPrice>/);
  const mk = JSON.parse((await plan(...WRITES[6]!))[0]!.body!);
  assert.deepEqual(mk.offerDuration, { unit: 'DAY', value: 4 });
});

test('no write goes under the floor, and a price write must name one', async () => {
  for (const [verb, a] of [
    ['post', { ...WRITES[0]![1], price_cents: 2500 }], ['revise', { ...WRITES[1]![1], price_cents: 2999 }],
    ['answer_offer', { ...WRITES[5]![1], action: 'accept', amount_cents: 2000 }], ['make_offer', { ...WRITES[6]![1], offer_cents: 3000, floor_cents: 3050 }],
  ] as [Verb, CallArgs][]) {
    const { c, sent } = client();
    assert.deepEqual(err(await run(verb, a, c)).hint, { do: 'raise_decision', kind: 'price_under_floor' }, verb);
    assert.equal(sent.length, 0);
  }
  const { floor_cents: _, ...noFloor } = WRITES[1]![1];
  assert.deepEqual(err(await run('revise', noFloor, client().c)).hint, { do: 'raise_decision', kind: 'missing_input' });
});

test('an expired Best Offer is refused; a non-dry write is designed, not built', async () => {
  const late = { ...WRITES[5]![1], received_at: '2026-11-14T10:00:00.000Z' };
  assert.deepEqual(err(await run('answer_offer', late, client().c)).hint, { do: 'raise_decision', kind: 'offer_expired' });
  const { c, sent } = client();
  assert.equal(err(await run('end', { offer_id: '9000000001', dry: false }, c)).code, 'no_route');
  assert.equal(sent.length, 0);
  assert.equal(err(await run('end', { offer_id: '9000000001', dry: false }, client({ linked: false }).c)).code, 'auth_expired');
});

test('promoted listings are a proposal only', () => {
  const p = promotedProposal(client().c, { name: 'fall', listing_ids: ['110551234567'], bid_pct: 3 });
  assert.equal(p.dry, true);
  assert.equal(new URL(p.request.calls[0]!.url).pathname, '/sell/marketing/v1/ad_campaign');
});

test('watch snapshot in the kernel Snapshot shape', async () => {
  const { c } = client();
  const s = toWatchSnapshot({ account_id: 'acct-1', user_id: 'user-1', taken_at: NOW.toISOString(),
    listings: rows(await run('read_listings', {}, c)), offers: rows(await run('read_offers', {}, c)), messages: rows(await run('read_inbox', {}, c)), orders: rows(await run('read_orders', {}, c)) });
  assert.equal(s.site, 'ebay');
  assert.equal(s.route, 'signed_in');
  assert.equal(s.listings!.length, 3);
  assert.deepEqual(s.offers![0], { external_id: '5011111111', listing_external_id: '110551234567', amount_cents: 3000, state: 'open', buyer_ref_hash: s.offers![0]!.buyer_ref_hash });
  assert.deepEqual(s.orders![0], { external_order_id: '12-34567-89012', listing_external_id: '110551234567', state: 'NOT_STARTED', price_cents: 3750 });
  assert.ok(!JSON.stringify(s).includes('fixture_'));
});

test('push against the watcher: seconds from sale to our event', () => {
  const m = pushLatency(fx('push-order.json') as Parameters<typeof pushLatency>[0]);
  assert.deepEqual(m, { sale_to_event_s: 4, sale_to_push_s: 6.5, watcher_worst_s: 300, watcher_mean_s: 150, push_wins_by_s: 143.5 });
});
