// node --test src/buy/stage.test.ts: what the want screen reads from the stage watcher (product/live-buy-demo.md).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { afterListing, parseStage, SAMPLE, type StageAlert } from './stage.ts';

const row: StageAlert = { id: '6551f0a1b2c3d4e5f6a7b8cb', site: 'poshmark', url: 'https://poshmark.com/listing/x', title: 'Carhartt Detroit jacket', price_cents: 1800, cap_cents: 2500, image: null, listed_at: 1000, found_at: 42000 };

test('parseStage keeps well-formed alerts, newest first', () => {
  const later = { ...row, id: 'b', found_at: 99000 };
  assert.deepEqual(parseStage({ alerts: [row, later] }).alerts.map(a => a.id), ['b', row.id]);
});

test('parseStage drops what it cannot show: a site we have no badge for, fractional cents, no url', () => {
  const bad = [{ ...row, site: 'grailed' }, { ...row, price_cents: 18.5 }, { ...row, url: '' }, null, 'x'];
  assert.deepEqual(parseStage({ alerts: bad }).alerts, []);
  assert.deepEqual(parseStage(null).alerts, []);
  assert.deepEqual(parseStage({}).alerts, []);
});

test('afterListing says how long after it was listed it was found, and nothing when the site gives no time', () => {
  assert.equal(afterListing(row), '41s after listing');
  assert.equal(afterListing({ ...row, found_at: 3 * 60_000 + 1000 }), '3m after listing');
  assert.equal(afterListing({ ...row, listed_at: null }), undefined);
  assert.equal(afterListing({ ...row, found_at: 0 }), '0s after listing');
});

test('the sample is marked as one, so it can never pass for a real find', () => {
  assert.ok(SAMPLE.every(a => a.id.startsWith('sample_')));
});
