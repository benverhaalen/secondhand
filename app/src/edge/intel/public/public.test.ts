import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHarness, SITES } from '../../harness/protocol.ts';
import { memoryAccounts, memoryVault } from '../../browser/auth.ts';
import { mercariAdapters, type Page as MercariPage } from '../../harness/sites/mercari/adapter.ts';
import { createFetcher } from '../fetch.ts';
import type { FetchOpts, PageResult } from '../fetch.ts';
import { readPage, searchUrl, BASE } from './readers.ts';
import { searchAll as runSearchAll, searchSite, searchSource, type SearchOpts } from './search.ts';
import { SOURCES } from './sources.ts';
import { _reset } from '../run.ts';

beforeEach(() => _reset());

const searchAll = (query: string, opts: SearchOpts = {}) => runSearchAll(query, { sources: SOURCES.filter(s => s.id !== 'dupe'), ...opts });

const FX = new URL('../../../../../spec/fixtures/pages/', import.meta.url);
const fx = (n: string) => readFileSync(new URL(n, FX), 'utf8');
const page = (html: string, status = 200): PageResult => ({ ok: true, html, status, final_url: '', rung: 'plain', ms: 1, searched: [] });
const poshFixture = (name: string) => readFileSync(new URL(`../../harness/sites/poshmark/fixtures/${name}`, import.meta.url), 'utf8');

for (const [name, expected] of [
  ['search.html', { rows: 3, dropped: 0, facts: 39 }],
  ['search-sold.html', { rows: 3, dropped: 0, facts: 41 }],
  ['search-empty.html', { rows: 0, dropped: 0, facts: 0 }],
] as const) test(`Poshmark ${name} keeps every state listing and pins its yield`, () => {
  const r = readPage('poshmark', poshFixture(name));
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(Reflect.get(r, 'yield'), expected);
  if (r.data.length) {
    assert.equal(r.data[0]!.brand, name === 'search.html' ? "Levi's" : "Levi's 501 Original Fit Jeans");
    assert.equal(r.data[0]!.likes, name === 'search.html' ? 5 : 6);
    assert.equal(r.data[0]!.original_price_cents, 0);
    assert.ok(r.data.every(row => !Object.keys(row).some(k => /seller|creator/.test(k))));
  }
});

test('Poshmark markup fixture keeps all twelve cards and reports its yield', () => {
  const r = readPage('poshmark', fx('poshmark.html'));
  assert.ok(r.ok);
  assert.deepEqual(Reflect.get(r, 'yield'), { rows: 12, dropped: 0, facts: 60 });
});

test('Poshmark listing state keeps original price and counts without keeping comments or handles', () => {
  const r = readPage('poshmark', poshFixture('listing.html'));
  assert.ok(r.ok);
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0]!.original_price_cents, 27600);
  assert.equal(r.data[0]!.comments, 11);
  assert.equal(r.data[0]!.shares, 16);
  assert.deepEqual(Reflect.get(r, 'yield'), { rows: 1, dropped: 0, facts: 13 });
});

