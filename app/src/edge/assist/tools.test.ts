import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createLog, memorySink } from '../../../../log/index.js';
import { TOOL_DEFS, defaultDeps, format, runTool, toTrendComps, type ToolDeps, type StorePort } from './tools.ts';
import type { ToolResult } from './types.ts';
import type { SiteResult } from '../intel/public/search.ts';
import type { Search, SoldRow } from '../../engines/valuation/sold.ts';
import { SOURCES } from '../intel/public/sources.ts';
import { PROTOCOLS } from '../intel/protocols.ts';

const recorded = (file: string) => JSON.parse(readFileSync(new URL(`./fixtures/tools/${file}.json`, import.meta.url), 'utf8'));
const searches = recorded('search').sources as Record<string, SiteResult>;
const sales = recorded('sold').sources as Record<string, Awaited<ReturnType<Search>>>;
const NOW = Date.parse('2026-11-15T12:00:00Z');
const signal = () => new AbortController().signal;
function deps(overrides: Partial<ToolDeps> = {}) {
  const sink = memorySink();
  const d: ToolDeps = { caller: 'person', search: async site => structuredClone(searches[site]),
    sold: async site => structuredClone(sales[site]), store: null, genie: null, now: () => NOW,
    log: createLog({ src: 'test.assist.tools', build: 'test', sink }), ...overrides };
  return { d, sink };
}
const call = (name: string, input: unknown, d = deps().d) => runTool(name, input, d, signal());
const listings = (r: ToolResult) => r.rows.filter(row => row.kind !== 'site_summary');
const resultKeys = ['tool', 'ok', 'reason', 'rows', 'counts', 'as_of', 'citation_ids', 'basis', 'not_built', 'widgets', 'ms'];
function contract(r: ToolResult) {
  assert.ok(Object.keys(r).every(k => resultKeys.includes(k)));
  assert.ok(TOOL_DEFS.some(d => d.name === r.tool));
  assert.ok(r.rows.every(row => Object.values(row).every(v => v === null || ['string', 'boolean', 'number'].includes(typeof v))));
  assert.ok(Object.values(r.counts).every(n => typeof n === 'number' && Number.isFinite(n)));
  assert.ok(Number.isFinite(r.ms) && r.ms >= 0);
}

test('definitions name exactly five strict tools and reject extra object properties', () => {
  assert.deepEqual(TOOL_DEFS.map(d => d.name), ['search_market', 'value_item', 'price_trend', 'where_to_list', 'market_store']);
  for (const d of TOOL_DEFS) {
    assert.equal(d.strict, true);
    assert.equal(d.input_schema.additionalProperties, false);
    assert.ok(Array.isArray(d.input_schema.required));
    assert.ok(d.description.length > 20);
  }
});

for (const [label, name, input] of [
  ['unknown name', 'raw_sql', { query: 'jeans' }],
  ['null', 'search_market', null], ['array', 'search_market', []], ['wrong query type', 'search_market', { query: 4 }],
  ['extra key', 'search_market', { query: 'jeans', sql: 'select 1' }],
  ['empty query', 'search_market', { query: '   ' }], ['long query', 'search_market', { query: 'a'.repeat(201) }],
  ['sites wrong type', 'search_market', { query: 'jeans', sites: 'poshmark' }],
  ['site not on', 'search_market', { query: 'jeans', sites: ['facebook'] }],
  ['unknown site', 'search_market', { query: 'jeans', sites: ['etsy'] }],
  ['site wrong type', 'search_market', { query: 'jeans', sites: [3] }],
  ['brand wrong type', 'search_market', { query: 'jeans', exclude_brand: 4 }],
  ['empty brand', 'search_market', { query: 'jeans', exclude_brand: ' ' }],
  ['condition missing', 'value_item', { query: 'jeans' }],
  ['condition unsupported', 'value_item', { query: 'jeans', condition: 'mint' }],
  ['condition wrong type', 'where_to_list', { query: 'jeans', condition: 3 }],
  ['extra trend key', 'price_trend', { query: 'jeans', condition: 'good' }],
  ['unknown function', 'market_store', { function: 'drop_table', args: {} }],
  ['missing function arg', 'market_store', { function: 'asks', args: { term: 'jeans', site: 'all' } }],
  ['extra function arg', 'market_store', { function: 'coverage_now', args: { statement: 'select 1' } }],
  ['wrong function arg type', 'market_store', { function: 'asks', args: { term: 'jeans', site: 'all', days: '7' } }],
  ['fractional INT', 'market_store', { function: 'top_terms', args: { kind: 'clothes', site: 'all', days: 7, k: 1.5 } }],
  ['nonfinite number', 'market_store', { function: 'asks', args: { term: 'jeans', site: 'all', days: Infinity } }],
  ['args array', 'market_store', { function: 'coverage_now', args: [] }],
] as const) test(`invalid input: ${label}`, async () => {
  const { d } = deps({ search: async () => { throw new Error('must not call'); }, sold: async () => { throw new Error('must not call'); } });
  const r = await call(name, input, d);
  assert.equal(r.ok, false); assert.equal(r.reason, 'invalid_input'); assert.deepEqual(r.rows, []); contract(r);
});

