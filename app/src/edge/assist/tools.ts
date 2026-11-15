// Rests-on: features/assist/README.md#the-conversation-agent-proposal; packet 78 DBX-A1;
// spec/product.md comp, valuation, citation; spec/determinations/money.md D1-D15.
import type { Log } from '../../../../log/index.js';
import type { ToolName, ToolResult } from './types.ts';
import { searchSource, runtimePorts as searchRuntime, type SiteResult } from '../intel/public/search.ts';
import { SOURCES, sourcesFor, type SourceSite } from '../intel/public/sources.ts';
import { fetchPage } from '../intel/fetch.ts';
import { PROTOCOLS } from '../intel/protocols.ts';
import { normalize } from '../intel/run.ts';
import { createDupe } from '../harness/sites/dupe/adapter.ts';
import { soldSearch } from '../api/valuation-sold.ts';
import { soldSources, toComps, type Search, type SoldRow, type SoldSite } from '../../engines/valuation/sold.ts';
import { valuate, type ValuateCtx, type ValuationItem } from '../../engines/valuation/valuate.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { FEES } from '../../engines/valuation/keep.ts';
import { handlers as searchHandlers, type OfferView } from '../api/search.ts';
import { jobs, type SseFrame } from '../api/jobs.ts';
import { ports as geniePorts } from '../api/genie.ts';
import { comparables, DEFAULTS } from '../../engines/valuation/comps.ts';
import { answer, basisHash } from '../../engines/proof/proof.ts';
import { productTrend, type SoldComp } from '../market/market.ts';
import type { Fact } from '../intel/answer.ts';
import { genie, type GenieDeps } from '../genie/genie.ts';

export interface StorePort {
  host: string;
  warehouse_id: string;
  token(): Promise<string>;
  fetch: typeof globalThis.fetch;
}
export type LateUpdate = { result_id: string; site: string; rows: Row[]; sites_pending: string[] };
export type SearchToolResult = ToolResult & { result_id: string };
export interface SearchJobPort {
  start(input: { query: string; caller: 'visitor' | 'person'; person_id?: string; signal: AbortSignal }): Promise<{ id: string }>;
  listen(id: string, fn: () => void): () => void;
  framesAfter(id: string, after: number): SseFrame[];
}
export interface ToolDeps {
  search(site: SourceSite, query: string, signal: AbortSignal): Promise<SiteResult>;
  sold: Search;
  store: StorePort | null;
  forUser?(person_id: string): Promise<GenieDeps | null>;
  person_id?: string;
  searchJob?: SearchJobPort;
  onLate?(update: LateUpdate): void;
  valuation?: Pick<ValuateCtx, 'params' | 'observations'>;
  caller: 'visitor' | 'person';
  now(): number;
  log: Log;
}

const DEADLINE_MS = PROTOCOLS.listings_matching.budget.settled_ms;
const SOLD_SITES: readonly SoldSite[] = ['mercari', 'poshmark'];
const conditions = Object.keys(DEFAULTS.condition_ratios);
// Apify never sits in the path an answer waits on (product/words.md, 2026-11-15 nate apify stays out of the latency path).
const onSites = SOURCES.filter(s => s.on && s.lane !== 'apify').map(s => s.site);
const querySchema = { type: 'string', minLength: 1, maxLength: 200 };
const conditionSchema = { type: 'string', maxLength: 200, enum: conditions };
const FUNCTIONS = {
  asks: { term: 'STRING', site: 'STRING', days: 'INT' },
  term_trend: { term: 'STRING', site: 'STRING', weeks: 'INT' },
  top_terms: { kind: 'STRING', site: 'STRING', days: 'INT', k: 'INT' },
  sell_through: { kind: 'STRING', site: 'STRING' },
  coverage_now: {},
  ask_genie: { question: 'STRING' },
} as const;
type FunctionName = keyof typeof FUNCTIONS;
const statements = Object.fromEntries(Object.entries(FUNCTIONS).map(([name, args]) =>
  [name, `SELECT * FROM secondhand.market.${name}(${Object.keys(args).map(key => `:${key}`).join(', ')})`]));
const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)) =>
  ({ type: 'object' as const, properties, additionalProperties: false as const, required });
const functionSchema = (name: FunctionName) => objectSchema(Object.fromEntries(Object.entries(FUNCTIONS[name]).map(([key, type]) =>
  [key, type === 'INT' ? { type: 'integer', minimum: -2147483648, maximum: 2147483647 } : { type: 'string', minLength: 1, maxLength: key === 'question' ? 500 : 200 }])));

