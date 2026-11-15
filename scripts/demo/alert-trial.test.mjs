import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cards, judge, titleFromSlug, summarize } from './alert-trial.mjs';

const want = JSON.parse(readFileSync(new URL('./wants/brewers-jersey.json', import.meta.url), 'utf8'));
const A = '6551f0a1b2c3d4e5f6a7b8c9', B = '6551f0a1b2c3d4e5f6a7b8ca';
const card = (slug, id, price, size) => `<div class="card"><a href="/listing/${slug}-${id}">x</a><a href="/listing/${slug}-${id}">${slug.replace(/-/g, ' ')}</a><span>$${price}</span><a>Size: ${size}</a></div>`;

test('titleFromSlug: a Poshmark URL carries its title', () => {
  assert.equal(titleFromSlug(`https://poshmark.com/listing/Majestic-Milwaukee-Brewers-Jersey-${A}`), 'Majestic Milwaukee Brewers Jersey');
});

test('cards: one row per listing, in page order, with price and size from the card', () => {
  const rows = cards(`<html>${card('Brewers-Jersey', A, 45, 'L')}${card('Brewers-Tee', B, 12, 'XL')}</html>`);
  assert.deepEqual(rows.map(r => [r.site_id, r.position, r.price, r.size]), [[A, 1, 45, 'L'], [B, 2, 12, 'XL']]);
});

test("judge: fits only a men's Brewers jersey in L or XL at or under the price", () => {
  const row = (title, price, size) => ({ title, price, size });
  assert.equal(judge(want, row('Majestic Milwaukee Brewers Jersey', 45, 'L')).fits, true);
  assert.deepEqual(judge(want, row('Brewers Jersey', 45, 'Youth L')).reasons, ['cut or kind: \\byouth\\b', 'size Youth L']);
  assert.deepEqual(judge(want, row('Brewers T-shirt', 15, 'L')).reasons, ['not a jersey', 'cut or kind: \\bt-?shirt\\b']);
  assert.deepEqual(judge(want, row('Brewers Jersey', 85, 'XL')).reasons, ['$85 over $60']);
  assert.deepEqual(judge(want, row('Brewers Jersey', 45, 'M')).reasons, ['size M']);
  assert.deepEqual(judge(want, row('Brewers Jersey', 45, null)).reasons, ['size not stated']);
  // the listing's own page wins over the card: a sold one never fits
  assert.equal(judge(want, row('Brewers Jersey', 45, 'L'), { jsonld_price: 45, available: false, size: 'L' }).fits, false);
});

test('summarize: a listing made in the window that we never saw is a miss', () => {
  const start = 1_700_000_000_000, end = start + 3_600_000;
  const S = { brewers: { name: 'brewers', reads: 10, fails: 0, seen: new Map([[A, { site_id: A, seed: false, listed_at: start + 1000, first_seen: start + 31_000, prev_read: start + 21_000 }]]) } };
  const truth = [{ q: 'brewers', site_id: A, listed_at: start + 1000 }, { q: 'brewers', site_id: B, listed_at: start + 2000 }];
  const s = summarize({ S, truth, start, end, want: { ...want, search: 'brewers' } }).per.brewers;
  assert.equal(s.truth_listed_in_window, 2);
  assert.equal(s.missed, 1);
  assert.equal(s.seconds_listed_to_seen.p50, 30);
  assert.equal(s.seconds_listed_to_previous_read.p50, 20);
});
