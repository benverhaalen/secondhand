import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { memoryStore, VersionConflict, type Declared, type Read, type Scope, type Observation } from './param.ts';

type Op = {
  op: 'observe' | 'apply_gamma' | 'propose' | 'promote' | 'rollback' | 'freeze' | 'read';
  name?: string; scope?: Scope; at?: string; outcome?: Observation;
  count?: number; exposure?: number; weight?: number; days_since_last?: number;
  value?: unknown; held_out_score?: number; expect_version?: number; version?: number;
  noise?: number; champion_score?: number; on?: boolean; error?: string; reason?: string;
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
          case 'rollback': return s.rollback(name, scope, at);
          case 'freeze': return s.freeze(name, scope, o.on!);
          case 'read': return s.read(name, scope);
        }
      };
      if (o.error) assert.throws(execute, VersionConflict, label);
      else {
        const result = execute();
        if (o.reason) assert.ok(result && 'reason' in result && result.reason === o.reason, label);
      }
      const actual = s.read(name, scope), expected = c.expect[i];
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
