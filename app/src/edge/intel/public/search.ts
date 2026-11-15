// Source rows select the approved lanes; public pages share fetch.ts's limiter and semaphore.
import { atPace, searchParams, type Pace } from '../run.ts';
import { classifyRead, type CallError, type Field, type Harness, type Site } from '../../harness/protocol.ts';
import type { Accounts, LinkedAccount } from '../../browser/auth.ts';
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
export type SearchRow = Row & {
  host?: string; converted?: boolean; may_store?: boolean; stock?: 'in_stock' | 'out_of_stock' | 'unknown';
  shipping_cents?: number; price_high_cents?: number; buying_format?: string; bid_count?: number; best_offer?: boolean;
  sold_count?: number; watchers?: number; ships_from?: string; sponsored?: boolean;
} & Partial<Omit<DupeRow, keyof Row>> & Partial<Pick<ApifyRow, 'via' | 'actor' | 'may_model' | 'use_scope'>>;

export type SiteOutcome = 'hit' | 'empty' | 'blocked' | 'timeout' | 'page_changed' | 'needs_account' | 'failed' | 'unknown';
export interface SiteSearched { site: SourceSite; kind: Kind; url: string | null; outcome: SiteOutcome; ms: number; count: number; missing?: string[]; reason?: string; error_code?: string; pace?: Pace; dropped?: number; route_id?: string; fallback?: 'apify'; cost_usd_est?: number }
export interface Found { site: SourceSite; row: SearchRow }
export interface SearchOpts {
  paced?: boolean; routed?: (site: SourceSite) => boolean; apify?: Pick<ReturnType<typeof createApify>, 'search'>; visitor_id?: string;
  apifyRuns?: { reserve(person_id: string, day: string): Promise<{ ok: true } | { ok: false; cap: string }> };
  dupe?: Pick<ReturnType<typeof createDupe>, 'search'>; signal?: AbortSignal;
  caller?: Caller; sources?: readonly Source[]; person_id?: string; accounts?: Accounts; harness?: Harness;
  // null pins a public read; undefined selects the person's current linked account.
  account?: LinkedAccount | null;
  sites?: readonly Site[]; kinds?: readonly Kind[]; deadline_ms?: number;
  fetchPage?: (url: string, o: FetchOpts & { signal?: AbortSignal }) => Promise<PageResult>; log?: FetchOpts['log']; now?: () => number;
}
export const runtimePorts: Pick<SearchOpts, 'accounts' | 'harness' | 'dupe' | 'apify' | 'apifyRuns'> & { routed: NonNullable<SearchOpts['routed']> } = {
  accounts: undefined, harness: undefined, apify: undefined, apifyRuns: undefined, routed: () => !!runtimePorts.harness,
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

async function sourceAccount(source: Source, o: SearchOpts): Promise<LinkedAccount | undefined> {
  if (o.caller !== 'person' || !o.person_id) return undefined;
  const account = o.account === undefined ? (await o.accounts?.linked(o.person_id))?.find(a => a.site === source.site && a.person_id === o.person_id) : o.account;
  return account?.site === source.site && account.person_id === o.person_id ? account : undefined;
}

// Admission precedes every pace slot, including the outer runPlan in the API.
export async function sourceUnavailable(source: Source, kind: Kind, o: SearchOpts): Promise<SiteResult | undefined> {
  if (!sourcesFor(o.caller, [source]).length) return { rows: [], searched: {
    site: source.site, kind, url: null, outcome: 'blocked', ms: 0, count: 0, reason: source.reason ?? "requires the person's search",
  } };
  if (source.needs_ask || kind === 'sold' && source.site === 'ebay') {
    const account = await sourceAccount(source, o);
    if (o.caller !== 'person' || !account) return { rows: [], searched: {
      site: source.site, kind, url: null, outcome: 'needs_account', ms: 0, count: 0, reason: 'needs your account',
    } };
  }
  if (!sourceRouted(source, o)) return noRoute(source, kind);
}

// Test adapter only. Runtime composition must supply an atomic, durable reservation port.
export function memoryApifyRuns(): NonNullable<SearchOpts['apifyRuns']> {
  const days = new Map<string, { total: number; people: Map<string, number> }>();
  return { async reserve(person_id, day) {
    const counts = days.get(day) ?? { total: 0, people: new Map<string, number>() };
    const personRuns = counts.people.get(person_id) ?? 0;
    if (personRuns >= Number(searchParams.read('search_apify_runs_per_person_day', { person: person_id }).value))
      return { ok: false, cap: 'search_apify_runs_per_person_day' };
    if (counts.total >= Number(searchParams.read('search_apify_runs_per_day', {}).value))
      return { ok: false, cap: 'search_apify_runs_per_day' };
    counts.total++; counts.people.set(person_id, personRuns + 1); days.set(day, counts);
    return { ok: true };
  } };
}

async function readApify(source: Source, lane: Lane, query: string, o: SearchOpts): Promise<SiteResult> {
  if (o.caller !== 'person' || !o.person_id) return { rows: [], searched: {
    site: source.site, kind: 'search', url: null, outcome: 'blocked', ms: 0, count: 0, reason: "requires the person's search",
  } };
  if (!o.apify || !o.apifyRuns) return noRoute(source, 'search');
  const day = new Date().toISOString().slice(0, 10);
  const reserved = await o.apifyRuns.reserve(o.person_id, day);
  if (!reserved.ok) {
    const { cap } = reserved;
    o.log?.note('Apify search blocked', { lane, cap });
    return { rows: [], searched: { site: source.site, kind: 'search', url: null, outcome: 'blocked', ms: 0, count: 0,
    error_code: 'rate_limited', reason: cap, route_id: ROUTE_IDS[lane], cost_usd_est: 0 } };
  }
  o.log?.note('Apify search admitted', { lane, day });
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
  const result = unavailable ?? await (o.paced || source.lane === 'apify' ? read() : atPace(source.site, source.lane, source.pace, read, o.signal));
  return { ...result, rows: result.rows.map(row => ({ ...row, ...source.rights })), searched: { ...result.searched, ...(source.pace && source.lane !== 'apify' ? { pace: source.pace } : {}) } };
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
    return { rows: result.data.rows, searched: { site: 'dupe', kind, url: null, outcome: result.data.rows.length ? 'hit' : 'empty', ms: Math.round(now() - t0), count: result.data.rows.length, ...(result.data.dropped ? { dropped: result.data.dropped } : {}) } };
  }
  if (source.lane === 'public_page') return searchSite(source.site, query, kind, o);
  const account = await sourceAccount(source, o);
  const site = source.site;
  const run = () => o.harness!.call<(SnapListing & SearchRow & { slug?: string; sold_at?: string; seller_ref_hash?: string })[]>(site, 'search', {
    signal: o.signal, q: query, status: kind === 'sold' ? 'sold' : 'active', ...(account ? { account_id: account.account_id, person_id: o.person_id } : {}),
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
    ...Object.fromEntries(Object.entries({ image_url: row.image_url, brand: row.brand, likes: row.likes, comments: row.comments, shares: row.shares, seller_hash: row.seller_ref_hash,
      shipping_cents: row.shipping_cents, price_high_cents: row.price_high_cents, buying_format: row.buying_format, bid_count: row.bid_count,
      best_offer: row.best_offer, sold_count: row.sold_count, watchers: row.watchers, ships_from: row.ships_from, sponsored: row.sponsored,
    }).filter(([, value]) => value !== undefined)),
    ...(row.host ? { host: row.host } : {}), ...(row.converted ? { converted: true } : {}), ...('stock' in row ? { stock: row.stock as SearchRow['stock'] } : {}), ...(row.state === 'sold' ? { sold: true as const } : {}) }));
  const read = classifyRead({ challenge: false, rows }, { site: source.site, fields });
  if (!read.ok && noListingCard(read.error)) return { rows: [], searched: { ...blocked('no listing card').searched, outcome: 'unknown', ms: result.meta.ms, dropped: rows.length } };
  if (!read.ok) return { rows: [], searched: { ...blocked(read.error.message).searched, outcome: 'page_changed', error_code: 'page_changed', ms: result.meta.ms, dropped: rows.length } };
  return { rows: read.data, searched: { site: source.site, kind, url: null, outcome: rows.length ? 'hit' : 'empty', ms: result.meta.ms, count: rows.length } };
}

