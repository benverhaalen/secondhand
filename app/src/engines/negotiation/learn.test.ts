import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { memoryStore, forget, type ParamStore, type Scope } from '../param/param.ts';
import { decide, type OfferState } from './choose.ts';
import { offerFromRegistry, switchPolicy } from './policy.ts';
import { features, FEATURE_ORDER, onOutcome, pAcceptFrom, resolveLearning, type Model } from './learn.ts';

const scope = { site: 'poshmark', segment: 'jackets' };
const state = (): OfferState => ({ site: scope.site, offer_cents: 4000, ask_cents: 10000, floor_cents: 3500,
  always_accept_cents: 10000, v_wait_cents: 4000, keep: c => c, trust_block: false,
  features: { round: 0, days_listed: 0, last_concession_share: 0, response_latency_hours: 0, watcher_count: 0, like_count: 0 } });
const at = '2026-01-01T00:00:00Z';
const later = '2026-01-31T00:00:00Z';
const logit = (p: number) => Math.log(p / (1 - p));
function fitted(store: ParamStore): Model { return store.read('P_accept', scope).value as Model; }

test('ordered outcomes move the very next counter; forgetting, held-out promotion and rollback preserve the answer', () => {
  const store = memoryStore(), s = state();
  const build = (c: number, x: OfferState) => features(c, x);
  const p = pAcceptFrom(store, scope, build);
  const matched = Array.from({ length: 50 }, (_, i) => ({ match: `offer:${i}`, champion_keep: 4000, challenger_keep: 4100 }));
  assert.equal(switchPolicy({ store, scope, matched, calibration_error: 0, at, random: () => .5 }).promoted, true);
  const answer = () => offerFromRegistry(s, p, .5, store, scope);
  const before = answer();
  const highCounter = before.candidates.filter(c => c.amount_cents > 4000).at(-1)!.amount_cents;
  const pBefore = p(highCounter, s);
  for (let i = 0; i < 20; i++) {
    const previous = p(highCounter, s);
    const applied = onOutcome(store, scope, { site: s.site, category: scope.segment, features: features(highCounter, s), accepted: 1 }, at);
    assert.equal(applied.applied, true);
    assert.ok(p(highCounter, s) >= previous, `event ${i} must be visible immediately to the existing reader`);
  }
  const learned = answer();
  assert.ok(p(highCounter, s) > pBefore);
  assert.equal(learned.kind, 'counter_offer');
  assert.ok(learned.amount_cents! > before.amount_cents!, 'accepted high-gap counters must move the next ending upward');
  const modelBeforeDecay = fitted(store), versionsBefore = store.rows('P_accept', scope).length;
  const x = features(highCounter, s);
  const prior = { terms: modelBeforeDecay.prior_terms!, weights: modelBeforeDecay.prior_weights! };
  const linear = (m: { terms: Record<string, number>; weights: number[] }) =>
    ['global', `site:${s.site}`, `category:${scope.segment}`, `cell:${s.site}:${scope.segment}`].reduce((z, k) => z + (m.terms[k] ?? 0), 0) + m.weights.reduce((z, w, i) => z + w * x[i], 0);
  const decayed = pAcceptFrom(store, scope, build, later);
  const expected = linear(prior) + forget(30) * (linear(modelBeforeDecay) - linear(prior));
  const pv = resolveLearning(store, scope).values;
  const expectedP = Math.min(pv.negotiation_p_hi, Math.max(pv.negotiation_p_lo, 1 / (1 + Math.exp(-expected))));
  assert.ok(Math.abs(decayed(highCounter, s) - expectedP) < 1e-6, 'an idle read must apply exactly registry forget(30)');
  assert.equal(store.read('P_accept', scope).n_eff, 20 * forget(30));
  assert.equal(store.rows('P_accept', scope).length, versionsBefore + 1, 'one forgetting transition, no fake outcome');
  const previousAnswer = answer(), previousModel = structuredClone(fitted(store));
  const cases = JSON.parse(execFileSync('./.venv/bin/python', ['jobs/negotiation/test_learn_parity.py', '--nightly'], {
    input: JSON.stringify({ model: previousModel, row: { site: s.site, category: scope.segment, features: x } }), encoding: 'utf8',
  })) as { worse: NightlyCase; better: NightlyCase };
  function publish(c: NightlyCase) {
    const history = store.rows('P_accept', scope);
    const candidate = store.propose({ name: 'P_accept', scope, family: 'model_ref', value_or_hyperparams: c.model,
      prior: previousModel, n_eff: c.n, fitted_on_ids_hash: c.hash, metric: 'negative_log_loss',
      held_out_score: -c.loss, guard_lo: null, guard_hi: null }, Math.max(...history.map(r => r.version)));
    return store.promote('P_accept', scope, candidate.version, 0, later, -c.champion_loss);
  }
  assert.ok(cases.worse.loss > cases.worse.champion_loss);
  assert.equal(cases.worse.state, 'kept');
  assert.equal(publish(cases.worse).promoted, false);
  assert.deepEqual(answer(), previousAnswer, 'a held-out loss cannot change the answer');
  assert.ok(cases.better.loss < cases.better.champion_loss);
  assert.equal(cases.better.state, 'promoted');
  assert.equal(publish(cases.better).promoted, true);
  const promoted = answer();
  assert.notEqual(promoted.amount_cents, previousAnswer.amount_cents, 'a winning nightly fit must reach the choice');
  store.rollback('P_accept', scope, later);
  assert.deepEqual(fitted(store), previousModel);
  assert.deepEqual(answer(), previousAnswer, 'rollback must restore both model and answer');
});
type NightlyCase = { model: Model; loss: number; champion_loss: number; n: number; hash: string; state: string };

