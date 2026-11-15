import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { searchAll, searchSite, searchSource, memoryApifyRuns } from './search.ts';
import { SOURCES } from './sources.ts';
import { createHarness, fakeAdapter } from '../../harness/protocol.ts';
import type { PageResult } from '../fetch.ts';
import { _reset, runPlan, searchParams } from '../run.ts';

const fixture = readFileSync(new URL('../../../../../spec/fixtures/pages/poshmark.html', import.meta.url), 'utf8');
const page = (html: string, status = 200): PageResult => ({ ok: true, html, status, final_url: '', rung: 'plain', ms: 0, searched: [] });

test('one site uses the same reader and counts as searchAll, with exactly one fetch', async () => {
  let calls = 0;
  const opts = { sources: SOURCES.filter(s => s.id === 'poshmark'), sites: ['poshmark'] as const, now: () => 0, fetchPage: async () => { calls++; return page(fixture); } };
  const one = await searchSite('poshmark', 'levi 501', 'search', opts);
  assert.equal(calls, 1);
  assert.deepEqual(await searchAll('levi 501', opts), { results: one.rows.map(row => ({ site: 'poshmark', row: { ...row, may_store: true } })), searched: [{ ...one.searched, pace: opts.sources[0].pace }] });
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
  const result = await searchSource(source, 'x', 'sold', { caller: 'background', harness: createHarness({ adapters: [fakeAdapter('ebay', 'search')] }) });
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

test('the shared Dupe slot spends its 3 second gap once inside the job deadline', async t => {
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
  const ask = (query: string) => runPlan({ kind: 'listings_matching', slots: {}, protocol_version: 1, first_ms: 10, settled_ms: 4000,
    targets: [{ target_id: query, query, freshness_s: 0, deadline_ms: 4000, routes: [{
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
  const mercari = await searchSource(SOURCES.find(s => s.id === 'mercari')!, 'jeans', 'search', { caller: 'person', harness: createHarness({ adapters: [fakeAdapter('mercari', 'search')] }) });
  assert.equal(mercari.searched.outcome, 'needs_account');
  assert.equal(mercari.searched.reason, 'needs your account');
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
  const result = await searchSource(facebook(), 'levi 501', 'search', { caller: 'person', person_id: 'terms', apify, apifyRuns: memoryApifyRuns() });
  assert.deepEqual(result.rows, [{ ...apifyRow, may_store: true }], 'Apify rows lost their terms or provenance');
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
  const apifyRuns = memoryApifyRuns();
  const results = await Promise.all([0, 1, 2].map(i => searchSource(facebook(), 'cap', 'search', { caller: 'person', person_id: 'same-person', visitor_id: `rotated-${i}`, apify, apifyRuns })));
  assert.equal(calls, 2, 'Apify called over the person cap');
  assert.equal(results[2].searched.outcome, 'blocked'); assert.equal(results[2].searched.error_code, 'rate_limited');
  assert.match(results[2].searched.reason!, /search_apify_runs_per_person_day/);
  await searchSource(facebook(), 'cap', 'search', { caller: 'person', person_id: 'other-person', apify, apifyRuns });
  const global = await searchSource(facebook(), 'cap', 'search', { caller: 'person', person_id: 'another-person', apify, apifyRuns });
  assert.equal(calls, 3, 'Apify called over the daily cap across people');
  assert.equal(global.searched.error_code, 'rate_limited'); assert.match(global.searched.reason!, /search_apify_runs_per_day/);
  t.mock.timers.tick(24 * 60 * 60 * 1000);
  await searchSource(facebook(), 'new day', 'search', { caller: 'person', person_id: 'same-person', apify, apifyRuns });
  assert.equal(calls, 4, 'daily counts did not reset at the next UTC day');
});

test('eBay never falls back to Apify after blocked, no_route, hit or empty', async () => {
  const { createHarness, fakeAdapter, fail } = await import('../../harness/protocol.ts');
  let calls = 0;
  const apify: NonNullable<import('./search.ts').SearchOpts['apify']> = { search: async (lane, args) => {
    assert.equal(lane, 'ebay'); assert.equal(args.q, 'fallback'); assert.ok(Number(args.limit) > 0);
    calls++; return { ok: true, data: { rows: [{ ...apifyRow, id: 'ebay:demo', actor: 'automation-lab~ebay-scraper' }], dropped: 0, total: 1 } };
  } };
  for (const code of ['blocked', 'no_route'] as const) {
    const adapter = { ...fakeAdapter('ebay', 'search'), run: async () => fail(code, code, code === 'blocked' ? { do: 'pause_session' as const, site: 'ebay' as const } : { do: 'handoff' as const, url: '' }) };
    const result = await searchSource(ebay(), 'fallback', 'search', { paced: true, caller: 'person', visitor_id: 'fallback', apify, harness: createHarness({ adapters: [adapter] }) });
    assert.equal(result.searched.fallback, undefined); assert.equal(result.searched.error_code, code);
  }
  const direct = await searchSource(ebay(), 'fallback', 'search', { caller: 'person', visitor_id: 'fallback', apify });
  assert.equal(direct.searched.error_code, 'no_route'); assert.equal(direct.searched.fallback, undefined);
  assert.equal(calls, 0, 'eBay fallback called Apify');
  const before = calls;
  for (const rows of [[], [{ external_id: 'ok', title: 'levi 501', price_cents: 1200, currency: 'USD', url: 'https://www.ebay.com/itm/ok', state: 'active' }]]) {
    const page = await searchSource(ebay(), 'fallback', 'search', { paced: true, caller: 'person', visitor_id: 'fallback', apify, harness: createHarness({ adapters: [{ ...fakeAdapter('ebay', 'search'), run: async () => ({ ok: true as const, data: rows }) }] }) });
    assert.equal(page.searched.outcome, rows.length ? 'hit' : 'empty');
  }
  await searchSource(ebay(), 'fallback', 'search', { caller: 'background', apify });
  assert.equal(calls, before, 'eBay Apify fallback ran after a page-lane hit, empty, or a background read');
});

test('a visitor id never reserves Apify spend, even if a caller claims to be a person', async () => {
  let reservations = 0, calls = 0;
  const result = await searchSource(facebook(), 'visitor', 'search', { caller: 'person', visitor_id: 'rotated',
    apifyRuns: { reserve: async () => { reservations++; return { ok: true }; } },
    apify: { search: async () => { calls++; return { ok: true, data: { rows: [], dropped: 0, total: 0 } }; } },
  });
  assert.equal(reservations, 0); assert.equal(calls, 0); assert.equal(result.searched.outcome, 'blocked');
});

test('Apify requires a reservation port and honors a durable reservation refusal across reader restarts', async () => {
  let calls = 0;
  const apify = { search: async () => { calls++; return { ok: true as const, data: { rows: [], dropped: 0, total: 0 } }; } };
  const missing = await searchSource(facebook(), 'no port', 'search', { caller: 'person', person_id: 'person', apify });
  assert.equal(missing.searched.error_code, 'no_route'); assert.equal(calls, 0);
  const reservations: [string, string][] = [];
  const apifyRuns = { reserve: async (person: string, day: string) => {
    reservations.push([person, day]); return { ok: false as const, cap: 'search_apify_runs_per_day' };
  } };
  for (let i = 0; i < 2; i++) {
    _reset();
    const restarted = await searchSource(facebook(), 'restart', 'search', { caller: 'person', person_id: 'person', apify, apifyRuns });
    assert.equal(restarted.searched.error_code, 'rate_limited');
    assert.equal(restarted.searched.reason, 'search_apify_runs_per_day');
  }
  assert.equal(calls, 0); assert.deepEqual(reservations, Array.from({ length: 2 }, () => ['person', new Date().toISOString().slice(0, 10)]));
});

test('SV2 source rights are required data and override a Dupe row claiming it may be stored', async () => {
  const source = SOURCES.find(s => s.id === 'dupe')!;
  const keep_until = '2040-01-01T00:00:00.000Z';
  const result = await searchSource(source, 'rights', 'search', { paced: true, dupe: { search: async () => ({ ok: true, data: {
    rows: [{ id: 'rights', title: 'chair', price_cents: 1000, currency: 'USD', url: 'https://example.test/item',
      source_site: 'ebay', secondhand: true, commercial_link: true, attribution: 'Dupe.com', keep_until, may_store: true }],
    dropped: 0, total: 1, keep_until,
  } }) } });
  for (const source of SOURCES) assert.equal(typeof source.rights.may_store, 'boolean', source.id);
  assert.equal(result.rows[0].may_store, false);
  assert.equal(result.rows[0].keep_until, keep_until);
});

test('SR4 source signals reach both page and harness read boundaries', async () => {
  const controller = new AbortController();
  const { createHarness, fakeAdapter } = await import('../../harness/protocol.ts');
  const harness = createHarness({ adapters: [{ ...fakeAdapter('ebay', 'search'), run: async () => ({ ok: true, data: [] }) }] });
  const call = harness.call;
  harness.call = (site, verb, args, options) => { assert.equal(options?.signal, controller.signal); assert.equal(args?.signal, undefined); return call(site, verb, args, options); };
  await searchSource(SOURCES.find(s => s.id === 'ebay')!, 'signal', 'search', { paced: true, harness, signal: controller.signal });
  await searchSource(SOURCES.find(s => s.id === 'poshmark')!, 'signal', 'search', { paced: true, signal: controller.signal,
    fetchPage: async (_url, options) => { assert.equal((options as typeof options & { signal?: AbortSignal }).signal, controller.signal); return page('No results'); } });
});

test('SR4 the default public-page transport actually aborts its fetch when the source is cancelled', async t => {
  const controller = new AbortController();
  let observed: AbortSignal | undefined;
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  t.mock.method(globalThis, 'fetch', (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    observed = init?.signal ?? undefined; entered();
    return new Promise<Response>((_resolve, reject) => {
      observed?.addEventListener('abort', () => reject(new Error('fixture fetch aborted')), { once: true });
    });
  });
  const reading = searchSite('poshmark', 'abort', 'search', { signal: controller.signal, deadline_ms: 100 });
  await started; controller.abort();
  assert.equal(observed?.aborted, true, 'the source signal stopped at the fetch boundary');
  assert.equal((await reading).searched.outcome, 'timeout');
});

test('Google Shopping is a public osint source; no token means no_route before any pace wait', async () => {
  _reset();
  const source = SOURCES.find(s => s.id === 'google_shopping')!;
  assert.ok(source); assert.equal(source.group, 'osint'); assert.equal(source.lane, 'treg');
  assert.deepEqual(source.covers, ['google_shopping']); assert.deepEqual(source.rights, { may_store: false, may_model: false });
  assert.deepEqual(source.pace, { per_minute: 30, min_gap_ms: 1000 });
  const start = performance.now();
  for (let i = 0; i < 3; i++) {
    const r = await searchSource(source, 'x', 'search', { caller: 'background', fetchPage: async () => assert.fail('unrouted fetch') });
    assert.equal(r.searched.error_code, 'no_route'); assert.equal(r.searched.ms, 0);
  }
  assert.ok(performance.now() - start < 100, 'unrouted Shopping used a pace slot');
});

test('Google Shopping cap failure is blocked, abort is timeout, and sold never calls the adapter', async () => {
  const source = SOURCES.find(s => s.id === 'google_shopping')!;
  const { createShopping } = await import('../../harness/sites/google_shopping/adapter.ts');
  const { createLog, memorySink } = await import('../../../../../log/index.js');
  const { memoryShoppingSpend } = await import('./search.ts');
  const log = createLog({ src: 'test.shopping', build: 'test', sink: memorySink() });
  const capped = createShopping({ token: 'synthetic', log, spend: { reserve: async () => ({ ok: false, cap: 'search_shopping_usd_per_day' }) }, fetch: async () => assert.fail('over cap fetched') });
  const result = await searchSource(source, 'x', 'search', { shopping: capped, paced: true });
  assert.equal(result.searched.outcome, 'blocked'); assert.equal(result.searched.error_code, 'rate_limited'); assert.equal(result.searched.reason, 'search_shopping_usd_per_day');
  const controller = new AbortController(); let aborted = false;
  const shopping = createShopping({ token: 'synthetic', log, spend: memoryShoppingSpend(), fetch: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('synthetic abort')); }, { once: true });
  }) });
  const pending = searchSource(source, 'x', 'search', { shopping, paced: true, signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  const timeout = await pending; assert.equal(aborted, true); assert.equal(timeout.searched.outcome, 'timeout'); assert.equal(timeout.searched.error_code, 'timed_out');
  const sold = await searchSource(source, 'x', 'sold', { paced: true, shopping: { search: async () => assert.fail('Shopping is not sold prices') } });
  assert.equal(sold.searched.outcome, 'blocked');
});
