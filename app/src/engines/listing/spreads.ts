/**
 * How one item's prices relate across sites (research/list/ben/crosslist-pricing.md): four named rules, each one sentence,
 * and the price one site gets under each with its reason in words and its arithmetic. Same take-home is the default
 * (decisions.md, 2026-11-15). Split from crosslist.ts so a screen can show the rules and their numbers: crosslist.ts reads
 * the platform fit from disk, and this needs only the fee table.
 */
import { keep, priceForKeep, type FeeSite } from '../valuation/keep.ts';

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
export const HOME_MARKUP = 0.1;   // guess: home_first lists the other sites 10% above the take-home price, never below it

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

// One site's price under the chosen spread, and why. `from` is the site the item is listed on now, `target` what it pays
// there, `sticker` its price there, `market` the median sale on this site when shown. The floor is the same under every spread.
export function sitePrice(spread: Spread, from: string, site: FeeSite, target: number, sticker: number, market?: number) {
  const even = priceForKeep(site, target);
  const numbers = (p: number, how: string) => `${how}: ${usd(p)} on ${site}, ${usd(p - keep(site, p).keep_cents)} in fees, you get ${usd(keep(site, p).keep_cents)}`;
  if (spread === 'same_price') return { price: sticker, why: { says: `Same price as your ${from} listing.`, numbers: numbers(sticker, `the ${from} price`) } };
  if (spread === 'site_market' && market !== undefined)
    return { price: market, why: { says: `What buyers on ${site} have paid for things like this.`, numbers: numbers(market, `${site}'s median sale`) } };
  if (spread === 'home_first') {
    const p = Math.max(even, Math.round(even * (1 + HOME_MARKUP)));
    return { price: p, why: { says: `A little above your ${from} shop, so your shop stays the cheapest.`, numbers: numbers(p, `same take-home plus ${HOME_MARKUP * 100}%`) } };
  }
  const says = spread === 'site_market' ? `Not enough ${site} sales to say what buyers there pay, so you get the same as everywhere.` : 'You get the same as on every other site, after its fees.';
  return { price: even, why: { says, numbers: numbers(even, `to keep ${usd(target)}`) } };
}
