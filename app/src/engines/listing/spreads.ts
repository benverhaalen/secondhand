/**
 * How one item's prices relate across sites (research/list/ben/crosslist-pricing.md): four named rules, each one sentence,
 * and the price one site gets under each with its reason in words and its arithmetic. Same take-home is the default
 * (decisions.md, 2026-11-15). Split from crosslist.ts so a screen can show the rules and their numbers: crosslist.ts reads
 * the platform fit from disk, and this needs only the fee table.
 */
import { keep, priceForKeep, FEES, type FeeSite } from '../valuation/keep.ts';

import { answer, guard, PROOF_PARAMS, type BasisRow } from '../proof/proof.ts';
import { memoryStore, type ParamStore } from '../param/param.ts';
import { resolve, scalar } from './params.ts';
import { money } from './money.ts';

// The seller's choice, not a number we pick for them.
// Each is a rule sellers already use (research/list/ben/crosslist-pricing.md): Nifty's fee-based default is same_keep,
// Crosslist's default markup of 0 is same_price, a hotel steering bookings to its own site is home_first.
// `says` is the plain reason the person reads first; the numbers sit under it, shown on a tap (Ben, 06:53).
export const SPREADS = {
  same_keep: { name: 'Same take-home', says: 'You get the same money wherever it sells. Sites with higher fees show a higher price.' },
  same_price: { name: 'Same price', says: 'Every site shows one price, so buyers who look around see the same thing. You get less where fees are higher.' },
  site_market: { name: 'What each site pays', says: "Each site asks what buyers there have paid for things like this. You may get more on one site than another." },
  home_first: { name: 'Your shop first', says: 'Your own shop stays the cheapest place to buy it, so sales and reviews build up there.' },
} as const;
export type Spread = keyof typeof SPREADS;
export const DEFAULT_SPREAD: Spread = 'same_keep';
export type PriceProof = {resolved?: ReturnType<typeof resolve>; params?: ParamStore; person?: string; as_of?: string; basis?: BasisRow[]; minimum_price_cents?: number};

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

// One site's price under the chosen spread, and why. `from` is the site the item is listed on now, `target` what it pays
// there, `sticker` its price there, `market` the median sale on this site when shown. The floor is the same under every spread.
export function sitePrice(spread: Spread, from: string, site: FeeSite, target: number, sticker: number, market?: number, options: PriceProof = {}) {
  money(target, 'target_keep_cents'); money(sticker, 'price_cents');
  if (market !== undefined) money(market, 'market_cents');
  if (options.minimum_price_cents !== undefined) money(options.minimum_price_cents, 'floor_cents');
  const store = options.params ?? memoryStore();
  const {values, versions} = options.resolved ?? resolve(store, {site, person:options.person});
  const markup = scalar(values, 'listing_home_markup');
  const rules: Record<string, number> = {};
  for (const entry of PROOF_PARAMS) {
    store.declare(entry);
    const read = store.read(entry.name, {site});
    if (typeof read.value !== 'number' || !Number.isFinite(read.value) || read.value < 0) throw new RangeError(`invalid ${entry.name}`);
    rules[entry.name] = read.value; versions[entry.name] = read.version;
  }
  const finish = (ask: number, says: string, how: string) => {
    const price = money(Math.max(ask, options.minimum_price_cents ?? 0), 'price_cents');
    const payout = keep(site, price, {as_of:options.as_of});
    const kept = money(payout.keep_cents, 'keep_cents');
    const checked = (metric: string, value: number) => {
      const result = answer(value, options.as_of ? options.basis ?? [] : [], {metric:`listing.${metric}`, filters:{site, spread, fee_source:FEES[site].source_note,fee_valid_from:FEES[site].valid_from}, table_versions:[], definition_version:'money.D9', code_version:'listing.spreads.2', param_versions:versions, model_version:null},options.as_of ?? FEES[site].valid_from);
      if (result.ok) result.citation.id += `:${metric}`;
      const checked = guard(result,{min_n_eff:rules.proof_min_n_eff,max_age_days:rules.proof_max_age_days});
      const feeAge = (Date.parse(options.as_of ?? '') - Date.parse(FEES[site].valid_from)) / 86400e3; // Fixed: milliseconds per day.
      const stale = payout.fees_may_have_changed || feeAge > rules.proof_max_age_days;
      return {...checked,...(stale ? {state:'hidden' as const,hide_reason:'stale' as const} : {}),citation:result.ok ? result.citation : null};
    };
    const proof = {price:checked('price',price),fee:checked('fee',price-kept),keep:checked('keep',kept)};
    const shown = Object.values(proof).every(p => p.state === 'shown');
    return {price, why:{says,numbers:shown ? `${how}: ${usd(price)} on ${site}, ${usd(price-kept)} in fees, you get ${usd(kept)}` : ''},proof,param_versions:versions};
  };
  const even = priceForKeep(site, target);
  if (spread === 'same_price') return finish(sticker, `Same price as your ${from} listing.`, `the ${from} price`);
  if (spread === 'site_market' && market !== undefined)
    return finish(market, `What buyers on ${site} have paid for things like this.`, `${site}'s median sale`);
  if (spread === 'home_first') {
    const p = Math.max(even, Math.round(even * (1 + markup)));
    return finish(p, `A little above your ${from} shop, so your shop stays the cheapest.`, `same take-home plus ${markup * 100}%`);
  }
  const says = spread === 'site_market' ? `Not enough ${site} sales to say what buyers there pay, so you get the same as everywhere.` : 'You get the same as on every other site, after its fees.';
  return finish(even, says, `to keep ${usd(target)}`);
}
