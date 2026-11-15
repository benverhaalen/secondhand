import type { Declared, ParamStore, Scope } from '../param/param.ts';

const D1 = 'spec/determinations/money.md#d1-comparable-set-and-weights';
const D2 = 'spec/determinations/money.md#d2-condition-variant-completeness-and-size-adjustment';
const D3 = 'spec/determinations/money.md#d3-time-adjustment';
const D4 = 'spec/determinations/money.md#d4-translation-between-sites';
const D6 = 'spec/determinations/money.md#d6-range-calibration-and-display-state';
const BLEND = 'spec/engines/valuation.md#3-the-calculation';
const LEARN = 'spec/engines/valuation.md#4-learning';

type Entry = Declared & { prior: number; scopes: (keyof Scope)[]; source: string; path: string };
const scalar = (path: string, prior: number, source: string, guard_lo = 0, guard_hi?: number): Entry => ({
  name: `valuation_${path.replaceAll('.', '_')}`, path, family: 'scalar', prior, guard_lo, guard_hi,
  scopes: ['kind', 'site', 'segment', 'person'], source,
});
export const DECLARED: readonly Entry[] = [
  ...Object.entries({ sold: 1, best_offer: .6, own_order: 1.2 }).map(([k, v]) => scalar(`w_type.${k}`, v, D1)),
  ...Object.entries({ variant: 1, product: .5, family: .25, category: 0 }).map(([k, v]) => scalar(`w_match.${k}`, v, D1)),
  ...Object.entries({ measured: 1, label: 1, structured: .9, inferred: .7 }).map(([k, v]) => scalar(`w_extract.${k}`, v, D1)),
  scalar('half_life_days.default', 90, D1, Number.MIN_VALUE), scalar('half_life_days.fast', 30, D1, Number.MIN_VALUE),
  scalar('max_age_days', 365, D1), scalar('recent_days', 90, D1), scalar('min_recent', 2, D1), scalar('min_n_eff', 6, D1),
  scalar('outlier_k', 3 * 1.4826, D1), scalar('adjustment_cut', Math.log(1.25), D1, Number.MIN_VALUE),
  scalar('d_offer_cat', 0, D1, 0, 1 - Number.EPSILON),
  ...Object.entries({ new_with_tags: 1.35, new_without_tags: 1.2, excellent: 1.1, good: 1, fair: .75, for_parts: .35 }).map(([k, v]) => scalar(`condition_ratios.${k}`, v, D2, Number.MIN_VALUE)),
  ...Object.entries({ box_missing: .9, accessory_missing: .85 }).map(([k, v]) => scalar(`completeness_ratios.${k}`, v, D2, Number.MIN_VALUE)),
  ...Object.entries({ verified: 1, said: .92, unknown: .8, 'not working': .35 }).map(([k, v]) => scalar(`works_ratios.${k}`, v, D2, Number.MIN_VALUE)),
  scalar('shrinkage_k', 50, D2), scalar('min_parent_rows', 30, D2),
  scalar('time_factor_min', .8, D3, Number.MIN_VALUE), scalar('time_factor_max', 1.25, D3, Number.MIN_VALUE),
  scalar('min_site_products', 20, D4),
  scalar('anchor_enabled', 1, BLEND, 0, 1), scalar('anchor_k', 5, 'jobs/valuation/market.py#ANCHOR_K', 1),
  scalar('anchor_blend_k', 6, BLEND), scalar('index_enabled', 1, LEARN, 0, 1), scalar('index_half_life_days', 30, LEARN, Number.MIN_VALUE),
  scalar('size_enabled', 1, LEARN, 0, 1), scalar('size_shrinkage_k', 20, LEARN),
  scalar('age_enabled', 1, D1, 0, 1), scalar('blend_enabled', 1, BLEND, 0, 1), scalar('blend_k', 6, BLEND),
  scalar('dedupe_enabled', 1, 'spec/plans/sweep/data-science.md#ranked-improvements', 0, 1),
  // Agent proposal: until the prior spread is fitted, reuse D1's stated gross spread, never an invented retail middle.
  scalar('prior_log_spread', Math.log(1.25), BLEND),
  scalar('coverage_min', .75, D6, 0, 1), scalar('coverage_max', .85, D6, 0, 1),
  scalar('checked_min_n', 30, D6), scalar('checked_wilson_min', .7, D6, 0, 1),
  scalar('curve_min_events', 30, 'spec/determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price'),
  scalar('curve_max_error', .05, 'spec/determinations/money.md#d10-chance-of-sale-within-a-period-at-a-price', 0, 1),
  scalar('hot_days', 1, 'spec/determinations/money.md#d12-best-site-or-set-of-sites'),
  scalar('budget_ms', 10000, 'spec/engines/valuation.md#5-speed', 1),
];
export type Resolved = { values: Record<string, number>; versions: Record<string, number> };
export function resolve(store: ParamStore | undefined, scope: Scope = {}): Resolved {
  const values: Record<string, number> = {}, versions: Record<string, number> = {};
  for (const entry of DECLARED) {
    store?.declare(entry);
    const read = store?.read(entry.name, scope) ?? { value: entry.prior, version: 0 };
    if (typeof read.value !== 'number' || !Number.isFinite(read.value) || read.value < (entry.guard_lo ?? -Infinity) || read.value > (entry.guard_hi ?? Infinity)) throw new RangeError(entry.name);
    values[entry.name] = read.value; versions[entry.name] = read.version;
  }
  return { values, versions };
}
export function required(resolved: Resolved, path: string): number {
  const name = `valuation_${path.replaceAll('.', '_')}`;
  const value = resolved.values[name];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError(`missing ${name}`);
  return value;
}
