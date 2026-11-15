// node --test src/buy/read.test.ts: what the buy pages read from the demo world.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEARCH_DUNKS, inMinutes, world, type Site } from '../demo/index.ts';
import {
  RECENT_KEEP, cardLine, coloursFor, cover, cutWords, firstPass, kindOf, monthLabel, offerAmounts, offerProblem, paysFor, priceBounds, priceWords, rank, recent,
  searchFor, sizesFor, sizeWords, soldDots, wantFromWords, wantTag,
} from './read.ts';

test('three offer amounts, whole dollars, lowest first, none over the asking price', () => {
  assert.deepEqual(offerAmounts(7000, 6500), [60, 65, 68]);
  assert.deepEqual(offerAmounts(6400), [54, 60, 62]);
  for (const p of [100, 5, 99999999]) for (const a of offerAmounts(p)) assert.ok(Number.isInteger(a) && a > 0 && a <= Math.max(1, p / 100));
});

test('a pickup says how far, a shipped one says delivered', () => {
  assert.deepEqual(paysFor({ seller: 'pickup, 4 mi away', delivered_cents: 6000 }), { what: 'Pickup, 4 mi', amount: '$60' });
  assert.deepEqual(paysFor({ seller: 'a person', delivered_cents: 7250 }), { what: 'Delivered', amount: '$72.50' });
});

// break-ui on Search: six rows read 'Nike Dunk Low Grey Fog, m...' and nothing told them apart but the price, while spec
// buy.md asks for each row's condition. The card's fact line carries it.
test('a card says the condition before what it costs, delivered or at a pickup', () => {
  assert.deepEqual(cardLine({ condition: 'Used, like new', seller: 'a person', delivered_cents: 7250 }), { what: 'Like new, delivered', amount: '$72.50' });
  assert.deepEqual(cardLine({ condition: 'Used, fair', seller: 'pickup, 4 mi away', delivered_cents: 6000 }), { what: 'Fair, pickup 4 mi', amount: '$60' });
  assert.deepEqual(cardLine({ condition: 'New without box', seller: 'a person', delivered_cents: 11900 }), { what: 'New without box, delivered', amount: '$119' });
});

// break-ui on Listing: Something else took any amount, so $1,000,000 could be sent as an offer on a $64 listing.
test('an offer is a positive amount at or under the asking price', () => {
  assert.equal(offerProblem(null, 6400), 'Pick an amount');
  assert.equal(offerProblem(0, 6400), 'Pick an amount');
  assert.equal(offerProblem(1000000, 6400), 'Over their price of $64');
  assert.equal(offerProblem(64, 6400), null);
});

test('a want says how its search stands: sites in so far, all in, or paused', () => {
  const base = { sites: ['ebay', 'mercari'] as Site[], checked: { ebay: 'x', mercari: 'x' }, behind: [] as Site[] };
  assert.deepEqual(wantTag({ ...base, state: 'active', behind: [] }), { state: 'working', word: 'Searching' });
  assert.deepEqual(wantTag({ ...base, state: 'active', behind: ['mercari'] }), { state: 'working', word: '1 of 2 sites' });
  assert.deepEqual(wantTag({ ...base, state: 'paused' }), { state: 'ended', word: 'Paused' });
});

test('results rank the same thing first, then by what it costs delivered', () => {
  const order = rank(SEARCH_DUNKS.rows).map(r => r.id);
  assert.deepEqual(order, ['mt_d3', 'mt_d1', 'mt_d2', 'mt_d5', 'mt_d4', 'mt_d6']);
});

test('a search for the dunks, the slow one and nothing', () => {
  assert.equal(searchFor('nike dunk').id, 'sr_dunk');
  assert.equal(searchFor('nike dunk', 'slow').sites_waiting.length, 4);
  assert.equal(searchFor('banjo').rows.length, 0);
});

// Ben, 2026-11-15: "i want a brewers jersey and i want it around a price ... shipped or pickup or both etc. color".
test('a want from words: around a price is 20% either side, and a price is never read as a size', () => {
  assert.deepEqual(priceWords('brewers jersey around $60'), { low: 48, high: 72, rest: 'brewers jersey' });
  assert.deepEqual(priceWords('nike dunk men’s 10 under $80'), { low: 48, high: 80, rest: 'nike dunk men’s 10' });
  assert.equal(priceWords('nike dunk low grey fog 10'), null);
  const jersey = wantFromWords('brewers jersey around $60');
  assert.equal(jersey.max_total_cents, 7200);
  assert.equal(jersey.low_cents, 4800);
  assert.equal(jersey.how, 'both');
  assert.equal(jersey.fit.radius_mi, 15);
  assert.equal(jersey.size_system, 'letter');
  assert.ok(coloursFor(jersey.text, jersey.product_id).length > 1);
  const dunk = wantFromWords('nike dunk low grey fog 10 around $60');
  assert.equal(dunk.product_id, 'pr_dunk');
  assert.equal(dunk.fit.size, '10');
  assert.equal(dunk.max_total_cents, 7200);
  assert.deepEqual(coloursFor(dunk.text, dunk.product_id), [], 'a product with one colourway has no colour chip');
  const unsaid = wantFromWords('nike dunk low grey 10');
  assert.equal(unsaid.max_total_cents, 8000, 'no price said: the most is the middle of the fair range');
  assert.equal(unsaid.low_cents, 6400);
});

