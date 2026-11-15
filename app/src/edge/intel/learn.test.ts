import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore, forget, type Param } from '../../engines/param/param.ts';
import {
  declareLearning, updateContribution, contributionMean, cutOrder, fitDeadline,
  exploreCutTargets, extractorChallenger, type RouteTruth,
} from './learn.ts';

const at = '2026-11-15T04:00:00Z';
const target = (target_id: string, p95_ms = 100, cents = 1) => ({ target_id, p95_ms, cents });
const scope = { kind: 'price_now', segment: 'retail' };
function row(family: Param['family'], value: unknown): Param {
  return {
    name: family === 'scalar' ? 'deadline_ms' : 'extractor_id', scope, family,
    value_or_hyperparams: value, prior: value, version: 1, fitted_on_ids_hash: null,
    n_eff: 0, metric: null, held_out_score: null, guard_lo: null, guard_hi: null,
    status: 'champion', frozen: false, promoted_at: at, origin: 'fit', previous_version: null, keep: null, days_since_last: null,
  };
}
function pages(count: number, championRight: number, challengerRight: number): RouteTruth[] {
  return Array.from({ length: count }, (_, i) => ({
    page_id: `page-${i}`, held_out: true, truth: { price: 100 },
    champion: { price: i < championRight ? 100 : 90 },
    challenger: { price: i < challengerRight ? 100 : 110 },
  }));
}
const champion = () => row('model_ref', { uri: 'extractor-v1', version: '1' });
const challenger = (): Param => ({ ...row('model_ref', { uri: 'extractor-v2', version: '2' }), version: 2, status: 'challenger' });

test('a route that stops contributing has a lower Beta mean in param rows', () => {
  const store = memoryStore();
  declareLearning(store);
  const settled = { kind: 'price_now' as const, stage: 'settled' as const, called: ['retail'], used: ['retail'] };
  updateContribution(store, settled, at);
  const before = contributionMean(store, 'price_now', 'retail');
  updateContribution(store, { ...settled, used: [] }, at);
  assert.ok(contributionMean(store, 'price_now', 'retail') < before);
  const rows = store.rows('intel_contribution', scope);
  assert.equal(rows.at(-1)?.family, 'beta');
  assert.deepEqual(rows.at(-1)?.value_or_hyperparams, { alpha: 2, beta: 2 });
  assert.equal(rows.at(-1)?.status, 'champion');
  assert.equal(contributionMean(store, 'sold_history', 'retail'), 0.5);
});

test('only called targets learn, once per target per settled answer', () => {
  const store = memoryStore();
  declareLearning(store);
  updateContribution(store, { kind: 'price_now', stage: 'settled', called: ['retail', 'retail', 'index'], used: ['retail'] }, at);
  assert.equal(store.read('intel_contribution', scope).n_eff, 1);
  assert.ok(contributionMean(store, 'price_now', 'index') < 0.5);
  assert.throws(() => updateContribution(store, { kind: 'price_now', stage: 'first', called: ['retail'], used: [] }, at), /settled/);
  assert.throws(() => updateContribution(store, { kind: 'price_now', stage: 'settled', called: ['index'], used: ['retail'] }, at), /called/);
});

test('contribution observations apply the registry 30-day forgetting from injected timestamps', () => {
  const store = memoryStore();
  declareLearning(store);
  const answer = { kind: 'price_now' as const, stage: 'settled' as const, called: ['retail'], used: ['retail'] };
  updateContribution(store, answer, '2026-11-15T04:00:00Z');
  updateContribution(store, { ...answer, used: [] }, '2026-12-15T04:00:00Z');
  const fitted = store.read('intel_contribution', scope);
  // The registry's explicit clock decays the whole posterior by its half-life before the new observation.
  const keep = forget(30);
  assert.ok(Math.abs(fitted.n_eff - (keep + 1)) < 1e-12);
  const alpha = 2 * keep, beta = keep + 1;
  assert.ok(Math.abs(contributionMean(store, 'price_now', 'retail') - alpha / (alpha + beta)) < 1e-12);
});

test('contribution means stay inside prior plus/minus 50% and Beta guards; frozen rows stay fixed', () => {
  const store = memoryStore();
  declareLearning(store);
  for (let i = 0; i < 200; i++) updateContribution(store, { kind: 'price_now', stage: 'settled', called: ['retail'], used: [] }, at);
  assert.ok(contributionMean(store, 'price_now', 'retail') >= 0.25);
  const before = store.read('intel_contribution', scope);
  store.freeze('intel_contribution', scope, true);
  updateContribution(store, { kind: 'price_now', stage: 'settled', called: ['retail'], used: ['retail'] }, at);
  assert.deepEqual(store.read('intel_contribution', scope), before);
});

