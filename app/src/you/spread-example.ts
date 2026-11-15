// The numbers under the account's price rule (Ben 06:53: "in plain language be able to understand the reasoning and can then
// see numbers if need be"). One item, the Carhartt jacket listed on Depop at $95, priced on each other site by the engine's
// own sitePrice, so the example and a real cross-listing never disagree. Pure, so the page draws and never computes.
// Imports carry .ts so node --test reads this file without the app's bundler.
import { PRODUCTS } from '../demo/market.ts';
import { sitePrice, type Spread } from '../engines/listing/spreads.ts';
import { keep, type FeeSite } from '../engines/valuation/keep.ts';

export const EXAMPLE = { product: 'pr_j97', home: 'depop' as const, price_cents: 9500 };
// The sites people link and list on; facebook_local is a way of selling on Facebook, never a site of its own.
type ListSite = Exclude<FeeSite, 'facebook_local'>;
const FEE_SITES: readonly string[] = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
// With fewer than two other sites linked, one row says little about a rule; these are the sites most people link.
const COMMON: ListSite[] = ['ebay', 'mercari', 'poshmark'];

// too_few: the rule wanted this site's sales and there were too few, so the site gets the same take-home.
export type ExampleRow = { site: ListSite; home: boolean; price_cents: number; fee_cents: number; get_cents: number; too_few: boolean };

const row = (site: ListSite, price: number, home: boolean, too_few: boolean): ExampleRow => {
  const k = keep(site, price).keep_cents;
  return { site, home, price_cents: price, fee_cents: price - k, get_cents: k, too_few };
};

// The middle of what sold on that site, to the dollar; none when the site shows no sales for it.
function market(site: ListSite) {
  const sold = PRODUCTS.find(p => p.id === EXAMPLE.product)?.by_site.find(s => s.site === site)?.sold;
  return sold ? Math.round((sold.low + sold.high) / 200) * 100 : undefined;
}

// The listing where it is now, then each other site the person linked, in their order.
export function example(spread: Spread, linked: string[]): ExampleRow[] {
  const others = linked.filter(s => FEE_SITES.includes(s) && s !== EXAMPLE.home) as ListSite[];
  const sites = others.length >= 2 ? others : COMMON;
  const target = keep(EXAMPLE.home, EXAMPLE.price_cents).keep_cents;
  return [
    row(EXAMPLE.home, EXAMPLE.price_cents, true, false),
    ...sites.map(site => {
      const m = market(site);
      return row(site, sitePrice(spread, EXAMPLE.home, site, target, EXAMPLE.price_cents, m).price, false, spread === 'site_market' && m === undefined);
    }),
  ];
}
