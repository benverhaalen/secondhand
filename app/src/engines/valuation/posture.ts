// The price slider (valuation.md, "The price slider"): one value, posture, 0 priced to go, 1 hard to negotiate.
// Operation per site at a point t: the sold-quantile level runs from q20 at 0 to q85 at 1 (sold comps set the value);
// the ask is placed among today's top listings (under the cheapest at 0, up to the dearest live ask at 1); the
// offer room grows with t up to the learned discount; then the ceiling (the cheapest official price after credible
// discounts, unless out of stock) and last the floor, which wins over everything. Keep, chance of sale and days
// come from the same curves the plans use. Sold prices are placed on the track as ticks.
import { DEFAULT_ENDING, roundToEnding, type EndingRule } from '../money/ending.ts';
import { keep, type FeeSite, type Sale } from './keep.ts';
import { weightedPercentile, type Curve } from './path.ts';

export const MARKS = { quick: 0.15, balanced: 0.5, max_return: 0.85 } as const;
export const OPENS_AT = MARKS.balanced; // Nate: the slider opens at the middle
const LEVEL_AT_0 = 0.2, LEVEL_AT_1 = 0.85; // the q20 and q85 of the sold range (valuation.md table)
const HORIZON = 30;

export type Sold = { price_cents: number; w: number; sold_at: string };
export type TopListing = { site: FeeSite; price_cents: number; url: string; age_days?: number; likes?: number; offers_on?: boolean };
export type RetailOffer = { source: string; price_cents: number; list_price_cents?: number; in_stock: boolean; url: string };
export type Discount = { source: string; credible: boolean; price_cents: number; ends_at?: string };

export type SiteInput = { site: FeeSite; sold: Sold[]; top: TopListing[]; curve: Curve; offer_discount: number; sale?: Sale; ending?: EndingRule };
export type PostureInput = { sites: SiteInput[]; floor_cents: number; retail: RetailOffer[]; discounts: Discount[]; as_of: string };

export type Ceiling = { cents: number; source: string } | null;

// The cheapest official price now: retail in stock, lowered by any credible discount still running.
export function ceiling(retail: RetailOffer[], discounts: Discount[], as_of: string): Ceiling {
  const now = Date.parse(as_of);
  const offers = [
    ...retail.filter(r => r.in_stock).map(r => ({ cents: r.price_cents, source: r.source })),
    ...discounts.filter(d => d.credible && (!d.ends_at || Date.parse(d.ends_at) > now)).map(d => ({ cents: d.price_cents, source: d.source })),
  ];
  if (!retail.some(r => r.in_stock)) return null; // a used item may go above retail when the new one is out of stock
  return offers.reduce((a, b) => (b.cents < a.cents ? b : a));
}

export type Point = {
  site: FeeSite; ask_cents: number; list_cents: number; keep_cents: number; p_sale_30: number; days_t50: number | null;
  held_by: 'floor' | 'ceiling' | 'top_listings' | null;
};

const level = (t: number) => LEVEL_AT_0 + t * (LEVEL_AT_1 - LEVEL_AT_0);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function pointOnSite(s: SiteInput, t: number, floor_cents: number, cap: Ceiling): Point | null {
  if (s.sold.length === 0) return null;
  t = clamp01(t);
  const end = s.ending ?? DEFAULT_ENDING;
  let ask = weightedPercentile(s.sold.map(x => x.price_cents), s.sold.map(x => x.w), level(t));
  let held: Point['held_by'] = null;
  const asks = s.top.map(x => x.price_cents);
  if (asks.length) {
    const lo = Math.min(...asks) - 100, hi = Math.max(...asks);
    const place = lo + t * (hi - lo);
    if (ask > place) { ask = place; held = 'top_listings'; }
  }
  let list = ask / (1 - t * s.offer_discount);
  if (cap && list > cap.cents) { list = cap.cents; held = 'ceiling'; }
  if (cap && ask > cap.cents) ask = cap.cents;
  const fit = (c: number, hi: number) => roundToEnding(c, end, floor_cents, hi) ?? Math.max(floor_cents, Math.round(c));
  const ceilingCents = cap ? Math.max(cap.cents, floor_cents) : Infinity;
  ask = fit(ask, ceilingCents);
  list = Math.max(ask, fit(list, ceilingCents));
  if (ask <= floor_cents) { ask = floor_cents; held = 'floor'; }
  if (list < floor_cents) list = floor_cents;
  return {
    site: s.site, ask_cents: ask, list_cents: list, keep_cents: keep(s.site, list, s.sale).keep_cents,
    p_sale_30: s.curve.p(list, HORIZON), days_t50: s.curve.t(list, 0.5), held_by: held,
  };
}

// What sold prices say about each point: each sale as a tick at its slider position.
export function ticks(sold: Sold[]) {
  const total = sold.reduce((a, s) => a + s.w, 0);
  const sorted = [...sold].sort((a, b) => a.price_cents - b.price_cents);
  let acc = 0;
  const out = sorted.map(s => { acc += s.w; return { price_cents: s.price_cents, sold_at: s.sold_at, position: clamp01((acc / total - LEVEL_AT_0) / (LEVEL_AT_1 - LEVEL_AT_0)) }; });
  const dates = sold.map(s => s.sold_at).sort();
  return { ticks: out, count: sold.length, from: dates[0] ?? null, to: dates.at(-1) ?? null };
}

// How the negotiation engine reads the posture (ng-5): accept at once from a line that rises from the floor to
// always_accept, counter at t of the gap from offer to ask (the midpoint at balanced), concede 1 - t per round,
// and at the hard end propose no counter on an offer under the floor (it still asks).
export function stance(t: number) {
  t = clamp01(t);
  return { accept_line_share: t, counter_share: t, concede_per_round: 1 - t, counter_under_floor_offers: t < MARKS.max_return };
}

// Markdown over time: early and steep at 0, late and shallow at 1, as multipliers on D15's age and rung step.
export const markdown = (t: number) => ({ age_mult: 0.5 + clamp01(t), step_mult: 1.5 - clamp01(t) });

export function slider(x: PostureInput, t: number = OPENS_AT) {
  const cap = ceiling(x.retail, x.discounts, x.as_of);
  return {
    posture: clamp01(t), marks: MARKS, ceiling: cap, floor_cents: x.floor_cents,
    sites: x.sites.map(s => ({ point: pointOnSite(s, t, x.floor_cents, cap), track: ticks(s.sold) })),
    signals: { top_listings: x.sites.flatMap(s => s.top), retail_offers: x.retail, discounts: x.discounts.filter(d => d.credible) },
    stance: stance(t), markdown: markdown(t),
  };
}
