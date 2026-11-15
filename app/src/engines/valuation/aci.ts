import { lineage, memoryStore, scopeKey, type Declared, type ParamStore, type Scope } from '../param/param.ts';
import { timestamp, positive, recorded, type EventLog } from '../demand/velocity.ts';

type Entry = Declared & { scopes: (keyof Scope)[]; source: string };
type Score = { score: number; at: string; err: 0 | 1 };
type Scores = { scores: Score[] };
export type Issued = { q10: number; q90: number };
const source = 'spec/determinations/money.md#d6-range-calibration-and-display-state';
// The brief limits new files; these declarations cannot go in the existing valuation params module.
export const DECLARED: Entry[] = [
  { name: 'valuation_aci_alpha', family: 'scalar', prior: .2, guard_lo: .05, guard_hi: .5, scopes: ['kind', 'site', 'segment'], source },
  { name: 'valuation_aci_step', family: 'scalar', prior: .005, guard_lo: 0, scopes: ['kind', 'site', 'segment'], source },
  { name: 'valuation_aci_target', family: 'scalar', prior: .2, guard_lo: 0, guard_hi: 1, scopes: ['kind', 'site', 'segment'], source },
  { name: 'valuation_aci_alpha_min', family: 'scalar', prior: .05, guard_lo: 0, guard_hi: 1, scopes: ['kind', 'site', 'segment'], source: source + '; worker brief clamp' },
  { name: 'valuation_aci_alpha_max', family: 'scalar', prior: .5, guard_lo: 0, guard_hi: 1, scopes: ['kind', 'site', 'segment'], source: source + '; worker brief clamp' },
  { name: 'valuation_conformal_half_life_days', family: 'scalar', prior: 90, guard_lo: Number.MIN_VALUE, scopes: ['kind', 'site', 'segment'], source },
  { name: 'valuation_conformal_parent_min', family: 'scalar', prior: 10, guard_lo: 1, scopes: ['kind', 'site', 'segment'], source },
  { name: 'valuation_conformal_scores', family: 'model_ref', prior: { scores: [] }, scopes: ['kind', 'site', 'segment'], source },
];

export function resolve(store: ParamStore = memoryStore(), scope: Scope = {}) {
  const values: Record<string, unknown> = {}, versions: Record<string, number> = {};
  for (const entry of DECLARED) {
    store.declare(entry);
    const read = store.read(entry.name, scope);
    if (read.value === undefined) throw new TypeError(`missing param ${entry.name}`);
    values[entry.name] = read.value; versions[entry.name] = read.version;
  }
  return { values, versions };
}

function scalar(values: Record<string, unknown>, name: string): number {
  const value = values[name], entry = DECLARED.find(d => d.name === name)!;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError(`invalid or missing ${name}`);
  if ((entry.guard_lo !== undefined && value < entry.guard_lo) || (entry.guard_hi !== undefined && value > entry.guard_hi)) throw new RangeError(`${name} outside guard`);
  return value;
}

function scores(value: unknown): Scores {
  if (typeof value !== 'object' || value === null || !('scores' in value) || !Array.isArray(value.scores)) throw new RangeError('valuation_conformal_scores needs scores');
  for (const row of value.scores) {
    if (typeof row !== 'object' || row === null || !('score' in row) || typeof row.score !== 'number' || !Number.isFinite(row.score)
      || !('at' in row) || typeof row.at !== 'string' || !('err' in row) || (row.err !== 0 && row.err !== 1)) throw new RangeError('invalid conformal score');
    timestamp(row.at);
  }
  return value as Scores;
}

