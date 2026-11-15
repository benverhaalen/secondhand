import assert from 'node:assert/strict';
import { test } from 'node:test';
import { regressions } from './regressions.ts';
import { readFileSync } from 'node:fs';
import { cached, lineage, memoryStore, VersionConflict, type Param } from './param.ts';

const AT = '2026-11-14T22:00:00-06:00';
const fit = (over: Partial<Param> = {}) => ({
  name: 'p_min_quick', scope: { site: 'depop' }, family: 'scalar' as const, value_or_hyperparams: 0.7, prior: 0.6,
  fitted_on_ids_hash: 'h1', n_eff: 40, metric: 'brier', held_out_score: 0.5, guard_lo: 0, guard_hi: 1, ...over,
});
const store = () => {
  const s = memoryStore();
  s.declare({ name: 'p_min_quick', family: 'scalar', prior: 0.6 });
  s.declare({ name: 'assist_span_open', family: 'beta', prior: { alpha: 8, beta: 2 }, guard_lo: 0.02, guard_hi: 0.98 });
  return s;
};

test('falls back to prior: a site with no row reads the declared prior with n_eff 0', () => {
  assert.deepEqual(store().read('p_min_quick', { site: 'mercari' }), { value: 0.6, version: 0, n_eff: 0, from: 'prior', scope: {} });
});

test('a child scope reads its parent; the parent never reads the child or a sibling', () => {
  const s = store();
  s.propose(fit(), 0);
  s.promote('p_min_quick', { site: 'depop' }, 1, 0, AT);
  assert.equal(s.read('p_min_quick', { site: 'depop', person: 'usr_1' }).from, 'parent');
  assert.equal(s.read('p_min_quick', { site: 'depop', person: 'usr_1' }).value, 0.7);
  assert.equal(s.read('p_min_quick', {}).from, 'prior', 'a read without a scope must not return the depop value');
  assert.equal(s.read('p_min_quick', { site: 'ebay' }).value, 0.6, 'a sibling site must not return the depop value');
});

test('lineage climbs state, segment, site, kind, then global', () => {
  assert.deepEqual(lineage({ kind: 'shoes', site: 'ebay', state: 'listed' }), [
    { kind: 'shoes', site: 'ebay', state: 'listed' }, { kind: 'shoes', site: 'ebay' }, { kind: 'shoes' }, {},
  ]);
  assert.deepEqual(lineage({}), [{}]);
});

test('a person-scoped read falls back to the same scope without the person, then the prior, never another person', () => {
  assert.deepEqual(lineage({ site: 'ebay', person: 'u' }), [{ site: 'ebay', person: 'u' }, { site: 'ebay' }]);
  const s = store();
  s.propose(fit({ scope: { site: 'depop', person: 'usr_2' } }), 0);
  s.promote('p_min_quick', { site: 'depop', person: 'usr_2' }, 1, 0, AT);
  assert.equal(s.read('p_min_quick', { site: 'depop', person: 'usr_1' }).from, 'prior');
  s.propose(fit({ scope: {} , value_or_hyperparams: 0.65 }), 0);
  s.promote('p_min_quick', {}, 1, 0, AT);
  assert.equal(s.read('p_min_quick', { site: 'depop', person: 'usr_1' }).from, 'prior', 'a person read does not climb past its own scope without the person');
});

test('no promote: a challenger that loses held-out keeps the champion', () => {
  const s = store();
  s.propose(fit({ held_out_score: 0.5 }), 0);
  s.promote('p_min_quick', { site: 'depop' }, 1, 0.01, AT);
  s.propose(fit({ value_or_hyperparams: 0.9, held_out_score: 0.505 }), 1);
  assert.deepEqual(s.promote('p_min_quick', { site: 'depop' }, 2, 0.01, AT), { promoted: false, reason: 'lost held-out' });
  assert.equal(s.read('p_min_quick', { site: 'depop' }).version, 1);
});

test('a fit without its held-out score is refused', () => {
  assert.throws(() => store().propose(fit({ held_out_score: null }), 0), /held-out/);
});

test('version conflict: of two fits racing from the same version, one wins', () => {
  const s = store();
  s.propose(fit(), 0);
  assert.throws(() => s.propose(fit({ value_or_hyperparams: 0.8 }), 0), VersionConflict);
  assert.equal(s.rows('p_min_quick', { site: 'depop' }).length, 1);
});

test('version restored: rollback sets the previous promoted version back to champion', () => {
  const s = store();
  s.propose(fit({ held_out_score: 0.5 }), 0);
  s.promote('p_min_quick', { site: 'depop' }, 1, 0, AT);
  s.propose(fit({ value_or_hyperparams: 0.9, held_out_score: 0.8 }), 1);
  s.promote('p_min_quick', { site: 'depop' }, 2, 0, AT);
  assert.equal(s.read('p_min_quick', { site: 'depop' }).value, 0.9);
  assert.equal(s.rollback('p_min_quick', { site: 'depop' }, AT).version, 1);
  assert.deepEqual([s.read('p_min_quick', { site: 'depop' }).value, s.read('p_min_quick', { site: 'depop' }).version], [0.7, 1]);
});

