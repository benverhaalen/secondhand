// One reader per site: the site's own public signed-out search page in, rows out (engine doc §3.5, protocol-and-adapters §38).
// A field the page did not carry is absent, never guessed. A page whose cards stopped carrying a required field is `page_changed`.
import { classifyRead, fail } from '../../harness/protocol.ts';
import type { Site, Field } from '../../harness/protocol.ts';

export type Kind = 'search' | 'sold';
export interface Row {
  id?: string; title?: string; price_cents?: number; currency?: string; url?: string;
  condition?: string; image_url?: string; seller_hash?: string; sold?: true; sold_date?: string;
}
export type Read = ReturnType<typeof classifyRead<Row & Record<string, unknown>>>;

export const REQUIRED = ['id', 'title', 'price_cents', 'url'] as const;
const FIELDS: Field[] = REQUIRED.map(name => ({ name, type: name === 'price_cents' ? 'number' : 'string', needs_session: false, required: true }) as Field);

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, ' '));
const grab = (h: string, re: RegExp) => { const m = re.exec(h); return m?.[1] === undefined ? undefined : m[1]; };
const price = (t: string | undefined): { price_cents?: number; currency?: string } => {
  const m = t === undefined ? null : /([$£€])\s*([\d,]+(?:\.\d{1,2})?)/.exec(t);
  if (!m) return {};
  return { price_cents: Math.round(Number((m[2] as string).replace(/,/g, '')) * 100), currency: ({ $: 'USD', '£': 'GBP', '€': 'EUR' } as Record<string, string>)[m[1] as string] as string };
};
const image = (c: string) => grab(c, /<img[^>]+?(?:data-src|src)="(https?:[^"]+)"/i);
const put = (r: Row, k: keyof Row, v: unknown) => { if (v !== undefined && v !== '') (r as Record<string, unknown>)[k] = v; };

