import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { onOurSale, qg, resolve, calibrationForCheck } from './aci.ts';

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
  assert.ok(qg(store, group) > 0);
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

test('legacy Check adapter names its cents conversion and never claims measured coverage', () => {
  const store = memoryStore();
  onOurSale(store, group, issued, 6000, at);
  const calibration = calibrationForCheck(store, group, issued);
  assert.equal(calibration.passes, false);
  assert.equal(calibration.coverage, 0);
  assert.ok(Number.isSafeInteger(calibration.Q_g));
  assert.equal(calibration.Q_g, Math.round(issued.q90 * Math.expm1(qg(store, group))));
});

test('a child stores only its own scores and remains pooled until its own basis reaches ten', () => {
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
  assert.ok(qg(store, site) > 0);
  assert.equal(qg(store, child), qg(store, site), 'do not skip the site parent');
});

test('a thin kind can use the global calibration parent', () => {
  const store = memoryStore();
  onOurSale(store, group, issued, 4500, at);
  for (let i = 0; i < 10; i++) onOurSale(store, {}, issued, 6000, at);
  assert.equal(qg(store, group), qg(store, {}));
  assert.ok(qg(store, group) > 0);
});
