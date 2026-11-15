import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insights } from './insights.ts';
import type { Reach } from './reach.ts';

const row = (id: string, site: string, dollars: number, title: string, currency = 'USD') =>
  ({ id, site, title, price_cents: { amount_cents: dollars * 100, currency }, delivered_cents: currency === 'USD' ? { amount_cents: dollars * 100, currency } : null });
const reach = (rows: ReturnType<typeof row>[]) => ({ results: rows } as unknown as Reach);

test('the spread is nearest-rank over the asks, in the currency most rows use; other currencies are left out', () => {
  const r = insights(reach([row('a', 'poshmark', 10, 'Levi 501 black'), row('b', 'poshmark', 20, 'Levi 501 black'), row('c', 'depop', 30, 'Levi 501 vintage'),
    row('d', 'depop', 40, 'Levi 501 vintage'), row('e', 'ebay', 99, 'Levi 501', 'GBP')]), 'levi 501');
  assert.deepEqual(r.spread, { n: 4, low: 1000, q1: 1000, median: 2000, q3: 3000, high: 4000, currency: 'USD' });
});

test('sites are compared by median ask, cheapest first, only with 3 asks or more', () => {
  const rows = [10, 12, 14].map((d, i) => row(`d${i}`, 'depop', d, 'x y')).concat([30, 35, 40].map((d, i) => row(`p${i}`, 'poshmark', d, 'x y')), [row('e', 'ebay', 5, 'x y')]);
  assert.deepEqual(insights(reach(rows), 'q').bySite, [{ id: 'depop', n: 3, median: 1200 }, { id: 'poshmark', n: 3, median: 3500 }]);
});

test('terms are words most listings use beyond the query, once per listing, with slugs and stop words left out', () => {
  const rows = [
    row('1', 'poshmark', 10, "Levi's 501 Black Shorts"), row('2', 'poshmark', 10, 'Levis 501 black shorts black'),
    row('3', 'poshmark', 10, "Levi’s 501 black vintage shorts"), row('4', 'depop', 10, 'levi-501-black-shorts-slug'),
  ];
  assert.deepEqual(insights(reach(rows), 'levi 501').terms, [{ term: 'black', n: 3 }, { term: 'shorts', n: 3 }]);
});

test('fewer than three asks says nothing rather than a spread of one or two', () => {
  assert.equal(insights(reach([row('a', 'poshmark', 10, 'a b')]), 'q').spread, null);
});