test('one site failing preserves other rows and exposes the failed site in counts and basis', async () => {
  const { d, sink } = deps({ search: async site => { if (site === 'ebay') throw new Error('recorded failure'); return structuredClone(searches[site]); } });
  const r = await call('search_market', { query: 'jeans', sites: ['ebay', 'poshmark', 'dupe'] }, d);
  assert.equal(r.ok, false); assert.equal(r.reason, 'failed');
  assert.ok(listings(r).some(row => row.site === 'poshmark'));
  assert.ok(listings(r).some(row => row.site === 'dupe'));
  assert.equal(r.counts.ebay_failed, 1); assert.equal(r.counts.sites_failed, 1);
  assert.match(r.basis, /ebay: failed/); assert.match(sink.text(), /"event":"error"/); contract(r);
});

test('visitor searches only Poshmark and Dupe; unavailable lanes are never empty hits', async () => {
  const touched: string[] = [];
  const r = await call('search_market', { query: 'jeans' }, deps({ caller: 'visitor', search: async site => { touched.push(site); return structuredClone(searches[site]); } }).d);
  assert.deepEqual(touched.sort(), ['dupe', 'poshmark']);
  assert.match(r.basis, /ebay: needs the cloud browser/); assert.match(r.basis, /mercari: needs a linked account/);
  assert.equal(r.counts.sites_searched, 2); assert.equal(r.counts.sites_hit, 2);
  const dupe = listings(r).find(row => row.site === 'dupe')!;
  assert.equal(dupe.source, 'dupe'); assert.equal(dupe.commercial, true); assert.equal(dupe.attribution, 'Dupe.com');
});

test('a person without a harness gets needs the cloud browser in basis, not a failed empty hit', async () => {
  const r = await call('search_market', { query: 'jeans', sites: ['ebay'] }, deps({ search: async () => ({ rows: [],
    searched: { ...searches.ebay.searched, outcome: 'failed', error_code: 'no_route', reason: 'cloud launcher not configured' } }) }).d);
  assert.equal(r.reason, 'not_connected'); assert.match(r.basis, /ebay: needs the cloud browser/);
  assert.equal(r.counts.sites_hit, 0); assert.equal(r.counts.sites_failed, 0);
});

test('exclude_brand drops Carhartt and carhartt-like at word boundaries, including brand fields, but keeps mycarhartt', async () => {
  const titles = ['CARHARTT coat', 'carhartt-like jacket', 'mycarhartt coat', 'Other coat', 'Plain coat'];
  const rows = titles.map((title, i) => ({ title, price_cents: 1000 + i, ...(i === 3 ? { brand: 'Carhartt' } : {}) }));
  const r = await call('search_market', { query: 'coat', sites: ['poshmark'], exclude_brand: 'carhartt' }, deps({ search: async () => ({ rows, searched: { ...searches.poshmark.searched, count: 5 } }) }).d);
  assert.deepEqual(listings(r).map(row => row.title), ['mycarhartt coat', 'Plain coat']);
  assert.equal(r.counts.dropped_brand, 3); assert.deepEqual(r.widgets, ['alternatives']);
  assert.ok(r.not_built.includes('brand matched by title words; the attribute record (AD9) is not built'));
});

