// Rests-on: features/assist/README.md#the-conversation-agent-proposal; packet 78 DBX-A1;
// spec/product.md comp, valuation, citation; spec/determinations/money.md D1-D15.
import type { Log } from '../../../../log/index.js';
import type { ToolName, ToolResult } from './types.ts';
import { searchSource, type SiteResult, type SearchRow } from '../intel/public/search.ts';
import { SOURCES, type SourceSite, type Source } from '../intel/public/sources.ts';
import { fetchPage } from '../intel/fetch.ts';
import { PROTOCOLS } from '../intel/protocols.ts';
import { normalize } from '../intel/run.ts';
import { createDupe } from '../harness/sites/dupe/adapter.ts';
import { soldSearch } from '../api/valuation-sold.ts';
import { soldSources, toComps, type Search, type SoldRow, type SoldSite } from '../../engines/valuation/sold.ts';
import { check } from '../../engines/valuation/check.ts';
import { comparables, DEFAULTS } from '../../engines/valuation/comps.ts';
import { answer, basisHash } from '../../engines/proof/proof.ts';
import { productTrend, type SoldComp } from '../market/market.ts';
import type { Fact } from '../intel/answer.ts';
import { genie, genieFromEnv, type GenieDeps } from '../genie/genie.ts';

export interface StorePort {
  host: string;
  warehouse_id: string;
  token(): Promise<string>;
  fetch: typeof globalThis.fetch;
}
export interface ToolDeps {
  search(site: SourceSite, query: string, signal: AbortSignal): Promise<SiteResult>;
  sold: Search;
  store: StorePort | null;
  genie: GenieDeps | null;
  caller: 'visitor' | 'person';
  now(): number;
  log: Log;
}

const DEADLINE_MS = PROTOCOLS.listings_matching.budget.settled_ms;
const SOLD_SITES: readonly SoldSite[] = ['mercari', 'poshmark'];
const conditions = Object.keys(DEFAULTS.condition_ratios);
// Apify never sits in the path an answer waits on (product/words.md, 2026-11-15 nate apify stays out of the latency path).
const onSites = SOURCES.filter(s => s.on && s.lane !== 'apify').map(s => s.site);
const stringSchema = { type: 'string' };
const querySchema = { type: 'string', minLength: 1, maxLength: 200 };
const conditionSchema = { type: 'string', enum: conditions };
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
  [key, type === 'INT' ? { type: 'integer', minimum: -2147483648, maximum: 2147483647 } : { type: 'string', minLength: 1 }])));

export const TOOL_DEFS = [
  { name: 'search_market', description: 'Returns live listings and counts, median asks and mean likes for each site. It cannot read stored listings or verify product attributes.',
    input_schema: objectSchema({ query: querySchema, sites: { type: 'array', uniqueItems: true, items: { type: 'string', enum: onSites } }, exclude_brand: querySchema }, ['query']), strict: true },
  { name: 'value_item', description: 'Returns sold price ranges and fee keeps with comp counts and citations. It cannot confirm a price from too few sales.',
    input_schema: objectSchema({ query: querySchema, condition: conditionSchema }), strict: true },
  { name: 'price_trend', description: 'Returns recent and prior sold medians with their evidence. It cannot claim a direction without a measured noise band.',
    input_schema: objectSchema({ query: querySchema }), strict: true },
  { name: 'where_to_list', description: 'Returns what each site keeps after fees at the sold price range. It cannot predict sale odds, time to sell or an expected keep ranking without a sale curve.',
    input_schema: objectSchema({ query: querySchema, condition: conditionSchema }), strict: true },
  { name: 'market_store', description: 'Returns rows from a governed market function, or cited SQL and tables from Genie for a signed-in person. It cannot answer from a disconnected store or a missing function.',
    input_schema: { ...objectSchema({ function: { type: 'string', enum: Object.keys(FUNCTIONS) }, args: { anyOf: Object.keys(FUNCTIONS).map(n => functionSchema(n as FunctionName)) } }),
      anyOf: Object.keys(FUNCTIONS).map(n => objectSchema({ function: { const: n, type: 'string' }, args: functionSchema(n as FunctionName) })) }, strict: true },
] satisfies { name: ToolName; description: string; input_schema: Record<string, unknown>; strict: true }[];

