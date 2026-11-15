// eBay page lane on recorded, masked pages (fixtures/page-*.html, recorded 2026-11-15). Run: node --test --test-concurrency=1 app/src/edge/harness/sites/ebay/page.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ebayPageAdapters, readItemPage, stillUpPage, URLS, PAGE_HOSTS, type PageClient, type EbayPage } from './adapter.ts';

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

test('active and sold URLs request 240 results on every page host without changing the other parameters', () => {
  for (const [i, host] of PAGE_HOSTS.entries()) for (const sold of [false, true]) {
    const url = new URL(URLS.search('levis 501 jeans', sold, i));
    assert.equal(url.origin, host.www);
    assert.equal(url.pathname, '/sch/i.html');
    assert.deepEqual(Object.fromEntries(url.searchParams), { _nkw: 'levis 501 jeans', _ipg: '240', ...host.params,
      ...(sold ? { LH_Sold: '1', LH_Complete: '1' } : {}) });
  }
});

test('search reads the real cards in integer cents and skips the placeholder card', async () => {
  const { c } = client({ [URLS.search('levis 501 jeans', false)]: ok('page-search.html') });
  const r = await run(c, 'search', { q: 'levis 501 jeans' });
  assert.ok(r.ok, JSON.stringify(r));
  const rows = r.data as Record<string, unknown>[];
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { external_id: '387080178732', item_id: '387080178732', title: 'Levi 501 XX Vintage 90s  50 x 32 blue dark',
    url: 'https://www.ebay.com/itm/387080178732', state: 'live', price_cents: 3900, currency: 'USD', host: 'www.ebay.com',
    condition: 'Pre-Owned', size: '51 in x 32 in', brand: "Levi's", shipping_cents: 1002, ships_from: 'United States', best_offer: true, sponsored: true, rank: 1 });
  assert.equal(rows[1]!.shipping_cents, 0);
  assert.equal(rows[1]!.buying_format, 'Buy It Now');
  assert.deepEqual(Reflect.get(r, 'yield'), { rows: 3, dropped: 0, facts: 48 });
  assert.deepEqual(rows.map(x => x.price_cents), [3900, 6492, 2500]);
  for (const x of rows) assert.ok(Number.isInteger(x.price_cents) && !/Opens in a new window/.test(String(x.title)));
});

test('zero results is an empty list, never the fuzzy "fewer words" cards', async () => {
  const { c } = client({ [URLS.search('qqzxqqzxqqzx vvbnm', false)]: ok('page-empty.html') });
  assert.deepEqual(await run(c, 'search', { q: 'qqzxqqzxqqzx vvbnm' }), { ok: true, data: [], yield: { rows: 0, dropped: 0, facts: 0 } });
});

