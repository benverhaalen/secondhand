/**
 * Sold comps from the harness's public sold searches (Mercari `itemStatuses=2`, Poshmark `availability=sold_out`),
 * turned into the comps engine's rows (money D1). One source per site, so a slow or blocked site never holds the rest:
 * check() races every source against its deadline. A site the harness cannot reach adds nothing and is logged.
 *
 * Rules, each an agent proposal until the engines lead or Ben changes it (spec/plans/backtest/how-we-price.md §3):
 * - Only rows the site marks sold, with a price.
 * - Search rows carry no sale date. The listing date stands in: the sale came after it, so a comp's age is never
 *   understated and D1's age decay can only count it for less. A row with neither date is dropped.
 * - A title holding every word of the query is the same product (D1 match 0.5); any other hit is the family (0.25).
 *   An unverified "looks similar" hit would be 0 in D1; a keyword hit from the product's own name is one step above it.
 * - A condition the site states maps to D2's grades and adjusts the comp (extraction 0.9, a site field). An unstated
 *   one is not guessed: the comp takes the item's grade, so no adjustment, and counts for less (0.7, inferred).
 * - may_model is false: scraped rows are cited to the person, never trained on (plan decision 32).
 */
import { DEFAULTS, type Comp } from './comps.ts';

export type SoldSite = 'mercari' | 'poshmark';
export type SoldRow = { external_id?: unknown; url?: unknown; state?: unknown; price_cents?: unknown; title?: unknown;
  listed_at?: unknown; sold_at?: unknown; condition?: unknown; size?: unknown };
type Reply = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };
export type Call = (site: SoldSite, verb: 'search', args: Record<string, unknown>) => Promise<Reply>;

const GRADES: Record<string, string> = { 'new with tags': 'new_with_tags', nwt: 'new_with_tags', new: 'new_without_tags',
  'new without tags': 'new_without_tags', 'like new': 'excellent', excellent: 'excellent', good: 'good', fair: 'fair',
  poor: 'for_parts', 'for parts': 'for_parts' };
const words = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 1);
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
const isoDate = (v: unknown) => (text(v) && Number.isFinite(Date.parse(v as string)) ? (v as string) : undefined);

export function toComps(site: SoldSite, rows: readonly SoldRow[], q: { query: string; condition: string }): Comp[] {
  const want = words(q.query);
  const out: Comp[] = [];
  for (const r of rows) {
    const id = text(r.external_id), price = r.price_cents, at = isoDate(r.sold_at) ?? isoDate(r.listed_at);
    if (r.state !== 'sold' || !id || !at || !(typeof price === 'number' && Number.isSafeInteger(price) && price > 0)) continue;
    const have = new Set(words(text(r.title) ?? ''));
    const level: Comp['level'] = want.length > 0 && want.every(w => have.has(w)) ? 'product' : 'family';
    const grade = GRADES[(text(r.condition) ?? '').toLowerCase()];
    out.push({ comp_id: `${site}:${id}`, site, sold_at: at, price_cents: price, kind: 'sold', level, w_match: DEFAULTS.w_match[level],
      condition: grade ?? q.condition, w_extract: grade ? DEFAULTS.w_extract.structured : DEFAULTS.w_extract.inferred,
      ...(text(r.size) ? { size: text(r.size) } : {}), may_model: false, citation: text(r.url) ?? `${site}:${id}` });
  }
  return out;
}

export function soldSources(call: Call, sites: readonly SoldSite[], q: { query: string; condition: string; error(where: string, e: unknown): void }) {
  return sites.map(site => async (_signal: AbortSignal): Promise<Comp[]> => {
    const reply = await call(site, 'search', { q: q.query, status: 'sold' }).catch((e: unknown) => ({ ok: false as const, error: { code: 'thrown', message: String(e) } }));
    if (!reply.ok) { q.error(`valuation.sold.${site}`, `${reply.error.code}: ${reply.error.message}`); return []; }
    const rows = Array.isArray(reply.data) ? reply.data : Array.isArray((reply.data as { rows?: unknown })?.rows) ? (reply.data as { rows: SoldRow[] }).rows : [];
    return toComps(site, rows as SoldRow[], q);
  });
}
