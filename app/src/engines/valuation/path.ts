// The price path, money.md D12 to D15, in integer cents. Arithmetic only: the D10 curve comes in as a function
// (va-5 fits it), the keep from keep.ts, the endings from money/ending.ts.
// Operation: ladder from p10 to p90 of the site's adjusted comps in 5-point steps, on endings, scaled by drift;
// start = the rung that maximises P(sold within the plan's horizon) x keep; the plan walks down a rung after each
// rung's t50; E = sum of P(sale in step) x keep. floor = max(lowest rung reached, cost + profit, best non-sale route,
// the person's own floor); always_accept = the lowest rung keeping at least E, never under the floor.
import { DEFAULT_ENDING, roundToEnding, type EndingRule } from '../money/ending.ts';
import { keep, priceForKeep, type FeeSite, type Sale } from './keep.ts';

export type Objective = 'quick' | 'balanced' | 'max_return';
export type PlanChoice = 'sell' | 'fast' | 'best' | 'reserve' | 'check';

// D15: the plans differ only in horizon (and so in start rung).
export const HORIZON_DAYS: Record<Objective, number> = { quick: 7, balanced: 30, max_return: 90 };

// Packet 47 item 5: seller intent onto the objective. reserve builds no path; check is balanced and asks on every offer.
export function planOf(choice: PlanChoice): { objective: Objective; path: boolean; accept_mode: 'auto' | 'ask_all' } {
  if (choice === 'fast') return { objective: 'quick', path: true, accept_mode: 'auto' };
  if (choice === 'best') return { objective: 'max_return', path: true, accept_mode: 'auto' };
  if (choice === 'reserve') return { objective: 'max_return', path: false, accept_mode: 'auto' };
  if (choice === 'check') return { objective: 'balanced', path: true, accept_mode: 'ask_all' };
  return { objective: 'balanced', path: true, accept_mode: 'auto' };
}

// The D10 curve on one site: P(sold by `days` | price), and the day P reaches q (D11), null past 90 days.
export type Curve = { p: (price_cents: number, days: number) => number; t: (price_cents: number, q: number) => number | null };
export type Rung = { price: number; p_sale: number; keep: number; t50: number | null };

export function weightedPercentile(values: number[], weights: number[], q: number): number {
  const idx = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (const i of idx) { acc += weights[i]; if (acc >= q * total) return values[i]; }
  return values[idx[idx.length - 1]];
}

// D15 step 1. drift is the trend axis's 30-day log drift.
export function ladder(adjusted_cents: number[], weights: number[], ending: EndingRule = DEFAULT_ENDING, drift = 0): number[] {
  if (adjusted_cents.length === 0) return [];
  const out = new Set<number>();
  for (let q = 10; q <= 90; q += 5) {
    const r = roundToEnding(Math.round(weightedPercentile(adjusted_cents, weights, q / 100) * Math.exp(drift)), ending);
    if (r !== null) out.add(r);
  }
  return [...out].sort((a, b) => b - a);
}

export type PathInput = {
  site: FeeSite;
  rungs: number[]; // from ladder(), high to low
  curve: Curve;
  objective: Objective;
  sale?: Sale;
  q90_cents: number; // D5 high, the cap on the list price
  offer_discount?: number; // D13 d_s,cat, prior 0
  ending?: EndingRule;
  cost_cents?: number;
  target_profit_cents?: number;
  best_route_keep_cents?: number; // D19's best non-sale route
  person_floor_cents?: number; // limits.floor_cents
};

export type PricePath = { start: number; list: number; floor: number; always_accept: number; expected_keep: number; ladder: Rung[] };

const OFFER_NORM: FeeSite[] = ['ebay', 'poshmark', 'mercari'];

