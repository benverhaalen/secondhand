import { canonical, DEFAULTS, money, type BasisLevel, type Comp } from './comps.ts';
import { forget, FORGET_DAYS, type Declared, type ParamStore } from '../param/param.ts';

// spec/engines/valuation.md §9. Move to params.ts when that file is free.
export const MARKET_SCORE_CHECKED_MIN_N: Declared = { name: 'market_score_checked_min_n', family: 'scalar', prior: 30, guard_lo: 1 };
export const MARKET_SCORE_HALF_LIFE_DAYS: Declared = { name: 'market_score_half_life_days', family: 'scalar', prior: 30, guard_lo: Number.MIN_VALUE };

export type Market = { site: string; kind: string };
export type Frozen = { q10: number | null; q50: number | null; q90: number | null; basis_level: BasisLevel; citation: string };
export type Sale = Market & { comp_id: string; cluster_id?: string; sold_at: string | null; price_cents: number };
export type Baselines = { last_sale_cents?: number; median_90d_cents?: number };
type Baseline = 'last_sale' | 'median_90d';
type ErrorScore = { absolute_pct_error: number; within_20: boolean };
export type ScoredEvent = Sale & {
  frozen: Frozen; priced: boolean; absolute_pct_error: number | null; within_20: boolean | null;
  coverage: boolean | null; width: number | null; baselines: Partial<Record<Baseline, ErrorScore>>;
  state: 'scored' | 'unscored_no_sale_date';
};
export type Interval = [number, number];
export type Figure = { value: number | null; n: number; n_eff: number; interval_95: Interval | null };
export type Score = {
  n: number; n_eff: number; unscored_no_sale_date: number;
  priced_share: Figure; within_20: Figure; median_pct_off: Figure; coverage: Figure & { stated: 0.8 };
  median_range_width: Figure; vs_last_sale: Figure; vs_median_90d: Figure;
  newest_event_time: string | null; state: 'checked' | 'not_checked_yet';
};

function positiveMoney(value: number, field: string): void {
  money(value, field);
  if (value === 0) throw new RangeError(`invalid ${field}`);
}
function time(value: string, field: string): number {
  const out = Date.parse(value);
  if (!Number.isFinite(out)) throw new RangeError(`invalid ${field}`);
  return out;
}
function errorScore(estimate: number, truth: number): ErrorScore {
  const absolute_pct_error = Math.abs(estimate - truth) / truth;
  return { absolute_pct_error, within_20: absolute_pct_error <= 0.2 };
}

/** Ratios, not percentage points. experiment._metrics wins over §9's ambiguous within-20 wording:
 * the denominator is the sale price. Both interval endpoints and the 20% boundary are inclusive.
 * A null range is experiment's shown=false; numeric ranges are scored even at zero width. */
export function scoreEvent(frozen: Frozen, sale: Sale, baselines: Baselines): ScoredEvent {
  positiveMoney(sale.price_cents, 'price_cents');
  if (sale.sold_at !== null) time(sale.sold_at, 'sold_at');
  const values = [frozen.q10, frozen.q50, frozen.q90];
  if (!values.every(v => v === null) && !values.every(v => v !== null)) throw new RangeError('partial range');
  const priced = frozen.q50 !== null;
  if (priced) {
    values.forEach(v => money(v!, 'range'));
    positiveMoney(frozen.q50!, 'range');
    if (frozen.q10! > frozen.q50! || frozen.q50! > frozen.q90!) throw new RangeError('unordered range');
  }
  const baselineScores: Partial<Record<Baseline, ErrorScore>> = {};
  for (const name of ['last_sale', 'median_90d'] as const) {
    const value = baselines[`${name}_cents`];
    if (value === undefined) continue;
    positiveMoney(value, name);
    baselineScores[name] = errorScore(value, sale.price_cents);
  }
  const scored = sale.sold_at !== null;
  const error = scored && priced ? errorScore(frozen.q50!, sale.price_cents) : null;
  return {
    ...sale, frozen: { ...frozen }, priced: scored && priced,
    absolute_pct_error: error?.absolute_pct_error ?? null, within_20: error?.within_20 ?? null,
    coverage: scored && priced ? frozen.q10! <= sale.price_cents && sale.price_cents <= frozen.q90! : null,
    width: scored && priced ? (frozen.q90! - frozen.q10!) / frozen.q50! : null,
    baselines: scored ? baselineScores : {}, state: scored ? 'scored' : 'unscored_no_sale_date',
  };
}

