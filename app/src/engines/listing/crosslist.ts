/**
 * Cross-list: listings the person already has on one site become drafts for every other site they linked.
 * One target payout for every site: what the source listing keeps today (money D9), so each site's price is the one
 * that keeps the same (priceForKeep). Where each item goes comes from the platform fit (route by product type).
 * Each draft is the listing engine's own (buildListing), so titles, fields, photo caps, floors and readiness match a
 * captured item's. A sold source listing is not cross-listed: it is a sold comp for the price engine instead.
 * Posting goes through the harness `post` verb, one operation_id per (source listing, site), only for a draft that is
 * ready and whose first_post decision the person approved; nothing here posts on its own.
 */
import { buildListing, type Attr, type ItemCard } from './build.ts';
import { route } from '../../../../research/list/ben/platforms/fit.mjs';
import { keep, priceForKeep, type FeeSite } from '../valuation/keep.ts';
import { sitePrice, type Spread } from './spreads.ts';
// The marketplaces (app/src/edge/harness/names.ts SITES); an engine does not import from the server edge.
export type Site = 'ebay' | 'facebook' | 'depop' | 'poshmark' | 'mercari' | 'offerup' | 'grailed';
// The harness `post` verb, as the edge hands it in: harness.call(site, 'post', args).
// The edge's harness reads a write back before it answers; outcome_unknown means it could not tell, so never re-post.
export type Post = (site: Site, args: { operation_id: string } & Record<string, unknown>) => Promise<{ ok: boolean; error?: { code: string } }>;

export type SourceListing = {
  site: Site;
  external_id: string;
  url: string;
  state: 'active' | 'sold';
  title: string;
  description: string;
  price_cents: number;            // what a buyer pays now (the discounted price when there is one)
  list_price_cents?: number;      // the struck-through price, when discounted
  floor_cents?: number;           // the lowest the person takes on the source site (Depop: auto_negotiate_offer_price)
  currency: string;
  brand?: string;
  size?: string;
  condition?: string;             // the valuation engine's words: new_with_tags, new_without_tags, excellent, good, fair
  colours: string[];
  department?: string;
  category?: string;              // the source site's own product type, e.g. Depop's "tshirts"
  tags: string[];
  photos: string[];
  listed_at?: string;
  likes?: number;
  views?: number;
};

// The source site's product type to the requirement registry's item kind (spec/fixtures/requirement): agent proposal.
const KIND: [RegExp, string][] = [
  [/sneaker|trainer|shoe|boot|heel|sandal|loafer/i, 'shoes'],
  [/phone|laptop|tablet|camera|headphone|console|speaker|electronic/i, 'electronics'],
  [/sofa|couch|chair|table|desk|dresser|furniture/i, 'furniture'],
];
export const itemKind = (l: SourceListing) => KIND.find(([re]) => re.test(l.category ?? ''))?.[1] ?? 'apparel';

