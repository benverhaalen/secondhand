// negotiation.md §3: hard limits in code first, then candidates, then the choice. Amounts are integer cents.
// The model (pAccept) only scores candidates; it never adds one, and no amount leaves [floor, ask].
import { endings, roundToEnding, type EndingRule } from '../money/ending.ts';

export type OfferState = {
  site: string;
  offer_cents: number;
  ask_cents: number; // current price
  floor_cents: number;
  always_accept_cents: number;
  accept_line_cents?: number; // posture: accepting below this line requires approval
  keep: (price_cents: number) => number;
  v_wait_cents: number | null; // null when D10 is hidden
  trust_block: boolean;
  ending?: EndingRule;
  features?: Record<string, number | boolean>;
  ask_all?: boolean; // plan_choice check: every answer is a proposal the person decides
  counter_under_floor?: boolean; // posture stance: false at the hard end, the ask proposes no counter
};
export type PAccept = (counter_cents: number, s: OfferState) => number;
export type Candidate = { amount_cents: number; keep: number; p_accept: number; expected_keep: number };
export type Decision = {
  kind: 'accept_offer' | 'counter_offer' | 'decline_offer' | 'wait' | 'price_below_floor' | 'trust_block';
  amount_cents: number | null;
  keep_at_amount: number | null;
  p_accept: number | null;
  expected_keep: number | null;
  v_after: number | null;
  candidates: Candidate[];
  policy: 'champion' | 'challenger';
  param_version: number;
  ask: boolean; // a proposal the person decides: price_below_floor always, and a counter when V is hidden
  fallback?: 'p_accept_invalid'; // the challenger's model failed; the champion decided
};

// The final guard: no amount below the floor or above the ask; none at all when floor > ask.
export function guard(amount: number | null, s: OfferState): number | null {
  if (amount === null || !Number.isFinite(amount) || s.floor_cents > s.ask_cents) return null;
  return Math.min(s.ask_cents, Math.max(s.floor_cents, amount));
}

// Counters lie strictly between max(floor, offer) and the ask: eBay takes a counter only above the offer and
// under Buy It Now, and a counter at the ask is no counter.
const counterRange = (s: OfferState) => ({ lo: Math.max(s.floor_cents, s.offer_cents + 1), hi: s.ask_cents - 1 });

// D16 rule 2, the champion: the split, on an ending inside the counter range.
export function midpoint(s: OfferState): number | null {
  const { lo, hi } = counterRange(s);
  if (lo > hi) return null;
  return roundToEnding(Math.max(lo, (s.offer_cents + s.ask_cents) / 2), s.ending, lo, hi);
}

const clampP = (p: number) => Math.min(0.98, Math.max(0.02, p));

export class LimitBreach extends Error {}

// The protection, checked on the decision itself before it leaves: nothing accepted under the floor, no counter
// or proposal outside the counter range. A breach is a bug upstream, so it throws rather than sending.
export function assertLimits(d: Decision, s: OfferState): Decision {
  const { lo, hi } = counterRange(s);
  if (d.kind === 'accept_offer' && (s.offer_cents < s.floor_cents || d.amount_cents !== s.offer_cents)) throw new LimitBreach(`accept of ${s.offer_cents} under floor ${s.floor_cents}`);
  if ((d.kind === 'counter_offer' || d.kind === 'price_below_floor') && d.amount_cents !== null && (d.amount_cents < lo || d.amount_cents > hi)) throw new LimitBreach(`counter ${d.amount_cents} outside [${lo}, ${hi}]`);
  if (d.kind === 'price_below_floor' && !d.ask) throw new LimitBreach('price_below_floor must ask');
  return d;
}

// The floor is the person's protection, so an offer state with no usable floor is refused before anything is decided:
// a comparison with NaN or undefined is false, which once let an accept through with no floor at all.
export function assertState(s: OfferState): void {
  for (const k of ['floor_cents', 'offer_cents', 'ask_cents'] as const)
    if (!Number.isSafeInteger(s[k]) || s[k] < 0) throw new LimitBreach(`${k} must be a whole number of cents, zero or more`);
}