/** Switch F owns the cluster key inside canonical(), rather than exporting a second key helper.
 * Probe that same deduper with two eligible rows so a change to its key also changes this guard. */
export function freezeBasis<T extends Omit<Comp, 'sold_at'> & { sold_at: string | null }>(rows: readonly T[], sale: Sale): { rows: T[]; unscored_no_sale_date: number } {
  const unscored_no_sale_date = rows.filter(r => r.sold_at === null).length;
  if (sale.sold_at === null) return { rows: [], unscored_no_sale_date: Math.max(1, unscored_no_sale_date) };
  const cut = time(sale.sold_at, 'sold_at');
  // The cluster can be supplied with the event or recovered from its own observation.
  const cluster_id = sale.cluster_id ?? rows.find(r => r.comp_id === sale.comp_id)?.cluster_id;
  const params = { ...DEFAULTS, dedupe_enabled: 1 };
  return { unscored_no_sale_date, rows: rows.filter(row => {
    if (row.sold_at === null || row.comp_id === sale.comp_id) return false;
    if (time(row.sold_at, 'sold_at') >= cut) return false;
    if (row.observed_at !== undefined && time(row.observed_at, 'observed_at') > cut) return false;
    const comp: Comp = { ...row, sold_at: row.sold_at };
    return canonical([comp, { ...comp, comp_id: sale.comp_id, cluster_id }], sale.sold_at!, params).length === 2;
  }) };
}

/** Matches experiment._wilson (z=1.96). Fractional n is decayed evidence mass, like forget(). */
export function wilson(hits: number, n: number): Interval | null {
  if (n === 0) return null;
  const z2 = 1.96 ** 2, p = hits / n, denom = n + z2;
  const center = (hits + z2 / 2) / denom;
  const half = 1.96 * Math.sqrt(hits * (1 - p) + z2 / 4) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

type Weighted = { value: number; weight: number };
const mass = (values: readonly Weighted[]) => values.reduce((sum, v) => sum + v.weight, 0);
const total = (values: readonly Weighted[]) => values.reduce((sum, v) => sum + v.value * v.weight, 0);
function median(values: readonly Weighted[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a.value - b.value), half = mass(sorted) / 2;
  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i].weight;
    if (i + 1 < sorted.length && Math.abs(cumulative - half) <= Number.EPSILON * half * 8) return (sorted[i].value + sorted[i + 1].value) / 2;
    if (cumulative > half) return sorted[i].value;
  }
  return sorted[sorted.length - 1].value;
}
function figure(values: readonly Weighted[], kind: 'rate' | 'median' | 'paired'): Figure {
  const n_eff = mass(values), n = values.length;
  if (!n_eff) return { value: null, n, n_eff, interval_95: null };
  const value = kind === 'median' ? median(values)! : total(values) / n_eff;
  let interval_95: Interval | null = null;
  if (kind === 'rate') interval_95 = wilson(total(values), n_eff);
  if (kind === 'paired' && n > 1) {
    const sumWeight2 = values.reduce((sum, v) => sum + v.weight ** 2, 0);
    const denominator = n_eff - sumWeight2 / n_eff;
    if (denominator > Number.EPSILON * n_eff) {
      const variance = values.reduce((sum, v) => sum + v.weight * (v.value - value) ** 2, 0) / denominator;
      const half = 1.96 * Math.sqrt(variance / n_eff);
      interval_95 = [Math.max(-1, value - half), Math.min(1, value + half)];
    }
  }
  return { value, n, n_eff, interval_95 };
}

export class MarketScore {
  // Exact stream medians retain O(n) event values and ids, then sort O(n log n) per read.
  // Shortcut for this in-memory scorer: upgrade to a quantile sketch/window when retained events
  // exceed the serving process's memory budget; that changes the exact parity contract deliberately.
  private events = new Map<string, ScoredEvent>();
  private scope: Market | undefined;
  private half_life_days: number;
  private checked_min_n: number;