// The platform-fit product type (research/list/ben/platforms/platform-fit.json `types`) from what the listing says.
// Agent proposal: first match wins, from the most specific signal to the broadest.
const ERA = /\b(vintage|y2k|retro|[0-9]0s|19[5-9]0s|1990s|2000s)\b/i;
const ERAS = new RegExp(ERA.source, 'gi');
const TEAM = /\b(badgers|nfl|nba|mlb|nhl|ncaa|jersey|university|college|hurricanes|bears|brewers|sun devils|red sox|yankees|lakers|packers|hawkeyes)\b/i;
const STREET = /\b(supreme|stussy|st[uü]ssy|palace|bape|travis scott|cactus jack|off-white|fear of god|essentials|kith|corteiz|sp5der|chrome hearts)\b/i;
const OUTDOOR = /\b(patagonia|arc'?teryx|the north face|north face|columbia|marmot|mountain hardwear)\b/i;
const DESIGNER = /\b(gucci|prada|louis vuitton|balenciaga|saint laurent|dior|burberry|versace|fendi|bottega|celine|loewe)\b/i;

export function productType(l: SourceListing): string {
  const text = [l.brand, l.title, l.description, l.category, ...l.tags].filter(Boolean).join(' ');
  const kind = itemKind(l);
  if (kind === 'shoes') return /sneaker|trainer/i.test(l.category ?? '') || /\b(jordan|dunk|yeezy|air max|new balance)\b/i.test(text) ? 'sneakers' : 'shoes_other';
  if (kind === 'electronics') return /phone|laptop|tablet/i.test(l.category ?? '') ? 'phones_computers' : 'cameras_audio_gaming';
  if (kind === 'furniture') return 'furniture';
  if (/jewel|watch|ring|necklace|bracelet/i.test(l.category ?? '')) return 'jewelry_watches';
  if (/hat|cap|belt|sunglass|scarf|beanie|bag/i.test(l.category ?? '')) return 'accessories';
  if (DESIGNER.test(text)) return 'designer_clothing';
  if (STREET.test(text)) return 'streetwear';
  if (TEAM.test(text)) return ERA.test(text) ? 'vintage_clothing' : 'fan_apparel';
  if (ERA.test(text)) return 'vintage_clothing';
  if (OUTDOOR.test(text)) return 'outdoor_apparel';
  return /women/i.test(l.department ?? '') ? 'womens_mall_brands' : 'mens_mainstream';
}

// Depop's product-type and department codes as the words buyers search (agent proposal; codes from the Partner API).
const TYPE_WORDS: Record<string, string> = {
  tshirts: 'T-Shirt', 'long-sleeve-tshirts': 'Long Sleeve T-Shirt', shirts: 'Shirt', 'polo-shirts': 'Polo Shirt', hoodies: 'Hoodie',
  sweatshirts: 'Sweatshirt', jumpers: 'Sweater', cardigans: 'Cardigan', jackets: 'Jacket', coats: 'Coat', jeans: 'Jeans',
  trousers: 'Pants', joggers: 'Sweatpants', sweatpants: 'Sweatpants', shorts: 'Shorts', dresses: 'Dress', skirts: 'Skirt',
  'tops-and-blouses': 'Top', sneakers: 'Sneakers', boots: 'Boots', hats: 'Hat', caps: 'Cap', bags: 'Bag', jerseys: 'Jersey',
};
const DEPARTMENT_WORDS: Record<string, string> = { menswear: "Men's", womenswear: "Women's", kidswear: "Kids'", everything_else: '' };
// Words a buyer reads as the same type; one is enough in a title.
const SAME: Record<string, string[]> = { 'T-Shirt': ['tee', 'tshirt', 't-shirt', 'shirt'], Sweatpants: ['joggers'], Pants: ['trousers'], Sweater: ['jumper'] };
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

// What the source title says beyond brand, type, era, size and colour: the team, print, model or cut, kept in its order.
function detail(l: SourceListing, type: string | undefined, era: string | undefined): string | undefined {
  const known = new Set(words([l.brand, type, l.category, era, l.size, ...l.colours, ...(type ? SAME[type] ?? [] : []), 'vintage', 'size', 'mens', 'womens'].filter(Boolean).join(' ')));
  const left = (l.title.match(/[\p{L}\p{N}'&-]+/gu) ?? []).filter(w => !known.has(w.toLowerCase()));
  return left.length ? left.join(' ') : undefined;
}

// The seller wrote every one of these on their own listing, so each is a confirmed marketplace fact.
const said = (value: Attr['value']): Attr => ({ value, source: 'marketplace', confirmed: true });

export function toItemCard(l: SourceListing): ItemCard {
  const attrs: Record<string, Attr> = {};
  const era = [...new Set(([l.title, ...l.tags].join(' ').match(ERAS) ?? []).map(e => e[0].toUpperCase() + e.slice(1).toLowerCase()))].join(' ') || undefined;
  const put = (k: string, v: Attr['value'] | undefined) => { if (v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) attrs[k] = said(v); };
  const type = l.category ? TYPE_WORDS[l.category] ?? l.category : undefined;
  put('brand', l.brand);
  put('type', type);
  put('detail', detail(l, type, era));
  put('size_label', l.size);
  put('condition', l.condition);
  put('colour', l.colours[0]);
  put('department', l.department ? DEPARTMENT_WORDS[l.department] ?? l.department : undefined);
  put('era', era);
  put('keywords', l.tags);
  return {
    item_id: `${l.site}:${l.external_id}`,
    kind: itemKind(l),
    attrs,
    // The source site already chose the order; the first photo is the cover, so it scores highest.
    photos: l.photos.map((url, i) => ({ photo_id: url, score: l.photos.length - i })),
  };
}

// The row the market model prices (jobs/valuation/market.py FEATURES), from the same facts the drafts use.
export function marketItem(l: SourceListing) {
  const card = toItemCard(l);
  const v = (k: string) => (card.attrs[k]?.value as string | undefined);
  return { brand: l.brand, category: v('type'), condition: l.condition, size: l.size, era: v('era')?.split(' ').find(e => !/vintage/i.test(e)) ?? 'modern', site: l.site };
}

const FEE_SITES: readonly string[] = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
const feeSite = (s: string) => (FEE_SITES.includes(s) ? (s as FeeSite) : undefined);

// How the prices on the other sites relate to each other, the seller's choice: spreads.ts.
export { SPREADS, type Spread } from './spreads.ts';

export type SiteDraft = {
  site: Site;
  verdict: string;
  reason: string;
  action: 'post' | 'offer' | 'warn' | 'never' | 'live';   // post by default, offer is opt-in; warn, never and live (already listed there) are not posted
  price_cents?: number;
  floor_cents?: number;
  keep_cents?: number;
  why?: { says: string; numbers: string };          // the plain reason for this site's price, then the arithmetic behind it
  listing?: ReturnType<typeof buildListing>;
};
export type ItemPlan = {
  source: Pick<SourceListing, 'site' | 'external_id' | 'url' | 'title' | 'price_cents'>;
  product_type: string;
  target_keep_cents: number;
  spread: Spread;
  sites: SiteDraft[];
  asks: { kind: 'clarify'; field: string; sites: Site[] }[];
};

export type PlanOptions = {
  rows: Parameters<typeof buildListing>[2]['rows'];
  linked: Site[];                                    // the sites the person linked; nothing is drafted for any other
  reach?: boolean;                                   // also post to the "ok" platforms
  target_keep_cents?: (l: SourceListing) => number | undefined;   // e.g. the price engine's q50 payout; else the source's keep
  posted_before?: (site: Site) => boolean;
  promoted?: boolean;
  live_on?: (l: SourceListing, site: Site) => boolean;            // already listed there (merge_items found a match)
  spread?: Spread;                                                  // default same_keep
  site_market?: (l: SourceListing, site: Site) => number | undefined;   // the market's median sale on that site, when shown
};

export function planItem(l: SourceListing, opts: PlanOptions): ItemPlan {
  const type = productType(l);
  const r = route(type, { reach: opts.reach ?? false });
  const source = feeSite(l.site);
  const target = opts.target_keep_cents?.(l) ?? (source ? keep(source, l.price_cents).keep_cents : l.price_cents);
  const card = toItemCard(l);
  const spread = opts.spread ?? 'same_keep';
  const sticker = source ? priceForKeep(source, target) : l.price_cents;   // the source site's price for this payout
  const floorKeep = l.floor_cents === undefined ? undefined : source ? keep(source, l.floor_cents).keep_cents : l.floor_cents;
  const verdicts = [
    ...r.post.map((e: { platform: string; verdict: string; reason: string }) => ({ ...e, action: 'post' as const })),
    ...r.offer.map((e: { platform: string; verdict: string; reason: string }) => ({ ...e, action: 'offer' as const })),
    ...r.warn.map((e: { platform: string; verdict: string; reason: string }) => ({ ...e, action: 'warn' as const })),
    ...r.never.map((e: { platform: string; verdict: string; reason: string }) => ({ ...e, action: 'never' as const })),
  ].filter(e => e.platform !== l.site && opts.linked.includes(e.platform as Site));

  const sites: SiteDraft[] = verdicts.map(e => {
    const site = e.platform as Site;
    const base: SiteDraft = { site, verdict: e.verdict, reason: e.reason, action: e.action };
    const fs = feeSite(site);
    if (opts.live_on?.(l, site)) return { ...base, action: 'live' };
    if (e.action === 'never' || !fs) return base;
    const { price: price_cents, why } = sitePrice(spread, l.site, fs, target, sticker, opts.site_market?.(l, site));
    // The person's floor carries over as the same keep on every site (decisions: "you set the lowest you'd take").
    const floor_cents = floorKeep === undefined ? undefined : Math.min(price_cents, priceForKeep(fs, floorKeep));
    const built = buildListing(card, site, {
      rows: opts.rows, price_cents, floor_cents: floor_cents ?? 0,
      posted_before: opts.posted_before?.(site) ?? false, promoted: opts.promoted ?? false,
    });
    const listing = floor_cents === undefined ? { ...built, missing: [...built.missing, 'floor'], ready: false } : built;
    return { ...base, price_cents, floor_cents, keep_cents: keep(fs, price_cents).keep_cents, why, listing };
  });

  const asks = new Map<string, { kind: 'clarify'; field: string; sites: Site[] }>();
  for (const d of sites) for (const field of d.listing?.missing ?? []) {
    const ask = asks.get(field) ?? { kind: 'clarify' as const, field, sites: [] };
    ask.sites.push(d.site);
    asks.set(field, ask);
  }
  return {
    source: { site: l.site, external_id: l.external_id, url: l.url, title: l.title, price_cents: l.price_cents },
    product_type: type, target_keep_cents: target, spread, sites, asks: [...asks.values()],
  };
}

// Fees and prices here are US dollars (money D9), so a listing in another currency is skipped with its reason.
export function planCrosslist(listings: SourceListing[], opts: PlanOptions) {
  const active = listings.filter(l => l.state === 'active');
  return {
    plans: active.filter(l => l.currency === 'USD').map(l => planItem(l, opts)),
    skipped: active.filter(l => l.currency !== 'USD').map(l => ({ external_id: l.external_id, why: `priced in ${l.currency}, not USD` })),
  };
}

export const operationId = (plan: ItemPlan, site: Site) => `crosslist:${plan.source.site}:${plan.source.external_id}:${site}`;

// Posts each ready draft the person approved. `approved(plan, site)` is the first_post decision's answer; a site with no
// answer is not posted. The harness never replays a write with the same operation_id, so running this twice is safe.
export async function postCrosslist(plans: ItemPlan[], post: Post, approved: (plan: ItemPlan, site: Site) => boolean) {
  const results: { source_id: string; site: Site; state: 'posted' | 'not_ready' | 'not_approved' | 'failed' | 'reconcile'; reply?: Awaited<ReturnType<Post>> }[] = [];
  for (const plan of plans) for (const d of plan.sites) {
    if (d.action !== 'post' && d.action !== 'offer') continue;
    const source_id = plan.source.external_id;
    if (!d.listing?.ready) { results.push({ source_id, site: d.site, state: 'not_ready' }); continue; }
    if (!approved(plan, d.site)) { results.push({ source_id, site: d.site, state: 'not_approved' }); continue; }
    const reply = await post(d.site, { operation_id: operationId(plan, d.site), listing: d.listing, source_url: plan.source.url });
    results.push({ source_id, site: d.site, state: reply.ok ? 'posted' : reply.error?.code === 'outcome_unknown' ? 'reconcile' : 'failed', reply });
  }
  return results;
}