// Cards are the chunks between card-start markers; `anchor` counts item links so "zero cards but links present" is page_changed.
interface Spec { start: RegExp; anchor: RegExp; card: (c: string) => Row }
const SPECS: Record<Exclude<Site, 'offerup'>, Spec> = {
  ebay: {
    start: /<li[^>]+class="[^"]*\bs-item\b/g, anchor: /href="[^"]*\/itm\/\d+/g,
    card: c => { const r: Row = {}; const href = grab(c, /<a[^>]+s-item__link[^>]+href="([^"]+)"/);
      put(r, 'url', href); put(r, 'id', grab(href ?? '', /\/itm\/(?:[^/?]*\/)?(\d+)/));
      put(r, 'title', strip(grab(c, /s-item__title[^>]*>([\s\S]*?)<\/(?:div|span|h3)>/) ?? ''));
      Object.assign(r, price(strip(grab(c, /s-item__price[^>]*>([\s\S]*?)<\/span>/) ?? '')));
      put(r, 'image_url', image(c)); put(r, 'condition', strip(grab(c, /SECONDARY_INFO[^>]*>([\s\S]*?)<\/span>/) ?? '')); return r; },
  },
  poshmark: {
    start: /<div[^>]+class="[^"]*\btile-grid-redesign\b/g, anchor: /href="\/listing\/[^"]*-[0-9a-f]{24}"/g,
    card: c => { const r: Row = {}; const href = grab(c, /href="(\/listing\/[^"]+)"/);
      put(r, 'url', href); put(r, 'id', grab(href ?? '', /-([0-9a-f]{24})$/));
      put(r, 'title', strip(grab(c, /tile-grid-redesign__title[^>]*>([\s\S]*?)<\/span>/) ?? ''));
      Object.assign(r, price(strip(grab(c, /tile-grid-redesign__price-current[^>]*>([\s\S]*?)<\/span>/) ?? '')));
      put(r, 'image_url', image(c)); if (/tile-grid-redesign__condition-nwt/.test(c)) r.condition = 'NWT'; return r; },
  },
  // Seen live 2026-11-15: each card is a div carrying the item id, its price in cents and its status; the link wraps the rest.
  mercari: {
    start: /<div id="m\d+" data-itemprice="\d+"/g, anchor: /href="\/us\/item\/m\d+/g,
    card: c => { const r: Row = {}; const href = grab(c, /href="(\/us\/item\/[^"]+)"/);
      put(r, 'url', href); put(r, 'id', grab(c, /^<div id="(m\d+)"/));
      put(r, 'title', decode(strip(grab(c, /data-testid="ItemName"[^>]*>([\s\S]*?)<\/p>/) ?? '')));
      const cents = Number(grab(c, /data-itemprice="(\d+)"/)); if (cents > 0 && Number.isSafeInteger(cents)) { r.price_cents = cents; r.currency = 'USD'; }
      if (grab(c, /data-itemstatus="([a-z_]+)"/) === 'sold_out') r.sold = true;
      put(r, 'image_url', image(c)); return r; },
  },
  depop: {
    start: /<li[^>]+class="[^"]*listItem/g, anchor: /href="\/products\/[^"/]+\/?"/g,
    card: c => { const r: Row = {}; const href = grab(c, /href="(\/products\/[^"]+)"/);
      put(r, 'url', href); put(r, 'id', grab(href ?? '', /\/products\/([^/]+)/));
      put(r, 'title', decode(grab(c, /<a[^>]+aria-label="([^"]*)"/) ?? ''));
      Object.assign(r, price(strip(grab(c, /aria-description="(?:Discounted price|Price)"[^>]*>([\s\S]*?)<\/p>/) ?? ''))); // a marked-down card shows "Full price" then "Discounted price"; the buyer pays the second
      put(r, 'image_url', image(c)); return r; },
  },
  // *agent proposal*: no recorded Grailed page exists (the live fetch is blocked), so this shape is the listing-link convention, unverified.
  grailed: {
    start: /<(?:div|a)[^>]+data-testid="listing-card"/g, anchor: /href="\/listings\/\d+/g,
    card: c => { const r: Row = {}; const href = grab(c, /href="(\/listings\/[^"]+)"/);
      put(r, 'url', href); put(r, 'id', grab(href ?? '', /\/listings\/(\d+)/));
      put(r, 'title', strip(grab(c, /data-testid="listing-title"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/) ?? ''));
      Object.assign(r, price(strip(grab(c, /data-testid="listing-price"[^>]*>([\s\S]*?)<\/[a-z0-9]+>/) ?? '')));
      put(r, 'image_url', image(c)); return r; },
  },
  facebook: {
    start: /<a[^>]+href="\/marketplace\/item\/\d+/g, anchor: /href="\/marketplace\/item\/\d+/g,
    card: c => { const r: Row = {}; const href = grab(c, /href="(\/marketplace\/item\/[^"]+)"/);
      put(r, 'url', href); put(r, 'id', grab(href ?? '', /\/item\/(\d+)/));
      put(r, 'title', strip(grab(c, /data-title[^>]*>([\s\S]*?)<\/span>/) ?? ''));
      Object.assign(r, price(strip(grab(c, /data-price[^>]*>([\s\S]*?)<\/span>/) ?? '')));
      put(r, 'image_url', image(c)); return r; },
  },
};

const chunks = (html: string, start: RegExp): string[] => {
  const at = [...html.matchAll(start)].map(m => m.index as number);
  return at.map((s, i) => html.slice(s, at[i + 1] ?? html.length));
};

const walkListings = (o: unknown, out: Record<string, unknown>[], d = 0): void => {
  if (d > 8 || !o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) walkListings(x, out, d + 1); return; }
  const rec = o as Record<string, unknown>;
  if (rec.listing && typeof rec.listing === 'object' && 'listingId' in (rec.listing as object)) { out.push(rec.listing as Record<string, unknown>); return; }
  for (const v of Object.values(rec)) walkListings(v, out, d + 1);
};

