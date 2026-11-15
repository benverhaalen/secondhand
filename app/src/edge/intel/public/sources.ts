import { searchParams, type Pace } from '../run.ts';
import { M as depop } from '../../harness/sites/depop/adapter.ts';
import { MIN_GAP_MS } from '../../harness/sites/dupe/adapter.ts';
import type { Site } from '../../harness/protocol.ts';

export type SourceSite = Site | 'dupe';

export type Caller = 'person' | 'background';
export interface Source {
  id: string; site: SourceSite; lane: 'public_page' | 'harness' | 'mcp' | 'apify'; covers: readonly string[];
  needs_ask: boolean; person_only?: boolean; on: boolean; reason?: string; pace: Pace;
}

function pace(site: string, lane: Source['lane'], per_minute: number, min_gap_ms: number, capped = false): () => Pace {
  const prefix = `search_${site}_${lane}`;
  searchParams.declare({ name: `${prefix}_per_minute`, family: 'scalar', prior: per_minute, guard_lo: 1, ...(capped ? { guard_hi: per_minute } : {}) });
  searchParams.declare({ name: `${prefix}_min_gap_ms`, family: 'scalar', prior: min_gap_ms, guard_lo: capped ? min_gap_ms : 0 });
  return () => {
    const rate = searchParams.read(`${prefix}_per_minute`, { site }).value as number;
    const gap = searchParams.read(`${prefix}_min_gap_ms`, { site }).value as number;
    return { per_minute: capped ? Math.min(rate, per_minute) : rate, min_gap_ms: capped ? Math.max(gap, min_gap_ms) : gap };
  };
}
const dupePace = pace('dupe', 'mcp', 60_000 / MIN_GAP_MS, MIN_GAP_MS);
const depopPace = pace('depop', 'harness', depop.search.pace.per_minute, depop.search.pace.step_ms[0], true);
const poshmarkPace = pace('poshmark', 'public_page', 20, 3000);
const ebayPace = pace('ebay', 'harness', 6, 10000, true);
const mercariPace = pace('mercari', 'harness', 20, 3000);
const facebookPace = pace('facebook', 'apify', 20, 3000);

// Agent proposal: Central-time demo prior; the person's own location replaces it later.
searchParams.declare({ name: 'search_facebook_city', family: 'scalar', prior: 'chicago' });
// Apify README: $0.05 maximum a run, about $0.50 a person each day.
searchParams.declare({ name: 'search_apify_runs_per_person_day', family: 'scalar', prior: 10, guard_lo: 0 });
// About $10 a day across all people; reserved through SearchOpts.apifyRuns.
searchParams.declare({ name: 'search_apify_runs_per_day', family: 'scalar', prior: 200, guard_lo: 0 });
// Apify README probe: $0.05 for 10 Facebook rows.
searchParams.declare({ name: 'search_apify_cost_per_row_usd', family: 'scalar', prior: 0.005, guard_lo: 0 });

// Nate's source rulings: spec/engines/protocol-and-adapters.md §8 (int-search-1 follow-up).
export const SOURCES: Source[] = [
  { get pace() { return dupePace(); }, id: 'dupe', site: 'dupe', lane: 'mcp', covers: ['poshmark', 'depop', 'ebay', 'etsy', 'chairish'], needs_ask: false, on: true },
  { get pace() { return depopPace(); }, id: 'depop', site: 'depop', lane: 'harness', covers: ['depop'], needs_ask: false, on: true },
  { get pace() { return poshmarkPace(); }, id: 'poshmark', site: 'poshmark', lane: 'public_page', covers: ['poshmark'], needs_ask: false, on: true },
  { get pace() { return mercariPace(); }, id: 'mercari', site: 'mercari', lane: 'harness', covers: ['mercari'], needs_ask: true, on: true },
  { get pace() { return facebookPace(); }, id: 'facebook', site: 'facebook', lane: 'apify', covers: ['facebook'], needs_ask: false, person_only: true, on: true },
  { get pace() { return ebayPace(); }, id: 'ebay', site: 'ebay', lane: 'harness', covers: ['ebay'], needs_ask: false, on: true },
];

export const sourcesFor = (caller: Caller = 'background', sources: readonly Source[] = SOURCES) =>
  sources.filter(source => source.on && (!source.person_only || caller === 'person'));

export const routeId = (source: Source) => source.lane === 'apify' ? `apify.${source.id}.search` : source.lane === 'mcp' ? 'dupe.search.api' : source.lane === 'public_page' ? `public.${source.id}` : `${source.id}.search.page`;
