import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betterOfficial, buyList, searchAll, REFERRAL_DISCLOSURE, type BuyOffer } from './buy.ts';

const o = (x: Partial<BuyOffer> & { id: string }): BuyOffer => ({ site: 'ebay', listing_id: x.id, title: 'sony wh-1000xm5', price_cents: 20000, route_id: 'r', url: `https://x/${x.id}`,
  condition: 'used_good', relation: 'same_product', shipping_cents: 0, tax_rate: 0, source_kind: 'marketplace', ...x });

const offers = [
  o({ id: 'u1', price_cents: 18000, referral: { programme: 'epn', url: 'https://ebay/epn/u1' } }),
  o({ id: 'u2', site: 'mercari', price_cents: 17000 }),
  o({ id: 'n1', site: 'sony.com', condition: 'new', price_cents: 26000, source_kind: 'brand_store' }),
  o({ id: 'n2', site: 'amazon', condition: 'new', price_cents: 24000, source_kind: 'amazon', referral: { programme: 'amazon', url: 'https://amzn/n2' } }),
];

test('one search across marketplaces, the brand store and Amazon, by delivered total', () => {
  const rows = searchAll(offers, { medianShipping: 800 });
  assert.deepEqual(rows.map(r => r.id), ['u2', 'u1', 'n2', 'n1']);
});

test('a referral never changes the order, and a tagged link carries the disclosure', () => {
  const withRef = searchAll(offers, { medianShipping: 800 }).map(r => r.id);
  const without = searchAll(offers.map(({ referral: _r, ...x }) => x as BuyOffer), { medianShipping: 800 }).map(r => r.id);
  assert.deepEqual(withRef, without);
  const big = searchAll([...offers, o({ id: 'u3', price_cents: 30000, referral: { programme: 'epn', url: 'https://ebay/epn/u3' } })], { medianShipping: 800 });
  assert.equal(big.at(-1)!.id, 'u3');
  assert.equal(big.find(r => r.id === 'u1')!.referral!.disclosure, REFERRAL_DISCLOSURE);
  assert.equal(big.find(r => r.id === 'u2')!.referral, undefined);
});

test('an official offer cheaper than used is shown first, with the verdict official', () => {
  const rows = searchAll([...offers, o({ id: 'r1', site: 'sony.com', condition: 'refurbished', price_cents: 15000, source_kind: 'refurb' })], { medianShipping: 800 });
  assert.equal(buyList(rows)[0]!.id, 'r1');
  const v = betterOfficial(rows.find(r => r.id === 'u2')!, rows);
  assert.deepEqual([v.official!.id, v.verdict, v.saving_cents], ['r1', 'official', 2000]);
});

test('used cheaper is the verdict used; within 5% is a close call; no official is no verdict', () => {
  const rows = searchAll(offers, { medianShipping: 800 });
  assert.equal(betterOfficial(rows.find(r => r.id === 'u2')!, rows).verdict, 'used');
  const close = searchAll([o({ id: 'u', price_cents: 20000 }), o({ id: 'n', site: 'amazon', condition: 'new', price_cents: 20500, source_kind: 'amazon' })], { medianShipping: 0 });
  assert.equal(betterOfficial(close[0]!, close).verdict, 'close_call');
  const none = searchAll([o({ id: 'u' })], { medianShipping: 0 });
  assert.equal(betterOfficial(none[0]!, none).verdict, null);
});

test('a condition filter keeps only the chosen conditions', () => {
  assert.deepEqual(searchAll(offers, { medianShipping: 0, condition: ['new'] }).map(r => r.id), ['n2', 'n1']);
});
