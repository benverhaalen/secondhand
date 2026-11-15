// One test per verb on the reduced recordings (fixtures/), plus the failure envelopes and the Poshmark rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { VERBS, type Verb } from '../../protocol.ts';
import { M, PATHS, poshmarkAdapters, readComments, readListing, readReviews, share, stillUp, toWatchSnapshot, type Client } from './adapter.ts';

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const s = new AbortController().signal;

// Routes a request to its recording by the url the live client would open.
function client(o: { signed_in?: boolean; status?: number; html?: string; challenge?: boolean } = {}): Client {
  const st = o.status ?? 200;
  return {
    signed_in: o.signed_in ?? false,
    async doc(url) {
      if (o.html !== undefined) return { status: st, html: o.html, challenge: o.challenge };
      const sold = url.includes('availability=sold_out');
      const f = url.includes('/search?') ? (url.includes('query=zzzz') ? 'search-empty' : sold ? 'search-sold' : 'search')
        : url.includes('/closet/') ? (sold ? 'closet-sold' : 'closet') : 'listing';
      return { status: st, html: fx(`${f}.html`), challenge: o.challenge };
    },
    async json(path) {
      const f = path === PATHS.inbox ? 'inbox' : path === PATHS.offers ? 'offers' : path === PATHS.orders ? 'orders' : 'stats';
      return { status: st, body: JSON.parse(fx(`${f}.json`)) as unknown };
    },
  };
}
const run = (verb: Verb, args: Record<string, unknown>, c = client()) => poshmarkAdapters(c).find(a => a.manifest.verb === verb)!.run(args, s);
const rows = (r: { ok: boolean; data?: unknown }) => { assert.ok(r.ok, JSON.stringify(r)); return r.data as Record<string, unknown>[]; };
const code = (r: unknown) => (r as { error: { code: string; hint: { kind?: string } } }).error;

test('every kernel verb has one adapter and a manifest that names its session and route', () => {
  const ads = poshmarkAdapters(client());
  assert.deepEqual(ads.map(a => a.manifest.verb).sort(), [...VERBS].sort());
  for (const a of ads) {
    assert.equal(a.manifest.site, 'poshmark');
    assert.equal(a.route_id, `poshmark.${a.manifest.verb}.${a.manifest.route_kind}`);
    assert.deepEqual(Object.keys(a.manifest.output_schema), a.manifest.fields.map(f => f.name));
  }
  assert.equal(M.read_listings.fields.find(f => f.name === 'views')!.needs_session, true);
  assert.equal(M.read_listings.fields.find(f => f.name === 'price_cents')!.needs_session, false);
  assert.equal(M.read_storefront.session, 'public');
  assert.equal(M.read_offers.session, 'signed_in');
});

test('search reads active and sold rows from the page state, and checks the sort', async () => {
  const r = rows(await run('search', { q: 'levis 501' }));
  assert.equal(r.length, 3);
  assert.deepEqual({ ...r[0] }, { ...r[0], external_id: '6af585a12800acd3211cf7ba', price_cents: 3400, currency: 'USD', state: 'live', brand: "Levi's", likes: 5, shares: 3 });
  assert.match(String(r[0].seller_ref_hash), /^h[0-9a-f]{8}$/);
  assert.equal(r[0].url, 'https://poshmark.com/listing/6af585a12800acd3211cf7ba');
  const sold = rows(await run('search', { q: 'levis 501', status: 'sold', sort: 'added_desc' }));
  assert.equal(sold.length, 3);
  assert.equal(sold[0].condition, 'ug'); assert.equal(sold[0].size, '29');
  assert.ok(sold.every(x => x.state === 'sold'));
  assert.equal(code(await run('search', { q: 'x', sort: 'newest' })).code, 'policy_refused');
});

test('a changed page is page_changed, a status of 400 or more is blocked, an empty result is ok []', async () => {
  assert.equal(code(await run('search', { q: 'x' }, client({ html: '<html><body>new layout</body></html>' }))).code, 'page_changed');
  assert.equal(code(await run('search', { q: 'x' }, client({ html: 'window.__INITIAL_STATE__={"$_search":{}};(function(){})' }))).code, 'page_changed');
  assert.equal(code(await run('search', { q: 'x' }, client({ status: 403 }))).code, 'blocked');
  assert.equal(code(await run('search', { q: 'x' }, client({ status: 500 }))).code, 'blocked');
  assert.equal(code(await run('search', { q: 'x' }, client({ challenge: true }))).code, 'blocked');
  assert.equal(code(await run('read_listings', { username: 'u' }, client({ status: 429 }))).code, 'rate_limited');
  // The empty page still carries suggested rows; total 0 wins.
  assert.deepEqual(await run('search', { q: 'zzzz' }), { ok: true, data: [] });
});

