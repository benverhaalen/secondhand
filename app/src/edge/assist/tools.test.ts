import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createLog, memorySink } from '../../../../log/index.js';
import { TOOL_DEFS, defaultDeps, format, runTool, searchJobResult, toTrendComps, type ToolDeps, type StorePort } from './tools.ts';
import type { ToolResult } from './types.ts';
import type { SiteResult } from '../intel/public/search.ts';
import type { Search, SoldRow } from '../../engines/valuation/sold.ts';
import { SOURCES, type SourceSite } from '../intel/public/sources.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { sha256Hex } from '../../engines/proof/sha256.ts';
import { sourcesFor } from '../intel/public/sources.ts';
import { ports as geniePorts } from '../api/genie.ts';
import { ports as searchPorts, type OfferView } from '../api/search.ts';
import { jobs } from '../api/jobs.ts';
import type { SseFrame } from '../api/jobs.ts';

const recorded = (file: string) => JSON.parse(readFileSync(new URL(`./fixtures/tools/${file}.json`, import.meta.url), 'utf8'));
const searches = recorded('search').sources as Record<string, SiteResult>;
const sales = recorded('sold').sources as Record<string, Awaited<ReturnType<Search>>>;
const NOW = Date.parse('2026-11-15T12:00:00Z');
const signal = () => new AbortController().signal;
function deps(overrides: Partial<ToolDeps> = {}, search: (site: SourceSite) => Promise<SiteResult> = async site => structuredClone(searches[site])) {
  const sink = memorySink();
  const d: ToolDeps = { caller: 'person', person_id: 'person-a',
    sold: async site => structuredClone(sales[site]), store: null, now: () => NOW,
    log: createLog({ src: 'test.assist.tools', build: 'test', sink }), ...overrides };
  let fixtureRows: ReturnType<typeof offer>[] = [];
  d.searchJob ??= {
    async start() {
      const results = (await Promise.all((['poshmark', 'dupe'] as const).map(async site => {
        const got = await search(site);
        return got.rows.map((row, i) => offer(site, i, row.price_cents ?? 0, row.title ?? 'jeans', row.likes));
      }))).flat();
      fixtureRows = results; return { id: 'recorded' };
    },
    listen: () => () => {},
    framesAfter: () => [{ id: 1, event: 'answer.settled', data: { results: fixtureRows, sites_pending: [] } },
      { id: 2, event: 'job.state', data: { state: 'done' } }],
  };
  return { d, sink };
}
const call = (name: string, input: unknown, d = deps().d) => runTool(name, input, d, signal());
const listings = (r: ToolResult) => r.rows.filter(row => row.kind !== 'site_summary');
const resultKeys = ['tool', 'ok', 'reason', 'rows', 'counts', 'as_of', 'citation_ids', 'basis', 'not_built', 'widgets', 'ms', 'result_id'];
function contract(r: ToolResult) {
  assert.ok(Object.keys(r).every(k => resultKeys.includes(k)));
  assert.ok(TOOL_DEFS.some(d => d.name === r.tool) || r.reason === 'invalid_input');
  assert.ok(r.rows.every(row => Object.values(row).every(v => v === null || ['string', 'boolean', 'number'].includes(typeof v))));
  assert.ok(Object.values(r.counts).every(n => typeof n === 'number' && Number.isFinite(n)));
  assert.ok(Number.isFinite(r.ms) && r.ms >= 0);
}

test('definitions name exactly five strict tools and reject extra object properties', () => {
  assert.deepEqual(TOOL_DEFS.map(d => d.name), ['search_market', 'value_item', 'price_trend', 'where_to_list', 'market_store']);
  // Measured 2026-11-15 on the dev server: a top-level anyOf made every turn fail with a 400 before any text.
  for (const d of TOOL_DEFS) for (const k of ['oneOf', 'allOf', 'anyOf']) assert.ok(!(k in d.input_schema), `${d.name} input_schema has ${k} at the top`);
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
  const { d } = deps({ sold: async () => { throw new Error('must not call'); } }, async () => { throw new Error('must not call'); });
  const r = await call(name, input, d);
  assert.equal(r.ok, false); assert.equal(r.reason, 'invalid_input'); assert.deepEqual(r.rows, []); contract(r);
});

