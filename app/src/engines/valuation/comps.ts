/**
 * Reads extracted sold comps, target condition/size/site, as_of and overridable priors.
 * D1: reject non-sales and stale rows; multiply type, match, age and extraction weights.
 * Add variant, product, family, category levels until the sold basis is sufficient.
 * D2/D3: multiply condition and fitted size ratios by capped exponential log drift.
 * D1: reject excessive total adjustments, then trim by median/MAD of log prices.
 * D5: take cumulative-weight quantiles; D4 translates a thin site's pooled basis
 * only with supported ratios, widening endpoints before whole-dollar rounding.
 * Everything here is deterministic arithmetic; may_model never filters cited sales.
 */

export type Comp = {
  comp_id: string;
  site: 'ebay' | 'facebook' | 'depop' | 'poshmark' | 'mercari';
  sold_at: string;
  price_cents: number;
  kind: 'sold' | 'best_offer' | 'own_order';
  level: 'variant' | 'product' | 'family' | 'category';
  condition: string;
  size?: string;
  w_match: number;
  w_extract: number;
  may_model: boolean;
  citation: string;
};

type SiteRatio = { ratio: number; q25: number; q75: number; n: number };
export type Params = {
  w_type: Record<Comp['kind'], number>;
  w_match: Record<Comp['level'], number>;
  w_extract: Record<string, number>;
  half_life_days: Record<'default' | 'fast', number>;
  category_speed: 'default' | 'fast';
  max_age_days: number;
  recent_days: number;
  min_recent: number;
  min_n_eff: number;
  outlier_k: number;
  adjustment_cut: number;
  d_offer_cat: number;
  condition_ratios: Record<string, number>;
  completeness_ratios: Record<string, number>;
  size_ratios: Record<string, number>;
  shrinkage_k: number;
  min_parent_rows: number;
  time_factor_min: number;
  time_factor_max: number;
  timeIndex: (sold_at: string) => number;
  site_ratios: Partial<Record<Comp['site'], SiteRatio>>;
  parent_site_ratios: Partial<Record<Comp['site'], SiteRatio>>;
  min_site_products: number;
};

export const DEFAULTS: Params = {
  w_type: { sold: 1, best_offer: 0.6, own_order: 1.2 }, // D1 source weights.
  w_match: { variant: 1, product: 0.5, family: 0.25, category: 0 }, // D1 match priors; category needs a supplied match.
  w_extract: { measured: 1, label: 1, structured: 0.9, inferred: 0.7 }, // D1 extraction priors.
  half_life_days: { default: 90, fast: 30 }, // D1 age decay by category speed.
  category_speed: 'default', // D1 default category speed.
  max_age_days: 365, // D1 stale cut-off.
  recent_days: 90, // D1 recent-sale window.
  min_recent: 2, // D1 minimum recent sales.
  min_n_eff: 6, // D1 effective-count gate.
  outlier_k: 3 * 1.4826, // D1 scaled MAD cut on log price.
  adjustment_cut: Math.log(1.25), // D1 maximum absolute log adjustment.
  d_offer_cat: 0, // D1 learned unknown-offer discount; no numeric prior is supplied, so no discount until fitted.
  condition_ratios: { new_with_tags: 1.35, new_without_tags: 1.2, excellent: 1.1, good: 1, fair: 0.75, for_parts: 0.35 }, // D2 condition priors relative to good.
  completeness_ratios: { box_missing: 0.9, accessory_missing: 0.85 }, // D2 completeness priors (not represented in Comp).
  size_ratios: {}, // D2 has no size prior; fitted ratios only.
  shrinkage_k: 50, // D2 coefficient shrinkage, applied upstream when supplying ratios.
  min_parent_rows: 30, // D2 parent-fit gate, applied upstream.
  time_factor_min: 0.8, // D3 lower time-factor cap.
  time_factor_max: 1.25, // D3 upper time-factor cap.
  timeIndex: () => 0, // D3 no supported index means zero log drift.
  site_ratios: {}, // D4 has no numeric ratio prior; use supported category ratios.
  parent_site_ratios: {}, // D4 fallback is an evidenced parent-category ratio, never an invented ratio.
  min_site_products: 20, // D4 minimum paired products for translation.
};

export type WeightedComp = Comp & { w: number; w_type: number; w_age: number; age_days: number };
type AdjustedComp = Comp & { adjusted_cents: number };
type Dropped = { comp_id: string; reason: 'adjustment' | 'outlier' };
type Target = { condition: string; size?: string; site?: Comp['site'] };
const levels: Comp['level'][] = ['variant', 'product', 'family', 'category'];

export function weigh(comps: readonly Comp[], as_of: string, params = DEFAULTS): WeightedComp[] {
  const now = Date.parse(as_of);
  if (!Number.isFinite(now)) throw new RangeError('as_of must be an ISO date');
  const seen = new Set<string>();
  const result: WeightedComp[] = [];
  for (const comp of comps) {
    if (!Object.hasOwn(params.w_type, comp.kind)) continue;
    const age_days = (now - Date.parse(comp.sold_at)) / 86_400_000;
    if (!Number.isFinite(age_days) || age_days < 0 || age_days > params.max_age_days) continue;
    if (!Number.isSafeInteger(comp.price_cents) || comp.price_cents <= 0) continue;
    const w_type = params.w_type[comp.kind];
    const w_age = 0.5 ** (age_days / params.half_life_days[params.category_speed]);
    const w = w_type * comp.w_match * w_age * comp.w_extract;
    if (!Number.isFinite(w) || w <= 0 || seen.has(comp.comp_id)) continue;
    seen.add(comp.comp_id);
    result.push({ ...comp, w_type, w_age, w, age_days });
  }
  return result;
}