test('search computes medians and likes means before capping and interleaves cheapest rows per site', async () => {
  const r = await call('search_market', { query: 'jeans', sites: ['poshmark', 'dupe'] });
  const ps = r.rows.find(row => row.kind === 'site_summary' && row.site === 'poshmark')!;
  const raw = searches.poshmark.rows;
  const sorted = raw.map(row => row.price_cents!).sort((a, b) => a - b);
  assert.equal(ps.n, raw.length); assert.equal(ps.p50_ask_cents, (sorted[5] + sorted[6]) / 2); assert.equal(ps.p50_ask, '$25');
  assert.equal(r.counts.poshmark_n, raw.length); assert.equal(r.counts.poshmark_p50_ask_cents, ps.p50_ask_cents);
  const ds = r.rows.find(row => row.kind === 'site_summary' && row.site === 'dupe')!;
  assert.equal(ds.likes_per_listing, null); assert.equal(ds.likes_rows, 0);
  assert.deepEqual(listings(r).slice(0, 4).map(row => row.site), ['poshmark', 'dupe', 'poshmark', 'dupe']);
  const likes = await call('search_market', { query: 'x', sites: ['poshmark'] }, deps({ search: async () => ({ searched: searches.poshmark.searched, rows: [{ price_cents: 0, likes: 0 }, { price_cents: 99, likes: 3 }, { price_cents: 1000 }] }) }).d);
  assert.equal(likes.counts.poshmark_likes_per_listing, 1.5); assert.equal(likes.counts.poshmark_likes_rows, 2);
  const many = await call('search_market', { query: 'x', sites: ['poshmark', 'dupe'] }, deps({ search: async site => ({ searched: searches[site].searched, rows: Array.from({ length: 40 }, (_, i) => ({ title: `${i}`, price_cents: (40 - i) * 100 })) }) }).d);
  assert.ok(many.rows.length <= 30); assert.equal(many.counts.poshmark_n, 40);
  for (const site of ['poshmark', 'dupe']) {
    const prices = listings(many).filter(row => row.site === site).map(row => row.price_cents);
    assert.deepEqual(prices, [...prices].sort((a, b) => Number(a) - Number(b)));
  }
});

test('a site port receives its own deadline signal; parent abort ends hanging reads', async () => {
  const parent = new AbortController(); const signals: AbortSignal[] = [];
  const { d } = deps({ search: async (_site, _q, s) => { signals.push(s); return new Promise(() => {}); } });
  const pending = runTool('search_market', { query: 'jeans', sites: ['poshmark', 'dupe'] }, d, parent.signal);
  await new Promise(resolve => setImmediate(resolve)); parent.abort();
  const r = await pending;
  assert.notEqual(signals[0], signals[1]); assert.ok(signals.every(s => s.aborted));
  assert.equal(r.reason, 'failed');
});

test('a hung site expires at the search route deadline while another site keeps its rows', { timeout: 1000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let late: AbortSignal | undefined;
  const pending = call('search_market', { query: 'jeans', sites: ['poshmark', 'dupe'] }, deps({ search: async (site, _q, s) => {
    if (site === 'dupe') { late = s; return new Promise(() => {}); }
    return structuredClone(searches[site]);
  } }).d);
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(PROTOCOLS.listings_matching.budget.settled_ms);
  const r = await pending;
  assert.equal(late?.aborted, true); assert.equal(r.counts.dupe_failed, 1); assert.equal(r.reason, 'failed');
  assert.ok(listings(r).some(row => row.site === 'poshmark'));
});

test('value_item at too_few keeps all figures null and names the comp count', async () => {
  const r = await call('value_item', { query: "Levi's 501", condition: 'good' }, deps({ sold: async site => site === 'poshmark' ? structuredClone(sales[site]) : { rows: [], outcome: 'empty' } }).d);
  assert.equal(r.ok, true); assert.equal(r.reason, 'too_few'); assert.equal(r.counts.n_comps, 3);
  assert.match(r.basis, /3 sold on poshmark/); assert.match(r.basis, /product_id q_levi-s-501; floor 0; objective balanced/);
  assert.ok(r.rows.every(row => row.q50 === null && row.q50_cents === null));
  assert.equal(r.citation_ids.length, 1); assert.deepEqual(r.widgets, ['price_range']); contract(r);
});