export async function searchSite(site: Site, query: string, kind: Kind = 'search', o: SearchOpts = {}): Promise<SiteResult> {
  const fetchPage = o.fetchPage ?? sharedFetch, now = o.now ?? (() => performance.now());
  const deadline_ms = o.deadline_ms ?? 15_000;
  const url = searchUrl(site, query, kind), t0 = now();
  const done = (outcome: SiteOutcome, rows: Row[] = [], extra: Partial<SiteSearched> = {}): SiteResult =>
    ({ searched: { site, kind, url, outcome, ms: Math.round(now() - t0), count: rows.length, ...extra }, rows });
  if (url === null) return done('empty', [], { reason: 'no sold results signed out' });
  const signal = o.signal;
  const fetchImpl: typeof fetch | undefined = signal ? (input, init) => fetch(input, { ...init,
    signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]),
  }) : undefined;
  let p: PageResult;
  try { p = await fetchPage(url, { deadline_ms, log: o.log, signal, ...(fetchImpl ? { fetchImpl } : {}) }); }
  catch (e) { o.log?.error('search.fetch', e); return done('timeout', [], { reason: e instanceof Error ? e.message : 'fetch threw' }); }
  if (!p.ok) return done(p.kind === 'not_found' ? 'empty' : p.kind, [], { reason: p.reason, ...(p.kind === 'blocked' ? { error_code: 'blocked' } : {}) });
  if (detectBlock(p.status, p.html)) return done('blocked', [], { error_code: 'blocked' });
  const r = readPage(site, p.html, kind);
  if (!r.ok && noListingCard(r.error)) return done('unknown', [], { reason: 'no listing card', ...(r.yield?.dropped ? { dropped: r.yield.dropped } : {}) });
  if (!r.ok) return r.error.code === 'page_changed' ? done('page_changed', [], { error_code: 'page_changed', missing: r.error.hint.do === 'author' ? r.error.hint.missing : [], ...(r.yield?.dropped ? { dropped: r.yield.dropped } : {}) }) : done('blocked', [], { error_code: r.error.code });
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
