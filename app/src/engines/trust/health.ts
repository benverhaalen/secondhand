import type { ParamStore, Scope } from '../param/param.ts';
import { numeric, priors, resolve, type ParamInput } from './params.ts';
export type Metric = { name: string; value: number; threshold: number };
export type Health = { risk: number; flagged: boolean; action: 'none' | 'ask' | 'block'; reasons: string[] };
const ratio = (m: Metric) => {
  if (!Number.isFinite(m.threshold) || m.threshold <= 0) throw new RangeError(`${m.name}.threshold`);
  if (!Number.isFinite(m.value) || m.value < 0) throw new RangeError(`${m.name}.value`);
  return m.value / m.threshold;
};
export function health(metrics: Metric[], values: ParamInput = priors(), opts: { paused?: boolean; next?: { metric: string; delta: number } } = {}): Health {
  const risk = metrics.reduce((a, m) => Math.max(a, ratio(m)), 0);
  const flagged = risk >= numeric(values)('trust_flag_m');
  if (opts.next && (!Number.isFinite(opts.next.delta) || opts.next.delta < 0 || !metrics.some(m => m.name === opts.next!.metric))) throw new RangeError('next metric');
  if (opts.paused) return { risk, flagged, action: 'block', reasons: ['The site warned this account, so every action is paused.'] };
  const n = opts.next && metrics.find(m => m.name === opts.next?.metric);
  if (n && (n.value + opts.next!.delta) / n.threshold >= 1) return { risk, flagged, action: 'ask', reasons: [`One more would put ${n.name} over the site’s limit.`] };
  return { risk, flagged, action: 'none', reasons: flagged ? ['This account is close to a site limit.'] : [] };
}
export const flagAfterWarning = (r: number, values: ParamInput = priors()) => {
  if (!Number.isFinite(r) || r < 0) throw new RangeError('warning ratio');
  return r * numeric(values)('trust_warning_factor');
};
export function observeChallenge(store: ParamStore, scope: Scope, challenge: 0 | 1, at: string, weight = 1) {
  resolve(store, scope); return store.observe('trust_pace', scope, { success: challenge, weight }, at);
}
export function observeDispute(store: ParamStore, scope: Scope, won: 0 | 1, at: string, weight = 1) {
  resolve(store, scope); return store.observe('trust_dispute', scope, { success: won, weight }, at);
}
export function disputeCount(store: ParamStore, scope: Scope) {
  const r = resolve(store, scope), h = r.values.trust_dispute as { alpha: number; beta: number };
  return { mean: h.alpha / (h.alpha + h.beta), shown: null }; // Counts require closed-case evidence; posterior pseudo-counts are not cases.
}
export function paceAllowed(rate: number, siteFlag: number, values: ParamInput = priors()) {
  const p = numeric(values);
  if (![rate, siteFlag].every(x => Number.isFinite(x) && x >= 0 && x <= 1)) throw new RangeError('pace rate');
  const h = typeof values === 'function' ? values('trust_pace') : values.trust_pace;
  const b = h as { alpha: number; beta: number };
  if (![b?.alpha, b?.beta].every(x => Number.isFinite(x) && x > 0)) throw new RangeError('trust_pace');
  const mean = b.alpha / (b.alpha + b.beta);
  // Cantelli's inequality gives a conservative one-sided posterior bound without a distribution library.
  const variance = b.alpha * b.beta / ((b.alpha + b.beta) ** 2 * (b.alpha + b.beta + 1));
  const upper = Math.min(1, mean + Math.sqrt(variance * p('trust_pace_tail_odds')));
  return Math.max(rate, upper) <= Math.min(p('trust_pace_ceiling'), siteFlag);
}
