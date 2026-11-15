import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memoryStore } from '../../param/param.ts';
import { candidates, conformal_set, action, label, bound } from './ladder.ts';

test('invalid rungs and similarities cannot enter the ladder', () => {
  for (const rung of [0, 5, 1.5, NaN]) assert.throws(() => candidates([{rung, product: 'a', s: 1}]));
  for (const s of [-0.1, 1.1, NaN, Infinity]) assert.throws(() => candidates([{rung: 1, product: 'a', s}]));
});

test('the hand computed maximum uses rung weights without adding agreement', () => {
  const out = candidates([{rung: 2, product: 'a', s: 0.9}, {rung: 3, product: 'a', s: 1}, {rung: 1, product: 'b', s: 0.6}]);
  assert.ok(Math.abs(out.a[0] - 0.72) < 1e-12);
  assert.deepEqual([...out.a[1]], [2, 3]);
  assert.deepEqual(conformal_set(out, 0.4), ['a', 'b']);
});

test('equal scores sort by product id rather than arrival order', () => {
  const out = candidates([{rung: 1, product: 'z', s: 1}, {rung: 1, product: 'a', s: 1}]);
  assert.deepEqual(conformal_set(out, 0), ['a', 'z']);
});

test('empty or too many asks, one confirms, and two through max pick picks', () => {
  assert.equal(action([]), 'ask');
  assert.equal(action(['a']), 'confirm');
  for (let n = 2; n <= 4; n++) assert.equal(action(Array.from({length: n}, (_, i) => String(i))), 'pick');
  assert.equal(action(['a', 'b', 'c', 'd', 'e']), 'ask');
});

test('only a code rung or a person confirmation may label exact', () => {
  for (const rung of [1, 2, 3, 4]) {
    const out = candidates([{rung, product: 'a', s: 1}]);
    assert.equal(label('a', out, false), rung <= 2 ? 'exact' : 'likely_same_model');
    assert.equal(label('a', out, true), 'exact');
  }
});

test('invalid conformal scores and empty rung evidence are rejected', () => {
  assert.throws(() => conformal_set({}, NaN));
  assert.throws(() => conformal_set({a: [1.1, new Set([1])]}, 0.4));
  assert.throws(() => label('a', {a: [0.5, new Set()]}, false));
});

test('priors come from declarations with the Python identity names', () => {
  const store = memoryStore();
  assert.equal(bound(store, 'identity_q_kind'), 0.6);
  assert.equal(bound(store, 'identity_max_pick'), 4);
  const python = readFileSync(new URL('../../../../../jobs/identity/params.py', import.meta.url), 'utf8');
  for (const [rung, prior] of [[1, 1], [2, 0.8], [3, 0.5], [4, 0.3]]) {
    assert.equal(bound(store, `identity_rung_${rung}` as 'identity_rung_1'), prior);
    assert.ok(python.includes(rung === 1 ? '(1, 1.)' : `(${rung}, .${String(prior).split('.')[1]})`));
  }
});

test('fitted scoped rung weights and the fitted pick cap replace their priors', () => {
  const params = memoryStore();
  function fit(name: 'identity_rung_3'|'identity_max_pick', value: number, scope: {kind?: string}) {
    const prior = bound(params, name);
    const row = params.propose({name, scope, family: 'scalar', value_or_hyperparams: value, prior,
      fitted_on_ids_hash: null, n_eff: 40, metric: 'held_out', held_out_score: 1,
      guard_lo: name === 'identity_max_pick' ? 1 : 0, guard_hi: name === 'identity_max_pick' ? null : 1}, 0);
    assert.equal(params.promote(name, scope, row.version, 0, '2026-11-15T00:00:00Z').promoted, true);
  }
  fit('identity_rung_3', 0.4, {kind: 'shoes'});
  fit('identity_max_pick', 2, {});
  assert.equal(candidates([{rung: 3, product: 'a', s: 1}], params, {kind: 'shoes'}).a[0], 0.4);
  assert.equal(candidates([{rung: 3, product: 'a', s: 1}], params, {kind: 'apparel'}).a[0], 0.5);
  assert.equal(action(['a', 'b', 'c'], params), 'ask');
});
