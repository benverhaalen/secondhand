import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SITES } from '../../harness/protocol.ts';
import { createFetcher } from '../fetch.ts';
import type { FetchOpts, PageResult } from '../fetch.ts';
import { readPage, searchUrl, BASE } from './readers.ts';
import { searchAll } from './search.ts';

const FX = new URL('../../../../../spec/fixtures/pages/', import.meta.url);
const fx = (n: string) => readFileSync(new URL(n, FX), 'utf8');
const page = (html: string, status = 200): PageResult => ({ ok: true, html, status, final_url: '', rung: 'plain', ms: 1, searched: [] });

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

test('searchAll queries every site in parallel (fake timings), and maps outcomes per site', async () => {
  let live = 0, peak = 0;
  const fetchPage = async (url: string, _o: FetchOpts): Promise<PageResult> => {
    live++; peak = Math.max(peak, live);
    await new Promise(r => setTimeout(r, 40));
    live--;
    const site = SITES.find(s => url.startsWith(BASE[s]))!;
    if (site === 'ebay') return { ok: false, kind: 'blocked', reason: '403', status: 403, ms: 1, searched: [] };
    if (site === 'grailed') return { ok: false, kind: 'timeout', reason: 'slow', ms: 1, searched: [] };
    if (site === 'offerup') return page(OFFERUP);
    if (site === 'facebook') return page('<html><form action="/login">Log in</form></html>');
    if (site === 'depop') return page(fx('depop.html').replace(/aria-description="Price"/g, 'x="1"'));
    return page(fx(`${site}.html`));
  };
  const t0 = performance.now();
  const r = await searchAll('levi 501', { fetchPage });
  assert.equal(peak, SITES.length);
  assert.ok(performance.now() - t0 < 40 * 3);
  const by = Object.fromEntries(r.searched.map(s => [s.site, s]));
  assert.equal(by.ebay!.outcome, 'blocked');
  assert.equal(by.grailed!.outcome, 'timeout');
  assert.equal(by.facebook!.outcome, 'blocked');
  assert.equal(by.depop!.outcome, 'page_changed');
  assert.deepEqual(by.depop!.missing, ['price_cents']);
  assert.equal(by.offerup!.outcome, 'hit');
  assert.equal(by.offerup!.count, 2);
  assert.equal(by.poshmark!.outcome, 'hit');
  assert.equal(r.results.length, by.offerup!.count + by.poshmark!.count + by.mercari!.count);
  assert.ok(r.results.every(x => x.row.id && x.row.price_cents !== undefined));
});

test('searchAll with kinds search+sold: sites without sold are empty with a reason, not a request', async () => {
  const urls: string[] = [];
  const r = await searchAll('levi 501', { sites: ['depop', 'ebay'], kinds: ['search', 'sold'], fetchPage: async u => { urls.push(u); return page(fx('ebay.html')); } });
  assert.equal(urls.length, 3);
  const d = r.searched.find(s => s.site === 'depop' && s.kind === 'sold')!;
  assert.equal(d.outcome, 'empty');
  assert.match(d.reason!, /sold/);
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
  const r = await searchAll('x', { sites: ['mercari'], fetchPage: (u, o) => f.fetchPage(u, { ...o, fetchImpl }) });
  assert.equal(r.searched[0]!.outcome, 'timeout');
  assert.equal(r.results.length, 0);
});

test('depop: a marked-down card reads the discounted price, not the full one (seen live 2026-11-14)', () => {
  const card = '<li class="B382Gq_listItem"><a aria-label="Jacket" href="/products/seller-jacket-1a/"><img src="https://media-photos.depop.com/x/P0.jpg"></a>'
    + '<p aria-description="Full price">$20.00</p><p aria-description="Discounted price">$19.00</p></li>';
  const read = readPage('depop', '<ol>' + card + '</ol>', 'search');
  assert.equal(read.ok && read.data[0].price_cents, 1900);
});

test('offerup reader never passes on a price too long to be whole cents: the field gate reports the page', () => {
  const page = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { searchFeedResponse: { looseTiles: [
    { listing: { listingId: 'big', title: 'x', price: '9'.repeat(400), conditionText: null, image: null } },
    { listing: { listingId: 'ok', title: 'y', price: '12.50', conditionText: null, image: null } },
  ] } } } })}</script>`;
  const r = readPage('offerup', page);
  assert.ok(!r.ok && r.error.code === 'page_changed', JSON.stringify(r).slice(0, 200)); // before: ok, with price_cents Infinity
});
