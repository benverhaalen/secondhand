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
  velocity(store, product, '2026-09-26T00:00:00Z');
  const raw = store.read('demand_velocity', { kind: 'apparel', segment: 'p1' }).value;
  assert.deepEqual(raw, { shape: 4.5, rate: 2 });
  const history = store.rows('demand_velocity', { kind: 'apparel', segment: 'p1' }).length;
  velocity(store, product, '2026-09-26T00:00:00Z');
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