function enough(): Search {
  return async site => ({ rows: Array.from({ length: 10 }, (_, i) => ({ ...sales[site].rows[0], external_id: `${site}-${i}`, title: 'jeans',
    condition: 'Good', price_cents: 2000, listed_at: '2026-11-14T00:00:00Z' })), outcome: 'hit' });
}
test('a band-only valuation returns too_few with no price figures', async () => {
  const toolURL = new URL('./tools.ts?band-only', import.meta.url).href;
  const checkURL = new URL('../../engines/valuation/check.ts', import.meta.url).href;
  const replacement = `import { check as realCheck } from ${JSON.stringify(checkURL)};
    export const check = x => realCheck({ ...x, warm_comps: [], sources: [],
      fast: { low: 3000, high: 6000, n: 24, as_of: x.as_of, basis: 'family', state: 'rough' } });`;
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === toolURL && specifier.endsWith('/check.ts'))
      return { url: 'data:text/javascript,' + encodeURIComponent(replacement), shortCircuit: true };
    return next(specifier, context);
  } });
  try {
    const { runTool: bandTool }: typeof import('./tools.ts') = await import(toolURL);
    const r = await bandTool('value_item', { query: 'jeans', condition: 'good' }, deps({ sold: enough() }).d, signal());
    assert.equal(r.ok, true); assert.equal(r.reason, 'too_few');
    assert.equal(r.counts.n_comps, 0);
    assert.ok(r.rows.every(row => row.q10_cents === null && row.q50_cents === null && row.q90_cents === null));
    contract(r);
  } finally { hook.deregister(); }
});
test('valuation returns display money beside cents, a rounded effective count and a citation from check()', async () => {
  const r = await call('value_item', { query: '  JEANS  ', condition: 'good' }, deps({ sold: enough() }).d);
  assert.equal(r.ok, true); assert.equal(r.reason, undefined); assert.equal(r.counts.n_comps, 20); assert.equal(r.counts.n_eff, 20);
  assert.equal(r.rows.find(row => row.site === 'all')!.q50, '$20');
  assert.equal(r.rows.find(row => row.site === 'all')!.q50_cents, 2000); assert.match(r.citation_ids[0], /^cit_/);
});

test('where_to_list returns fee keeps and null sale odds and timing, without inventing a ranking', async () => {
  const r = await call('where_to_list', { query: 'jeans', condition: 'good' }, deps({ sold: enough() }).d);
  assert.equal(r.rows.length, 2);
  for (const row of r.rows) {
    assert.equal(typeof row.keep_q50_cents, 'number'); assert.equal(typeof row.keep_q50, 'string');
    assert.equal(row.p_sale_d7, null); assert.equal(row.p_sale_d30, null); assert.equal(row.p_sale_d90, null); assert.equal(row.days_t50, null);
    assert.equal(row.rests_on, 'fees only; no sale curve');
  }
  assert.ok(r.not_built.includes("AD5's ranking by expected keep (A6) is not built"));
  assert.ok(r.not_built.includes('chance and time to sell need a sale curve (A1), not built')); assert.deepEqual(r.widgets, ['sites']); contract(r);
});

test('sold-dependent tools refuse a visitor and name SECONDHAND_LIVE_SITES when missing', async () => {
  const off = defaultDeps({}, async () => { throw new Error('no network'); }, deps().d.log); off.caller = 'person';
  for (const tool of ['value_item', 'price_trend', 'where_to_list']) {
    const input = tool === 'price_trend' ? { query: 'jeans' } : { query: 'jeans', condition: 'good' };
    const visitor = await call(tool, input, deps({ caller: 'visitor', sold: async () => { throw new Error('must not read'); } }).d);
    assert.equal(visitor.reason, 'not_connected'); assert.match(visitor.basis, /person caller/);
    const r = await call(tool, input, off);
    assert.equal(r.reason, 'not_connected'); assert.match(r.basis, /SECONDHAND_LIVE_SITES/); assert.deepEqual(r.rows, []);
  }
});

test('a throwing sold port is logged and fails instead of masquerading as too few comps', async () => {
  const { d, sink } = deps({ sold: async () => { throw new Error('sold failed'); } });
  for (const tool of ['value_item', 'price_trend', 'where_to_list']) {
    const r = await call(tool, { query: 'jeans', ...(tool === 'price_trend' ? {} : { condition: 'good' }) }, d);
    assert.equal(r.reason, 'failed'); assert.equal(r.ok, false);
  }
  assert.match(sink.text(), /"event":"error"/);
});

