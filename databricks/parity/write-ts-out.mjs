// Node 24 strips types by default, as in app/package.json's test command.
import { readFileSync, writeFileSync } from 'node:fs';
import { answer, basisHash, guard } from '../../app/src/engines/proof/proof.ts';

// Date.parse treats full ISO strings without an offset as local time. Pin the
// fixture runtime to the workspace's UTC clock, independent of the builder's Mac.
process.env.TZ = 'UTC';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/proof.json', import.meta.url), 'utf8'));
const out = fixtures.map(c => {
  const a = answer(c.value, c.rows, c.cite, c.now, c.passed ?? []);
  return { case: c.case, value: { hash: basisHash(c.rows), answer: a, guard: guard(a, c.rules) } };
});
writeFileSync(new URL('./proof.ts-out.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
