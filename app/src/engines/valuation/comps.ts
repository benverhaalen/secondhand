import { DECLARED, resolve, required, type Resolved } from './params.ts';
import type { ParamStore, Scope } from '../param/param.ts';
/**
 * Reads extracted sold comps, target condition/size/site, as_of and overridable priors.
 * D1: reject non-sales and stale rows; multiply type, match, age and extraction weights.
 * Add variant, product, family, category levels until the sold basis is sufficient.
 * D2/D3: multiply condition and fitted size ratios by capped exponential log drift.
 * D1: reject comps whose gross adjustment (sum of absolute log factors) is excessive,
 * weight the rest by 1 / (1 + gross), flag an extrapolated set, then trim by median/MAD of log prices.
 * D5: take cumulative-weight quantiles; D4 translates a thin site's pooled basis
 * only with supported ratios, widening endpoints before whole-dollar rounding.
 * Everything here is deterministic arithmetic; may_model never filters cited sales.
 */

export type Comp = {
  comp_id: string;
  product_id?: string; family_id?: string; cluster_id?: string; observed_at?: string;
  completeness?: string[]; works?: string; extraction_source?: string;
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
  anchor_enabled: number; anchor_k: number; anchor_blend_k: number;
  index_enabled: number; index_half_life_days: number; size_enabled: number; size_shrinkage_k: number;
  age_enabled: number; family_half_life_days: Record<string, number>;
  blend_enabled: number; blend_k: number; dedupe_enabled: number; prior_log_spread: number;
  works_ratios: Record<string, number>; param_versions: Record<string, number>;
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

function assertParams(x: Record<string, unknown>): asserts x is Params {
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const numbers = (value: unknown): value is Record<string, number> => typeof value === 'object' && value !== null &&
    !Array.isArray(value) && Object.values(value).every(finite);
  const table = (...keys: string[]) => (value: unknown) => numbers(value) && keys.every(key => Object.hasOwn(value, key));
  const ratios = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.entries(value).every(([site, row]) => ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'].includes(site) &&
      table('ratio', 'q25', 'q75', 'n')(row));
  const checks: Record<keyof Params, (value: unknown) => boolean> = {
    anchor_enabled: finite, anchor_k: finite, anchor_blend_k: finite,
    index_enabled: finite, index_half_life_days: finite, size_enabled: finite, size_shrinkage_k: finite,
    age_enabled: finite, family_half_life_days: numbers,
    blend_enabled: finite, blend_k: finite, dedupe_enabled: finite, prior_log_spread: finite,
    works_ratios: numbers, param_versions: numbers,
    w_type: table('sold', 'best_offer', 'own_order'), w_match: table('variant', 'product', 'family', 'category'),
    w_extract: numbers, half_life_days: table('default', 'fast'), category_speed: value => value === 'default' || value === 'fast',
    max_age_days: finite, recent_days: finite, min_recent: finite, min_n_eff: finite,
    outlier_k: finite, adjustment_cut: finite, d_offer_cat: finite,
    condition_ratios: numbers, completeness_ratios: numbers, size_ratios: numbers,
    shrinkage_k: finite, min_parent_rows: finite, time_factor_min: finite, time_factor_max: finite,
    timeIndex: value => typeof value === 'function', site_ratios: ratios, parent_site_ratios: ratios, min_site_products: finite,
  };
  for (const [key, valid] of Object.entries(checks)) if (!Object.hasOwn(x, key) || !valid(x[key])) throw new RangeError(`invalid or missing ${key}`);
}

export function fromResolved(resolved: Resolved): Params {
  const root: Record<string, number | Record<string, number>> = {};
  for (const entry of DECLARED) {
    const [key, child] = entry.path.split('.');
    const value = required(resolved, entry.path);
    if (child) {
      const table = root[key] as Record<string, number> | undefined;
      root[key] = { ...table, [child]: value };
    } else root[key] = value;
  }
  const params = { ...root, category_speed: 'default', size_ratios: {}, family_half_life_days: {},
    timeIndex: () => 0, site_ratios: {}, parent_site_ratios: {}, param_versions: resolved.versions };
  assertParams(params);
  return params;
}
export const DEFAULTS = fromResolved(resolve(undefined));
export const LEGACY: Params = { ...DEFAULTS, anchor_enabled: 0, index_enabled: 0, size_enabled: 0,
  age_enabled: 0, blend_enabled: 0, dedupe_enabled: 0 };
export function parameters(store?: ParamStore, scope: Scope = {}): Params { return fromResolved(resolve(store, scope)); }
export function money(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be nonnegative safe integer cents`);
  return value;
}
const DAY = 86_400_000; // Fixed milliseconds per day.
const DOLLAR = 100; // Fixed cents per dollar.
export type BasisLevel = 'variant' | 'product' | 'family' | 'kind' | 'prior';

export type WeightedComp = Comp & { w: number; w_type: number; w_age: number; age_days: number };
type AdjustedComp = Comp & { adjusted_cents: number; gross?: number; net?: number };
type Dropped = { comp_id: string; reason: 'adjustment' | 'outlier' };
export type Target = { kind_band?: { q10: number; q50: number; q90: number; n_eff: number }; condition: string; size?: string; site?: Comp['site']; product_id?: string; family_id?: string; kind?: string; retail_cents?: number; depreciation?: number; completeness?: string[]; works?: string };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const stableComp = (c: Comp) => JSON.stringify(Object.entries(c).sort(([a], [b]) => compare(a, b)));
const levels: Comp['level'][] = ['variant', 'product', 'family', 'category'];

export function weigh(comps: readonly Comp[], as_of: string, params = DEFAULTS): WeightedComp[] {
  const now = Date.parse(as_of);
  if (!Number.isFinite(now)) throw new RangeError('as_of must be an ISO date');
  const seen = new Set<string>();
  const result: WeightedComp[] = [];
  for (const comp of canonical(comps, as_of, params)) {
    money(comp.price_cents, 'price_cents');
    if (!Object.hasOwn(params.w_type, comp.kind)) continue;
    const age_days = (now - Date.parse(comp.sold_at)) / DAY;
    if (!Number.isFinite(age_days) || age_days < 0 || age_days > params.max_age_days) continue;
    if (comp.price_cents === 0) continue;
    const w_type = params.w_type[comp.kind];
    const half = params.age_enabled ? params.family_half_life_days[comp.family_id ?? ''] ?? params.half_life_days[params.category_speed] : params.half_life_days[params.category_speed];
    if (!(half > 0) || !Number.isFinite(half)) throw new RangeError('half_life_days');
    const w_age = 0.5 ** (age_days / half);
    const priorMatch = DEFAULTS.w_match[comp.level];
    const match = priorMatch > 0 ? comp.w_match * params.w_match[comp.level] / priorMatch : comp.w_match;
    const extraction = comp.extraction_source ? params.w_extract[comp.extraction_source] : comp.w_extract;
    if (![match, extraction].every(v => Number.isFinite(v) && v >= 0)) throw new RangeError('comp weight');
    const w = w_type * match * w_age * extraction;
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

/**
 * D2/D3 adjustments with their sizes. `gross` sums each adjustment's absolute log factor, the appraiser's
 * gross adjustment. `net` is the signed sum of the D2 (feature) factors only (positive: the comp was worse than
 * this item and moved up); the D3 time factor moves every comp alike, so it would fake bracketing.
 * The Best Offer correction fixes what the comp sold for, not how it differs, so it counts in neither.
 */
export function adjustDetail(comp: Comp, target: Target, timeIndex: (sold_at: string) => number, params = DEFAULTS) {
  money(comp.price_cents, 'price_cents');
  const source = params.condition_ratios[comp.works === 'not working' ? 'for_parts' : comp.condition];
  const destination = params.condition_ratios[target.works === 'not working' ? 'for_parts' : target.condition];
  if (!(source > 0) || !(destination > 0)) throw new RangeError('condition has no ratio');
  const condition = destination / source;
  const sizes = [params.size_ratios[target.size ?? ''], params.size_ratios[comp.size ?? '']];
  // A size known on one side only is not a difference we can price; adjusting it would also cost the comp weight.
  const size = sizes[0] > 0 && sizes[1] > 0 ? sizes[0] / sizes[1] : 1;
  const time = Math.max(params.time_factor_min, Math.min(params.time_factor_max, Math.exp(timeIndex(comp.sold_at))));
  const offer = comp.kind === 'best_offer' ? 1 - params.d_offer_cat : 1;
  const completeness = (flags: string[]) => flags.reduce((v, key) => {
    const ratio = params.completeness_ratios[key];
    if (!(ratio > 0)) throw new RangeError(`completeness ${key}`);
    return v * ratio;
  }, 1);
  const complete = comp.completeness && target.completeness ? completeness(target.completeness) / completeness(comp.completeness) : 1;
  const works = (value: string) => {
    const ratio = value === 'not working' ? 1 : params.works_ratios[value];
    if (!(ratio > 0)) throw new RangeError(`works ${value}`);
    return ratio;
  };
  const functionRatio = comp.works && target.works ? works(target.works) / works(comp.works) : 1;
  const features = [condition, size, complete, functionRatio].map(Math.log);
  return {
    adjusted_cents: money(Math.round(comp.price_cents * offer * condition * size * complete * functionRatio * time), 'adjusted_cents'),
    gross: [...features, Math.log(time)].reduce((sum, l) => sum + Math.abs(l), 0),
    net: features.reduce((sum, l) => sum + l, 0),
  };
}

export function adjust(comp: Comp, target: Target, timeIndex: (sold_at: string) => number, params = DEFAULTS): number {
  return adjustDetail(comp, target, timeIndex, params).adjusted_cents;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

export function trim<T extends AdjustedComp>(comps: readonly T[], params = DEFAULTS): { kept: T[]; dropped: Dropped[] } {
  const dropped: Dropped[] = [];
  const adjusted = comps.filter(c => {
    const delta = c.gross ?? Math.abs(Math.log(c.adjusted_cents / c.price_cents));
    if (c.adjusted_cents <= 0 || !Number.isFinite(delta) || delta > params.adjustment_cut + Number.EPSILON) {
      dropped.push({ comp_id: c.comp_id, reason: 'adjustment' });
      return false;
    }
    return true;
  });
  if (!adjusted.length) return { kept: [], dropped };
  const logs = adjusted.map(c => Math.log(c.adjusted_cents));
  const center = median([...logs]);
  // With MAD 0 (most comps at one price) the cut would drop every other price; the adjustment cut is the least width.
  const cap = Math.max(params.outlier_k * median(logs.map(p => Math.abs(p - center))), params.adjustment_cut);
  const kept = adjusted.filter((c, i) => {
    if (Math.abs(logs[i] - center) <= cap) return true;
    dropped.push({ comp_id: c.comp_id, reason: 'outlier' });
    return false;
  });
  return { kept, dropped };
}

export function weightedQuantile(values_cents: readonly number[], weights: readonly number[], q: number, _params = DEFAULTS): number | null {
  if (values_cents.length !== weights.length || q < 0 || q > 1 || !Number.isFinite(q)) throw new RangeError('invalid weighted quantile');
  values_cents.forEach(v => money(v, 'values_cents'));
  if (weights.some(w => !Number.isFinite(w) || w < 0)) throw new RangeError('weight must be finite and nonnegative');
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
  money(q_cents, 'q_cents');
  if (!Number.isFinite(ratio) || ratio <= 0) throw new RangeError('site ratio must be positive');
  return money(Math.round(q_cents * ratio), 'translated_cents');
}

function basis<T extends WeightedComp & AdjustedComp>(comps: readonly T[], params: Params) {
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

/** D1 bracketing: 'up' when every comp had to be adjusted up (all worse than this item), 'down' when all down. */
export function extrapolated(comps: readonly { net?: number }[]): 'up' | 'down' | null {
  if (!comps.length) return null;
  if (comps.every(c => (c.net ?? 0) > 1e-9)) return 'up';
  if (comps.every(c => (c.net ?? 0) < -1e-9)) return 'down';
  return null;
}

function legacyComparables(target: Target, candidates: readonly Comp[], as_of: string, params = DEFAULTS) {
  const weighted = weigh(candidates, as_of, params).map(c => {
    const detail = adjustDetail(c, target, params.timeIndex, params);
    // D1 w_adj: 1 for an exact match, 0.5 at the gross cap.
    return { ...c, ...detail, w: c.w / (1 + detail.gross / params.adjustment_cut) };
  });
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
    basis_level: (selected.comps[0]?.level === 'category' ? 'kind' : selected.comps[0]?.level ?? 'prior') as BasisLevel,
    range: { q10: quantile(0.1, ratio?.q25 ?? 1), q50: quantile(0.5, ratio?.ratio ?? 1), q90: quantile(0.9, ratio?.q75 ?? 1) },
    dropped: selected.dropped,
    extrapolated: extrapolated(selected.comps),
    state: sufficient(selected.comps, params) ? 'ok' as const : 'too_few' as const,
  };
}

/** Canonical snapshot: sold evidence first, then newest observation, then stable identifiers and values. */
export function canonical(comps: readonly Comp[], as_of: string, params = DEFAULTS): Comp[] {
  comps.forEach(c => money(c.price_cents, 'price_cents'));
  const now = Date.parse(as_of);
  const order = (a: Comp, b: Comp) => {
    const sold = (c: Comp) => Object.hasOwn(params.w_type, c.kind) ? 1 : 0;
    return sold(b) - sold(a) || Date.parse(b.observed_at ?? b.sold_at) - Date.parse(a.observed_at ?? a.sold_at) ||
      compare(a.comp_id, b.comp_id) || a.price_cents - b.price_cents || compare(a.site, b.site) || compare(stableComp(a), stableComp(b));
  };
  const seen = new Set<string>();
  return comps.filter(c => Date.parse(c.sold_at) <= now).slice().sort(order).filter(c => {
    const key = params.dedupe_enabled && c.cluster_id ? `cluster:${c.cluster_id}` : `comp:${c.comp_id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => Date.parse(a.sold_at) - Date.parse(b.sold_at) || compare(a.comp_id, b.comp_id));
}

/** D3: past-only family residual index. Equal-time sales all use the history before that time. */
export function fitHistory(candidates: readonly Comp[], as_of: string, params = DEFAULTS) {
  const rows = canonical(candidates, as_of, params).filter(c => c.may_model && c.product_id && c.family_id &&
    Object.hasOwn(params.w_type, c.kind) && c.price_cents > 0 && Date.parse(c.sold_at) < Date.parse(as_of));
  rows.forEach(c => money(c.price_cents, 'price_cents'));
  const products = new Map<string, Comp[]>();
  const indices = new Map<string, { at: number; value: number }[]>();
  const sums = new Map<string, { at: number; sum: number; weight: number }>();
  for (let i = 0; i < rows.length;) {
    let end = i + 1;
    const at = Date.parse(rows[i].sold_at);
    while (end < rows.length && Date.parse(rows[end].sold_at) === at) end++;
    const batch = new Map<string, number[]>();
    for (const c of rows.slice(i, end)) {
      const previous = (products.get(c.product_id!) ?? []).filter(r => at - Date.parse(r.sold_at) <= params.recent_days * DAY);
      products.set(c.product_id!, previous);
      if (previous.length) {
        const residual = Math.log(c.price_cents / median(previous.map(r => r.price_cents)));
        const values = batch.get(c.family_id!) ?? []; values.push(residual); batch.set(c.family_id!, values);
      }
    }
    for (const [family, residuals] of batch) {
      const old = sums.get(family), decay = old ? .5 ** ((at - old.at) / DAY / params.index_half_life_days) : 0;
      const sum = (old?.sum ?? 0) * decay + residuals.reduce((a, b) => a + b, 0);
      const weight = (old?.weight ?? 0) * decay + residuals.length;
      sums.set(family, { at, sum, weight });
      const values = indices.get(family) ?? []; values.push({ at, value: sum / weight }); indices.set(family, values);
    }
    for (const c of rows.slice(i, end)) { const prior = products.get(c.product_id!) ?? []; prior.push(c); products.set(c.product_id!, prior); }
    i = end;
  }
  const weeks = new Map<string, Comp[]>();
  // Fixed seven-day UTC buckets, epoch aligned. Both languages use the same week origin.
  for (const c of rows) { const key = `${c.family_id}|${Math.floor(Date.parse(c.sold_at) / DAY / 7)}`; const group = weeks.get(key) ?? []; group.push(c); weeks.set(key, group); }
  const sizes = new Map<string, Map<string, number[]>>();
  for (const group of weeks.values()) {
    const center = median(group.map(c => c.price_cents));
    for (const c of group) if (c.size) {
      const family = sizes.get(c.family_id!) ?? new Map<string, number[]>();
      const ratios = family.get(c.size) ?? []; ratios.push(Math.log(c.price_cents / center)); family.set(c.size, ratios); sizes.set(c.family_id!, family);
    }
  }
  const size_ratios: Record<string, Record<string, number>> = {};
  for (const [family, values] of sizes) {
    size_ratios[family] = {};
    for (const [size, ratios] of values) size_ratios[family][size] = Math.exp(median(ratios) * ratios.length / (ratios.length + params.size_shrinkage_k));
  }
  const index = (family: string, at: string) => {
    const values = indices.get(family) ?? [], time = Date.parse(at);
    let lo = 0, hi = values.length;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (values[mid].at < time) lo = mid + 1; else hi = mid; }
    return lo ? values[lo - 1].value : 0;
  };
  return { index, size_ratios };
}