test('a conjugate update moves a beta mean, weighted, and a frozen scope does not move', () => {
  const s = store();
  const r = s.observe('assist_span_open', { site: 'depop' }, { success: 0, weight: 1 }, AT);
  assert.equal(r.applied, true);
  assert.deepEqual(r.read.value, { alpha: 8, beta: 3 });
  s.freeze('assist_span_open', { site: 'depop' }, true);
  assert.equal(s.observe('assist_span_open', { site: 'depop' }, { success: 0, weight: 5 }, AT).reason, 'frozen');
});

test('a conjugate update past its guard keeps counts and clamps the read', () => {
  const s = store();
  const r = s.observe('assist_span_open', {}, { success: 1, weight: 1000 }, AT);
  assert.deepEqual([r.applied, r.reason], [true, 'clamped']);
});

test('the 60 s cache serves a read until its time runs out', () => {
  const s = store();
  let t = 0;
  const c = cached(s, () => t, 60_000);
  assert.equal(c.read('p_min_quick', { site: 'depop' }).value, 0.6);
  s.propose(fit(), 0);
  s.promote('p_min_quick', { site: 'depop' }, 1, 0, AT);
  t = 59_999;
  assert.equal(c.read('p_min_quick', { site: 'depop' }).value, 0.6);
  t = 60_000;
  assert.equal(c.read('p_min_quick', { site: 'depop' }).value, 0.7);
});

test('the shared row fixture has exactly the fields of a Param, so the Python side reads the same shape', () => {
  const row = JSON.parse(readFileSync(new URL('./row.json', import.meta.url), 'utf8'));
  const s = store();
  const written = s.propose(fit(), 0);
  assert.deepEqual(Object.keys(row).sort(), Object.keys(written).sort());
});

const DAY0 = '2026-01-01T00:00:00Z';
const DAY30 = '2026-01-31T00:00:00Z';

test('implicit elapsed time halves old counts; explicit elapsed time wins; out-of-order applies without decay', () => {
  const s = store();
  s.observe('assist_span_open', {}, { success: 1, weight: 2 }, DAY0);
  const r = s.observe('assist_span_open', {}, { success: 0, weight: 1 }, DAY30);
  assert.deepEqual(r.read.value, { alpha: 9, beta: 3 });
  assert.equal(r.read.n_eff, 2);
  assert.deepEqual(s.observe('assist_span_open', {}, { success: 1, weight: 1 }, DAY0).read.value, { alpha: 10, beta: 3 });
  assert.deepEqual(s.observe('assist_span_open', {}, { success: 0, weight: 1, days_since_last: 0 }, DAY30).read.value, { alpha: 10, beta: 4 });
});

test('gamma sold comps decay evidence while retaining the prior', () => {
  const s = memoryStore();
  s.declare({ name: 'velocity', family: 'gamma', prior: { shape: 2, rate: 4 }, guard_hi: 2 });
  for (let i = 0; i < 3; i++) s.observe('velocity', {}, { count: 1, exposure: 0, weight: 1, days_since_last: 30 }, DAY0);
  assert.deepEqual(s.read('velocity', {}).value, { shape: 3.75, rate: 4 });
  assert.equal(s.read('velocity', {}).version, 3, 'all three observations are retained');
});

test('gamma apply and observe share the update path; frozen gamma stays unchanged', () => {
  const s = memoryStore();
  s.declare({ name: 'velocity', family: 'gamma', prior: { shape: 2, rate: 4 } });
  for (let i = 0; i < 3; i++) s.observe('velocity', {}, { count: 1, exposure: 0, weight: 1, days_since_last: 30 }, DAY0);
  assert.deepEqual(s.read('velocity', {}).value, { shape: 3.75, rate: 4 });
  s.freeze('velocity', {}, true);
  assert.equal(s.observe('velocity', {}, { count: 1, exposure: 1, weight: 1 }, DAY30).reason, 'frozen');
  assert.equal(s.read('velocity', {}).version, 3);
});

