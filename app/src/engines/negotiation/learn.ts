// spec/engines/negotiation.md §3 step 3, §4; the event twin is jobs/negotiation/fit.py online_update.
import type { Log } from '../../../../log/index.js';
import { elapsed, forget, type Applied, type ParamStore, type Scope } from '../param/param.ts';
import { money } from '../money/ending.ts';
import type { OfferState, PAccept } from './choose.ts';
import { predict } from './model.ts';
import { resolve, type Resolved } from './params.ts';

export const FEATURE_ORDER = ['gap_ratio', 'counter_ask_ratio', 'round', 'days_listed', 'last_concession_share', 'response_latency_hours', 'watcher_count', 'like_count'] as const;
export type Model = {
  terms: Record<string, number>; weights: number[];
  prior_terms?: Record<string, number> | null; prior_weights?: number[] | null;
  precision?: Record<string, number>; label?: string;
};
export type Outcome = { site: string; category: string; features: number[]; accepted: number; may_model?: boolean; person?: string };
export type FeatureBuilder = (counter: number, state: OfferState) => number[];
export type LearnedPAccept = PAccept & { readonly param_versions: Record<string, number> };
const scopes = ['kind', 'site', 'segment', 'person'] as const;
const source = 'spec/engines/negotiation.md#4-learning';
// At the midpoint the linear concession curve has p=.5 and dp/dgap=-1. Its logit tangent
// is 2-4*gap: 4=1/(.5*(1-.5)), a mathematical derivative, not an additional fitted prior.
export const DECLARED = [
  { name: 'P_accept', family: 'model_ref', prior: { terms: { global: 2 }, weights: [-4, 0, 0, 0, 0, 0, 0, 0] }, scopes, source: 'spec/engines/negotiation.md#3-the-calculation (step 3 concession-curve prior)' },
  { name: 'negotiation_concession_curve', family: 'model_ref', prior: { k: 0, beta: 1 }, scopes, source: 'spec/engines/negotiation.md#3-the-calculation (step 3; agent proposal linear concession curve)' },
  { name: 'negotiation_prior_guard_share', family: 'scalar', prior: .5, guard_lo: 0, scopes, source },
] as const;

type Learning = Resolved & { values: Resolved['values'] & { negotiation_prior_guard_share: number; negotiation_concession_curve: { k: number; beta: number }; P_accept: Model } };
export function resolveLearning(store: ParamStore, scope: Scope): Learning {
  const p = resolve(store, scope);
  for (const d of DECLARED) store.declare(d);
  const model = store.read('P_accept', scope), guard = store.read('negotiation_prior_guard_share', scope), curve = store.read('negotiation_concession_curve', scope);
  const share = guard.value;
  if (typeof share !== 'number' || !Number.isFinite(share) || share < 0) throw new RangeError('negotiation_prior_guard_share');
  const c = curve.value as { k: number; beta: number };
  if (!c || !Number.isFinite(c.k) || c.k < 0 || c.k >= 1 || !Number.isFinite(c.beta) || c.beta <= 0) throw new RangeError('negotiation_concession_curve');
  return { values: { ...p.values, P_accept: parseModel(model.value), negotiation_prior_guard_share: share, negotiation_concession_curve: c },
    versions: { ...p.versions, P_accept: model.version, negotiation_prior_guard_share: guard.version, negotiation_concession_curve: curve.version } };
}

