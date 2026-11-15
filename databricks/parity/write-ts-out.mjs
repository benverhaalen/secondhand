// Node 24 strips types by default, as in app/package.json's test command.
import { readFileSync, writeFileSync } from 'node:fs';
import { answer, basisHash, basisOf, guard } from '../../app/src/engines/proof/proof.ts';

// Date.parse treats full ISO strings without an offset as local time. Pin the
// fixture runtime to the workspace's UTC clock, independent of the builder's Mac.
process.env.TZ = 'UTC';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/proof.json', import.meta.url), 'utf8'));
// JSON cannot carry undefined or nonfinite values; tags are fixture inputs only.
function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && '$number' in value) {
      return { NaN, Infinity, '-Infinity': -Infinity, '-0': -0 }[value.$number];
    }
    if (Object.keys(value).length === 1 && '$undefined' in value) return undefined;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

function run(raw) {
  const c = decode(raw);
  try {
    if (c.operation === 'basisHash') return basisHash(c.rows);
    if (c.operation === 'basisOf') return basisOf(c.rows, c.now, c.passed ?? []);
    const a = answer(c.value, c.rows, c.cite, c.now, c.passed ?? []);
    if (c.operation === 'answer') return a;
    if (c.operation === 'guard') return guard(a, c.rules);
    return { hash: basisHash(c.rows), answer: a, guard: guard(a, c.rules) };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { error: { name: error.name, message: error.message } };
  }
}

const out = fixtures.map(c => ({ case: c.case, value: run(c) }));
writeFileSync(new URL('./proof.ts-out.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
