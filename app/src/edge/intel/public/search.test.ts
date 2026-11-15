import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { searchAll, searchSite, searchSource } from './search.ts';
import { SOURCES } from './sources.ts';
import type { PageResult } from '../fetch.ts';
import { _reset, runPlan, searchParams } from '../run.ts';

const fixture = readFileSync(new URL('../../../../../spec/fixtures/pages/poshmark.html', import.meta.url), 'utf8');
const page = (html: string, status = 200): PageResult => ({ ok: true, html, status, final_url: '', rung: 'plain', ms: 0, searched: [] });

test('one site uses the same reader and counts as searchAll, with exactly one fetch', async () => {
  let calls = 0;
  const opts = { sources: SOURCES.filter(s => s.id === 'poshmark'), sites: ['poshmark'] as const, now: () => 0, fetchPage: async () => { calls++; return page(fixture); } };
  const one = await searchSite('poshmark', 'levi 501', 'search', opts);
  assert.equal(calls, 1);
  assert.deepEqual(await searchAll('levi 501', opts), { results: one.rows.map(row => ({ site: 'poshmark', row })), searched: [{ ...one.searched, pace: opts.sources[0].pace }] });
  assert.equal(calls, 2);
});

test('one site distinguishes 403, login walls, empty pages and a changed reader', async () => {
  for (const [site, html, status, outcome] of [
    ['poshmark', fixture, 403, 'blocked'],
    ['facebook', '<form action="/login">Log in</form>', 200, 'blocked'],
    ['poshmark', 'No results', 200, 'empty'],
    ['poshmark', '<nav><a href="/login">Sign in</a></nav><main>No results</main>', 200, 'empty'],
    ['poshmark', '<a href="/listing/missing-6af924447625b11bb42ec837">missing card</a>', 200, 'unknown'],
  ] as const) {
    const result = await searchSite(site, 'levi 501', 'search', { fetchPage: async () => page(html, status) });
    assert.equal(result.searched.outcome, outcome);
    assert.equal(result.searched.count, 0); assert.deepEqual(result.rows, []);
  }
});

test('no listing card is unknown with no author error, and half-unreadable pages count their drops', async () => {
  const absent = await searchSite('poshmark', 'x', 'search', { fetchPage: async () => page('<a href="/listing/missing-6af924447625b11bb42ec837">x</a>') });
  assert.equal(absent.searched.outcome, 'unknown');
  assert.equal(absent.searched.reason, 'no listing card');
  assert.equal(absent.searched.error_code, undefined);
  const planted = fixture.replace(/(<span class="tile-grid-redesign__price-current">)[^<]*(<\/span>)/, '');
  const partial = await searchSite('poshmark', 'x', 'search', { fetchPage: async () => page(planted) });
  assert.equal(partial.searched.outcome, 'hit');
  assert.equal(partial.searched.dropped, 1);
  assert.equal(partial.rows.length, 11);
});

test('eBay active page source is on without approval; sold needs a person and their linked account', async () => {
  const source = SOURCES.find(s => s.site === 'ebay')!;
  assert.equal(source.on, true); assert.equal(source.lane, 'harness'); assert.equal(source.needs_ask, false);
  assert.ok(source.pace); assert.equal(source.pace.per_minute, 6);
  const result = await searchSource(source, 'x', 'sold', { caller: 'background' });
  assert.equal(result.searched.error_code, 'no_route');
});

test('tuning can slow eBay but cannot raise its six-read cap', () => {
  const source = SOURCES.find(s => s.site === 'ebay')!;
  const name = 'search_ebay_harness_per_minute';
  const prior = searchParams.read(name, {}).value;
  try {
    searchParams.declare({ name, family: 'scalar', prior: 60 });
    assert.equal(source.pace.per_minute, 6);
    searchParams.declare({ name, family: 'scalar', prior: 3 });
    assert.equal(source.pace.per_minute, 3);
  } finally { searchParams.declare({ name, family: 'scalar', prior, guard_lo: 1, guard_hi: 6 }); }
});

