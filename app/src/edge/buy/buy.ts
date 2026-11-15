// Buying with the same engines (spec/features/buy.md "One search across every store", "The better official option").
// One list over the five marketplaces, official stores, retailers and Amazon, ranked by delivered total (M26);
// the better official option beside a used result; referral tags attached only after the order is fixed.
import { availableNow, bestByRelation, type Offer, type OfferRow } from '../intel/swarm.ts';

export type SourceKind = 'marketplace' | 'brand_store' | 'retailer' | 'amazon' | 'refurb' | 'brand_resale';
export type BuyOffer = Offer & { source_kind: SourceKind; returns?: string; referral?: { programme: string; url: string } };
export type BuyRow = OfferRow & { source_kind: SourceKind; referral?: { url: string; disclosure: string } };

export const OFFICIAL: readonly SourceKind[] = ['brand_store', 'retailer', 'amazon', 'refurb', 'brand_resale'];
export const REFERRAL_DISCLOSURE = 'We may earn a referral fee. It never changes the order or the verdict.';

const stripReferral = (o: BuyOffer): BuyOffer => { const { referral: _r, ...rest } = o; return rest as BuyOffer; };

// The order is computed with every referral field removed, so a referral can never enter it (buy.md referral rule).
export function searchAll(offers: BuyOffer[], opts: { shipTo?: string; soldIds?: Set<string>; medianShipping: number; condition?: string[] }): BuyRow[] {
  const byId = new Map(offers.map(o => [o.id, o]));
  const rows = availableNow(offers.map(stripReferral), opts)
    .filter(r => !opts.condition || opts.condition.includes(r.condition)) as BuyRow[];
  return rows.map(r => {
    const ref = byId.get(r.id)?.referral;
    return ref ? { ...r, referral: { url: ref.url, disclosure: REFERRAL_DISCLOSURE } } : r;
  });
}

export interface OfficialOption { used: BuyRow; official: BuyRow | null; verdict: 'official' | 'used' | 'close_call' | null; saving_cents: number | null }

// shortcut: the verdict compares delivered totals within 5%; M29's full verdict (warranty, value kept, cost to own) replaces it when M27–M29 land.
export const CLOSE_CALL = 0.05;
export function betterOfficial(used: BuyRow, rows: BuyRow[]): OfficialOption {
  const official = bestByRelation(rows.filter(r => OFFICIAL.includes(r.source_kind)))
    .sort((a, b) => a.delivered_cents - b.delivered_cents)[0] ?? null;
  if (!official) return { used, official: null, verdict: null, saving_cents: null };
  const diff = official.delivered_cents - used.delivered_cents;
  const verdict = Math.abs(diff) <= CLOSE_CALL * used.delivered_cents ? 'close_call' : diff < 0 ? 'official' : 'used';
  return { used, official, verdict, saving_cents: -diff };
}

// The list the person sees: an official offer that beats the used ones on delivered total is shown first.
export function buyList(rows: BuyRow[]): BuyRow[] {
  return [...rows].sort((a, b) => a.delivered_cents - b.delivered_cents);
}