test('feature vector has one order, uses candidate cents, and refuses undefined gaps and invalid inputs', () => {
  assert.deepEqual(FEATURE_ORDER, ['gap_ratio', 'counter_ask_ratio', 'round', 'days_listed', 'last_concession_share', 'response_latency_hours', 'watcher_count', 'like_count']);
  const s = { ...state(), features: { round: 2, days_listed: 7, last_concession_share: .25, response_latency_hours: 3, watcher_count: 11, like_count: 5 } };
  assert.deepEqual(features(7000, s), [.5, .7, 2, 7, .25, 3, 11, 5]);
  for (const c of [NaN, Infinity, -1, 1.5]) assert.throws(() => features(c, s), /counter_cents/);
  for (const key of ['ask_cents', 'offer_cents'] as const) assert.throws(() => features(7000, { ...s, [key]: 3.5 }), new RegExp(key));
  assert.throws(() => features(7000, { ...s, ask_cents: 4000 }), /gap/);
  assert.throws(() => features(7000, { ...s, features: { ...s.features, watcher_count: NaN } }), /watcher_count/);
  assert.throws(() => features(7000, { ...s, features: { ...s.features, round: 1.5 } }), /round/);
  assert.throws(() => pAcceptFrom(memoryStore(), scope, () => Array<number>(8))(7000, s), /features/);
});

test('declared concession prior chooses midpoint and hierarchical predictions use only matching keys', () => {
  const store = memoryStore(), s = state();
  const p = pAcceptFrom(store, scope, features);
  assert.equal(p(7000, s), .5);
  const d = decide(s, p, 'challenger');
  assert.equal(d.amount_cents, 6800, 'the lower ending wins the symmetric midpoint tie');
  const r = store.propose({ name: 'P_accept', scope, family: 'model_ref', value_or_hyperparams: {
    terms: { global: .1, 'site:poshmark': .2, 'category:jackets': .3, 'cell:poshmark:jackets': .4, 'site:ebay': 100 }, weights: [1, 0, 0, 0, 0, 0, 0, 0] },
    prior: store.read('P_accept', scope).value, held_out_score: 1, n_eff: 100, fitted_on_ids_hash: null, metric: 'negative_log_loss', guard_lo: null, guard_hi: null }, 0);
  store.promote('P_accept', scope, r.version, 0, at);
  assert.ok(Math.abs(logit(p(7000, s)) - 1.5) < 1e-12);
});

test('bad events fail before writing; frozen and foreign scopes cannot update', () => {
  const store = memoryStore(), row = { site: scope.site, category: scope.segment, features: features(9800, state()), accepted: 1 };
  pAcceptFrom(store, scope, features);
  for (const invalid of [{ ...row, accepted: 2 }, { ...row, features: [NaN] }, { ...row, features: Array<number>(8) }, { ...row, may_model: false }, { ...row, site: 'ebay' }, { ...row, category: 'shoes' }]) {
    assert.throws(() => onOutcome(store, scope, invalid, at));
    assert.equal(store.rows('P_accept', scope).length, 0);
  }
  assert.throws(() => onOutcome(store, scope, row, 'not-a-date'), /at/);
  assert.throws(() => onOutcome(store, { ...scope, person: 'owner' }, row, at), /person/);
  onOutcome(store, scope, row, at);
  store.freeze('P_accept', scope, true);
  const before = structuredClone(fitted(store));
  assert.equal(onOutcome(store, scope, row, later).applied, false);
  assert.deepEqual(fitted(store), before);
  assert.equal(store.read('P_accept', { site: 'ebay', segment: 'jackets' }).from, 'prior');
});

