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
  assert.equal(result.searched.outcome, 'needs_account');
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


test('Dupe is the first MCP source; Depop has no public-page lane and unavailable readers stay off', async () => {
  const { SOURCES } = await import('./sources.ts');
  const dupe = SOURCES[0];
  assert.equal(dupe.id, 'dupe'); assert.equal(dupe.lane, 'mcp');
  assert.equal(dupe.on, true); assert.equal(dupe.needs_ask, false);
  for (const site of ['poshmark', 'depop', 'ebay', 'etsy', 'chairish']) assert.ok(dupe.covers.includes(site));
  assert.equal(SOURCES.find(s => s.id === 'depop')!.lane, 'harness');
  assert.equal(SOURCES.find(s => s.id === 'facebook')!.on, false);
  assert.equal(SOURCES.find(s => s.id === 'facebook')!.reason, 'not built');
  const mercari = await searchSource(SOURCES.find(s => s.id === 'mercari')!, 'jeans', 'search', { caller: 'person' });
  assert.equal(mercari.searched.outcome, 'needs_account');
  assert.equal(mercari.searched.reason, "needs the person's account");
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