export const TOOL_DEFS = [
  { name: 'search_market', description: 'Returns live listings and counts, median asks and mean likes for each site. It cannot read stored listings or verify product attributes.',
    input_schema: objectSchema({ query: querySchema, sites: { type: 'array', uniqueItems: true, items: { type: 'string', maxLength: 200, enum: onSites } }, exclude_brand: querySchema }, ['query']), strict: true },
  { name: 'value_item', description: 'Returns sold price ranges and fee keeps with comp counts and citations. It cannot confirm a price from too few sales.',
    input_schema: objectSchema({ query: querySchema, condition: conditionSchema }), strict: true },
  { name: 'price_trend', description: 'Returns recent and prior sold medians with their evidence. It cannot claim a direction without a measured noise band.',
    input_schema: objectSchema({ query: querySchema }), strict: true },
  { name: 'where_to_list', description: 'Returns what each site keeps after fees at the sold price range. It cannot predict sale odds, time to sell or an expected keep ranking without a sale curve.',
    input_schema: objectSchema({ query: querySchema, condition: conditionSchema }), strict: true },
  { name: 'market_store', description: 'Returns rows from a governed market function, or cited SQL and tables from Genie for a signed-in person. It cannot answer from a disconnected store or a missing function.',
    input_schema: { ...objectSchema({ function: { type: 'string', maxLength: 200, enum: Object.keys(FUNCTIONS) }, args: { anyOf: Object.keys(FUNCTIONS).map(n => functionSchema(n as FunctionName)) } }),
      anyOf: Object.keys(FUNCTIONS).map(n => objectSchema({ function: { const: n, type: 'string', maxLength: 200 }, args: functionSchema(n as FunctionName) })) }, strict: true },
] satisfies { name: ToolName; description: string; input_schema: Record<string, unknown>; strict: true }[];

export function defaultDeps(env: Record<string, string | undefined>, fetch: typeof globalThis.fetch, log: Log): ToolDeps {
  const { DATABRICKS_HOST: host, DATABRICKS_TOKEN: token, DATABRICKS_WAREHOUSE_ID: warehouse_id } = env;
  const dupe = createDupe({ send: (url, init) => fetch(url, init), log });
  const page = (signal: AbortSignal) => (url: string, opts: Parameters<typeof fetchPage>[1]) =>
    fetchPage(url, { ...opts, fetchImpl: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) }) });
  const deps: ToolDeps = {
    caller: 'visitor', now: Date.now, log,
    search: (site, query, signal) => {
      const source = SOURCES.find(s => s.site === site && s.on);
      if (!source) return Promise.reject(new Error('source is not on'));
      return searchSource(source, query, 'search', { ...searchRuntime, caller: deps.caller === 'person' ? 'person' : 'background', person_id: deps.person_id, signal, dupe, deadline_ms: DEADLINE_MS, fetchPage: page(signal), log });
    },
    sold: (site, query, signal) => {
      const live_sites = (env.SECONDHAND_LIVE_SITES ?? '').split(/[ ,]+/).filter(Boolean);
      if (!live_sites.includes(site)) return Promise.resolve({ rows: [], outcome: 'blocked', reason: 'SECONDHAND_LIVE_SITES is missing or does not enable this site' });
      if (deps.caller !== 'person') return Promise.resolve({ rows: [], outcome: 'needs_account' });
      return soldSearch({ ...searchRuntime, live_sites, caller: deps.caller, person_id: deps.person_id, signal, fetchPage: page(signal), log })(site, query, signal);
    },
    store: host && token && warehouse_id ? { host, warehouse_id, token: async () => token, fetch } : null,
    forUser: person_id => geniePorts.forUser(person_id),
    searchJob: {
      async start(input) {
        input.signal.throwIfAborted();
        if (input.caller === 'person' && !input.person_id) throw new Error('person_id required');
        const reply = await searchHandlers['POST /v1/search']({
          user_id: input.caller === 'person' ? input.person_id! : null,
          visitor_id: input.caller === 'visitor' ? `vis_${crypto.randomUUID().replaceAll('-', '')}` : null,
          request_id: crypto.randomUUID(), params: {}, query: new URLSearchParams(), body: { text: input.query }, headers: new Headers(), log,
        }, new Request('http://assist.internal/v1/search', { method: 'POST', signal: input.signal }));
        if (reply instanceof Response || reply.status !== 202 || !text(object(reply.body)?.id)) throw new Error('search job did not start');
        return { id: String(object(reply.body)!.id) };
      },
      listen: (id, fn) => jobs.listen(id, fn),
      framesAfter: (id, after) => jobs.framesAfter(id, after),
    },
  };
  return deps;
}

