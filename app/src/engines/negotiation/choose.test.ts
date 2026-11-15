import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, guard, midpoint, type OfferState, type PAccept } from './choose.ts';

// negotiation.md worked example: keep(x) = 0.864x - 9.40, in cents.
const keep = (x: number) => Math.round(0.864 * x - 940);
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

test('an invalid challenger runs the champion accept and counter rules and records the policy used', () => {
  for (const p of [() => NaN, () => -1, () => 2, () => { throw new Error('model failed'); }]) {
    for (const v_wait_cents of [4400, 4500, null]) {
      const s = { ...base, v_wait_cents };
      const champion = decide(s, tableP, 'champion');
      const fallback = decide(s, p, 'challenger');
      assert.deepEqual([fallback.kind, fallback.amount_cents, fallback.ask], [champion.kind, champion.amount_cents, champion.ask]);
      assert.equal(fallback.policy, 'champion');
      assert.equal(fallback.fallback, 'p_accept_invalid');
    }
    const below = decide({ ...base, offer_cents: 500 }, p, 'challenger');
    assert.deepEqual([below.kind, below.ask, below.policy, below.fallback], ['price_below_floor', true, 'champion', 'p_accept_invalid']);
  }
});

test('a $5 eBay offer with negative keep still asks below the $60 floor', () => {
  assert.equal(keep(500), -508);
  for (const policy of ['champion', 'challenger'] as const) {
    const d = decide({ ...base, offer_cents: 500 }, tableP, policy);
    assert.equal(d.kind, 'price_below_floor');
    assert.equal(d.ask, true);
  }
});

test('negative candidate and returning keeps remain signed whole cents through expected keep', () => {
  for (const policy of ['champion', 'challenger'] as const) {
    const d = decide({ ...base, keep: () => -1000, v_wait_cents: -2000, returning_keep: () => -3000 }, () => .5, policy);
    const c = d.candidates.find(c => c.amount_cents === 6500)!;
    assert.equal(c.keep, -1000);
    assert.equal(c.v_after, -2200);
    assert.equal(c.expected_keep, -1600);
  }
  for (const value of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1]) {
    assert.throws(() => decide({ ...base, keep: () => value }, tableP), /keep/);
  }
});

test('pAccept is clamped to [0.02, 0.98]', () => {
  const d = decide(base, (c) => (c === 7800 ? 1 : 0), 'challenger');
  assert.ok(d.candidates.length > 1);
  for (const c of d.candidates) if (c.amount_cents !== 6200) assert.ok(c.p_accept >= 0.02 && c.p_accept <= 0.98);
});

