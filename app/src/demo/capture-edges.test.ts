// What people get wrong or do not know at capture (spec/edge-cases.md §3 and §4). Written before capture-edges.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cents, correct, described, priceAsk } from './capture-edges.ts';

test('a misspelled brand is shown as the catalog spells it, and an unknown word is kept as typed', () => {
  assert.equal(correct('Carhart'), 'Carhartt');
  assert.equal(correct('carhartt'), 'Carhartt');
  assert.equal(correct('lulu lemon'), 'lululemon');
  assert.equal(correct('Nintedno'), 'Nintendo');
  assert.equal(correct('Gucci'), 'Gucci');
  assert.equal(correct('Bike'), 'Bike', 'one letter from Nike is a different word, not a typo');
});

test('a description names its product through typos', () => {
  assert.equal(described('carhart detroit jacket, brown')?.id, 'pr_j97');
  assert.equal(described('a blue sofa'), null);
});

test('a price far outside the sold range asks once with the range; one inside it asks nothing', () => {
  const sold = { low: 8500, high: 11500 };
  assert.equal(priceAsk(50000, sold), 'Similar ones sold for $85 to $115. List at $500?');
  assert.equal(priceAsk(900, sold), 'Similar ones sold for $85 to $115. List at $9?');
  assert.equal(priceAsk(9800, sold), null);
  assert.equal(priceAsk(34500, sold), null, 'three times the top is still a price someone might ask');
});

test('a typed price reads as cents, and words are not a price', () => {
  assert.equal(cents('$500'), 50000);
  assert.equal(cents('45.50'), 4550);
  assert.equal(cents('fifty'), null);
  assert.equal(cents(''), null);
});
