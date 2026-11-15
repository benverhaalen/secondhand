// Source rows select the approved lanes; public pages share fetch.ts's limiter and semaphore.
import { atPace, searchParams, type Pace } from '../run.ts';
import { classifyRead, type CallError, type Field, type Harness, type Site } from '../../harness/protocol.ts';
import type { Accounts } from '../../browser/auth.ts';
import type { SnapListing } from '../../events/event.ts';
import { sourcesFor, type Caller, type Source, type SourceSite } from './sources.ts';
import { detectBlock, fetchPage as sharedFetch } from '../fetch.ts';
import type { FetchOpts, PageResult } from '../fetch.ts';
import { readPage, REQUIRED, searchUrl } from './readers.ts';
import type { Kind, Row } from './readers.ts';

import { createLog, consoleSink } from '../../../../../log/index.js';
import { createDupe, type DupeRow } from '../../harness/sites/dupe/adapter.ts';
import { MAX_ITEMS, ROUTE_IDS, type ApifyRow, type Lane, type createApify } from '../../harness/sites/apify/adapter.ts';

const dupe = createDupe({ log: createLog({ src: 'intel.dupe', build: process.env.BUILD_SHA ?? 'dev', sink: consoleSink }) });
export type SearchRow = Row & { host?: string; converted?: boolean } & Partial<Omit<DupeRow, keyof Row>> & Partial<Pick<ApifyRow, 'via' | 'actor' | 'may_model' | 'use_scope'>>;

export type SiteOutcome = 'hit' | 'empty' | 'blocked' | 'timeout' | 'page_changed' | 'needs_account' | 'failed' | 'unknown';
export interface SiteSearched { site: SourceSite; kind: Kind; url: string | null; outcome: SiteOutcome; ms: number; count: number; missing?: string[]; reason?: string; error_code?: string; pace?: Pace; dropped?: number; route_id?: string; fallback?: 'apify'; cost_usd_est?: number }
export interface Found { site: SourceSite; row: SearchRow }
export interface SearchOpts {
  paced?: boolean; routed?: (site: SourceSite) => boolean; apify?: Pick<ReturnType<typeof createApify>, 'search'>; visitor_id?: string;
  dupe?: Pick<ReturnType<typeof createDupe>, 'search'>; signal?: AbortSignal;
  caller?: Caller; sources?: readonly Source[]; person_id?: string; accounts?: Accounts; harness?: Harness;
  sites?: readonly Site[]; kinds?: readonly Kind[]; deadline_ms?: number;
  fetchPage?: (url: string, o: FetchOpts) => Promise<PageResult>; log?: FetchOpts['log']; now?: () => number;
}
export const runtimePorts: Pick<SearchOpts, 'accounts' | 'harness' | 'dupe' | 'apify'> & { routed: NonNullable<SearchOpts['routed']> } = {
  accounts: undefined, harness: undefined, apify: undefined, routed: () => !!runtimePorts.harness,
};
export interface SearchResult { results: Found[]; searched: SiteSearched[] }

export interface SiteResult { searched: SiteSearched; rows: SearchRow[] }
const fields: Field[] = REQUIRED.map(name => ({ name, type: name === 'price_cents' ? 'number' : 'string', needs_session: false, required: true }));
function noListingCard(error: CallError): boolean {
  if (error.code !== 'page_changed') return false;
  const missing = error.hint.missing;
  return REQUIRED.every(field => missing.includes(field));
}

const noRoute = (source: Source, kind: Kind): SiteResult => ({ rows: [], searched: {
  site: source.site, kind, url: null, outcome: 'failed', ms: 0, count: 0, error_code: 'no_route', reason: 'no live route composed',
  ...(source.lane === 'apify' ? { route_id: ROUTE_IDS.facebook, cost_usd_est: 0 } : {}),
} });

const sourceRouted = (source: Source, o: SearchOpts): boolean =>
  source.lane === 'apify' ? !!o.apify : source.lane !== 'harness' || !!o.harness && (o.routed?.(source.site) ?? true);

// Admission precedes every pace slot, including the outer runPlan in the API.
export async function sourceUnavailable(source: Source, kind: Kind, o: SearchOpts): Promise<SiteResult | undefined> {
  if (!sourcesFor(o.caller, [source]).length) return { rows: [], searched: {
    site: source.site, kind, url: null, outcome: 'blocked', ms: 0, count: 0, reason: source.reason ?? "requires the person's search",
  } };
  if (!sourceRouted(source, o)) return noRoute(source, kind);
  if (source.needs_ask || kind === 'sold' && source.site === 'ebay') {
    const account = o.person_id && o.accounts && (await o.accounts.linked(o.person_id)).find(a => a.site === source.site && a.person_id === o.person_id);
    if (o.caller !== 'person' || !account) return { rows: [], searched: {
      site: source.site, kind, url: null, outcome: 'needs_account', ms: 0, count: 0, reason: "needs the person's account",
    } };
  }
}