export function format(value: number | null, unit: 'cents' | 'share'): string | null {
  if (value === null) return null;
  if (unit === 'share') return `${Math.round(value * 100)}%`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: value % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value / 100);
}

const object = (input: unknown): Record<string, unknown> | null =>
  input !== null && typeof input === 'object' && !Array.isArray(input) && [Object.prototype, null].includes(Object.getPrototypeOf(input)) ? input as Record<string, unknown> : null;
const text = (input: unknown): input is string => typeof input === 'string' && input.trim().length > 0;
const query = (input: unknown): input is string => text(input) && input.length <= 200;
const keys = (input: Record<string, unknown>, allowed: readonly string[], required: readonly string[]) =>
  Object.keys(input).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(input, k));
type Input = { query: string; condition?: string; sites?: SourceSite[]; exclude_brand?: string } | { function: FunctionName; args: Record<string, string | number> };

function validate(name: string, input: unknown): input is Input {
  const x = object(input);
  if (!x || !TOOL_DEFS.some(d => d.name === name)) return false;
  if (name === 'market_store') {
    if (!keys(x, ['function', 'args'], ['function', 'args']) || typeof x.function !== 'string' || !Object.hasOwn(FUNCTIONS, x.function)) return false;
    const args = object(x.args), spec = FUNCTIONS[x.function as FunctionName];
    return args !== null && keys(args, Object.keys(spec), Object.keys(spec)) && Object.entries(spec).every(([key, type]) =>
      type === 'STRING' ? text(args[key]) && args[key].length <= (key === 'question' ? 500 : 200) : typeof args[key] === 'number' && Number.isInteger(args[key]) && args[key] >= -2147483648 && args[key] <= 2147483647);
  }
  const needsCondition = name === 'value_item' || name === 'where_to_list';
  const allowed = name === 'search_market' ? ['query', 'sites', 'exclude_brand'] : needsCondition ? ['query', 'condition'] : ['query'];
  if (!keys(x, allowed, needsCondition ? ['query', 'condition'] : ['query']) || !query(x.query)) return false;
  if (needsCondition && (typeof x.condition !== 'string' || !conditions.includes(x.condition))) return false;
  if (Object.hasOwn(x, 'exclude_brand') && !query(x.exclude_brand)) return false;
  if (Object.hasOwn(x, 'sites') && (!Array.isArray(x.sites) || !x.sites.every(s => onSites.includes(s)) || new Set(x.sites).size !== x.sites.length)) return false;
  return true;
}

type Row = ToolResult['rows'][number];
function empty(tool: ToolName, as_of: string): ToolResult {
  return { tool, ok: true, rows: [], counts: {}, as_of, citation_ids: [], basis: '', not_built: [], widgets: [], ms: 0 };
}
function fail(r: ToolResult, reason: string, basis: string): ToolResult {
  return { ...r, ok: false, reason, basis };
}
const productId = (q: string) => `q_${normalize(q).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}`;
const money = (name: string, cents: number | null): Row => ({ [name]: format(cents, 'cents'), [`${name}_cents`]: cents });

