// What a Poshmark page says about a listing, read from Poshmark's own data, and whether it fits a want.
// Used by the stage watcher (scripts/demo/stage-watch.mjs --want) and the alert trial (scripts/demo/alert-trial.mjs).
//
// Poshmark puts its page data in window.__INITIAL_STATE__: search cards at $_search.gridData.data[], a listing page at
// $_listing_details.listingDetails (observed on Ben's Mac, 2026-11-15; research/watch/ben/brewers-alert-trial.md).
// Each card carries price_amount.val (a string), inventory.status and size_quantities[].size_obj.display,
// catalog.department_obj.display (Men, Women, Kids), catalog.category_feature_objs[0].display ("Jerseys") and
// first_published_at. The markup's text is only a fallback when that block is missing.
//
// Rests-on: spec/features/watch.md (alert rule: fits AND under the ceiling AND live), research/watch/ben/page-monitor/monitor.mjs.
import { SITES, extractListings } from '../../research/watch/ben/page-monitor/monitor.mjs';

const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const textOf = html => decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// A Poshmark listing URL's slug is its title: /listing/Majestic-Milwaukee-Brewers-Jersey-<id>.
export const titleFromSlug = url => { const m = /\/listing\/(.+)-[0-9a-f]{24}/.exec(url ?? ''); return m ? decodeURIComponent(m[1]).replace(/-/g, ' ').trim() : null; };

// The object assigned to window.__INITIAL_STATE__, cut out by matching brackets outside strings.
export function poshState(html) {
  const m = /window\.__INITIAL_STATE__\s*=\s*/.exec(html);
  if (!m) return null;
  let depth = 0, inStr = false, esc = false, i = m.index + m[0].length;
  const from = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') { if (--depth === 0) break; }
  }
  try { return JSON.parse(html.slice(from, i + 1)); } catch { return null; } // not JSON: the caller falls back to the markup
}

export function fields(o) {
  if (!o || typeof o !== 'object') return null;
  const c = o.catalog ?? {}, sq = o.inventory?.size_quantities ?? [], inv = o.inventory?.status ?? null;
  const price = Number(o.price_amount?.val), published = Date.parse(o.first_published_at ?? '');
  return {
    title: o.title ?? null, price: Number.isFinite(price) ? price : null,
    size: sq.length ? sq.map(q => q.size_obj?.display ?? q.size_id).join(',') : (o.size_obj?.display ?? null),
    department: c.department_obj?.display ?? null,
    category: c.category_feature_objs?.[0]?.display ?? c.category_obj?.display ?? null,
    sold: o.status === 'sold' || (inv != null && inv !== 'available'),
    published_at: Number.isFinite(published) ? published : null,
  };
}

// One row per listing on a search page, in page order.
export function cards(html) {
  const known = new Map((poshState(html)?.$_search?.gridData?.data ?? []).map(o => [o.id, fields(o)]));
  const re = new RegExp(SITES.poshmark.source, 'g'), first = new Map();
  for (const m of html.matchAll(re)) if (!first.has(m[1])) first.set(m[1], { index: m.index, href: m[0] });
  const ids = [...first.keys()];
  return ids.map((id, i) => {
    const { index, href } = first.get(id), url = href.startsWith('http') ? href : `https://poshmark.com${href}`;
    const k = known.get(id);
    if (k) return { site_id: id, url, position: i + 1, ...k, title: k.title ?? titleFromSlug(url) };
    // No page data: read the card's text. The link starts inside a tag and the next card's ends inside one; drop both.
    const end = i + 1 < ids.length ? first.get(ids[i + 1]).index : Math.min(html.length, index + 6000);
    const raw = html.slice(index, end), text = textOf(raw.slice(raw.indexOf('>') + 1, raw.lastIndexOf('<') > 0 ? raw.lastIndexOf('<') : raw.length));
    const price = /\$\s?(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)/.exec(text);
    const size = /Size:?\s*([^$|]{1,24}?)(?=\s{0,2}(?:\$|\||$|[A-Z][a-z]+\s))/.exec(text);
    return { site_id: id, url, position: i + 1, title: titleFromSlug(url), price: price ? Number(price[1].replace(/,/g, '')) : null,
      size: size ? size[1].trim() : null, sold: /\bSOLD\b/.test(text), department: null, category: null, published_at: null };
  });
}

// What a listing's own page says. jsonld_price is what the stage watcher's confirm step reads; null means it can't pass.
export function listingFacts(html, site_id) {
  const ld = extractListings(html, 'poshmark').find(r => r.site_id === site_id && !r.guessed);
  const meta = name => decode((new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)`, 'i').exec(html) ?? [])[1] ?? '') || null;
  const st = fields(poshState(html)?.$_listing_details?.listingDetails);
  const text = st ? '' : textOf(html);
  const size = st ? null : /\bSize\s*:?\s*((?:Youth|Boys|Girls|Kids|Toddler|Women'?s|Men'?s)?\s*(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|OS|One Size|\d{1,2}(?:T|\/\d{1,2})?))\b/i.exec(text);
  return {
    jsonld_price: ld?.price ?? null,
    available: st ? !st.sold : ld ? !ld.sold : /\bSOLD\b|not available/i.test(text) ? false : null,
    title: meta('og:title'), description: (meta('og:description') ?? '').slice(0, 400),
    size: st?.size ?? (size ? size[1].trim() : null), department: st?.department ?? null, category: st?.category ?? null,
    published_at: st?.published_at ?? null,
  };
}

// want: { team: [regex], item: [regex], not: [regex], sizes: ["L", "XL"], cap }. Every reason it fails, so a miss is explainable.
export function judge(want, row, facts = null) {
  const words = [row.title, facts?.title, facts?.description].filter(Boolean).join(' ');
  const has = list => list.some(p => new RegExp(p, 'i').test(words));
  const size = (facts?.size ?? row.size ?? '').trim();
  const reasons = [];
  if (!has(want.team)) reasons.push('not the team');
  if (!has(want.item)) reasons.push('not a jersey');
  const cut = want.not.find(p => new RegExp(p, 'i').test([row.title, facts?.title, size].filter(Boolean).join(' ')));
  if (cut) reasons.push(`cut or kind: ${cut}`);
  // The site's own department and category beat words in a title: a boys' XXL displays as "XXL".
  const dept = facts?.department ?? row.department, cat = facts?.category ?? row.category;
  if (dept && want.departments && !want.departments.includes(dept)) reasons.push(`department ${dept}`);
  if (cat && want.category && cat !== want.category) reasons.push(`category ${cat}`);
  if (!size) reasons.push('size not stated');
  else if (!size.split(',').some(z => want.sizes.some(s => new RegExp(`^(?:men'?s\\s*|us\\s*)?${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(z.trim())))) reasons.push(`size ${size}`);
  const price = facts?.jsonld_price ?? row.price;
  if (price == null) reasons.push('no price');
  else if (price > want.cap) reasons.push(`$${price} over $${want.cap}`);
  if (row.sold || facts?.available === false) reasons.push('sold');
  return { fits: reasons.length === 0, reasons };
}
