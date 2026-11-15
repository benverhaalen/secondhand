// The live buy beat (product/live-buy-demo.md; Ben, words.md 2026-11-15 "demo the buy side live"): what the stage watcher
// (scripts/demo/stage-watch.mjs) found, as the want screen shows it. Ben chose the alert inside the app (decision card,
// 08:06), so the screen opened with ?live=1 reads GET /v1/stage every 2 s; ?live=sample shows SAMPLE for the render checks.
// Parsed at the boundary: a row the screen can't show truthfully (a site with no badge, money not in whole cents) is dropped.
import type { Site } from '../demo/index.ts';

export interface StageAlert {
  id: string; site: Site; url: string; title: string; price_cents: number; cap_cents: number;
  image: string | null; listed_at: number | null; found_at: number;
}

const SITES: readonly Site[] = ['ebay', 'depop', 'poshmark', 'mercari', 'facebook'];
const cents = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const time = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseStage(raw: unknown): { alerts: StageAlert[] } {
  const rows = raw && typeof raw === 'object' && Array.isArray((raw as { alerts?: unknown }).alerts) ? (raw as { alerts: unknown[] }).alerts : [];
  const alerts = rows.flatMap((r): StageAlert[] => {
    if (!r || typeof r !== 'object') return [];
    const a = r as Record<string, unknown>;
    if (typeof a.id !== 'string' || !SITES.includes(a.site as Site) || typeof a.url !== 'string' || !a.url.startsWith('https://')) return [];
    if (!cents(a.price_cents) || !cents(a.cap_cents) || !time(a.found_at)) return [];
    return [{
      id: a.id, site: a.site as Site, url: a.url, title: typeof a.title === 'string' && a.title ? a.title : 'New listing',
      price_cents: a.price_cents, cap_cents: a.cap_cents, image: typeof a.image === 'string' && a.image.startsWith('https://') ? a.image : null,
      listed_at: time(a.listed_at) ? a.listed_at : null, found_at: a.found_at,
    }];
  });
  return { alerts: alerts.sort((x, y) => y.found_at - x.found_at) };
}

// "41s after listing": the proof it isn't staged, from the site's own clock (a Poshmark id holds its creation time).
export function afterListing(a: StageAlert): string | undefined {
  if (a.listed_at == null) return undefined;
  const s = Math.max(0, Math.round((a.found_at - a.listed_at) / 1000));
  return s < 120 ? `${s}s after listing` : `${Math.round(s / 60)}m after listing`;
}

// For the render checks only (?live=sample); its id says so.
export const SAMPLE: StageAlert[] = [{
  id: 'sample_carhartt', site: 'poshmark', url: 'https://poshmark.com/', title: 'Carhartt Detroit jacket', price_cents: 1800, cap_cents: 2500,
  image: null, listed_at: 1_700_000_000_000, found_at: 1_700_000_041_000,
}];