function offer(site: SourceSite, id: number, cents = 1000, title = 'jeans', likes?: number): OfferView & { likes?: number } {
  return { id: `offer:${site}:${id}`, listing_id: `listing:${site}:${id}`, site, title, url: `https://${site}.example/${id}`,
    condition: 'good', relation: 'exact', price_cents: { amount_cents: cents, currency: 'USD' }, delivered_cents: { amount_cents: cents, currency: 'USD' },
    external_id: String(id), route_id: `fixture:${site}`, data: `live:${site}`, source_kind: 'marketplace', may_store: false, shipping_cents: null, shipping_estimated: true, also_on: [],
    ...(likes === undefined ? {} : { likes }) };
}
const closeScripts = new Set<() => void>();
afterEach(() => { for (const close of closeScripts) close(); closeScripts.clear(); });
function script() {
  const frames: SseFrame[] = []; const listeners = new Set<() => void>();
  const starts: { caller: string; person_id?: string }[] = [];
  const port = {
    async start(input: { caller: string; person_id?: string }) { starts.push(input); return { id: 'script' }; },
    listen(_id: string, fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    framesAfter(_id: string, cursor: number) { return frames.filter(f => f.id > cursor); },
  };
  const job = { port, starts, listeners, emit(event: string, data: Record<string, unknown>) {
    frames.push({ id: frames.length + 1, event, data }); for (const fn of [...listeners]) fn();
  } };
  closeScripts.add(() => job.emit('job.state', { state: 'done' }));
  return job;
}
const turn = () => new Promise(resolve => setImmediate(resolve));

test('an unknown tool reports its own name', async () => {
  const r = await call('raw_sql', {});
  assert.equal(r.tool, 'raw_sql');
  assert.equal(r.reason, 'invalid_input');
});

for (const snapshot of [false, true]) {
  for (const state of ['done', 'failed', 'cancelled']) {
    test(`${snapshot ? 'existing' : 'new'} search closes on ${state} without an answer`, async () => {
      const job = script(), ctl = new AbortController();
      const d = deps({ searchJob: job.port }).d;
      const pending = snapshot ? searchJobResult('script', { ...d, signal: ctl.signal })
        : runTool('search_market', { query: 'jeans' }, d, ctl.signal);
      await turn();
      job.emit('job.state', { state });
      assert.equal(job.listeners.size, 0, `${state} must unsubscribe without waiting for abort`);
      const r = await pending;
      assert.equal(r.reason, 'failed');
      assert.deepEqual(r.rows, []);
    });
  }
  for (const first of [false, true]) {
    test(`${snapshot ? 'existing' : 'new'} search deadline closes ${first ? 'after' : 'before'} the first answer`, { timeout: 1000 }, async t => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      const job = script(), ctl = new AbortController(), params = memoryStore();
      params.declare({ name: 'assist_search_wait_ms', family: 'scalar', prior: 17 });
      const d = Object.assign(deps({ searchJob: job.port }).d, { params });
      const pending = snapshot ? searchJobResult('script', { ...d, signal: ctl.signal })
        : runTool('search_market', { query: 'jeans' }, d, ctl.signal);
      await turn();
      if (first) { job.emit('answer.partial', { results: [offer('poshmark', 1)], sites_pending: ['ebay'] }); await pending; }
      t.mock.timers.tick(16);
      assert.equal(job.listeners.size, 1);
      t.mock.timers.tick(1);
      assert.equal(job.listeners.size, 0, 'configured search deadline must unsubscribe');
      const r = await pending;
      if (first) assert.equal(listings(r).length, 1);
      else assert.equal(r.reason, 'failed');
      assert.equal(ctl.signal.aborted, false);
    });
  }
}

test('settled with no pending sites still forwards Facebook fills until terminal state', async () => {
  const job = script(), updates: import('./tools.ts').LateUpdate[] = [];
  const pending = call('search_market', { query: 'jeans' }, deps({ searchJob: job.port, onLate: u => updates.push(u) }).d);
  await turn();
  job.emit('answer.settled', { results: [offer('poshmark', 1)], sites_pending: [] });
  await pending;
  assert.equal(job.listeners.size, 1, 'settled does not mean the search job is terminal');
  job.emit('answer.late', { site: 'facebook', results: [offer('facebook', 2)], sites_pending: [] });
  assert.equal(updates[0].site, 'facebook');
  assert.equal(updates[0].rows[0].id, 'offer:facebook:2');
  job.emit('job.state', { state: 'done' });
  assert.equal(job.listeners.size, 0);
  job.emit('answer.late', { site: 'facebook', results: [offer('facebook', 3)], sites_pending: [] });
  assert.equal(updates.length, 1);
});

test('one failed site preserves rows from the sites that answer', async () => {
  const job = script(), updates: import('./tools.ts').LateUpdate[] = [];
  const pending = call('search_market', { query: 'jeans' }, deps({ searchJob: job.port, onLate: u => updates.push(u) }).d);
  await turn();
  job.emit('answer.partial', { site: 'poshmark', results: [offer('poshmark', 1)], sites_pending: ['ebay', 'dupe'] });
  const first = await pending;
  job.emit('job.stage', { site: 'ebay', state: 'failed', found: {} });
  job.emit('answer.partial', { site: 'dupe', results: [offer('dupe', 2)], sites_pending: [] });
  job.emit('job.state', { state: 'failed' });
  assert.equal(listings(first)[0].id, 'offer:poshmark:1');
  assert.equal(updates[0].rows[0].id, 'offer:dupe:2');
  assert.equal(job.listeners.size, 0);
});

for (const results of [undefined, {}, [null], [3], ['bad'], [[]]]) {
  test(`search rejects malformed results before reading rows: ${JSON.stringify(results)}`, async () => {
    const job = script();
    job.emit('answer.settled', { results, sites_pending: [] });
    const { d, sink } = deps({ searchJob: job.port });
    const r = await call('search_market', { query: 'jeans' }, d);
    assert.equal(r.reason, 'failed');
    assert.match(sink.text(), /invalid search results/);
    assert.equal(job.listeners.size, 0);
  });
}

