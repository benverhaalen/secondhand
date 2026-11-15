// searchAll: every site's own public search at once. Each site is one fetchPage call, so the shared per-domain limiter
// (1-3 s gap, 429/503 backoff to 60 s) and the semaphore per route in fetch.ts set the pace. A block or a login wall is `blocked`.
import { SITES } from '../../harness/protocol.ts';
import type { Site } from '../../harness/protocol.ts';
import { fetchPage as sharedFetch } from '../fetch.ts';
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

export async function searchAll(query: string, o: SearchOpts = {}): Promise<SearchResult> {
  const fetchPage = o.fetchPage ?? sharedFetch; const now = o.now ?? (() => performance.now());
  const deadline_ms = o.deadline_ms ?? 15_000;
  const jobs = (o.sites ?? SITES).flatMap(site => (o.kinds ?? ['search']).map(kind => ({ site, kind })));
  const per = await Promise.all(jobs.map(async ({ site, kind }): Promise<{ s: SiteSearched; rows: Row[] }> => {
    const url = searchUrl(site, query, kind); const t0 = now();
    const done = (outcome: SiteOutcome, rows: Row[] = [], extra: Partial<SiteSearched> = {}) =>
      ({ s: { site, kind, url, outcome, ms: Math.round(now() - t0), count: rows.length, ...extra }, rows });
    if (url === null) return done('empty', [], { reason: 'no sold results signed out' });
    let p: PageResult;
    try { p = await fetchPage(url, { deadline_ms, log: o.log }); } catch (e) { return done('timeout', [], { reason: e instanceof Error ? e.message : 'fetch threw' }); }
    if (!p.ok) return done(p.kind === 'not_found' ? 'empty' : p.kind, [], { reason: p.reason });
    const r = readPage(site, p.html, kind);
    if (!r.ok) return r.error.code === 'page_changed' ? done('page_changed', [], { missing: r.error.hint.do === 'author' ? r.error.hint.missing : [] }) : done('blocked');
    // A login wall carries no cards and no error: say blocked, not empty.
    if (!r.data.length && site === 'facebook' && /login|log in/i.test(p.html)) return done('blocked', [], { reason: 'login required' });
    return done(r.data.length ? 'hit' : 'empty', r.data);
  }));
  return { results: per.flatMap((x, i) => x.rows.map(row => ({ site: (jobs[i] as { site: Site }).site, row }))), searched: per.map(x => x.s) };
}