export function pricePath(x: PathInput): PricePath | null {
  if (x.rungs.length === 0) return null; // D13: no ladder, no suggested price; the person types one
  const T = HORIZON_DAYS[x.objective];
  const k = (p: number) => keep(x.site, p, x.sale).keep_cents;
  const rung = (p: number): Rung => ({ price: p, p_sale: x.curve.p(p, T), keep: k(p), t50: x.curve.t(p, 0.5) });
  const all = x.rungs.map(rung);

  const startAt = all.reduce((b, r, i) => (r.p_sale * r.keep > all[b].p_sale * all[b].keep ? i : b), 0);
  const steps = walk(all.slice(startAt), x.curve, T);
  const reached = steps.at(-1)?.price ?? all[startAt].price;
  const expected_keep = Math.round(steps.reduce((s, st) => s + st.p_in_step * k(st.price), 0));

  const floor = Math.max(
    reached,
    x.cost_cents !== undefined ? priceForKeep(x.site, x.cost_cents + (x.target_profit_cents ?? 0), x.sale) : 0,
    x.best_route_keep_cents !== undefined ? priceForKeep(x.site, x.best_route_keep_cents, x.sale) : 0,
    x.person_floor_cents ?? 0,
  );
  const atOrOver = all.filter(r => r.price >= floor && r.keep >= expected_keep).map(r => r.price);
  const always_accept = atOrOver.length ? Math.min(...atOrOver) : Math.max(floor, all[0].price);

  const start = Math.max(all[startAt].price, floor);
  const raw = OFFER_NORM.includes(x.site) ? start / (1 - (x.offer_discount ?? 0)) : start;
  const list = Math.max(floor, roundToEnding(Math.min(raw, x.q90_cents), x.ending) ?? start);
  return { start, list, floor, always_accept: Math.max(always_accept, floor), expected_keep, ladder: all };
}

// D15 steps 2 and 3: each rung holds for its t50, then the next; P(sale in step) carries the survival so far.
function walk(rungs: Rung[], curve: Curve, horizon: number): { price: number; p_in_step: number }[] {
  const out: { price: number; p_in_step: number }[] = [];
  let day = 0, survive = 1;
  for (const r of rungs) {
    if (day >= horizon) break;
    const hold = Math.min(r.t50 ?? horizon, horizon - day);
    const p = curve.p(r.price, hold);
    out.push({ price: r.price, p_in_step: survive * p });
    survive *= 1 - p;
    day += hold;
  }
  return out;
}

// D15 step 6: the step at an age. m is the plan's t50. Every step stays inside the floor; a step outside it asks.
export type StaleInput = {
  site: FeeSite; age_days: number; m_days: number; price_cents: number; p50_cents: number;
  interest: number; interest_median: number; next_rung_cents: number | null; floor_cents: number;
  plan_choice?: PlanChoice; on_sites: FeeSite[]; best_sites: FeeSite[]; has_watchers_verb: boolean;
};
export type StaleStep =
  | { kind: 'none' }
  | { kind: 'relist'; ask: boolean }
  | { kind: 'markdown'; price_cents: number }
  | { kind: 'offer_to_watchers' }
  | { kind: 'first_post'; site: FeeSite }
  | { kind: 'price_below_floor' }
  | { kind: 'end_unsold' };

export function staleStep(x: StaleInput): StaleStep {
  if (x.plan_choice === 'reserve' || x.plan_choice === 'check') return { kind: 'none' }; // D15 skips them; reserve never goes stale
  const m = x.m_days;
  const atFloor = x.next_rung_cents === null || x.next_rung_cents < x.floor_cents;
  if (x.age_days >= 3 * m || (x.age_days >= m && atFloor && x.price_cents <= x.floor_cents)) {
    return x.next_rung_cents !== null && x.next_rung_cents < x.floor_cents ? { kind: 'price_below_floor' } : { kind: 'end_unsold' };
  }
  if (x.age_days >= 2 * m) {
    const next = x.best_sites.find(s => !x.on_sites.includes(s));
    if (next) return { kind: 'first_post', site: next };
  }
  if (x.age_days >= 1.5 * m && x.has_watchers_verb) return { kind: 'offer_to_watchers' };
  if (x.age_days >= m && x.interest < x.interest_median) {
    if (x.price_cents <= x.p50_cents) return { kind: 'relist', ask: x.site === 'poshmark' };
    if (atFloor) return { kind: 'price_below_floor' };
    return { kind: 'markdown', price_cents: Math.max(x.next_rung_cents ?? x.floor_cents, x.floor_cents) };
  }
  return { kind: 'none' };
}

// D12: add sites greedily while the marginal gain pays for the double-sale risk.
export type SiteOdds = { site: FeeSite; E: number; P: number; keep: number; cancel_cost: number };
export const P_DOUBLE = 0.01; // D12 starting value with delist inside 5 minutes

export function bestSites(sites: SiteOdds[], p_double = P_DOUBLE): FeeSite[] {
  const ranked = [...sites].sort((a, b) => b.E - a.E || b.P - a.P);
  const chosen: FeeSite[] = [];
  let unsold = 1;
  for (const s of ranked) {
    const gain = unsold * s.P * s.keep - (chosen.length ? p_double * s.cancel_cost : 0);
    if (chosen.length && gain <= 0) continue;
    chosen.push(s.site);
    unsold *= 1 - s.P;
  }
  return chosen;
}
