// Wants, matches and alerts (spec/features/watch.md; alerts gated by spec/determinations/market-insight.md M19).
// A watch_run reads the merged offers for a want (intel available_now: one row per physical item, "also on"),
// keeps what fits and is under the ceiling, and alerts only on what is new or has moved past the noise band.
import type { OfferRow } from '../intel/swarm.ts';

export type WantState = 'active' | 'paused' | 'ended';
export type MatchState = 'found' | 'alerted' | 'saved' | 'asked' | 'offered' | 'bought' | 'dismissed' | 'gone';

export interface Want {
  id: string; state: WantState; text: string; product_id?: string; sites: string[];
  fit?: { size?: string; cut?: 'mens' | 'womens' | 'youth'; measurements?: Record<string, number>; tolerance_cm?: number };
  max_total_cents?: number; alert: 'available' | 'under';
  quiet_hours?: [start: number, end: number]; // local hours; alerts inside them go to the digest
}
// department: who the listing says it's cut for, as the site files it (Poshmark's Men, Women, Kids).
export type Listing = OfferRow & { size?: string; department?: string; measurements?: Record<string, number> };
export interface Match {
  id: string; want_id: string; site: string; url: string; price_cents: number; delivered_cents: number;
  seen_at: string; state: MatchState; also_on: string[]; fit: 'measured' | 'size_only' | 'unknown';
}
// The product's price movement for M19: p50 of the last 14 days against the prior 28, the bootstrap 90% band of that ratio.
export interface Movement { p50_recent: number; p50_prior: number; sales_recent: number; band90: number }

export const MAX_PUSHES_PER_RUN = 3; // more than this in one run becomes one digest ("too many matches")
export const DEFAULT_TOLERANCE_CM = 2;

// M19 rule 1: moved enough only past max(10%, the band), on at least 10 sales; any input missing tells nothing.
export function movedEnough(m: Movement | undefined): boolean {
  if (!m || !(m.p50_prior > 0) || m.sales_recent < 10) return false;
  return Math.abs(m.p50_recent / m.p50_prior - 1) >= Math.max(0.10, m.band90);
}

// One name per size, so a want for "L" finds "Large" and "Men's L" (the Brewers trial, 2026-11-15, scripts/demo/want.mjs).
// An MLB jersey's chest number maps to its letter (40 S, 44 M, 48 L, 52 XL, 56 XXL; the authentic scale, inferred), only when
// the want is a jersey: a blazer's 40 is not a small.
const SIZE_WORDS: Record<string, string> = { small: 'S', medium: 'M', large: 'L', 'x-large': 'XL', xlarge: 'XL', 'extra large': 'XL',
  'xx-large': 'XXL', xxlarge: 'XXL', '2xl': 'XXL', '3xl': 'XXXL', 'xxx-large': 'XXXL' };
const JERSEY_CHEST: Record<string, string> = { 40: 'S', 44: 'M', 48: 'L', 52: 'XL', 56: 'XXL', 60: 'XXXL' };
export function sizeKey(size: string, jersey = false): string {
  const t = size.trim().toLowerCase().replace(/^(?:men'?s|women'?s|us)\s*/, '');
  return SIZE_WORDS[t] ?? (jersey ? JERSEY_CHEST[t] : undefined) ?? t.toUpperCase();
}

const CUT_OF: Record<string, 'mens' | 'womens' | 'youth'> = { men: 'mens', mens: 'mens', women: 'womens', womens: 'womens', kids: 'youth', youth: 'youth', boys: 'youth', girls: 'youth' };
export function fits(want: Want, l: Listing): Match['fit'] | null {
  const f = want.fit;
  if (!f) return 'unknown';
  // A different cut never fits, whatever its size label says: a boys' XXL displays as "XXL" (the Brewers trial).
  const cut = l.department ? CUT_OF[l.department.toLowerCase().replace(/[’']s$/, 's')] : undefined;
  if (f.cut && cut && cut !== f.cut) return null;
  if (f.measurements && l.measurements) {
    const tol = f.tolerance_cm ?? DEFAULT_TOLERANCE_CM;
    const shared = Object.keys(f.measurements).filter(k => l.measurements![k] !== undefined);
    if (shared.length) return shared.every(k => Math.abs(l.measurements![k]! - f.measurements![k]!) <= tol) ? 'measured' : null;
  }
  const jersey = /\bjersey\b/i.test(want.text);
  if (f.size) return l.size && sizeKey(l.size, jersey) === sizeKey(f.size, jersey) ? 'size_only' : null;
  return 'unknown';
}

const inQuiet = (q: Want['quiet_hours'], hour: number) => !!q && (q[0] <= q[1] ? hour >= q[0] && hour < q[1] : hour >= q[0] || hour < q[1]);

export interface RunOut { matches: Match[]; push: Match[]; digest: Match[]; gone: Match[] }

export function watchRun(want: Want, listings: Listing[], prior: Match[], opts: {
  now: Date; localHour: number; notSame?: Set<string>; movement?: Movement;
}): RunOut {
  if (want.state !== 'active') return { matches: prior, push: [], digest: [], gone: [] };
  const byUrl = new Map(prior.map(m => [m.url, m]));
  const seen = new Set<string>(), fresh: Match[] = [], moved: Match[] = [], matches: Match[] = [];
  for (const l of listings) {
    if (!want.sites.includes(l.site) || opts.notSame?.has(l.url)) continue; // "Not the same" is a label that blocks the pair
    if (want.max_total_cents !== undefined && l.delivered_cents > want.max_total_cents) continue;
    const fit = fits(want, l);
    if (!fit) continue;
    seen.add(l.url);
    const old = byUrl.get(l.url);
    const m: Match = { id: old?.id ?? `mt_${want.id}_${l.site}_${l.listing_id}`, want_id: want.id, site: l.site, url: l.url, price_cents: l.price_cents,
      delivered_cents: l.delivered_cents, seen_at: opts.now.toISOString(), state: old?.state ?? 'found', also_on: l.also_on, fit };
    matches.push(m);
    if (!old) fresh.push(m);
    // A price change on a match already alerted tells only when the product moved past the noise band (M19).
    else if (want.alert === 'under' && l.delivered_cents < old.delivered_cents && movedEnough(opts.movement)) moved.push(m);
  }
  // Sold before the alert, or gone from every site: the re-read drops it.
  const gone = prior.filter(m => !seen.has(m.url) && !['bought', 'dismissed'].includes(m.state)).map(m => ({ ...m, state: 'gone' as const }));
  const tell = [...fresh, ...moved];
  const quiet = inQuiet(want.quiet_hours, opts.localHour) || tell.length > MAX_PUSHES_PER_RUN;
  for (const m of tell) if (!quiet) m.state = 'alerted';
  return { matches: [...matches, ...gone], push: quiet ? [] : tell, digest: quiet ? tell : [], gone };
}
