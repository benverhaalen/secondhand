// One test per verb on the reduced recordings (fixtures/), plus the failure envelopes and the two Depop rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { VERBS, type Verb } from '../../protocol.ts';
import { depopAdapters, M, PATHS, readListing, readReviews, stillUp, toWatchSnapshot, type Client } from './adapter.ts';

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const js = (f: string) => JSON.parse(fx(f)) as unknown;
const s = new AbortController().signal;

// Routes a request to its recording by the path the live client would fetch.
function client(o: { signed_in?: boolean; status?: number; html?: string; challenge?: boolean } = {}): Client {
  const st = o.status ?? 200;
  return {
    signed_in: o.signed_in ?? false,
    async doc(url) {
      if (o.html !== undefined) return { status: st, html: o.html, challenge: o.challenge };
      if (url.includes('/search/')) return { status: st, html: fx(url.includes('q=zzzz') ? 'search-empty.html' : 'search.html'), challenge: o.challenge };
      return { status: st, html: fx('shop.html'), challenge: o.challenge };
    },
    async json(path) {
      const f = path === PATHS.inbox ? 'inbox' : path === PATHS.offers ? 'offers' : path === PATHS.orders ? 'orders' : path === PATHS.stats ? 'stats'
        : path.includes('/extended/') ? 'extended' : path.includes('/by-slug/') ? 'by-slug' : path.includes('/feedback/') ? 'feedback'
        : path.includes('/by-status/sold/') ? 'sold' : path.includes('/aggregates/') ? 'aggregates' : 'products';
      return { status: st, body: js(`${f}.json`) };
    },
  };
}
const run = (verb: Verb, args: Record<string, unknown>, c = client()) => depopAdapters(c).find(a => a.manifest.verb === verb)!.run(args, s);
const rows = (r: { ok: boolean; data?: unknown }) => { assert.ok(r.ok, JSON.stringify(r)); return r.data as Record<string, unknown>[]; };
const code = (r: unknown) => (r as { error: { code: string; hint: { kind?: string } } }).error;

test('every kernel verb has one adapter and a manifest that names its session and route', () => {
  const ads = depopAdapters(client());
  assert.deepEqual(ads.map(a => a.manifest.verb).sort(), [...VERBS].sort());
  for (const a of ads) {
    assert.equal(a.manifest.site, 'depop');
    assert.ok(['public', 'signed_in'].includes(a.manifest.session) && ['page', 'endpoint'].includes(a.manifest.route_kind));
    assert.deepEqual(Object.keys(a.manifest.output_schema), a.manifest.fields.map(f => f.name));
  }
  assert.equal(M.read_listings.fields.find(f => f.name === 'views')!.needs_session, true);
  assert.equal(M.read_listings.fields.find(f => f.name === 'price_cents')!.needs_session, false);
});