test('a blocked sold page is a failed read rather than a missing connection', async () => {
  const { d, sink } = deps({ sold: async () => ({ rows: [], outcome: 'blocked', reason: 'page challenge' }) });
  const r = await call('value_item', { query: 'jeans', condition: 'good' }, d);
  assert.equal(r.reason, 'failed'); assert.match(sink.text(), /"event":"error"/);
});

test('sold to trend mapping preserves dates, price, identity, weights and URL/read-time evidence', () => {
  const rows = sales.poshmark.rows;
  const mapped = toTrendComps('poshmark', rows, { query: "Levi's 501", condition: 'good' }, new Date(NOW).toISOString());
  assert.equal(mapped.length, 3); const first = mapped[0];
  assert.equal(first.id, `poshmark:${rows[0].external_id}`); assert.equal(first.product_id, 'q_levi-s-501');
  assert.equal(first.price_cents, 1900); assert.equal(first.sold_at, rows[0].listed_at); assert.ok(Math.abs(first.weight! - 0.5 * 0.7) < 1e-12);
  assert.equal(first.evidence?.source_url, rows[0].url); assert.equal(first.evidence?.read_at, new Date(NOW).toISOString());
  assert.equal(first.evidence?.rights.may_model, false);
  assert.deepEqual(toTrendComps('poshmark', [{ ...rows[0], state: 'live' }], { query: 'jeans', condition: 'good' }, new Date(NOW).toISOString()), []);
});

test('trend mapping adjusts to the disclosed condition and rejects excessive condition adjustments', () => {
  const seed = sales.poshmark.rows[0];
  const rows = [{ ...seed, external_id: 'excellent', condition: 'Like new', price_cents: 11000 },
    { ...seed, external_id: 'new', condition: 'NWT', price_cents: 13500 }];
  const mapped = toTrendComps('poshmark', rows, { query: "Levi's 501", condition: 'good' }, new Date(NOW).toISOString());
  assert.equal(mapped.length, 1); assert.equal(mapped[0].price_cents, 10000);
  assert.ok(Math.abs(mapped[0].weight! - 0.5 * 0.9 / (1 + Math.abs(Math.log(1 / 1.1)) / Math.log(1.25))) < 1e-12);
});

test('a hidden trend fact stays null with its hide_reason', async () => {
  const r = await call('price_trend', { query: "Levi's 501" });
  assert.equal(r.ok, true); assert.equal(r.rows[0].p50_recent, null); assert.equal(r.rows[0].p50_recent_hide_reason, 'too_few');
  assert.equal(r.rows[0].change_pct, null); assert.match(r.basis, /Poshmark sold rows are dated by listing date, not sale date/);
  assert.deepEqual(r.widgets, ['price_trend']); contract(r);
});

test('a sold identifier without a URL cannot stand in for trend source evidence', async () => {
  const sold: Search = async site => {
    const result = await enough()(site, 'jeans', signal());
    return { ...result, rows: result.rows.map(row => ({ ...row, url: undefined })) };
  };
  const r = await call('price_trend', { query: 'jeans' }, deps({ sold }).d);
  assert.equal(r.ok, true); assert.equal(r.rows[0].p50_recent, null); assert.equal(r.rows[0].p50_recent_hide_reason, 'source_gap');
});

test('without band90 trend direction is noise even when both medians are shown', async () => {
  const sold: Search = async site => ({ outcome: 'hit', rows: Array.from({ length: 20 }, (_, i): SoldRow => ({ ...sales[site].rows[0],
    external_id: `${site}-${i}`, title: 'jeans', condition: 'Good', price_cents: i < 10 ? 2000 : 1000,
    listed_at: i < 10 ? '2026-11-14T00:00:00Z' : '2026-10-31T00:00:00Z' })) });
  const r = await call('price_trend', { query: 'jeans' }, deps({ sold }).d);
  assert.equal(r.rows[0].p50_recent, '$20'); assert.equal(r.rows[0].p50_prior, '$10');
  assert.equal(r.rows[0].change_pct, '100%'); assert.equal(r.rows[0].direction, 'noise'); assert.equal(r.rows[0].direction_hide_reason, 'noise');
});

