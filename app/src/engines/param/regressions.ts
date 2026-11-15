import assert from 'node:assert/strict';
import type { ParamStore, Scope } from './param.ts';
import type { AsyncParamStore } from './sql.ts';

type Store = ParamStore | AsyncParamStore;
const at = '2026-01-01T00:00:00Z';
const later = '2026-04-01T00:00:00Z';
const scope: Scope = { site: 'ebay' };
const declaration = { name: 'assist_span_open', family: 'beta' as const, prior: { alpha: 8, beta: 2 }, guard_hi: 0.9 };
const mean = (v: unknown) => {
  const x = v as { alpha: number; beta: number };
  return x.alpha / (x.alpha + x.beta);
};
const fit = (value: unknown, score = 0.5) => ({ ...declaration, scope, value_or_hyperparams: value,
  n_eff: 20, fitted_on_ids_hash: 'fitted', metric: null, held_out_score: score, guard_lo: null, guard_hi: null });

export const regressions: Record<string, (s: Store) => Promise<void>> = {
  'B1 unknown scope keys are rejected on reads and writes': async (s) => {
    s.declare(declaration);
    const bad = { site: 'ebay', city: 'x' };
    const a = { kind: 'a|site=b', site: 'c' }, b = { kind: 'a', site: 'b|site=c' };
    await s.observe(declaration.name, a, { success: 1, weight: 1 }, at);
    await s.observe(declaration.name, b, { success: 0, weight: 1 }, at);
    assert.deepEqual((await s.read(declaration.name, a)).value, { alpha: 9, beta: 2 });
    assert.deepEqual((await s.read(declaration.name, b)).value, { alpha: 8, beta: 3 });
    await assert.rejects(async () => s.read(declaration.name, bad), /scope/);
    await assert.rejects(async () => s.observe(declaration.name, bad, { success: 1, weight: 1 }, at), /scope/);
  },
  'B2 idle beta evidence fades toward the row prior instead of certainty': async (s) => {
    s.declare(declaration);
    await s.observe(declaration.name, scope, { success: 1, weight: 50 }, at);
    const r = await s.observe(declaration.name, scope, { success: 0, weight: 0 }, '2026-05-01T00:00:00Z');
    assert.deepEqual(r.read.value, { alpha: 11.125, beta: 2 });
    assert.ok(Math.abs(mean(r.read.value) - 0.8) < 0.06);
    const row = (await s.rows(declaration.name, scope)).at(-1)!;
    assert.deepEqual(row.prior, declaration.prior);
    assert.equal(row.n_eff, 3.125);
  },
  'B2 gamma apply decays evidence and retains a fitted row prior': async (s) => {
    s.declare({ name: 'sale_rate', family: 'gamma', prior: { shape: 2, rate: 4 } });
    await s.propose({ ...fit({ shape: 12, rate: 8 }), name: 'sale_rate', family: 'gamma', prior: { shape: 10, rate: 5 } }, 0);
    await s.promote('sale_rate', scope, 1, 0, at);
    const r = await s.apply('sale_rate', scope, (v, keep) => {
      const x = v as { shape: number; rate: number };
      return { value: { shape: x.shape * keep + 1, rate: x.rate * keep + 2 }, weight: 1 };
    }, '2026-01-31T00:00:00Z');
    assert.deepEqual(r.read.value, { shape: 12, rate: 8.5 });
    assert.deepEqual((await s.rows('sale_rate', scope)).at(-1)!.prior, { shape: 10, rate: 5 });
  },
  'B3 reads age evidence and pooled n_eff without changing stored counts': async (s) => {
    s.declare(declaration);
    await s.observe(declaration.name, {}, { success: 0.8, weight: 200 }, at);
    await s.observe(declaration.name, scope, { success: 0, weight: 40 }, at);
    const before = await s.rows(declaration.name, scope);
    const fresh = await s.read(declaration.name, scope, at);
    const aged = await s.read(declaration.name, scope, later);
    assert.equal(aged.n_eff, fresh.n_eff / 8);
    const p = await s.readPooled(declaration.name, scope, at);
    const q = await s.readPooled(declaration.name, scope, later);
    assert.ok('mean' in p && 'mean' in q);
    assert.equal(q.n_eff, p.n_eff / 8);
    assert.ok(Math.abs(q.mean - 0.8) < Math.abs(p.mean - 0.8));
    assert.deepEqual(await s.rows(declaration.name, scope), before);
    assert.deepEqual(await s.read(declaration.name, scope), fresh);
  },
  'B4 guard clamps reads, keeps all 60 observations and learns back inside': async (s) => {
    s.declare(declaration);
    let result;
    for (let i = 0; i < 60; i++) result = await s.observe(declaration.name, scope, { success: 1, weight: 1 }, at);
    assert.equal(result!.applied, true);
    assert.equal(result!.reason, 'clamped');
    assert.equal(result!.anomaly, true);
    assert.equal(mean((await s.read(declaration.name, scope)).value), 0.9);
    const row = (await s.rows(declaration.name, scope)).at(-1)!;
    assert.deepEqual(row.value_or_hyperparams, { alpha: 68, beta: 2 });
    assert.equal(row.n_eff, 60);
    for (let i = 0; i < 60; i++) await s.observe(declaration.name, scope, { success: 0, weight: 1 }, at);
    assert.equal(mean((await s.read(declaration.name, scope)).value), 68 / 130);
    assert.equal((await s.rows(declaration.name, scope)).at(-1)!.n_eff, 120);
  },
  'B3 gamma read decay uses evidence and reduces pooled certainty': async (s) => {
    s.declare({ name: 'sale_rate', family: 'gamma', prior: { shape: 2, rate: 4 } });
    await s.observe('sale_rate', {}, { count: 1, exposure: 2, weight: 200 }, at);
    await s.observe('sale_rate', scope, { count: 1, exposure: 0, weight: 40 }, at);
    const aged = await s.read('sale_rate', scope, later);
    assert.deepEqual(aged.value, { shape: 207, rate: 404 });
    assert.equal(aged.n_eff, 5);
    const fresh = await s.readPooled('sale_rate', scope, at);
    const pooled = await s.readPooled('sale_rate', scope, later);
    assert.ok('mean' in fresh && 'mean' in pooled);
    assert.ok(Math.abs(pooled.mean - 0.5) < Math.abs(fresh.mean - 0.5));
  },
  'B4 gamma guard clamps both bounds while preserving raw shape and rate': async (s) => {
    s.declare({ name: 'sale_rate', family: 'gamma', prior: { shape: 2, rate: 4 }, guard_lo: 0.25, guard_hi: 1 });
    let r = await s.observe('sale_rate', scope, { count: 60, exposure: 0, weight: 1 }, at);
    assert.deepEqual(r.read.value, { shape: 4, rate: 4 });
    assert.equal(r.anomaly, true);
    assert.deepEqual((await s.rows('sale_rate', scope)).at(-1)!.value_or_hyperparams, { shape: 62, rate: 4 });
    r = await s.observe('sale_rate', scope, { count: 0, exposure: 1000, weight: 1 }, at);
    assert.deepEqual(r.read.value, { shape: 251, rate: 1004 });
    assert.deepEqual((await s.rows('sale_rate', scope)).at(-1)!.value_or_hyperparams, { shape: 62, rate: 1004 });
    assert.equal(r.read.n_eff, 2);
  },
  'B5 two fitted champions retain only event evidence and skip abandoned later fits': async (s) => {
    s.declare(declaration);
    await s.propose(fit({ alpha: 8, beta: 2 }), 0);
    await s.promote(declaration.name, scope, 1, 0, at);
    await s.observe(declaration.name, scope, { success: 0, weight: 2 }, at);
    await s.propose(fit({ alpha: 12, beta: 4 }, 0.9), 2);
    await s.promote(declaration.name, scope, 3, 0, at);
    const kept = await s.rollback(declaration.name, scope, at, true);
    assert.deepEqual(kept.value_or_hyperparams, { alpha: 8, beta: 4 });
    assert.equal(kept.n_eff, 22);
    await s.rollback(declaration.name, scope, at);
    await s.observe(declaration.name, scope, { success: 0, weight: 1 }, at);
    assert.equal((await s.rollback(declaration.name, scope, at)).version, 1);
  },
  'B5 retained evidence honors explicit decay and ignores discarded event branches': async (s) => {
    s.declare(declaration);
    await s.propose(fit({ alpha: 18, beta: 2 }), 0);
    await s.promote(declaration.name, scope, 1, 0, at);
    await s.observe(declaration.name, scope, { success: 1, weight: 1, days_since_last: 0 }, '2026-01-31');
    const kept = await s.rollback(declaration.name, scope, '2026-01-31', true);
    assert.deepEqual(kept.value_or_hyperparams, { alpha: 19, beta: 2 });
    assert.equal(kept.n_eff, 21);
    await s.rollback(declaration.name, scope, '2026-01-31');
    await s.observe(declaration.name, scope, { success: 0, weight: 2, days_since_last: 30 }, '2026-01-01');
    const next = await s.rollback(declaration.name, scope, '2026-01-01', true);
    assert.deepEqual(next.value_or_hyperparams, { alpha: 18, beta: 4 });
    assert.equal(next.n_eff, 22);
  },
  'B5 rollback skips event versions and optionally retains only later event evidence': async (s) => {
    s.declare(declaration);
    await s.propose(fit({ alpha: 8, beta: 2 }), 0);
    await s.promote(declaration.name, scope, 1, 0, at);
    await s.observe(declaration.name, scope, { success: 1, weight: 2 }, at);
    await s.observe(declaration.name, scope, { success: 0, weight: 3 }, at);
    const restored = await s.rollback(declaration.name, scope, at);
    assert.equal(restored.version, 1);
    assert.equal(restored.origin, 'fit');
    assert.deepEqual(restored.value_or_hyperparams, { alpha: 8, beta: 2 });
    await s.observe(declaration.name, scope, { success: 1, weight: 4 }, at);
    const kept = await s.rollback(declaration.name, scope, at, true);
    assert.deepEqual(kept.value_or_hyperparams, { alpha: 12, beta: 2 });
    assert.equal(kept.n_eff, 24, 'events discarded by the first rollback must not return');
    assert.deepEqual((await s.rows(declaration.name, scope))[0].value_or_hyperparams, { alpha: 8, beta: 2 }, 'keep_evidence preserves the fitted snapshot');
    assert.equal((await s.rows(declaration.name, scope)).at(-1)!.origin, 'event');
  },
};
