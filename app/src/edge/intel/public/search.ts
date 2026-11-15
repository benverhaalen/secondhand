// searchAll: every site's own public search at once. Each site is one fetchPage call, so the shared per-domain limiter
// (1-3 s gap, 429/503 backoff to 60 s) and the semaphore per route in fetch.ts set the pace. A block or a login wall is `blocked`.
import { SITES } from '../../harness/protocol.ts';
import type { Site } from '../../harness/protocol.ts';
import { detectBlock, fetchPage as sharedFetch } from '../fetch.ts';
import type { FetchOpts, PageResult } from '../fetch.ts';
import { readPage, searchUrl } from './readers.ts';
import type { Kind, Row } from './readers.ts';

export type SiteOutcome = 'hit' | 'empty' | 'blocked' | 'timeout' | 'page_changed';
export interface SiteSearched { site: Site; kind: Kind; url: string | null; outcome: SiteOutcome; ms: number; count: number; missing?: string[]; reason?: string }
export interface Found { site: Site; row: Row }
export interface SearchOpts {
  sites?: readonly Site[]; kinds?: readonly Kind[]; deadline_ms?: number;
  fetchPage?: (url: string, o: FetchOpts) => Promise<PageResult>; log?: FetchOpts['log']; now?: () => number;
}
export interface SearchResult { results: Found[]; searched: SiteSearched[] }

export interface SiteResult { searched: SiteSearched; rows: Row[] }

export async function searchSite(site: Site, query: string, kind: Kind = 'search', o: SearchOpts = {}): Promise<SiteResult> {
  const fetchPage = o.fetchPage ?? sharedFetch, now = o.now ?? (() => performance.now());
  const deadline_ms = o.deadline_ms ?? 15_000;
  const url = searchUrl(site, query, kind), t0 = now();
  const done = (outcome: SiteOutcome, rows: Row[] = [], extra: Partial<SiteSearched> = {}): SiteResult =>
    ({ searched: { site, kind, url, outcome, ms: Math.round(now() - t0), count: rows.length, ...extra }, rows });
  if (url === null) return done('empty', [], { reason: 'no sold results signed out' });
  let p: PageResult;
  try { p = await fetchPage(url, { deadline_ms, log: o.log }); }
  catch (e) { o.log?.error('search.fetch', e); return done('timeout', [], { reason: e instanceof Error ? e.message : 'fetch threw' }); }
  if (!p.ok) return done(p.kind === 'not_found' ? 'empty' : p.kind, [], { reason: p.reason });
  if (detectBlock(p.status, p.html)) return done('blocked');
  const r = readPage(site, p.html, kind);
  if (!r.ok) return r.error.code === 'page_changed' ? done('page_changed', [], { missing: r.error.hint.do === 'author' ? r.error.hint.missing : [] }) : done('blocked');
  // A login wall carries no cards and no error: say blocked, not empty.
  const loginWall = /<form\b[^>]*(?:action=["'][^"']*(?:login|signin)|id=["']login)|(?:log in|sign in) to (?:continue|see|view|search|use|facebook)/i;
  if (!r.data.length && loginWall.test(p.html)) return done('blocked', [], { reason: 'login required' });
  return done(r.data.length ? 'hit' : 'empty', r.data);
}

export async function searchAll(query: string, o: SearchOpts = {}): Promise<SearchResult> {
  const targets = (o.sites ?? SITES).flatMap(site => (o.kinds ?? ['search']).map(kind => ({ site, kind })));
  const per = await Promise.all(targets.map(({ site, kind }) => searchSite(site, query, kind, o)));
  return { results: per.flatMap(x => x.rows.map(row => ({ site: x.searched.site, row }))), searched: per.map(x => x.searched) };
}
