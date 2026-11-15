// What the buy side's pages read from the demo world: no rendering here, so it loads in node tests (read.test.ts).
// Names follow spec/product.md (want, match, match label) and spec/features/buy.md.
import { product, SEARCH_DUNKS, SEARCH_EMPTY, SEARCH_SLOW, usd } from '../demo/index.ts';
import type { Match, Product, SearchResult, Site, Want } from '../demo/index.ts';
import colourData from './colours.json' with { type: 'json' };

const dollars = (cents: number) => cents / 100;

// What the person pays and how: delivered to the door, or the price at a pickup with how far it is (M26, delivered price).
export function paysFor(m: Pick<Match, 'seller' | 'delivered_cents'>): { what: string; amount: string } {
  if (m.seller.startsWith('pickup')) return { what: m.seller.replace(/^pickup/, 'Pickup').replace(/ away$/, ''), amount: usd(m.delivered_cents) };
  return { what: 'Delivered', amount: usd(m.delivered_cents) };
}

// A card's fact line: the condition, then what the person pays and how ("Like new, delivered $72.50"). Rows under one
// product share a title, so the condition is what tells them apart (spec buy.md step 3: each row's condition).
export function cardLine(m: Pick<Match, 'condition' | 'seller' | 'delivered_cents'>): { what: string; amount: string } {
  const c = m.condition.replace(/^Used, /, ''), cond = c.charAt(0).toUpperCase() + c.slice(1);
  const how = m.seller.startsWith('pickup') ? m.seller.replace(/ away$/, '').replace(/^pickup, /, 'pickup ') : 'delivered';
  return { what: `${cond}, ${how}`, amount: usd(m.delivered_cents) };
}

// What an offer of this many dollars can't be: nothing, or over the asking price (an offer over it would pay more than
// buying outright). Null when it can be sent.
export function offerProblem(amount: number | null, priceCents: number): string | null {
  if (amount == null || !(amount > 0)) return 'Pick an amount';
  if (amount * 100 > priceCents) return `Over their price of ${usd(priceCents)}`;
  return null;
}

// Three whole-dollar amounts at or under the asking price, lowest first: about 15% under, the agent's guess (or about 7%
// under), and about 3% under. buy_offer asks every time (spec buy.md), so these are only what the picker starts from.
export function offerAmounts(priceCents: number, guessCents?: number): number[] {
  const p = dollars(priceCents), g = guessCents == null ? Math.round(p * 0.93) : Math.round(dollars(guessCents));
  const set = [...new Set([Math.round(p * 0.85), g, Math.round(p * 0.97)])].filter(a => a > 0 && a <= p).sort((a, b) => a - b);
  return set.length ? set : [Math.max(1, Math.round(p))];
}

// How a want's search stands, said by its tag (pages §6.12): every site in, how many are in so far, or paused.
export function wantTag(x: Pick<Want, 'state' | 'sites' | 'checked' | 'behind'>): { state: 'working' | 'ended'; word: string } {
  if (x.state === 'paused') return { state: 'ended', word: 'Paused' };
  const answered = x.sites.filter(s => x.checked[s] && !x.behind.includes(s)).length;
  return { state: 'working', word: answered < x.sites.length ? `${answered} of ${x.sites.length} sites` : 'Searching' };
}

// The order of results (spec buy.md, Ranking): the same thing first, then a likely match, then other sizes and similar
// ones, and within each, the lowest delivered total first. A wrong size above the right one wastes a hunter's look.
const LIKENESS = ['exact', 'likely_same_model', 'same_family_other_variant', 'comparable', 'unresolved'] as const;
export const rank = (rows: Match[]) => [...rows].sort((a, b) => LIKENESS.indexOf(a.label) - LIKENESS.indexOf(b.label) || a.delivered_cents - b.delivered_cents);

// Which search a query is, in the demo: the Dunks, the slow one (only one site in), or nothing found.
export function searchFor(q: string, at?: string): SearchResult {
  if (at === 'slow') return { ...SEARCH_SLOW, query: q || SEARCH_SLOW.query };
  if (at === 'none') return { ...SEARCH_EMPTY, query: q };
  const words = q.toLowerCase();
  if (/dunk|nike/.test(words)) return { ...SEARCH_DUNKS, query: q };
  return { ...SEARCH_EMPTY, query: q };
}

