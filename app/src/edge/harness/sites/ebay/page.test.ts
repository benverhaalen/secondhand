// eBay page lane on recorded, masked pages (fixtures/page-*.html, recorded 2026-11-15). Run: node --test --test-concurrency=1 app/src/edge/harness/sites/ebay/page.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ebayPageAdapters, readItemPage, stillUpPage, URLS, type PageClient, type EbayPage } from './adapter.ts';

const html = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const signal = new AbortController().signal;

// A client that serves one recorded page per URL and counts loads.
function client(pages: Record<string, EbayPage>, signed_in = false) {
  const seen: string[] = [];
  const c: PageClient = { signed_in, page: async url => { seen.push(url); const p = pages[url]; if (!p) throw new Error(`no fixture for ${url}`); return p; } };
  return { c, seen };
}
const ok = (f: string): EbayPage => ({ status: 200, html: html(f) });
const run = (c: PageClient, verb: string, a: Record<string, unknown>) => {
  const ad = ebayPageAdapters(c).find(x => x.manifest.verb === verb);
  if (!ad) throw new Error(`no page route for ${verb}`);
  return ad.run(a, signal);
};

test('page routes are ebay.<verb>.page with route_kind page, search and read_storefront only', () => {
  const ads = ebayPageAdapters(client({}).c);
  assert.deepEqual(ads.map(a => a.route_id).sort(), ['ebay.read_storefront.page', 'ebay.search.page']);
  for (const a of ads) assert.equal(a.manifest.route_kind, 'page');
});

test('search reads the real cards in integer cents and skips the placeholder card', async () => {
  const { c } = client({ [URLS.search('levis 501 jeans', false)]: ok('page-search.html') });
  const r = await run(c, 'search', { q: 'levis 501 jeans' });
  assert.ok(r.ok, JSON.stringify(r));
  const rows = r.data as Record<string, unknown>[];
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { external_id: '387080178732', item_id: '387080178732', title: 'Levi 501 XX Vintage 90s  50 x 32 blue dark',
    url: 'https://www.ebay.com/itm/387080178732', state: 'live', price_cents: 3900, currency: 'USD', host: 'www.ebay.com' });
  assert.deepEqual(rows.map(x => x.price_cents), [3900, 6492, 2500]);
  for (const x of rows) assert.ok(Number.isInteger(x.price_cents) && !/Opens in a new window/.test(String(x.title)));
});

test('zero results is an empty list, never the fuzzy "fewer words" cards', async () => {
  const { c } = client({ [URLS.search('qqzxqqzxqqzx vvbnm', false)]: ok('page-empty.html') });
  assert.deepEqual(await run(c, 'search', { q: 'qqzxqqzxqqzx vvbnm' }), { ok: true, data: [] });
});

test('sold search with no linked session answers relink without loading a page', async () => {
  const { c, seen } = client({});
  const r = await run(c, 'search', { q: 'levis 501 jeans', status: 'sold' });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.error.code === 'auth_expired' && r.error.hint.do === 'relink');
  assert.equal(seen.length, 0);
});

test('the Sign in or Register page is auth_expired, never zero results or page_changed', async () => {
  const { c } = client({ [URLS.search('levis 501 jeans', true)]: ok('page-sold-signin.html') }, true);
  const r = await run(c, 'search', { q: 'levis 501 jeans', status: 'sold' });
  assert.ok(!r.ok && r.error.code === 'auth_expired' && r.error.hint.do === 'relink', JSON.stringify(r));
});

test('a bot check is blocked and the page is not parsed; a 403 is blocked', async () => {
  const u = URLS.search('levis 501 jeans', false);
  for (const p of [{ status: 200, html: '<title>Pardon Our Interruption...</title>' }, { status: 200, html: html('page-search.html'), challenge: true }, { status: 403, html: 'Access Denied' }]) {
    const r = await run(client({ [u]: p }).c, 'search', { q: 'levis 501 jeans' });
    assert.ok(!r.ok && r.error.code === 'blocked' && r.error.hint.do === 'pause_session', JSON.stringify(r));
  }
});

