import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';
import { parseListings, type ListingSpec, type ListingAsk, type ListingResult } from './listing-parser.ts';
import { ebayListingSpec, ebayPageAdapters, PAGE_HOSTS, searchRows, type PageClient } from './sites/ebay/adapter.ts';

// As in session-client.test.ts, execute the serialized function in a fresh realm.
// xmldom is already installed; this read-only facade supplies the selector subset used by the specs.
function isolatedDocument(html: string): Document {
  const dom = new DOMParser().parseFromString(/<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`, 'text/html');
  type Node = Element;
  const matches = (node: Node, selectors: string): boolean => selectors.split(',').some(selector => {
    const s = selector.trim(), tag = s.match(/^[\w-]+/)?.[0];
    if (tag && node.tagName !== tag) return false;
    if ([...s.matchAll(/\.([\w-]+)/g)].some(m => !(node.getAttribute('class') ?? '').split(/\s+/).includes(m[1]!))) return false;
    return [...s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(m => node.hasAttribute(m[1]!) && (m[2] === undefined || node.getAttribute(m[1]!) === m[2]));
  });
  const wrap = (node: Node): unknown => Object.freeze({
    textContent: node.textContent, getAttribute: (name: string) => node.hasAttribute(name) ? node.getAttribute(name) : null,
    matches: (s: string) => matches(node, s),
    querySelectorAll: (s: string) => Array.from(node.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap),
    querySelector: (s: string) => Array.from(node.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap)[0] ?? null,
  });
  return Object.freeze({
    title: dom.getElementsByTagName('title')[0]?.textContent ?? '', documentElement: { outerHTML: html },
    querySelectorAll: (s: string) => Array.from(dom.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap),
    querySelector: (s: string) => Array.from(dom.getElementsByTagName('*')).filter(n => matches(n, s)).map(wrap)[0] ?? null,
  }) as unknown as Document;
}
function inPage(html: string, spec: ListingSpec, ask: ListingAsk = {}): ListingResult {
  return JSON.parse(JSON.stringify(runInNewContext(`(${parseListings.toString()})(document, spec, ask)`, {
    document: isolatedDocument(html), spec, ask, URL,
  }))) as ListingResult;
}
const fixture = (file: string) => readFileSync(new URL(`./sites/ebay/fixtures/${file}`, import.meta.url), 'utf8');
const spec: ListingSpec = { card_selector: 'article', fields: {
  item_id: { attribute: 'data-id' }, external_id: { attribute: 'data-id' },
  title: { selector: 'h2' }, price_cents: { selector: '.price', cleaner: 'money' },
} };
const cards = '<article data-id="1"><h2>LEVI’S 501 Jeans</h2><span class="price">$10.01</span></article>' +
  '<article data-id="2"><h2>Levi jacket</h2><span class="price">$0.00</span></article>' +
  '<article data-id="3"><h2>Other coat</h2><span class="price">$8</span></article>' +
  '<article><h2>No id</h2><span class="price">$1</span></article><article data-id="5"><h2>No price</h2></article>';

test('serialized parser reads a second site from data only, labels tokens, counts missing fields and retains zero cents', () => {
  const result = inPage(cards, spec, { tokens: ['LEVI’S', '501'], narrow: false });
  assert.deepEqual(result.rows.map(r => [r.item_id, r.rank, r.name_match, r.price_cents]), [["1", 1, 'all', 1001], ["2", 2, 'some', 0], ["3", 3, 'none', 800]]);
  assert.deepEqual([result.total, result.dropped, result.narrowed_out, result.facts], [5, 2, 0, 15]);
  assert.ok(result.rows.every(r => Object.values(r).every(v => v !== undefined && v !== null)));
});

test('narrowing is explicit; limit never renumbers the page or hides the narrowed count', () => {
  const result = inPage(cards, spec, { tokens: ['levi', '501'], narrow: true, limit: 1 });
  assert.deepEqual(result.rows.map(r => [r.item_id, r.rank, r.name_match]), [['1', 1, 'all']]);
  assert.deepEqual([result.total, result.dropped, result.narrowed_out, result.facts], [5, 2, 1, 5]);
  assert.equal(inPage(cards, spec, { limit: 0 }).rows.length, 0);
  assert.ok(inPage(cards, spec).rows.every(r => r.name_match === 'all'));
});

test('kind words narrow by type when supplied, with no substring matches', () => {
  const result = inPage(cards, spec, { tokens: ['levi'], kind_words: ['jeans'], narrow: true });
  assert.deepEqual(result.rows.map(r => [r.item_id, r.name_match]), [['1', 'all']]);
  assert.equal(result.narrowed_out, 2);
  assert.equal(inPage(cards, spec, { tokens: ['coat'], kind_words: ['coats'], narrow: true }).rows.length, 0);
  assert.equal(inPage(cards, spec, { tokens: ['levi'], kind_words: ['jeans'], narrow: false }).rows[1]!.name_match, 'all');
});

for (const file of ['page-search.html', 'page-empty.html']) test(`unchanged ${file}: page and HTML paths have identical rows, dropped and facts`, async () => {
  const html = fixture(file), ask = { tokens: ['levis', '501', 'jeans'], narrow: false };
  const parsed = inPage(html, ebayListingSpec(), ask);
  const htmlClient: PageClient = { signed_in: false, page: async () => ({ status: 200, html }) };
  const pageClient: PageClient = { ...htmlClient, listings: async () => ({ status: 200, ...parsed }) };
  const run = (client: PageClient) => ebayPageAdapters(client)[0]!.run({ q: 'levis 501 jeans' }, new AbortController().signal);
  const server = await run(htmlClient), page = await run(pageClient);
  assert.deepEqual(page, server);
  assert.ok(server.ok);
  assert.deepEqual(parsed.rows, server.data);
  assert.deepEqual({ rows: parsed.rows.length, dropped: parsed.dropped, facts: parsed.facts }, Reflect.get(server, 'yield'));
  assert.equal(parsed.total, file === 'page-search.html' ? 3 : 0);
});

test('all optional facts, exact cents, alternate host, boundaries and malformed cards agree with HTML', async () => {
  const original = fixture('page-search.html');
  const variants = [
    original.replace('$39.00', '$39.00 to $49.00').replace('or Best Offer', 'Auction · 12 bids · 5 sold · 8 watchers · Listed Nov 14, 2026 · Sold Nov 15, 2026').replace('<div class="su-image">', '<div class="su-image"><img class="s-card__image" data-src="https://i.ebayimg.com/item.jpg" src="ignored">'),
    original.replace('$39.00', '$70368744177664.01'),
    original.replace('$39.00', `$${'9'.repeat(40)}.00`).replace('data-listingid="375403861014"', '').replaceAll('/itm/375403861014', '/itm/'),
    original.replace('$39.00', '$1.001'),
    original.replace('</body>', '<span>99 watchers · Sold Nov 15, 2026</span></body>'),
    original.replace('</ul>\n</body>', '</ul><li class="srp-river-answer--REWRITE_START">Fewer words</li>' + original.slice(original.indexOf('<ul')) + '</body>'),
  ];
  for (const html of variants) for (const host of PAGE_HOSTS) {
    const bytes = host.converted ? html.replaceAll('$', '£') : html;
    const parsed = inPage(bytes, ebayListingSpec('sold', host), { tokens: ['501'] });
    const server = searchRows(bytes, 'sold', host, { tokens: ['501'] });
    assert.deepEqual(parsed, server);

  }
});

test('URL ids and integer cleaners work without a marketplace path in the parser', () => {
  const generic: ListingSpec = { ...spec, fields: { ...spec.fields,
    item_id: { selector: 'a', attribute: 'href', cleaner: 'item_id' },
    watchers: { selector: '.watchers', pattern: '([0-9,]+) watching', group: 1, cleaner: 'integer' },
  } };
  const result = inPage('<article data-id="sku-A"><a href="https://example.invalid/products/sku-A?tracking=1#image">Item</a><h2>Item</h2><span class="price">£1,234.56</span><span class="watchers">1,234 watching</span></article>', generic);
  assert.deepEqual(result.rows[0], { external_id: 'sku-A', item_id: 'sku-A', title: 'Item', price_cents: 123456, watchers: 1234, rank: 1, name_match: 'all' });
});

test('a homepage URL has no listing id and is dropped even when a price is present', () => {
  const urlSpec: ListingSpec = { ...spec, fields: { ...spec.fields, item_id: { selector: 'a', attribute: 'href', cleaner: 'item_id' } } };
  const result = inPage('<article data-id="1"><a href="https://example.invalid/?tracking=1#image">Home</a><h2>Home</h2><span class="price">$10</span></article>', urlSpec);
  assert.deepEqual(result, { rows: [], dropped: 1, total: 1, facts: 0, narrowed_out: 0 });
});

test('a real card retains every optional fact, including both image attributes, in exact HTML parity', () => {
  const card = fixture('page-search.html').split(/(?=<li\b[^>]*class="s-card\s)/)[2]!;
  for (const attributes of ['src="https://i.ebayimg.com/item.jpg"', 'data-src="https://i.ebayimg.com/item.jpg" src="https://i.ebayimg.com/fallback.jpg"']) {
    const rich = card.replace('$39.00', '$39.00 to $49.00')
      .replace('or Best Offer', 'Auction · 12 bids · 5 sold · 8 watchers · Listed Nov 14, 2026 · Sold Nov 15, 2026')
      .replace('<div class="su-image">', `<div class="su-image"><img class="s-card__image" ${attributes}>`)
      .replaceAll('href="https://www.ebay.com/itm/387080178732"', 'href="https://www.ebay.com/itm/387080178732?tracking=1#photo"');
    const bytes = `<h1 class="srp-results-heading">1 results</h1><ul>${rich}</ul>`;
    const parsed = inPage(bytes, ebayListingSpec('sold'), { tokens: ['501'] });
    assert.deepEqual(parsed, searchRows(bytes, 'sold', PAGE_HOSTS[0], { tokens: ['501'] }));
    const row = parsed.rows[0]!;
    assert.deepEqual([row.price_cents, row.price_high_cents, row.buying_format, row.bid_count, row.sold_count, row.watchers], [3900, 4900, 'Auction', 12, 5, 8]);
    assert.deepEqual([row.listed_at, row.sold_at, row.image_url, row.url], ['Nov 14, 2026', 'Nov 15, 2026', 'https://i.ebayimg.com/item.jpg', 'https://www.ebay.com/itm/387080178732']);
  }
});