test('condition adjustment preserves a real price move for the trend engine to trim within each window', async () => {
  const sold: Search = async site => ({ outcome: site === 'poshmark' ? 'hit' : 'empty', rows: site === 'poshmark' ? Array.from({ length: 16 }, (_, i) => ({
    ...sales.poshmark.rows[0], external_id: `window-${i}`, title: 'jeans', condition: 'Good', price_cents: i < 6 ? 20000 : 10000,
    listed_at: i < 6 ? '2026-11-14T00:00:00Z' : '2026-10-31T00:00:00Z',
  })) : [] });
  const r = await call('price_trend', { query: 'jeans' }, deps({ sold }).d);
  assert.equal(r.rows[0].p50_recent, '$200'); assert.equal(r.rows[0].p50_prior, '$100'); assert.equal(r.counts.n_comps, 16);
});

function store(reply: unknown) {
  const requests: { url: string; init: RequestInit }[] = [];
  const port: StorePort = { host: 'https://workspace.example/', warehouse_id: 'recorded-warehouse', token: async () => 'fixture',
    fetch: async (url, init) => { requests.push({ url: String(url), init: init! }); return Response.json(reply); } };
  return { port, requests };
}
test('market_store: not_connected', async () => {
  assert.equal((await call('market_store', { function: 'coverage_now', args: {} })).reason, 'not_connected');
});
test('market_store: function_missing is distinguished from other failed statements', async () => {
  for (const message of ['[ROUTINE_NOT_FOUND] Cannot resolve routine asks', 'Routine secondhand.market.asks not found']) {
    const r = await call('market_store', { function: 'asks', args: { term: 'jeans', site: 'all', days: 7 } }, deps({ store: store({ status: { state: 'FAILED', error: { message } } }).port }).d);
    assert.equal(r.reason, 'function_missing'); assert.equal(r.ok, false);
  }
  const r = await call('market_store', { function: 'coverage_now', args: {} }, deps({ store: store({ status: { state: 'FAILED', error: { message: 'permission denied' } } }).port }).d);
  assert.equal(r.reason, 'failed');
});
test('market_store: SUCCEEDED columns are zipped to rows with display money and parameterized model text', async () => {
  const { port, requests } = store({ status: { state: 'SUCCEEDED' }, manifest: { schema: { columns: [{ name: 'site' }, { name: 'p50_cents' }, { name: 'n' }, { name: 'as_of' }] } }, result: { data_array: [['poshmark', '129900', '10', '2026-11-15'], ['ebay', null, '3', '2026-11-15']] } });
  const model = "jeans'); DROP TABLE core.observation; --";
  const r = await call('market_store', { function: 'asks', args: { term: model, site: 'all', days: 7 } }, deps({ store: port }).d);
  assert.equal(r.ok, true); assert.equal(r.rows[0].p50, '$1,299'); assert.equal(r.rows[0].p50_cents, 129900); assert.equal(r.rows[1].p50, null);
  assert.equal(requests[0].url, 'https://workspace.example/api/2.0/sql/statements'); assert.equal(requests[0].init.method, 'POST');
  const body = JSON.parse(String(requests[0].init.body));
  assert.equal(body.statement, 'SELECT * FROM secondhand.market.asks(:term, :site, :days)'); assert.ok(!body.statement.includes(model));
  assert.deepEqual(body.parameters, [{ name: 'term', value: model, type: 'STRING' }, { name: 'site', value: 'all', type: 'STRING' }, { name: 'days', value: '7', type: 'INT' }]);
  assert.equal(body.wait_timeout, '10s'); assert.equal(body.disposition, 'INLINE'); assert.equal(body.format, 'JSON_ARRAY');
  assert.equal(r.rows[0].sql, body.statement); assert.equal(r.counts.row_count, 2);
  assert.equal(r.counts.rows, 2); assert.deepEqual(r.widgets, ['table']); contract(r);
});

test('a governed routine is identified as a routine and never claimed as an underlying table', async () => {
  const r = await call('market_store', { function: 'coverage_now', args: {} }, deps({ store: store({ status: { state: 'SUCCEEDED' },
    manifest: { schema: { columns: [{ name: 'site' }] } }, result: { data_array: [['poshmark']] } }).port }).d);
  assert.equal(r.rows[0].tables, null); assert.equal(r.rows[0].routine, 'secondhand.market.coverage_now');
  assert.ok(r.not_built.includes('underlying tables read by governed functions need a lineage port, not built'));
});