test('no ending between floor and ask: still a decision, never a crash', () => {
  const a = decide({ ...base, floor_cents: 6600, ask_cents: 6700, offer_cents: 6650, always_accept_cents: 9000 }, tableP, 'challenger');
  assert.equal(a.kind, 'accept_offer');
  assert.throws(() => decide({ ...base, floor_cents: 9000, ask_cents: 8000, offer_cents: 5000, always_accept_cents: 9500 }, tableP), /floor_cents/);
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

test('limits property test: 10,000 random states, planted pAccept, fee-step keeps, always_accept under the floor', () => {
  const r = prng(20261114);
  const planted: PAccept = (c, s) => (c < s.floor_cents ? 0.98 : 0.02);
  // eBay's fixed fee steps from $0.30 to $0.40 above $10, so keep falls by 9 cents at 935: a planted non-monotone keep.
  const stepKeep = (a: number, b: number) => (x: number) => Math.round(a * x) - (x <= 1000 ? 30 : 40) - b;
  let accepts = 0, asks = 0, counters = 0;
  for (let i = 0; i < 10000; i++) {
    const ask = 500 + Math.floor(r() * 30000);
    const floor = Math.floor(ask * (0.3 + r() * 0.8)); // sometimes above ask
    const always = i % 5 === 0 ? Math.floor(floor * r()) : floor + Math.floor(r() * ask * 0.5); // sometimes set under the floor by hand
    const offer = i % 7 === 0 ? floor - 1 : Math.floor(r() * ask * 1.3);
    const a = 0.5 + r() * 0.45, b = Math.floor(r() * 1500);
    const s: OfferState = {
      site: ['ebay', 'poshmark', 'depop', 'mercari'][i % 4], offer_cents: offer, ask_cents: ask,
      floor_cents: floor, always_accept_cents: always, keep: i % 2 ? (x) => Math.round(a * x - b) : stepKeep(a, b),
      v_wait_cents: r() < 0.2 ? null : Math.floor(r() * ask), trust_block: false,
    };
    if (floor > ask || offer <= 0) { assert.throws(() => decide(s, planted), RangeError); continue; }
    const rnd: PAccept = () => r();
    for (const p of [planted, rnd, () => 0.98, () => 0.02]) {
      for (const policy of ['champion', 'challenger'] as const) {
        const d = decide(s, p, policy);
        if (offer < floor) { asks++; assert.equal(d.kind, 'price_below_floor', JSON.stringify(s)); assert.equal(d.ask, true); }
        if (d.kind === 'accept_offer') { accepts++; assert.ok(offer >= floor, `accepted ${offer} under floor ${floor}`); assert.equal(d.amount_cents, offer); }
        if (d.kind === 'counter_offer' || d.kind === 'price_below_floor') {
          if (d.amount_cents !== null) { counters++; assert.ok(d.amount_cents >= floor && d.amount_cents > offer && d.amount_cents < ask, `counter ${d.amount_cents} offer ${offer} floor ${floor} ask ${ask}`); }
        }
        if (offer >= Math.max(floor, always)) assert.equal(d.kind, 'accept_offer');
        for (const c of d.candidates) if (c.amount_cents !== offer) assert.ok(c.amount_cents >= floor && c.amount_cents < ask);
      }
    }
  }
  assert.ok(accepts > 100 && asks > 100 && counters > 100, `coverage ${accepts} ${asks} ${counters}`);
});

test('PLANTED: always_accept set under the floor never auto-accepts an offer under the floor', () => {
  const d = decide({ ...base, floor_cents: 2000, always_accept_cents: 1000, offer_cents: 1500, ask_cents: 3000 }, () => 0.5);
  assert.equal(d.kind, 'price_below_floor');
  assert.equal(d.ask, true);
});

test('PLANTED: a fee step that makes keep fall does not let an offer under the floor through', () => {
  const ebay = (x: number) => Math.round(0.864 * x) - (x <= 1000 ? 30 : 40);
  const d = decide({ ...base, keep: ebay, floor_cents: 935, always_accept_cents: 935, offer_cents: 934, ask_cents: 1500, v_wait_cents: 700 }, () => 0.5);
  assert.equal(d.kind, 'price_below_floor');
});

test('an accept records the offer actually taken, even over the ask', () => {
  const d = decide({ ...base, offer_cents: 8500 }, () => 0.5);
  assert.equal(d.kind, 'accept_offer');
  assert.equal(d.amount_cents, 8500);
});

test('the midpoint never counters at or under the offer, nor at the ask', () => {
  for (const [offer, ask] of [[2500, 2800], [3500, 3800], [2600, 2700]]) {
    const d = decide({ ...base, floor_cents: 1000, always_accept_cents: ask, offer_cents: offer, ask_cents: ask, v_wait_cents: 99999 }, () => 0.5);
    if (d.kind === 'counter_offer') assert.ok(d.amount_cents! > offer && d.amount_cents! < ask, `${offer}/${ask} -> ${d.amount_cents}`);
    else assert.equal(d.kind, 'accept_offer');
  }
});

test('plan_choice check asks on every answer; the hard end proposes no counter under the floor', () => {
  assert.equal(decide({ ...base, offer_cents: 7500, ask_all: true }, () => 0.5).ask, true);
  assert.equal(decide({ ...base, offer_cents: 6500, v_wait_cents: 99999, ask_all: true }, () => 0.5).ask, true);
  const d = decide({ ...base, offer_cents: 5000, counter_under_floor: false }, () => 0.5);
  assert.equal(d.kind, 'price_below_floor');
  assert.equal(d.amount_cents, null);
});

test('audit: invalid states refuse before a model or keep callback runs', () => {
  for (const patch of [{ floor_cents: 9000 }, { offer_cents: 0 }, { offer_cents: -1 }, { always_accept_cents: NaN }, { v_wait_cents: Infinity }]) {
    assert.throws(() => decide({ ...base, ...patch, keep: () => { throw Error('callback ran'); } }, () => { throw Error('model ran'); }), /cents/);
  }
});
test('audit: keep callbacks must return integer cents and expected keep is rounded', () => {
  assert.throws(() => decide({ ...base, keep: () => 1.5 }, tableP), /keep/);
  const d = decide({ ...base, keep: p => p - 941 }, () => .333, 'challenger');
  for (const c of d.candidates) assert.ok(Number.isSafeInteger(c.expected_keep));
});
test('audit: guard refuses fractional money and invalid bounds', () => {
  assert.throws(() => guard(6000.5, base), /amount/);
  assert.throws(() => guard(6000, { ...base, floor_cents: NaN }), /floor_cents/);
});
test('audit: out of range probabilities use named fallback', () => {
  for (const p of [-1, 2]) assert.equal(decide(base, () => p, 'challenger').fallback, 'p_accept_invalid');
});

test('audit: returning buyer continuation changes counter expected keep', () => {
  const d = decide({ ...base, keep: p => p, q_return: () => .5, returning_keep: () => 10000 }, () => .5, 'challenger');
  const c = d.candidates.find(c => c.amount_cents === 7500)!;
  assert.equal(c.expected_keep, 7350); // .5*7500 + .5*(.5*10000+.5*4400)
});
test('audit: decline and expiry-aware wait compete with counters', () => {
  const s = { ...base, keep: () => 1000, v_wait_cents: 6000 };
  assert.equal(decide(s, () => .5, 'challenger').kind, 'decline_offer');
  const waiting = { now: '2026-11-15T00:00:00Z', expires_at: '2026-11-15T06:00:00Z', p_higher: .5, gain_cents: 2000 };
  const d = decide({ ...s, waiting }, () => .5, 'challenger');
  assert.equal(d.kind, 'wait'); assert.equal(d.expected_keep, 7000); assert.equal(d.next_check_at, '2026-11-15T04:00:00.000Z');
  assert.notEqual(decide({ ...s, waiting: { ...waiting, expires_at: waiting.now } }, () => .5, 'challenger').kind, 'wait');
});

test('audit: decision display numbers require a dated basis and parameter versions', () => {
  assert.equal(decide(base, tableP).proof.amount_cents.guarded.state, 'hidden');
  const proof = { now: '2026-11-15T00:00:00Z', code_version: 'test', rows: Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, source: 'offer_outcome', at: '2026-11-14T00:00:00Z' })) };
  const d = decide({ ...base, proof }, tableP);
  assert.equal(d.proof.amount_cents.guarded.state, 'shown');
  assert.ok(d.proof.expected_keep.answer.ok);
  if (d.proof.expected_keep.answer.ok) assert.equal(d.proof.expected_keep.answer.citation.param_versions.negotiation_p_lo, 0);
});

