import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { comparables, DEFAULTS, LEGACY, type Comp, type Target, type Params } from './comps.ts';
import { DECLARED } from './params.ts';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/comps-parity.json', import.meta.url), 'utf8')) as {
  declared: typeof DECLARED; cases: { name: string; target: Target; rows: Comp[]; as_of: string; legacy?: boolean; params?: Partial<Params>; expected: ReturnType<typeof comparables> }[];
};
test('R3: the parity fixture records every declared prior and source', () => assert.deepEqual(fixture.declared, JSON.parse(JSON.stringify(DECLARED))));
for (const c of fixture.cases) test(`R5: ${c.name}`, () => {
  const result = comparables(c.target, c.rows, c.as_of, { ...(c.legacy ? LEGACY : DEFAULTS), ...c.params });
  assert.deepEqual(result, c.expected);
});