for (const [name, args, expected] of [
  ['term_trend', { term: 'jeans', site: 'all', weeks: 4 }, 'term_trend(:term, :site, :weeks)'],
  ['top_terms', { kind: 'clothes', site: 'all', days: 30, k: 5 }, 'top_terms(:kind, :site, :days, :k)'],
  ['sell_through', { kind: 'clothes', site: 'all' }, 'sell_through(:kind, :site)'],
  ['coverage_now', {}, 'coverage_now()'],
] as const) test(`market_store DBX-A1 signature: ${name}`, async () => {
  const { port, requests } = store({ status: { state: 'SUCCEEDED' }, manifest: { schema: { columns: [] } }, result: { data_array: [] } });
  const r = await call('market_store', { function: name, args }, deps({ store: port }).d);
  assert.equal(r.ok, true); assert.equal(JSON.parse(String(requests[0].init.body)).statement, `SELECT * FROM secondhand.market.${expected}`);
});

test('market_store refuses malformed rows rather than claiming an empty table or a false zero price', async () => {
  for (const reply of [
    { status: { state: 'SUCCEEDED' } },
    { status: { state: 'SUCCEEDED' }, manifest: { schema: { columns: [{ name: 'p50_cents' }] } }, result: { data_array: [['']] } },
    { status: { state: 'SUCCEEDED' }, manifest: { schema: { columns: [{ name: 'p50_cents' }] } }, result: { data_array: [[true]] } },
    { status: { state: 'SUCCEEDED' }, manifest: { schema: { columns: [{ name: 'site' }, { name: 'n' }] } }, result: { data_array: [['poshmark']] } },
  ]) {
    const r = await call('market_store', { function: 'coverage_now', args: {} }, deps({ store: store(reply).port }).d);
    assert.equal(r.reason, 'failed'); assert.equal(r.ok, false);
  }
});
test('market_store: pending and running states stay explicit and are never successful empty tables', async () => {
  for (const state of ['PENDING', 'RUNNING']) {
    const r = await call('market_store', { function: 'coverage_now', args: {} }, deps({ store: store({ status: { state } }).port }).d);
    assert.equal(r.ok, false); assert.equal(r.reason, 'pending'); assert.match(r.basis, new RegExp(state));
  }
});
test('market_store: a failing HTTP port is logged and returns failed', async () => {
  const { d, sink } = deps({ store: { ...store({}).port, fetch: async () => { throw new Error('recorded transport failure'); } } });
  const r = await call('market_store', { function: 'coverage_now', args: {} }, d);
  assert.equal(r.reason, 'failed'); assert.match(sink.text(), /"event":"error"/);
});
test('ask_genie refuses a visitor and gives a person rows, SQL and tables without requiring a SQL warehouse', async () => {
  const { d } = deps(); let calls = 0;
  d.genie = { host: 'https://workspace.example', space_id: 'fixture-space', token: async () => 'fixture', log: d.log, now: () => NOW,
    fetch: async () => Response.json(++calls === 1 ? { conversation_id: 'c', message_id: 'm' } : calls === 2 ?
      { status: 'COMPLETED', attachments: [{ attachment_id: 'a', query: { query: 'SELECT price_cents FROM secondhand.market.listing_obs' } }] } :
      { statement_response: { manifest: { schema: { columns: [{ name: 'price_cents' }] } }, result: { data_array: [[1250]] } } }) };
  const visitor = await call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, { ...d, caller: 'visitor' });
  assert.equal(visitor.reason, 'signed_in_only'); assert.equal(calls, 0);
  const r = await call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, d);
  assert.equal(r.ok, true); assert.equal(r.rows[0].price, '$12.50'); assert.match(String(r.rows[0].sql), /^SELECT/);
  assert.equal(r.rows[0].tables, 'secondhand.market.listing_obs'); contract(r);
});
test('ask_genie uses a 30 second polling budget and reports failure', async () => {
  const { d, sink } = deps(); let clock = NOW, calls = 0;
  d.genie = { host: 'https://workspace.example', space_id: 'fixture', token: async () => 'fixture', log: d.log, now: () => clock,
    sleep: async ms => { clock += ms; }, fetch: async () => Response.json(++calls === 1 ? { conversation_id: 'c', message_id: 'm' } : { status: 'RUNNING' }) };
  const r = await call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, d);
  assert.equal(r.reason, 'failed'); assert.ok(clock - NOW <= 31500); assert.match(sink.text(), /"event":"error"/);
});