test('cut order is ascending contribution / (p95_ms * cents), with free targets last', () => {
  const store = memoryStore();
  declareLearning(store);
  updateContribution(store, { kind: 'price_now', stage: 'settled', called: ['slow'], used: ['slow'] }, at);
  const targets = [target('fast', 10, 1), target('slow', 1000, 2), target('costly', 50, 4), target('free', 5000, 0)];
  assert.deepEqual(cutOrder(store, 'price_now', targets).map(t => t.target_id), ['slow', 'costly', 'fast', 'free']);
  assert.equal(targets[0].target_id, 'fast');
  assert.throws(() => cutOrder(store, 'price_now', [target('bad', 0)]), /p95_ms/);
});

test('deadline fit uses nearest-rank p90 of contributing arrivals and the declared starting value', () => {
  const declared = row('scalar', 1000);
  const arrivals = Array.from({ length: 10 }, (_, i) => ({ ms: 100 * (i + 1), used: true }));
  const fitted = fitDeadline(declared, [...arrivals, { ms: 100000, used: false }]);
  assert.equal(fitted.value_or_hyperparams, 900);
  assert.equal(fitted.guard_lo, 500);
  assert.equal(fitted.guard_hi, 1500);
  assert.equal(fitDeadline(declared, [{ ms: 1, used: true }]).value_or_hyperparams, 500);
  assert.equal(fitDeadline(declared, [{ ms: 10000, used: true }]).value_or_hyperparams, 1500);
  assert.equal(fitDeadline({ ...fitted, value_or_hyperparams: 1500 }, [{ ms: 10000, used: true }]).value_or_hyperparams, 1500);
  assert.equal(fitDeadline(declared, []).value_or_hyperparams, 1000);
  assert.equal(declared.value_or_hyperparams, 1000);
  assert.equal(fitDeadline({ ...declared, frozen: true }, arrivals).value_or_hyperparams, 1000);
});

test('J22 exploration share and daily paid cap hold across repeated tries', () => {
  const store = memoryStore();
  declareLearning(store);
  const share = store.read('intel_exploration_share', {}).value;
  assert.equal(share, 0.05);
  assert.equal(typeof share, 'number');
  if (typeof share !== 'number') throw new Error('share must be numeric');
  let daily = { reads: 0, tries: 0, cents: 0 };
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const result = exploreCutTargets([target('retail'), target('history')], { ...daily, reads: daily.reads + 1 }, { share, cents: 3 }, 2, (daily.tries % 2) / 2);
    daily = result.daily;
    result.targets.forEach(t => seen.add(t.target_id));
    assert.ok(daily.tries <= Math.floor(daily.reads * share));
    assert.ok(daily.cents <= 3);
  }
  assert.equal(daily.tries, 3);
  assert.deepEqual([...seen].sort(), ['history', 'retail']);
  assert.equal(exploreCutTargets([target('retail')], { reads: 100, tries: 0, cents: 0 }, { share, cents: 10 }, 0, 0).targets.length, 0);
  assert.throws(() => exploreCutTargets([], daily, { share: 2, cents: 1 }, 1, 0), /share/);
});

test('a worse extractor challenger is not promoted, even when its old score was higher', () => {
  const c = { ...champion(), held_out_score: 0.1 };
  const ch = { ...challenger(), held_out_score: 1 };
  const result = extractorChallenger(c, ch, pages(200, 190, 180), at);
  assert.equal(result.promoted, false);
  assert.equal(result.champion.status, 'champion');
  assert.equal(result.challenger.status, 'challenger');
  assert.equal(result.challenger.held_out_score, 0.9);
});

test('fewer than 200 held-out pages cannot promote, and training pages do not count', () => {
  assert.equal(extractorChallenger(champion(), challenger(), pages(199, 0, 199), at).promoted, false);
  const training = pages(200, 0, 200).map(p => ({ ...p, page_id: `train-${p.page_id}`, held_out: false }));
  const result = extractorChallenger(champion(), challenger(), [...pages(199, 0, 199), ...training], at);
  assert.equal(result.promoted, false);
  assert.equal(result.challenger.n_eff, 199);
});

test('exactly two percentage points over 200 pages promotes; less does not', () => {
  const c = champion(), ch = challenger();
  assert.equal(extractorChallenger(c, ch, pages(200, 180, 183), at).promoted, false);
  const result = extractorChallenger(c, ch, pages(200, 180, 184), at);
  assert.equal(result.promoted, true);
  assert.equal(result.champion.status, 'retired');
  assert.equal(result.challenger.status, 'champion');
  assert.equal(result.challenger.promoted_at, at);
  assert.equal(ch.status, 'challenger');
  assert.equal(extractorChallenger({ ...c, frozen: true }, ch, pages(200, 0, 200), at).promoted, false);
});

test('duplicate truth pages cannot inflate the held-out sample', () => {
  assert.throws(() => extractorChallenger(champion(), challenger(), Array(200).fill(pages(1, 0, 1)[0]), at), /duplicate/);
});