test('search reads the active listings from the page flight; sold search hands off', async () => {
  const r = rows(await run('search', { q: 'carhartt' }));
  assert.equal(r.length, 3);
  assert.match(String(r[0].external_id), /^\d+$/);
  assert.equal(typeof r[0].price_cents, 'number');
  assert.equal(r[0].state, 'live');
  assert.match(String(r[0].seller_ref_hash), /^h[0-9a-f]{8}$/);
  assert.match(String(r[0].url), /^https:\/\/www\.depop\.com\/products\//);
  assert.equal(code(await run('search', { q: 'carhartt', status: 'sold' })).code, 'no_route');
});

test('a changed page is page_changed, a status of 400 or more is blocked, an empty result is ok []', async () => {
  const changed = await run('search', { q: 'x' }, client({ html: '<html><body>new layout</body></html>' }));
  assert.equal(code(changed).code, 'page_changed');
  assert.equal(code(await run('search', { q: 'x' }, client({ status: 403 }))).code, 'blocked');
  assert.equal(code(await run('search', { q: 'x' }, client({ challenge: true }))).code, 'blocked');
  assert.equal(code(await run('read_listings', { shop_id: '1' }, client({ status: 429 }))).code, 'rate_limited');
  assert.deepEqual(await run('search', { q: 'zzzz' }), { ok: true, data: [] });
});

test('read_listings reads active and sold from the public shop endpoints', async () => {
  const all = rows(await run('read_listings', { shop_id: '1000001' }));
  assert.equal(all.length, 5);
  assert.deepEqual([...new Set(all.map(r => r.state))].sort(), ['live', 'sold']);
  assert.equal(rows(await run('read_listings', { shop_id: '1000001', status: 'sold' })).length, 2);
  assert.equal(all.find(r => r.external_id === '999002396')!.price_cents, 7630);
});

test('read_storefront gives the public figures', async () => {
  const r = await run('read_storefront', { username: 'h1e5e334a' });
  assert.ok(r.ok);
  assert.deepEqual(r.data, { followers: 165, following: 36, rating: 4.8, review_count: 116, sold_count: 628, active_count: 20, shop_id: '1000001' });
});

test('one listing, still up and reviews', async () => {
  const l = await readListing(client(), 'h01826642-carhartt-black-full-zip-hooded-219a', s);
  assert.ok(l.ok);
  assert.deepEqual({ ...(l.data as object) }, { ...(l.data as object), external_id: '996993405', price_cents: 6405, shipping_cents: 599, likes: 25, state: 'live', quantity: 13 });
  assert.deepEqual(await stillUp(client(), 'x', s), { ok: true, data: { state: 'live' } });
  assert.deepEqual(await stillUp(client({ status: 404 }), 'x', s), { ok: true, data: { state: 'gone' } });
  const rv = await readReviews(client(), '1000001', s);
  assert.ok(rv.ok && Array.isArray(rv.data) && rv.data.length > 0);
  for (const r of rv.data as Record<string, unknown>[]) assert.match(String(r.author_ref_hash), /^h[0-9a-f]{8}$/);
});

for (const verb of ['read_inbox', 'read_offers', 'read_orders', 'read_stats'] as const) {
  test(`${verb} needs the linked account and reads its rows`, async () => {
    assert.equal(code(await run(verb, {})).code, 'auth_expired');
    assert.ok(rows(await run(verb, {}, client({ signed_in: true }))).length > 0);
  });
}

test('offers on Depop last 24 h, read from spec/sites.mjs', async () => {
  const o = rows(await run('read_offers', {}, client({ signed_in: true })));
  assert.equal(o[0].state, 'open');
  assert.equal(o[0].amount_cents, 6000);
  assert.equal(o[0].expires_at, '2026-11-15T09:00:00.000Z');
  const args = { offer_id: 'o1', action: 'accept', received_at: '2026-11-14T09:00:00Z', operation_id: 'op' };
  assert.ok((await run('answer_offer', { ...args, now: '2026-11-15T08:59:00Z' })).ok);
  assert.equal(code(await run('answer_offer', { ...args, now: '2026-11-15T09:00:00Z' })).hint.kind, 'offer_expired');
});

test('auto-respond is one always-accept line, never below the floor', async () => {
  const base = { slug: 'x', price_cents: 10000, floor_cents: 7000, operation_id: 'op' };
  const ok = await run('revise', { ...base, always_accept_cents: 8000 });
  assert.ok(ok.ok);
  assert.deepEqual((ok.data as { request: object }).request, { auto_negotiate_offer_price: '80.00' });
  assert.equal(code(await run('revise', { ...base, always_accept_cents: 6999 })).hint.kind, 'auto_respond_line');
  assert.equal(code(await run('revise', { ...base, always_accept_cents: 9600 })).hint.kind, 'auto_respond_line');
});

const LISTING = { description: 'Black hoodie', pictures: ['p1'], department: 'menswear', product_type: 'hoodies', condition: 'used_good',
  brand_name: 'Carhartt', price_amount: 40, quantity: 1, national_shipping_cost: 5 };
const WRITE_ARGS: Record<string, Record<string, unknown>> = {
  post: { listing: LISTING }, revise: { slug: 'x', changes: { price_amount: 35 } }, end: { slug: 'x' }, relist: { slug: 'x' },
  send_message: { thread_ref: 'c1', text: 'Still available.' }, answer_offer: { offer_id: 'o1', action: 'decline', received_at: '2026-11-15T00:00:00Z', now: '2026-11-15T01:00:00Z' },
  make_offer: { listing_external_id: '1', list_cents: 10000, offer_cents: 9000, now: '2026-11-15T01:00:00Z' }, save: { slug: 'x' },
};
for (const [verb, args] of Object.entries(WRITE_ARGS)) {
  test(`${verb} is dry by default: the page steps and the request, stopping before the submit`, async () => {
    const r = await run(verb as Verb, { ...args, operation_id: 'op' });
    assert.ok(r.ok, JSON.stringify(r));
    const p = r.data as { dry: boolean; steps: string[]; url: string };
    assert.equal(p.dry, true);
    assert.match(p.steps.at(-1)!, /^stop before/);
    assert.equal(code(await run(verb as Verb, { ...args, operation_id: 'op', dry: false })).code, 'auth_expired');
    assert.equal(code(await run(verb as Verb, { ...args, operation_id: 'op', dry: false }, client({ signed_in: true }))).code, 'no_route');
  });
}

test('writes refuse a bad input before planning', async () => {
  assert.equal(code(await run('post', { listing: { ...LISTING, pictures: [] }, operation_id: 'op' })).code, 'policy_refused');
  assert.equal(code(await run('post', { listing: { ...LISTING, depop_shipping: {} }, operation_id: 'op' })).code, 'policy_refused');
  assert.equal(code(await run('send_message', { thread_ref: 'c1', text: ' ', operation_id: 'op' })).code, 'policy_refused');
  assert.equal(code(await run('make_offer', { listing_external_id: '1', list_cents: 10000, offer_cents: 9600, operation_id: 'op' })).code, 'policy_refused');
});

test('the watch snapshot keeps unread sections undefined', async () => {
  const listings = rows(await run('read_listings', { shop_id: '1000001' }));
  const snap = toWatchSnapshot({ account_id: 'a', user_id: 'u', taken_at: '2026-11-15T00:00:00Z', listings });
  assert.equal(snap.route, 'public');
  assert.equal(snap.listings!.length, 5);
  assert.equal(snap.offers, undefined);
  assert.equal(snap.messages, undefined);
  const offers = rows(await run('read_offers', {}, client({ signed_in: true })));
  const signed = toWatchSnapshot({ account_id: 'a', user_id: 'u', taken_at: '2026-11-15T00:00:00Z', offers });
  assert.equal(signed.route, 'signed_in');
  assert.equal(signed.offers![0].state, 'open');
});
