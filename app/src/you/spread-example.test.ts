import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keep } from '../engines/valuation/keep.ts';
import { DEFAULT_SPREAD } from '../engines/listing/spreads.ts';
import { EXAMPLE, example } from './spread-example.ts';

const LINKED = ['ebay', 'depop', 'mercari', 'poshmark'];

test('the example starts where the jacket is listed now, at its own price', () => {
  const rows = example('same_keep', LINKED);
  assert.equal(rows[0].site, EXAMPLE.home);
  assert.equal(rows[0].home, true);
  assert.equal(rows[0].price_cents, EXAMPLE.price_cents);
  assert.equal(rows[0].get_cents, keep(EXAMPLE.home, EXAMPLE.price_cents).keep_cents);
  assert.deepEqual(rows.map(r => r.site), ['depop', 'ebay', 'mercari', 'poshmark']);
});

test('same take-home is the default: you get about the same everywhere, so each price differs', () => {
  assert.equal(DEFAULT_SPREAD, 'same_keep');
  const rows = example('same_keep', LINKED), home = rows[0].get_cents;
  for (const r of rows) assert.ok(Math.abs(r.get_cents - home) <= 1, `${r.site} gets ${r.get_cents}, home gets ${home}`);
  assert.ok(new Set(rows.map(r => r.price_cents)).size > 1, 'sites with higher fees show a higher price');
  for (const r of rows) assert.equal(r.price_cents - r.fee_cents, r.get_cents);
});

test('same price shows one price, and you get less where fees are higher', () => {
  const rows = example('same_price', LINKED);
  assert.ok(rows.every(r => r.price_cents === EXAMPLE.price_cents));
  const posh = rows.find(r => r.site === 'poshmark')!, depop = rows[0];
  assert.ok(posh.get_cents < depop.get_cents);
});

test('your shop first keeps the shop cheapest', () => {
  const rows = example('home_first', LINKED);
  for (const r of rows.slice(1)) assert.ok(r.price_cents > rows[0].price_cents, `${r.site} is above the shop`);
  for (const r of rows.slice(1)) assert.ok(r.get_cents >= rows[0].get_cents - 1);
});

test('what each site pays uses that site\'s sales, and says so where there are too few', () => {
  const rows = example('site_market', LINKED);
  const ebay = rows.find(r => r.site === 'ebay')!, mercari = rows.find(r => r.site === 'mercari')!;
  assert.equal(ebay.price_cents, 10100);          // the middle of eBay's sold range, $82 to $119, to the dollar
  assert.equal(ebay.too_few, false);
  assert.equal(mercari.too_few, true);            // no Mercari sales shown: the same take-home instead
  assert.ok(Math.abs(mercari.get_cents - rows[0].get_cents) <= 1);
});

test('with fewer than two other linked sites, the example uses the common ones', () => {
  assert.deepEqual(example('same_keep', []).map(r => r.site), ['depop', 'ebay', 'mercari', 'poshmark']);
  assert.deepEqual(example('same_keep', ['ebay', 'facebook', 'offerup']).map(r => r.site), ['depop', 'ebay', 'facebook']);
});