test('ask_genie bounds a hung HTTP call to 30 seconds and aborts its fetch signal', { timeout: 1000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { d } = deps(); let fetchSignal: AbortSignal | null | undefined;
  d.genie = { host: 'https://workspace.example', space_id: 'fixture', token: async () => 'fixture', log: d.log,
    fetch: async (_url, init) => { fetchSignal = init?.signal; return new Promise(() => {}); } };
  const pending = call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, d);
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(30_000);
  const r = await pending;
  assert.equal(r.reason, 'failed'); assert.equal(fetchSignal?.aborted, true);
});
test('defaultDeps checks connection presence and defaults to visitor without printing env values', () => {
  const { d } = deps(); const fetch: typeof globalThis.fetch = async () => { throw new Error('no network'); };
  assert.equal(defaultDeps({}, fetch, d.log).store, null); assert.equal(defaultDeps({}, fetch, d.log).genie, null);
  const env = { DATABRICKS_HOST: 'https://workspace.example', DATABRICKS_TOKEN: 'fixture', DATABRICKS_WAREHOUSE_ID: 'w', GENIE_SPACE_ID: 's' };
  const ready = defaultDeps(env, fetch, d.log); assert.ok(ready.store); assert.ok(ready.genie); assert.equal(ready.caller, 'visitor');
  for (const key of ['DATABRICKS_HOST', 'DATABRICKS_TOKEN', 'DATABRICKS_WAREHOUSE_ID']) assert.equal(defaultDeps({ ...env, [key]: '' }, fetch, d.log).store, null);
});

test('defaultDeps feeds the existing public sold reader through the injected fetch when live sites are enabled', async () => {
  const html = readFileSync(new URL('../harness/sites/poshmark/fixtures/search-sold.html', import.meta.url), 'utf8');
  const urls: string[] = [];
  const d = defaultDeps({ SECONDHAND_LIVE_SITES: 'poshmark' }, async url => { urls.push(String(url)); return new Response(html, { status: 200 }); }, deps().d.log);
  d.caller = 'person'; d.now = () => NOW;
  const r = await call('value_item', { query: "Levi's 501", condition: 'good' }, d);
  assert.equal(r.ok, true); assert.equal(r.reason, 'too_few'); assert.equal(r.counts.n_comps, 3);
  assert.equal(urls.length, 1); assert.match(urls[0], /availability=sold_out/);
});
test('money and share formatting edges preserve null and suppress only zero cents', () => {
  assert.equal(format(0, 'cents'), '$0'); assert.equal(format(100000, 'cents'), '$1,000');
  assert.equal(format(99, 'cents'), '$0.99'); assert.equal(format(1250, 'cents'), '$12.50'); assert.equal(format(129900, 'cents'), '$1,299');
  assert.equal(format(0.4123, 'share'), '41%'); assert.equal(format(null, 'cents'), null); assert.equal(format(null, 'share'), null);
});
test('every tool result uses only the fixed types.ts contract', async () => {
  for (const def of TOOL_DEFS) {
    const input = def.name === 'market_store' ? { function: 'coverage_now', args: {} } : { query: 'jeans', ...(['value_item', 'where_to_list'].includes(def.name) ? { condition: 'good' } : {}) };
    contract(await call(def.name, input));
  }
  assert.ok(SOURCES.filter(s => s.on).length > 0);
});

test('elapsed time is measured and logs contain tool metadata without the query', async () => {
  let tick = NOW;
  const { d, sink } = deps({ now: () => tick, search: async site => { tick += 7; return structuredClone(searches[site]); } });
  const r = await call('search_market', { query: 'private wardrobe query', sites: ['poshmark'] }, d);
  assert.equal(r.ms, 7); assert.ok(!sink.text().includes('private wardrobe query')); assert.match(sink.text(), /assist.search/);
});
