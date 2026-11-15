// Small constructors the worlds are written with, so each world reads as a list of things that happened.
// What a person keeps is never typed in: it comes from the money fee table (engines/valuation/keep.ts, money.md D9).
import { keep } from '../engines/valuation/keep.ts';
import { NOW, inDays, inHours } from './format.ts';
import type { PhotoKey } from './photo-keys.ts';
import type { Attribute, Cents, Decision, Item, ItemState, KindFamily, Listing, ListingState, MarketStanding, Offer, Order, Photo, Site, Valuation } from './types.ts';

const URL: Record<Site, (id: string) => string> = {
  ebay: id => `https://www.ebay.com/itm/${id}`,
  depop: id => `https://www.depop.com/products/${id}`,
  poshmark: id => `https://poshmark.com/listing/${id}`,
  mercari: id => `https://www.mercari.com/us/item/${id}`,
  facebook: id => `https://www.facebook.com/marketplace/item/${id}`,
};
export const siteUrl = (site: Site, id: string) => URL[site](id);

// What the seller keeps on a sale at this price, after the site's fee. Facebook pickups pay no fee.
export function youKeep(site: Site, price: Cents, local = false): Cents {
  return keep(site === 'facebook' && local ? 'facebook_local' : site, price).keep_cents;
}
export const feeOf = (site: Site, price: Cents, local = false) => price - youKeep(site, price, local);

export const photos = (key: PhotoKey, id: string): Photo[] => [{ id: `ph_${id}`, role: 'front', use: 'real', ai_marked: false, key }];

export function valuation(low: Cents, high: Cents, basis: number, sites: Site[], citation: string): Valuation {
  const step = Math.round((high - low) / 6);
  return {
    range: { low, high }, level: basis >= 20 ? 1 : 2, basis_count: basis, as_of: inHours(-3), citation_id: citation, state: 'shown',
    per_site: sites.map((site, i) => ({ site, low: low + step * (i % 2), high: high - step * ((i + 1) % 2), basis_count: Math.max(1, Math.round(basis / sites.length)) })),
  };
}

export const standing = (word: MarketStanding['word'], line: string, extra: Partial<MarketStanding> = {}): MarketStanding =>
  ({ word, line, citation_id: `ci_st_${word}`, state: 'shown', ...extra });

type ListingIn = { site: Site; price: Cents; state?: ListingState; days?: number; views?: number; watchers?: number; likes?: number; standing?: MarketStanding; error?: string };
export function listings(itemId: string, rows: ListingIn[]): Listing[] {
  return rows.map(r => ({
    id: `ls_${itemId}_${r.site}`, item_id: itemId, site: r.site, state: r.state ?? 'live', price_cents: r.price,
    url: siteUrl(r.site, `${itemId}-${r.site}`), interest: { views: r.views, watchers: r.watchers, likes: r.likes },
    posted_at: r.state === 'none' || r.state === 'postFailed' ? null : inDays(-(r.days ?? 3)),
    market_standing: r.standing, error: r.error,
  }));
}

type ItemIn = {
  id: string; title: string; key: PhotoKey; state: ItemState; category: KindFamily; days: number; where?: string;
  attrs?: [string, string | number | null, Attribute['source']?, boolean?][]; floor?: Cents; always?: Cents | null;
  plan?: NonNullable<Item['limits']>['plan_choice']; value?: Valuation; sell?: ListingIn[]; cost?: Cents; note?: string;
  origin?: Item['origin']; group?: string; kept?: string; spread?: NonNullable<Item['limits']>['spread'];
};
// One item. `days` is how long ago it came in.
export function item(i: ItemIn): Item {
  return {
    id: i.id, state: i.state, title: i.title, category: i.category, origin: i.origin ?? 'capture', location: { label: i.where ?? 'Hall closet' },
    quantity: 1, group_id: i.group, note: i.note, kept_reason: i.kept,
    cost: i.cost === undefined ? undefined : { amount_cents: i.cost, date: inDays(-i.days - 30).slice(0, 10), source: 'you_said' },
    photos: photos(i.key, i.id),
    attributes: (i.attrs ?? []).map(([name, value, source = 'label', confirmed = true], n) => ({
      id: `att_${i.id}_${n}`, name, value, source, confirmed: value === null ? false : confirmed, unknown_reason: value === null ? 'not_visible' : undefined,
    })),
    valuation: i.value,
    // An item already posted in a demo world went up at one price on every site, before the rule was a choice (decisions.md,
    // 2026-11-15, cross-listing starts on same take-home), so it carries Same price as its own; a draft takes the account's.
    limits: i.floor === undefined ? undefined : { floor_cents: i.floor, always_accept_cents: i.always ?? null, plan_choice: i.plan ?? 'sell', gone_by: null, fallback: 'ask', markdown_on: i.plan !== 'reserve',
      spread: i.spread ?? ((i.sell ?? []).some(r => (r.state ?? 'live') !== 'none') ? 'same_price' : undefined) },
    listings: listings(i.id, i.sell ?? []), created_at: inDays(-i.days), updated_at: inHours(-2),
  };
}

// An offer from a buyer, with what the seller would keep if they took it.
export function offerIn(id: string, conv: string, l: Listing, amount: Cents, sentHoursAgo: number, expiresInHours: number | null, state: Offer['state'] = 'open'): Offer {
  return {
    id, conversation_id: conv, listing_id: l.id, site: l.site, direction: 'in', amount_cents: amount, you_keep_cents: youKeep(l.site, amount),
    state, sent_at: inHours(-sentHoursAgo), expires_at: expiresInHours === null ? null : inHours(expiresInHours),
  };
}

type SaleIn = { id: string; item: Item; site: Site; price: Cents; state: Order['state']; hoursAgo: number; buyer: string; local?: boolean; shipBy?: number; label?: Cents; releaseIn?: number };
// A sale, with the site's fee taken out. Pickups are local and paid in person.
export function sale(s: SaleIn): Order {
  const fee = feeOf(s.site, s.price, s.local);
  const released = s.state === 'released';
  return {
    id: s.id, kind: 'sale', item_id: s.item.id, listing_id: s.item.listings.find(l => l.site === s.site)?.id ?? null, site: s.site, state: s.state,
    price_cents: s.price, fees_cents: fee, shipping_cents: s.label ?? 0, payout_cents: released ? s.price - fee - (s.label ?? 0) : null, buyer: s.buyer,
    label: s.label ? { carrier: 'USPS', tracking_ref: s.state === 'to_ship' || s.state === 'paid' ? null : `9400 1000 0000 ${s.id.slice(-4)}`, cost_cents: s.label } : null,
    clocks: {
      ship_by: s.shipBy === undefined ? undefined : inHours(s.shipBy),
      release_at: s.releaseIn === undefined ? undefined : inHours(s.releaseIn),
    },
    external_order_id: `${s.site.slice(0, 2).toUpperCase()}-${s.id.slice(-4)}`, created_at: inHours(-s.hoursAgo),
  };
}

type DecisionIn = Omit<Decision, 'state' | 'allow_other' | 'group_key' | 'group_rank' | 'created_at' | 'tier'> & Partial<Pick<Decision, 'state' | 'allow_other' | 'group_key' | 'group_rank' | 'tier' | 'created_at'>>;
export const decision = (d: DecisionIn): Decision =>
  ({ state: 'open', allow_other: false, group_key: null, group_rank: null, tier: 'ask', created_at: inHours(-1), ...d });

export { NOW };
