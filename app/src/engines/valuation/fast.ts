// family_band: the rough band answered before the Check (valuation.md §3, "The fast first answer"), in cents.
// Operation: sales land per (family, condition) and per (category, condition); each landing recomputes that key's
// weighted p10 and p90 over the last 90 days, so a read is one map lookup. A family under 20 sales answers from
// its category; a category under 20 answers nothing ("Pricing this..." until the Check).
import { weightedPercentile } from './path.ts';

export type Sale = { family_id: string; category: string; condition: string; adjusted_cents: number; w: number; sold_at: string };
export type FamilyBand = { low: number; high: number; basis: 'family' | 'category'; n: number; as_of: string; state: 'rough' };

export const MIN_SALES = 20;
export const WINDOW_DAYS = 90;
const DAY = 86400e3;

type Key = string;
const famKey = (f: string, c: string) => `f:${f}:${c}`;
const catKey = (k: string, c: string) => `c:${k}:${c}`;

export function familyBands() {
  const sales = new Map<Key, Sale[]>();
  const bands = new Map<Key, Omit<FamilyBand, 'basis'> | null>();

  const refresh = (key: Key, as_of: string) => {
    const cut = Date.parse(as_of) - WINDOW_DAYS * DAY;
    const kept = (sales.get(key) ?? []).filter(s => Date.parse(s.sold_at) >= cut);
    sales.set(key, kept);
    if (kept.length < MIN_SALES) { bands.set(key, null); return; }
    const v = kept.map(s => s.adjusted_cents), w = kept.map(s => s.w);
    bands.set(key, { low: Math.round(weightedPercentile(v, w, 0.1)), high: Math.round(weightedPercentile(v, w, 0.9)), n: kept.length, as_of, state: 'rough' });
  };

  return {
    // A sale event in the family: the band is fresh the moment the call returns.
    onSale(s: Sale, as_of = s.sold_at) {
      for (const key of [famKey(s.family_id, s.condition), catKey(s.category, s.condition)]) {
        sales.set(key, [...(sales.get(key) ?? []), s]);
        refresh(key, as_of);
      }
    },
    // Ages a window forward with no new sale, as the nightly job does.
    expire(as_of: string) { for (const key of sales.keys()) refresh(key, as_of); },
    band(family_id: string | null, category: string, condition: string): FamilyBand | null {
      const fam = family_id ? bands.get(famKey(family_id, condition)) : null;
      if (fam) return { ...fam, basis: 'family' };
      const cat = bands.get(catKey(category, condition));
      return cat ? { ...cat, basis: 'category' } : null;
    },
  };
}