// shortcut: Apify run counts live in process memory and reset on restart; move to the Store when the edge runs more than one instance
let apifyDay = '', apifyRuns = 0;
const apifyPeople = new Map<string, number>();
async function readApify(source: Source, lane: Lane, query: string, o: SearchOpts): Promise<SiteResult> {
  if (!o.apify) return noRoute(source, 'search');
  const day = new Date().toISOString().slice(0, 10);
  if (day !== apifyDay) { apifyDay = day; apifyRuns = 0; apifyPeople.clear(); }
  const person = o.person_id ?? o.visitor_id;
  const cap = !person || (apifyPeople.get(person) ?? 0) >= Number(searchParams.read('search_apify_runs_per_person_day', { person }).value)
    ? 'search_apify_runs_per_person_day'
    : apifyRuns >= Number(searchParams.read('search_apify_runs_per_day', {}).value) ? 'search_apify_runs_per_day' : undefined;
  if (cap) {
    o.log?.note('Apify search blocked', { lane, cap });
    return { rows: [], searched: { site: source.site, kind: 'search', url: null, outcome: 'blocked', ms: 0, count: 0,
    error_code: 'rate_limited', reason: cap, route_id: ROUTE_IDS[lane], cost_usd_est: 0 } };
  }
  // Reserve synchronously, before the outside call, so concurrent Facebook and eBay stages share both caps.
  apifyRuns++; apifyPeople.set(person!, (apifyPeople.get(person!) ?? 0) + 1);
  o.log?.note('Apify search admitted', { lane, person_runs: apifyPeople.get(person!), process_runs: apifyRuns });
  const at = performance.now();
  const run = () => o.apify!.search(lane, { q: query, limit: MAX_ITEMS,
    ...(lane === 'facebook' ? { city: searchParams.read('search_facebook_city', {}).value } : {}),
  }, o.signal ?? new AbortController().signal);
  const result = o.log ? await o.log.call('tool', ROUTE_IDS[lane], { lane }, run) : await run();
  const searched = { site: source.site, kind: 'search' as const, url: null, ms: Math.round(performance.now() - at), route_id: ROUTE_IDS[lane] };
  if (!result.ok) return { rows: [], searched: { ...searched, outcome: result.error.code === 'blocked' ? 'blocked' : 'failed',
    error_code: result.error.code, reason: result.error.message, count: 0, cost_usd_est: 0 } };
  return { rows: result.data.rows, searched: { ...searched, outcome: result.data.rows.length ? 'hit' : 'empty', count: result.data.rows.length,
    dropped: result.data.dropped, cost_usd_est: result.data.rows.length * Number(searchParams.read('search_apify_cost_per_row_usd', {}).value) } };
}

export async function searchSource(source: Source, query: string, kind: Kind = 'search', o: SearchOpts = {}): Promise<SiteResult> {
  const unavailable = await sourceUnavailable(source, kind, o);
  const read = () => source.lane === 'apify'
    ? kind === 'search' && source.site === 'facebook' ? readApify(source, 'facebook', query, o) : Promise.resolve(noRoute(source, kind))
    : readSource(source, query, kind, o);
  const result = unavailable ?? await (o.paced || source.lane === 'apify' ? read() : atPace(source.site, source.lane, source.pace, read));
  if (source.site === 'ebay' && kind === 'search' && o.caller === 'person' && o.apify &&
    (result.searched.outcome === 'blocked' || result.searched.error_code === 'blocked' || result.searched.error_code === 'no_route')) {
    const fallback = await readApify(source, 'ebay', query, o);
    return { ...fallback, searched: { ...fallback.searched, fallback: 'apify' } };
  }
  return { ...result, searched: { ...result.searched, ...(source.pace && source.lane !== 'apify' ? { pace: source.pace } : {}) } };
}

