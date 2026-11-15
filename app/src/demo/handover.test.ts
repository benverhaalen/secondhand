import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decision, sale } from './build.ts';
import { DARK, FIRST_SPAN, INSTANT, freeLine, moneyPath, nextDays, shippable, spanWords, withDoubleSale } from './handover.ts';
import { world } from './index.ts';

const clearing = world('clearing');
const kindle = clearing.items.find(i => i.id === 'it_kindle')!;

test('the money moves through four words, in order, each with a date or the rule that sets it', () => {
  const o = clearing.orders.find(x => x.id === 'ord_kin')!;
  const path = moneyPath(o, clearing.now);
  assert.deepEqual(path.map(s => s.word), ['Sold', 'On its way', 'Ready on the site', 'In your bank']);
  assert.equal(path[0].done, true);
  assert.ok(path.slice(1).every(s => !s.done));
  for (const s of path) assert.ok(s.line.length > 0, s.word);
  // eBay counts from payment: ready within 2 business days, in the bank within 3 more (fees-and-taxes §1).
  assert.ok(path[2].at && path[3].at && path[3].at > path[2].at);
});

test('instant payout is offered only where the site states its fee, and never as the default', () => {
  assert.equal(INSTANT.mercari, 300);
  assert.equal(INSTANT.ebay, undefined);
  const o = sale({ id: 'ord_x', item: kindle, site: 'mercari', price: 4000, state: 'to_ship', hoursAgo: 1, buyer: 'b', shipBy: 30 });
  const bank = moneyPath(o, clearing.now)[3];
  assert.equal(bank.instant_cents, 300);
  assert.equal(bank.instant_default, false);
});

test('a thing sold on two sites offers no label until the person picks a buyer, and never one for the cancelled sale', () => {
  const a = sale({ id: 'ord_a', item: kindle, site: 'ebay', price: 7200, state: 'to_ship', hoursAgo: 2, buyer: 'first', shipBy: 40 });
  const b = sale({ id: 'ord_b', item: kindle, site: 'mercari', price: 7000, state: 'to_ship', hoursAgo: 1, buyer: 'second', shipBy: 50 });
  const open = decision({ id: 'dec_dbl', kind: 'double_sale', item_id: kindle.id, site: null, feed: 'now', group_form: 'single', deadline: null, why: 'Sold twice.', options: [], suggested: null });
  const undecided = { ...clearing, orders: [a, b], decisions: [open] };
  assert.deepEqual(shippable(undecided).map(o => o.id), []);
  const decided = { ...clearing, orders: [a, { ...b, state: 'cancelled' as const }], decisions: [{ ...open, state: 'answered' as const }] };
  assert.deepEqual(shippable(decided).map(o => o.id), ['ord_a']);
});

test('a meetup is said the way a person says it, from the days and spans tapped', () => {
  const days = nextDays(clearing.now);
  assert.deepEqual(days.map(d => d.label), ['Today', 'Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20', 'Sat 21']);
  assert.equal(spanWords(36, 40), '6 to 8 pm');
  assert.equal(spanWords(22, 26), '11 am to 1 pm');
  assert.equal(spanWords(29, 32), '2:30 to 4 pm');
  assert.equal(freeLine([{ day: days[1], start: 36, end: 40 }, { day: days[5], start: 30, end: 32 }], 'Library parking lot, Main St'),
    'I’m free tomorrow 6 to 8 pm or Fri 3 to 4 pm. Library parking lot on Main St works for me. Does either suit you?');
  assert.ok(FIRST_SPAN.end <= DARK, 'a first span is in daylight');
});

test('the double-sale case the Ship page asks for holds back both labels', () => {
  const w = withDoubleSale(clearing, 'it_kindle');
  assert.equal(w.orders.filter(o => o.item_id === 'it_kindle' && o.state === 'to_ship').length, 2);
  assert.ok(!shippable(w).some(o => o.item_id === 'it_kindle'));
  assert.ok(shippable(w).some(o => o.item_id === 'it_tee'));
});