test('eBay sold uses only the asking person’s account and reports relink without a signed-in page', async () => {
  const { createHarness } = await import('../../harness/protocol.ts');
  const { ebayPageAdapters } = await import('../../harness/sites/ebay/adapter.ts');
  const { memoryAccounts, memoryVault } = await import('../../browser/auth.ts');
  const account = { account_id: 'acc_ebay_search', person_id: 'person_search', site: 'ebay' as const, token_ref: 'test-ebay-search' };
  const vault = memoryVault(); await vault.put(account.token_ref, { cookies: [], origins: [] });
  const accounts = memoryAccounts([account], vault);
  let reads = 0;
  const harness = createHarness({ accounts, adapters: ebayPageAdapters({ signed_in: false,
    page: async () => { reads++; throw new Error('sold without sign-in must not read a page'); },
  }) });
  const source = { ...SOURCES.find(s => s.site === 'ebay')!, pace: { per_minute: 1e12, min_gap_ms: 0 } };
  for (const [caller, person_id] of [['background', 'person_search'], ['person', 'other']] as const) {
    const r = await searchSource(source, 'jeans', 'sold', { caller, person_id, accounts, harness });
    assert.equal(r.searched.outcome, 'needs_account'); assert.equal(reads, 0);
  }
  const r = await searchSource(source, 'jeans', 'sold', { caller: 'person', person_id: 'person_search', accounts, harness });
  assert.equal(r.searched.outcome, 'needs_account');
  assert.equal(r.searched.error_code, 'auth_expired'); assert.equal(reads, 0);
});

test('the shared Dupe slot spends its 3 second gap once and starts the deadline after that gap', async t => {
  _reset();
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  const { createDupe } = await import('../../harness/sites/dupe/adapter.ts');
  const { createLog, memorySink } = await import('../../../../../log/index.js');
  const recording = (name: string) => readFileSync(new URL(`../../harness/sites/dupe/fixtures/${name}.sse`, import.meta.url), 'utf8');
  const starts: number[] = [], sleeps: number[] = [];
  const dupe = createDupe({ log: createLog({ src: 'test', build: 'test', sink: memorySink() }), now: Date.now,
    sleep: async ms => { sleeps.push(ms); await new Promise<void>(resolve => setTimeout(resolve, ms)); },
    send: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === 'tools/call') starts.push(Date.now());
      return { status: 200, headers: new Headers(), text: async () => body.method === 'initialize' ? recording('initialize')
        : body.method === 'tools/list' ? recording('tools-list') : body.method === 'tools/call' ? recording('search') : '' };
    } });
  const source = SOURCES.find(s => s.site === 'dupe')!;
  const ask = (query: string) => runPlan({ kind: 'listings_matching', slots: {}, protocol_version: 1, first_ms: 10, settled_ms: 20,
    targets: [{ target_id: query, query, freshness_s: 0, deadline_ms: 20, routes: [{
      route_id: 'dupe.search.api', host: 'mcp.dupe.com', site: 'dupe', lane: source.lane, pace: source.pace, p95_ms: 10, cache: false,
      async run(q) { const r = await searchSource(source, q, 'search', { dupe, paced: true }); return { outcome: 'hit', rows: r.rows }; },
    }] }], calculate: () => ({ facts: [] }) });
  await ask('first');
  const second = ask('second');
  for (let i = 0; i < 30; i++) await Promise.resolve();
  t.mock.timers.tick(2999);
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(starts.length, 1);
  t.mock.timers.tick(1);
  assert.equal((await second).searched[0].outcome, 'hit');
  assert.deepEqual(starts, [1000, 4000]);
  assert.deepEqual(sleeps, [], 'the adapter sees the elapsed gap and never sleeps a second time');
  _reset();
});

test('a thrown fetch is recorded as timeout with its reason; unsupported sold search does not fetch', async () => {
  const fetchPage = async (): Promise<PageResult> => { throw new Error('page deadline'); };
  const failed = await searchSite('poshmark', 'x', 'search', { fetchPage });
  assert.equal(failed.searched.outcome, 'timeout');
  assert.equal(failed.searched.reason, 'page deadline');
  const sold = await searchSite('depop', 'x', 'sold', { fetchPage });
  assert.equal(sold.searched.outcome, 'empty');
  assert.match(sold.searched.reason!, /sold/);
});


