// How each site shows a listing: where the title goes and how long it may be, how many photos it takes and the shape of
// the cover. The item page says where a listing differs between sites from these (Ben, round 11: "different sites might
// have different listings written different ways with different images"). The source is
// research/list/ben/platforms/platform-fit.json; listing-forms.test.ts fails when this copy drifts from it.
// Metro watches only app/, log/ and spec/, so the app cannot read the research file itself.
import type { Site } from './types.ts';

export type ListingForm = {
  // Where the item's name goes: a title field, or the first line of the description (Depop has no title).
  title: 'title' | 'description_line_1';
  // The longest title the site takes, in characters; null when it has none.
  title_max: number | null;
  photos_max: number;
  // The cover's shape: most sites show a square, Poshmark a 3 by 4.
  cover: '1:1' | '3:4';
  // The length the site's buyers read best, in characters: the agent writes to it (a short title on Facebook, a full
  // one on eBay).
  aim: [number, number];
  // The site's buyers filter by size, so the title says "size L", not "L".
  size_label: boolean;
};

export const LISTING_FORMS: Record<Site, ListingForm> = {
  ebay: { title: 'title', title_max: 80, photos_max: 24, cover: '1:1', aim: [55, 80], size_label: false },
  facebook: { title: 'title', title_max: 99, photos_max: 10, cover: '1:1', aim: [25, 60], size_label: false },
  depop: { title: 'description_line_1', title_max: null, photos_max: 8, cover: '1:1', aim: [30, 65], size_label: true },
  poshmark: { title: 'title', title_max: 80, photos_max: 16, cover: '3:4', aim: [40, 80], size_label: true },
  mercari: { title: 'title', title_max: 80, photos_max: 12, cover: '1:1', aim: [40, 80], size_label: true },
};

// The title as the site will show it: cut at the last whole word that fits.
export function titleOn(site: Site, title: string): string {
  const max = LISTING_FORMS[site].title_max;
  if (max === null || title.length <= max) return title;
  const cut = title.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : title.slice(0, max)).replace(/[\s,]+$/, '');
}

// The title written for one site's buyers from the item's title and its known fields: the brand first when the title
// lacks it, "size L" where the site labels size, the model and specs where the title is shorter than the site's buyers
// read (eBay), then cut at a whole word to the length they read best.
export function listingTitle(site: Site, title: string, attrs: { name: string; value: string | number | null }[]): string {
  const f = LISTING_FORMS[site];
  const a = (n: string) => { const v = attrs.find(x => x.name === n)?.value; return v == null ? null : String(v); };
  const has = (t: string, s: string) => t.toLowerCase().includes(s.toLowerCase());
  let t = title;
  const brand = a('brand');
  if (brand && !has(t, brand)) t = `${brand} ${t}`;
  const size = a('size');
  if (f.size_label && size && !has(t, `size ${size}`)) t = t.endsWith(`, ${size}`) ? `${t.slice(0, -size.length)}size ${size}` : `${t}, size ${size}`;
  for (const n of ['model', 'storage']) { const v = a(n); if (v && t.length < f.aim[0] && !has(t, v)) t = `${t}, ${v}`; }
  return cut(t, f.aim[1]);
}

function cut(title: string, max: number): string {
  if (title.length <= max) return title;
  const head = title.slice(0, max + 1);
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : title.slice(0, max)).replace(/[\s,]+$/, '');
}