test('learned model versions appear in decision citations', () => {
  const store = memoryStore(), s = state();
  onOutcome(store, scope, { site: s.site, category: scope.segment, features: features(9800, s), accepted: 1 }, at);
  const proof = { now: at, code_version: 'test', rows: Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, source: 'offer_outcome', at })) };
  const d = offerFromRegistry({ ...s, proof }, pAcceptFrom(store, scope, features), .5, store, scope);
  const answer = d.proof.expected_keep.answer;
  assert.ok(answer.ok);
  if (answer.ok) assert.equal(answer.citation.param_versions.P_accept, store.read('P_accept', scope).version);
});

test('an idle inherited read forgets the supplying parent without creating a stale child champion', () => {
  const store = memoryStore(), parent = { site: scope.site };
  const row = { site: scope.site, category: scope.segment, features: features(9800, state()), accepted: 1 };
  onOutcome(store, parent, row, at);
  const before = structuredClone(store.read('P_accept', parent).value as Model);
  pAcceptFrom(store, scope, features, later);
  const after = store.read('P_accept', scope);
  assert.equal(after.from, 'parent');
  assert.equal(store.rows('P_accept', scope).length, 0, 'reading an inherited model must preserve its lineage');
  assert.equal(after.n_eff, forget(30));
  const actual = after.value as Model;
  for (const [k, v] of Object.entries(before.terms)) assert.ok(Math.abs(actual.terms[k] - (before.prior_terms![k] + forget(30) * (v - before.prior_terms![k]))) < 1e-12);
  const count = store.rows('P_accept', parent).length;
  pAcceptFrom(store, scope, features, later);
  assert.equal(store.rows('P_accept', parent).length, count, 'same-time reads must not write another version');
});

test('the first child event inherits the parent clock and precision, then applies registry forgetting', () => {
  const parent = { site: scope.site }, reference = memoryStore(), store = memoryStore();
  const row = { site: scope.site, category: scope.segment, features: features(9800, state()), accepted: 1 };
  onOutcome(reference, parent, row, at); onOutcome(store, parent, row, at);
  const parentBefore = structuredClone(store.read('P_accept', parent));
  const expected = onOutcome(reference, parent, { ...row, accepted: 0 }, later);
  const actual = onOutcome(store, scope, { ...row, accepted: 0 }, later);
  assert.deepEqual(actual.read.value, expected.read.value);
  assert.equal(actual.read.n_eff, expected.read.n_eff);
  assert.deepEqual(store.read('P_accept', parent), parentBefore, 'a child outcome cannot train its parent');
});

test('learning records its input, parameter transition and errors through log/', async () => {
  const { createLog, memorySink } = await import('../../../../log/index.js');
  const sink = memorySink(), log = createLog({ src: 'negotiation.test', build: 'test+0', seed: 0, session: 'learn-test', sink });
  const store = memoryStore(), row = { site: scope.site, category: scope.segment, features: features(9800, state()), accepted: 1 };
  onOutcome(store, scope, row, at, log);
  pAcceptFrom(store, scope, features, later, log);
  onOutcome(store, { ...scope, person: 'seller-test' }, { ...row, person: 'seller-test' }, later, log);
  assert.throws(() => onOutcome(store, scope, { ...row, accepted: 2 }, at, log), /accepted/);
  log.end();
  const lines = sink.lines.map(line => JSON.parse(line) as { event: string; entity?: string; param_version?: number; scope?: Scope });
  assert.ok(lines.some(line => line.event === 'state.change' && line.entity === 'param' && line.param_version === store.read('P_accept', scope).version));
  assert.equal(lines.filter(line => line.event === 'state.change').length, 4);
  assert.ok(lines.filter(line => line.event === 'state.change').every(line => line.scope?.site === scope.site));
  assert.equal(lines.filter(line => line.event === 'error').length, 1);
  execFileSync(process.execPath, ['spec/log.mjs', '/dev/stdin'], { input: sink.text(), encoding: 'utf8' });
});