test('sizes come in their system, and only kinds with a size get the picker', () => {
  assert.deepEqual(sizesFor('shoes').map(s => s.id), ['mens', 'womens']);
  assert.ok(sizesFor('shoes')[0].sizes.includes('10.5'));
  assert.deepEqual(sizesFor(kindOf('standing desk')), []);
  assert.deepEqual(sizeWords('Nike Dunk Low, women’s 8', 'shoes'), { system: 'womens', size: '8' });
});

test('sold dots sit inside each site’s sold range, one per sale, and the track holds them all', () => {
  const p = { by_site: [{ site: 'ebay' as Site, sold: { low: 6800, high: 9200 }, asking: null, for_sale: 1, median_days: 1, basis_count: 31 }, { site: 'facebook' as Site, sold: null, asking: null, for_sale: 1, median_days: null, basis_count: 0 }] };
  const dots = soldDots(p);
  assert.equal(dots.length, 31);
  assert.ok(dots.every(d => d >= 68 && d <= 92));
  const b = priceBounds(48, 72, dots);
  assert.ok(b.min <= 48 && b.max >= 92 && b.min % 5 === 0 && b.max % 5 === 0);
  assert.deepEqual(soldDots(null), []);
});

test('a first pass counts what each site found that fits, site by site', () => {
  const pass = firstPass({ text: 'Nike Dunk Low, Grey Fog, men’s 10', sites: ['ebay', 'mercari', 'depop', 'facebook', 'poshmark'] });
  assert.equal(pass.length, 5);
  assert.equal(pass.reduce((n, s) => n + s.found, 0), SEARCH_DUNKS.rows.length);
});

test('every site says who covers the sale, and a pickup says nobody does', () => {
  for (const s of ['ebay', 'depop', 'poshmark', 'mercari', 'facebook'] as const) assert.ok(cover(s, false).startsWith('Covered'));
  assert.match(cover('facebook', true), /^No site cover/);
  assert.equal(monthLabel('2026-06'), 'Jun');
});

test('a want from words reads who clothes are cut for, and only for clothes', () => {
  assert.equal(cutWords('brewers jersey youth L'), 'youth');
  assert.equal(cutWords('women’s brewers jersey'), 'womens');
  assert.equal(cutWords("men's brewers jersey"), 'mens');
  assert.equal(cutWords('brewers jersey'), undefined);
  assert.equal(wantFromWords("men's brewers jersey L around $60").fit.cut, 'mens');
  assert.equal(wantFromWords("nike dunk men's 10").fit.cut, undefined, 'a shoe has sizes per cut, not a cut chip');
});

// Recent on Buy (spec/redesign/new-results.md, What Recent is): the last 20 lookups, newest first, none older than 90 days,
// each saying what the lookup said and opening where it ended.
test('Recent is the newest lookups first, without the ones past 90 days', () => {
  assert.deepEqual(recent(world('flipper')).map(r => r.capture_id), ['cap_lk_f1', 'cap_lk_f2', 'cap_lk_f3', 'cap_lk_f4']);
  assert.deepEqual(recent(world('new')), []);
});

test('an appraisal says its used range and opens the value page; a find says the product and opens its page', () => {
  const [find, worth] = recent(world('clearing'));
  assert.deepEqual({ name: find.short_name, says: find.says, opens: find.opens, key: find.key }, { name: 'Grey Nike sneakers', says: 'Nike Dunk Low', opens: '/product/pr_dunk', key: 'nike-dunks' });
  assert.deepEqual({ name: worth.short_name, says: worth.says, opens: worth.opens }, { name: 'Carhartt jacket', says: '$85 to $115 used', opens: '/worth?product=pr_j97' });
});

test('Recent keeps 20 at most', () => {
  const w = world('flipper'), one = w.lookups[0];
  const many = Array.from({ length: 30 }, (_, i) => ({ ...one, capture_id: `cap_${i}`, at: inMinutes(-i) }));
  const rows = recent({ ...w, lookups: many });
  assert.equal(rows.length, RECENT_KEEP);
  assert.equal(rows[0].capture_id, 'cap_0');
});