test('a summary over rows not returned is refused: summaries use only capped returned ids', async () => {
  const job = script();
  job.emit('answer.settled', { results: Array.from({ length: 80 }, (_, i) => offer(i % 2 ? 'dupe' : 'poshmark', i, i * 100, 'jeans', i)), sites_pending: [] });
  const r = await call('search_market', { query: 'jeans' }, deps({ searchJob: job.port }).d);
  assert.ok(r.rows.length <= 30);
  for (const site of ['poshmark', 'dupe']) {
    const rows = listings(r).filter(row => row.site === site);
    const summary = r.rows.find(row => row.kind === 'site_summary' && row.site === site)!;
    const prices = rows.map(row => Number(row.price_cents)).sort((a, b) => a - b), mid = Math.floor(prices.length / 2);
    assert.equal(summary.n, rows.length);
    assert.equal(summary.p50_ask_cents, prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2));
    assert.equal(summary.likes_per_listing, rows.reduce((n, row) => n + Number(row.likes), 0) / rows.length);
    assert.deepEqual(JSON.parse(String(summary.basis_ids)), rows.map(row => row.id));
  }
  assert.deepEqual(r.citation_ids, r.rows.map(row => row.citation_id));
});

test('a figure with no row id: search preserves OfferView ids and row rights including Dupe credit', async () => {
  const job = script(); job.emit('answer.settled', { results: [{ ...offer('dupe', 1), attribution: 'Dupe.com', may_model: false, use_scope: 'hackathon_demo' }], sites_pending: [] });
  const r = await call('search_market', { query: 'jeans' }, deps({ searchJob: job.port }).d);
  const row = listings(r)[0]; assert.equal(row.id, 'offer:dupe:1'); assert.equal(row.citation_id, row.id);
  assert.equal(row.attribution, 'via Dupe.com'); assert.equal(row.may_model, false); assert.equal(row.use_scope, 'hackathon_demo');
  assert.equal(row.may_store, false, 'the storage mark must survive listing projection');
  assert.ok(r.rows.every(row => row.id && r.citation_ids.includes(String(row.citation_id))));
});

test('search returns the first partial while eBay is pending and sends later frames with new result ids', async () => {
  const job = script(); const updates: { result_id: string; site: string; rows: Record<string, unknown>[]; sites_pending: string[] }[] = [];
  const pending = call('search_market', { query: 'jeans' }, deps({ searchJob: job.port, onLate: update => { updates.push(update); } }).d);
  await turn(); job.emit('answer.partial', { site: 'depop', results: [offer('depop', 1)], sites_pending: ['poshmark', 'ebay'] });
  const r = await pending; assert.equal(r.counts.ebay_pending, 1); assert.equal(r.counts.sites_pending, 2);
  assert.equal(listings(r)[0].site, 'depop'); assert.equal(job.listeners.size, 1);
  job.emit('answer.partial', { site: 'poshmark', results: [offer('poshmark', 2)], sites_pending: ['ebay'] });
  job.emit('answer.partial', { site: 'ebay', results: [offer('ebay', 3)], sites_pending: [] });
  job.emit('answer.settled', { results: [offer('depop', 1), offer('poshmark', 2), offer('ebay', 3)], sites_pending: [] });
  assert.equal(updates.length, 3); assert.equal(updates[1].site, 'ebay'); assert.equal(updates[1].rows[0].id, 'offer:ebay:3');
  const first = (r as ToolResult & { result_id: string }).result_id;
  job.emit('job.state', { state: 'done' });
  assert.deepEqual(updates.map(u => u.result_id), [1, 2, 3].map(n => `${first}:late:${n}`)); assert.equal(job.listeners.size, 0);
  assert.equal(job.starts[0].caller, 'person'); assert.equal(job.starts[0].person_id, 'person-a');
});

test('search forwards answer.late after settled while pending sites remain', async () => {
  const job = script(); const updates: string[] = [];
  const pending = call('search_market', { query: 'jeans' }, deps({ searchJob: job.port, onLate: u => { updates.push(u.site); } }).d);
  await turn(); job.emit('answer.partial', { site: 'poshmark', results: [offer('poshmark', 1)], sites_pending: ['ebay'] }); await pending;
  job.emit('answer.settled', { results: [offer('poshmark', 1)], sites_pending: ['ebay'] }); assert.equal(job.listeners.size, 1);
  job.emit('answer.late', { site: 'ebay', results: [offer('ebay', 2)], sites_pending: [] });
  job.emit('job.state', { state: 'done' });
  assert.deepEqual(updates, ['all', 'ebay']); assert.equal(job.listeners.size, 0);
});

test('a listener left open after abort: abort before and after first output always unsubscribes', async () => {
  for (const first of [false, true]) {
    const job = script(), parent = new AbortController();
    const pending = runTool('search_market', { query: 'jeans' }, deps({ searchJob: job.port }).d, parent.signal);
    await turn(); assert.equal(job.listeners.size, 1);
    if (first) { job.emit('answer.partial', { site: 'depop', results: [offer('depop', 1)], sites_pending: ['ebay'] }); await pending; }
    parent.abort(); const r = await pending; assert.equal(job.listeners.size, 0); if (!first) assert.equal(r.reason, 'failed');
  }
});

