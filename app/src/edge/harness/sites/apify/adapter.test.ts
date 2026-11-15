// The Apify lane on sanitized recordings (fixtures/, recorded 2026-11-15), plus every failure the API documents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createLog, memorySink } from '../../../../../../log/index.js';
import { ACTORS, MAX_CHARGE_USD, MAX_DETAILS, MAX_ITEMS, createApify, type Reply, type Send } from './adapter.ts';

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const TOKEN = 'apify_api_TESTtokenTESTtokenTESTtokenTESTtoken';
const reply = (status: number, text: string, headers: Record<string, string> = {}): Reply =>
  ({ status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, text: async () => text });
const apiError = (status: number, type: string, message = 'x') => reply(status, JSON.stringify({ error: { type, message } }));

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
function harness(answer: (sent: Sent) => Reply | Promise<Reply> = () => reply(201, fx('ebay-search.json')), token: string | undefined = TOKEN) {
  const sent: Sent[] = [];
  const send: Send = async (url, init) => {
    const s = { url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> };
    sent.push(s);
    return answer(s);
  };
  const sink = memorySink();
  const log = createLog({ src: 'test.apify', build: 'test', sink });
  return { apify: createApify({ token, send, log }), sent, sink };
}
const s = new AbortController().signal;

test('eBay: the sync endpoint, the token only in the Bearer header, item and spend caps in the query', async () => {
  const h = harness();
  const r = await h.apify.search('ebay', { q: 'Levi 501 jeans', limit: 50 }, s);
  assert.equal(r.ok, true);
  const u = new URL(h.sent[0].url);
  assert.equal(u.origin + u.pathname, `https://api.apify.com/v2/acts/${ACTORS.ebay}/run-sync-get-dataset-items`);
  assert.equal(u.searchParams.get('maxItems'), String(MAX_ITEMS));
  assert.equal(u.searchParams.get('maxTotalChargeUsd'), String(MAX_CHARGE_USD));
  assert.ok(Number(u.searchParams.get('timeout')) > 0);
  assert.ok(!h.sent[0].url.includes(TOKEN));
  assert.equal(h.sent[0].headers.authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(h.sent[0].body, { searchQueries: ['Levi 501 jeans'], marketplace: 'US', maxProductsPerSearch: MAX_ITEMS, maxSearchPages: 1 });
});

test('eBay rows: listing fields as given, no sold fields invented, a row without a price dropped and counted', async () => {
  const r = await harness().apify.search('ebay', { q: 'Levi 501 jeans' }, s);
  assert.ok(r.ok);
  assert.equal(r.data.rows.length, 4);
  assert.equal(r.data.dropped, 1);
  const raw = JSON.parse(fx('ebay-search.json')) as { itemId: string; price: number; title: string }[];
  const row = r.data.rows[0];
  assert.equal(row.id, `ebay:${raw[0].itemId}`);
  assert.equal(row.price_cents, Math.round(raw[0].price * 100));
  assert.equal(row.title, raw[0].title);
  assert.equal(row.currency, 'USD');
  assert.equal(row.condition, 'Pre-Owned');
  assert.match(row.url, /^https:\/\/www\.ebay\.com\/itm\//);
  for (const x of r.data.rows) {
    assert.equal(x.via, 'apify'); assert.equal(x.actor, ACTORS.ebay); assert.equal(x.may_model, false); assert.equal(x.use_scope, 'hackathon_demo');
    assert.ok(Number.isSafeInteger(x.price_cents));
    assert.equal(x.sold, undefined); assert.equal(x.sold_date, undefined); assert.equal(x.listed_at, undefined);
  }
});

test('Facebook search: the city search URL, no currency invented, the sold flag kept, no seller or place on a row', async () => {
  const h = harness(() => reply(201, fx('facebook-search.json')));
  const r = await h.apify.search('facebook', { q: 'office chair', city: 'chicago' }, s);
  assert.ok(r.ok);
  assert.ok(h.sent[0].url.includes(ACTORS.facebook));
  assert.deepEqual(h.sent[0].body, { startUrls: [{ url: 'https://www.facebook.com/marketplace/chicago/search?query=office%20chair' }], resultsLimit: MAX_ITEMS, includeListingDetails: false });
  assert.equal(r.data.rows.length, 4);
  assert.equal(r.data.rows[0].id, 'facebook:1000000000000001');
  assert.equal(r.data.rows[0].price_cents, 2000);
  assert.equal(r.data.rows[0].currency, undefined);
  assert.equal(r.data.rows[3].sold, true);
  assert.equal(r.data.rows[3].sold_date, undefined);
  for (const x of r.data.rows) {
    assert.equal(x.may_model, false); assert.equal(x.use_scope, 'hackathon_demo');
    assert.deepEqual(Object.keys(x).filter(k => /seller|location/.test(k)), []);
  }
});

test('Facebook details: fewer items, the listing date and condition and currency as given', async () => {
  const h = harness(() => reply(201, fx('facebook-details.json')));
  const r = await h.apify.search('facebook', { q: 'office chair', city: 'chicago', details: true }, s);
  assert.ok(r.ok);
  assert.equal(new URL(h.sent[0].url).searchParams.get('maxItems'), String(MAX_DETAILS));
  assert.equal(h.sent[0].body.resultsLimit, MAX_DETAILS);
  assert.equal(h.sent[0].body.includeListingDetails, true);
  const row = r.data.rows[0];
  assert.deepEqual([row.price_cents, row.currency, row.condition, row.listed_at], [1000, 'USD', 'Used - Fair', '2026-11-08T17:44:52.000Z']);
});

test('input: q is required, a Facebook city must be a slug, the query is never sent with a token', async () => {
  const h = harness();
  for (const [lane, a] of [['ebay', {}], ['facebook', { q: 'chair' }], ['facebook', { q: 'chair', city: '../x' }]] as const) {
    const r = await h.apify.search(lane, a, s);
    assert.ok(!r.ok); assert.equal(r.error.code, 'policy_refused');
  }
  assert.equal(h.sent.length, 0);
});

test('a missing token is auth_expired before any request; 401 and 403 are auth_expired', async () => {
  const none = harness(undefined, '');
  const r0 = await none.apify.search('ebay', { q: 'x' }, s);
  assert.ok(!r0.ok); assert.deepEqual([r0.error.code, r0.error.hint], ['auth_expired', { do: 'relink', site: 'apify' }]);
  assert.equal(none.sent.length, 0);
  for (const [st, type] of [[401, 'invalid-token'], [403, 'insufficient-permissions']] as const) {
    const r = await harness(() => apiError(st, type)).apify.search('ebay', { q: 'x' }, s);
    assert.ok(!r.ok); assert.equal(r.error.code, 'auth_expired');
  }
});

test('quota or payment is policy_refused apify_spend', async () => {
  for (const a of [apiError(402, 'x402-payment-required'), apiError(403, 'platform-feature-disabled', 'Monthly usage hard limit exceeded')]) {
    const r = await harness(() => a).apify.search('ebay', { q: 'x' }, s);
    assert.ok(!r.ok); assert.deepEqual([r.error.code, r.error.hint], ['policy_refused', { do: 'raise_decision', kind: 'apify_spend' }]);
  }
});

test('timeouts and rate limits are rate_limited; a caller abort is the caller\'s own', async () => {
  const t = await harness(() => apiError(408, 'run-timeout-exceeded')).apify.search('ebay', { q: 'x' }, s);
  assert.ok(!t.ok); assert.deepEqual([t.error.code, t.error.hint], ['rate_limited', { do: 'retry_after', after_s: 30 }]);
  const q = await harness(() => reply(429, '{}', { 'retry-after': '12' })).apify.search('ebay', { q: 'x' }, s);
  assert.ok(!q.ok); assert.deepEqual(q.error.hint, { do: 'retry_after', after_s: 12 });
  const d = await harness(() => { throw new DOMException('The operation timed out.', 'TimeoutError'); }).apify.search('ebay', { q: 'x' }, s);
  assert.ok(!d.ok); assert.equal(d.error.code, 'rate_limited');
  const ac = new AbortController(); ac.abort(new Error('caller left'));
  await assert.rejects(harness(() => { throw ac.signal.reason; }).apify.search('ebay', { q: 'x' }, ac.signal), /caller left/);
});

test('a failed run, a 5xx and a dataset of only error items are blocked; an empty dataset is ok and empty', async () => {
  const fb = { q: 'chair', city: 'chicago' };
  for (const a of [apiError(400, 'run-failed'), reply(502, 'bad gateway'), reply(201, JSON.stringify([{ url: 'u', error: 'blocked', errorDescription: 'login wall' }]))]) {
    const r = await harness(() => a).apify.search('facebook', fb, s);
    assert.ok(!r.ok); assert.deepEqual([r.error.code, r.error.hint], ['blocked', { do: 'pause_session', site: 'apify' }]);
  }
  const e = await harness(() => reply(201, '[]')).apify.search('facebook', fb, s);
  assert.ok(e.ok); assert.deepEqual([e.data.rows, e.data.dropped], [[], 0]);
});

test('a changed output shape is page_changed naming what is missing', async () => {
  const notList = await harness(() => reply(201, '{"data":1}')).apify.search('ebay', { q: 'x' }, s);
  assert.ok(!notList.ok); assert.equal(notList.error.code, 'page_changed');
  const renamed = await harness(() => reply(201, JSON.stringify([{ id: '1', cost: 5 }]))).apify.search('ebay', { q: 'x' }, s);
  assert.ok(!renamed.ok); assert.deepEqual(renamed.error.hint, { do: 'author', missing: ['itemId', 'price'] });
  const badInput = await harness(() => apiError(400, 'invalid-input')).apify.search('ebay', { q: 'x' }, s);
  assert.ok(!badInput.ok); assert.equal(badInput.error.code, 'page_changed');
});

test('one run per actor at a time: a second eBay call waits, a Facebook call does not', async () => {
  let open = 0, most = 0, release: () => void = () => {};
  const gate = new Promise<void>(r => { release = r; });
  const h = harness(async x => {
    open++; most = Math.max(most, open);
    if (x.url.includes(ACTORS.ebay)) await gate;
    open--;
    return reply(201, x.url.includes(ACTORS.ebay) ? fx('ebay-search.json') : fx('facebook-search.json'));
  });
  const a = h.apify.search('ebay', { q: 'a' }, s), b = h.apify.search('ebay', { q: 'b' }, s);
  const f = await h.apify.search('facebook', { q: 'c', city: 'chicago' }, s);
  assert.ok(f.ok);
  assert.equal(h.sent.filter(x => x.url.includes(ACTORS.ebay)).length, 1);
  release(); await Promise.all([a, b]);
  assert.equal(h.sent.length, 3);
  assert.equal(most, 2); // the waiting eBay call plus the Facebook one, never two eBay runs
});

test('the token never reaches a log line, an error message or a throw', async () => {
  const echo = `token ${TOKEN} rejected`;
  const cases: (() => Reply)[] = [() => apiError(401, 'invalid-token', echo), () => reply(502, echo), () => reply(201, echo), () => { throw new Error(echo); }];
  for (const a of cases) {
    const h = harness(a);
    const r = await h.apify.search('ebay', { q: 'x' }, s).catch((e: unknown) => ({ thrown: String(e instanceof Error ? e.stack : e) }));
    assert.ok(!JSON.stringify(r).includes(TOKEN), JSON.stringify(r));
    assert.ok(!h.sink.text().includes(TOKEN));
    assert.ok(h.sent.every(x => !x.url.includes(TOKEN)));
  }
});

test('only search has a route', async () => {
  const r = await harness().apify.call('post', {}, s);
  assert.ok(!r.ok); assert.equal(r.error.code, 'no_route');
});
