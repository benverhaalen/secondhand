// connect `import` for Depop: the person's own Depop listings in, one SourceListing each out (spec/product.md "connect:
// import {listings, purchases}"; the `import` job runs `read_listings`). Server only. Depop's data is untrusted: a field is
// kept only when it has the right type, and a product without an id, a price or a photo is refused with the reason.
// Shapes read: the Partner API `Product` (partnerapi.depop.com openapi, `GET /api/v1/products/by-slug/{slug}/`, observed)
// and, unverified, the web app's product JSON, which names the same facts differently (see price() and photos()).
import type { SourceListing } from '../../engines/listing/crosslist.ts';

// Depop's condition codes (Partner API `condition` enum, observed) to the condition words the valuation engine prices
// (engines/valuation/comps.ts condition_ratios) and every site's form maps from.
const CONDITION: Record<string, string> = {
  brand_new: 'new_with_tags', used_like_new: 'new_without_tags', used_excellent: 'excellent', used_good: 'good', used_fair: 'fair',
};
// The web app spells the same states as words.
const CONDITION_WORDS: Record<string, string> = {
  'brand new': 'new_with_tags', 'like new': 'new_without_tags', excellent: 'excellent', good: 'good', fair: 'fair',
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(x => str(typeof x === 'object' && x ? (x as Raw).name ?? (x as Raw).id : x)).filter((x): x is string => !!x) : []);
const cents = (v: unknown) => { const n = num(v); return n === undefined ? undefined : Math.round(n * 100); };
const obj = (v: unknown): Raw | undefined => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Raw) : undefined);

// Agent proposal, unverified against a live response: the web product JSON may keep the price under `price` or `pricing`,
// the brand under `brandName`, pictures as `pictureData` of {formats}. Only the Partner API shape is tested.
function photos(raw: Raw): string[] {
  const list = (raw.pictures ?? raw.pictureData ?? raw.preview ?? []) as unknown;
  const out: string[] = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (typeof p === 'string') { out.push(p); continue; }
    const o = obj(p);
    if (!o) continue;
    const formats = obj(o.formats);
    const best = str(o.url) ?? str(obj(formats?.P0)?.url) ?? str(obj(formats?.P8)?.url) ?? str(obj(formats?.U0)?.url);
    if (best) out.push(best);
  }
  return [...new Set(out)];
}

function price(raw: Raw): { price_cents?: number; list_price_cents?: number; currency?: string } {
  const p = obj(raw.price) ?? obj(raw.pricing);
  if (p) {
    const full = cents(p.priceAmount ?? p.original_price ?? obj(p.originalPrice)?.totalPrice ?? p.amount);
    const now = cents(p.discountedPriceAmount ?? p.discounted_price ?? obj(p.discountedPrice)?.totalPrice) ?? full;
    return { price_cents: now, list_price_cents: full !== now ? full : undefined, currency: str(p.currencyName ?? p.currency) };
  }
  const full = cents(raw.price_amount);
  const now = cents(raw.discount_price) ?? full;
  return { price_cents: now, list_price_cents: full !== now ? full : undefined, currency: str(raw.price_currency) };
}

function condition(raw: Raw): string | undefined {
  const c = raw.condition;
  if (typeof c === 'string') return CONDITION[c] ?? CONDITION_WORDS[c.toLowerCase()];
  const o = obj(c);
  const id = str(o?.id), name = str(o?.name);
  return (id && CONDITION[id]) ?? (name && CONDITION_WORDS[name.toLowerCase()]);
}

function size(raw: Raw): string | undefined {
  const sizes = raw.sizes ?? raw.size;
  if (typeof sizes === 'string') return str(sizes);
  const first = Array.isArray(sizes) ? obj(sizes[0]) : obj(sizes);
  return str(first?.name) ?? str(first?.label);
}

const state = (raw: Raw): SourceListing['state'] => {
  const s = String(raw.status ?? (raw.sold === true ? 'sold' : raw.isSold === true ? 'sold' : 'onsale')).toLowerCase();
  return /sold/.test(s) ? 'sold' : 'active';
};

export type Refused = { refused: string; id?: string };

export function fromDepopProduct(raw: unknown): SourceListing | Refused {
  const r = obj(raw);
  if (!r) return { refused: 'not an object' };
  const id = str(r.product_id) ?? str(r.id) ?? (num(r.product_id ?? r.id) !== undefined ? String(num(r.product_id ?? r.id)) : undefined);
  const slug = str(r.slug);
  if (!id && !slug) return { refused: 'no product id or slug' };
  const description = str(r.description) ?? '';
  const { price_cents, list_price_cents, currency } = price(r);
  if (price_cents === undefined) return { refused: 'no price', id: id ?? slug };
  const pics = photos(r);
  if (!pics.length) return { refused: 'no photos', id: id ?? slug };
  const brand = str(r.brand) ?? str(r.brandName) ?? str(obj(r.brand)?.name);
  const tags = [...new Set([...strs(r.style), ...strs(r.age), ...strs(r.source), ...(description.match(/#[\p{L}\p{N}_]+/gu) ?? []).map(t => t.slice(1).toLowerCase())])];
  return {
    site: 'depop',
    external_id: id ?? (slug as string),
    url: `https://www.depop.com/products/${slug ?? id}/`,
    state: state(r),
    title: description.split('\n')[0]?.replace(/#[\p{L}\p{N}_]+/gu, '').trim() ?? '',
    description,
    price_cents,
    list_price_cents,
    currency: currency ?? 'USD',
    brand: brand && !/^other$/i.test(brand) ? brand : undefined,
    size: size(r),
    condition: condition(r),
    colours: strs(r.colour ?? r.colours ?? r.color),
    department: str(r.department) ?? str(obj(r.gender)?.name) ?? str(r.gender),
    category: str(r.product_type) ?? str(obj(r.productType)?.name) ?? str(r.productType) ?? str(obj(r.category)?.name) ?? str(r.category),
    tags,
    photos: pics,
    listed_at: str(r.date_created) ?? str(r.dateCreated) ?? str(r.created_at),
    likes: num(r.likes ?? r.likeCount ?? r.likesCount),
    views: num(r.views ?? r.viewCount),
  };
}

export function importDepop(raws: unknown[]): { listings: SourceListing[]; refused: Refused[] } {
  const listings: SourceListing[] = [], refused: Refused[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    const got = fromDepopProduct(raw);
    if ('refused' in got) { refused.push(got); continue; }
    if (seen.has(got.external_id)) continue;   // the shop grid and the product page both return a product; keep one
    seen.add(got.external_id);
    listings.push(got);
  }
  return { listings, refused };
}
