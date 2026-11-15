import assert from 'node:assert/strict';
import { test } from 'node:test';
import { world } from '../demo/index.ts';
import { keep } from '../engines/valuation/keep.ts';
import { against, byState, cells, couldEarn, niceTop, pulse, salesWeeks } from './dashboard.ts';

test('could earn is after fees at the asking price, a range across sites', () => {
  const w = world('clearing'), c = couldEarn(w)!;
  assert.equal(c.things, 4);
  // The Carhartt jacket is up at $98 on eBay and $95 on Depop: its low and high come from the two sites.
  const jacket = [keep('ebay', 9800).keep_cents, keep('depop', 9500).keep_cents];
  assert.ok(c.low < c.high, 'two sites at two prices make a range');
  assert.ok(c.low >= Math.min(...jacket) && c.high >= Math.max(...jacket));
});

test('could earn is one number when every live thing is on one site', () => {
  const w = world('clearing');
  const one = { ...w, items: w.items.map(i => ({ ...i, listings: i.listings.filter((l, k) => k === 0 || l.state !== 'live') })) };
  const c = couldEarn(one)!;
  assert.equal(c.low, c.high);
  assert.equal(couldEarn(world('new')), null);
});

test('things by state follow Sell’s shelves and leave out what is empty', () => {
  const s = byState(world('clearing'));
  assert.deepEqual(s.map(x => x.id), ['in_progress', 'live', 'sold', 'kept']);
  assert.equal(s.find(x => x.id === 'live')!.count, 4);
  assert.deepEqual(byState(world('new')), []);
});

test('the weekly chart counts sales beside the money, and waits for 3 sales', () => {
  const weeks = salesWeeks(world('clearing'))!;
  assert.equal(weeks.length, 8);
  assert.equal(weeks.reduce((a, x) => a + x.sales, 0), 4);
  assert.ok(weeks[7].now && weeks[7].sales === 3, 'this week holds the three newest sales');
  assert.equal(salesWeeks(world('one')), null);
  assert.equal(salesWeeks(world('new')), null);
});

test('a money axis tops out at a round number over the tallest bar', () => {
  assert.equal(niceTop(13233), 20000);
  assert.equal(niceTop(4400), 5000);
  assert.equal(niceTop(23000), 25000);
  assert.equal(niceTop(0), 100);
});

test('each live thing is read against its usual, slow ones first', () => {
  const rows = pulse(world('clearing'));
  assert.equal(rows.length, 4);
  assert.equal(rows[0].title.startsWith('Brass desk lamp'), true, 'the slow lamp leads');
  const fleece = rows.find(r => r.title.startsWith('Patagonia'))!;
  assert.equal(fleece.views.value, null, 'Depop and Poshmark show no views, so the cell is empty, not zero');
  assert.equal(against(fleece.likes), 'more', '37 likes in 3 days is well over the usual');
  const jacket = rows.find(r => r.title.startsWith('Carhartt Detroit'))!;
  assert.equal(jacket.days.usual, 7, 'eBay’s outlook (9 days) and the product’s usual time on Depop together set the usual days');
  assert.equal(against({ value: 5, usual: null }), null);
});

test('a live thing’s counts read as words, with the usual in the middle of the track', () => {
  const rows = pulse(world('clearing'));
  const fleece = cells(rows.find(r => r.title.startsWith('Patagonia'))!);
  assert.deepEqual(fleece[0], { value: 'Not shown', word: 'views', share: null, said: 'No views shown on this site', muted: true });
  const lamp = cells(rows[0]);
  assert.equal(lamp[3].said, '19 days up, longer than usual (usual 10)');
  assert.ok(lamp[3].share! > 0.5, 'past the tick');
  assert.equal(lamp[1].word, 'like', 'one like');
});