test('Poshmark keeps incomplete cards counted and never rounds unsafe or fractional cents into a price', () => {
  const input = poshFixture('search.html').replace('"val":"34.0"', `"val":"${'9'.repeat(40)}"`).replace('"val":"37.0"', '"val":"37.001"');
  const r = readPage('poshmark', input);
  assert.ok(r.ok, JSON.stringify(r));
  assert.deepEqual(r.data.map(row => row.price_cents), [3000]);
  assert.equal(r.dropped, 2);
  assert.deepEqual(Reflect.get(r, 'yield'), { rows: 1, dropped: 2, facts: 13 });
  const broken = readPage('poshmark', poshFixture('search.html').replaceAll(/"val":"[^"]+"/g, '"val":"invalid"'));
  assert.ok(!broken.ok && broken.error.code === 'page_changed');
  assert.deepEqual(Reflect.get(broken, 'yield'), { rows: 0, dropped: 3, facts: 0 });
});

test('Poshmark decimal conversion preserves every cent below the safe integer bound', () => {
  const r = readPage('poshmark', poshFixture('search.html').replace('"val":"34.0"', '"val":"70368744177664.01"'));
  assert.ok(r.ok);
  assert.equal(r.data[0]!.price_cents, 7036874417766401);
});

test('Poshmark unions distinct state and markup listings and merges duplicate cards once', () => {
  const markup = fx('poshmark.html');
  const r = readPage('poshmark', poshFixture('search.html') + markup + markup);
  assert.ok(r.ok);
  assert.equal(r.data.length, 15);
  assert.deepEqual(Reflect.get(r, 'yield'), { rows: 15, dropped: 0, facts: 99 });
});

test('Poshmark reads structured sizes and catalog names when present, without deriving facts from titles', () => {
  // Synthetic field-shape variant of recorded state; catalog and size_obj paths are recorded in scripts/demo/want.mjs.
  const input = poshFixture('search.html').replace('"size":"36"', '"inventory_sizes_unused":[],"size_obj":{"display":"L"},"catalog":{"category_obj":{"display":"Jeans"}}');
  const r = readPage('poshmark', input);
  assert.ok(r.ok);
  assert.equal(r.data[0]!.size, 'L');
  assert.equal(r.data[0]!.category, 'Jeans');
  assert.equal(r.data[1]!.category, undefined);
});

test('Poshmark keeps markup fields bounded to their card and merges state with the same listing', () => {
  const card = fx('poshmark.html').split('\n')[1]!;
  const enriched = card.replace('</a>', `<span class="tile-grid-redesign__size">25</span><span class="tile-grid-redesign__brand">Levi's</span>
    <span class="tile-grid-redesign__condition">Used</span><span class="tile-grid-redesign__category">Jeans</span>
    <span class="tile-grid-redesign__price-original">$80</span><span class="tile-grid-redesign__listed-date">Nov 14, 2026</span>
    <span data-like-count="0"></span></a>`);
  const input = enriched + '<span class="tile-grid-redesign__brand">Outside card</span>';
  const r = readPage('poshmark', input);
  assert.ok(r.ok);
  const row = r.data[0]!;
  assert.deepEqual([row.size, row.brand, row.condition, row.category, row.original_price_cents, row.likes, row.listed_at],
    ['25', "Levi's", 'Used', 'Jeans', 8000, 0, 'Nov 14, 2026']);
  const outside = readPage('poshmark', card + '<span class="tile-grid-redesign__brand">Outside card</span>');
  assert.ok(outside.ok);
  assert.equal(outside.data[0]!.brand, undefined);
  const stateId = '6af585a12800acd3211cf7ba';
  const merged = readPage('poshmark', poshFixture('search.html') + enriched.replace(/6af924447625b11bb42ec837/g, stateId));
  assert.ok(merged.ok);
  assert.equal(merged.data.length, 3);
  assert.equal(merged.data.find(row => row.id === stateId)!.price_cents, 3400);
  assert.equal(merged.data.find(row => row.id === stateId)!.category, 'Jeans');
});

for (const site of ['ebay', 'poshmark', 'mercari', 'depop', 'facebook'] as const) {
  test(`${site} reader matches its fixture`, () => {
    const exp = JSON.parse(fx(`${site}.expected.json`)) as { items: { id: string; title: string; price_cents: number; url: string }[] };
    const r = readPage(site, fx(`${site}.html`));
    assert.ok(r.ok);
    assert.equal(r.data.length, exp.items.length);
    r.data.forEach((row, i) => {
      const e = exp.items[i]!;
      assert.deepEqual([row.id, row.title, row.price_cents, row.url], [e.id, e.title, e.price_cents, new URL(e.url, BASE[site]).href]);
      assert.equal(row.currency, 'USD');
      assert.equal(row.sold, undefined);
    });
  });
}

const OFFERUP = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { searchFeedResponse: { looseTiles: [
  { googleDisplayAd: { searchId: 'x' } },
  { listing: { listingId: 'e9a6d5e8-34e7', title: '2 pair Levi Jeans 32', price: '45', conditionText: null, image: { url: 'https://images.offerup.com/a.jpg' } } },
  { listing: { listingId: 'f1', title: 'Levi 501', price: '12.50', conditionText: 'Used - good', image: null } },
] } } } })}</script>`;

test('offerup reader reads the embedded state and skips ads; absent fields stay absent', () => {
  const r = readPage('offerup', OFFERUP);
  assert.ok(r.ok);
  assert.deepEqual(r.data[0], { id: 'e9a6d5e8-34e7', url: 'https://offerup.com/item/detail/e9a6d5e8-34e7', title: '2 pair Levi Jeans 32', price_cents: 4500, currency: 'USD', image_url: 'https://images.offerup.com/a.jpg' });
  assert.equal(r.data[1]!.price_cents, 1250);
  assert.equal(r.data[1]!.condition, 'Used - good');
  assert.ok(!('image_url' in r.data[1]!));
});

test('a sold search marks rows sold; zero cards with no links is ok and empty', () => {
  const r = readPage('ebay', fx('ebay.html'), 'sold');
  assert.ok(r.ok && r.data.every(x => x.sold === true));
  const e = readPage('mercari', '<html>no results</html>');
  assert.ok(e.ok && e.data.length === 0);
});

test('field gate: a card without a price is page_changed naming price_cents, never partial rows', () => {
  const broken = fx('depop.html').replace(/<p aria-description="Price">[^<]*<\/p>/g, '');
  const r = readPage('depop', broken);
  assert.ok(!r.ok && r.error.code === 'page_changed');
  assert.deepEqual(r.error.hint, { do: 'author', missing: ['price_cents'] });
});

test('field gate: item links but no readable card is page_changed on every required field', () => {
  const r = readPage('poshmark', '<html><a href="/listing/Some-Thing-6af924447625b11bb42ec837">x</a></html>');
  assert.ok(!r.ok && r.error.code === 'page_changed');
  assert.deepEqual(r.error.hint, { do: 'author', missing: ['id', 'title', 'price_cents', 'url'] });
  const o = readPage('offerup', '<script id="__NEXT_DATA__">{not json</script>');
  assert.ok(!o.ok && o.error.code === 'page_changed');
});

test('sold search has a url only where the site shows sold signed out', () => {
  assert.match(searchUrl('ebay', 'levi 501', 'sold')!, /LH_Sold=1/);
  assert.match(searchUrl('poshmark', 'levi 501', 'sold')!, /sold_out/);
  assert.equal(searchUrl('depop', 'levi 501', 'sold'), null);
  assert.equal(searchUrl('ebay', 'levi 501', 'search'), 'https://www.ebay.com/sch/i.html?_nkw=levi%20501');
});

test('searchAll queries approved public sources in parallel and maps outcomes per site', async () => {
  let live = 0, peak = 0;
  const requested: string[] = [];
  const fetchPage = async (url: string, _o: FetchOpts): Promise<PageResult> => {
    requested.push(url);
    live++; peak = Math.max(peak, live);
    await new Promise(r => setTimeout(r, 40));
    live--;
    const site = SITES.find(s => url.startsWith(BASE[s]))!;
    if (site === 'offerup') return page(OFFERUP);
    if (site === 'facebook') return page('<html><form action="/login">Log in</form></html>');
    if (site === 'depop') return page(fx('depop.html').replace(/aria-description="Price"/g, 'x="1"'));
    return page(fx(`${site}.html`));
  };
  const t0 = performance.now();
  const r = await searchAll('levi 501', { fetchPage, sources: [...SOURCES.filter(s => s.id !== 'dupe'),
    { pace: { per_minute: 20, min_gap_ms: 3000 }, id: 'offerup', site: 'offerup', lane: 'public_page', covers: ['offerup'], needs_ask: false, on: true }] });
  assert.equal(peak, 2);
  assert.ok(performance.now() - t0 < 40 * 3);
  const by = Object.fromEntries(r.searched.map(s => [s.site, s]));
  assert.deepEqual(Object.keys(by).sort(), ['depop', 'ebay', 'mercari', 'offerup', 'poshmark']);
  assert.deepEqual(requested.map(url => SITES.find(site => url.startsWith(BASE[site]))).sort(), ['offerup', 'poshmark']);
  assert.equal(by.facebook, undefined);
  assert.equal(by.depop!.outcome, 'failed');
  assert.equal(by.depop!.error_code, 'no_route');
  assert.equal(by.poshmark!.outcome, 'hit');
  assert.equal(r.results.length, by.poshmark!.count + by.offerup!.count);
  assert.ok(r.results.every(x => x.row.id && x.row.price_cents !== undefined));
});

test('individual readers retain blocked, timeout and OfferUp hit outcomes outside source fanout', async () => {
  const blocked = await searchSite('ebay', 'levi 501', 'search', { fetchPage: async () => ({ ok: false, kind: 'blocked', reason: '403', status: 403, ms: 1, searched: [] }) });
  assert.equal(blocked.searched.outcome, 'blocked');
  assert.deepEqual(blocked.rows, []);
  const timeout = await searchSite('grailed', 'levi 501', 'search', { fetchPage: async () => ({ ok: false, kind: 'timeout', reason: 'slow', ms: 1, searched: [] }) });
  assert.equal(timeout.searched.outcome, 'timeout');
  assert.deepEqual(timeout.rows, []);
  const hit = await searchSite('offerup', 'levi 501', 'search', { fetchPage: async () => page(OFFERUP) });
  assert.equal(hit.searched.outcome, 'hit');
  assert.equal(hit.searched.count, 2);
  assert.equal(hit.rows.length, 2);
});

test('eBay active search is enabled only through its browser harness', async () => {
  const ebay = SOURCES.find(source => source.id === 'ebay')!;
  assert.equal(ebay.on, true); assert.equal(ebay.lane, 'harness'); assert.equal(ebay.needs_ask, false);
  const fetchPage = async (): Promise<PageResult> => { assert.fail('eBay never uses anonymous page fetch'); };
  const direct = await searchSource(ebay, 'levi 501', 'search', { caller: 'person', fetchPage });
  assert.deepEqual(direct.rows, []);
  assert.equal(direct.searched.outcome, 'failed');
  assert.equal(direct.searched.error_code, 'no_route');
});

test('Mercari uses only the asking person’s linked account and never anonymous page fetch', async () => {
  const vault = memoryVault();
  await vault.put('test-mercari', { cookies: [], origins: [] });
  const account = { account_id: 'acc_search', person_id: 'person_search', site: 'mercari' as const, token_ref: 'test-mercari' };
  const accounts = memoryAccounts([account], vault);
  const recording = JSON.parse(readFileSync(new URL('../../harness/sites/mercari/fixtures/search.json', import.meta.url), 'utf8')) as MercariPage;
  let reads = 0;
  const harness = createHarness({ accounts, adapters: mercariAdapters({ signed_in: true, page: async () => { reads++; return recording; } }) });
  const opts = { sites: ['mercari'] as const, person_id: account.person_id, accounts, harness,
    fetchPage: async (): Promise<PageResult> => { assert.fail('Mercari must use the linked harness'); } };
  const visitor = await searchAll('carhartt hoodie', opts);
  assert.deepEqual(visitor.results, []);
  assert.equal(visitor.searched[0]!.outcome, 'needs_account');
  for (const overrides of [
    { person_id: undefined },
    { accounts: undefined },
    { person_id: 'person_other' },
    { person_id: 'person_other', accounts: { ...accounts, linked: async () => [account] } },
  ]) {
    const denied = await searchAll('carhartt hoodie', { ...opts, ...overrides, caller: 'person' });
    assert.deepEqual(denied.results, []);
    assert.equal(denied.searched[0]!.outcome, 'needs_account');
    assert.equal(denied.searched[0]!.reason, 'needs your account');
  }
  assert.equal(reads, 0);
  const allowed = await searchAll('carhartt hoodie', { ...opts, caller: 'person' });
  assert.equal(reads, 1);
  assert.equal(allowed.searched[0]!.outcome, 'hit');
  assert.ok(allowed.results.length > 0);
  assert.equal(allowed.searched[0]!.count, allowed.results.length);
  assert.ok(allowed.results.every(result => result.site === 'mercari'));
});

test('searchAll with search+sold never fetches Depop pages and reports its unavailable harness', async () => {
  const urls: string[] = [];
  const r = await searchAll('levi 501', { sites: ['depop', 'poshmark', 'ebay'], kinds: ['search', 'sold'], fetchPage: async u => { urls.push(u); return page(fx('poshmark.html')); } });
  assert.deepEqual(urls.sort(), [searchUrl('poshmark', 'levi 501', 'search'), searchUrl('poshmark', 'levi 501', 'sold')].sort());
  assert.equal(r.searched.find(s => s.site === 'ebay' && s.kind === 'search')!.error_code, 'no_route');
  assert.equal(r.searched.find(s => s.site === 'ebay' && s.kind === 'sold')!.outcome, 'needs_account');
  assert.equal(r.searched.find(s => s.site === 'poshmark' && s.kind === 'sold')!.outcome, 'hit');
  const d = r.searched.find(s => s.site === 'depop' && s.kind === 'sold')!;
  assert.equal(d.outcome, 'failed');
  assert.equal(d.error_code, 'no_route');
});

test('429 backs off (Retry-After clamped to the ceiling) and then reads the page', async () => {
  let calls = 0;
  const fetchImpl = (async () => (++calls < 3
    ? new Response('slow down', { status: 429, headers: { 'retry-after': '999' } })
    : new Response(fx('poshmark.html'), { status: 200 }))) as typeof fetch;
  const f = createFetcher({ params: { base_delay_ms: [0, 0], backoff_ms: 5, ceiling_ms: 25, max_retries: 3 } });
  const t0 = performance.now();
  const r = await searchAll('levi 501', { sites: ['poshmark'], fetchPage: (u, o) => f.fetchPage(u, { ...o, fetchImpl }) });
  const took = performance.now() - t0;
  assert.equal(calls, 3);
  assert.equal(r.searched[0]!.outcome, 'hit');
  assert.ok(took >= 40 && took < 400, `waited ${took}`);
});

test('429 that never clears gives timeout, not partial rows', async () => {
  const f = createFetcher({ params: { base_delay_ms: [0, 0], backoff_ms: 1, ceiling_ms: 5, max_retries: 2 } });
  const fetchImpl = (async () => new Response('', { status: 429 })) as typeof fetch;
  const r = await searchAll('x', { sites: ['poshmark'], fetchPage: (u, o) => f.fetchPage(u, { ...o, fetchImpl }) });
  assert.equal(r.searched[0]!.outcome, 'timeout');
  assert.equal(r.results.length, 0);
});

test('depop: a marked-down card reads the discounted price, not the full one (seen live 2026-11-14)', () => {
  const card = '<li class="B382Gq_listItem"><a aria-label="Jacket" href="/products/seller-jacket-1a/"><img src="https://media-photos.depop.com/x/P0.jpg"></a>'
    + '<p aria-description="Full price">$20.00</p><p aria-description="Discounted price">$19.00</p></li>';
  const read = readPage('depop', '<ol>' + card + '</ol>', 'search');
  assert.equal(read.ok && read.data[0].price_cents, 1900);
});

test('a card missing a required field is dropped and counted, the rest are returned, and a price too long to be whole cents is never passed on', () => {
  const page = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { searchFeedResponse: { looseTiles: [
    { listing: { listingId: 'big', title: 'x', price: '9'.repeat(400), conditionText: null, image: null } },
    { listing: { listingId: 'ok', title: 'y', price: '12.50', conditionText: null, image: null } },
  ] } } } })}</script>`;
  const r = readPage('offerup', page);
  assert.ok(r.ok, JSON.stringify(r).slice(0, 200));
  assert.deepEqual(r.data.map(x => [x.id, x.price_cents]), [['ok', 1250]]);   // before: the whole page failed, or passed Infinity on
  assert.equal(r.dropped, 1);
  // one priced card among unpriced ones on a real recorded page: the priced one comes back, the page is not failed
  let n = 0;
  const partly = fx('depop.html').replace(/<p aria-description="Price">[^<]*<\/p>/g, m => (n++ === 0 ? m : ''));
  const d = readPage('depop', partly);
  assert.ok(d.ok && d.data.length === 1 && d.dropped === n - 1, JSON.stringify(d).slice(0, 200));
});
