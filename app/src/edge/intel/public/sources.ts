import type { Site } from '../../harness/protocol.ts';

export type SourceSite = Site | 'dupe';

export type Caller = 'person' | 'background';
export interface Source {
  id: string; site: SourceSite; lane: 'public_page' | 'harness' | 'mcp'; covers: readonly string[];
  needs_ask: boolean; on: boolean; reason?: string;
}

// Nate's source rulings: spec/engines/protocol-and-adapters.md §8 (int-search-1 follow-up).
export const SOURCES: Source[] = [
  { id: 'dupe', site: 'dupe', lane: 'mcp', covers: ['poshmark', 'depop', 'ebay', 'etsy', 'chairish'], needs_ask: false, on: true },
  { id: 'depop', site: 'depop', lane: 'harness', covers: ['depop'], needs_ask: false, on: true },
  { id: 'poshmark', site: 'poshmark', lane: 'public_page', covers: ['poshmark'], needs_ask: false, on: true },
  { id: 'mercari', site: 'mercari', lane: 'harness', covers: ['mercari'], needs_ask: true, on: true },
  { id: 'facebook', site: 'facebook', lane: 'harness', covers: ['facebook'], needs_ask: false, on: false, reason: 'not built' },
  { id: 'ebay', site: 'ebay', lane: 'harness', covers: ['ebay'], needs_ask: false, on: false, reason: 'page lane not built' },
];

export const sourcesFor = (caller: Caller = 'background', sources: readonly Source[] = SOURCES) =>
  sources.filter(source => source.on && (!source.needs_ask || caller === 'person'));

export const routeId = (source: Source) => source.lane === 'mcp' ? 'dupe.search.api' : source.lane === 'public_page' ? `public.${source.id}` : `${source.id}.search.page`;