export function comparables(target: Target, candidates: readonly Comp[], as_of: string, params = DEFAULTS) {
  if (target.retail_cents !== undefined) money(target.retail_cents, 'retail_cents');
  if (target.depreciation !== undefined && (!(target.depreciation > 0) || target.depreciation > 1)) throw new RangeError('depreciation');
  const fitted = params.index_enabled || params.size_enabled ? fitHistory(candidates, as_of, params) : null;
  const family = target.family_id ?? candidates.find(c => c.level === 'variant' || c.level === 'product')?.family_id ?? '';
  const p: Params = { ...params, size_ratios: params.size_enabled ? { ...params.size_ratios, ...fitted?.size_ratios[family] } : params.size_ratios,
    timeIndex: params.index_enabled && family && fitted ? at => fitted.index(family, as_of) - fitted.index(family, at) : params.timeIndex };
  if (!params.blend_enabled && !params.anchor_enabled) return { ...legacyComparables(target, candidates, as_of, p), param_versions: p.param_versions };
  const weighted = weigh(candidates, as_of, p).map(c => {
    const detail = adjustDetail(c, target, p.timeIndex, p);
    return { ...c, ...detail, w: c.w / (1 + detail.gross / p.adjustment_cut) };
  });
  let pool = target.site ? weighted.filter(c => c.site === target.site) : weighted;
  let ratio: SiteRatio | undefined;
  if (target.site && !sufficient(pool, p)) {
    const own = p.site_ratios[target.site], parent = p.parent_site_ratios[target.site];
    ratio = own && own.n >= p.min_site_products ? own : parent && parent.n >= p.min_site_products ? parent : undefined;
    // The named pooled parent answers even before there is evidence for a site premium.
    if (ratio || p.blend_enabled) pool = weighted;
  }
  let kept: typeof weighted = [], dropped: Dropped[] = [];
  let logRange: number[] | null = null, basis_level: BasisLevel = 'prior';
  if (p.blend_enabled && target.kind && target.retail_cents && target.depreciation) {
    const center = Math.log(target.retail_cents * target.depreciation);
    logRange = [center - p.prior_log_spread, center, center + p.prior_log_spread];
  }
  if (p.blend_enabled && target.kind_band) {
    const band = target.kind_band;
    [band.q10, band.q50, band.q90].forEach(v => money(v, 'kind_band_cents'));
    if (!(band.q10 > 0 && band.q10 <= band.q50 && band.q50 <= band.q90 && Number.isFinite(band.n_eff) && band.n_eff > 0)) throw new RangeError('kind_band');
    const logs = [band.q10, band.q50, band.q90].map(Math.log);
    logRange = logRange ? logs.map((v, i) => (band.n_eff * v + p.blend_k * logRange![i]) / (band.n_eff + p.blend_k)) : logs;
    basis_level = 'kind';
  }
  if (p.blend_enabled) {
    for (const level of [...levels].reverse()) {
      const local = trim(pool.filter(c => c.level === level), p);
      dropped.push(...local.dropped);
      if (!local.kept.length) continue;
      const n = nEff(local.kept.map(c => c.w));
      const logs = [.1, .5, .9].map(q => Math.log(weightedQuantile(local.kept.map(c => c.adjusted_cents), local.kept.map(c => c.w), q)!));
      logRange = logRange ? logs.map((v, i) => (n * v + p.blend_k * logRange![i]) / (n + p.blend_k)) : logs;
      basis_level = level === 'category' ? 'kind' : level;
      kept.push(...local.kept);
    }
  } else {
    const selected = basis(pool, p); kept = selected.comps; dropped = selected.dropped;
    basis_level = selected.comps[0]?.level === 'category' ? 'kind' : selected.comps[0]?.level ?? 'prior';
    if (kept.length) logRange = [.1, .5, .9].map(q => Math.log(weightedQuantile(kept.map(c => c.adjusted_cents), kept.map(c => c.w), q)!));
  }
  if (p.anchor_enabled && logRange) {
    const anchor = kept.filter(c => c.level === 'variant' && c.age_days <= p.recent_days && c.age_days > 0)
      .sort((a, b) => Date.parse(b.sold_at) - Date.parse(a.sold_at) || compare(a.comp_id, b.comp_id)).slice(0, Math.floor(p.anchor_k));
    if (anchor.length) {
      const middle = median(anchor.map(c => Math.log(c.adjusted_cents)));
      const delta = anchor.length / (anchor.length + p.anchor_blend_k) * (middle - logRange[1]);
      logRange = logRange.map(v => v + delta); basis_level = 'variant';
    }
  }
  const quantile = (i: number, factor: number) => logRange ? money(Math.round(Math.exp(logRange[i]) * factor / DOLLAR) * DOLLAR, 'range_cents') : null;
  kept.sort((a, b) => Date.parse(a.sold_at) - Date.parse(b.sold_at) || compare(a.comp_id, b.comp_id));
  return { comps: kept, n_eff: kept.length ? nEff(kept.map(c => c.w)) : target.kind_band?.n_eff ?? 0, level: basis_level === 'kind' || basis_level === 'prior' ? 'category' as const : basis_level,
    basis_level, range: { q10: quantile(0, ratio?.q25 ?? 1), q50: quantile(1, ratio?.ratio ?? 1), q90: quantile(2, ratio?.q75 ?? 1) },
    dropped, extrapolated: extrapolated(kept), state: sufficient(kept, p) ? 'ok' as const : 'too_few' as const, param_versions: p.param_versions };
}
