// One test per verb on the reduced recordings (fixtures/), plus the failure envelopes and the Mercari money rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { VERBS, type Verb } from '../../protocol.ts';
import { M, mercariAdapters, ROUTES, readListing, readReviews, stillUp, toWatchSnapshot, type Client, type Page } from './adapter.ts';

const fx = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8')) as Page & { url: string };
const s = new AbortController().signal;

// Routes a url to its recording by the page the live client would open.
function client(o: { signed_in?: boolean; status?: number; page?: Partial<Page>; challenge?: boolean } = {}): Client {
  return {
    signed_in: o.signed_in ?? false,
    async page(url) {
      const f = url.includes('/search/') ? (url.includes('zqxj') ? 'search-empty' : url.includes('itemStatuses=2') ? 'search-sold' : 'search')
        : url.includes('/us/item/') ? 'listing' : url.includes('/reviews/') ? 'reviews' : url === ROUTES.inbox ? 'inbox' : url === ROUTES.offers ? 'offers'
        : url === ROUTES.orders ? 'orders' : url === ROUTES.stats ? 'stats' : 'profile';
      const { status, html, api } = fx(`${f}.json`);
      return { status: o.status ?? status, html, api, challenge: o.challenge, ...o.page };
    },
  };
}
const run = (verb: Verb, args: Record<string, unknown>, c = client()) => mercariAdapters(c).find(a => a.manifest.verb === verb)!.run(args, s);
const rows = (r: { ok: boolean; data?: unknown }) => { assert.ok(r.ok, JSON.stringify(r)); return r.data as Record<string, unknown>[]; };
const code = (r: unknown) => (r as { error: { code: string; hint: { kind?: string } } }).error;

test('every kernel verb has one adapter and a manifest that names its session and route', () => {
  const ads = mercariAdapters(client());
  assert.deepEqual(ads.map(a => a.manifest.verb).sort(), [...VERBS].sort());
  for (const a of ads) {
    assert.equal(a.manifest.site, 'mercari');
    assert.equal(a.route_id, `mercari.${a.manifest.verb}.page`);
    assert.deepEqual(Object.keys(a.manifest.output_schema), a.manifest.fields.map(f => f.name));
  }
  assert.equal(M.read_listings.fields.find(f => f.name === 'impressions')!.needs_session, true);
  assert.equal(M.read_listings.fields.find(f => f.name === 'price_cents')!.needs_session, false);
  assert.equal(M.read_stats.fields.some(f => f.name === 'views'), false);
});

test('search reads active and sold from the page own searchFacetQuery answer', async () => {
  const r = rows(await run('search', { q: 'carhartt hoodie' }));
  assert.equal(r.length, 5);
  assert.deepEqual({ ...r[0], seller_ref_hash: undefined, listed_at: undefined, title: undefined, brand: undefined, condition: undefined, size: undefined },
    { external_id: 'm78454576562', url: 'https://www.mercari.com/us/item/m78454576562/', state: 'live', price_cents: 2200, currency: 'USD', likes: undefined,
      seller_ref_hash: undefined, listed_at: undefined, title: undefined, brand: undefined, condition: undefined, size: undefined });
  assert.match(String(r[0].seller_ref_hash), /^h[0-9a-f]{8}$/);
  const sold = rows(await run('search', { q: 'carhartt hoodie', status: 'sold' }));
  assert.deepEqual([...new Set(sold.map(x => x.state))], ['sold']);
  assert.equal(code(await run('search', { q: 'x', sort_by: 9 })).code, 'policy_refused');
});

test('a changed page is page_changed, a status of 400 or more is blocked, an empty result is ok []', async () => {
  assert.equal(code(await run('search', { q: 'x' }, client({ page: { api: [] } }))).code, 'page_changed');
  assert.equal(code(await run('search', { q: 'x' }, client({ page: { api: [{ op: 'searchFacetQuery', body: { data: { search: {} } } }] } }))).code, 'page_changed');
  for (const st of [400, 403, 500]) assert.equal(code(await run('search', { q: 'x' }, client({ status: st }))).code, 'blocked');
  assert.equal(code(await run('search', { q: 'x' }, client({ challenge: true }))).code, 'blocked');
  assert.equal(code(await run('read_listings', { seller_id: '1' }, client({ status: 429 }))).code, 'rate_limited');
  // the GraphQL error the api gave the anonymous call (observed): its own status inside a 200 page
  const g401 = { op: 'searchFacetQuery', body: { errors: [{ message: 'unauthorized', status: 401 }] } };
  assert.equal(code(await run('search', { q: 'x' }, client({ page: { api: [g401] } }))).code, 'auth_expired');
  const g403 = { op: 'searchFacetQuery', body: { errors: [{ message: 'forbidden', status: 403 }] } };
  assert.equal(code(await run('search', { q: 'x' }, client({ page: { api: [g403] } }))).code, 'blocked');
  assert.deepEqual(await run('search', { q: 'zqxjvbnmwk plorpt' }), { ok: true, data: [] });
});

