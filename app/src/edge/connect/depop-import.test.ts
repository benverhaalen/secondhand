import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDepopProduct, importDepop } from './depop-import.ts';

// A made-up product in the Partner API `Product` shape (partnerapi.depop.com openapi example), not anyone's real listing.
const product = (over: Record<string, unknown> = {}) => ({
  sku: 'FIX-1', product_id: 900001, slug: 'fixture-vintage-champion-tee-900001', status: 'STATUS_ONSALE',
  description: 'Vintage 90s Champion college tee\nRed, single stitch, small mark on hem.\n\n#vintage #champion #90s',
  price_currency: 'USD', price_amount: '30.00', discount_price: '24.00', national_shipping_cost: '5.00', quantity: 1,
  pictures: [{ url: 'https://example.com/p0.jpg', height: 1280, width: 1280 }, { url: 'https://example.com/p1.jpg', height: 1280, width: 1280 }],
  department: 'menswear', product_type: 'tshirts', condition: 'used_excellent', colour: ['red', 'white'],
  style: ['streetwear'], age: ['90s'], source: ['vintage'], brand: 'Champion', ...over,
});

test('a Partner API product becomes a source listing with what a buyer pays now', () => {
  const l = fromDepopProduct(product());
  assert.ok(!('refused' in l));
  assert.equal(l.external_id, '900001');
  assert.equal(l.price_cents, 2400);
  assert.equal(l.list_price_cents, 3000);
  assert.equal(l.condition, 'excellent');
  assert.equal(l.title, 'Vintage 90s Champion college tee');
  assert.deepEqual(l.colours, ['red', 'white']);
  assert.equal(l.state, 'active');
  assert.deepEqual(l.photos, ['https://example.com/p0.jpg', 'https://example.com/p1.jpg']);
  assert.ok(l.tags.includes('vintage') && l.tags.includes('90s'));
});

test('a sold product is marked sold', () => {
  const l = fromDepopProduct(product({ status: 'STATUS_SOLD' }));
  assert.ok(!('refused' in l) && l.state === 'sold');
});

test('a product without a price or photos is refused with the reason, and duplicates are kept once', () => {
  const { listings, refused } = importDepop([product(), product(), product({ product_id: 2, slug: 's2', price_amount: undefined, discount_price: undefined }),
    product({ product_id: 3, slug: 's3', pictures: [] }), 'junk']);
  assert.equal(listings.length, 1);
  assert.deepEqual(refused.map(r => r.refused), ['no price', 'no photos', 'not an object']);
});

test('an unknown condition code is left out rather than guessed', () => {
  const l = fromDepopProduct(product({ condition: 'mystery' }));
  assert.ok(!('refused' in l) && l.condition === undefined);
});