function money(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be nonnegative safe integer cents`);
}

function range(issued: Issued) {
  money(issued.q10, 'q10'); money(issued.q90, 'q90');
  if (issued.q10 === 0 || issued.q10 > issued.q90) throw new RangeError('q10 must be positive and no greater than q90 for log calibration');
}

export function onOurSale(store: ParamStore, group: Scope, issued: Issued, sold_cents: number, at: string, log?: EventLog) {
  return recorded(log, 'valuation.onOurSale', { group, issued, sold_cents, at }, () => sale(store, group, issued, sold_cents, at));
}

function sale(store: ParamStore, group: Scope, issued: Issued, sold_cents: number, at: string) {
  range(issued); money(sold_cents, 'sold_cents');
  if (sold_cents === 0) throw new RangeError('sold_cents must be positive for log calibration');
  const time = timestamp(at), params = resolve(store, group);
  const row = store.rows('valuation_conformal_scores', group).find(r => r.status === 'champion');
  const old = row ? scores(row.value_or_hyperparams) : { scores: [] };
  if (old.scores.some(s => timestamp(s.at) > time)) throw new RangeError('out-of-order sale observation');
  const err = sold_cents < issued.q10 || sold_cents > issued.q90 ? 1 : 0;
  // Scale-free D6 score: log ratios, matching the log-price conformal model in market.py.
  const score = Math.max(Math.log(issued.q10 / sold_cents), Math.log(sold_cents / issued.q90));
  const step = scalar(params.values, 'valuation_aci_step'), target = scalar(params.values, 'valuation_aci_target');
  const lo = scalar(params.values, 'valuation_aci_alpha_min'), hi = scalar(params.values, 'valuation_aci_alpha_max');
  if (lo > hi) throw new RangeError('valuation_aci_alpha_min exceeds max');
  if (['valuation_aci_alpha', 'valuation_conformal_scores'].some(name => store.rows(name, group).some(r => r.status === 'champion' && r.frozen)))
    return { applied: false, reason: 'frozen' };
  const alpha = scalar(params.values, 'valuation_aci_alpha');
  const updated = store.apply('valuation_aci_alpha', group, () => ({ value: Math.max(lo, Math.min(hi, alpha + step * (target - err))), weight: 1 }), at);
  if (!updated.applied) return updated;
  return store.apply('valuation_conformal_scores', group, () => ({ value: { scores: [...old.scores, { score, at, err }] }, weight: 1 }), at);
}

export function qg(store: ParamStore, group: Scope): number {
  const params = resolve(store, group);
  let data = scores(params.values.valuation_conformal_scores).scores;
  const minimum = scalar(params.values, 'valuation_conformal_parent_min');
  if (data.length < minimum) for (const parent of lineage(group).slice(1)) {
    const parentScores = scores(store.read('valuation_conformal_scores', parent).value).scores;
    if (parentScores.length) data = parentScores;
    if (data.length >= minimum) break;
  }
  if (!data.length) return 0;
  const alpha = scalar(params.values, 'valuation_aci_alpha');
  const halfLife = positive(params.values.valuation_conformal_half_life_days, 'valuation_conformal_half_life_days');
  const now = Math.max(...data.map(s => timestamp(s.at)));
  const weighted = data.map(s => ({ score: s.score, weight: .5 ** ((now - timestamp(s.at)) / 86_400_000 / halfLife) })) // Fixed: milliseconds per day.
    .sort((a, b) => a.score - b.score);
  const total = weighted.reduce((n, s) => n + s.weight, 0);
  const quantile = Math.min(1, Math.ceil((data.length + 1) * (1 - alpha)) / data.length);
  let cumulative = 0;
  for (const row of weighted) {
    cumulative += row.weight;
    if (cumulative >= quantile * total) return Math.max(0, row.score);
  }
  return Math.max(0, weighted[weighted.length - 1].score);
}

// check.ts currently accepts symmetric additive cents. Translate the larger log-price
// displacement at that boundary, rounding half up; qg remains a log ratio.
export function calibrationForCheck(store: ParamStore, group: Scope, issued: Issued) {
  range(issued);
  const Q = qg(store, group);
  const cents = Math.round(Math.max(issued.q10 * -Math.expm1(-Q), issued.q90 * Math.expm1(Q)));
  money(cents, 'Q_g_cents');
  return { Q_g: cents, group: scopeKey(group), coverage: 0, passes: false, param_versions: resolve(store, group).versions };
}