test('read_listings reads a seller from their public profile, with a status filter', async () => {
  const all = rows(await run('read_listings', { seller_id: '900000005' }));
  assert.equal(all.length, 2);
  assert.equal(all[0].price_cents, 2500);
  assert.equal(rows(await run('read_listings', { seller_id: '900000005', status: 'sold' })).length, 0);
});

test('read_storefront gives the public figures', async () => {
  const r = await run('read_storefront', { user_id: '900000005' });
  assert.ok(r.ok);
  assert.deepEqual(r.data, { followers: 146, following: 132, rating: 5, review_count: 466, sold_count: 297, active_count: 30, user_id: '900000005' });
});

test('one listing, still up and reviews', async () => {
  const l = await readListing(client(), 'm23851589493', s);
  assert.ok(l.ok, JSON.stringify(l));
  assert.deepEqual({ ...(l.data as object) }, { ...(l.data as object), external_id: 'm23851589493', price_cents: 1200, likes: 3, state: 'sold', offerable: false, seller_sales: 297 });
  assert.deepEqual(await stillUp(client(), 'm23851589493', s), { ok: true, data: { state: 'sold' } });
  assert.deepEqual(await stillUp(client({ status: 404 }), 'm1', s), { ok: true, data: { state: 'gone' } });
  assert.deepEqual(await stillUp(client({ page: { html: '<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"statusCode":404}}}</script>' } }), 'm1', s), { ok: true, data: { state: 'gone' } });
  assert.equal(code(await stillUp(client({ page: { html: '<html>new</html>' } }), 'm1', s)).code, 'page_changed');
  const rv = await readReviews(client(), 'user900000005', s);
  assert.ok(rv.ok && Array.isArray(rv.data) && rv.data.length === 5);
  for (const r of rv.data as Record<string, unknown>[]) { assert.match(String(r.author_ref_hash), /^h[0-9a-f]{8}$/); assert.equal(typeof r.rating, 'string'); }
});

for (const verb of ['read_inbox', 'read_offers', 'read_orders', 'read_stats'] as const) {
  test(`${verb} needs the linked account and reads its rows`, async () => {
    assert.equal(code(await run(verb, {})).code, 'auth_expired');
    assert.ok(rows(await run(verb, {}, client({ signed_in: true }))).length > 0);
  });
}

test('read_stats reports Mercari views as impressions, never as views', async () => {
  const r = rows(await run('read_stats', {}, client({ signed_in: true })));
  assert.deepEqual(r[0], { external_id: 'm900000201', impressions: 412, likes: 9 });
});

test('offers on Mercari last 24 h, read from spec/sites.mjs', async () => {
  const o = rows(await run('read_offers', {}, client({ signed_in: true })));
  assert.equal(o[0].state, 'open');
  assert.equal(o[0].amount_cents, 1800);
  assert.equal(Date.parse(String(o[0].expires_at)) - Date.parse(String(o[0].created_at)), 24 * 3600_000);
  const args = { offer_id: 'o1', action: 'accept', amount_cents: 1800, floor_cents: 1500, received_at: '2026-11-14T09:00:00Z', operation_id: 'op' };
  assert.ok((await run('answer_offer', { ...args, now: '2026-11-15T08:59:00Z' })).ok);
  assert.equal(code(await run('answer_offer', { ...args, now: '2026-11-15T09:00:00Z' })).hint.kind, 'offer_expired');
});

test('no write goes under the floor', async () => {
  const now = '2026-11-15T01:00:00Z';
  assert.equal(code(await run('answer_offer', { offer_id: 'o1', action: 'accept', amount_cents: 1400, floor_cents: 1500, received_at: now, now })).hint.kind, 'under_floor');
  assert.equal(code(await run('answer_offer', { offer_id: 'o1', action: 'counter', amount_cents: 1800, received_at: now, now })).hint.kind, 'under_floor');
  assert.equal(code(await run('revise', { item_id: 'm1', changes: { price_cents: 1400 }, floor_cents: 1500 })).hint.kind, 'under_floor');
  assert.equal(code(await run('make_offer', { listing_external_id: 'm1', list_cents: 2000, offer_cents: 1700, floor_cents: 1800, now })).hint.kind, 'under_floor');
  assert.equal(code(await run('post', { listing: { ...LISTING, price_cents: 1000 }, floor_cents: 1500 })).hint.kind, 'under_floor');
});