function record(value: unknown, field: string): asserts value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new RangeError(field);
}
function vector(value: unknown, field: string): asserts value is number[] {
  if (!Array.isArray(value) || value.length !== FEATURE_ORDER.length || Array.from(value).some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new RangeError(field);
}
function parseModel(value: unknown): Model {
  if (!value || typeof value !== 'object') throw new RangeError('P_accept model');
  const m = value as Model;
  record(m.terms, 'P_accept terms'); vector(m.weights, 'P_accept weights');
  if (m.label !== undefined && m.label !== 'accepted') throw new RangeError('P_accept label');
  if (m.prior_terms != null) {
    record(m.prior_terms, 'P_accept prior_terms');
    if (Object.keys(m.terms).some(k => !Object.hasOwn(m.prior_terms!, k))) throw new RangeError('P_accept prior_terms keys');
  }
  if (m.prior_weights != null) vector(m.prior_weights, 'P_accept prior_weights');
  if (m.precision !== undefined) {
    record(m.precision, 'P_accept precision');
    if (Object.values(m.precision).some(v => v < 0)) throw new RangeError('P_accept precision');
  }
  return m;
}

export function features(counter: number, state: OfferState): number[] {
  money(counter, 'counter_cents'); money(state.offer_cents, 'offer_cents'); money(state.ask_cents, 'ask_cents');
  const gap = state.ask_cents - state.offer_cents;
  if (gap <= 0) throw new RangeError('gap must be positive');
  if (counter < state.offer_cents || counter > state.ask_cents) throw new RangeError('counter_cents outside gap');
  const inputs = state.features ?? {};
  // Missing extractor signals are neutral; an observed malformed signal must not become a neutral value.
  const values: Record<typeof FEATURE_ORDER[number], number> = {
    gap_ratio: (counter - state.offer_cents) / gap, counter_ask_ratio: counter / state.ask_cents,
    round: Number(inputs.round ?? 0), days_listed: Number(inputs.days_listed ?? 0),
    last_concession_share: Number(inputs.last_concession_share ?? 0), response_latency_hours: Number(inputs.response_latency_hours ?? 0),
    watcher_count: Number(inputs.watcher_count ?? 0), like_count: Number(inputs.like_count ?? 0),
  };
  for (const name of FEATURE_ORDER) {
    if (!Number.isFinite(values[name]) || values[name] < 0 || typeof inputs[name] === 'boolean') throw new RangeError(name);
  }
  for (const name of ['round', 'watcher_count', 'like_count'] as const) if (!Number.isSafeInteger(values[name])) throw new RangeError(name);
  return FEATURE_ORDER.map(name => values[name]);
}
const keys = (row: Pick<Outcome, 'site' | 'category'>) => ['global', `site:${row.site}`, `category:${row.category}`, `cell:${row.site}:${row.category}`];
function validTime(at: string): void { if (!Number.isFinite(Date.parse(at))) throw new RangeError('at'); }
function decay(model: Model, keep: number): Model {
  const pt = model.prior_terms ?? model.terms, pw = model.prior_weights ?? model.weights;
  return { ...model, prior_terms: pt, prior_weights: pw,
    terms: Object.fromEntries(Object.entries(model.terms).map(([k, v]) => [k, pt[k] + keep * (v - pt[k])])),
    weights: model.weights.map((w, i) => pw[i] + keep * (w - pw[i])),
    precision: Object.fromEntries(Object.entries(model.precision ?? {}).map(([k, v]) => [k, Math.max(1, v * keep)])),
  };
}

// An idle read records only forgetting, through the registry's timestamp rule, never a synthetic outcome.
export function pAcceptFrom(store: ParamStore, scope: Scope, build: FeatureBuilder = features, at?: string, log?: Log): LearnedPAccept {
  resolveLearning(store, scope);
  if (at !== undefined) {
    validTime(at);
    const selected = store.read('P_accept', scope);
    const base = store.rows('P_accept', selected.scope).find(r => r.version === selected.version);
    if (base && forget(elapsed(base, at)) < 1) {
      const applied = store.apply('P_accept', selected.scope, (value, keep) => ({ value: decay(parseModel(value), keep), weight: 0 }), at);
      logUpdate(log, applied, at);
    }
  }
  const p: PAccept = (counter, state) => {
    const params = resolveLearning(store, scope), row = { site: state.site, category: scope.segment ?? '', features: build(counter, state) };
    if (scope.site !== undefined && state.site !== scope.site) throw new RangeError('site outside scope');
    if (!row.category) throw new RangeError('category requires scope.segment');
    vector(row.features, 'features');
    const selected = store.read('P_accept', scope);
    if (selected.from === 'prior') {
      const curve = params.values.negotiation_concession_curve;
      const gap = row.features[0];
      if (gap < 0 || gap > 1) throw new RangeError('gap_ratio');
      const probability = 1 - (curve.k + (1 - curve.k) * gap ** (1 / curve.beta));
      return Math.min(params.values.negotiation_p_hi, Math.max(params.values.negotiation_p_lo, probability));
    }
    return predict(params.values.P_accept, row, params);
  };
  return Object.defineProperty(p, 'param_versions', { get: () => resolveLearning(store, scope).versions }) as LearnedPAccept;
}

// The caller passes the registry in the transaction recording offer_outcome; this function never commits it.
export function onOutcome(store: ParamStore, scope: Scope, outcome: Outcome, at: string, log?: Log): Applied {
  log?.note('negotiation outcome input', { site: outcome.site, category: outcome.category, accepted: outcome.accepted, features: outcome.features, at });
  try {
    const applied = applyOutcome(store, scope, outcome, at, log);
    logUpdate(log, applied, at);
    return applied;
  } catch (error) {
    log?.error('negotiation.onOutcome', error, { at });
    throw error;
  }
}
function logUpdate(log: Log | undefined, applied: Applied, at: string): void {
  if (applied.applied) log?.event('state.change', { entity: 'param', id: 'P_accept', to: 'champion', scope: applied.read.scope, param_version: applied.read.version, value: applied.read.value, n_eff: applied.read.n_eff, at });
  else log?.note('negotiation P_accept kept', { reason: applied.reason, param_version: applied.read.version, at });
}
function applyOutcome(store: ParamStore, scope: Scope, outcome: Outcome, at: string, log?: Log): Applied {
  validTime(at); vector(outcome.features, 'features');
  if (outcome.accepted !== 0 && outcome.accepted !== 1) throw new RangeError('accepted must be binary');
  if (outcome.may_model === false) throw new RangeError('may_model false');
  if (!outcome.site || !outcome.category) throw new RangeError('site and category required');
  if (scope.site !== undefined && scope.site !== outcome.site) throw new RangeError('site outside scope');
  if (scope.segment !== undefined && scope.segment !== outcome.category) throw new RangeError('category outside scope');
  if (scope.person !== undefined && scope.person !== outcome.person) throw new RangeError('person outside scope');
  const params = resolveLearning(store, scope), selected = store.read('P_accept', scope);
  if (selected.from === 'parent') {
    const parent = store.rows('P_accept', selected.scope).find(r => r.version === selected.version)!;
    // Preserve the inherited evidence clock so apply derives elapsed time in the new scope itself.
    const inheritedAt = parent.promoted_at ?? at;
    const inherited = store.apply('P_accept', scope, value => ({ value, weight: selected.n_eff }), inheritedAt);
    logUpdate(log, inherited, inheritedAt);
  }
  return store.apply('P_accept', scope, (value, keep) => {
    let model = parseModel(value);
    if (selected.from === 'prior') model = { ...model, terms: { ...Object.fromEntries(keys(outcome).map(k => [k, 0])), ...model.terms } };
    const pt = model.prior_terms ?? { ...model.terms }, pw = model.prior_weights ?? [...model.weights];
    const p = predict(model, outcome, params), precision = { ...model.precision };
    function update(name: string, value: number, prior: number, feature: number) {
      feature = Math.min(1, Math.max(-1, feature)); // Fixed Laplace influence cap, fit.py online_update.
      const information = Math.max(1, (precision[name] ?? 1) * keep); // Fixed unit baseline precision, fit.py.
      precision[name] = information + p * (1 - p) * feature * feature;
      const estimate = prior + keep * (value - prior) + (outcome.accepted - p) * feature / precision[name];
      const { negotiation_p_lo: pLo, negotiation_p_hi: pHi, negotiation_prior_guard_share: guardShare } = params.values;
      const logitWidth = (Math.log(pHi / (1 - pHi)) - Math.log(pLo / (1 - pLo))) / 2;
      const width = Math.max(Math.abs(prior) * guardShare, logitWidth);
      return Math.min(prior + width, Math.max(prior - width, estimate));
    }
    const active = keys(outcome);
    const terms = Object.fromEntries(Object.entries(model.terms).map(([k, v]) => [k, update(k, v, pt[k], Number(active.includes(k)))]));
    const weights = model.weights.map((w, i) => update(`w:${i}`, w, pw[i], outcome.features[i]));
    return { value: { terms, weights, prior_terms: pt, prior_weights: pw, precision, label: 'accepted', param_versions: params.versions }, weight: 1 };
  }, at);
}