// eBay's error page as served 2026-11-15 (title "Error Page | eBay", 403); the UK page is the US fixture with pound prices (synthesized, not recorded).
const errorPage: EbayPage = { status: 403, html: '<title>Error Page | eBay</title><p>Something went wrong on our end</p>' };
const ukPage: EbayPage = { status: 200, html: html('page-search.html').replaceAll('$', '£') };

test('an error page on ebay.com moves to ebay.co.uk with the US filter, after a pause; the row says which host and that the price is converted', async () => {
  const q = 'levis 501 jeans';
  assert.match(URLS.search(q, false, 1), /^https:\/\/www\.ebay\.co\.uk\/sch\/i\.html\?.*_salic=1&LH_LocatedIn=1/);
  const { c, seen } = client({ [URLS.search(q, false)]: errorPage, [URLS.search(q, false, 1)]: ukPage });
  const t0 = Date.now();
  const r = await run(c, 'search', { q });
  assert.ok(Date.now() - t0 >= 4900, 'hosts are not tried back to back');
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(seen, [URLS.search(q, false), URLS.search(q, false, 1)]);
  const row = (r.data as Record<string, unknown>[])[0];
  assert.deepEqual({ price_cents: row?.price_cents, currency: row?.currency, converted: row?.converted, host: row?.host, url: row?.url },
    { price_cents: 3900, currency: 'GBP', converted: true, host: 'www.ebay.co.uk', url: 'https://www.ebay.com/itm/387080178732' });
});

test('ebay.com serving means one load; an error page on the last host is blocked; sold is relink on every host', async () => {
  const q = 'levis 501 jeans';
  const one = client({ [URLS.search(q, false)]: ok('page-search.html') });
  await run(one.c, 'search', { q });
  assert.equal(one.seen.length, 1);
  const r = await run(client({ [URLS.search(q, false)]: errorPage, [URLS.search(q, false, 1)]: errorPage }).c, 'search', { q });
  assert.ok(!r.ok && r.error.code === 'blocked', JSON.stringify(r));
  const s = await run(client({ [URLS.search(q, true)]: errorPage, [URLS.search(q, true, 1)]: ok('page-sold-signin.html') }, true).c, 'search', { q, status: 'sold' });
  assert.ok(!s.ok && s.error.code === 'auth_expired' && s.error.hint.do === 'relink', JSON.stringify(s));
});

test('one listing reads the JSON-LD product in cents, with watchers', async () => {
  const { c } = client({ [URLS.item('387080178732')]: ok('page-item.html') });
  const r = await readItemPage(c, '387080178732', signal);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data, { external_id: '387080178732', item_id: '387080178732', title: 'Levi 501 XX Vintage 90s  50 x 32 blue dark',
    url: 'https://www.ebay.com/itm/387080178732', state: 'live', price_cents: 3900, currency: 'USD', watchers: 6 });
});

test('a missing listing is not_found; still-up says gone', async () => {
  const { c } = client({ [URLS.item('100000000000')]: { status: 404, html: html('page-item-404.html') }, [URLS.item('387080178732')]: ok('page-item.html') });
  const r = await readItemPage(c, '100000000000', signal);
  assert.ok(!r.ok && r.error.code === 'not_found' && r.error.hint.do === 'reconcile');
  assert.deepEqual(await stillUpPage(c, '100000000000', signal), { ok: true, data: { state: 'gone' } });
  assert.deepEqual(await stillUpPage(c, '387080178732', signal), { ok: true, data: { state: 'live' } });
});

test('the storefront reads rating, reviews, sold count from the public profile', async () => {
  const { c } = client({ [URLS.store('seller_a')]: ok('page-store.html') });
  const r = await run(c, 'read_storefront', { username: 'seller_a' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data, { rating: 93.6, review_count: 267, sold_count: 658, followers: 66, joined_at: 'Mar 19, 2023' });
});

test('an unknown seller is not_found; a bad username loads nothing', async () => {
  const { c, seen } = client({ [URLS.store('nobody_here')]: ok('page-store-404.html') });
  const r = await run(c, 'read_storefront', { username: 'nobody_here' });
  assert.ok(!r.ok && r.error.code === 'not_found', JSON.stringify(r));
  const bad = await run(c, 'read_storefront', { username: '../x' });
  assert.ok(!bad.ok && bad.error.code === 'policy_refused');
  assert.equal(seen.length, 1);
});