test('Promote is a drop of at least 5% under the current and the lowest price; Offer to likers at least 10%', async () => {
  const base = { item_id: 'm1', current_cents: 2000, floor_cents: 1000, promote: true };
  assert.ok((await run('revise', { ...base, changes: { price_cents: 1900 } })).ok);
  assert.equal(code(await run('revise', { ...base, changes: { price_cents: 1901 } })).hint.kind, 'promote');
  assert.equal(code(await run('revise', { ...base, lowest_cents: 1900, changes: { price_cents: 1900 } })).hint.kind, 'promote');
  const now = '2026-11-15T01:00:00Z';
  assert.ok((await run('make_offer', { listing_external_id: 'm1', list_cents: 2000, offer_cents: 1800, floor_cents: 1000, now })).ok);
  assert.equal(code(await run('make_offer', { listing_external_id: 'm1', list_cents: 2000, offer_cents: 1900, floor_cents: 1000, now })).hint.kind, 'seller_offer');
  assert.equal(code(await run('make_offer', { listing_external_id: 'm1', list_cents: 2000, offer_cents: 1800, floor_cents: 1000, now, last_sent_at: '2026-11-14T01:00:00Z' })).hint.kind, 'seller_offer');
  assert.equal(code(await run('make_offer', { listing_external_id: 'm1', list_cents: 100, offer_cents: 90, floor_cents: 0, now })).hint.kind, 'seller_offer');
});

const LISTING = { title: 'Carhartt hoodie', description: 'Black, size M.', photos: ['p1'], category: ['Men', 'Tops', 'Hoodies'], condition: 'Good', brand: 'Carhartt', price_cents: 3000 };
const WRITE_ARGS: Record<string, Record<string, unknown>> = {
  post: { listing: LISTING, floor_cents: 2000 }, revise: { item_id: 'm1', changes: { price_cents: 2800 }, floor_cents: 2000 }, end: { item_id: 'm1' }, relist: { item_id: 'm1' },
  send_message: { thread_ref: 'c1', text: 'Still available.' },
  answer_offer: { offer_id: 'o1', action: 'decline', received_at: '2026-11-15T00:00:00Z', now: '2026-11-15T01:00:00Z' },
  make_offer: { listing_external_id: 'm1', list_cents: 10000, offer_cents: 9000, floor_cents: 8000, now: '2026-11-15T01:00:00Z' }, save: { item_id: 'm1' },
};
const NEVER = /pay|card|address|buy|purchase|checkout|delete|account|password/i;
for (const [verb, args] of Object.entries(WRITE_ARGS)) {
  test(`${verb} is dry by default: the page steps and the request, stopping before the submit`, async () => {
    const r = await run(verb as Verb, { ...args, operation_id: 'op' });
    assert.ok(r.ok, JSON.stringify(r));
    const p = r.data as { dry: boolean; steps: string[]; url: string };
    assert.equal(p.dry, true);
    assert.match(p.steps.at(-1)!, /^stop before/);
    for (const step of p.steps) assert.doesNotMatch(step, NEVER);
    assert.equal(code(await run(verb as Verb, { ...args, operation_id: 'op', dry: false })).code, 'auth_expired');
    assert.equal(code(await run(verb as Verb, { ...args, operation_id: 'op', dry: false }, client({ signed_in: true }))).code, 'no_route');
  });
}

test('writes refuse a bad input before planning', async () => {
  for (const bad of [{ photos: [] }, { photos: Array(13).fill('p') }, { title: 'x'.repeat(81) }, { description: 'x'.repeat(1001) }, { condition: 'Used' },
    { price_cents: 99 }, { price_cents: 200001 }, { hashtags: ['a', 'b', 'c', 'd'] }, { category: undefined }])
    assert.equal(code(await run('post', { listing: { ...LISTING, ...bad }, floor_cents: 0 })).hint.kind, 'invalid_listing', JSON.stringify(bad));
  assert.equal(code(await run('post', { listing: LISTING })).hint.kind, 'under_floor');
  assert.equal(code(await run('send_message', { thread_ref: 'c1', text: ' ' })).code, 'policy_refused');
});

test('the watch snapshot keeps unread sections undefined', async () => {
  const listings = rows(await run('read_listings', { seller_id: '900000005' }));
  const snap = toWatchSnapshot({ account_id: 'a', user_id: 'u', taken_at: '2026-11-15T00:00:00Z', listings });
  assert.equal(snap.site, 'mercari');
  assert.equal(snap.route, 'public');
  assert.equal(snap.listings!.length, 2);
  assert.equal(snap.offers, undefined);
  assert.equal(snap.messages, undefined);
  const offers = rows(await run('read_offers', {}, client({ signed_in: true })));
  const messages = rows(await run('read_inbox', {}, client({ signed_in: true })));
  const signed = toWatchSnapshot({ account_id: 'a', user_id: 'u', taken_at: '2026-11-15T00:00:00Z', offers, messages });
  assert.equal(signed.route, 'signed_in');
  assert.equal(signed.offers![0].state, 'open');
  assert.deepEqual(signed.messages!.map(m => m.from), ['buyer', 'us']);
});
