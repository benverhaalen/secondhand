// eBay item specifics as requirement rows (research/list/ben/listing-help-apis.md).
// Input: one getItemAspectsForCategory reply (eBay Taxonomy API, read with an application token for the item's leaf category).
// Output: rows buildListing already reads, under eBay's own aspect names, so a required aspect blocks the draft and a
// recommended one becomes a question for the photo or the person, never a guess (platforms/ebay.md, specifics rule).
// eBay's API terms keep eBay content to eBay listings: these rows carry an eBay site name only and never fill another site.
import type { ItemCard, Requirement } from './build.ts';

type Aspect = {
  localizedAspectName: string;
  aspectConstraint: { aspectRequired?: boolean; aspectUsage?: 'RECOMMENDED' | 'OPTIONAL'; aspectMode?: 'FREE_TEXT' | 'SELECTION_ONLY'; aspectMaxLength?: number };
  aspectValues?: { localizedValue: string }[];
  relevanceIndicator?: { searchCount?: number };   // Buyer Demand Data; only with eBay's approval, used only to build the listing
};
export type AspectsReply = { categoryId?: string; aspects?: Aspect[] };

export type AspectRow = Requirement & { usage: 'required' | 'recommended' | 'optional'; allowed?: string[] };

// eBay's aspect name to our attribute field. An aspect not listed keeps its eBay name as `ebay:<Name>`, so it can still be asked for.
const FIELD: Record<string, string> = {
  Brand: 'brand', Size: 'size_label', Color: 'colour', Colour: 'colour', Department: 'department', Material: 'material',
  'Outer Shell Material': 'fabric', Style: 'style', Type: 'type', Model: 'model', 'Storage Capacity': 'storage',
  'Sleeve Length': 'sleeve_length', Era: 'era', Pattern: 'pattern', Fit: 'fit', MPN: 'mpn',
};

export function aspectRows(item_kind: string, reply: AspectsReply): AspectRow[] {
  return (reply.aspects ?? []).map(a => {
    const c = a.aspectConstraint ?? {};
    const usage = c.aspectRequired ? 'required' : c.aspectUsage === 'RECOMMENDED' ? 'recommended' : 'optional';
    const searched = (a.relevanceIndicator?.searchCount ?? 0) > 0;
    const rank = searched || usage === 'required' ? 'high' : usage === 'recommended' ? 'medium' : 'low';
    const allowed = c.aspectMode === 'SELECTION_ONLY' && a.aspectValues?.length ? a.aspectValues.map(v => v.localizedValue) : undefined;
    return {
      item_kind, field: FIELD[a.localizedAspectName] ?? `ebay:${a.localizedAspectName}`, role: searched ? 'search' : 'attribute',
      site_names: { ebay: { name: a.localizedAspectName, max_length: c.aspectMaxLength ?? 65, required: usage === 'required' } },
      importance: { rank: { ebay: rank } }, usage, ...(allowed ? { allowed } : {}),
    };
  });
}

const filled = (v: unknown) => (Array.isArray(v) ? v.some(x => String(x).trim()) : v !== undefined && String(v).trim() !== '');

// What the eBay draft still lacks: required (blocks it), recommended (ask the photo or the person) and invalid (a value
// outside a selection-only list, which must be mapped to one of eBay's values before posting).
export function aspectGaps(item: ItemCard, rows: AspectRow[]) {
  const required: string[] = [], recommended: string[] = [];
  const invalid: { field: string; aspect: string; value: string; allowed: string[] }[] = [];
  for (const r of rows) {
    const v = item.attrs[r.field]?.value;
    if (!filled(v)) { if (r.usage === 'required') required.push(r.field); else if (r.usage === 'recommended') recommended.push(r.field); continue; }
    if (!r.allowed) continue;
    const ok = new Set(r.allowed.map(x => x.toLowerCase()));
    for (const one of Array.isArray(v) ? v : [String(v)])
      if (!ok.has(String(one).toLowerCase())) invalid.push({ field: r.field, aspect: r.site_names.ebay.name, value: String(one), allowed: r.allowed });
  }
  return { required, recommended, invalid };
}
