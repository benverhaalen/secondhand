// read_storefront on the watcher sweep: each linked account's shop figures, kept as storefront_snapshot
// (spec/product.md, the storefront_snapshot row; Nate, product/words.md 2026-11-14). Server only.
// Only accounts the person linked with stored sign-in are swept; nothing is called for a site they did not link.
import type { Accounts } from '../browser/auth.ts';
import { STOREFRONT_FIELDS, storefrontMissing, type StorefrontField } from './platform.ts';
import type { Harness, Site } from './protocol.ts';

const SHOP = ['followers', 'following', 'rating', 'review_count', 'active_count', 'sold_count', 'joined_at'] as const;
const TOTALS = ['views', 'likes', 'saves', 'offers', 'orders', 'gross_cents', 'kept_cents'] as const;

export type StorefrontSnapshot = {
  account_id: string; site: Site; as_of: string;
  shop: Partial<Record<(typeof SHOP)[number], number | string>> & { active_count: number; sold_count: number };
  totals: Partial<Record<(typeof TOTALS)[number], number>> & { orders: number; gross_cents: number };
  window_days: number; per_listing_ref: string[]; fields_missing: StorefrontField[]; source: 'harness'; citation_id: string;
};
export type SnapshotStore = { put(row: StorefrontSnapshot): Promise<void> };

// The adapter's data is untrusted: only known fields of the right type are kept; a field the site shows but this read
// did not return joins fields_missing, alongside what the site never shows.
export function toSnapshot(account_id: string, site: Site, data: unknown, { as_of, window_days, citation_id, per_listing_ref = [] }:
  { as_of: string; window_days: number; citation_id: string; per_listing_ref?: string[] }): StorefrontSnapshot | { refused: string } {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { refused: 'read_storefront data is not an object' };
  const d = data as Record<string, unknown>, got = new Map<StorefrontField, number | string>();
  for (const f of STOREFRONT_FIELDS) {
    const v = d[f];
    if (f === 'joined_at' ? typeof v === 'string' : typeof v === 'number' && Number.isFinite(v) && v >= 0) got.set(f, v as number | string);
  }
  const num = (f: StorefrontField) => (got.get(f) as number | undefined);
  const shop = Object.fromEntries(SHOP.filter(f => got.has(f)).map(f => [f, got.get(f)])) as StorefrontSnapshot['shop'];
  const totals = Object.fromEntries(TOTALS.filter(f => got.has(f)).map(f => [f, num(f)])) as StorefrontSnapshot['totals'];
  // The row's schema requires four counts; one this read did not return is set to 0 as a placeholder and named in
  // fields_missing, so a reader never takes it for a real zero (shortcut: a nullable column would be cleaner, once db-1 lands).
  shop.active_count ??= 0; shop.sold_count ??= 0; totals.orders ??= 0; totals.gross_cents ??= 0;
  const fields_missing = [...new Set([...storefrontMissing(site), ...STOREFRONT_FIELDS.filter(f => !got.has(f))])];
  return { account_id, site, as_of, shop, totals, window_days, per_listing_ref, fields_missing, source: 'harness', citation_id };
}

export async function sweepStorefronts({ accounts, harness, store, person_id, now = () => new Date(), window_days = 30 }: {
  accounts: Accounts; harness: Harness; store: SnapshotStore; person_id?: string; now?: () => Date; window_days?: number;
}): Promise<{ swept: string[]; failed: { account_id: string; code: string }[] }> {
  const linked = await accounts.linked(person_id);
  // Every linked account at once, each on its own session; one site failing never holds up another.
  const results = await Promise.all(linked.map(async a => {
    const e = await harness.call(a.site, 'read_storefront', { account_id: a.account_id, person_id: a.person_id });
    if (!e.ok) return { account_id: a.account_id, code: e.error.code };
    const row = toSnapshot(a.account_id, a.site, e.data, { as_of: now().toISOString(), window_days, citation_id: e.meta.observation_ids[0] ?? e.meta.route_id });
    if ('refused' in row) return { account_id: a.account_id, code: 'page_changed' };
    await store.put(row);
    return a.account_id;
  }));
  return { swept: results.filter((r): r is string => typeof r === 'string'), failed: results.filter((r): r is { account_id: string; code: string } => typeof r !== 'string') };
}