  constructor(scope?: Market, store?: ParamStore) {
    this.scope = scope && { ...scope };
    const resolve = (declared: Declared): number => {
      store?.declare(declared);
      const value = store ? store.read(declared.name, scope ?? {}).value : declared.prior;
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new RangeError(`invalid ${declared.name}`);
      return value;
    };
    this.half_life_days = resolve(MARKET_SCORE_HALF_LIFE_DAYS);
    this.checked_min_n = resolve(MARKET_SCORE_CHECKED_MIN_N);
  }

  add(event: ScoredEvent): void {
    if (this.scope && (event.site !== this.scope.site || event.kind !== this.scope.kind)) throw new RangeError('event belongs to another market');
    if (this.events.has(event.comp_id)) return;
    this.events.set(event.comp_id, structuredClone(event));
  }

  read(as_of?: string): Score & { decayed: Score } {
    const all = [...this.events.values()], scored = all.filter(e => e.state === 'scored');
    const newest = scored.reduce<string | null>((latest, e) => latest === null || time(e.sold_at!, 'sold_at') > time(latest, 'sold_at') ? e.sold_at : latest, null);
    const cut = as_of === undefined ? (newest === null ? 0 : time(newest, 'as_of')) : time(as_of, 'as_of');
    if (scored.some(e => time(e.sold_at!, 'sold_at') > cut)) throw new RangeError('as_of precedes an accumulated sale');
    const summarize = (decayed: boolean): Score => {
      const events = scored.map(event => ({ event, weight: decayed ? forget((cut - time(event.sold_at!, 'sold_at')) / 86_400_000 * FORGET_DAYS / this.half_life_days) : 1 })).filter(e => e.weight > 0);
      const priced = events.filter(e => e.event.priced);
      const values = (get: (event: ScoredEvent) => number): Weighted[] => priced.map(e => ({ value: get(e.event), weight: e.weight }));
      const within_20 = figure(values(e => Number(e.within_20)), 'rate');
      const coverage = { ...figure(values(e => Number(e.coverage)), 'rate'), stated: 0.8 as const };
      const paired = (name: Baseline): Figure => figure(priced.filter(e => e.event.baselines[name] !== undefined).map(e => ({ value: Number(e.event.within_20) - Number(e.event.baselines[name]!.within_20), weight: e.weight })), 'paired');
      return {
        n: scored.length, n_eff: events.reduce((sum, e) => sum + e.weight, 0),
        unscored_no_sale_date: all.length - scored.length,
        priced_share: figure(events.map(e => ({ value: Number(e.event.priced), weight: e.weight })), 'rate'),
        within_20, median_pct_off: figure(values(e => e.absolute_pct_error!), 'median'), coverage,
        median_range_width: figure(values(e => e.width!), 'median'),
        vs_last_sale: paired('last_sale'), vs_median_90d: paired('median_90d'), newest_event_time: newest,
        state: scored.length >= this.checked_min_n && within_20.interval_95 !== null && coverage.interval_95 !== null ? 'checked' : 'not_checked_yet',
      };
    };
    return { ...summarize(false), decayed: summarize(true) };
  }

  /** experiment.py's four-decimal reporting adapter. read() retains full precision. */
  parity(): Record<string, unknown> {
    const score = this.read();
    const round = (v: number | null) => v === null ? null : Math.round(v * 10000) / 10000;
    const interval = (v: Interval | null) => v?.map(round) ?? null;
    return {
      n: score.n, priced: score.within_20.n, hit_rate: round(score.priced_share.value),
      within_20: round(score.within_20.value), within_20_wilson_95: interval(score.within_20.interval_95),
      median_pct_off: round(score.median_pct_off.value), coverage: round(score.coverage.value),
      coverage_wilson_95: interval(score.coverage.interval_95), median_range_width: round(score.median_range_width.value),
      ...Object.fromEntries((['last_sale', 'median_90d'] as const).map(name => {
        const gap = score[`vs_${name}`];
        return [`vs_${name}`, { n: gap.n, diff: round(gap.value), interval_95: interval(gap.interval_95) }];
      })),
    };
  }
}