export function decide(s: OfferState, pAccept: PAccept, policy: 'champion' | 'challenger' = 'champion', param_version = 0): Decision {
  assertState(s);
  const v = s.v_wait_cents;
  const base = { policy, param_version, v_after: v };
  if (s.trust_block) return { ...base, kind: 'trust_block', amount_cents: null, keep_at_amount: null, p_accept: null, expected_keep: null, candidates: [], ask: false };

  // The floor and always_accept are prices the person set; compare prices, since keep can fall at a fee step.
  const below = s.offer_cents < s.floor_cents;
  const always = Math.max(s.always_accept_cents, s.floor_cents);
  const keepOffer = Math.round(s.keep(s.offer_cents));
  const underLine = s.accept_line_cents !== undefined && s.offer_cents < s.accept_line_cents;
  const acceptRow: Candidate = { amount_cents: s.offer_cents, keep: keepOffer, p_accept: 1, expected_keep: keepOffer };
  const accept = (candidates: Candidate[], ask = false, fallback?: Decision['fallback']): Decision =>
    assertLimits({ ...base, kind: 'accept_offer', amount_cents: s.offer_cents, keep_at_amount: keepOffer, p_accept: 1, expected_keep: keepOffer, candidates, ask: ask || underLine || !!s.ask_all, ...(fallback && { fallback }) }, s);
  if (!below && s.offer_cents >= always) return accept([acceptRow]);

  const { lo, hi } = counterRange(s);
  const vAfter = v ?? 0;
  let invalid = false;
  const cands: Candidate[] = (lo <= hi ? endings(lo, hi, s.ending) : []).map((c) => {
    let p = NaN;
    try { p = pAccept(c, s); } catch { invalid = true; }
    if (!Number.isFinite(p)) invalid = true;
    p = clampP(p);
    return { amount_cents: c, keep: Math.round(s.keep(c)), p_accept: p, expected_keep: p * s.keep(c) + (1 - p) * vAfter };
  });
  const fallback = invalid ? 'p_accept_invalid' as const : undefined;
  const listed = invalid ? [] : cands;
  const full = below ? listed : [acceptRow, ...listed];

  let pick: Candidate | undefined; // undefined = accept, or no counter at all
  if (policy === 'challenger' && !invalid && v !== null) {
    let best = below || underLine ? -Infinity : keepOffer;
    for (const c of cands) if (c.expected_keep > best) { best = c.expected_keep; pick = c; }
  } else {
    const m = midpoint(s);
    pick = m === null ? undefined : (cands.find((c) => c.amount_cents === m) ?? { amount_cents: m, keep: Math.round(s.keep(m)), p_accept: NaN, expected_keep: NaN });
  }
  const counter = (kind: 'counter_offer' | 'price_below_floor', c: Candidate | undefined, ask: boolean): Decision => assertLimits({
    ...base, kind, amount_cents: c?.amount_cents ?? null, keep_at_amount: c ? c.keep : null,
    p_accept: c && !Number.isNaN(c.p_accept) ? c.p_accept : null, expected_keep: c && !Number.isNaN(c.expected_keep) ? c.expected_keep : null,
    candidates: full, ask, ...(fallback && { fallback }),
  }, s);

  // D16 rule 3: under the floor it always asks, proposing the counter rule 2 would send.
  if (below) return counter('price_below_floor', s.counter_under_floor === false ? undefined : pick, true);
  // D16 rule 2: in the band, accept when the offer already keeps at least what waiting does.
  if (policy === 'champion' && !underLine && v !== null && keepOffer >= v) return accept(full, false, fallback);
  // No ending between the offer and the ask: the gap is under one ending, so taking the offer is the counter.
  if (!pick) return accept(full, v === null, fallback);
  // V hidden: only rules 1 and 3 run, so a counter in the band is a proposal.
  return counter('counter_offer', pick, v === null || !!s.ask_all);
}
