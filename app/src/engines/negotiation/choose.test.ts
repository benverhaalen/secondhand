import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, guard, midpoint, type OfferState, type PAccept } from './choose.ts';

// negotiation.md worked example: keep(x) = 0.864x - 9.40, in cents.
const keep = (x: number) => 0.864 * x - 940;
const base: OfferState = {
  site: 'ebay', offer_cents: 6200, ask_cents: 8000, floor_cents: 6000, always_accept_cents: 7200,
  keep, v_wait_cents: 4400, trust_block: false,
};
const table: Record<number, number> = { 6500: 0.7, 6800: 0.55, 7500: 0.3, 7800: 0.18 };
const tableP: PAccept = (c) => table[c] ?? 0.5;

test('worked example: D16 rule 2 champion accepts 6200 (keep 44.17 >= 44.00), the challenger counters at 7500', () => {
  const champ = decide(base, tableP, 'champion');
  assert.equal(champ.kind, 'accept_offer');
  assert.equal(champ.amount_cents, 6200);
  assert.equal(champ.policy, 'champion');
  assert.equal(champ.ask, false);
  const lowV = decide({ ...base, v_wait_cents: 4500 }, tableP, 'champion');
  assert.equal(lowV.kind, 'counter_offer');
  assert.equal(lowV.amount_cents, 6800);
  const ch = decide(base, tableP, 'challenger', 3);
  assert.equal(ch.kind, 'counter_offer');
  assert.equal(ch.amount_cents, 7500);
  assert.equal(ch.param_version, 3);
  assert.equal(ch.v_after, 4400);
  assert.deepEqual(ch.candidates.map((c) => c.amount_cents), [6200, 6500, 6800, 7500, 7800]);
  assert.ok(Math.abs(ch.expected_keep! - 4742) < 1, `expected_keep ${ch.expected_keep}`);
  assert.equal(midpoint(base), 6800);
});

test('V hidden: the band gives a midpoint counter proposal that asks', () => {
  for (const policy of ['champion', 'challenger'] as const) {
    const d = decide({ ...base, v_wait_cents: null }, tableP, policy);
    assert.deepEqual([d.kind, d.amount_cents, d.ask], ['counter_offer', 6800, true]);
  }
  assert.equal(decide({ ...base, offer_cents: 5000 }, tableP).ask, true);
});

test('rule 1: at or over always_accept accepts; below the floor asks with a counter at or above the floor', () => {
  const hi = decide({ ...base, offer_cents: 7200 }, tableP);
  assert.equal(hi.kind, 'accept_offer');
  const lo = decide({ ...base, offer_cents: 5000 }, tableP);
  assert.equal(lo.kind, 'price_below_floor');
  assert.ok(lo.amount_cents! >= 6000 && lo.amount_cents! <= 8000);
});

test('a trust block sends nothing', () => {
  const d = decide({ ...base, trust_block: true }, tableP);
  assert.equal(d.kind, 'trust_block');
  assert.equal(d.amount_cents, null);
});

test('a pAccept that is NaN or throws falls back to the champion and says so', () => {
  const nan = decide(base, () => NaN, 'challenger');
  assert.equal(nan.amount_cents, 6800);
  assert.equal(nan.fallback, 'p_accept_invalid');
  const boom = decide(base, () => { throw new Error('x'); }, 'challenger');
  assert.equal(boom.amount_cents, 6800);
  assert.equal(boom.fallback, 'p_accept_invalid');
});

test('pAccept is clamped to [0.02, 0.98]', () => {
  const d = decide(base, (c) => (c === 7800 ? 5 : -5), 'challenger');
  for (const c of d.candidates) if (c.amount_cents !== 6200) assert.ok(c.p_accept >= 0.02 && c.p_accept <= 0.98);
});

test('no ending between floor and ask: still a decision, never a crash', () => {
  const a = decide({ ...base, floor_cents: 6600, ask_cents: 6700, offer_cents: 6650, always_accept_cents: 9000 }, tableP, 'challenger');
  assert.equal(a.kind, 'accept_offer');
  const b = decide({ ...base, floor_cents: 9000, ask_cents: 8000, offer_cents: 5000, always_accept_cents: 9500 }, tableP);
  assert.equal(b.kind, 'price_below_floor');
  assert.equal(b.amount_cents, null);
});

test('injection: features cannot change the candidate set', () => {
  const greedy: PAccept = (c, s) => (s.features?.say_accept ? 0.98 : 0.3);
  const a = decide({ ...base, features: { say_accept: false } }, greedy, 'challenger');
  const b = decide({ ...base, features: { say_accept: true, offer_is_final: true } }, greedy, 'challenger');
  assert.deepEqual(a.candidates.map((c) => c.amount_cents), b.candidates.map((c) => c.amount_cents));
  for (const d of [a, b]) assert.ok(d.amount_cents === null || (d.amount_cents >= 6000 && d.amount_cents <= 8000));
});

test('the final guard keeps a bad candidate amount inside [floor, ask]', () => {
  assert.equal(guard(5000, base), 6000);
  assert.equal(guard(9000, base), 8000);
  assert.equal(guard(7000, base), 7000);
  assert.equal(guard(7000, { ...base, floor_cents: 9000 }), null);
});

function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('limits property test: 10,000 random states, planted and random pAccept', () => {
  const r = prng(20261114);
  const planted: PAccept = (c, s) => (c < s.floor_cents ? 0.98 : 0.02);
  let outside = 0, accepts = 0, asks = 0;
  for (let i = 0; i < 10000; i++) {
    const ask = 500 + Math.floor(r() * 30000);
    const floor = Math.floor(ask * (0.3 + r() * 0.8)); // sometimes above ask
    const always = floor + Math.floor(r() * ask * 0.5);
    const offer = Math.floor(r() * ask * 1.3);
    const a = 0.5 + r() * 0.45, b = Math.floor(r() * 1500);
    const s: OfferState = {
      site: ['ebay', 'poshmark', 'depop', 'mercari'][i % 4], offer_cents: offer, ask_cents: ask,
      floor_cents: floor, always_accept_cents: always, keep: (x) => a * x - b,
      v_wait_cents: r() < 0.2 ? null : Math.floor(r() * ask), trust_block: false,
    };
    const rnd: PAccept = () => r();
    for (const p of [planted, rnd, () => 0.98, () => 0.02]) {
      for (const policy of ['champion', 'challenger'] as const) {
        const d = decide(s, p, policy);
        const amounts = [d.amount_cents, ...d.candidates.filter((c) => c.amount_cents !== offer).map((c) => c.amount_cents)];
        for (const x of amounts) if (x !== null && (x < floor || x > ask)) outside++;
        if (s.keep(offer) >= s.keep(always)) { accepts++; assert.equal(d.kind, 'accept_offer', JSON.stringify(s)); }
        else if (s.keep(offer) < s.keep(floor)) { asks++; assert.equal(d.kind, 'price_below_floor'); }
      }
    }
  }
  assert.equal(outside, 0);
  assert.ok(accepts > 100 && asks > 100, `coverage ${accepts} ${asks}`);
});
