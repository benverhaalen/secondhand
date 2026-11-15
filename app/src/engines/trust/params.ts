import type { Declared, ParamStore, Scope } from '../param/param.ts';
export const SCORED = {
  off_platform: { w: 2.0, by: 'model' }, ship_elsewhere: { w: 1.5, by: 'model' }, link_early: { w: 1.0, by: 'code' },
  new_account: { w: 0.7, by: 'adapter' }, urgency_no_question: { w: 0.5, by: 'model' }, good_history: { w: -1.5, by: 'adapter' },
  third_party_collects: { w: 1.5, by: 'model' }, site_banner: { w: 2.0, by: 'adapter' }, script_print_hit: { w: 1.0, by: 'code' },
  burst_same_text: { w: 0.7, by: 'code' },
} as const;
export type Scored = keyof typeof SCORED;
export const SCORED_NAMES = Object.keys(SCORED) as Scored[];

// Model predicates; a model failure never reads as absent (decide.ts turns it into ask).
export const HARD_MODEL = ['asks_code', 'overpay_or_shipping_label', 'claims_paid', 'asks_address_phone'] as const;
export const PREDICATES = [...new Set<string>([...HARD_MODEL, ...SCORED_NAMES.filter((s) => SCORED[s].by === 'model')])];
export const THRESH0 = (p: string) => (p === 'asks_code' ? 0.1 : 0.2); // messages-and-offers start values


export const R0 = 0.04; // a signal's honest rate in all threads until the counts say otherwise
export const STRENGTH = 20; // threads the prior is worth

const beta = (name: string, a: number, b: number, lo = 0.001, hi = 0.95): Declared => ({ name, family: 'beta', prior: { alpha: a, beta: b }, guard_lo: lo, guard_hi: hi, metric: 'beta' });
const num = (name: string, prior: unknown, lo?: number, hi?: number): Declared => ({ name, family: 'scalar', prior, guard_lo: lo, guard_hi: hi });

// Every number the trust engine reads, declared once with its written prior.
export const BASE: Declared[] = [
  ...SCORED_NAMES.flatMap((s): Declared[] => {
    const q0 = R0 * Math.exp(SCORED[s].w);
    return [beta(`trust_q.${s}`, STRENGTH * q0, STRENGTH * (1 - q0)), beta(`trust_r.${s}`, STRENGTH * R0, STRENGTH * (1 - R0))];
  }),
  ...PREDICATES.map((p) => num(`trust_thr.${p}`, THRESH0(p), 0, 1)),
  num('trust_b', -4.0), num('trust_m_ask', 0.1), num('trust_c_tap_cents', 100), num('trust_delta', 0.0538),
  num('trust_warn_gap', 0.5), num('trust_loss_min_cents', 2000), num('trust_p_block', 0.95),
  { name: 'trust_weights', family: 'model_ref', prior: { uri: 'none', weights: {}, b: -4 } },
  { name: 'trust_calib', family: 'model_ref', prior: { uri: 'none', version: 0, kind: 'none', n: 0, positives: 0, ece: 1 } },
  num('trust_gate_n', 300), num('trust_gate_pos', 30), num('trust_gate_ece', 0.05),
  num('trust_seller_cap', 0.05), num('trust_label_sellers', 3),
  num('trust_print_hamming', 3), num('trust_print_min', 3), num('trust_print_tokens', 8),
  num('trust_burst_n', 5), num('trust_new_days', 30), num('trust_good_buys', 10), num('trust_urgent_cents', 20000),
  num('trust_weight_band', 0.5), num('trust_weight_support', 30), num('trust_isotonic_n', 1000),
  num('trust_retention_days', 30),
  // no-show (card 6)
  beta('trust_ns_b', 1, 4), num('trust_ns_confirm', 1.0), num('trust_ns_ask', 3.0), num('trust_ns_wait_min', 15),
  // account health and pace
  num('trust_flag_m', 0.8, 0, 1), beta('trust_pace', 1, 99, 0, 1), num('trust_pace_ceiling', 0.01), beta('trust_dispute', 1, 1, 0, 1), num('trust_dispute_show', 10),
  // counterfeit
  num('trust_cf_brands', ['chanel', 'louis vuitton', 'gucci', 'prada', 'nike', 'jordan', 'yeezy', 'rolex', 'coach', 'hermes']),
  num('trust_cf_price_ratio', 0.6), num('trust_cf_young_days', 30),
  num('trust_ns_past_weight', 2), num('trust_ns_paid_weight', -3), num('trust_ns_exact_weight', -1), num('trust_ns_vague_weight', 1),
  num('trust_ns_new_weight', .5), num('trust_ns_haggle_weight', .3), num('trust_ns_reschedule_weight', .7), num('trust_ns_reply_weight', -1.5),
  num('trust_ns_past_ask', 2), num('trust_print_days', 7), num('trust_salt_overlap_days', 7), num('trust_warning_factor', .9),
  num('trust_proof_min_n_eff', 1), num('trust_proof_max_age_days', 30), num('trust_model_timeout_ms', 2000),
  num('trust_pace_tail_odds', 19),
  // recall
  num('trust_recall_max_delta', 500),
];

