import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { DECLARED, gammaPosterior, onSoldComp, onExposure, velocity } from './velocity.ts';

const at = '2026-08-01T00:00:00Z';
const product = { kind: 'apparel', product_id: 'p1' };

test('a sold comp adds exactly one shape; exposure adds only listing-weeks', () => {
  const store = memoryStore();
  velocity(store, product, at);
  onSoldComp(store, product, at);
  assert.deepEqual(store.read('demand_velocity', { kind: 'apparel', segment: 'p1' }).value, { shape: 5, rate: 2 });
  onExposure(store, product, 2, at);
  assert.deepEqual(store.read('demand_velocity', { kind: 'apparel', segment: 'p1' }).value, { shape: 5, rate: 4 });
});

test('invalid exposure, identity and time are refused before any observation', () => {
  const store = memoryStore();
  for (const exposure of [-1, NaN, Infinity]) assert.throws(() => onExposure(store, product, exposure, at), /listing_weeks/);
  assert.throws(() => onSoldComp(store, { ...product, product_id: '' }, at), /product_id/);
  assert.throws(() => velocity(store, product, 'bad'), /as_of/);
  onSoldComp(store, product, at);
  assert.throws(() => onSoldComp(store, product, '2026-07-01T00:00:00Z'), /out.of.order/);
});

test('Gamma edges refuse wrong numbers and retain the exponential analytic quantiles', () => {
  for (const [shape, rate] of [[0, 1], [-1, 1], [1, 0], [NaN, 1], [1, Infinity]])
    assert.throws(() => gammaPosterior(shape, rate), /shape|rate/);
  const p = gammaPosterior(1, 2);
  assert.ok(Math.abs(p.p10 - -Math.log(.9) / 2) < 1e-10);
  assert.ok(Math.abs(p.p90 - -Math.log(.1) / 2) < 1e-10);
});

test('kind pooling is read from the registry, and unrelated products never donate observations', () => {
  const store = memoryStore();
  for (const d of DECLARED) store.declare(d);
  store.observe('demand_velocity', { kind: 'apparel' }, { count: 20, exposure: 2, weight: 1 }, at);
  const before = velocity(store, product, at);
  assert.equal(before.basis_level, 'kind');
  onSoldComp(store, { ...product, product_id: 'other' }, at);
  assert.deepEqual(velocity(store, product, at), before);
  onSoldComp(store, product, at);
  const after = velocity(store, product, at);
  assert.equal(after.basis_level, 'product');
  assert.ok(after.mean > before.mean);
  assert.ok(after.param_versions.demand_velocity > 0);
});

test('demand applies the declared eight-week half-life to excess counts, preserving the kind prior', () => {
  const store = memoryStore();
  onSoldComp(store, product, at);
  onExposure(store, product, 0, '2026-09-26T00:00:00Z');
  const raw = store.read('demand_velocity', { kind: 'apparel', segment: 'p1' }).value;
  assert.deepEqual(raw, { shape: 4.5, rate: 2 });
  const history = store.rows('demand_velocity', { kind: 'apparel', segment: 'p1' }).length;
  onExposure(store, product, 0, '2026-09-26T00:00:00Z');
  assert.equal(store.rows('demand_velocity', { kind: 'apparel', segment: 'p1' }).length, history);
});

test('splitting the same exposure across polls cannot change the pooled answer', () => {
  const one = memoryStore(), split = memoryStore();
  onExposure(one, product, 2, at);
  onExposure(split, product, 1, at); onExposure(split, product, 1, at);
  const a = velocity(one, product, at), b = velocity(split, product, at);
  for (const field of ['mean', 'p10', 'p90'] as const) assert.equal(a[field], b[field], field);
});

test('a cold product borrows the kind mean at two weeks, never its entire sample size', () => {
  const store = memoryStore();
  for (const d of DECLARED) store.declare(d);
  store.observe('demand_velocity', { kind: 'apparel' }, { count: 2000, exposure: 1000, weight: 1 }, at);
  const cold = velocity(store, product, at), prior = gammaPosterior(4, 2);
  for (const field of ['mean', 'p10', 'p90'] as const) assert.equal(cold[field], prior[field], field);
});

test('a fresh product seeds the pooled kind mean at prior weeks without adding the inherited prior twice', () => {
  const store = memoryStore(), scope = { kind: product.kind, segment: product.product_id };
  for (const d of DECLARED) store.declare(d);
  store.observe('demand_velocity', { kind: product.kind }, { count: 8, exposure: 2, weight: 1 }, at);
  const parent = store.readPooled('demand_velocity', { kind: product.kind });
  assert.ok('mean' in parent);
  const inherited = store.read('demand_velocity', scope).value;
  onExposure(store, product, 0, at);
  const row = store.rows('demand_velocity', scope).find(r => r.status === 'champion')!;
  assert.deepEqual(row.value_or_hyperparams, { shape: parent.mean * 2, rate: 2 });
  assert.deepEqual(row.prior, inherited);
  assert.equal(row.n_eff, 0);
});

