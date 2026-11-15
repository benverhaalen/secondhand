import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
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

test('distant bounds leave an empty window and invalid money is refused', () => {
  assert.equal(roundToEnding(100, undefined, 6000, 8000), null);
  assert.equal(roundToEnding(99000, undefined, 6000, 8000), null);
  assert.throws(() => endings(-1, 500), /lo_cents/);
  assert.throws(() => roundToEnding(-1), /cents/);
});

test('posture floor cannot pull an ending more than $10 from the original cents', () => {
  assert.equal(roundToEnding(6499.5, undefined, 7000, 9000), null);
});

test('the $10 window includes its endpoints and excludes a half cent beyond them', () => {
  assert.equal(roundToEnding(6500, undefined, 7000, 9000), 7500);
  assert.equal(roundToEnding(8800, undefined, 6000, 8000), 7800);
  assert.equal(roundToEnding(8800.5, undefined, 6000, 8000), null);
});

test('existing callers use Infinity as the unbounded range sentinel', () => {
  assert.equal(roundToEnding(7100, undefined, 0, Infinity), 6800);
});

test('fractional cents round on either side of a tie without truncating', () => {
  assert.equal(roundToEnding(7149.5), 6800);
  assert.equal(roundToEnding(7150.5), 7500);
  assert.equal(roundToEnding(.5), 0);
  assert.deepEqual(endings(6500.5, 7799.5), [6800, 7500]);
  assert.deepEqual(endings(6800.1, 6800.9), []);
});

for (const value of [NaN, -1, -Infinity, Infinity]) {
  for (const field of ['cents', 'lo_cents', 'hi_cents']) {
    if (field === 'hi_cents' && value === Infinity) continue;
    test(`rounding refuses ${field}=${value} with its field name`, () => {
      const args = { cents: 7100, lo_cents: 0, hi_cents: 8000, [field]: value };
      const error = { name: 'RangeError', message: new RegExp(field) };
      assert.throws(() => roundToEnding(args.cents, undefined, args.lo_cents, args.hi_cents), error);
      if (field !== 'cents') assert.throws(() => endings(args.lo_cents, args.hi_cents), error);
    });
  }
}


test('large finite bounds finish even when adding a dollar cannot advance a Number', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { endings, roundToEnding } from ${JSON.stringify(new URL('./ending.ts', import.meta.url).href)};
    const rule = { above_cents: 2000, digits: [0] };
    assert.deepEqual(endings(1e20, 1e20, rule), [1e20]);
    assert.equal(roundToEnding(1e20, rule, 1e20, 1e20), 1e20);
  `], { timeout: 2000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
