import { decide, assertLimits, assertState, probability, type OfferState, type PAccept, type Decision } from './choose.ts';
import { stance } from '../valuation/posture.ts';
import { roundToEnding, endings, money, type EndingRule } from '../money/ending.ts';
import type { ParamStore, Scope } from '../param/param.ts';
import { resolve, validate, POLICY, type Resolved } from './params.ts';
import { resolve as resolveEnding } from '../money/params.ts';
import { fact } from '../../../../spec/sites.mjs';

export function offer(state: OfferState, pAccept: PAccept, posture: number, policy: Decision['policy'] = 'champion', param_version = 0, params: Resolved = resolve()): Decision {
  assertState(state); // before the accept line is computed from the floor
  const s = stance(posture);
  const accept_line_cents = Math.round(state.floor_cents + s.accept_line_share * (Math.max(state.floor_cents, state.always_accept_cents) - state.floor_cents));
  const round = typeof state.features?.round === 'number' ? state.features.round : 0;
  if (!Number.isSafeInteger(round) || round < 0) throw new RangeError('round');
  const lo = Math.max(state.floor_cents, state.offer_cents + 1), hi = state.ask_cents - 1;
  const share = s.counter_share * (1 - s.concede_per_round) ** round;
  const line = lo > hi ? null : roundToEnding(Math.round(state.offer_cents + share * (state.ask_cents - state.offer_cents)), state.ending, lo, hi);
  const adjusted = { ...state, always_accept_cents: accept_line_cents, accept_line_cents,
    counter_min_cents: line ?? undefined, counter_target_cents: line ?? undefined, counter_under_floor: s.counter_under_floor_offers };
  return assertLimits(decide(adjusted, pAccept, policy, param_version, params), adjusted);
}

export function opener(site: string, max_pay: number, amounts: number[], pAccept: (amount: number) => number, ending: EndingRule = resolveEnding().values.money_ending) {
  if (!Number.isSafeInteger(max_pay) || max_pay < 0) throw new RangeError('invalid max_pay');
  for (const amount of amounts) money(amount, 'amount');
  const candidates = amounts.filter(p => p > 0 && p <= max_pay && endings(p, p, ending).length > 0).map(amount => {
    const p = pAccept(amount);
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('invalid probability');
    return { amount, surplus: p * (max_pay - amount) };
  }).sort((a, b) => b.surplus - a.surplus || a.amount - b.amount);
  if (!candidates.length) return null;
  return { kind: 'buy_offer' as const, amount_cents: candidates[0].amount, ask: true, binding: fact('accept.charges_buyer', site) === true };
}

export type Matched = { match: string; champion_keep: number; challenger_keep: number };
export function switchPolicy(x: { store: ParamStore; scope: Scope; matched: Matched[]; calibration_error: number; at: string; random: () => number }) {
  x.store.declare(POLICY);
  const pv = resolve(x.store, x.scope).values;
  if (x.matched.length < pv.negotiation_switch_n || !Number.isFinite(x.calibration_error) || x.calibration_error > pv.negotiation_calibration_error) return { promoted: false, reason: 'basis or calibration' };
  if (new Set(x.matched.map(r => r.match)).size !== x.matched.length) throw new Error('duplicate matched offer');
  for (const row of x.matched) { money(row.champion_keep, 'champion_keep'); money(row.challenger_keep, 'challenger_keep'); }
  const lb = compare(x.matched.map(r => r.champion_keep), x.matched.map(r => r.challenger_keep), x.random, resolve(x.store, x.scope)).lower_95;
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
  const pv = resolve(store, scope).values;
  if (live.days < pv.negotiation_rollback_days || live.se < 0 || ![live.mean, live.champion_mean, live.se, live.days].every(Number.isFinite) || live.mean >= live.champion_mean - pv.negotiation_rollback_se * live.se) return false;
  if (store.read('negotiation_policy', scope).value !== 'challenger') return false;
  store.rollback('negotiation_policy', scope, at);
  return true;
}

export function offerFromRegistry(state: OfferState, pAccept: PAccept, posture: number, store: ParamStore, scope: Scope): Decision {
  store.declare(POLICY);
  const selected = store.read('negotiation_policy', scope);
  if (selected.value !== 'champion' && selected.value !== 'challenger') throw new TypeError('invalid negotiation policy');
  const params = resolve(store, scope), ending = resolveEnding(store, scope);
  return offer({ ...state, ending: state.ending ?? ending.values.money_ending }, pAccept, posture, selected.value, selected.version, { ...params, versions: { ...params.versions, ...ending.versions, negotiation_policy: selected.version } });
}

// D17: a ceiling is unavailable unless identity, condition, authenticity and valuation pass their gates.
export type BuyingState = {
  qualified: boolean; valuation_shown: boolean; recall?: boolean;
  p_identity: number; p_condition: number; p_authentic: number;
  keep_p25_cents: number; hassle_cents: number; target_profit_cents: number;
  risk_margin_cents?: number;
};
export function maxPay(x: BuyingState, params: Resolved = resolve()): number | null {
  for (const key of ['keep_p25_cents', 'hassle_cents', 'target_profit_cents'] as const) money(x[key], key);
  if (x.risk_margin_cents !== undefined) money(x.risk_margin_cents, 'risk_margin_cents');
  for (const key of ['p_identity', 'p_condition', 'p_authentic'] as const) probability(x[key], key);
  validate(params);
  const pv = params.values;
  if (!x.qualified || !x.valuation_shown || x.recall || Math.min(x.p_identity, x.p_condition, x.p_authentic) < pv.negotiation_buy_min_probability) return null;
  const risk = x.risk_margin_cents ?? pv.negotiation_buy_risk_share * x.keep_p25_cents;
  return money(Math.max(0, Math.round(x.p_identity * x.p_condition * x.p_authentic * x.keep_p25_cents - x.hassle_cents - risk - x.target_profit_cents)), 'max_pay');
}
export function buyingOffer(site: string, x: BuyingState, amounts: number[], pAccept: (amount: number) => number, params: Resolved = resolve(), ending: EndingRule = resolveEnding().values.money_ending) {
  const ceiling = maxPay(x, params);
  return ceiling === null ? null : opener(site, ceiling, amounts, pAccept, ending);
}

// Paired bootstrap with linear quantiles, also used by sim.py. Gains are signed whole cents.
export function compare(champion: number[], challenger: number[], random: () => number, params: Resolved = resolve()) {
  validate(params);
  if (!champion.length || champion.length !== challenger.length) throw new RangeError('paired outcomes');
  for (const value of [...champion, ...challenger]) money(value, 'paired keep');
  const gains = challenger.map((v, i) => v - champion[i]);
  const means = Array.from({ length: params.values.negotiation_bootstrap_n }, () => gains.reduce(sum => {
    const u = random();
    if (!Number.isFinite(u) || u < 0 || u >= 1) throw new RangeError('random must be in [0,1)');
    return sum + gains[Math.floor(u * gains.length)];
  }, 0) / gains.length).sort((a, b) => a - b);
  const index = params.values.negotiation_bootstrap_tail * (means.length - 1), lo = Math.floor(index), hi = Math.ceil(index);
  const lower = means[lo] + (means[hi] - means[lo]) * (index - lo);
  const mean_gain = Math.round(gains.reduce((a, b) => a + b, 0) / gains.length), lower_95 = Math.round(lower);
  if (![mean_gain, lower_95].every(Number.isSafeInteger)) throw new RangeError('paired gain overflow');
  return { mean_gain: mean_gain === 0 ? 0 : mean_gain, lower_95: lower_95 === 0 ? 0 : lower_95, n: gains.length };
}
