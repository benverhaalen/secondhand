import assert from 'node:assert/strict';
import { test } from 'node:test';
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

test('a conjugate update that would push a beta mean past its guard is not applied', () => {
  const s = store();
  const r = s.observe('assist_span_open', {}, { success: 1, weight: 1000 }, AT);
  assert.deepEqual([r.applied, r.reason], [false, 'guard']);
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