test('Dupe is the first MCP source; Depop uses its harness and Facebook uses person-only Apify', async () => {
  const { SOURCES } = await import('./sources.ts');
  const dupe = SOURCES[0];
  assert.equal(dupe.id, 'dupe'); assert.equal(dupe.lane, 'mcp');
  assert.equal(dupe.on, true); assert.equal(dupe.needs_ask, false);
  for (const site of ['poshmark', 'depop', 'ebay', 'etsy', 'chairish']) assert.ok(dupe.covers.includes(site));
  assert.equal(SOURCES.find(s => s.id === 'depop')!.lane, 'harness');
  assert.equal(SOURCES.find(s => s.id === 'facebook')!.on, true);
  assert.equal(SOURCES.find(s => s.id === 'facebook')!.lane, 'apify');
  const mercari = await searchSource(SOURCES.find(s => s.id === 'mercari')!, 'jeans', 'search', { caller: 'person' });
  assert.equal(mercari.searched.error_code, 'no_route');
  assert.equal(mercari.searched.reason, 'no live route composed');
});

test('Dupe sends the specific query to its module and preserves the fixture rows verbatim', async () => {
  const { SOURCES } = await import('./sources.ts');
  const { createDupe } = await import('../../harness/sites/dupe/adapter.ts');
  const { createLog, memorySink } = await import('../../../../../log/index.js');
  const recording = (name: string) => readFileSync(new URL(`../../harness/sites/dupe/fixtures/${name}.sse`, import.meta.url), 'utf8');
  const queries: string[] = [], sleeps: number[] = []; let now = 0;
  const dupe = createDupe({ log: createLog({ src: 'test', build: 'test', sink: memorySink() }), now: () => now,
    sleep: async ms => { sleeps.push(ms); now += ms; },
    send: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === 'tools/call') queries.push(body.params.arguments.query);
      return { status: 200, headers: new Headers(), text: async () => body.method === 'initialize' ? recording('initialize')
        : body.method === 'tools/list' ? recording('tools-list') : body.method === 'tools/call' ? recording('search') : '' };
    } });
  const source = SOURCES.find(s => s.id === 'dupe')!;
  const q = "Levi's 501 32x32 Medium Wash";
  const opts = { dupe, fetchPage: async (): Promise<PageResult> => { assert.fail('Dupe must not use page fetch'); } };
  const a = await searchSource(source, q, 'search', opts);
  const b = await searchSource(source, q + ' blue', 'search', opts);
  assert.equal(a.searched.site, 'dupe'); assert.equal(a.rows.length, 6);
  assert.deepEqual(queries, [q, q + ' blue']); assert.deepEqual(sleeps, [3000]);
  assert.ok(a.rows.every(r => 'commercial_link' in r && r.commercial_link === true && r.attribution === 'Dupe.com'));
  const rpc = JSON.parse(recording('search').split('data: ')[1]);
  const products = JSON.parse(rpc.result.content[0].text).products;
  assert.deepEqual(a.rows.map(r => r.url), products.map((p: { link: string }) => p.link));
  assert.deepEqual(b.rows.map(r => r.url), a.rows.map(r => r.url));
});


test('anonymous Depop reads call its real harness search verb with no public-page fallback', async () => {
  const { createHarness } = await import('../../harness/protocol.ts');
  const { depopAdapters } = await import('../../harness/sites/depop/adapter.ts');
  const recording = readFileSync(new URL('../../harness/sites/depop/fixtures/search.html', import.meta.url), 'utf8');
  const urls: string[] = [];
  const harness = createHarness({ adapters: depopAdapters({ signed_in: false,
    doc: async url => { urls.push(url); return { status: 200, html: recording }; },
    json: async () => { assert.fail('active search uses the harness page route'); },
  }) });
  const source = SOURCES.find(s => s.id === 'depop')!;
  const opts = { harness, fetchPage: async (): Promise<PageResult> => { assert.fail('known 403 lane must never be retried'); } };
  const first = await searchSource(source, 'carhartt jacket XL', 'search', opts);
  const next = await searchSource(source, 'levi 501 32x32', 'search', opts);
  assert.equal(first.searched.outcome, 'hit'); assert.equal(next.searched.outcome, 'hit');
  assert.ok(first.rows.length > 0); assert.equal(urls.length, 2);
  assert.match(urls[0], /q=carhartt%20jacket%20XL/);
  const sold = await searchSource(source, 'carhartt jacket XL', 'sold', opts);
  assert.equal(sold.searched.outcome, 'failed'); assert.equal(sold.searched.error_code, 'no_route');
  assert.equal(urls.length, 2, 'unsupported sold search never falls back to plain fetch');
});

