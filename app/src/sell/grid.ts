// What the Sell grid shows: order, filters and how dense the tiles are. No rendering here.
// Pills are the decided Sell pills (product/decisions.md, the Sell tab) plus Failed (spec/lifecycle.mjs itemPill).
// Sites are the five core values of account.site in spec/product.md.

export const PILLS = ['Researching', 'Review', 'Live', 'Offer', 'Ship by', 'Sold', 'Slow', 'Failed'] as const;
export const SITES = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'] as const;
export type Pill = (typeof PILLS)[number];
export type Site = (typeof SITES)[number];

export type SellItem = { id: string; pill: Pill; sites: Site[]; price_cents: number | null; listed_at: string };

export type Sort = 'latest' | 'price_high' | 'price_low';
export type View = { sort?: Sort; site?: Site; pills?: Pill[] };

const byLatest = (a: SellItem, b: SellItem) => b.listed_at.localeCompare(a.listed_at);
const byPrice = (direction: 1 | -1) => (a: SellItem, b: SellItem) => {
  if (a.price_cents === null || b.price_cents === null) return Number(a.price_cents === null) - Number(b.price_cents === null) || byLatest(a, b);
  return direction * (a.price_cents - b.price_cents) || byLatest(a, b);
};
const ORDER: Record<Sort, (a: SellItem, b: SellItem) => number> = { latest: byLatest, price_high: byPrice(-1), price_low: byPrice(1) };

export function viewItems(items: SellItem[], { sort = 'latest', site, pills }: View): SellItem[] {
  return items
    .filter(i => (!site || i.sites.includes(site)) && (!pills || pills.includes(i.pill)))
    .sort(ORDER[sort]);
}

// A filter is offered only when it would match something.
export function filtersFor(items: SellItem[]): { sites: Site[]; pills: Pill[] } {
  return {
    sites: SITES.filter(s => items.some(i => i.sites.includes(s))),
    pills: PILLS.filter(p => items.some(i => i.pill === p)),
  };
}

// Fixed views for the demo. A learned or asked-for view can replace these later (ideas board).
export const PRESETS: { id: string; label: string; view: View }[] = [
  { id: 'all', label: 'All', view: {} },
  { id: 'needs_you', label: 'Needs you', view: { pills: ['Review', 'Offer', 'Ship by', 'Failed'] } },
  { id: 'live', label: 'Live', view: { pills: ['Live', 'Offer', 'Slow'] } },
  { id: 'sold', label: 'Sold', view: { pills: ['Sold', 'Ship by'] } },
];

export type TilePart = 'photo' | 'pill' | 'sites' | 'price' | 'title';
// Loosest first. Each step toward dense drops details and never adds one.
export const DENSITIES: { columns: number; shows: TilePart[] }[] = [
  { columns: 2, shows: ['photo', 'pill', 'sites', 'price', 'title'] },
  { columns: 3, shows: ['photo', 'pill', 'sites', 'price'] },
  { columns: 4, shows: ['photo', 'pill', 'sites'] },
  { columns: 5, shows: ['photo', 'pill'] },
];
export const DEFAULT_DENSITY = 1;

const PINCH_OUT = 1.25, PINCH_IN = 0.8;
// scale is the pinch gesture's final scale: above 1 the fingers spread, below 1 they closed.
export function pinchDensity(current: number, scale: number): number {
  const step = scale >= PINCH_OUT ? -1 : scale <= PINCH_IN ? 1 : 0;
  return Math.min(DENSITIES.length - 1, Math.max(0, current + step));
}
