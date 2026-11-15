import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cards, judge, listingFacts, poshState } from './want.mjs';

const want = JSON.parse(readFileSync(new URL('./wants/brewers-jersey.json', import.meta.url), 'utf8'));
// The shape of one real search card (observed 2026-11-15, seller fields left out), varied per test.
const card = (o = {}) => ({
  id: '6af905c3a69358be5fa9a36b', title: 'Vintage Majestic Milwaukee Brewers MLB Jersey Navy Gold', price_amount: { val: '29.0', currency_code: 'USD' },
  inventory: { status: 'available', size_quantities: [{ size_id: 'XL', size_obj: { id: 'XL', display: 'XL' } }] },
  catalog: { department_obj: { display: 'Men' }, category_obj: { display: 'Shirts' }, category_feature_objs: [{ display: 'Jerseys' }] },
  first_published_at: '2026-11-14T17:07:17-08:00', brand: 'Majestic', ...o,
});
const page = (...cs) => `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({ $_search: { gridData: { data: cs } } })};</script>
<body>${cs.map(c => `<a href="/listing/x-${c.id}">${c.title}</a>`).join('')}</body></html>`;

test('poshState: reads the page data even with a string holding brackets', () => {
  const html = `<script>window.__INITIAL_STATE__ = {"a":"} ] {","b":[1,{"c":2}]};var x = 1;</script>`;
  assert.deepEqual(poshState(html), { a: '} ] {', b: [1, { c: 2 }] });
  assert.equal(poshState('<html>nothing</html>'), null);
});

test("cards: Poshmark's own price, size, department, category and publish time", () => {
  const [r] = cards(page(card()));
  assert.deepEqual([r.price, r.size, r.department, r.category, r.sold, r.published_at], [29, 'XL', 'Men', 'Jerseys', false, Date.parse('2026-11-15T01:07:17Z')]);
});

test("judge: the site's department and category decide what a title can't", () => {
  const fit = r => judge(want, cards(page(card(r)))[0]);
  assert.equal(fit({}).fits, true);
  // a boys' XXL shows as "XXL"; only the department says it's a kid's
  assert.deepEqual(fit({ catalog: { department_obj: { display: 'Kids' }, category_feature_objs: [{ display: 'Jerseys' }] } }).reasons, ['department Kids']);
  assert.deepEqual(fit({ title: 'Milwaukee Brewers Jersey tee', catalog: { department_obj: { display: 'Men' }, category_feature_objs: [{ display: 'Tees' }] } }).reasons, ['cut or kind: \\btee\\b', 'category Tees']);
  assert.deepEqual(fit({ title: 'Giannis Milwaukee Brewers giveaway jersey' }).reasons, ['cut or kind: \\bgiannis\\b']);
  assert.deepEqual(fit({ price_amount: { val: '75.0' } }).reasons, ['$75 over $60']);
  assert.deepEqual(fit({ inventory: { status: 'sold_out', size_quantities: [{ size_obj: { display: 'L' } }] } }).reasons, ['sold']);
  // the mislisting case: the title says 2XL, the size field says XL; the field wins, so a person checks before buying
  assert.equal(fit({ title: 'Milwaukee Brewers Jersey 2XL' }).fits, true);
});

test('listingFacts: the listing page gives the structured price and its own fields', () => {
  const id = '6af905c3a69358be5fa9a36b';
  const html = `<html><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Brewers Jersey', url: `https://poshmark.com/listing/x-${id}`, offers: { price: '43', priceCurrency: 'USD', availability: 'https://schema.org/InStock' } })}</script>
<script>window.__INITIAL_STATE__ = ${JSON.stringify({ $_listing_details: { listingDetails: card({ id }) } })};</script></html>`;
  const f = listingFacts(html, id);
  assert.deepEqual([f.jsonld_price, f.available, f.size, f.department, f.category], [43, true, 'XL', 'Men', 'Jerseys']);
  assert.equal(listingFacts('<html></html>', id).jsonld_price, null);
});