const facebook = () => SOURCES.find(s => s.id === 'facebook')!;
const ebay = () => SOURCES.find(s => s.id === 'ebay')!;
const apifyRow = { id: 'facebook:demo', title: 'levi 501', price_cents: 1500, currency: 'USD', url: 'https://www.facebook.com/marketplace/item/demo',
  via: 'apify', actor: 'apify~facebook-marketplace-scraper', may_model: false, use_scope: 'hackathon_demo' } as const;

test('a not-routed source never takes a pace slot that delays a following runnable eBay read', async () => {
  _reset();
  const source = { ...ebay(), pace: { per_minute: 60, min_gap_ms: 1000 } };
  for (let i = 0; i < 2; i++) {
    const at = performance.now();
    const result = await searchSource(source, 'unrouted', 'search', { caller: 'person' });
    assert.equal(result.searched.error_code, 'no_route');
    assert.equal(result.searched.reason, 'no live route composed');
    assert.ok(performance.now() - at < 100, 'a not-routed source took a pace slot');
  }
  const { createHarness, fakeAdapter } = await import('../../harness/protocol.ts');
  const at = performance.now();
  await searchSource(source, 'routed', 'search', { caller: 'person', harness: createHarness({ adapters: [{ ...fakeAdapter('ebay', 'search'), run: async () => ({ ok: true as const, data: [] }) }] }), routed: () => true });
  assert.ok(performance.now() - at < 100, 'an unrouted read moved the eBay pace clock');
  _reset();
});

test('Facebook is person_only, distinct from needs_ask, and a background caller never reaches Apify', async () => {
  const { sourcesFor } = await import('./sources.ts');
  assert.equal(facebook().lane, 'apify'); assert.equal(facebook().on, true);
  assert.equal(facebook().person_only, true); assert.equal(facebook().needs_ask, false);
  assert.ok(!sourcesFor('background').includes(facebook()));
  let calls = 0;
  const apify = { search: async () => { calls++; return { ok: true as const, data: { rows: [apifyRow], dropped: 0, total: 1 } }; } };
  for (const caller of [undefined, 'background'] as const) {
    const result = await searchSource(facebook(), 'levi 501', 'search', { caller, visitor_id: 'background', apify });
    assert.equal(result.searched.outcome, 'blocked');
  }
  assert.equal(calls, 0, 'Facebook reached by a background caller');
});

test('Apify without a composed token route returns no_route immediately; rows keep may_model and use_scope', async () => {
  const at = performance.now();
  const missing = await searchSource(facebook(), 'levi 501', 'search', { caller: 'person', visitor_id: 'missing' });
  assert.equal(missing.searched.error_code, 'no_route');
  assert.equal(missing.searched.cost_usd_est, 0);
  assert.ok(performance.now() - at < 100);
  const calls: unknown[] = [];
  const apify: NonNullable<import('./search.ts').SearchOpts['apify']> = { search: async (lane, args) => {
    calls.push([lane, args]); return { ok: true, data: { rows: [apifyRow], dropped: 0, total: 1 } };
  } };
  const result = await searchSource(facebook(), 'levi 501', 'search', { caller: 'person', visitor_id: 'terms', apify });
  assert.deepEqual(result.rows, [apifyRow], 'Apify rows lost their terms or provenance');
  assert.equal(result.searched.cost_usd_est, 0.005);
  assert.equal(result.searched.route_id, 'apify.facebook.search');
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as [string, { city: string }])[1].city, 'chicago');
});

test('Apify reserves both caps before concurrent calls and keys a person before the visitor id', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2040-01-01T12:00:00Z').getTime() });
  searchParams.declare({ name: 'search_apify_runs_per_person_day', family: 'scalar', prior: 2 });
  searchParams.declare({ name: 'search_apify_runs_per_day', family: 'scalar', prior: 3 });
  t.after(() => {
    searchParams.declare({ name: 'search_apify_runs_per_person_day', family: 'scalar', prior: 10 });
    searchParams.declare({ name: 'search_apify_runs_per_day', family: 'scalar', prior: 200 });
  });
  let calls = 0;
  const apify = { search: async () => { calls++; return { ok: true as const, data: { rows: [], dropped: 0, total: 0 } }; } };
  const results = await Promise.all([0, 1, 2].map(i => searchSource(facebook(), 'cap', 'search', { caller: 'person', person_id: 'same-person', visitor_id: `rotated-${i}`, apify })));
  assert.equal(calls, 2, 'Apify called over the person cap');
  assert.equal(results[2].searched.outcome, 'blocked'); assert.equal(results[2].searched.error_code, 'rate_limited');
  assert.match(results[2].searched.reason!, /search_apify_runs_per_person_day/);
  await searchSource(facebook(), 'cap', 'search', { caller: 'person', visitor_id: 'other-person', apify });
  const global = await searchSource(facebook(), 'cap', 'search', { caller: 'person', visitor_id: 'another-person', apify });
  assert.equal(calls, 3, 'Apify called over the process cap with a rotated visitor');
  assert.equal(global.searched.error_code, 'rate_limited'); assert.match(global.searched.reason!, /search_apify_runs_per_day/);
  t.mock.timers.tick(24 * 60 * 60 * 1000);
  await searchSource(facebook(), 'new day', 'search', { caller: 'person', person_id: 'same-person', apify });
  assert.equal(calls, 4, 'daily counts did not reset at the next UTC day');
});

