import { decide, assertLimits, type OfferState, type PAccept, type Decision } from './choose.ts';
import { stance } from '../valuation/posture.ts';
import { roundToEnding } from '../money/ending.ts';
import type { ParamStore, Scope } from '../param/param.ts';
import { fact } from '../../../../spec/sites.mjs';

export function offer(state: OfferState, pAccept: PAccept, posture: number, policy: Decision['policy'] = 'champion', param_version = 0): Decision {
  const s = stance(posture);
  const adjusted = { ...state,
    always_accept_cents: state.floor_cents + s.accept_line_share * (Math.max(state.floor_cents, state.always_accept_cents) - state.floor_cents),
    counter_under_floor: s.counter_under_floor_offers };
  let decision = decide(adjusted, pAccept, policy, param_version);
  if ((decision.kind === 'counter_offer' || decision.kind === 'price_below_floor') && decision.amount_cents !== null) {
    const lo = Math.max(state.floor_cents, state.offer_cents + 1), hi = state.ask_cents - 1;
    const round = typeof state.features?.round === 'number' ? Math.max(0, state.features.round) : 0;
    const share = s.counter_share * (1 - s.concede_per_round) ** round;
    const line = roundToEnding(state.offer_cents + share * (state.ask_cents - state.offer_cents), state.ending, lo, hi);
    if (line !== null) {
      const permitted = decision.candidates.filter(c => c.amount_cents > state.offer_cents && c.amount_cents >= line);
      const row = policy === 'challenger' ? permitted.sort((a, b) => b.expected_keep - a.expected_keep)[0] : permitted.find(c => c.amount_cents === line);
      const amount = row?.amount_cents ?? line;
      decision = { ...decision, amount_cents: amount, keep_at_amount: state.keep(amount), p_accept: row?.p_accept ?? null, expected_keep: row?.expected_keep ?? null };
    }
  }
  return assertLimits(decision, adjusted);
}

export function opener(site: string, max_pay: number, amounts: number[], pAccept: (amount: number) => number) {
  if (!Number.isSafeInteger(max_pay) || max_pay < 0) throw new RangeError('invalid max_pay');
  const candidates = amounts.filter(p => Number.isSafeInteger(p) && p > 0 && p <= max_pay).map(amount => {
    const p = pAccept(amount);
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('invalid probability');
    return { amount, surplus: p * (max_pay - amount) };
  }).sort((a, b) => b.surplus - a.surplus || a.amount - b.amount);
  if (!candidates.length) return null;
  return { kind: 'buy_offer' as const, amount_cents: candidates[0].amount, ask: true, binding: fact('accept.charges_buyer', site) === true };
}

export type Matched = { match: string; champion_keep: number; challenger_keep: number };
export function switchPolicy(x: { store: ParamStore; scope: Scope; matched: Matched[]; calibration_error: number; at: string; random: () => number }) {
  x.store.declare({ name: 'negotiation_policy', family: 'model_ref', prior: 'champion' });
  if (x.matched.length < 50 || !Number.isFinite(x.calibration_error) || x.calibration_error > .05) return { promoted: false, reason: 'basis or calibration' };
  if (new Set(x.matched.map(r => r.match)).size !== x.matched.length) throw new Error('duplicate matched offer');
  const gains = x.matched.map(r => r.challenger_keep - r.champion_keep);
  if (gains.some(g => !Number.isFinite(g))) throw new Error('nonfinite realised keep');
  const means = Array.from({ length: 2000 }, () => gains.reduce(sum => {
    const u = x.random();
    if (u < 0 || u >= 1 || !Number.isFinite(u)) throw new RangeError('random must be in [0,1)');
    return sum + gains[Math.floor(u * gains.length)];
  }, 0) / gains.length).sort((a, b) => a - b);
  const lb = means[Math.floor(.025 * means.length)];
  if (lb <= 0) return { promoted: false, reason: 'challenger loses' };
  const rows = x.store.rows('negotiation_policy', x.scope);
  const propose = (value: string, score: number) => x.store.propose({ name: 'negotiation_policy', scope: x.scope, family: 'model_ref', value_or_hyperparams: value, prior: 'champion', n_eff: x.matched.length, fitted_on_ids_hash: null, metric: 'keep_gain', held_out_score: score, guard_lo: null, guard_hi: null }, Math.max(0, ...x.store.rows('negotiation_policy', x.scope).map(r => r.version)));
  if (!rows.some(r => r.status === 'champion')) {
    const baseline = propose('champion', 0);
    x.store.promote('negotiation_policy', x.scope, baseline.version, 0, x.at);
  }
  const candidate = propose('challenger', lb);
  return x.store.promote('negotiation_policy', x.scope, candidate.version, 0, x.at);
}

export function rollbackPolicy(store: ParamStore, scope: Scope, live: { mean: number; champion_mean: number; se: number; days: number }, at: string): boolean {
  if (live.days < 7 || live.se < 0 || ![live.mean, live.champion_mean, live.se, live.days].every(Number.isFinite) || live.mean >= live.champion_mean - 2 * live.se) return false;
  if (store.read('negotiation_policy', scope).value !== 'challenger') return false;
  store.rollback('negotiation_policy', scope, at);
  return true;
}

export function offerFromRegistry(state: OfferState, pAccept: PAccept, posture: number, store: ParamStore, scope: Scope): Decision {
  store.declare({ name: 'negotiation_policy', family: 'model_ref', prior: 'champion' });
  const selected = store.read('negotiation_policy', scope);
  if (selected.value !== 'champion' && selected.value !== 'challenger') throw new TypeError('invalid negotiation policy');
  return offer(state, pAccept, posture, selected.value, selected.version);
}
