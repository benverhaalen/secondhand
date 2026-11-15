// The example item behind the /engine figures. The sales are made up; every weight, cut and fee is
// computed here by the functions the app runs, so the figures move when the engine does.
import { trim, weigh, weightedQuantile, DEFAULTS, type Comp } from '../../../app/src/engines/valuation/comps.ts';
import { FEES, keep, type FeeSite } from '../../../app/src/engines/valuation/keep.ts';
import { bestSites, P_DOUBLE } from '../../../app/src/engines/valuation/path.ts';

const AS_OF = '2026-11-15T00:00:00.000Z';
const DAY = 86_400_000;
const sale = (id: number, dollars: number, age_days: number, kind: Comp['kind'], level: Comp['level']): Comp => ({
  comp_id: `example-${id}`, site: 'ebay', sold_at: new Date(Date.parse(AS_OF) - age_days * DAY).toISOString(),
  price_cents: dollars * 100, kind, level, condition: 'good', w_match: DEFAULTS.w_match[level], w_extract: 1,
  may_model: false, citation: 'example',
});
const sales = [
  sale(1, 34, 6, 'sold', 'variant'), sale(2, 38, 14, 'sold', 'variant'), sale(3, 30, 21, 'sold', 'product'),
  sale(4, 42, 30, 'own_order', 'variant'), sale(5, 36, 45, 'best_offer', 'variant'), sale(6, 28, 70, 'sold', 'product'),
  sale(7, 45, 95, 'sold', 'variant'), sale(8, 26, 130, 'sold', 'family'), sale(9, 32, 160, 'sold', 'product'),
  sale(10, 50, 200, 'sold', 'family'), sale(11, 24, 260, 'sold', 'product'), sale(12, 95, 40, 'sold', 'product'),
];
/** Asking prices never reach the engine: its input type has no kind for them. */
export const asks = [{ dollars: 55, age_days: 3 }, { dollars: 62, age_days: 10 }, { dollars: 48, age_days: 20 }];

const weighted = weigh(sales, AS_OF);
const { kept, dropped } = trim(weighted.map(c => ({ ...c, adjusted_cents: c.price_cents })));
const out = new Set(dropped.map(d => d.comp_id));
const quantile = (q: number) => weightedQuantile(kept.map(c => c.price_cents), kept.map(c => c.w), q);
const [q10, q50, q90] = [quantile(.1), quantile(.5), quantile(.9)];
// shortcut: the page's story needs one trimmed sale and an ordered range; fail the build, not the reader, if the engine stops giving them.
if (q10 === null || q50 === null || q90 === null || !(q10 <= q50 && q50 <= q90) || out.size !== 1) throw new Error('engine example no longer tells its story');

export const range = { q10, q50, q90 };
export const dots = weighted.map(c => ({ id: c.comp_id, dollars: c.price_cents / 100, age_days: Math.round(c.age_days), w_age: c.w_age, w: c.w, out: out.has(c.comp_id) }));
export const halfLife = DEFAULTS.half_life_days.default;

const SITES: FeeSite[] = ['facebook_local', 'depop', 'mercari', 'ebay', 'poshmark'];
/** Same assumptions as the Features page: the buyer pays $6 shipping, which covers the label; tax and promotion excluded. */
export const keeps = SITES.map(site => ({ site, keep_cents: keep(site, q50, { buyer_shipping_cents: 600, tax_rate: 0 }).keep_cents }))
  .sort((a, b) => b.keep_cents - a.keep_cents);

// The chance of a sale within 30 days is an example: the per-market curves need live sales before they are shown.
// What each site keeps, the order and the choice of sites are computed.
const CHANCE: Record<string, number> = { ebay: .55, depop: .45, mercari: .4, poshmark: .35, facebook_local: .25 };
const odds = keeps.map(k => ({ site: k.site, keep: k.keep_cents, P: CHANCE[k.site], E: CHANCE[k.site] * k.keep_cents, cancel_cost: 500 }));
const chosen = bestSites(odds);
let unsold = 1;
export const markets = chosen.map(site => {
  const o = odds.find(x => x.site === site)!, fee = FEES[site], fixed = fee.fixed_cents(q50);
  unsold *= 1 - o.P;
  return { site, keep_cents: o.keep, chance: o.P, score_cents: Math.round(o.E), reach: 1 - unsold,
    fee: fee.fee_pct === 0 ? 'No fee' : `${+(fee.fee_pct * 100).toFixed(1)}%${fixed ? ` + $${(fixed / 100).toFixed(2)}` : ''}` };
});
export const skipped = odds.length - chosen.length;
export const doubleSale = P_DOUBLE;

export const rules = {
  type: [['Your own completed sale', DEFAULTS.w_type.own_order], ['A sale', DEFAULTS.w_type.sold], ['An accepted offer', DEFAULTS.w_type.best_offer], ['An asking price', 0]],
  match: [['Same item, same variant', DEFAULTS.w_match.variant], ['Same product', DEFAULTS.w_match.product], ['Same family', DEFAULTS.w_match.family]],
  age: [0, 90, 180, 270, 365].map(days => [days === 0 ? 'Sold today' : `${days} days ago`, .5 ** (days / DEFAULTS.half_life_days.default)]),
  condition: Object.entries(DEFAULTS.condition_ratios).map(([name, ratio]) => [name.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()), ratio]),
} satisfies Record<string, (string | number)[][]>;