// OfferUp: the page's own embedded state (__NEXT_DATA__). Ads in the feed carry no `listing` and are skipped.
function offerup(html: string, base: string): { rows: Row[]; anchors: number } {
  const raw = grab(html, /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (raw === undefined) return { rows: [], anchors: (html.match(/\/item\/detail\//g) ?? []).length };
  let data: unknown; try { data = JSON.parse(raw); } catch { return { rows: [], anchors: 1 }; }
  const found: Record<string, unknown>[] = []; walkListings(data, found);
  const rows = found.map(l => {
    const r: Row = {}; const id = typeof l.listingId === 'string' ? l.listingId : undefined;
    put(r, 'id', id); if (id) r.url = `${base}/item/detail/${id}`;
    put(r, 'title', typeof l.title === 'string' ? decode(l.title) : undefined);
    const p = typeof l.price === 'string' && /^\d+(\.\d+)?$/.test(l.price) ? l.price : undefined;
    const c = p === undefined ? NaN : Math.round(Number(p) * 100);
    if (Number.isSafeInteger(c)) { r.price_cents = c; r.currency = 'USD'; } // a price too long to be whole cents is dropped, never passed on
    put(r, 'condition', typeof l.conditionText === 'string' ? l.conditionText : undefined);
    const img = l.image as { url?: unknown } | null; put(r, 'image_url', typeof img?.url === 'string' ? img.url : undefined);
    return r;
  });
  return { rows, anchors: rows.length };
}

export const BASE: Record<Site, string> = {
  ebay: 'https://www.ebay.com', poshmark: 'https://poshmark.com', mercari: 'https://www.mercari.com', depop: 'https://www.depop.com',
  grailed: 'https://www.grailed.com', offerup: 'https://offerup.com', facebook: 'https://www.facebook.com',
};

// The site's own search address. `null` where the site shows no sold results signed out.
export function searchUrl(site: Site, q: string, kind: Kind): string | null {
  const e = encodeURIComponent(q);
  const u: Record<Site, [string, string | null]> = {
    ebay: [`${BASE.ebay}/sch/i.html?_nkw=${e}`, `${BASE.ebay}/sch/i.html?_nkw=${e}&LH_Sold=1&LH_Complete=1`],
    poshmark: [`${BASE.poshmark}/search?query=${e}`, `${BASE.poshmark}/search?query=${e}&availability=sold_out`],
    mercari: [`${BASE.mercari}/search/?keyword=${e}`, `${BASE.mercari}/search/?keyword=${e}&status=sold_out`],
    depop: [`${BASE.depop}/search/?q=${e}`, null],
    grailed: [`${BASE.grailed}/search?query=${e}`, null],
    offerup: [`${BASE.offerup}/search?q=${e}`, null],
    facebook: [`${BASE.facebook}/marketplace/search?query=${e}`, null],
  };
  return u[site][kind === 'sold' ? 1 : 0];
}

// Read one page. Absolute urls; `sold` is set only where the sold filter was the request.
export function readPage(site: Site, html: string, kind: Kind = 'search'): Read {
  const base = BASE[site];
  let rows: Row[]; let anchors: number;
  if (site === 'offerup') ({ rows, anchors } = offerup(html, base));
  else {
    const s = SPECS[site];
    rows = chunks(html, s.start).map(c => s.card(c)).map(r => (r.url ? { ...r, url: new URL(r.url, base).href } : r));
    anchors = (html.match(s.anchor) ?? []).length;
  }
  const shaped = rows.map(r => ({ ...r, ...(kind === 'sold' ? { sold: true as const } : {}) })) as (Row & Record<string, unknown>)[];
  // Links present but no card read means the cards changed shape: every required field is missing.
  if (anchors > 0 && shaped.length === 0) return fail('page_changed', `missing ${REQUIRED.join(', ')}`, { do: 'author', missing: [...REQUIRED] });
  // The system always answers: a card missing a required field is dropped and counted, and the rest are returned. Only a page
  // where no card carries every required field has changed shape (Nate, product/words.md 2026-11-15; before, one such card failed the page).
  const whole = shaped.filter(r => REQUIRED.every(k => r[k] !== undefined && r[k] !== ''));
  const read = classifyRead({ challenge: false, rows: whole.length > 0 ? whole : shaped }, { site, fields: FIELDS });
  const dropped = whole.length > 0 ? shaped.length - whole.length : 0;
  return read.ok && dropped > 0 ? { ...read, dropped } : read;
}