test('eBay Apify fallback runs only for a person after blocked or no_route, never after hit or empty', async () => {
  const { createHarness, fakeAdapter, fail } = await import('../../harness/protocol.ts');
  let calls = 0;
  const apify: NonNullable<import('./search.ts').SearchOpts['apify']> = { search: async (lane, args) => {
    assert.equal(lane, 'ebay'); assert.equal(args.q, 'fallback'); assert.ok(Number(args.limit) > 0);
    calls++; return { ok: true, data: { rows: [{ ...apifyRow, id: 'ebay:demo', actor: 'automation-lab~ebay-scraper' }], dropped: 0, total: 1 } };
  } };
  for (const code of ['blocked', 'no_route'] as const) {
    const adapter = { ...fakeAdapter('ebay', 'search'), run: async () => fail(code, code, code === 'blocked' ? { do: 'pause_session' as const, site: 'ebay' as const } : { do: 'handoff' as const, url: '' }) };
    const result = await searchSource(ebay(), 'fallback', 'search', { paced: true, caller: 'person', visitor_id: 'fallback', apify, harness: createHarness({ adapters: [adapter] }) });
    assert.equal(result.searched.route_id, 'apify.ebay.search'); assert.equal(result.searched.fallback, 'apify'); assert.equal(result.searched.outcome, 'hit');
  }
  const direct = await searchSource(ebay(), 'fallback', 'search', { caller: 'person', visitor_id: 'fallback', apify });
  assert.equal(direct.searched.fallback, 'apify');
  const before = calls;
  for (const rows of [[], [{ external_id: 'ok', title: 'levi 501', price_cents: 1200, currency: 'USD', url: 'https://www.ebay.com/itm/ok', state: 'active' }]]) {
    const page = await searchSource(ebay(), 'fallback', 'search', { paced: true, caller: 'person', visitor_id: 'fallback', apify, harness: createHarness({ adapters: [{ ...fakeAdapter('ebay', 'search'), run: async () => ({ ok: true as const, data: rows }) }] }) });
    assert.equal(page.searched.outcome, rows.length ? 'hit' : 'empty');
  }
  await searchSource(ebay(), 'fallback', 'search', { caller: 'background', apify });
  assert.equal(calls, before, 'eBay Apify fallback ran after a page-lane hit, empty, or a background read');
});

test('eBay fallback cannot bypass Facebook spend already reserved against the shared person cap', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2040-02-01T12:00:00Z').getTime() });
  searchParams.declare({ name: 'search_apify_runs_per_person_day', family: 'scalar', prior: 1 });
  t.after(() => searchParams.declare({ name: 'search_apify_runs_per_person_day', family: 'scalar', prior: 10 }));
  let calls = 0;
  const apify = { search: async () => { calls++; return { ok: true as const, data: { rows: [], dropped: 0, total: 0 } }; } };
  const opts = { caller: 'person' as const, visitor_id: 'shared-cap', apify };
  const [facebookResult, ebayResult] = await Promise.all([
    searchSource(facebook(), 'cap', 'search', opts), searchSource(ebay(), 'cap', 'search', opts),
  ]);
  assert.equal(facebookResult.searched.outcome, 'empty'); assert.equal(ebayResult.searched.outcome, 'blocked');
  assert.equal(ebayResult.searched.error_code, 'rate_limited'); assert.match(ebayResult.searched.reason!, /search_apify_runs_per_person_day/);
  assert.equal(calls, 1, 'the eBay fallback evaded the person cap');
});