test('twins: hierarchical logistic and half-life share expected outputs with Python', async () => {
  const { readFileSync } = await import('node:fs');
  const { predict, halfLife } = await import('./model.ts');
  const fixture = JSON.parse(readFileSync(new URL('./twins.json', import.meta.url), 'utf8')) as { logistic: { terms: Record<string, number>; weights: number[]; row: { site: string; category: string; features: number[] }; expected: number }[]; decay: { days: number; expected: number }[] };
  for (const c of fixture.logistic) assert.ok(Math.abs(predict(c, c.row) - c.expected) < 1e-12);
  for (const c of fixture.decay) assert.ok(Math.abs(halfLife(c.days) - c.expected) < 1e-12);
});

test('money: round expected keep once after the full continuation calculation', () => {
  const d = decide({ ...base, keep: () => 1, v_wait_cents: 1, q_return: () => .5, returning_keep: () => 2 }, () => .5, 'challenger');
  assert.equal(d.candidates.find(c => c.amount_cents === 6500)?.expected_keep, 1);
});

test('audit R1: equal expected keeps choose the lowest counter, independent of ending digit order', () => {
  const s = { ...base, keep: () => 1000, v_wait_cents: 1000, accept_line_cents: 7200 };
  for (const digits of [[5, 8], [8, 5]]) assert.equal(decide({ ...s, ending: { above_cents: 2000, digits } }, () => .5, 'challenger').amount_cents, 6500);
});