export function defaultDeps(env: Record<string, string | undefined>, fetch: typeof globalThis.fetch, log: Log): ToolDeps {
  const { DATABRICKS_HOST: host, DATABRICKS_TOKEN: token, DATABRICKS_WAREHOUSE_ID: warehouse_id } = env;
  const dupe = createDupe({ send: (url, init) => fetch(url, init), log });
  const page = (signal: AbortSignal) => (url: string, opts: Parameters<typeof fetchPage>[1]) =>
    fetchPage(url, { ...opts, fetchImpl: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]) }) });
  return {
    caller: 'visitor', now: Date.now, log,
    search: (site, query, signal) => {
      const source = SOURCES.find(s => s.site === site && s.on);
      if (!source) return Promise.reject(new Error('source is not on'));
      return searchSource(source, query, 'search', { caller: 'person', signal, dupe, deadline_ms: DEADLINE_MS, fetchPage: page(signal), log });
    },
    sold: (site, query, signal) => {
      const live_sites = (env.SECONDHAND_LIVE_SITES ?? '').split(/[ ,]+/).filter(Boolean);
      if (!live_sites.includes(site)) return Promise.resolve({ rows: [], outcome: 'blocked', reason: 'SECONDHAND_LIVE_SITES is missing or does not enable this site' });
      return soldSearch({ live_sites, caller: 'person', signal, fetchPage: page(signal), log })(site, query, signal);
    },
    store: host && token && warehouse_id ? { host, warehouse_id, token: async () => token, fetch } : null,
    genie: genieFromEnv(env, fetch, log),
  };
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
      type === 'STRING' ? text(args[key]) : typeof args[key] === 'number' && Number.isInteger(args[key]) && args[key] >= -2147483648 && args[key] <= 2147483647);
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
function listing(site: SourceSite, row: SearchRow): Row {
  return { site, title: row.title ?? null, ...money('price', row.price_cents ?? null), condition: row.condition ?? null,
    size: row.size ?? null, listed_at: row.listed_at ?? null, likes: row.likes ?? null, sold: row.sold ?? null, sold_date: row.sold_date ?? null, url: row.url ?? null,
    ...(site === 'dupe' ? { source: 'dupe', commercial: true, attribution: row.attribution ?? null, source_site: row.source_site ?? null } : {}) };
}
async function searchMarket(x: Extract<Input, { query: string }>, d: ToolDeps, signal: AbortSignal, r: ToolResult): Promise<ToolResult> {
  r.widgets = [x.exclude_brand ? 'alternatives' : 'listings'];
  r.not_built = ['answers from live reads only; stored rows (MI2) are not built'];
  if (x.exclude_brand) r.not_built.push('brand matched by title words; the attribute record (AD9) is not built');
  const sources = (x.sites ?? onSites).map(site => SOURCES.find(s => s.site === site && s.on)!);
  const brand = x.exclude_brand ? new RegExp(`(?<![\\p{L}\\p{N}_])${x.exclude_brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'iu') : null;
  r.counts = { rows: 0, sites_hit: 0, sites_searched: 0, sites_failed: 0, ...(brand ? { dropped_brand: 0 } : {}) };
  const batches = await Promise.all(sources.map(async source => {
    if (d.caller === 'visitor' && !publicSource(source)) return { source, rows: [], outcome: source.needs_ask ? 'needs a linked account' : 'needs the cloud browser', searched: false };
    try {
      const got = await deadline(s => d.log.call('tool', 'assist.search', { site: source.site }, () => d.search(source.site, x.query.trim(), s), out => ({ outcome: out.searched.outcome, count: out.rows.length })), signal);
      const outcome = got.searched.outcome === 'needs_account' ? 'needs a linked account' : got.searched.error_code === 'no_route' ? 'needs the cloud browser' : got.searched.outcome;
      if (!['hit', 'empty', 'needs a linked account', 'needs the cloud browser'].includes(outcome)) d.log.error(`assist.search.${source.site}`, new Error(`source outcome: ${outcome}`));
      return { source, rows: ['hit', 'empty'].includes(outcome) ? got.rows : [], outcome, searched: true };
    } catch (error) {
      d.log.error(`assist.search.${source.site}`, error);
      return { source, rows: [], outcome: 'failed', searched: true };
    }
  }));
  const summaries: Row[] = [], queues: Row[][] = [];
  for (const batch of batches) {
    const site = batch.source.site;
    const kept = batch.rows.filter(row => {
      if (!brand || !brand.test(row.title ?? '') && !brand.test(row.brand ?? '')) return true;
      r.counts.dropped_brand++; return false;
    });
    const prices = kept.flatMap(row => row.price_cents === undefined ? [] : [row.price_cents]);
    const likes = kept.flatMap(row => row.likes === undefined ? [] : [row.likes]);
    const p50 = median(prices), mean = likes.length ? likes.reduce((a, b) => a + b, 0) / likes.length : null;
    const summary: Row = { kind: 'site_summary', site, n: kept.length, ...money('p50_ask', p50), likes_per_listing: mean, likes_rows: likes.length, outcome: batch.outcome };
    summaries.push(summary);
    r.counts[`${site}_rows`] = kept.length; r.counts[`${site}_n`] = kept.length; r.counts[`${site}_likes_rows`] = likes.length;
    if (p50 !== null) r.counts[`${site}_p50_ask_cents`] = p50;
    if (mean !== null) r.counts[`${site}_likes_per_listing`] = mean;
    if (batch.searched) r.counts.sites_searched++;
    if (batch.outcome === 'hit') r.counts.sites_hit++;
    if (batch.searched && !['hit', 'empty', 'needs a linked account', 'needs the cloud browser'].includes(batch.outcome)) {
      r.counts.sites_failed++; r.counts[`${site}_failed`] = 1;
    }
    queues.push([...kept].sort((a, b) => (a.price_cents ?? Infinity) - (b.price_cents ?? Infinity)).map(row => listing(site, row)));
  }
  const rows: Row[] = [];
  for (let i = 0; queues.some(q => q[i]); i++) {
    for (const queue of queues) if (queue[i] && rows.length < 30 - summaries.length) rows.push(queue[i]);
    if (rows.length >= 30 - summaries.length) break;
  }
  r.rows = [...rows, ...summaries]; r.counts.rows = rows.length;
  r.basis = batches.map(b => `${b.source.site}: ${b.outcome}`).join('; ');
  if (r.counts.sites_failed) return fail(r, 'failed', r.basis);
  if (!r.counts.sites_searched || batches.every(b => ['needs a linked account', 'needs the cloud browser'].includes(b.outcome))) return fail(r, 'not_connected', r.basis);
  return r;
}
// Dupe's approved public lane is MCP, rather than a page; it needs neither a harness nor an account.
const publicSource = (s: Source) => !s.needs_ask && (s.lane === 'public_page' || s.site === 'dupe');

type SoldRead = { site: SoldSite; reply: Awaited<ReturnType<Search>>; read_at: string };
async function soldReads(q: string, d: ToolDeps, signal: AbortSignal): Promise<SoldRead[]> {
  return Promise.all(SOLD_SITES.map(site => deadline(async s => {
    const reply = await d.log.call('tool', 'assist.sold', { site }, () => d.sold(site, q, s), out => ({ outcome: out.outcome, count: out.rows.length }));
    if (!['hit', 'empty', 'blocked', 'needs_account'].includes(reply.outcome)) throw new Error(`sold ${site}: ${reply.outcome}`);
    if (reply.outcome === 'blocked' && !/SECONDHAND_LIVE_SITES|live reads are disabled/.test(reply.reason ?? '')) throw new Error(`sold ${site}: blocked`);
    return { site, reply, read_at: new Date(d.now()).toISOString() };
  }, signal)));
}
function disconnected(reads: SoldRead[], r: ToolResult): ToolResult | null {
  if (reads.some(read => ['hit', 'empty'].includes(read.reply.outcome))) return null;
  return fail(r, 'not_connected', reads.map(read => `${read.site}: ${read.reply.reason ?? read.reply.outcome}`).join('; '));
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
  const comps = usable.flatMap(read => toComps(read.site, read.reply.rows, q));
  const unavailable = reads.filter(read => !usable.includes(read)).map(read => `${read.site}: ${read.reply.reason ?? read.reply.outcome}`);
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
    r.rows = [row]; r.counts = { n_comps: mapped.length, basis_count: trend.change.guarded.basis_count };
    r.citation_ids = citation_id ? [citation_id] : [];
    r.basis = `${mapped.length} sold on ${usable.map(r => r.site).join(' and ')}; Poshmark sold rows are dated by listing date, not sale date; adjusted to condition good; category unknown, default age decay; no band90 supplied${unavailable.length ? `; ${unavailable.join('; ')}` : ''}`;
    r.not_built = ['repeat-sales index (A8) is not built', 'a measured noise band (band90) is not built'];
    return r;
  }
  const sources = soldSources(async site => reads.find(read => read.site === site)!.reply, usable.map(read => read.site),
    { ...q, error: (where, error) => d.log.error(where, error) });
  const result = await check({ product_id, condition: q.condition, as_of: r.as_of, floor_cents: 0, objective: 'balanced', param_version: 1,
    warm_comps: [], sources, sites: SOLD_SITES.map(site => ({ site })), log: d.log });
  const found = comparables({ condition: q.condition }, comps, r.as_of);
  r.counts = { n_comps: result.comps.length, n_eff: Math.round(result.n_eff * 10) / 10 };
  r.citation_ids = result.citation ? [result.citation.id] : [];
  const sites = [...new Set(result.comps.map(c => c.site))].join(' and ') || 'no sites';
  r.basis = `${result.basis.count} sold on ${sites}, ${result.basis.oldest ?? 'no date'} to ${result.basis.newest ?? 'no date'}, level ${found.level}; product_id ${product_id}; floor 0; objective balanced${unavailable.length ? `; ${unavailable.join('; ')}` : ''}`;
  if (found.state === 'too_few') r.reason = 'too_few';
  r.rows = result.per_site.map(s => {
    const local = comparables({ condition: q.condition, site: s.site }, comps, r.as_of);
    const visible = local.state === 'ok';
    if (name === 'where_to_list') return { site: s.site,
      ...money('keep_q10', visible ? s.keep_q10 : null), ...money('keep_q50', visible ? s.keep_q50 : null), ...money('keep_q90', visible ? s.keep_q90 : null),
      p_sale_d7: null, p_sale_d30: null, p_sale_d90: null, days_t50: null, rests_on: 'fees only; no sale curve' };
    return { site: s.site, ...money('q10', visible ? s.q10 : null), ...money('q50', visible ? s.q50 : null), ...money('q90', visible ? s.q90 : null),
      ...money('keep', visible ? s.keep_q50 : null), p_sale_d30: s.p_sale?.d30 ?? null, days_t50: s.days?.t50 ?? null };
  });
  if (name === 'value_item') {
    const visible = found.state === 'ok';
    r.rows.push({ site: 'all', ...money('q10', visible ? result.range.q10 : null), ...money('q50', visible ? result.range.q50 : null), ...money('q90', visible ? result.range.q90 : null) });
    r.not_built = ["eBay sold needs the person's linked account"];
  } else {
    // check() already calls bestSites, with no eligible paths because no site supplies a sale curve.
    r.not_built = ["AD5's ranking by expected keep (A6) is not built", 'chance and time to sell need a sale curve (A1), not built'];
  }
  return r;
}
const factNumber = (fact: Fact) => fact.guarded.state === 'shown' && typeof fact.value === 'number' ? fact.value : null;
const factString = (fact: Fact) => fact.guarded.state === 'shown' && typeof fact.value === 'string' ? fact.value : null;

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
  if (x.function === 'ask_genie') {
    if (d.caller !== 'person') return fail(r, 'signed_in_only', 'Genie needs a signed-in person');
    if (!d.genie) return fail(r, 'not_connected', 'Genie needs DATABRICKS_HOST, DATABRICKS_TOKEN and GENIE_SPACE_ID');
    signal.throwIfAborted();
    const port = d.genie;
    const got = await deadline(s => genie(String(x.args.question), { ...port, timeout_ms: 30_000,
      fetch: (url, init) => port.fetch(url, { ...init, signal: AbortSignal.any([s, ...(init?.signal ? [init.signal] : [])]) }) }), signal, 30_000);
    if (got.status !== 'answered') {
      d.log.error('assist.genie', new Error(got.reason));
      return fail(r, 'failed', got.reason);
    }
    r.rows = zip(got.columns, got.rows).map(row => ({ ...row, sql: got.citation.sql, tables: got.citation.tables.join(', ') }));
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
  r.rows = zip(columns.map(c => String(object(c)!.name)), data).map(row => ({ ...row, sql: statement, routine: `secondhand.market.${x.function}`, tables: null }));
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
