// Recall matching (spec/engines/trust.md §2 Recall, §3 step 11). Fixed rules, never learned.
// Matches a listing, draft or weighed purchase against CPSC recall rows on GTIN-14, model tokens and date codes read from
// Title and Description (the model number often sits only there), then on name alone.
//   exact -> post blocked, live listing taken down, buy_offer not drafted.  name -> held; posting needs the person to check the identifier.
export type RecallRow = {
  RecallID: number | string; RecallDate: string; LastPublishDate: string; Title: string; Description: string;
  Products?: { Name?: string; Model?: string; Description?: string }[]; ProductUPCs?: { UPC?: string }[];
};
export type Listing = { id: string; title: string; description?: string; upc?: string; model?: string };
export type Match = 'exact' | 'name' | 'none';

export class RecallDeltaRejected extends Error {}

// A UPC with or without its leading zero is the same product: everything is a 14-digit GTIN.
export function gtin14(raw: string | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '');
  return d.length >= 8 && d.length <= 14 ? d.padStart(14, '0') : null; // a stripped leading zero (11 digits) still matches
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function dateCodes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/gi))
    out.push(iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]));
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) out.push(iso(+m[3], +m[1], +m[2]));
  return out;
}
// A model token has a digit and a letter ("10AW1G-AQU2U"); hyphens and case do not matter. Years and bare numbers are not models.
export function modelTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z0-9][A-Za-z0-9-]{2,}[A-Za-z0-9]/g)) {
    const t = m[0].replace(/-/g, '').toUpperCase();
    if (/\d/.test(t) && /[A-Z]/.test(t) && t.length >= 4) out.add(t);
  }
  return out;
}
const STOP = new Set(['with', 'this', 'that', 'from', 'sold', 'recall', 'recalls', 'product', 'products', 'model', 'models', 'item', 'items', 'used', 'new']);
const words = (t: string) => new Set((t.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)));

export function matchRecall(l: Listing, r: RecallRow): Match {
  const own = `${l.title} ${l.description ?? ''} ${l.model ?? ''}`;
  const recallText = `${r.Title} ${r.Description} ${(r.Products ?? []).map((p) => `${p.Name ?? ''} ${p.Model ?? ''} ${p.Description ?? ''}`).join(' ')}`;
  const g = gtin14(l.upc);
  if (g && (r.ProductUPCs ?? []).some((u) => gtin14(u.UPC) === g)) return 'exact';
  const mine = modelTokens(own);
  for (const t of modelTokens(recallText)) if (mine.has(t)) return 'exact';
  const rw = words(`${r.Title} ${(r.Products ?? []).map((p) => p.Name ?? '').join(' ')}`), lw = words(`${l.title} ${l.description ?? ''}`);
  const nameHit = Array.from(rw).filter((w) => lw.has(w)).length >= 2;
  if (!nameHit) return 'none';
  const range = dateCodes(r.Description).sort(), seen = dateCodes(own);
  if (range.length > 0 && seen.some((d) => d >= range[0] && d <= range[range.length - 1])) return 'exact'; // a date code in the recalled run
  return 'name';
}

export function matchAll(l: Listing, recalls: RecallRow[]): { match: Match; recall: RecallRow | null } {
  let best: { match: Match; recall: RecallRow | null } = { match: 'none', recall: null };
  for (const r of recalls) {
    const m = matchRecall(l, r);
    if (m === 'exact') return { match: m, recall: r };
    if (m === 'name' && best.match === 'none') best = { match: m, recall: r };
  }
  return best;
}

// The daily delta is keyed on LastPublishDate: a republished recall (old RecallDate, new LastPublishDate) is picked up.
// A delta that large is a bad query (the API returns every record for made-up parameters): reject it whole.
export function recallDelta(rows: RecallRow[], since: string, maxRows: number): RecallRow[] {
  if (rows.length > maxRows) throw new RecallDeltaRejected(`${rows.length} rows in a daily delta; over ${maxRows} is a bad query`);
  return rows.filter((r) => r.LastPublishDate > since || r.RecallDate > since);
}

export type Confirmation = { identifier_differs: true; recall_id: string; reason: string; at: string };
export type PostGate = { allowed: boolean; hold: boolean; reason: string; match: Match; recall_id: string | null };
// A tap alone never posts a recalled item: exact is never overridable; a name-only match needs the person to confirm the recall's
// identifier does not match, and the confirmation is stored as the reason.
export function postGate(l: Listing, recalls: RecallRow[], conf?: Confirmation): PostGate {
  const { match, recall } = matchAll(l, recalls);
  const rid = recall === null ? null : String(recall.RecallID);
  if (match === 'exact') return { allowed: false, hold: false, reason: `Recalled: ${recall?.Title ?? ''}. It cannot be listed.`, match, recall_id: rid };
  if (match === 'name') {
    if (conf && conf.identifier_differs === true && conf.recall_id === rid && conf.reason.length > 0)
      return { allowed: true, hold: false, reason: conf.reason, match, recall_id: rid };
    return { allowed: false, hold: true, reason: `Might be recalled: ${recall?.Title ?? ''}. Check the model or date code against the notice.`, match, recall_id: rid };
  }
  return { allowed: true, hold: false, reason: '', match, recall_id: null };
}

// New recall rows against every live listing and draft in one pass.
export function takedowns(live: Listing[], recalls: RecallRow[]): { down: string[]; hold: string[] } {
  const down: string[] = [], hold: string[] = [];
  for (const l of live) { const m = matchAll(l, recalls).match; if (m === 'exact') down.push(l.id); else if (m === 'name') hold.push(l.id); }
  return { down, hold };
}

// Buy side: before a buy_offer is drafted. Any match means no draft and the notice is shown.
export function buyGate(l: Listing, recalls: RecallRow[]): { draftOffer: boolean; notice: string | null; match: Match } {
  const { match, recall } = matchAll(l, recalls);
  return match === 'none' ? { draftOffer: true, notice: null, match } : { draftOffer: false, notice: `${match === 'exact' ? 'Recalled' : 'Might be recalled'}: ${recall?.Title ?? ''}`, match };
}
