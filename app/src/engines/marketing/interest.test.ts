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