test('a failed search job returns a fixed code without vendor text and unsubscribes', async () => {
  const job = script(); const pending = call('search_market', { query: 'jeans' }, deps({ searchJob: job.port }).d);
  await turn(); job.emit('job.state', { state: 'failed', error: { message: 'vendor private text' } });
  const r = await pending; assert.equal(r.reason, 'failed'); assert.ok(!JSON.stringify(r).includes('vendor private text')); assert.equal(job.listeners.size, 0);
});

test('exclude_brand filters returned rows before computing their summary', async () => {
  const job = script(); job.emit('answer.settled', { results: ['CARHARTT coat', 'carhartt-like jacket', 'mycarhartt coat', 'Plain coat'].map((title, i) => offer('poshmark', i, 1000, title)), sites_pending: [] });
  const r = await call('search_market', { query: 'coat', exclude_brand: 'carhartt' }, deps({ searchJob: job.port }).d);
  assert.deepEqual(listings(r).map(row => row.title), ['mycarhartt coat', 'Plain coat']); assert.equal(r.counts.dropped_brand, 2);
});

test('value_item preserves the engine’s not_checked_yet thin range and too_few note', async () => {
  const r = await call('value_item', { query: "Levi's 501", condition: 'good' }, deps({ sold: async site => site === 'poshmark' ? structuredClone(sales[site]) : { rows: [], outcome: 'empty' } }).d);
  assert.equal(r.ok, true); assert.equal(r.reason, 'too_few'); assert.equal(r.counts.n_comps, 3);
  assert.match(r.basis, /3 sold on poshmark/); assert.match(r.basis, /product_id q_levi-s-501; floor 0; objective balanced/);
  const all = r.rows.find(row => row.site === 'all')!;
  assert.equal(all.state, 'not_checked_yet'); assert.equal(typeof all.q50_cents, 'number'); assert.equal(all.notes, '["too_few"]');
  assert.ok(r.rows.filter(row => row.state === 'hidden').every(row => row.q50_cents === null));
  assert.ok(r.rows.every(row => r.citation_ids.includes(String(row.citation_id)))); assert.deepEqual(r.widgets, ['price_range']); contract(r);
});

function enough(): Search {
  return async site => ({ rows: Array.from({ length: 10 }, (_, i) => ({ ...sales[site].rows[0], external_id: `${site}-${i}`, title: 'jeans',
    condition: 'Good', price_cents: 2000, listed_at: '2026-11-14T00:00:00Z' })), outcome: 'hit' });
}
test('a hidden range shown by the tool: engine visibility overrides numeric values', async () => {
  const toolURL = new URL('./tools.ts?band-only', import.meta.url).href;
  const checkURL = new URL('../../engines/valuation/valuate.ts', import.meta.url).href;
  const replacement = `import { valuate as realValuate } from ${JSON.stringify(checkURL)};
    export const valuate = async (item, ctx) => { const out = await realValuate(item, { ...ctx, sources: [] });
      out.valuation.range = { ...out.valuation.range, state: 'hidden', hide_reason: 'no_citation', q10: 3000, q50: 4500, q90: 6000 };
      out.valuation.per_site = out.valuation.per_site.map(s => ({ ...s, state: 'hidden', hide_reason: 'no_citation', q10: 3000, q50: 4500, q90: 6000 })); return out; };`;
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === toolURL && specifier.endsWith('/valuate.ts'))
      return { url: 'data:text/javascript,' + encodeURIComponent(replacement), shortCircuit: true };
    return next(specifier, context);
  } });
  try {
    const { runTool: bandTool }: typeof import('./tools.ts') = await import(toolURL);
    const r = await bandTool('value_item', { query: 'jeans', condition: 'good' }, deps({ sold: enough() }).d, signal());
    assert.equal(r.ok, true); assert.equal(r.reason, 'no_citation');
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
  const connection: import('../genie/genie.ts').GenieDeps = { host: 'https://workspace.example', space_id: 'fixture-space', token: async () => 'fixture', log: d.log, now: () => NOW,
    fetch: async () => Response.json(++calls === 1 ? { conversation_id: 'c', message_id: 'm' } : calls === 2 ?
      { status: 'COMPLETED', attachments: [{ attachment_id: 'a', query: { query: 'SELECT price_cents FROM secondhand.market.listing_obs' } }] } :
      { statement_response: { manifest: { schema: { columns: [{ name: 'price_cents' }] } }, result: { data_array: [[1250]] } } }) };
  d.forUser = async () => connection;
  const visitor = await call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, { ...d, caller: 'visitor' });
  assert.equal(visitor.reason, 'signed_in_only'); assert.equal(calls, 0);
  const r = await call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, d);
  assert.equal(r.ok, true); assert.equal(r.rows[0].price, '$12.50'); assert.match(String(r.rows[0].sql), /^SELECT/);
  assert.equal(r.rows[0].tables, 'secondhand.market.listing_obs'); contract(r);
  const id = `genie:${sha256Hex(JSON.stringify([d.person_id, { price: '$12.50', price_cents: 1250 }, 0])).slice(0, 16)}`;
  assert.equal(r.rows[0].id, id);
  assert.deepEqual(r.citation_ids, [id]);
  assert.ok(!JSON.stringify(r).includes(d.person_id!));
});
test('ask_genie uses a 30 second polling budget and reports failure', async () => {
  const { d, sink } = deps(); let clock = NOW, calls = 0;
  const connection: import('../genie/genie.ts').GenieDeps = { host: 'https://workspace.example', space_id: 'fixture', token: async () => 'fixture', log: d.log, now: () => clock,
    sleep: async ms => { clock += ms; }, fetch: async () => Response.json(++calls === 1 ? { conversation_id: 'c', message_id: 'm' } : { status: 'RUNNING' }) };
  d.forUser = async () => connection;
  const r = await call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, d);
  assert.equal(r.reason, 'failed'); assert.ok(clock - NOW <= 31500); assert.match(sink.text(), /"event":"error"/);
});

