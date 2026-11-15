import { searchParams, type Pace } from '../run.ts';
import { M as depop } from '../../harness/sites/depop/adapter.ts';
import { MIN_GAP_MS } from '../../harness/sites/dupe/adapter.ts';
import type { Site } from '../../harness/protocol.ts';

export type SourceSite = Site | 'dupe';

export type Caller = 'person' | 'background';
export interface Source {
  id: string; site: SourceSite; lane: 'public_page' | 'harness' | 'mcp'; covers: readonly string[];
  needs_ask: boolean; on: boolean; reason?: string; pace: Pace;
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
const facebookPace = pace('facebook', 'harness', 20, 3000);

// Nate's source rulings: spec/engines/protocol-and-adapters.md §8 (int-search-1 follow-up).
export const SOURCES: Source[] = [
  { get pace() { return dupePace(); }, id: 'dupe', site: 'dupe', lane: 'mcp', covers: ['poshmark', 'depop', 'ebay', 'etsy', 'chairish'], needs_ask: false, on: true },
  { get pace() { return depopPace(); }, id: 'depop', site: 'depop', lane: 'harness', covers: ['depop'], needs_ask: false, on: true },
  { get pace() { return poshmarkPace(); }, id: 'poshmark', site: 'poshmark', lane: 'public_page', covers: ['poshmark'], needs_ask: false, on: true },
  { get pace() { return mercariPace(); }, id: 'mercari', site: 'mercari', lane: 'harness', covers: ['mercari'], needs_ask: true, on: true },
  { get pace() { return facebookPace(); }, id: 'facebook', site: 'facebook', lane: 'harness', covers: ['facebook'], needs_ask: false, on: false, reason: 'not built' },
  { get pace() { return ebayPace(); }, id: 'ebay', site: 'ebay', lane: 'harness', covers: ['ebay'], needs_ask: false, on: true },
];

export const sourcesFor = (caller: Caller = 'background', sources: readonly Source[] = SOURCES) =>
  sources.filter(source => source.on && (!source.needs_ask || caller === 'person'));

export const routeId = (source: Source) => source.lane === 'mcp' ? 'dupe.search.api' : source.lane === 'public_page' ? `public.${source.id}` : `${source.id}.search.page`;