test('read_listings reads the closet, active and sold', async () => {
  const all = rows(await run('read_listings', { username: 'u3797a192' }));
  assert.equal(all.length, 3);
  assert.deepEqual([...new Set(all.map(r => r.state))].sort(), ['live', 'sold']);
  const sold = rows(await run('read_listings', { username: 'u3797a192', status: 'sold' }));
  assert.deepEqual(sold.map(r => r.external_id), ['6a285ced88849a05804c9a59', '6a285a80b7f0ac1d12e96c00']);
  assert.equal(rows(await run('read_listings', { username: 'u3797a192', status: 'active' })).length, 1);
});

test('read_storefront gives the closet figures', async () => {
  const r = await run('read_storefront', { username: 'u3797a192' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data, { followers: 1826, following: 175, review_count: 6, sold_count: 47, active_count: 1, sold_display: '45+',
    vacation: false, last_active_at: '2026-11-14T00:00:00-08:00' });
});

test('one listing, still up, comments, and love notes hand off', async () => {
  const l = await readListing(client(), '6ad63271c9ddecf01eaf740c', s);
  assert.ok(l.ok, JSON.stringify(l));
  assert.equal((l.data as Record<string, unknown>).external_id, '6ad63271c9ddecf01eaf740c');
  assert.deepEqual(await stillUp(client(), 'x', s), { ok: true, data: { state: 'live' } });
  assert.deepEqual(await stillUp(client({ status: 404 }), 'x', s), { ok: true, data: { state: 'gone' } });
  assert.equal(code(await stillUp(client({ challenge: true }), 'x', s)).code, 'blocked');
  const cm = rows(await readComments(client(), '6ad63271c9ddecf01eaf740c', s));
  assert.equal(cm.length, 3);
  assert.equal(cm[0].external_id, '6ae4001e57fb6a40cc359d14');
  assert.equal(cm[0].at, '2026-10-29T19:25:34-07:00');
  for (const c of cm) assert.match(String(c.author_ref_hash), /^h[0-9a-f]{8}$/);
  assert.equal(code(await readReviews(client(), 'u3797a192')).code, 'no_route');
});

for (const verb of ['read_inbox', 'read_offers', 'read_orders', 'read_stats'] as const) {
  test(`${verb} needs the linked account and reads its rows`, async () => {
    assert.equal(code(await run(verb, {})).code, 'auth_expired');
    assert.ok(rows(await run(verb, {}, client({ signed_in: true }))).length > 0);
    assert.equal(code(await run(verb, {}, client({ signed_in: true, status: 401 }))).code, 'auth_expired');
  });
}

test('offers on Poshmark last 24 h, read from spec/sites.mjs', async () => {
  const o = rows(await run('read_offers', {}, client({ signed_in: true })));
  assert.equal(o[0].state, 'open');
  assert.equal(o[0].amount_cents, 3000);
  assert.equal(o[0].expires_at, '2026-11-15T17:00:00.000Z');
  assert.equal(o[1].state, 'declined');
  const args = { offer_id: 'o1', action: 'accept', amount_cents: 3000, floor_cents: 2500, received_at: '2026-11-14T17:00:00Z', operation_id: 'op' };
  assert.ok((await run('answer_offer', { ...args, now: '2026-11-15T16:59:00Z' })).ok);
  assert.equal(code(await run('answer_offer', { ...args, now: '2026-11-15T17:00:00Z' })).hint.kind, 'offer_expired');
});

const LISTING = { title: "Levi's 501", description: 'Blue denim', pictures: ['p1'], category: 'Men/Jeans', size: '32', price_cents: 4000 };
const WRITE_ARGS: Record<string, Record<string, unknown>> = {
  post: { listing: LISTING, floor_cents: 3000 }, revise: { listing_external_id: 'x', changes: { price_cents: 3500 }, floor_cents: 3000 },
  end: { listing_external_id: 'x' }, relist: { listing_external_id: 'x', person_asked: true },
  send_message: { listing_external_id: 'x', text: 'Still available.' },
  answer_offer: { offer_id: 'o1', action: 'decline', received_at: '2026-11-15T00:00:00Z', now: '2026-11-15T01:00:00Z' },
  make_offer: { listing_external_id: 'x', list_cents: 10000, offer_cents: 9000, floor_cents: 8000, shipping_discount: 'reduced' }, save: { listing_external_id: 'x' },
};
for (const [verb, args] of Object.entries(WRITE_ARGS)) {
  test(`${verb} is dry by default: the page steps and the request, stopping before the submit`, async () => {
    const r = await run(verb as Verb, { ...args, operation_id: 'op' });
    assert.ok(r.ok, JSON.stringify(r));
    const p = r.data as { dry: boolean; steps: string[]; url: string };
    assert.equal(p.dry, true);
    assert.match(p.url, /^https:\/\/poshmark\.com\//);
    assert.match(p.steps.at(-1)!, /^stop before/);
    // save and relist are the person's to tap on Poshmark: the page is handed over, never a relink
    assert.equal(code(await run(verb as Verb, { ...args, operation_id: 'op', dry: false })).code, ['save', 'relist'].includes(verb) ? 'no_route' : 'auth_expired');
    assert.equal(code(await run(verb as Verb, { ...args, operation_id: 'op', dry: false }, client({ signed_in: true }))).code, 'no_route');
  });
}

test('share is dry by default behind the same gate', async () => {
  const r = await share(client(), { listing_external_id: 'x' });
  assert.ok(r.ok);
  assert.match((r.data as { steps: string[] }).steps.at(-1)!, /^stop before/);
  assert.equal(code(await share(client({ signed_in: true }), { listing_external_id: 'x', dry: false })).code, 'no_route');
  assert.equal(code(await share(client(), {})).code, 'policy_refused');
  // share, save and relist are the person's to tap: a real call hands over the page, signed in or not, and never asks to relink
  for (const c of [client(), client({ signed_in: true })]) {
    assert.equal(code(await share(c, { listing_external_id: 'x', dry: false })).code, 'no_route');
    assert.equal(code(await run('save', { listing_external_id: 'x', operation_id: 'op', dry: false }, c)).code, 'no_route');
    assert.equal(code(await run('relist', { listing_external_id: 'x', person_asked: true, operation_id: 'op', dry: false }, c)).code, 'no_route');
  }
});

test('no write sets a price under the floor', async () => {
  const kind = async (verb: Verb, a: Record<string, unknown>) => code(await run(verb, { ...a, operation_id: 'op' })).hint.kind;
  assert.equal(await kind('post', { listing: LISTING, floor_cents: 4001 }), 'under_floor');
  assert.equal(await kind('post', { listing: LISTING }), 'missing_input');
  assert.equal(await kind('revise', { listing_external_id: 'x', changes: { price_cents: 2999 }, floor_cents: 3000 }), 'under_floor');
  assert.equal(await kind('answer_offer', { offer_id: 'o1', action: 'counter', amount_cents: 2000, floor_cents: 2500, received_at: '2026-11-15T00:00:00Z', now: '2026-11-15T01:00:00Z' }), 'under_floor');
  assert.equal(await kind('answer_offer', { offer_id: 'o1', action: 'accept', amount_cents: 2000, floor_cents: 2500, received_at: '2026-11-15T00:00:00Z', now: '2026-11-15T01:00:00Z' }), 'under_floor');
  assert.equal(await kind('make_offer', { listing_external_id: 'x', list_cents: 10000, offer_cents: 8000, floor_cents: 8500, shipping_discount: 'free' }), 'under_floor');
});

test('Poshmark rules: relist is never a fallback, Offer to Likers is 10% under with a shipping discount', async () => {
  assert.equal(code(await run('relist', { listing_external_id: 'x', operation_id: 'op' })).hint.kind, 'relist_penalized');
  const offer = { listing_external_id: 'x', list_cents: 10000, floor_cents: 5000, shipping_discount: 'reduced', operation_id: 'op' };
  assert.equal(code(await run('make_offer', { ...offer, offer_cents: 9100 })).hint.kind, 'seller_offer');
  assert.equal(code(await run('make_offer', { ...offer, offer_cents: 9000, lowest_cents: 9500 })).hint.kind, 'seller_offer');
  assert.equal(code(await run('make_offer', { ...offer, offer_cents: 9000, shipping_discount: undefined })).hint.kind, 'seller_offer');
  assert.equal(code(await run('make_offer', { ...offer, offer_cents: 9000, promised_elsewhere: true })).hint.kind, 'seller_offer');
  assert.equal(code(await run('post', { listing: { ...LISTING, price_cents: 299 }, floor_cents: 100, operation_id: 'op' })).hint.kind, 'invalid_listing');
  assert.equal(code(await run('send_message', { listing_external_id: 'x', text: ' ', operation_id: 'op' })).code, 'policy_refused');
  const dm = await run('send_message', { order_id: 'r1', text: 'Shipped today.', operation_id: 'op' });
  assert.ok(dm.ok, JSON.stringify(dm));
  assert.match((dm.data as { url: string }).url, /\/order\/sales\/r1$/);
});

test('the watch snapshot keeps unread sections undefined', async () => {
  const listings = rows(await run('read_listings', { username: 'u3797a192' }));
  const snap = toWatchSnapshot({ account_id: 'a', user_id: 'u', taken_at: '2026-11-15T00:00:00Z', listings });
  assert.equal(snap.site, 'poshmark');
  assert.equal(snap.route, 'public');
  assert.equal(snap.listings!.length, 3);
  assert.equal(snap.offers, undefined);
  assert.equal(snap.messages, undefined);
  const offers = rows(await run('read_offers', {}, client({ signed_in: true })));
  const messages = rows(await run('read_inbox', {}, client({ signed_in: true })));
  const signed = toWatchSnapshot({ account_id: 'a', user_id: 'u', taken_at: '2026-11-15T00:00:00Z', offers, messages });
  assert.equal(signed.route, 'signed_in');
  assert.equal(signed.offers![0].state, 'open');
  assert.deepEqual(signed.messages!.map(m => m.from), ['buyer', 'us']);
});
