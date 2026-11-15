import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Declared } from '../param/param.ts';
import { DECLARED, resolve, validate } from './params.ts';

type Declaration = { name: string; family: string; prior: unknown; guard_lo: number | null; guard_hi: number | null };
const fixture: { typescript: Declaration[]; python: Declaration[] } = JSON.parse(readFileSync(new URL('./fixtures/declared.json', import.meta.url), 'utf8'));
const declarations = (rows: readonly Declared[]) => rows.map(d => ({ name: d.name, family: d.family, prior: d.prior, guard_lo: d.guard_lo ?? null, guard_hi: d.guard_hi ?? null })).sort((a, b) => a.name.localeCompare(b.name));

test('declared parameters match the shared fixture and the Python declarations for every common name', () => {
  const actual = declarations(DECLARED);
  assert.deepEqual(actual, fixture.typescript);
  for (const python of fixture.python) {
    const typescript = actual.find(d => d.name === python.name);
    if (typescript) assert.deepEqual(typescript, python, python.name);
  }
});

test('fitting controls resolve through the registry with versions and validate their guards', () => {
  const params = resolve();
  for (const d of fixture.python.filter(d => ['negotiation_prior_guard_share', 'negotiation_calibration_n', 'negotiation_pooling', 'negotiation_max_rounds'].includes(d.name))) {
    assert.equal(params.values[d.name as keyof typeof params.values], d.prior, d.name);
    assert.equal(params.versions[d.name], 0, d.name);
    const broken = structuredClone(params);
    Object.assign(broken.values, { [d.name]: -1 });
    assert.throws(() => validate(broken), new RegExp(d.name));
  }
  for (const name of ['negotiation_calibration_n', 'negotiation_max_rounds'] as const) {
    const broken = structuredClone(params);
    Object.assign(broken.values, { [name]: 1.5 });
    assert.throws(() => validate(broken), new RegExp(name));
  }
});