test('idle demand decays signed evidence toward the current kind baseline at the declared half-life', () => {
  const store = memoryStore(), scope = { kind: product.kind, segment: product.product_id };
  for (const d of DECLARED) store.declare(d);
  store.observe('demand_velocity', { kind: product.kind }, { count: 8, exposure: 2, weight: 1 }, at);
  const parent = store.readPooled('demand_velocity', { kind: product.kind });
  assert.ok('mean' in parent);
  onSoldComp(store, product, at);
  onExposure(store, product, 4, at);
  store.observe('demand_velocity', { kind: product.kind }, { count: 8, exposure: 0, weight: 1 }, at);
  const baseline = store.readPooled('demand_velocity', { kind: product.kind });
  assert.ok('mean' in baseline);
  const row = store.rows('demand_velocity', scope).find(r => r.status === 'champion')!;
  const prior = row.prior as { shape: number; rate: number };
  const target = { shape: baseline.mean * 2 - prior.shape, rate: 2 - prior.rate };
  const evidence = { shape: parent.mean * 2 + 1 - prior.shape, rate: 6 - prior.rate };
  onExposure(store, product, 0, '2026-09-26T00:00:00Z');
  const posterior = store.read('demand_velocity', scope).value as { shape: number; rate: number };
  assert.ok(Math.abs(posterior.shape - (prior.shape + target.shape + (evidence.shape - target.shape) * .5)) < 1e-12);
  assert.ok(Math.abs(posterior.rate - (prior.rate + target.rate + (evidence.rate - target.rate) * .5)) < 1e-12);
  assert.ok(Math.abs(store.read('demand_velocity', scope).n_eff - row.n_eff * .5) < 1e-12);
});

test('reading demand at zero elapsed time leaves the event posterior and versions unchanged', () => {
  const store = memoryStore(), scope = { kind: product.kind, segment: product.product_id };
  onSoldComp(store, product, at);
  onExposure(store, product, 2, at);
  const immediate = store.read('demand_velocity', scope);
  assert.deepEqual(immediate.value, { shape: 5, rate: 4 });
  velocity(store, product, at);
  assert.deepEqual(store.read('demand_velocity', scope), immediate);
});

test('a product seed subtracts the raw inherited prior when its kind read is clamped', () => {
  const store = memoryStore(), scope = { kind: product.kind, segment: product.product_id };
  store.declare({ ...DECLARED[0], guard_hi: 2 });
  store.observe('demand_velocity', { kind: product.kind }, { count: 20, exposure: 1, weight: 1 }, at);
  onExposure(store, product, 0, at);
  assert.deepEqual(store.read('demand_velocity', scope).value, { shape: 4, rate: 2 });
  assert.deepEqual(store.rows('demand_velocity', scope)[0].prior, { shape: 24, rate: 3 });
});

const scope = { kind: product.kind, segment: product.product_id };
const later = '2026-09-26T00:00:00Z';

test('velocity reads decay and pool without changing rows, even before the latest event', () => {
  const store = memoryStore();
  onSoldComp(store, product, at);
  onExposure(store, product, 2, at);
  const rows = store.rows('demand_velocity', scope);
  const first = velocity(store, product, later);
  const raw = { shape: 4 + .5, rate: 2 + 2 * .5 }, n = 3 * .5;
  const pooledMean = (n * raw.shape / raw.rate + 20 * 2) / (n + 20);
  const expected = gammaPosterior(pooledMean * raw.rate, raw.rate);
  for (const field of ['mean', 'p10', 'p90'] as const) assert.equal(first[field], expected[field], field);
  assert.notEqual(first.mean, raw.shape / raw.rate, 'velocity returns the kappa-pooled posterior');
  assert.deepEqual(velocity(store, product, later), first);
  assert.equal(store.rows('demand_velocity', scope).length, rows.length);
  assert.deepEqual(store.rows('demand_velocity', scope), rows);
  const old = velocity(store, product, '2026-07-01T00:00:00Z');
  const current = velocity(store, product, at);
  for (const field of ['mean', 'p10', 'p90'] as const) assert.equal(old[field], current[field]);
});

test('a future velocity read cannot change later events or their posterior', () => {
  const one = memoryStore(), two = memoryStore();
  for (const store of [one, two]) { onSoldComp(store, product, at); onExposure(store, product, 2, at); }
  const first = velocity(one, product, later);
  assert.deepEqual(velocity(two, product, later), first);
  assert.deepEqual(velocity(two, product, later), first);
  for (const store of [one, two]) onSoldComp(store, product, '2026-08-02T00:00:00Z');
  assert.deepEqual(velocity(one, product, later), velocity(two, product, later));
  assert.deepEqual(one.rows('demand_velocity', scope), two.rows('demand_velocity', scope));
});

test('listing_weeks rejects nonfinite and negative exposure before any write', () => {
  const store = memoryStore();
  onSoldComp(store, product, at);
  const before = store.rows('demand_velocity', scope);
  for (const bad of [-1, NaN, Infinity, -Infinity]) {
    assert.throws(() => onExposure(store, product, bad, later), RangeError);
    assert.deepEqual(store.rows('demand_velocity', scope), before);
  }
});
