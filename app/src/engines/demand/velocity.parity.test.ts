import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gammaPosterior } from './velocity.ts';

type Case = { id: string; expected: { shape: number; rate: number; mean: number; p10: number; p90: number } };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/velocity-parity.json', import.meta.url), 'utf8')) as { cases: Case[] };

test('shared SciPy fixture covers small, unit, and large shapes', () => {
  assert.ok(fixture.cases.length >= 10);
  assert.ok(fixture.cases.some(c => c.expected.shape < 1));
  assert.ok(fixture.cases.some(c => c.expected.shape >= 1000));
});

for (const c of fixture.cases) test(`Gamma inversion agrees with Python velocity: ${c.id}`, () => {
  const actual = gammaPosterior(c.expected.shape, c.expected.rate);
  for (const field of ['mean', 'p10', 'p90'] as const)
    assert.ok(Math.abs(actual[field] - c.expected[field]) <= 1e-9, `${c.id}.${field}: ${actual[field]} versus SciPy ${c.expected[field]}`);
});
