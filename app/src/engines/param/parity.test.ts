import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { memoryStore, scopeKey, VersionConflict, type Param, type Declared, type Read, type Scope, type Observation } from './param.ts';

type Op = {
  op: 'observe' | 'apply_gamma' | 'propose' | 'promote' | 'rollback' | 'freeze' | 'read';
  name?: string; scope?: Scope; at?: string; outcome?: Observation;
  count?: number; exposure?: number; weight?: number; days_since_last?: number;
  value?: unknown; held_out_score?: number; expect_version?: number; version?: number;
  as_of?: string; keep_evidence?: boolean; anomaly?: boolean; noise?: number; champion_score?: number; on?: boolean; error?: string; reason?: string;
};
type Case = { name: string; declare: Declared[]; ops: Op[]; expect: Read[] };
const cases: Case[] = JSON.parse(readFileSync(new URL('./parity.json', import.meta.url), 'utf8'));

for (const c of cases) test(c.name, () => {
  const s = memoryStore();
  c.declare.forEach((d) => s.declare(d));
  assert.equal(c.ops.length, c.expect.length);
  c.ops.forEach((o, i) => {
    const label = `${c.name}, op ${i} (${o.op})`;
    try {
      const name = o.name ?? c.declare[0].name, scope = o.scope ?? {}, at = o.at ?? '2026-01-01';
      const d = c.declare.find((d) => d.name === name)!;
      const execute = () => {
        switch (o.op) {
          case 'observe': return s.observe(name, scope, o.outcome!, at);
          case 'apply_gamma': return s.apply(name, scope, (v, keep) => {
            const x = v as { shape: number; rate: number };
            return { value: { shape: x.shape * keep + o.weight! * o.count!, rate: x.rate * keep + o.weight! * o.exposure! }, weight: o.weight! };
          }, at, o.days_since_last);
          case 'propose': return s.propose({ name, scope, family: d.family, prior: d.prior, value_or_hyperparams: o.value, n_eff: 40,
            fitted_on_ids_hash: null, metric: null, held_out_score: o.held_out_score!, guard_lo: d.guard_lo ?? null, guard_hi: d.guard_hi ?? null }, o.expect_version!);
          case 'promote': return s.promote(name, scope, o.version!, o.noise ?? 0, at, o.champion_score);
          case 'rollback': return s.rollback(name, scope, at, o.keep_evidence);
          case 'freeze': return s.freeze(name, scope, o.on!);
          case 'read': return s.read(name, scope, o.as_of);
        }
      };
      if (o.error) assert.throws(execute, VersionConflict, label);
      else {
        const result = execute();
        if (o.reason) assert.ok(result && 'reason' in result && result.reason === o.reason, label);
        if (o.anomaly) assert.ok(result && 'anomaly' in result && result.anomaly === true, label);
      }
      const actual = s.read(name, scope, o.as_of), expected = c.expect[i];
      assert.deepEqual({ ...actual, value: null, n_eff: 0 }, { ...expected, value: null, n_eff: 0 }, label);
      const close = (a: unknown, b: unknown): void => {
        if (typeof b === 'number') assert.ok(typeof a === 'number' && Math.abs(a - b) <= 1e-9, `${label}: ${a} != ${b}`);
        else if (b && typeof b === 'object') {
          assert.deepEqual(Object.keys(a as object).sort(), Object.keys(b).sort(), label);
          for (const k of Object.keys(b)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
        } else assert.deepEqual(a, b, label);
      };
      close(actual.value, expected.value);
      close(actual.n_eff, expected.n_eff);
    } catch (error) { throw new Error(label, { cause: error }); }
  });
});

const scopeCases: { scope: Scope; key: string }[] = JSON.parse(readFileSync(new URL('./scope-keys.json', import.meta.url), 'utf8'));
for (const [i, c] of scopeCases.entries()) test(`B1 canonical scope key ${i}`, () => {
  assert.equal(scopeKey(c.scope), c.key);
});


test('B1 TypeScript rows are found by Python and Python rows by TypeScript for all scopes', () => {
  const declaration: Declared = { name: 'p_min_quick', family: 'scalar', prior: 0.6 };
  const s = memoryStore();
  s.declare(declaration);
  const rows = scopeCases.map(({ scope }, i) => {
    const p = s.propose({ ...declaration, scope, value_or_hyperparams: i + 1, n_eff: 40,
      fitted_on_ids_hash: null, metric: null, held_out_score: 0.5, guard_lo: null, guard_hi: null }, 0);
    s.promote(declaration.name, scope, p.version, 0, '2026-01-01');
    return { key: scopeKey(scope), row: s.rows(declaration.name, scope)[0] };
  });
  const output = execFileSync(existsSync('./.venv/bin/python') ? './.venv/bin/python' : 'python', ['-c', `
import json, sys
sys.path.insert(0, 'jobs/param')
from registry import MemoryStore, scope_key
payload = json.load(sys.stdin)
s = MemoryStore()
s.declare(payload['declaration'])
for entry in payload['rows']:
    row = entry['row']
    assert scope_key(row['scope']) == entry['key']
    s.rows[(row['name'], entry['key'])] = [row]
result = []
for entry in payload['rows']:
    row = entry['row']
    assert s.read(row['name'], row['scope'])['value'] == row['value_or_hyperparams']
    s.apply(row['name'], row['scope'], lambda v, keep: {'value': v + 100, 'weight': 1}, '2026-01-01')
    result.append({'key': scope_key(row['scope']), 'row': s.champion(row['name'], row['scope'])})
sys.stdout.write(json.dumps(result, ensure_ascii=False))
`], { input: JSON.stringify({ declaration, rows }), encoding: 'utf8' });
  const returned: { key: string; row: Param }[] = JSON.parse(output);
  const back = memoryStore();
  back.declare(declaration);
  returned.forEach(({ key, row }, i) => {
    assert.equal(scopeKey(row.scope), key);
    const p = back.propose(row, 0);
    back.promote(row.name, row.scope, p.version, 0, '2026-01-01');
    assert.equal(back.read(row.name, row.scope).value, i + 101);
    assert.equal(back.read(row.name, row.scope).n_eff, 41);
  });
});
