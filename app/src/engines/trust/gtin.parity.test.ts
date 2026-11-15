import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gtin14 } from './recall.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/gtin-parity.json', import.meta.url), 'utf8')) as {
  cases: { input: string; expected: string | null }[];
};
for (const [i, c] of fixture.cases.entries()) test(`GTIN twin ${i}: ${JSON.stringify(c.input)}`, () => {
  assert.equal(gtin14(c.input), c.expected);
});
