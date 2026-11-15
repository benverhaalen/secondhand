// Source rows select the approved lanes; public pages share fetch.ts's limiter and semaphore.
import { classifyRead, type Field, type Harness, type Site } from '../../harness/protocol.ts';
import type { Accounts } from '../../browser/auth.ts';
import type { SnapListing } from '../../events/event.ts';
import { sourcesFor, type Caller, type Source } from './sources.ts';
import { detectBlock, fetchPage as sharedFetch } from '../fetch.ts';
import type { FetchOpts, PageResult } from '../fetch.ts';
import { readPage, REQUIRED, searchUrl } from './readers.ts';
import type { Kind, Row } from './readers.ts';

export type SiteOutcome = 'hit' | 'empty' | 'blocked' | 'timeout' | 'page_changed';
export interface SiteSearched { site: Site; kind: Kind; url: string | null; outcome: SiteOutcome; ms: number; count: number; missing?: string[]; reason?: string }
export interface Found { site: Site; row: Row }
export interface SearchOpts {
  caller?: Caller; sources?: readonly Source[]; person_id?: string; accounts?: Accounts; harness?: Harness;
  sites?: readonly Site[]; kinds?: readonly Kind[]; deadline_ms?: number;
  fetchPage?: (url: string, o: FetchOpts) => Promise<PageResult>; log?: FetchOpts['log']; now?: () => number;
}
export interface SearchResult { results: Found[]; searched: SiteSearched[] }

export interface SiteResult { searched: SiteSearched; rows: Row[] }
const fields: Field[] = REQUIRED.map(name => ({ name, type: name === 'price_cents' ? 'number' : 'string', needs_session: false, required: true }));

export async function searchSource(source: Source, query: string, kind: Kind = 'search', o: SearchOpts = {}): Promise<SiteResult> {
  const blocked = (reason: string): SiteResult => ({ rows: [], searched: {
    site: source.site, kind, url: null, outcome: 'blocked', ms: 0, count: 0, reason,
  } });
  if (!sourcesFor(o.caller, [source]).length) return blocked(source.reason ?? 'requires the person\'s search');
  if (source.lane === 'public_page') return searchSite(source.site, query, kind, o);
  if (!o.person_id || !o.accounts) return blocked('linked account required');
  const account = (await o.accounts.linked(o.person_id)).find(a => a.site === source.site && a.person_id === o.person_id);
  if (!account) return blocked('linked account required');
  if (!o.harness) return blocked('linked harness not available');
  const run = () => o.harness!.call<(SnapListing & { title?: string; condition?: string; size?: string; listed_at?: string; sold_at?: string; currency: string; url: string })[]>(source.site, 'search', {
    q: query, status: kind === 'sold' ? 'sold' : 'active', account_id: account.account_id, person_id: o.person_id,
  });
  const result = o.log ? await o.log.call('harness', `${source.id}.search`, { account_id: account.account_id }, run) : await run();
  if (!result.ok) {
    const failure = blocked(result.error.message);
    failure.searched.outcome = result.error.code === 'not_found' ? 'empty' : result.error.code === 'page_changed' ? 'page_changed' : 'blocked';
    failure.searched.ms = result.meta.ms;
    return failure;
  }
  const rows = result.data.map(row => ({ id: row.external_id, title: row.title, price_cents: row.price_cents,
    currency: row.currency, url: row.url, condition: row.condition, size: row.size, listed_at: row.listed_at, sold_date: row.sold_at, ...(row.state === 'sold' ? { sold: true as const } : {}) }));
  const read = classifyRead({ challenge: false, rows }, { site: source.site, fields });
  if (!read.ok) return { rows: [], searched: { ...blocked(read.error.message).searched, outcome: 'page_changed', ms: result.meta.ms } };
  return { rows: read.data, searched: { site: source.site, kind, url: null, outcome: rows.length ? 'hit' : 'empty', ms: result.meta.ms, count: rows.length } };
}

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
  const sources = sourcesFor(o.caller, o.sources).filter(source => !o.sites || source.covers.some(site => o.sites!.includes(site)));
  const targets = sources.flatMap(source => (o.kinds ?? ['search']).map(kind => ({ source, kind })));
  const per = await Promise.all(targets.map(({ source, kind }) => searchSource(source, query, kind, o)));
  return { results: per.flatMap(x => x.rows.map(row => ({ site: x.searched.site, row }))), searched: per.map(x => x.searched) };
}
