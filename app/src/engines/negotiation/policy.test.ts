import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offer, opener, switchPolicy, rollbackPolicy, offerFromRegistry } from './policy.ts';
import { memoryStore } from '../param/param.ts';
import type { OfferState } from './choose.ts';
const state = (): OfferState => ({ site: 'ebay', offer_cents: 6200, ask_cents: 8000, floor_cents: 6000, always_accept_cents: 7200, keep: p => Math.round(.864 * p - 940), v_wait_cents: 5000, trust_block: false });
test('a $5 eBay offer with negative keep asks below the $60 floor at every posture', () => {
  const s = { ...state(), offer_cents: 500 };
  assert.equal(s.keep(s.offer_cents), -508);
  for (const posture of [0, .15, .5, .85, 1]) for (const policy of ['champion', 'challenger'] as const) {
    const d = offer(s, () => .5, posture, policy);
    assert.equal(d.kind, 'price_below_floor');
    assert.equal(d.ask, true);
  }
});
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
  assert.ok(d, 'an affordable candidate with positive surplus produces an opener');
  assert.equal(d.amount_cents, 6800); assert.equal(d.kind, 'buy_offer'); assert.equal(d.ask, true);
  assert.equal(d.binding, true);
});
test('opener refuses invalid probabilities and has no offer when all exceed ceiling', () => {
  assert.throws(() => opener('ebay', 8000, [6800], () => NaN), /probability/);
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

test('an offer state with no usable floor is refused, never accepted (review finding F1, 2026-11-15)', () => {
  const p = () => 0.5;
  for (const floor_cents of [NaN, undefined, -5000, 60.5, Infinity]) {
    const state = { offer_cents: 100, ask_cents: 8000, floor_cents, always_accept_cents: 7200 } as unknown as Parameters<typeof offer>[0];
    assert.throws(() => offer(state, p, 0.5), /floor_cents must be a whole number/, String(floor_cents));
  }
});

test('F2: neither policy auto accepts below the firm accept line when waiting is cheap', () => {
  for (const policy of ['champion', 'challenger'] as const) {
    for (const p of [.02, .98]) {
      const d = offer({ ...state(), v_wait_cents: 3000 }, () => p, 1, policy);
      assert.ok(d.kind !== 'accept_offer' || d.ask, `${policy} bypassed the posture`);
    }
    const d = offer({ ...state(), offer_cents: 7999, always_accept_cents: 8000 }, () => .02, 1, policy);
    assert.equal(d.ask, true, 'no counter space still requires approval under the accept line');
  }
});
test('F8: posture thresholds and keeps leave the policy in whole cents', () => {
  const x = { ...state(), floor_cents: 0, offer_cents: 100, always_accept_cents: 7211, keep: (p: number) => Math.round(.864 * p - 940) };
  const thresholds: number[] = [];
  offer(x, (_p, s) => { thresholds.push(s.always_accept_cents); return .5; }, .51);
  assert.ok(thresholds.length > 0);
  assert.ok(thresholds.every(Number.isInteger), 'the interpolated posture accept line is whole cents');
  for (const policy of ['champion', 'challenger'] as const) {
    const d = offer(x, () => .02, 1, policy);
    assert.ok(d.keep_at_amount === null || Number.isInteger(d.keep_at_amount));
  }
});

test('audit: opener permits only ending amounts', () => {
  assert.equal(opener('ebay', 8000, [7000], () => .5), null);
});

test('audit: scoped values are required and affect the acceptance probability clamp', async () => {
  const { resolve } = await import('./params.ts');
  const params = resolve();
  params.values.negotiation_p_lo = .4;
  params.values.negotiation_p_hi = .6;
  const d = offer(state(), () => .01, .5, 'challenger', 0, params);
  assert.ok(d.candidates.filter(c => c.amount_cents !== 6200).every(c => c.p_accept === .4));
  const broken = structuredClone(params); delete (broken.values as Partial<typeof broken.values>).negotiation_p_lo;
  assert.throws(() => offer(state(), () => .5, .5, 'champion', 0, broken), /negotiation_p_lo/);
});
test('audit: D17 ceiling applies probabilities and deductions and hides failed gates', async () => {
  const { maxPay, buyingOffer } = await import('./policy.ts');
  const x = { qualified: true, valuation_shown: true, p_identity: .9, p_condition: .8, p_authentic: 1, keep_p25_cents: 10000, hassle_cents: 100, target_profit_cents: 500 };
  assert.equal(maxPay(x), 6300);
  assert.equal(maxPay({ ...x, p_authentic: .6 }), null);
  assert.equal(maxPay({ ...x, qualified: false }), null);
  assert.equal(buyingOffer('ebay', x, [5800, 6800], () => .5)?.amount_cents, 5800);
});

test('twins: paired bootstrap uses shared draws and half-up integer cents', async () => {
  const { readFileSync } = await import('node:fs');
  const { compare } = await import('./policy.ts');
  const f = JSON.parse(readFileSync(new URL('./twins.json', import.meta.url), 'utf8')) as { bootstrap: { champion: number[]; challenger: number[]; draws: number[][]; expected: { mean_gain: number; lower_95: number; n: number } }[] };
  for (const c of f.bootstrap) {
    const samples = c.draws.flat(); let i = 0;
    const { resolve } = await import('./params.ts'); const params = resolve(); params.values.negotiation_bootstrap_n = c.draws.length;
    assert.deepEqual(compare(c.champion, c.challenger, () => samples[i++], params), c.expected);
  }
});

test('audit: posture selects continuation and declining against permitted counters', () => {
  const d = offer({ ...state(), v_wait_cents: 6000, keep: c => c > 6200 && c < 7000 ? 10000 : 1000 }, c => c < 7000 ? .98 : .02, 1, 'challenger');
  assert.equal(d.kind, 'decline_offer');
  const a = offer(state(), () => .5, .5, 'challenger');
  const b = offer({ ...state(), ending: { above_cents: 2000, digits: [8, 5] } }, () => .5, .5, 'challenger');
  assert.equal(a.amount_cents, b.amount_cents);
});

test('posture: the champion counter follows counter share and round concessions', () => {
  const s = { ...state(), offer_cents: 1000, ask_cents: 10000, floor_cents: 100, always_accept_cents: 10000, keep: (p: number) => p, v_wait_cents: 10000 };
  assert.equal(offer(s, () => .5, .2).amount_cents, 2800);
  assert.equal(offer({ ...s, features: { round: 1 } }, () => .5, .2).amount_cents, 1400);
});

test('registry: scoped ending and scalar versions reach the decision citation', () => {
  const store = memoryStore(), scope = { site: 'ebay', segment: 'jacket' };
  offerFromRegistry(state(), () => .5, .5, store, scope);
  for (const [name, value, family] of [['negotiation_p_lo', .4, 'scalar'], ['money_ending', { above_cents: 2000, digits: [3, 9] }, 'model_ref']] as const) {
    const row = store.propose({ name, scope, family, value_or_hyperparams: value, prior: store.read(name, scope).value, fitted_on_ids_hash: null, n_eff: 100, metric: 'held_out', held_out_score: 1, guard_lo: null, guard_hi: null }, 0);
    store.promote(name, scope, row.version, 0, '2026-11-15');
  }
  const proof = { now: '2026-11-15T00:00:00Z', code_version: 'test', rows: Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, source: 'offer_outcome', at: '2026-11-14T00:00:00Z' })) };
  const d = offerFromRegistry({ ...state(), proof }, () => .1, .5, store, scope);
  assert.ok(d.candidates.filter(c => c.amount_cents !== 6200).every(c => [6300, 6900, 7300, 7900].includes(c.amount_cents) && c.p_accept === .4));
  const a = d.proof.expected_keep.answer;
  assert.ok(a.ok); if (a.ok) { assert.equal(a.citation.param_versions.money_ending, 1); assert.equal(a.citation.param_versions.negotiation_p_lo, 1); }
});
