import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { memoryStore } from '../../param/param.ts';
import { identifyParam } from '../../../edge/identify/spend.ts';
import { DECLARED, candidates, conformal_set, action, label, bound } from './ladder.ts';

const pythonPath = (exists: (path: URL) => boolean): URL|undefined => ['.venv/bin/python', '.venv/Scripts/python.exe']
  .map(path => new URL(`../../../../../${path}`, import.meta.url)).find(exists);
const pythonCheck = (exists: (path: URL) => boolean): {path?: URL; skip?: string} => {
  const path = pythonPath(exists);
  return path ? {path} : {skip: 'Python declarations not checked: neither .venv/bin/python nor .venv/Scripts/python.exe exists'};
};

test('the Python declaration check finds either virtualenv layout', () => {
  for (const layout of ['.venv/bin/python', '.venv/Scripts/python.exe']) {
    assert.equal(pythonPath(path => path.href.endsWith(layout))?.href, new URL(`../../../../../${layout}`, import.meta.url).href);
  }
});
test('missing virtualenv Python gives an explicit skip reason', () => {
  const choice = pythonCheck(() => false);
  assert.equal(choice.path, undefined);
  assert.equal(choice.skip, 'Python declarations not checked: neither .venv/bin/python nor .venv/Scripts/python.exe exists');
});

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

test('priors come from declarations with the Python identity names', t => {
  const store = memoryStore();
  assert.equal(bound(store, 'identity_q_kind'), 0.6);
  assert.equal(bound(store, 'identity_max_pick'), 4);
  const choice = pythonCheck(existsSync);
  if (!choice.path) {t.skip(choice.skip); return;}
  const python: unknown = JSON.parse(execFileSync(fileURLToPath(choice.path), ['-c',
    'import json; from jobs.identity.params import DECLARED; print(json.dumps({row["name"]: row["prior"] for row in DECLARED}))'],
    {cwd: new URL('../../../../../', import.meta.url), encoding: 'utf8'}));
  assert.ok(typeof python === 'object' && python !== null);
  for (const [rung, prior] of [[1, 1], [2, 0.8], [3, 0.5], [4, 0.3]]) {
    assert.equal(bound(store, `identity_rung_${rung}` as 'identity_rung_1'), prior);
    assert.equal(Reflect.get(python, `identity_rung_${rung}`), prior);
  }
  assert.equal(Reflect.get(python, 'identity_q_kind'), 0.6);
  assert.equal(Reflect.get(python, 'identity_max_pick'), 4);
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

for (const [name, cap] of [['identify_spend_cap_capture_micro', 3000], ['identify_spend_cap_day_micro', 100000]] as const)
  test(`${name} refuses a param row above Nate's approved cap of ${cap}`, () => {
    const params = memoryStore();
    params.declare(DECLARED.find(row => row.name === name)!);
    assert.equal(identifyParam(params, name), cap);
    params.apply(name, {}, () => ({value: cap + 1, weight: 1}), '2026-11-15T00:00:00Z');
    assert.equal(params.rows(name, {})[0].value_or_hyperparams, cap + 1);
    assert.throws(() => identifyParam(params, name), new RegExp(`${name} outside guard`));
  });