for (const k of ['past', 'paid', 'exact', 'vague', 'new', 'haggle', 'reschedule', 'reply']) {
  const w = BASE.find(d => d.name === `trust_ns_${k}_weight`)!.prior as number;
  const q0 = R0 * Math.exp(w);
  BASE.push(beta(`trust_ns_q.${k}`, STRENGTH * q0, STRENGTH * (1 - q0)), beta(`trust_ns_r.${k}`, STRENGTH * R0, STRENGTH * (1 - R0)));
}
export const DECLARED = BASE.map(d => ({ ...d, scopes: ['kind', 'site', 'segment', 'person'] as const,
  source: /trust_(ns_|cf_|new_days|good_buys|urgent_cents)/.test(d.name) ? 'spec/engines/trust.md#2-signals' : /trust_(b$|m_ask|c_tap|delta|warn_gap|loss_min|p_block)/.test(d.name) ? 'spec/engines/trust.md#3-the-calculation' : 'spec/engines/trust.md#4-learning' }));
export const declareTrust = (store: ParamStore) => DECLARED.forEach(d => store.declare(d));
export type Values = Record<string, unknown>;
export function priors(): Values { return Object.fromEntries(DECLARED.map(d => [d.name, structuredClone(d.prior)])); }
export function priorVersions(): Record<string, number> { return Object.fromEntries(DECLARED.map(d => [d.name, 0])); }
export function resolve(store: ParamStore, scope: Scope) {
  const values: Values = {}, versions: Record<string, number> = {};
  for (const d of DECLARED) { store.declare(d); const r = store.read(d.name, scope); values[d.name] = r.value; versions[d.name] = r.version; }
  const errors: Error[] = [];
  if (versions.trust_weights) {
    const model = values.trust_weights as { b?: unknown; weights?: Record<string, unknown> } | null;
    if (!model || typeof model.b !== 'number' || !Number.isFinite(model.b)) {
      errors.push(new RangeError('trust_weights: nonfinite b'));
      const prior = priors();
      values.trust_weights = prior.trust_weights;
      values.trust_b = prior.trust_b;
      values.trust_calib = prior.trust_calib;
      versions.trust_calib = 0;
      versions.trust_weights = 0;
      versions.trust_b = 0;
    } else {
      const weights: Record<string, number> = {};
      for (const name of SCORED_NAMES) {
        const fitted = model.weights?.[name];
        if (typeof fitted === 'number' && Number.isFinite(fitted)) weights[name] = fitted;
        else {
          weights[name] = SCORED[name].w;
          errors.push(new RangeError(`trust_weights: missing or nonfinite ${name}`));
        }
      }
      values.trust_weights = { ...model, weights };
      values.trust_b = model.b;
    }
  }
  for (const k of ['past', 'paid', 'exact', 'vague', 'new', 'haggle', 'reschedule', 'reply']) {
    const q = values[`trust_ns_q.${k}`] as { alpha: number; beta: number }, r = values[`trust_ns_r.${k}`] as { alpha: number; beta: number };
    if (versions[`trust_ns_q.${k}`] || versions[`trust_ns_r.${k}`]) values[`trust_ns_${k}_weight`] = liveWeight(q, r, numberParam(priors(), `trust_ns_${k}_weight`), values);
  }
  return { values, versions, errors };
}
export function numberParam(values: Values, name: string): number {
  const n = values[name];
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new RangeError(name);
  return n;
}
export type ParamInput = Values | ((name: string) => unknown);
export function numeric(input: ParamInput = priors()): (name: string) => number {
  return name => numberParam({ [name]: typeof input === 'function' ? input(name) : input[name] }, name);
}

// D5: both classes need support before a live likelihood ratio can leave the prior band.
export function liveWeight(q: { alpha: number; beta: number }, r: { alpha: number; beta: number }, prior: number, values: Values): number {
  if (![q?.alpha, q?.beta, r?.alpha, r?.beta].every(x => Number.isFinite(x) && x > 0)) throw new RangeError('trust_q/r');
  const positive = q.alpha + q.beta - STRENGTH;
  const negative = r.alpha + r.beta - STRENGTH - positive;
  const learned = Math.log(q.alpha / (q.alpha + q.beta) / (r.alpha / (r.alpha + r.beta)));
  if (Math.min(positive, negative) >= numberParam(values, 'trust_weight_support')) return learned;
  const band = Math.abs(prior) * numberParam(values, 'trust_weight_band');
  return Math.max(prior - band, Math.min(prior + band, learned));
}