// Which sites a kind of thing goes to (spec/edge-cases.md §11): platform-fit's verdict and its reason for each site.
// best and good are posted by default; ok only when asked; avoid is greyed with its reason and can still be added; blocked
// can't be posted, and says why. The demo's categories map to platform-fit's types here; the rows are copied from
// platform-fit.json (straight apostrophes curled, and a site's name said as "it" or "a local site", since the row
// already shows its logo: L6), and listing-forms.test.ts fails when they drift.
export type Verdict = 'best' | 'good' | 'ok' | 'avoid' | 'blocked';
export const FIT_TYPE: Record<string, string> = {
  apparel: 'mens_mainstream', electronics: 'cameras_audio_gaming', furniture: 'furniture', lighting_home: 'home_decor', shoes: 'sneakers',
};
export const FIT: Record<string, Record<Site, [Verdict, string]>> = {
  mens_mainstream: {
    ebay: ['good', 'buyers lean male; Patagonia, Levi’s and Nike search well'],
    facebook: ['ok', 'fine locally at low prices'],
    depop: ['good', 'menswear is a main category'],
    poshmark: ['good', 'smaller men’s side, but top brands move'],
    mercari: ['ok', 'smaller men’s audience'],
  },
  cameras_audio_gaming: {
    ebay: ['best', 'model-number search; for-parts units still sell'],
    facebook: ['good', 'consoles sell fast'],
    depop: ['blocked', 'headphones, speakers and consoles are banned; cameras, film and lenses are allowed'],
    poshmark: ['ok', 'small cameras and headphones only'],
    mercari: ['good', 'core hobby category'],
  },
  furniture: {
    ebay: ['avoid', 'freight cost; local pickup only, which a local site does with no fee'],
    facebook: ['best', 'no shipping and no fee'],
    depop: ['avoid', 'a Home > Furniture category exists, but it ships only and its buyers want clothes'],
    poshmark: ['blocked', 'over the 15 lb cap, no pickup'],
    mercari: ['avoid', 'not eligible for national shipping'],
  },
  home_decor: {
    ebay: ['good', 'small, shippable pieces with a pattern or maker name'],
    facebook: ['best', 'the largest US category by listings'],
    depop: ['ok', 'small shippable homeware; no lighting, ashtrays or lighters'],
    poshmark: ['ok', 'must be under 5 lb and mailable'],
    mercari: ['good', 'small housewares sell'],
  },
  fan_apparel: {
    ebay: ['best', 'sports memorabilia and fan gear is core here'],
    facebook: ['ok', 'home-team buyers'],
    depop: ['good', 'jerseys are named under tops'],
    poshmark: ['ok', 'another site has the fan buyer'],
    mercari: ['ok', 'seasonal'],
  },
  sneakers: {
    ebay: ['best', '8% fee and no per-order fee at $150 and up; authentication'],
    facebook: ['ok', 'cash meetups in cities; buyers fear fakes'],
    depop: ['good', 'trainers are named in top shoes'],
    poshmark: ['good', 'Nike is a top brand; no authentication under $500'],
    mercari: ['good', 'designer shoes can be authenticated'],
  },
};

// The fit of one kind of thing on one site, with its reason as a sentence; null when the kind has no row. An item's own
// kind (a fan tee is fan_apparel) is narrower than its family's (apparel), so it wins.
export function fitOf(it: { category: string; kind?: string }, site: Site): { verdict: Verdict; why: string } | null {
  const row = (it.kind ? FIT[it.kind] : undefined)?.[site] ?? FIT[FIT_TYPE[it.category] ?? '']?.[site];
  return row ? { verdict: row[0], why: row[1].charAt(0).toUpperCase() + row[1].slice(1) } : null;
}

// Each site's returns rule in one line, for the plan (spec/edge-cases.md §10, "Returns terms": "shown on the plan per
// site in one line"). From research/sold/nate/trust-returns-disputes.md §1; Facebook's figures are asserted there.
export const RETURNS: Record<Site, string> = {
  ebay: 'Returns as you set them',
  facebook: 'No returns on pickup',
  depop: 'Refunds only if not as described',
  poshmark: 'No returns unless not as described',
  mercari: 'Not as described only, 72 hours',
};

// Best first: the plan lists the sites in this order, so it reads from where the thing sells best (platform-fit.json,
// verdicts: best and good post by default, ok only when asked, avoid says why, blocked never posts).
export const VERDICT_RANK: Record<Verdict, number> = { best: 0, good: 1, ok: 2, avoid: 3, blocked: 4 };