test('model apply inherits shared value without mutating it, accumulates local weight and skips scalar guards', () => {
  const s = memoryStore();
  s.declare({ name: 'P_accept', family: 'model_ref', prior: { term: 0 }, guard_hi: 0 });
  s.apply('P_accept', { site: 'ebay' }, () => ({ value: { term: 4 }, weight: 8 }), DAY0);
  const person = { site: 'ebay', person: 'usr_1' };
  s.apply('P_accept', person, (v) => ({ value: { term: (v as { term: number }).term + 1 }, weight: 1 }), DAY0);
  s.apply('P_accept', person, (v, keep) => ({ value: { term: (v as { term: number }).term * keep }, weight: 2 }), DAY30);
  assert.deepEqual(s.read('P_accept', person).value, { term: 2.5 });
  assert.equal(s.read('P_accept', person).n_eff, 2.5);
  assert.deepEqual(s.read('P_accept', { site: 'ebay' }).value, { term: 4 });
  assert.throws(() => s.observe('P_accept', person, { success: 1, weight: 1 }, DAY30), /beta|gamma/);
});

test('promote compares the same held-out set and writes the score only on a win', () => {
  const s = store();
  s.propose(fit({ held_out_score: 0.9 }), 0);
  s.promote('p_min_quick', { site: 'depop' }, 1, 0, AT);
  s.propose(fit({ held_out_score: 0.5 }), 1);
  assert.equal(s.promote('p_min_quick', { site: 'depop' }, 2, 0.01, AT, 0.6).promoted, false);
  assert.equal(s.rows('p_min_quick', { site: 'depop' })[0].held_out_score, 0.9);
  assert.equal(s.promote('p_min_quick', { site: 'depop' }, 2, 0.01, AT, 0.4).promoted, true);
  assert.equal(s.rows('p_min_quick', { site: 'depop' })[0].held_out_score, 0.4);
});

test('pooled beta and gamma shrink sparse people toward shared data; kappa is a global param', () => {
  for (const family of ['beta', 'gamma'] as const) {
    const s = memoryStore();
    const value = (m: number) => family === 'beta' ? { alpha: m * 10, beta: (1 - m) * 10 } : { shape: m * 10, rate: 10 };
    s.declare({ name: 'velocity', family, prior: value(0.8) });
    const seed = (scope: Param['scope'], m: number, n_eff: number) => {
      s.propose(fit({ name: 'velocity', family, scope, prior: value(0.8), value_or_hyperparams: value(m), n_eff }), 0);
      s.promote('velocity', scope, 1, 0, AT);
    };
    seed({ site: 'ebay' }, 0.8, 200);
    seed({ site: 'ebay', person: 'usr_1' }, 0.2, 3);
    seed({ site: 'ebay', person: 'usr_2' }, 0.1, 200);
    const sparse = s.readPooled('velocity', { site: 'ebay', person: 'usr_1' });
    assert.ok('mean' in sparse);
    assert.ok(Math.abs(sparse.mean - (3 * 0.2 + 20 * 0.8) / 23) < 1e-12);
    assert.deepEqual(sparse.versions, [1, 1]);
    const dense = s.readPooled('velocity', { site: 'ebay', person: 'usr_2' });
    assert.ok('mean' in dense && Math.abs(dense.mean - 0.1) < 0.07);
    const absent = s.readPooled('velocity', { site: 'ebay', state: 'listed', person: 'usr_3' });
    assert.ok('mean' in absent && absent.mean === 0.8 && absent.versions.length === 0);
    assert.equal(s.read('param_pool_kappa', {}).value, 20);
    s.propose(fit({ name: 'param_pool_kappa', scope: {}, value_or_hyperparams: 40 }), 0);
    s.promote('param_pool_kappa', {}, 1, 0, AT);
    const changed = s.readPooled('velocity', { site: 'ebay', person: 'usr_1' });
    assert.ok('mean' in changed && Math.abs(changed.mean - (3 * 0.2 + 40 * 0.8) / 43) < 1e-12);
  }
});

test('pooling recursively weighs every permitted ancestor and the prior, skipping absent scopes', () => {
  const s = memoryStore();
  s.declare({ name: 'sale_rate', family: 'gamma', prior: { shape: 2, rate: 10 } });
  for (const [scope, shape, n_eff] of [[{}, 8, 20], [{ kind: 'shoes' }, 4, 40], [{ kind: 'shoes', site: 'ebay', segment: 'boots' }, 9, 3]] as const) {
    s.propose(fit({ name: 'sale_rate', family: 'gamma', scope, value_or_hyperparams: { shape, rate: 10 }, n_eff }), 0);
    s.promote('sale_rate', scope, 1, 0, AT);
  }
  const r = s.readPooled('sale_rate', { kind: 'shoes', site: 'ebay', segment: 'boots', state: 'listed' });
  const global = (20 * 0.8 + 20 * 0.2) / 40;
  const kind = (40 * 0.4 + 20 * global) / 60;
  assert.ok('mean' in r && Math.abs(r.mean - (3 * 0.9 + 20 * kind) / 23) < 1e-12);
  assert.ok('versions' in r && r.versions.length === 3 && r.n_eff === 3);
});

for (const [name, check] of Object.entries(regressions)) test(name, () => check(memoryStore()));