test('ask_genie bounds a hung HTTP call to 30 seconds and aborts its fetch signal', { timeout: 1000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { d } = deps(); let fetchSignal: AbortSignal | null | undefined;
  const connection: import('../genie/genie.ts').GenieDeps = { host: 'https://workspace.example', space_id: 'fixture', token: async () => 'fixture', log: d.log,
    fetch: async (_url, init) => { fetchSignal = init?.signal; return new Promise(() => {}); } };
  d.forUser = async () => connection;
  const pending = call('market_store', { function: 'ask_genie', args: { question: 'What is held?' } }, d);
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(30_000);
  const r = await pending;
  assert.equal(r.reason, 'failed'); assert.equal(fetchSignal?.aborted, true);
});
test('defaultDeps checks connection presence and defaults to visitor without printing env values', () => {
  const { d } = deps(); const fetch: typeof globalThis.fetch = async () => { throw new Error('no network'); };
  assert.equal(defaultDeps({}, fetch, d.log).store, null); assert.equal(typeof defaultDeps({}, fetch, d.log).forUser, 'function');
  const env = { DATABRICKS_HOST: 'https://workspace.example', DATABRICKS_TOKEN: 'fixture', DATABRICKS_WAREHOUSE_ID: 'w', GENIE_SPACE_ID: 's' };
  const ready = defaultDeps(env, fetch, d.log); assert.ok(ready.store); assert.ok(ready.forUser); assert.equal(ready.caller, 'visitor');
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

test('copied default sold tools read the current request identity instead of the template identity', async () => {
  const html = readFileSync(new URL('../harness/sites/poshmark/fixtures/search-sold.html', import.meta.url), 'utf8');
  let fetches = 0;
  const template = defaultDeps({ SECONDHAND_LIVE_SITES: 'poshmark' }, async () => { fetches++; return new Response(html); }, deps().d.log);
  const person: ToolDeps = { ...template, caller: 'person', person_id: 'person-a' };
  const visitor: ToolDeps = { ...template, caller: 'visitor' };
  const [personRows, visitorRows] = await Promise.all([
    person.sold('poshmark', "Levi's 501", signal()), visitor.sold('poshmark', "Levi's 501", signal()),
  ]);
  assert.equal(personRows.outcome, 'hit');
  assert.equal(personRows.rows.length, 3);
  assert.equal(visitorRows.outcome, 'needs_account');
  assert.equal(fetches, 1);
  assert.equal(template.caller, 'visitor');
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
  const { d, sink } = deps({ now: () => tick }, async site => { tick += 7; return structuredClone(searches[site]); });
  const r = await call('search_market', { query: 'private wardrobe query', sites: ['poshmark'] }, d);
  assert.equal(r.ms, 14); assert.ok(!sink.text().includes('private wardrobe query')); assert.match(sink.text(), /assist.search/);
});

test('a person reading another person’s Genie space: forUser receives authenticated ids and fails closed', async () => {
  const ids: string[] = [], spaces: string[] = [];
  const forUser: NonNullable<ToolDeps['forUser']> = async id => {
    ids.push(id); let n = 0;
    return { host: 'https://genie.example', space_id: id, token: async () => 'fixture', log: deps().d.log,
      fetch: async url => { spaces.push(String(url)); return Response.json(++n === 1 ? { conversation_id: 'c', message_id: 'm' } : n === 2 ?
        { status: 'COMPLETED', attachments: [{ attachment_id: 'a', query: { query: 'SELECT n FROM filtered' } }] } :
        { statement_response: { manifest: { schema: { columns: [{ name: 'n' }] } }, result: { data_array: [[7]] } } }); } };
  };
  for (const person_id of ['person-a', 'person-b']) {
    const r = await call('market_store', { function: 'ask_genie', args: { question: 'counts' } }, deps({ person_id, forUser }).d);
    assert.equal(r.ok, true); assert.ok(r.rows[0].citation_id); assert.ok(r.citation_ids.includes(String(r.rows[0].citation_id)));
  }
  assert.deepEqual(ids, ['person-a', 'person-b']); assert.ok(spaces.some(s => s.includes('/spaces/person-a/'))); assert.ok(spaces.some(s => s.includes('/spaces/person-b/')));
  for (const d of [deps({ person_id: undefined, forUser }).d, deps({ forUser: async () => null }).d])
    assert.equal((await call('market_store', { function: 'ask_genie', args: { question: 'counts' } }, d)).reason, 'not_connected');
  assert.deepEqual(ids, ['person-a', 'person-b']);
});

test('a visitor reaching Genie or the market functions is refused before an outside call', async () => {
  let calls = 0;
  const { d } = deps({ caller: 'visitor', store: { ...store({}).port, fetch: async () => { calls++; throw new Error('must not read'); } },
    forUser: async () => { calls++; throw new Error('must not read'); } });
  for (const [fn, args] of [['coverage_now', {}], ['asks', { term: 'x', site: 'all', days: 7 }], ['ask_genie', { question: 'x' }]] as const)
    assert.equal((await call('market_store', { function: fn, args }, d)).reason, 'signed_in_only');
  assert.equal(calls, 0);
});

test('every string argument is bounded at the boundary', async () => {
  for (const [fn, args] of [
    ['asks', { term: 'x'.repeat(201), site: 'all', days: 7 }], ['asks', { term: 'x', site: 'x'.repeat(201), days: 7 }],
    ['top_terms', { kind: 'x'.repeat(201), site: 'all', days: 7, k: 5 }], ['ask_genie', { question: 'x'.repeat(501) }],
  ] as const) assert.equal((await call('market_store', { function: fn, args })).reason, 'invalid_input');
});

test('vendor text in a tool result: sold reasons stay in log.error', async () => {
  const { d, sink } = deps({ sold: async site => site === 'mercari' ? { outcome: 'needs_account', reason: 'VENDOR_PRIVATE', rows: [] } : { outcome: 'hit', rows: sales.poshmark.rows } });
  for (const tool of ['value_item', 'price_trend', 'where_to_list']) {
    const r = await call(tool, { query: 'jeans', ...(tool === 'price_trend' ? {} : { condition: 'good' }) }, d);
    assert.ok(!JSON.stringify(r).includes('VENDOR_PRIVATE'));
  }
  assert.match(sink.text(), /VENDOR_PRIVATE/);
});

test('vendor text in a tool result: Genie failures use a fixed code', async () => {
  const { d, sink } = deps();
  d.forUser = async () => ({ host: 'https://genie.example', space_id: 'person-a', log: d.log, token: async () => 'fixture',
    fetch: async () => Response.json({ message: 'VENDOR_PRIVATE' }, { status: 403 }) });
  const r = await call('market_store', { function: 'ask_genie', args: { question: 'counts' } }, d);
  assert.equal(r.reason, 'failed'); assert.ok(!JSON.stringify(r).includes('VENDOR_PRIVATE')); assert.match(sink.text(), /"event":"error"/);
});

test('a figure with no row id: valuation sites cite their basis and fee rows', async () => {
  for (const tool of ['value_item', 'where_to_list']) {
    const r = await call(tool, { query: 'jeans', condition: 'good' }, deps({ sold: enough() }).d);
    for (const row of r.rows) {
      assert.ok(row.id); assert.ok(row.citation_id); assert.ok(r.citation_ids.includes(String(row.citation_id)));
      if (row.site !== 'all') {
        assert.equal(row.fee_citation_id, `fee:${row.site}:2026-11-14`); assert.equal(row.source_note, 'research/price/nate/fees-and-taxes.md');
        assert.ok(r.citation_ids.includes(String(row.fee_citation_id)));
      }
    }
  }
});

test('value_item makes one valuate call with person, params, observations and the clock', async () => {
  const seen: { person?: string; as_of: string }[] = [], reads: string[] = [], writes: string[] = [];
  const toolURL = new URL('./tools.ts?one-valuate', import.meta.url).href;
  const realURL = new URL('../../engines/valuation/valuate.ts', import.meta.url).href;
  const shared = globalThis as typeof globalThis & { __assistValuateProbe?: (ctx: { person?: string; as_of: string }) => void };
  shared.__assistValuateProbe = ctx => { seen.push(ctx); };
  const replacement = `import { valuate as real } from ${JSON.stringify(realURL)}; export const valuate = (item, ctx) => { globalThis.__assistValuateProbe(ctx); return real(item, ctx); };`;
  const hook = registerHooks({ resolve(specifier, context, next) { return context.parentURL === toolURL && specifier.endsWith('/valuate.ts') ?
    { url: 'data:text/javascript,' + encodeURIComponent(replacement), shortCircuit: true } : next(specifier, context); } });
  try {
    const { runTool: run }: typeof import('./tools.ts') = await import(toolURL);
    const d = deps({ sold: enough(), valuation: { params: memoryStore(), observations: {
      read: async q => { reads.push(q.product_id); return []; }, write: async (_rows, meta) => { writes.push(meta.item_id); },
    } } }).d;
    const r = await run('value_item', { query: 'jeans', condition: 'good' }, d, signal());
    assert.equal(r.ok, true); assert.equal(seen.length, 1); assert.equal(seen[0].person, 'person-a'); assert.equal(seen[0].as_of, new Date(NOW).toISOString());
    assert.deepEqual(reads, ['q_jeans']); assert.equal(writes.length, 1);
  } finally { hook.deregister(); delete shared.__assistValuateProbe; }
});

test('a figure with no row id: governed rows and trend figures carry basis ids', async () => {
  const r = await call('market_store', { function: 'coverage_now', args: {} }, deps({ store: store({ status: { state: 'SUCCEEDED' },
    manifest: { schema: { columns: [{ name: 'n' }] } }, result: { data_array: [[8], [10]] } }).port }).d);
  assert.equal(new Set(r.rows.map(row => row.citation_id)).size, 2);
  for (const row of r.rows) { assert.ok(row.id); assert.ok(r.citation_ids.includes(String(row.citation_id))); }
  const trend = await call('price_trend', { query: 'jeans' }, deps({ sold: enough() }).d);
  const row = trend.rows.find(row => row.kind !== 'comp')!;
  for (const field of ['p50_recent', 'p50_prior', 'change_pct']) {
    const ids = JSON.parse(String(row[`${field}_basis_ids`])) as string[];
    assert.ok(ids.every(id => trend.rows.some(b => b.id === id) && trend.citation_ids.includes(id)));
  }
});

test('defaultDeps: a visitor never reaches a person-only source in the real search job', async () => {
  const oldSources = searchPorts.sources;
  const only = SOURCES.find(s => s.person_only)!; searchPorts.sources = [only];
  try {
    const d = defaultDeps({}, async () => { throw new Error('must not fetch'); }, deps().d.log);
    const r = await call('search_market', { query: 'jeans' }, d);
    assert.equal(d.caller, 'visitor'); assert.ok(!JSON.stringify(r).includes(only.site));
    const result_id = (r as ToolResult & { result_id: string }).result_id;
    assert.equal(jobs.listenerCount(result_id.slice(0, -6)), 0); assert.equal(sourcesFor('background', [only]).length, 0);
  } finally { searchPorts.sources = oldSources; }
});

test('defaultDeps resolves Genie through the API user-scoped port', async () => {
  const old = geniePorts.forUser; const ids: string[] = [];
  geniePorts.forUser = async id => { ids.push(id); return null; };
  try {
    const d = defaultDeps({}, async () => { throw new Error('must not fetch'); }, deps().d.log); d.caller = 'person'; d.person_id = 'person-b';
    assert.equal((await call('market_store', { function: 'ask_genie', args: { question: 'x' } }, d)).reason, 'not_connected');
    assert.deepEqual(ids, ['person-b']);
  } finally { geniePorts.forUser = old; }
});

test('search reads the route’s money objects and null prices without NaN or invented dollar amounts', async () => {
  const job = script();
  job.emit('answer.settled', { results: [
    { ...offer('poshmark', 1), price_cents: { amount_cents: 1200, currency: 'USD' }, delivered_cents: { amount_cents: 1500, currency: 'USD' } },
    { ...offer('poshmark', 2), price_cents: null, delivered_cents: null },
    { ...offer('poshmark', 3), price_cents: { amount_cents: 1800, currency: 'GBP' }, delivered_cents: null },
  ], sites_pending: [] });
  const r = await call('search_market', { query: 'jeans' }, deps({ searchJob: job.port }).d);
  assert.equal(r.ok, true); const rows = listings(r);
  assert.equal(rows[0].delivered, '$15'); assert.equal(rows[0].delivered_cents, 1500);
  assert.equal(rows[1].price_cents, null); assert.equal(rows[1].delivered_cents, null);
  assert.equal(rows[2].price, '£18.00'); assert.equal(rows[2].currency, 'GBP');
  assert.equal(r.counts.poshmark_p50_ask_cents, 1200); assert.ok(!JSON.stringify(r).includes('NaN')); contract(r);
});

test('trend basis ids identify the exact median windows even when source URLs repeat', async () => {
  const sold: Search = async site => ({ outcome: site === 'poshmark' ? 'hit' : 'empty', rows: site === 'poshmark' ? Array.from({ length: 20 }, (_, i) => ({
    ...sales.poshmark.rows[0], external_id: `exact-window-${i}`, title: 'jeans', condition: 'Good', price_cents: i < 10 ? 2000 : 1000,
    listed_at: i < 10 ? '2026-11-14T00:00:00Z' : '2026-10-31T00:00:00Z',
  })) : [] });
  const r = await call('price_trend', { query: 'jeans' }, deps({ sold }).d), row = r.rows[0];
  const recent = Array.from({ length: 10 }, (_, i) => `poshmark:exact-window-${i}`);
  const prior = Array.from({ length: 10 }, (_, i) => `poshmark:exact-window-${i + 10}`);
  assert.deepEqual(JSON.parse(String(row.p50_recent_basis_ids)), recent);
  assert.deepEqual(JSON.parse(String(row.p50_prior_basis_ids)), prior);
  assert.deepEqual(JSON.parse(String(row.change_pct_basis_ids)), [...recent, ...prior]);
  for (const id of [...recent, ...prior]) { assert.ok(r.rows.some(b => b.id === id)); assert.ok(r.citation_ids.includes(id)); }
});

test('defaultDeps passes the authenticated caller into the real search job owner', async () => {
  const oldSources = searchPorts.sources; searchPorts.sources = [];
  try {
    const owners: string[] = [];
    for (const person_id of ['person-a', 'person-b']) {
      const d = defaultDeps({}, async () => { throw new Error('must not fetch'); }, deps().d.log); d.caller = 'person'; d.person_id = person_id;
      const r = await call('search_market', { query: 'jeans' }, d);
      const result_id = (r as ToolResult & { result_id: string }).result_id, id = result_id.slice(0, -6);
      assert.equal(jobs.owner(id), person_id); assert.equal(jobs.listenerCount(id), 0); owners.push(id);
    }
    assert.notEqual(owners[0], owners[1]);
  } finally { searchPorts.sources = oldSources; }
});

test('existing search reader uses latest settled snapshot rather than replaying its partials', async () => {
  const job = script();
  job.emit('answer.partial', { results: [offer('poshmark', 0)], sites_pending: ['ebay'] });
  job.emit('answer.settled', { results: [offer('poshmark', 1), offer('ebay', 2), offer('ebay', 3)], sites_pending: [] });
  job.emit('job.state', { state: 'done' });
  const updates: unknown[] = [];
  const r = await searchJobResult('script', { ...deps({ searchJob: job.port, onLate: u => updates.push(u) }).d, signal: signal() });
  assert.deepEqual(listings(r).map(row => row.id), ['offer:poshmark:1', 'offer:ebay:2', 'offer:ebay:3']);
  assert.equal(r.result_id, 'script:first');
  assert.equal(updates.length, 0);
  assert.equal(job.starts.length, 0);
  assert.equal(job.listeners.size, 0);
});

test('existing search reader merges partial rows by id and follows only subsequent frames', async () => {
  const job = script(), ctl = new AbortController();
  job.emit('answer.partial', { results: [offer('poshmark', 1, 1000)], sites_pending: ['ebay'] });
  job.emit('answer.partial', { results: [offer('poshmark', 1, 1200), offer('dupe', 2)], sites_pending: ['ebay'] });
  const updates: import('./tools.ts').LateUpdate[] = [];
  const r = await searchJobResult('script', { ...deps({ searchJob: job.port, onLate: u => updates.push(u) }).d, signal: ctl.signal });
  assert.equal(listings(r).length, 2);
  assert.equal(listings(r)[0].price_cents, 1200);
  assert.equal(r.counts.ebay_pending, 1);
  job.emit('answer.settled', { results: [offer('poshmark', 1), offer('dupe', 2)], sites_pending: ['ebay'] });
  job.emit('answer.late', { site: 'ebay', results: [offer('ebay', 3)], sites_pending: [] });
  job.emit('job.state', { state: 'done' });
  assert.deepEqual(updates.map(u => u.result_id), ['script:first:late:1', 'script:first:late:2']);
  assert.equal(job.listeners.size, 0);
  ctl.abort();
});

test('existing search reader waits for first answer and unsubscribes on abort before or after it', async () => {
  for (const first of [false, true]) {
    const job = script(), ctl = new AbortController();
    const pending = searchJobResult('script', { ...deps({ searchJob: job.port }).d, signal: ctl.signal });
    assert.equal(job.listeners.size, 1);
    if (first) {
      job.emit('answer.partial', { results: [offer('poshmark', 1)], sites_pending: ['ebay'] });
      assert.equal(listings(await pending).length, 1);
    }
    ctl.abort(new Error('cancelled'));
    if (!first) await assert.rejects(pending, /cancelled/);
    assert.equal(job.listeners.size, 0);
  }
});

test('search seeds retain full listed and site totals while rows stay capped, from settled or latest partial', async () => {
  for (const event of ['answer.settled', 'answer.partial']) {
    const frames: SseFrame[] = [{ id: 1, event, data: {
      results: Array.from({ length: 84 }, (_, i) => offer('poshmark', i, 4000)), sites_pending: [],
      ...(event === 'answer.settled' ? { found: { results_found: 90, results_used: 84, sites: { poshmark: 84 } } }
        : { answer: { found: { results_found: 90, results_used: 84, sites: { poshmark: 84 } } } }),
    } }, { id: 2, event: 'job.state', data: { state: 'done' } }];
    const { d } = deps({ searchJob: { start: async () => ({ id: 'search' }), listen: () => () => {}, framesAfter: () => frames } });
    const r = await searchJobResult('search', { ...d, signal: signal() });
    assert.ok(r.rows.length <= 30);
    assert.equal(r.counts.results_found, 90);
    assert.equal(r.counts.results_used, 84);
    assert.equal(r.counts.poshmark_found, 84);
    assert.ok(r.counts.rows < r.counts.results_used);
  }
});
