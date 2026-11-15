import assert from 'node:assert/strict';
import { test } from 'node:test';
import { endings, roundToEnding } from './ending.ts';

test('above $20 only prices ending in 5 or 8; at or below $20 whole dollars', () => {
  assert.deepEqual(endings(1800, 3000), [1800, 1900, 2000, 2500, 2800]);
  assert.deepEqual(endings(6000, 8000), [6500, 6800, 7500, 7800]);
});

test('the negotiation worked example: the midpoint $71 rounds to $68, a tie goes down', () => {
  assert.equal(roundToEnding(7100), 6800);
  assert.equal(roundToEnding(7150), 6800);
  assert.equal(roundToEnding(7200), 7500);
});

test('clamped to the floor and ask; null when nothing lies between', () => {
  assert.equal(roundToEnding(6100, undefined, 6000, 8000), 6500);
  assert.equal(roundToEnding(6100, undefined, 6000, 6400), null);
});

test('audit: distant bounds clamp the search and invalid money is refused', () => {
  assert.equal(roundToEnding(100, undefined, 6000, 8000), 6500);
  assert.equal(roundToEnding(99000, undefined, 6000, 8000), 7800);
  assert.throws(() => endings(-1, 500), /lo_cents/);
  assert.throws(() => roundToEnding(-1), /cents/);
});

test('existing callers use Infinity as the unbounded range sentinel', () => {
  assert.equal(roundToEnding(7100, undefined, 0, Infinity), 6800);
});

test('money boundary refuses fractional cents before rounding to an ending', () => {
  assert.throws(() => roundToEnding(7150.5), /cents/);
});
