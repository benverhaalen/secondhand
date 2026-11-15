import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { onOurSale, qg, resolve, calibrationForCheck } from './aci.ts';
import { resolve as resolveValuation } from './params.ts';

const at = '2026-08-01T00:00:00Z', group = { kind: 'apparel' };
const issued = { q10: 4000, q90: 5000 };

test('ACI uses the range actually issued, records log scores, and survives a new reader', () => {
  const store = memoryStore();
  assert.equal(qg(store, group), 0);
  onOurSale(store, group, issued, 6000, at);
  assert.ok(Math.abs(Number(resolve(store, group).values.valuation_aci_alpha) - .196) < 1e-12);
  assert.ok(Math.abs(qg(store, group) - Math.log(6000 / 5000)) < 1e-12);
  onOurSale(store, group, issued, 4000, at);
  assert.ok(Math.abs(Number(resolve(store, group).values.valuation_aci_alpha) - .197) < 1e-12, 'endpoints count as hits');
  assert.equal(qg(store, group), Math.log(6000 / issued.q90));
  assert.equal(qg(store, { kind: 'electronics' }), 0);
});

test('multiplying every money value preserves Q_g', () => {
  const a = memoryStore(), b = memoryStore();
  onOurSale(a, group, issued, 6000, at);
  onOurSale(b, group, { q10: 40000, q90: 50000 }, 60000, at);
  assert.equal(qg(a, group), qg(b, group));
});

test('ACI clamps both tails and does not decay alpha between sales', () => {
  const store = memoryStore();
  for (let i = 0; i < 100; i++) onOurSale(store, group, issued, 6000, at);
  assert.equal(resolve(store, group).values.valuation_aci_alpha, .05);
  for (let i = 0; i < 600; i++) onOurSale(store, group, issued, 4500, at);
  assert.equal(resolve(store, group).values.valuation_aci_alpha, .5);
  const later = '2026-08-31T00:00:00Z';
  assert.notEqual(at, later);
  assert.equal(store.read('valuation_aci_alpha', group, later).value, .5);
  onOurSale(store, group, issued, 6000, later);
  assert.equal(resolve(store, group).values.valuation_aci_alpha, .496);
});

test('invalid money names its boundary field and never changes the calibration', () => {
  const store = memoryStore();
  for (const bad of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => onOurSale(store, group, issued, bad, at), /sold_cents/);
    assert.throws(() => onOurSale(store, group, { ...issued, q10: bad }, 4500, at), /q10/);
    assert.throws(() => onOurSale(store, group, { ...issued, q90: bad }, 4500, at), /q90/);
  }
  assert.throws(() => onOurSale(store, group, { q10: 5000, q90: 4000 }, 4500, at), /q10/);
  assert.throws(() => onOurSale(store, group, issued, 0, at), /sold_cents/);
  assert.equal(qg(store, group), 0);
});

test('Check calibration carries log units and measures the stored hit history', () => {
  const store = memoryStore();
  onOurSale(store, group, issued, 6000, at);
  const calibration = calibrationForCheck(store, group, issued);
  assert.equal(calibration.passes, false);
  assert.equal(calibration.coverage, 0);
  assert.equal(calibration.n, 1);
  assert.equal(calibration.hits, 0);
  assert.equal(calibration.Q_g, qg(store, group));
});

test('40 calibration scores with 32 hits report coverage .8 and read the checked minimum from the registry', () => {
  const store = memoryStore();
  resolve(store, group);
  store.apply('valuation_conformal_scores', group, () => ({ value: {
    scores: Array.from({ length: 40 }, (_, i) => ({ score: i < 32 ? -.1 : .3, at, err: i < 32 ? 0 : 1 })),
  }, weight: 40 }), at);
  const calibration = calibrationForCheck(store, group, issued);
  assert.equal(calibration.n, 40); assert.equal(calibration.hits, 32);
  assert.equal(calibration.coverage, .8); assert.equal(calibration.passes, true);
  resolveValuation(store, group);
  store.apply('valuation_checked_min_n', group, () => ({ value: 41, weight: 1 }), at);
  assert.equal(calibrationForCheck(store, group, issued).passes, false);
  const empty = calibrationForCheck(memoryStore(), group, issued);
  assert.equal(empty.n, 0); assert.equal(empty.hits, 0); assert.equal(empty.coverage, 0);
});

test('a child stores only its own scores and remains pooled below the declared cell minimum', () => {
  const store = memoryStore(), child = { ...group, site: 'ebay' };
  for (let i = 0; i < 10; i++) onOurSale(store, group, issued, 6000, at);
  onOurSale(store, child, issued, 4500, at);
  const state = store.read('valuation_conformal_scores', child).value as { scores: unknown[] };
  assert.equal(state.scores.length, 1, 'parent scores are a fallback, not child observations');
  assert.equal(qg(store, child), qg(store, group));
});

