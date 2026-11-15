import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderBook, ledger, type OrderRead } from './orders.ts';

const read = (state: OrderRead['state'], over: Partial<OrderRead> = {}): OrderRead => ({
  kind: 'sale', site: 'mercari', external_order_id: 'M-1', user_id: 'u1', item_id: 'i1', listing_id: 'L1',
  state, price_cents: 4200, fees_cents: 420, shipping_cents: 0, ...over,
});

test('order read twice: one order, one ledger row, one new sale', () => {
  const b = orderBook();
  assert.equal(b.apply(read('paid')).new_sale, true);
  const again = b.apply(read('paid'));
  assert.equal(again.new_sale, false); assert.equal(again.changed, false);
  assert.equal(ledger(b.all()).length, 1);
});

test('read_orders to handover and payout; the payout is written once', () => {
  const b = orderBook();
  b.apply(read('paid')); b.apply(read('to_ship')); b.apply(read('delivered')); // shipped skipped between reads
  b.apply(read('claim_window'));
  b.apply(read('released', { payout_cents: 3780 }));
  b.apply(read('released', { payout_cents: 9999 }));
  const [row] = ledger(b.all());
  assert.equal(row.kept_cents, 3780); assert.equal(row.settled, true); assert.equal(row.earned_cents, 4200);
});

test('a stale read never moves an order backwards', () => {
  const b = orderBook();
  b.apply(read('paid')); b.apply(read('shipped'));
  assert.equal(b.apply(read('paid')).ignored, 'backwards');
  assert.equal(b.all()[0].state, 'shipped');
});

test('refund: the ledger row is reversed', () => {
  const b = orderBook();
  for (const s of ['paid', 'to_ship', 'shipped', 'delivered', 'claim_window', 'return_open', 'refunded'] as const) b.apply(read(s));
  const [row] = ledger(b.all());
  assert.equal(row.reversed, true); assert.equal(row.earned_cents, 0); assert.equal(row.kept_cents, 0);
});

test('a purchase is not a sale in the ledger', () => {
  const b = orderBook();
  assert.equal(b.apply(read('paid', { kind: 'purchase', external_order_id: 'P-1' })).new_sale, false);
  assert.equal(ledger(b.all()).length, 0);
});
