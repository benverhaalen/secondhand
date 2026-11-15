import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calibrate, type Calib } from './calibration.ts';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/calibration-parity.json', import.meta.url), 'utf8')) as { cases: { cal: Calib; z: number; expected: number }[] };
for (const [i, c] of fixture.cases.entries()) test(`calibration twin ${i}: ${c.cal.kind}, z=${c.z}`, () => {
  const actual = calibrate(c.z, c.cal);
  assert.ok(Math.abs(actual - c.expected) <= Math.max(1e-30, Math.abs(c.expected) * 1e-14), `${actual} != ${c.expected}`);
});
for (const cal of [
  { kind: 'isotonic', xs: [], ys: [] }, { kind: 'isotonic', xs: [1, 0], ys: [.1, .3] },
  { kind: 'isotonic', xs: [0], ys: [1.1] }, { kind: 'isotonic', xs: [NaN], ys: [.1] },
  { kind: 'isotonic', xs: [0, 1], ys: [.5, .1] }, { kind: 'platt', a: NaN, b: 0 },
]) test(`invalid calibration refuses ${JSON.stringify(cal)}`, () => assert.throws(() => calibrate(0, cal), RangeError));