test('thin groups use the nearest parent that has scores', () => {
  const store = memoryStore(), site = { ...group, site: 'ebay' }, child = { ...site, segment: 'good' };
  for (let i = 0; i < 10; i++) onOurSale(store, group, issued, 4500, at);
  for (let i = 0; i < 10; i++) onOurSale(store, site, issued, 6000, at);
  onOurSale(store, child, issued, 4500, at);
  assert.equal(qg(store, site), Math.log(6000 / issued.q90));
  assert.equal(qg(store, child), qg(store, site), 'do not skip the site parent');
});

test('a thin kind can use the global calibration parent', () => {
  const store = memoryStore();
  onOurSale(store, group, issued, 4500, at);
  for (let i = 0; i < 10; i++) onOurSale(store, {}, issued, 6000, at);
  assert.equal(qg(store, group), qg(store, {}));
  assert.equal(qg(store, group), Math.log(6000 / issued.q90));
});

function seedScores(store: ReturnType<typeof memoryStore>, scope: typeof group, values: number[]) {
  resolve(store, scope);
  store.apply('valuation_conformal_scores', scope, () => ({
    value: { scores: values.map(score => ({ score, at, err: 1 })) }, weight: values.length,
  }), at);
}

test('decayed scores use 24.5 total mass for the finite-sample rank and stay below the maximum', () => {
  const store = memoryStore(); resolve(store, group);
  const later = '2026-10-30T00:00:00Z';
  store.apply('valuation_conformal_scores', group, () => ({ value: {
    scores: Array.from({ length: 40 }, (_, i) => ({ score: (i + 1) / 100, at: i < 31 ? at : later, err: 1 })),
  }, weight: 40 }), later);
  assert.equal(qg(store, group), .37, 'ceil((24.5 + 1) * .8) = 21 units of decayed weight');
  assert.ok(qg(store, group) < .4);
});

test('200 group scores determine their own quantile even when the parent has only three', () => {
  const store = memoryStore(), child = { ...group, site: 'ebay' };
  const own = Array.from({ length: 200 }, (_, i) => (i + 1) / 100);
  seedScores(store, group, [10, 20, 30]);
  seedScores(store, child, own);
  const rank = Math.ceil((own.length + 1) * (1 - .2));
  assert.equal(qg(store, child), own[rank - 1]);
  assert.equal(resolve(store, child).values.valuation_conformal_parent_min, 30);
});

test('five group scores pool with 300 parent scores at exactly thirty total mass', () => {
  const store = memoryStore(), child = { ...group, site: 'ebay' };
  const own = [0, .01, .02, .03, .04];
  const parent = Array.from({ length: 300 }, (_, i) => (i + 1) / 100);
  seedScores(store, group, parent);
  seedScores(store, child, own);
  const minimum = 30, parentWeight = (minimum - own.length) / parent.length;
  const weighted = own.map(score => ({ score, weight: 1 }))
    .concat(parent.map(score => ({ score, weight: parentWeight })))
    .sort((a, b) => a.score - b.score);
  const threshold = Math.ceil((minimum + 1) * (1 - .2)) / minimum * weighted.reduce((total, row) => total + row.weight, 0);
  let mass = 0, expected = 0;
  for (const row of weighted) {
    mass += row.weight;
    if (mass >= threshold) { expected = row.score; break; }
  }
  assert.ok(expected > own[4] && expected < parent[Math.ceil(301 * .8) - 1]);
  assert.equal(qg(store, child), expected);
});

test('the 2001st conformal score drops the oldest and retains the newest 2000', () => {
  const store = memoryStore();
  seedScores(store, group, Array.from({ length: 2000 }, (_, i) => i / 1000));
  onOurSale(store, group, issued, 6000, at);
  const state = store.read('valuation_conformal_scores', group).value as { scores: { score: number }[] };
  assert.equal(resolve(store, group).values.valuation_conformal_scores_max, 2000);
  assert.equal(state.scores.length, 2000);
  assert.equal(state.scores[0].score, .001);
  assert.equal(state.scores[1999].score, Math.log(6000 / issued.q90));
});

test('large existing calibration rows can be read without exhausting the argument stack', () => {
  const store = memoryStore();
  seedScores(store, group, Array.from({ length: 150000 }, (_, i) => i / 100000));
  assert.equal(qg(store, group), (Math.ceil(150001 * .8) - 1) / 100000);
});

test('sold_cents rejects nonpositive, nonfinite and unsafe amounts before any write', () => {
  const store = memoryStore();
  onOurSale(store, group, issued, 6000, at);
  const before = ['valuation_aci_alpha', 'valuation_conformal_scores'].map(name => store.rows(name, group));
  for (const bad of [-1, 0, .5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => onOurSale(store, group, issued, bad, at), RangeError);
    assert.deepEqual(['valuation_aci_alpha', 'valuation_conformal_scores'].map(name => store.rows(name, group)), before);
  }
});