// Cut at card starts rather than </li>: the recordings contain nested carousel list items.
const recordedCards = () => html('page-search.html').split(/(?=<li\b[^>]*class="s-card\s)/).slice(2).map(c => c.replace(/<\/ul>\s*<\/body>[\s\S]*$/, ''));
const cardPage = (cards: string[]) => `<h1 class="srp-results-heading">${cards.length} results</h1><ul>${cards.join('')}</ul>`;

test('an incomplete card is dropped and counted without losing the other cards', async () => {
  const cards = recordedCards();
  const page = cardPage([cards[0]!, cards[1]!.replace(/data-listingid="\d+"/, '').replaceAll(/\/itm\/\d+/g, '/itm/'),
    cards[2]!.replace('s-card__price', 'missing-price')]);
  const r = await run({ signed_in: false, page: async () => ({ status: 200, html: page }) }, 'search', { q: 'x' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal((r.data as unknown[]).length, 1);
  assert.deepEqual(Reflect.get(r, 'yield'), { rows: 1, dropped: 2, facts: 16 });
});

test('range, auction, dates and image variants retain explicit facts without seller information', async () => {
  // Synthetic variants of a recorded card, not evidence that these values were served in the recording.
  const card = recordedCards()[0]!.replace('$39.00', '$39.00 to $49.00')
    .replace('or Best Offer', 'Auction · 12 bids · 5 sold · 8 watchers · Listed Nov 14, 2026 · Sold Nov 15, 2026')
    .replace('href="https://www.ebay.com/itm/387080178732"', 'href="https://www.ebay.com/itm/387080178732?tracking=1"')
    .replace('<div class="su-image">', '<div class="su-image"><img class="s-card__image" src="https://i.ebayimg.com/item.jpg">');
  const r = await run({ signed_in: true, page: async () => ({ status: 200, html: cardPage([card]) }) }, 'search', { q: 'x', status: 'sold' });
  assert.ok(r.ok, JSON.stringify(r));
  const row = (r.data as Record<string, unknown>[])[0]!;
  assert.deepEqual([row.price_cents, row.price_high_cents, row.currency, row.buying_format, row.bid_count, row.sold_count, row.watchers],
    [3900, 4900, 'USD', 'Auction', 12, 5, 8]);
  assert.deepEqual([row.listed_at, row.sold_at, row.image_url, row.url], ['Nov 14, 2026', 'Nov 15, 2026', 'https://i.ebayimg.com/item.jpg', 'https://www.ebay.com/itm/387080178732']);
  assert.equal(row.best_offer, undefined);
  assert.ok(!Object.keys(row).some(k => /seller|feedback/.test(k)));
});

test('a bid row identifies the auction format, and a country and date in subtitles are kept', async () => {
  const card = recordedCards()[0]!.replace('or Best Offer', '0 bids').replace('Pre-Owned', 'Very Good')
    .replace('<div class="s-card__subtitle-row">', '<div class="s-card__subtitle-row"><div class="s-card__subtitle">Listed Nov 14, 2026</div>');
  const r = await run({ signed_in: false, page: async () => ({ status: 200, html: cardPage([card]) }) }, 'search', { q: 'x' });
  assert.ok(r.ok);
  const row = (r.data as Record<string, unknown>[])[0]!;
  assert.deepEqual([row.buying_format, row.bid_count, row.condition, row.listed_at], ['Auction', 0, 'Very Good', 'Nov 14, 2026']);
});

test('unsafe cents are dropped, and the last card cannot read facts from outside its li', async () => {
  const cards = recordedCards();
  const page = cardPage([cards[0]!.replace('$39.00', `$${'9'.repeat(40)}.00`), cards[1]!]) + '<span>99 watchers · Sold Nov 15, 2026</span>';
  const r = await run({ signed_in: false, page: async () => ({ status: 200, html: page }) }, 'search', { q: 'x' });
  assert.ok(r.ok, JSON.stringify(r));
  const rows = r.data as Record<string, unknown>[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.watchers, undefined);
  assert.deepEqual(Reflect.get(r, 'yield'), { rows: 1, dropped: 1, facts: 16 });
});

test('a large but safe decimal price keeps the exact cents shown', async () => {
  const card = recordedCards()[0]!.replace('$39.00', '$70368744177664.01');
  const r = await run({ signed_in: false, page: async () => ({ status: 200, html: cardPage([card]) }) }, 'search', { q: 'x' });
  assert.ok(r.ok);
  assert.equal((r.data as Record<string, unknown>[])[0]!.price_cents, 7036874417766401);
});

test('242 recorded cards parse under 150 ms; p50 over 10 reads', async t => {
  const cards = recordedCards();
  const page = cardPage(Array.from({ length: 242 }, (_, i) => cards[i % cards.length]!));
  const c: PageClient = { signed_in: false, page: async () => ({ status: 200, html: page }) };
  const times: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const r = await run(c, 'search', { q: 'x' });
    times.push(performance.now() - start);
    assert.ok(r.ok, JSON.stringify(r));
    assert.equal((r.data as unknown[]).length, 242);
    assert.deepEqual(Reflect.get(r, 'yield'), { rows: 242, dropped: 0, facts: 3872 });
  }
  times.sort((a, b) => a - b);
  const p50 = (times[4]! + times[5]!) / 2;
  t.diagnostic(`242 cards, ${Buffer.byteLength(page)} bytes, 10 runs: p50 ${p50.toFixed(2)} ms; range ${times[0]!.toFixed(2)}–${times[9]!.toFixed(2)} ms`);
  assert.ok(times[9]! < 150, `slowest parse ${times[9]} ms`);
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