// Who stands behind a purchase on each site (research/sold/nate/trust-returns-disputes.md §9). A pickup has none.
export function cover(site: Site, pickup: boolean): string {
  if (pickup) return 'No site cover on a pickup. Pay when you see it.';
  return {
    ebay: 'Covered if it never comes or isn’t as described',
    depop: 'Covered if it’s lost, damaged or not as described',
    poshmark: 'Covered if it’s not as described. Fit isn’t covered.',
    mercari: 'Covered if you report a problem within 3 days',
    facebook: 'Covered when you pay in the site’s checkout',
  }[site];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-06" is "Jun".
export const monthLabel = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;

// ---- A want built by touch (spec/features/watch.md, "Building a want by touch"; Ben, words.md 2026-11-15) ----
// Each chip changes which listings match; anything else stays words. The demo's Want row has no low end, no ship or
// pickup, no colours and no size system, so the page keeps them on a draft beside the row (asked of the shared model).
export type How = 'ship' | 'pickup' | 'both';
export type WantDraft = Want & { low_cents: number | null; how: How; colours: string[]; size_system: string | null };
export type Sizes = { id: string; label: string; sizes: string[] };
export type Colour = { id: string; name: string; hex: string };

export const ALL_SITES: Site[] = ['ebay', 'mercari', 'depop', 'facebook', 'poshmark'];
// Pickup within, in miles; 15 is the spec's default.
export const RADII = [5, 15, 25, 50];
// How worn, at least: four chips, new with tags to fair (watch.md). floor is the want's condition_floor words.
export const CONDITIONS = [
  { id: 'new', label: 'New with tags', floor: 'New with tags' }, { id: 'like-new', label: 'Like new', floor: 'Used, like new' },
  { id: 'good', label: 'Good', floor: 'Used, good' }, { id: 'fair', label: 'Fair', floor: 'Used, fair' },
];
export const conditionId = (floor?: string) => CONDITIONS.find(c => c.floor === floor)?.id ?? 'fair';

const SHOE_SIZES = (from: number, to: number) => Array.from({ length: (to - from) * 2 + 1 }, (_, i) => String(from + i / 2));
const SIZES: Record<'shoes' | 'apparel', Sizes[]> = {
  shoes: [{ id: 'mens', label: 'Men’s US', sizes: SHOE_SIZES(7, 13) }, { id: 'womens', label: 'Women’s US', sizes: SHOE_SIZES(5, 11) }],
  apparel: [{ id: 'letter', label: 'Letter', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }],
};
// The colours the listings come in (colours.json: content, like a photo, so data and not tokens), for the kinds whose
// colour is a choice; a product with one colourway (Grey Fog) has no colour chip at all.
const COLOURS: [RegExp, Colour[]][] = Object.entries(colourData).filter(([k]) => k !== '_').map(([k, v]) => [new RegExp(k, 'i'), v as Colour[]]);

// What kind of thing the words are, when no product was found: only kinds whose size is a chip need knowing.
export function kindOf(text: string, category?: string | null): 'shoes' | 'apparel' | null {
  if (category === 'shoes' || category === 'apparel') return category;
  if (/\b(shoes?|sneakers?|boots?|dunks?|jordans?)\b/i.test(text)) return 'shoes';
  if (/\b(jersey|shirt|tee|t-shirt|jacket|hoodie|sweater|dress|jeans|coat)\b/i.test(text)) return 'apparel';
  return null;
}
export const sizesFor = (kind: 'shoes' | 'apparel' | null): Sizes[] => (kind ? SIZES[kind] : []);
export const coloursFor = (text: string, productId: string | null): Colour[] => (productId ? [] : COLOURS.find(([re]) => re.test(text))?.[1] ?? []);

// "around $60" is $48 to $72 (20% either side, watch.md); "under $80" tops out at $80; "$60" alone is around it. The
// price words come out of the text, so "men's 10 around $60" leaves size 10 behind and never reads 60 as a size.
export function priceWords(q: string): { low: number; high: number; rest: string } | null {
  const m = q.match(/\b(around|about|under|below|up to|max)?\s*\$\s?(\d+(?:\.\d+)?)|\b(around|about|under|below)\s+(\d+(?:\.\d+)?)\b/i);
  if (!m || m.index == null) return null;
  const word = (m[1] ?? m[3] ?? 'around').toLowerCase(), n = Number(m[2] ?? m[4]);
  const rest = (q.slice(0, m.index) + q.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').replace(/[\s,]+$/, '').trim();
  if (/under|below|up to|max/.test(word)) return { low: Math.round(n * 0.6), high: n, rest };
  return { low: Math.round(n * 0.8), high: Math.round(n * 1.2), rest };
}

// A size in the words: "men's 10", "size 10", "10.5"; "M" or "XL" for clothes.
export function sizeWords(q: string, kind: 'shoes' | 'apparel' | null): { system: string | null; size: string | null } {
  if (kind === 'apparel') { const m = q.match(/\b(XXL|XL|XS|S|M|L)\b/); return { system: 'letter', size: m?.[1] ?? null }; }
  if (kind === 'shoes') {
    const m = q.match(/\b(\d{1,2}(?:\.5)?)\b/);
    return { system: /women/i.test(q) ? 'womens' : 'mens', size: m && Number(m[1]) >= 4 && Number(m[1]) <= 16 ? m[1] : null };
  }
  return { system: null, size: null };
}

// A new want, guessed from the words it came from: the product a search found, the price said (20% either side), or else
// a most at the middle of the fair range and a low end 20% under it, a size in the words, a used-good floor, ship or
// pickup within 15 miles, every site, alerts under the most.
export function wantFromWords(q: string): WantDraft {
  const said = priceWords(q), words = said?.rest ?? q;
  const r = searchFor(words), p = r.product_id ? product(r.product_id) : null;
  const kind = kindOf(words, p?.category), size = sizeWords(words, kind);
  const fair = p?.used_price.range ?? r.fair;
  const mid = fair ? Math.round((fair.low + fair.high) / 200) : null;
  const high = said?.high ?? mid, low = said?.low ?? (mid != null ? Math.round(mid * 0.8) : null);
  return {
    id: 'want_new', state: 'active', text: p ? `${p.brand} ${p.model}, ${p.variant}` : words, product_id: p?.id ?? null,
    fit: { size: size.size ?? undefined, condition_floor: 'Used, good', radius_mi: 15 }, max_total_cents: high != null ? high * 100 : null,
    sites: ALL_SITES, checked: {}, behind: [], quiet_hours: null, alert: 'under',
    low_cents: low != null ? low * 100 : null, how: 'both', colours: [], size_system: size.system,
  };
}

// A saved want as a draft: its low end is 80% of its most, and a radius means it takes pickups too.
export function draftOf(x: Want): WantDraft {
  const p = x.product_id ? product(x.product_id) : null, kind = kindOf(x.text, p?.category);
  return { ...x, low_cents: x.max_total_cents != null ? Math.round(x.max_total_cents * 0.008) * 100 : null, how: x.fit.radius_mi != null ? 'both' : 'ship', colours: [], size_system: sizeWords(x.text, kind).system };
}

// The sold prices as dots, in dollars. The demo keeps a sold range and a count per site, not each sale, so each site's
// sales are spread over its range, bunched toward the middle as sold prices are; a real search gives the sales themselves.
export function soldDots(p: Pick<Product, 'by_site'> | null): number[] {
  if (!p) return [];
  return p.by_site.flatMap(s => {
    const sold = s.sold;
    if (!sold) return [];
    return Array.from({ length: s.basis_count }, (_, i) => Math.round(dollars(sold.low + (sold.high - sold.low) * (Math.acos(1 - 2 * ((i + 0.5) / s.basis_count)) / Math.PI))));
  });
}

// The track's ends: room under the lowest and over the highest of the range and the sales, in round fives.
export function priceBounds(low: number, high: number, dots: number[]): { min: number; max: number } {
  const lo = Math.min(low, ...dots), hi = Math.max(high, ...dots);
  return { min: Math.max(0, Math.floor((lo * 0.6) / 5) * 5), max: Math.ceil((hi * 1.3) / 5) * 5 };
}

// The first look on each site for a new want, in the order the sites answer: what each found that fits.
export function firstPass(x: Pick<WantDraft, 'text' | 'sites'>): { site: Site; found: number }[] {
  const rows = searchFor(x.text).rows;
  return x.sites.map(site => ({ site, found: rows.filter(r => r.site === site).length }));
}
