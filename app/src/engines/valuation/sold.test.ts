import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { soldSources, toComps } from './sold.ts';
import { comparables } from './comps.ts';

const as_of = '2026-11-15T00:00:00Z';
const row = (id: string, price_cents: number, extra: Record<string, unknown> = {}) =>
  ({ external_id: id, url: `https://www.mercari.com/us/item/${id}/`, state: 'sold', price_cents, title: 'Carhartt Active Jacket J130', listed_at: '2026-11-01T00:00:00Z', ...extra });

test('a sold search row becomes a cited comp; live, unpriced and undated rows do not', () => {
  const comps = toComps('mercari', [row('a', 5000), row('b', 6000, { state: 'live' }), row('c', 0), row('d', 7000, { listed_at: undefined })],
    { query: 'carhartt active jacket', condition: 'good' });
  assert.deepEqual(comps.map(c => c.comp_id), ['mercari:a']);
  const [c] = comps;
  assert.equal(c.kind, 'sold'); assert.equal(c.site, 'mercari'); assert.equal(c.citation, 'https://www.mercari.com/us/item/a/');
  assert.equal(c.may_model, false);                                  // scraped rows are cited, never trained on
  assert.equal(c.sold_at, '2026-11-01T00:00:00Z');                   // no sale date on the row: the listing date, so its age is never understated
});

test('a title holding every word of the query is the product; any other hit is only the family', () => {
  const [hit, near] = toComps('mercari', [row('a', 5000), row('b', 5000, { title: 'Carhartt hoodie' })], { query: 'Carhartt Active Jacket', condition: 'good' });
  assert.equal(hit.level, 'product'); assert.equal(hit.w_match, 0.5);
  assert.equal(near.level, 'family'); assert.equal(near.w_match, 0.25);
});

test('a condition the site states adjusts the comp; an unstated one is not guessed, it only counts for less', () => {
  const [stated, unstated] = toComps('mercari', [row('a', 5000, { condition: 'Like new' }), row('b', 5000)], { query: 'carhartt', condition: 'good' });
  assert.equal(stated.condition, 'excellent'); assert.equal(stated.w_extract, 0.9);
  assert.equal(unstated.condition, 'good'); assert.equal(unstated.w_extract, 0.7);
});

test('the recorded Mercari sold search prices through the comps engine', () => {
  const page = JSON.parse(readFileSync(new URL('../../edge/harness/sites/mercari/fixtures/search-sold.json', import.meta.url), 'utf8'));
  const items = page.api.find((a: { op: string }) => a.op === 'searchFacetQuery').body.data.search.itemsList as Record<string, unknown>[];
  const rows = items.map(o => ({ external_id: o.id, url: `https://www.mercari.com/us/item/${o.id}/`, state: 'sold', price_cents: o.price,
    title: o.name, listed_at: new Date(Number(o.created) * 1000).toISOString(), condition: (o.itemCondition as { name: string }).name }));
  const comps = toComps('mercari', rows, { query: 'carhartt hoodie', condition: 'good' });
  assert.equal(comps.length, 5);
  assert.deepEqual(comps.filter(c => c.level === 'product').map(c => c.price_cents), [1300, 2959, 3495]);   // the three titles saying both words
  const found = comparables({ condition: 'good' }, comps, '2026-11-20T00:00:00Z');
  assert.ok(found.range.q50 !== null && found.range.q10! <= found.range.q50! && found.range.q50! <= found.range.q90!);
  assert.equal(found.state, 'too_few');   // five sales are a range to show with its comps, not a checked price
});

test('the age clock identifies whether it came from the sale or listing date', () => {
  const [listed, sold, invalidSale] = toComps('mercari', [row('listed', 5000), row('sold', 5000, { sold_at: '2026-11-10T00:00:00Z' }), row('invalid', 5000, { sold_at: 'invalid' })], { query: 'jacket', condition: 'good' });
  assert.equal(listed.dated_by, 'listed');
  assert.equal(sold.dated_by, 'sold'); assert.equal(sold.sold_at, '2026-11-10T00:00:00Z');
  assert.equal(invalidSale.dated_by, 'listed');
});

test('only Apify rows from a non-eBay site may model', () => {
  const q = { query: 'jacket', condition: 'good' };
  assert.equal(toComps('mercari', [row('harness', 5000)], q)[0].may_model, false);
  assert.equal(toComps('poshmark', [row('apify', 5000, { via: 'apify' })], q)[0].may_model, true);
  assert.equal(toComps('ebay', [row('ebay', 5000, { via: 'apify' })], q)[0].may_model, false);
});

test('listing dates survive conversion separately, including an invalid sale date', () => {
  const [listed, sold, invalid] = toComps('mercari', [row('listed', 5000),
    row('sold', 5000, { sold_at: '2026-11-10T00:00:00Z' }), row('invalid', 5000, { sold_at: 'invalid' })],
    { query: 'jacket', condition: 'good' });
  for (const comp of [listed, sold, invalid]) assert.equal(comp.listed_at, '2026-11-01T00:00:00Z');
  const found = comparables({ condition: 'good' }, [listed], as_of);
  assert.equal(found.comps[0].age_days, 14, 'age decay must still use the listing date');
});
