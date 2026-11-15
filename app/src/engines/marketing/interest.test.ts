import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from '../param/param.ts';
import { onStats, interest } from './interest.ts';

const at = '2026-08-01T00:00:00Z', listing = { kind: 'apparel', site: 'ebay', listing_id: 'li_1' };

test('read_stats adds views to shape and hours to rate on only this listing', () => {
  const store = memoryStore();
  interest(store, listing, at);
  onStats(store, listing, 100, 10, at);
  assert.deepEqual(store.read('view_rate', { kind: 'apparel', site: 'ebay', segment: 'li_1' }).value, { shape: 101, rate: 11 });
  assert.equal(interest(store, { ...listing, listing_id: 'li_other' }, at).standing, 'on_plan');
});

test('pooled parent band is independent of the listing; low and high counts cross both edges', () => {
  const store = memoryStore(), band = { kind: listing.kind, site: listing.site };
  onStats(store, band, 2400, 240, at);
  const before = interest(store, listing, at);
  assert.equal(before.standing, 'on_plan');
  onStats(store, listing, 0, 72, at);
  const low = interest(store, listing, at);
  assert.equal(low.standing, 'behind');
  assert.deepEqual(low.band, before.band);
  onStats(store, listing, 20000, 24, at);
  assert.equal(interest(store, listing, at).standing, 'ahead');
});

test('invalid stats and dates refuse before update; zero exposure with positive views is refused', () => {
  const store = memoryStore();
  for (const views of [-1, .5, NaN, Infinity]) assert.throws(() => onStats(store, listing, views, 24, at), /views/);
  for (const hours of [-1, NaN, Infinity]) assert.throws(() => onStats(store, listing, 1, hours, at), /hours/);
  assert.throws(() => onStats(store, listing, 1, 0, at), /hours/);
  assert.throws(() => interest(store, listing, 'bad'), /as_of/);
  onStats(store, listing, 0, 24, at);
  assert.throws(() => onStats(store, listing, 1, 1, '2026-07-01T00:00:00Z'), /out.of.order/);
});

test('zero-view exposure is evidence, a zero-zero poll is not, and quiet reads forget once', () => {
  const store = memoryStore();
  const before = interest(store, listing, at);
  onStats(store, listing, 0, 0, at);
  assert.deepEqual(interest(store, listing, at), before);
  onStats(store, listing, 0, 72, at);
  assert.ok(interest(store, listing, at).mean < before.mean);
  const later = interest(store, listing, '2026-08-31T00:00:00Z');
  assert.deepEqual(interest(store, listing, '2026-08-31T00:00:00Z'), later);
});

test('a fresh listing seeds its kind mean at prior rate with the inherited prior counted once', () => {
  const store = memoryStore(), scope = { kind: listing.kind, site: listing.site, segment: listing.listing_id };
  onStats(store, { kind: listing.kind }, 20, 2, at);
  const parent = store.readPooled('view_rate', { kind: listing.kind, site: listing.site });
  assert.ok('mean' in parent);
  const inherited = store.read('view_rate', scope).value;
  onStats(store, listing, 0, 1, at);
  const seed = store.rows('view_rate', scope)[0];
  const gamma = seed.value_or_hyperparams as { shape: number; rate: number };
  assert.ok(Math.abs(gamma.shape - parent.mean) < 1e-12);
  assert.equal(gamma.rate, 1);
  assert.deepEqual(seed.prior, inherited);
  assert.equal(seed.n_eff, 0);
  const posterior = store.read('view_rate', scope).value as { shape: number; rate: number };
  assert.ok(Math.abs(posterior.shape - parent.mean) < 1e-12);
  assert.equal(posterior.rate, 2);
});

test('idle interest decays signed evidence for thirty days and restores the row prior once', () => {
  const store = memoryStore(), scope = { kind: listing.kind, site: listing.site, segment: listing.listing_id };
  onStats(store, { kind: listing.kind }, 20, 2, at);
  const parent = store.readPooled('view_rate', { kind: listing.kind, site: listing.site });
  assert.ok('mean' in parent);
  onStats(store, listing, 0, 1, at);
  const row = store.rows('view_rate', scope).find(r => r.status === 'champion')!;
  const prior = row.prior as { shape: number; rate: number };
  interest(store, listing, '2026-08-31T00:00:00Z');
  const posterior = store.read('view_rate', scope).value as { shape: number; rate: number };
  assert.ok(Math.abs(posterior.shape - (prior.shape + (parent.mean - prior.shape) * .5)) < 1e-12);
  assert.equal(posterior.rate, prior.rate + (2 - prior.rate) * .5);
  assert.equal(store.read('view_rate', scope).n_eff, row.n_eff * .5);
});

test('reading interest at zero elapsed time leaves the event posterior and versions unchanged', () => {
  const store = memoryStore(), scope = { kind: listing.kind, site: listing.site, segment: listing.listing_id };
  onStats(store, listing, 20, 2, at);
  onStats(store, listing, 0, 1, at);
  const immediate = store.read('view_rate', scope);
  assert.deepEqual(immediate.value, { shape: 21, rate: 4 });
  interest(store, listing, at);
  assert.deepEqual(store.read('view_rate', scope), immediate);
});

test('idle interest accepts zero view-count evidence and preserves the declared prior', () => {
  const store = memoryStore();
  onStats(store, listing, 0, 2, at);
  interest(store, listing, '2026-08-31T00:00:00Z');
  assert.deepEqual(store.read('view_rate', { kind: listing.kind, site: listing.site, segment: listing.listing_id }).value,
    { shape: 1, rate: 2 });
});

test('a listing seed subtracts the raw inherited prior when its kind read is clamped', () => {
  const store = memoryStore(), scope = { kind: listing.kind, site: listing.site, segment: listing.listing_id };
  interest(store, listing, at);
  store.declare({ name: 'view_rate', family: 'gamma', prior: { shape: 1, rate: 1 }, guard_hi: 1 });
  store.observe('view_rate', { kind: listing.kind }, { count: 20, exposure: 2, weight: 1 }, at);
  onStats(store, listing, 0, 1, at);
  assert.deepEqual(store.read('view_rate', scope).value, { shape: 1, rate: 2 });
  assert.deepEqual(store.rows('view_rate', scope)[0].prior, { shape: 21, rate: 3 });
});
