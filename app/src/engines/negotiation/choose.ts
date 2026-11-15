// negotiation.md §3: hard limits in code first, then candidates, then the choice. Amounts are integer cents.
// The model (pAccept) only scores candidates; it never adds one, and no amount leaves [floor, ask].
import { endings, roundToEnding, type EndingRule } from '../money/ending.ts';

export type OfferState = {
  site: string;
  offer_cents: number;
  ask_cents: number; // current price
  floor_cents: number;
  always_accept_cents: number;
  keep: (price_cents: number) => number;
  v_wait_cents: number | null; // null when D10 is hidden
  trust_block: boolean;
  ending?: EndingRule;
  features?: Record<string, number | boolean>;
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

// D16 rule 2, the champion.
export function midpoint(s: OfferState): number | null {
  const mid = Math.max(s.floor_cents, (s.offer_cents + s.ask_cents) / 2);
  return guard(roundToEnding(mid, s.ending, s.floor_cents, s.ask_cents), s);
}

const clampP = (p: number) => Math.min(0.98, Math.max(0.02, p));

export function decide(s: OfferState, pAccept: PAccept, policy: 'champion' | 'challenger' = 'champion', param_version = 0): Decision {
  const v_after = s.v_wait_cents;
  const out = (kind: Decision['kind'], amount: number | null, p: number | null, e: number | null, candidates: Candidate[] = [], fallback?: Decision['fallback']): Decision => {
    const amt = guard(amount, s);
    const d: Decision = { kind, amount_cents: amt, keep_at_amount: amt === null ? null : s.keep(amt), p_accept: amt === null ? null : p, expected_keep: amt === null ? null : e, v_after, candidates, policy, param_version, ask: kind === 'price_below_floor' };
    if (fallback) d.fallback = fallback;
    return d;
  };
  if (s.trust_block) return { ...out('trust_block', null, null, null), amount_cents: null };

  const keepOffer = s.keep(s.offer_cents);
  const accept = () => out('accept_offer', s.offer_cents, 1, keepOffer);
  if (keepOffer >= s.keep(s.always_accept_cents)) return accept();
  const below = keepOffer < s.keep(s.floor_cents);

  // Candidates: every ending in [floor, ask] above the offer (a counter at or under the offer is no counter).
  const lo = Math.max(s.floor_cents, s.offer_cents + 1);
  const counters = endings(lo, s.ask_cents, s.ending);
  const vAfter = v_after ?? 0;
  let invalid = false;
  const cands: Candidate[] = counters.map((c) => {
    let p = NaN;
    try { p = pAccept(c, s); } catch { /* scored below as invalid */ }
    if (!Number.isFinite(p)) invalid = true;
    p = clampP(p);
    return { amount_cents: c, keep: s.keep(c), p_accept: p, expected_keep: p * s.keep(c) + (1 - p) * vAfter };
  });
  const fallback = invalid ? 'p_accept_invalid' as const : undefined;
  const listed = invalid ? [] : cands;

  let pick: Candidate | undefined; // undefined = accept
  if (policy === 'challenger' && !invalid && v_after !== null) {
    let best = below ? -Infinity : keepOffer; // accept scores keep(offer) at P = 1; below the floor it is not offered
    for (const c of cands) if (c.expected_keep > best) { best = c.expected_keep; pick = c; }
  } else {
    const m = midpoint(s);
    pick = m === null ? undefined : (cands.find((c) => c.amount_cents === m) ?? { amount_cents: m, keep: s.keep(m), p_accept: NaN, expected_keep: NaN });
  }
  const full = below ? listed : [{ amount_cents: s.offer_cents, keep: keepOffer, p_accept: 1, expected_keep: keepOffer }, ...listed];
  // D16 rule 2: in the band, accept when the offer already keeps at least what waiting does.
  if (policy === 'champion' && !below && v_after !== null && keepOffer >= v_after) return { ...accept(), candidates: full, ...(fallback && { fallback }) };
  if (!pick) return below ? out('price_below_floor', null, null, null, full, fallback) : { ...accept(), candidates: full, ...(fallback && { fallback }) };
  const p = Number.isNaN(pick.p_accept) ? null : pick.p_accept;
  const e = Number.isNaN(pick.expected_keep) ? null : pick.expected_keep;
  const d = out(below ? 'price_below_floor' : 'counter_offer', pick.amount_cents, p, e, full, fallback);
  if (v_after === null && !below) d.ask = true; // V hidden: only rules 1 and 3 run, so the midpoint is a proposal
  return d;
}