async function deadline<T>(work: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, budget_ms = DEADLINE_MS): Promise<T> {
  const ctl = new AbortController();
  const signal = AbortSignal.any([parent, ctl.signal]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: () => void = () => {};
  try {
    signal.throwIfAborted();
    const aborted = new Promise<never>((_resolve, reject) => {
      stop = () => reject(signal.reason);
      signal.addEventListener('abort', stop, { once: true });
      timer = setTimeout(() => ctl.abort(new Error('tool deadline exceeded')), budget_ms);
    });
    return await Promise.race([work(signal), aborted]);
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', stop); ctl.abort();
  }
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
type SearchOffer = OfferView & { likes?: number };
function offerMoney(name: string, value: OfferView['price_cents']): Row {
  if (!value) return { [name]: null, [`${name}_cents`]: null };
  if (value.currency === 'USD') return money(name, value.amount_cents);
  return { [name]: new Intl.NumberFormat('en-US', { style: 'currency', currency: value.currency }).format(value.amount_cents / 100),
    [`${name}_cents`]: value.amount_cents };
}
function listing(row: SearchOffer): Row {
  return { id: row.id, citation_id: row.id, listing_id: row.listing_id, site: row.site, title: row.title,
    url: row.url, condition: row.condition, relation: row.relation, ...offerMoney('price', row.price_cents),
    currency: row.price_cents?.currency ?? null, ...offerMoney('delivered', row.delivered_cents), likes: row.likes ?? null,
    ...(row.may_model === undefined ? {} : { may_model: row.may_model }), ...(row.use_scope === undefined ? {} : { use_scope: row.use_scope }),
    ...(row.site === 'dupe' ? { source: 'dupe', commercial: true, attribution: 'via Dupe.com' } : row.attribution ? { attribution: row.attribution } : {}) };
}
function searchRows(data: Record<string, unknown>, x: Extract<Input, { query: string }>, d: ToolDeps, r: ToolResult): { rows: Row[]; sites_pending: string[] } {
  const allowed = sourcesFor(d.caller === 'person' ? 'person' : 'background').map(s => s.site);
  const eligible = (site: string) => allowed.includes(site as SourceSite) && (!x.sites || x.sites.includes(site as SourceSite));
  const pending = (data.sites_pending as string[] | undefined ?? []).filter(eligible);
  const brand = x.exclude_brand ? new RegExp(`(?<![\\p{L}\\p{N}_])${x.exclude_brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'iu') : null;
  const offers = (data.results as SearchOffer[]).filter(row => eligible(row.site));
  const kept = offers.filter(row => !brand || !brand.test(row.title));
  const sites = [...new Set(kept.map(row => row.site))];
  const rows = kept.slice(0, Math.max(0, 30 - sites.length)).map(listing);
  r.counts = { rows: rows.length, sites_hit: new Set(rows.map(row => row.site)).size, sites_pending: pending.length,
    dropped_brand: offers.length - kept.length, ...Object.fromEntries(pending.map(site => [`${site}_pending`, 1])) };
  const summaries = [...new Set(rows.map(row => String(row.site)))].map(site => {
    const local = rows.filter(row => row.site === site), prices = local.filter(row => row.currency === 'USD').map(row => Number(row.price_cents));
    const likes = local.flatMap(row => typeof row.likes === 'number' ? [row.likes] : []);
    const p50 = median(prices), mean = likes.length ? likes.reduce((a, b) => a + b, 0) / likes.length : null;
    r.counts[`${site}_n`] = local.length; r.counts[`${site}_rows`] = local.length; r.counts[`${site}_likes_rows`] = likes.length;
    if (p50 !== null) r.counts[`${site}_p50_ask_cents`] = p50;
    if (mean !== null) r.counts[`${site}_likes_per_listing`] = mean;
    const id = `summary:${site}:${basisHash(local.map(row => ({ id: String(row.id), source: String(row.url), at: r.as_of, ...(typeof row.price_cents === 'number' ? { price_cents: row.price_cents } : {}) })))}`;
    return { id, citation_id: id, kind: 'site_summary', site, n: local.length, ...money('p50_ask', p50),
      likes_per_listing: mean, likes_rows: likes.length, basis_ids: JSON.stringify(local.map(row => row.id)) };
  });
  return { rows: [...rows, ...summaries], sites_pending: pending };
}
async function searchMarket(x: Extract<Input, { query: string }>, d: ToolDeps, signal: AbortSignal, r: ToolResult): Promise<ToolResult> {
  r.widgets = [x.exclude_brand ? 'alternatives' : 'listings'];
  r.not_built = ['answers from live reads only; stored rows (MI2) are not built'];
  if (x.exclude_brand) r.not_built.push('brand matched by title words; the attribute record (AD9) is not built');
  if (!d.searchJob) return fail(r, 'not_connected', 'search job is not connected');
  const port = d.searchJob;
  const { id } = await port.start({ query: x.query.trim(), caller: d.caller, person_id: d.person_id, signal });
  const first_id = `${id}:first`;
  return new Promise<ToolResult>((resolve, reject) => {
    let cursor = 0, first = true, late = 0, settled = false, closed = false;
    let off: (() => void) | undefined;
    const stop = () => { closed = true; off?.(); signal.removeEventListener('abort', abort); };
    const abort = () => { stop(); if (first) reject(signal.reason); };
    const pump = () => {
      if (closed) return;
      try {
        for (const frame of port.framesAfter(id, cursor)) {
          cursor = frame.id;
          if (frame.event === 'job.state' && frame.data.state === 'failed') {
            d.log.error('assist.search.job', frame.data.error ?? new Error('search job failed'));
            stop(); if (first) resolve(fail(r, 'failed', 'search job failed')); return;
          }
          if (!['answer.partial', 'answer.settled', 'answer.late'].includes(frame.event)) continue;
          const snapshot = { ...r, counts: {} };
          const update = searchRows(frame.data, x, d, snapshot);
          if (first) {
            first = false;
            const result: SearchToolResult = { ...r, result_id: first_id, rows: update.rows,
              counts: snapshot.counts, citation_ids: update.rows.map(row => String(row.citation_id)), basis: 'search job rows' };
            resolve(result);
          } else d.onLate?.({ result_id: `${first_id}:late:${++late}`, site: typeof frame.data.site === 'string' ? frame.data.site : 'all', ...update });
          if (frame.event === 'answer.settled') settled = true;
          if (settled && update.sites_pending.length === 0) { stop(); return; }
        }
      } catch (error) { stop(); if (first) reject(error); else d.log.error('assist.search.late', error); }
    };
    signal.addEventListener('abort', abort, { once: true });
    try { off = port.listen(id, pump); if (closed) off(); else if (signal.aborted) abort(); else pump(); }
    catch (error) { stop(); reject(error); }
  });
}

type SoldRead = { site: SoldSite; reply: Awaited<ReturnType<Search>>; read_at: string };
async function soldReads(q: string, d: ToolDeps, signal: AbortSignal): Promise<SoldRead[]> {
  return Promise.all(SOLD_SITES.map(site => deadline(async s => {
    const reply = await d.log.call('tool', 'assist.sold', { site }, () => d.sold(site, q, s), out => ({ outcome: out.outcome, count: out.rows.length }));
    if (!['hit', 'empty'].includes(reply.outcome)) d.log.error(`assist.sold.${site}`, new Error(reply.reason ?? reply.outcome));
    if (!['hit', 'empty', 'blocked', 'needs_account'].includes(reply.outcome)) throw new Error(`sold ${site}: ${reply.outcome}`);
    if (reply.outcome === 'blocked' && !/SECONDHAND_LIVE_SITES|live reads are disabled/.test(reply.reason ?? '')) throw new Error(`sold ${site}: blocked`);
    return { site, reply, read_at: new Date(d.now()).toISOString() };
  }, signal)));
}
function disconnected(reads: SoldRead[], r: ToolResult): ToolResult | null {
  if (reads.some(read => ['hit', 'empty'].includes(read.reply.outcome))) return null;
  return fail(r, 'not_connected', 'sold reads need SECONDHAND_LIVE_SITES; ' + reads.map(read => `${read.site}: ${read.reply.outcome}`).join('; '));
}

export function toTrendComps(site: SoldSite, rows: readonly SoldRow[], q: { query: string; condition: string }, read_at: string): SoldComp[] {
  // Normalize each sale independently: productTrend owns trimming within its separate time windows.
  const adjusted = toComps(site, rows, q).flatMap(c => comparables({ condition: q.condition }, [c], read_at).comps);
  return adjusted.map(c => ({ id: c.comp_id, product_id: productId(q.query), kind: 'unknown', price_cents: c.adjusted_cents,
    // productSnapshot applies age decay at each window's endpoint; do not apply it twice.
    sold_at: c.sold_at, site: c.site, weight: c.w / c.w_age,
    ...(/^https?:\/\//i.test(c.citation) ? { evidence: { source_url: c.citation, read_at, snapshot_ref: null, fingerprint: basisHash([{ id: c.comp_id, source: c.citation, at: c.sold_at, price_cents: c.price_cents }]),
      extractor_version: 'valuation.sold', rights: { may_share: true, may_store: false, may_model: false } } } : {}) }));
}

async function soldTool(name: 'value_item' | 'where_to_list' | 'price_trend', x: Extract<Input, { query: string }>, d: ToolDeps, signal: AbortSignal, r: ToolResult): Promise<ToolResult> {
  r.widgets = [name === 'value_item' ? 'price_range' : name === 'price_trend' ? 'price_trend' : 'sites'];
  if (d.caller !== 'person') return fail(r, 'not_connected', 'sold reads need a person caller and SECONDHAND_LIVE_SITES');
  const reads = await soldReads(x.query.trim(), d, signal);
  const off = disconnected(reads, r); if (off) return off;
  const q = { query: x.query, condition: x.condition ?? 'good' };
  const usable = reads.filter(read => ['hit', 'empty'].includes(read.reply.outcome));
  const unavailable = reads.filter(read => !usable.includes(read)).map(read => `${read.site}: ${read.reply.outcome}`);
  const product_id = productId(x.query);
  if (name === 'price_trend') {
    const mapped = usable.flatMap(read => toTrendComps(read.site, read.reply.rows, q, read.read_at));
    const proof = answer(null, mapped.map(c => ({ id: c.id, source: c.evidence?.source_url ?? c.id, at: c.sold_at, price_cents: c.price_cents, weight: c.weight })), {
      metric: 'price_trend', filters: { product_id }, table_versions: [], definition_version: 'market.M19', code_version: 'assist.tools', param_versions: {}, model_version: null,
    }, r.as_of);
    const citation_id = proof.ok ? proof.citation.id : '';
    const trend = productTrend(product_id, mapped, { now: new Date(r.as_of), citation_id });
    const row: Row = { ...money('p50_recent', factNumber(trend.p50_recent)), ...money('p50_prior', factNumber(trend.p50_prior)),
      change_pct: format(factNumber(trend.change), 'share'), direction: trend.direction.guarded.hide_reason === 'noise' ? 'noise' : factString(trend.direction),
      basis_count: trend.change.guarded.basis_count, as_of: r.as_of, citation_id: citation_id || null,
      hide_reason: trend.direction.guarded.hide_reason ?? null };
    for (const [key, fact] of Object.entries({ p50_recent: trend.p50_recent, p50_prior: trend.p50_prior, change_pct: trend.change, direction: trend.direction })) {
      row[`${key}_hide_reason`] = fact.guarded.hide_reason ?? null;
      row[`${key}_basis_count`] = fact.guarded.basis_count;
      row[`${key}_as_of`] = fact.guarded.as_of;
    }
    row.id = citation_id || `trend:${product_id}:${r.as_of}`;
    for (const [field, fact] of [['p50_recent', trend.p50_recent], ['p50_prior', trend.p50_prior], ['change_pct', trend.change]] as const) {
      row[`${field}_basis_ids`] = JSON.stringify(mapped.filter(c => fact.sources.some(source => source.fingerprint === c.evidence?.fingerprint)).map(c => c.id));
    }
    r.rows = [row, ...mapped.map(c => ({ kind: 'comp', id: c.id, citation_id: c.id, site: c.site, price_cents: c.price_cents, sold_at: c.sold_at, url: c.evidence?.source_url ?? null }))]; r.counts = { n_comps: mapped.length, basis_count: trend.change.guarded.basis_count };
    r.citation_ids = [...(citation_id ? [citation_id] : []), ...mapped.map(c => c.id)];
    r.basis = `${mapped.length} sold on ${usable.map(r => r.site).join(' and ')}; Poshmark sold rows are dated by listing date, not sale date; adjusted to condition good; category unknown, default age decay; no band90 supplied${unavailable.length ? `; ${unavailable.join('; ')}` : ''}`;
    r.not_built = ['repeat-sales index (A8) is not built', 'a measured noise band (band90) is not built'];
    return r;
  }
  const sources = soldSources(async site => reads.find(read => read.site === site)!.reply, usable.map(read => read.site),
    { ...q, error: (where, error) => d.log.error(where, error) });
  // No shared observation adapter is exported by valuations.ts yet. Keep this snapshot within this call.
  const observed: import('../../engines/valuation/comps.ts').Comp[] = [];
  const ports = d.valuation ?? { params: memoryStore(), observations: {
    read: async () => observed,
    write: async (rows: import('../../engines/valuation/comps.ts').Comp[]) => { observed.push(...rows); },
  } };
  const item: ValuationItem = { item_id: product_id, product_id, condition: q.condition, floor_cents: 0, objective: 'balanced', sites: SOLD_SITES.map(site => ({ site })) };
  const { valuation: result } = await valuate(item, { ...ports, sources, as_of: r.as_of, person: d.person_id, log: d.log });
  const visible = (state: string, hide_reason: string | undefined) => state !== 'hidden' && !hide_reason;
  r.counts = { n_comps: result.comps.length, n_eff: Math.round(result.n_eff * 10) / 10 };
  const sites = [...new Set(result.comps.map(c => c.site))].join(' and ') || 'no sites';
  r.basis = `${result.comps.length} sold on ${sites}, ${result.basis.oldest ?? 'no date'} to ${result.basis.newest ?? 'no date'}, level ${result.basis_level}; product_id ${product_id}; floor 0; objective balanced${unavailable.length ? `; ${unavailable.join('; ')}` : ''}`;
  r.reason = result.range.hide_reason ?? result.notes.find(note => note === 'too_few' || note === 'stale');
  if (result.range.q50 === null && !r.reason) r.reason = 'too_few';
  r.rows = result.per_site.map(s => {
    const shown = visible(s.state, s.hide_reason), fee = FEES[s.site];
    const id = s.citation?.id ?? `valuation:${product_id}:${s.site}:${r.as_of}`;
    const row = { id, citation_id: id, site: s.site, state: s.state, hide_reason: s.hide_reason ?? null, notes: JSON.stringify(s.notes),
      fee_citation_id: `fee:${s.site}:${fee.valid_from}`, source_note: fee.source_note };
    if (name === 'where_to_list') return { ...row,
      ...money('keep_q10', shown ? s.keep_q10 : null), ...money('keep_q50', shown ? s.keep_q50 : null), ...money('keep_q90', shown ? s.keep_q90 : null),
      p_sale_d7: null, p_sale_d30: null, p_sale_d90: null, days_t50: null, rests_on: 'fees only; no sale curve' };
    return { ...row, ...money('q10', shown ? s.q10 : null), ...money('q50', shown ? s.q50 : null), ...money('q90', shown ? s.q90 : null),
      ...money('keep', shown ? s.keep_q50 : null), p_sale_d30: shown ? s.p_sale?.d30 ?? null : null, days_t50: shown ? s.days?.t50 ?? null : null };
  });
  if (name === 'value_item') {
    const shown = visible(result.range.state, result.range.hide_reason);
    const id = result.citation?.id ?? `valuation:${product_id}:all:${r.as_of}`;
    r.rows.push({ id, citation_id: id, site: 'all', state: result.range.state, hide_reason: result.range.hide_reason ?? null, notes: JSON.stringify(result.notes),
      ...money('q10', shown ? result.range.q10 : null), ...money('q50', shown ? result.range.q50 : null), ...money('q90', shown ? result.range.q90 : null) });
    r.not_built = ["eBay sold needs the person's linked account"];
  } else r.not_built = ["AD5's ranking by expected keep (A6) is not built", 'chance and time to sell need a sale curve (A1), not built'];
  r.citation_ids = [...new Set(r.rows.flatMap(row => [String(row.citation_id), ...(typeof row.fee_citation_id === 'string' ? [row.fee_citation_id] : [])]))];
  return r;
}
const factNumber = (fact: Fact) => fact.guarded.state === 'shown' && typeof fact.value === 'number' ? fact.value : null;
const factString = (fact: Fact) => fact.guarded.state === 'shown' && typeof fact.value === 'string' ? fact.value : null;

function citedRows(rows: Row[], prefix: string): Row[] {
  return rows.map((row, index) => ({ ...row, id: `${prefix}:${index}`, citation_id: `${prefix}:${index}` }));
}
function zip(columns: string[], data: unknown[][]): Row[] {
  return data.map(values => {
    if (values.length !== columns.length) throw new Error('statement row does not match columns');
    const row: Row = {};
    columns.forEach((column, i) => {
      const value = values[i];
      if (column.endsWith('_cents')) {
        if (value !== null && value !== undefined && typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+$/.test(value))) throw new Error('invalid money column');
        const cents = value === null || value === undefined ? null : Number(value);
        if (cents !== null && !Number.isSafeInteger(cents)) throw new Error('invalid money column');
        Object.assign(row, money(column.slice(0, -6), cents));
      } else row[column] = value === undefined || value === null ? null : typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' ? value : JSON.stringify(value);
    });
    return row;
  });
}
async function marketStore(x: Extract<Input, { function: FunctionName }>, d: ToolDeps, signal: AbortSignal, r: ToolResult): Promise<ToolResult> {
  r.widgets = ['table']; r.not_built = ['the corpus of listings (MI4) is not built'];
  if (d.caller !== 'person') return fail(r, 'signed_in_only', 'market store needs a signed-in person');
  if (x.function === 'ask_genie') {
    if (!d.person_id) return fail(r, 'not_connected', 'user-scoped Genie connection is missing');
    const port = await d.forUser?.(d.person_id);
    if (!port) return fail(r, 'not_connected', 'user-scoped Genie connection is missing');
    signal.throwIfAborted();
    const got = await deadline(s => genie(String(x.args.question), { ...port, timeout_ms: 30_000,
      fetch: (url, init) => port.fetch(url, { ...init, signal: AbortSignal.any([s, ...(init?.signal ? [init.signal] : [])]) }) }), signal, 30_000);
    if (got.status !== 'answered') {
      d.log.error('assist.genie', new Error(got.reason));
      return fail(r, 'failed', 'Genie failed');
    }
    r.rows = citedRows(zip(got.columns, got.rows), `genie:${d.person_id}:${crypto.randomUUID()}`).map(row => ({ ...row, sql: got.citation.sql, tables: got.citation.tables.join(', ') }));
    r.citation_ids = r.rows.map(row => String(row.citation_id));
    r.counts = { rows: r.rows.length, row_count: got.citation.row_count };
    r.as_of = got.citation.as_of; r.basis = `Genie SQL reads ${got.citation.tables.join(', ')}${got.citation.stale ? '; stale' : ''}`;
    return r;
  }
  if (!d.store) return fail(r, 'not_connected', 'store needs DATABRICKS_HOST, DATABRICKS_TOKEN and DATABRICKS_WAREHOUSE_ID');
  const spec = FUNCTIONS[x.function];
  const parameters = Object.entries(spec).map(([name, type]) => ({ name, value: String(x.args[name]), type }));
  const statement = statements[x.function];
  const port = d.store;
  const got: unknown = await d.log.call('http', 'assist.market_store', { function: x.function }, async () => {
    const response = await port.fetch(`${port.host.replace(/\/$/, '')}/api/2.0/sql/statements`, { method: 'POST', signal,
      headers: { authorization: `Bearer ${await port.token()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ warehouse_id: port.warehouse_id, statement, parameters, wait_timeout: '10s', disposition: 'INLINE', format: 'JSON_ARRAY' }) });
    if (!response.ok) throw new Error(`statement HTTP_${response.status}`);
    return response.json();
  }, out => ({ state: object(object(out)?.status)?.state }));
  const body = object(got), status = object(body?.status);
  if (status?.state === 'FAILED') {
    const error = object(status.error), message = typeof error?.message === 'string' ? error.message : '';
    const missing = /ROUTINE_NOT_FOUND|UNRESOLVED_ROUTINE|(?:routine|function)[\s\S]*(?:not found|cannot be found|does not exist)/i.test(`${error?.error_code ?? ''} ${message}`);
    d.log.error('assist.market_store', new Error(missing ? 'function_missing' : 'statement failed'));
    return fail(r, missing ? 'function_missing' : 'failed', `secondhand.market.${x.function}: ${missing ? 'function missing' : 'statement failed'}`);
  }
  if (status?.state === 'PENDING' || status?.state === 'RUNNING') return fail(r, 'pending', `secondhand.market.${x.function}: ${status.state}`);
  if (status?.state !== 'SUCCEEDED') throw new Error('invalid statement state');
  const columns = object(object(body?.manifest)?.schema)?.columns, data = object(body?.result)?.data_array;
  if (!Array.isArray(columns) || !columns.every(c => text(object(c)?.name)) || !Array.isArray(data) || !data.every(Array.isArray)) throw new Error('invalid statement result');
  r.rows = citedRows(zip(columns.map(c => String(object(c)!.name)), data), `market:${x.function}:${crypto.randomUUID()}`).map(row => ({ ...row, sql: statement, routine: `secondhand.market.${x.function}`, tables: null }));
  r.citation_ids = r.rows.map(row => String(row.citation_id));
  r.not_built.push('underlying tables read by governed functions need a lineage port, not built');
  const row_count = object(body?.manifest)?.total_row_count;
  r.counts = { rows: r.rows.length, row_count: typeof row_count === 'number' && Number.isSafeInteger(row_count) && row_count >= 0 ? row_count : r.rows.length };
  r.basis = `secondhand.market.${x.function}; ${r.rows.length} rows; read at ${r.as_of}`;
  return r;
}

export async function runTool(name: string, input: unknown, deps: ToolDeps, signal: AbortSignal): Promise<ToolResult> {
  const start = deps.now();
  // ToolResult's fixed union cannot carry an unknown tool name; invalid names use its first member.
  const tool = TOOL_DEFS.find(d => d.name === name)?.name ?? 'search_market';
  let result = empty(tool, new Date(start).toISOString());
  try {
    if (!validate(name, input)) result = fail(result, 'invalid_input', 'tool name or input does not match its schema');
    else {
      signal.throwIfAborted();
      result = await deps.log.call('tool', `assist.${tool}`, { tool }, async () => {
        if ('function' in input) return marketStore(input, deps, signal, result);
        if (tool === 'search_market') return searchMarket(input, deps, signal, result);
        return soldTool(tool as 'value_item' | 'where_to_list' | 'price_trend', input, deps, signal, result);
      }, r => ({ ok: r.ok, counts: r.counts, reason: r.reason }));
    }
  } catch (error) {
    deps.log.error(`assist.${tool}`, error);
    result = fail(result, 'failed', `${tool}: port failed`);
  }
  result.ms = Math.max(0, deps.now() - start);
  return result;
}
