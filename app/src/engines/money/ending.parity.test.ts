import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { endings, roundToEnding, type EndingRule } from './ending.ts';
const cases: { name: string; cents: number; lo: number; hi: number; rule?: EndingRule; expected?: number | null; endings?: number[]; error?: boolean }[] = JSON.parse(readFileSync(new URL('./fixtures/ending-parity.json', import.meta.url), 'utf8'));
for (const c of cases) test(`shared ending: ${c.name}`, () => {
  if (c.error) { assert.throws(() => roundToEnding(c.cents, c.rule, c.lo, c.hi), RangeError); return; }
  assert.equal(roundToEnding(c.cents, c.rule, c.lo, c.hi), c.expected);
  if (c.endings) assert.deepEqual(endings(c.lo, c.hi, c.rule), c.endings);
});