export function nEff(weights: readonly number[], _params = DEFAULTS): number {
  const max = Math.max(0, ...weights);
  if (max === 0) return 0;
  let sum = 0;
  let squares = 0;
  for (const w of weights) {
    sum += w / max;
    squares += (w / max) ** 2;
  }
  return sum ** 2 / squares;
}

function sufficient(comps: readonly WeightedComp[], params: Params): boolean {
  return nEff(comps.map(c => c.w)) >= params.min_n_eff &&
    comps.filter(c => c.age_days <= params.recent_days).length >= params.min_recent;
}

export function backOff<T extends WeightedComp>(comps: readonly T[], params = DEFAULTS) {
  const selected: T[] = [];
  for (const level of levels) {
    selected.push(...comps.filter(c => c.level === level));
    if (sufficient(selected, params) || level === 'category') {
      return { comps: selected, level, n_eff: nEff(selected.map(c => c.w)) };
    }
  }
  throw new Error('unreachable comp level');
}

export function adjust(comp: Comp, target: Target, timeIndex: (sold_at: string) => number, params = DEFAULTS): number {
  const source = params.condition_ratios[comp.condition];
  const destination = params.condition_ratios[target.condition];
  if (!(source > 0) || !(destination > 0)) throw new RangeError('condition has no ratio');
  const size = (params.size_ratios[target.size ?? ''] ?? 1) / (params.size_ratios[comp.size ?? ''] ?? 1);
  const time = Math.max(params.time_factor_min, Math.min(params.time_factor_max, Math.exp(timeIndex(comp.sold_at))));
  const offer = comp.kind === 'best_offer' ? 1 - params.d_offer_cat : 1;
  return Math.round(comp.price_cents * offer * destination / source * size * time);
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

export function trim<T extends AdjustedComp>(comps: readonly T[], params = DEFAULTS): { kept: T[]; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const adjusted = comps.filter(c => {
    const delta = Math.abs(Math.log(c.adjusted_cents / c.price_cents));
    if (c.adjusted_cents <= 0 || !Number.isFinite(delta) || delta > params.adjustment_cut + Number.EPSILON) {
      dropped.push({ comp_id: c.comp_id, reason: 'adjustment' });
      return false;
    }
    return true;
  });
  if (!adjusted.length) return { kept: [], dropped };
  const logs = adjusted.map(c => Math.log(c.adjusted_cents));
  const center = median([...logs]);
  const cap = params.outlier_k * median(logs.map(p => Math.abs(p - center)));
  const kept = adjusted.filter((c, i) => {
    if (Math.abs(logs[i] - center) <= cap) return true;
    dropped.push({ comp_id: c.comp_id, reason: 'outlier' });
    return false;
  });
  return { kept, dropped };
}

export function weightedQuantile(values_cents: readonly number[], weights: readonly number[], q: number, _params = DEFAULTS): number | null {
  if (values_cents.length !== weights.length || q < 0 || q > 1 || !Number.isFinite(q)) throw new RangeError('invalid weighted quantile');
  const rows = values_cents.map((value, i) => ({ value, w: weights[i] })).filter(c => c.w > 0).sort((a, b) => a.value - b.value);
  if (!rows.length) return null;
  const threshold = q * rows.reduce((sum, c) => sum + c.w, 0);
  let cumulative = 0;
  for (const row of rows) {
    cumulative += row.w;
    if (cumulative >= threshold) return row.value;
  }
  return rows[rows.length - 1].value;
}

export function translate(q_cents: number, ratio: number, _params = DEFAULTS): number {
  if (!Number.isFinite(ratio) || ratio <= 0) throw new RangeError('site ratio must be positive');
  return Math.round(q_cents * ratio);
}

function basis(comps: readonly (WeightedComp & AdjustedComp)[], params: Params) {
  let remaining = [...comps];
  const dropped: Dropped[] = [];
  for (;;) {
    const selected = backOff(remaining, params);
    const trimmed = trim(selected.comps, params);
    dropped.push(...trimmed.dropped);
    if (!trimmed.dropped.length) return { ...selected, dropped };
    const ids = new Set(trimmed.dropped.map(c => c.comp_id));
    remaining = remaining.filter(c => !ids.has(c.comp_id));
  }
}

export function comparables(target: Target, candidates: readonly Comp[], as_of: string, params = DEFAULTS) {
  const weighted = weigh(candidates, as_of, params).map(c => ({ ...c, adjusted_cents: adjust(c, target, params.timeIndex, params) }));
  let selected = basis(target.site ? weighted.filter(c => c.site === target.site) : weighted, params);
  let ratio: SiteRatio | undefined;
  if (target.site && !sufficient(selected.comps, params)) {
    const category = params.site_ratios[target.site];
    const parent = params.parent_site_ratios[target.site];
    ratio = category && category.n >= params.min_site_products ? category :
      parent && parent.n >= params.min_site_products ? parent : undefined;
    if (ratio) selected = basis(weighted, params);
  }
  const quantile = (q: number, factor: number) => {
    const value = weightedQuantile(selected.comps.map(c => c.adjusted_cents), selected.comps.map(c => c.w), q);
    return value === null ? null : Math.round(translate(value, factor) / 100) * 100;
  };
  return {
    comps: selected.comps, n_eff: selected.n_eff, level: selected.level,
    range: { q10: quantile(0.1, ratio?.q25 ?? 1), q50: quantile(0.5, ratio?.ratio ?? 1), q90: quantile(0.9, ratio?.q75 ?? 1) },
    dropped: selected.dropped,
    state: sufficient(selected.comps, params) ? 'ok' as const : 'too_few' as const,
  };
}
