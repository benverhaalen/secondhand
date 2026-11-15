import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offer, opener, switchPolicy, rollbackPolicy, offerFromRegistry } from './policy.ts';
import { memoryStore } from '../param/param.ts';
import type { OfferState } from './choose.ts';
const state = (): OfferState => ({ site: 'ebay', offer_cents: 6200, ask_cents: 8000, floor_cents: 6000, always_accept_cents: 7200, keep: p => .864 * p - 940, v_wait_cents: 5000, trust_block: false });
test('quick posture accepts faster while firm posture counters high', () => {
  assert.equal(offer(state(), () => .5, 0).kind, 'accept_offer');
  const hard = offer(state(), () => .5, 1);
  assert.equal(hard.kind, 'counter_offer'); assert.ok(hard.amount_cents! >= 7500);
});
test('planted auto accept under the floor never accepts, and firm posture proposes no counter', () => {
  const s = { ...state(), offer_cents: 100, always_accept_cents: 1 };
  for (const t of [0, .15, .5, .85, 1]) {
    const d = offer(s, () => .98, t, 'challenger');
    assert.equal(d.kind, 'price_below_floor'); assert.equal(d.ask, true);
    assert.ok(d.amount_cents === null || d.amount_cents >= s.floor_cents);
  }
  assert.equal(offer(s, () => .5, 1).amount_cents, null);
});
test('buying opener chooses expected surplus under max_pay and always asks', () => {
  const d = opener('ebay', 8000, [5000, 6800, 7500, 9000], p => p === 6800 ? .8 : .1);
  assert.equal(d.amount_cents, 6800); assert.equal(d.kind, 'buy_offer'); assert.equal(d.ask, true);
  assert.equal(d.binding, true);
});
test('opener refuses invalid probabilities and has no offer when all exceed ceiling', () => {
  assert.throws(() => opener('ebay', 8000, [7000], () => NaN), /probability/);
  assert.equal(opener('ebay', 8000, [9000], () => .5), null);
});
test('challenger needs matched offers, positive bootstrap lower bound, and calibration', () => {
  const store = memoryStore();
  const rows = Array.from({ length: 50 }, (_, i) => ({ match: `round1:gap2:${i}`, champion_keep: 4000, challenger_keep: 4100 }));
  const x = { store, scope: { site: 'ebay', segment: 'jacket' }, matched: rows, calibration_error: .04, at: '2026-11-15', random: () => .5 };
  assert.equal(switchPolicy({ ...x, calibration_error: .06 }).promoted, false);
  assert.equal(switchPolicy({ ...x, matched: rows.slice(0, 49) }).promoted, false);
  assert.equal(switchPolicy({ ...x, matched: rows.map(r => ({ ...r, challenger_keep: 3900 })) }).promoted, false);
  assert.equal(switchPolicy(x).promoted, true);
  assert.equal(store.read('negotiation_policy', x.scope).value, 'challenger');
  assert.equal(offerFromRegistry(state(), () => .5, .5, store, x.scope).policy, 'challenger');
  assert.equal(rollbackPolicy(store, x.scope, { mean: 3800, champion_mean: 4000, se: 50, days: 6 }, x.at), false);
  assert.equal(rollbackPolicy(store, x.scope, { mean: 3800, champion_mean: 4000, se: 50, days: 7 }, x.at), true);
  assert.equal(store.read('negotiation_policy', x.scope).value, 'champion');
});
test('challenger reads firm posture even when low counters score better', () => {
  const s = state();
  s.v_wait_cents = 3000;
  const d = offer(s, c => c < 7000 ? .98 : .02, 1, 'challenger');
  assert.equal(d.kind, 'counter_offer'); assert.ok(d.amount_cents! >= 7500);
});
