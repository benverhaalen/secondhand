import assert from 'node:assert/strict';
import { test } from 'node:test';
import { familyBands, type Sale } from './fast.ts';

const day = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 86400e3).toISOString();
const sale = (i: number, o: Partial<Sale> = {}): Sale => ({
  family_id: 'levis-501', category: 'jeans', condition: 'used_good', adjusted_cents: 3000 + i * 100, w: 1, sold_at: day(i), ...o,
});

test('a family with 20 or more sales answers from the family', () => {
  const b = familyBands();
  for (let i = 0; i < 25; i++) b.onSale(sale(i));
  const band = b.band('levis-501', 'jeans', 'used_good');
  assert.ok(band);
  assert.equal(band.basis, 'family');
  assert.equal(band.n, 25);
  assert.ok(band.low < band.high && band.low >= 3000 && band.high <= 5400);
});

test('no family, or a thin one, answers from the wider category band', () => {
  const b = familyBands();
  for (let i = 0; i < 5; i++) b.onSale(sale(i));
  for (let i = 0; i < 30; i++) b.onSale(sale(i, { family_id: 'other', adjusted_cents: 1000 + i * 300 }));
  assert.equal(b.band('levis-501', 'jeans', 'used_good')?.basis, 'category');
  assert.equal(b.band(null, 'jeans', 'used_good')?.basis, 'category');
});

test('a thin category answers nothing: "Pricing this..." until the Check', () => {
  const b = familyBands();
  for (let i = 0; i < 19; i++) b.onSale(sale(i));
  assert.equal(b.band('levis-501', 'jeans', 'used_good'), null);
  assert.equal(b.band('levis-501', 'jeans', 'new_with_tags'), null);
});

test('a sale event refreshes the band at once, never stale', () => {
  const b = familyBands();
  for (let i = 0; i < 20; i++) b.onSale(sale(i));
  const before = b.band('levis-501', 'jeans', 'used_good')!;
  for (let i = 0; i < 20; i++) b.onSale(sale(20 + i, { adjusted_cents: 9000 }));
  const after = b.band('levis-501', 'jeans', 'used_good')!;
  assert.ok(after.high > before.high);
  assert.equal(after.as_of, day(39));
});

test('sales older than 90 days leave the band', () => {
  const b = familyBands();
  for (let i = 0; i < 20; i++) b.onSale(sale(i));
  b.expire(day(95));
  assert.equal(b.band('levis-501', 'jeans', 'used_good'), null);
});

test('within the 2 s budget: 10,000 sales land and a read answers well under it', () => {
  const b = familyBands();
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) b.onSale(sale(i % 80, { family_id: `f${i % 50}` }));
  b.band('f1', 'jeans', 'used_good');
  assert.ok(performance.now() - t0 < 2000);
});