async function readSource(source: Source, query: string, kind: Kind, o: SearchOpts): Promise<SiteResult> {
  const blocked = (reason: string): SiteResult => ({ rows: [], searched: {
    site: source.site, kind, url: null, outcome: 'blocked', ms: 0, count: 0, reason,
  } });
  if (source.site === 'dupe') {
    if (kind !== 'search') return blocked('Dupe is a search-only source');
    const now = o.now ?? (() => performance.now()), t0 = now();
    const result = await (o.dupe ?? dupe).search({ q: query }, o.signal ?? new AbortController().signal);
    if (!result.ok) return { rows: [], searched: { site: 'dupe', kind, url: null, outcome: result.error.code === 'not_found' ? 'empty' : 'failed',
      error_code: result.error.code, reason: result.error.message, ms: Math.round(now() - t0), count: 0 } };
    // Dupe's secondhand flag misses some eBay rows; preserve it as given, including false.
    return { rows: result.data.rows, searched: { site: 'dupe', kind, url: null, outcome: result.data.rows.length ? 'hit' : 'empty', ms: Math.round(now() - t0), count: result.data.rows.length } };
  }
  if (source.lane === 'public_page') return searchSite(source.site, query, kind, o);
  const account = o.person_id && o.accounts ? (await o.accounts.linked(o.person_id)).find(a => a.site === source.site && a.person_id === o.person_id) : undefined;
  const site = source.site;
  const run = () => o.harness!.call<(SnapListing & { title?: string; slug?: string; condition?: string; size?: string; listed_at?: string; sold_at?: string; currency: string; url: string; host?: string; converted?: boolean })[]>(site, 'search', {
    q: query, status: kind === 'sold' ? 'sold' : 'active', ...(account ? { account_id: account.account_id, person_id: o.person_id } : {}),
  });
  const result = o.log ? await o.log.call('tool', `${source.id}.search`, { account_id: account?.account_id }, run) : await run();
  if (!result.ok) {
    const failure = blocked(result.error.message);
    if (noListingCard(result.error)) {
      return { rows: [], searched: { ...failure.searched, outcome: 'unknown', reason: 'no listing card', ms: result.meta.ms } };
    }
    failure.searched.outcome = result.error.code === 'auth_expired' ? 'needs_account' : result.error.code === 'not_found' ? 'empty' : result.error.code === 'page_changed' ? 'page_changed' : 'failed';
    failure.searched.error_code = result.error.code;
    failure.searched.ms = result.meta.ms;
    return failure;
  }
  // Depop's public search payload has no title; its listing slug is the adapter's only item text.
  const rows = result.data.map(row => ({ id: row.external_id, title: row.title ?? (site === 'depop' ? row.slug : undefined), price_cents: row.price_cents,
    currency: row.currency, url: row.url, condition: row.condition, size: row.size, listed_at: row.listed_at, sold_date: row.sold_at,
    ...(row.host ? { host: row.host } : {}), ...(row.converted ? { converted: true } : {}), ...(row.state === 'sold' ? { sold: true as const } : {}) }));
  const read = classifyRead({ challenge: false, rows }, { site: source.site, fields });
  if (!read.ok && noListingCard(read.error)) return { rows: [], searched: { ...blocked('no listing card').searched, outcome: 'unknown', ms: result.meta.ms } };
  if (!read.ok) return { rows: [], searched: { ...blocked(read.error.message).searched, outcome: 'page_changed', error_code: 'page_changed', ms: result.meta.ms } };
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
  if (!p.ok) return done(p.kind === 'not_found' ? 'empty' : p.kind, [], { reason: p.reason, ...(p.kind === 'blocked' ? { error_code: 'blocked' } : {}) });
  if (detectBlock(p.status, p.html)) return done('blocked', [], { error_code: 'blocked' });
  const r = readPage(site, p.html, kind);
  if (!r.ok && noListingCard(r.error)) return done('unknown', [], { reason: 'no listing card' });
  if (!r.ok) return r.error.code === 'page_changed' ? done('page_changed', [], { error_code: 'page_changed', missing: r.error.hint.do === 'author' ? r.error.hint.missing : [] }) : done('blocked', [], { error_code: r.error.code });
  // A login wall carries no cards and no error: say blocked, not empty.
  const loginWall = /<form\b[^>]*(?:action=["'][^"']*(?:login|signin)|id=["']login)|(?:log in|sign in) to (?:continue|see|view|search|use|facebook)/i;
  if (!r.data.length && loginWall.test(p.html)) return done('blocked', [], { reason: 'login required', error_code: 'blocked' });
  return done(r.data.length ? 'hit' : 'empty', r.data, r.dropped ? { dropped: r.dropped } : {});
}

export async function searchAll(query: string, o: SearchOpts = {}): Promise<SearchResult> {
  const sources = sourcesFor(o.caller, o.sources).filter(source => !o.sites || o.sites.some(site => source.covers.includes(site)));
  const targets = sources.flatMap(source => (o.kinds ?? ['search']).map(kind => ({ source, kind })));
  const per = await Promise.all(targets.map(({ source, kind }) => searchSource(source, query, kind, o)));
  return { results: per.flatMap(x => x.rows.map(row => ({ site: x.searched.site, row }))), searched: per.map(x => x.searched) };
}
