import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runtime, createRuntime, publicRow } from './runtime.ts';
import { memoryStore, type JobRow } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';
import { fileStore } from '../events/file-store.ts';
import { depopAdapters, PATHS } from '../harness/sites/depop/adapter.ts';
import { fakeAdapter, fail, WRITE_VERBS, type Adapter, type CallArgs } from '../harness/protocol.ts';
import { URLS, type PageClient } from '../harness/sites/ebay/adapter.ts';
import type { composeSources } from '../harness/compose.ts';
import { memoryVault } from '../browser/auth.ts';
import { DatabaseSync } from 'node:sqlite';
import { sqliteVault, vault as defaultVault } from '../store/vault.ts';

test('a session linked through one route vault is found by runtime accounts over another database handle', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-route-vault-'));
  const path = join(dir, 'secondhand.db'), first = new DatabaseSync(path), second = new DatabaseSync(path);
  t.after(() => { first.close(); second.close(); rmSync(dir, { recursive: true, force: true }); });
  const key = crypto.getRandomValues(Buffer.alloc(32)), session = { cookies: [], origins: [] };
  const linking = sqliteVault(first, key), reading = sqliteVault(second, key), st = memoryStore();
  st.put('account', { id: 'acc_shared', user_id: 'usr_shared', site: 'depop', token_ref: 'account/shared-route' });
  const r = createRuntime(st, log(), { vault: reading });
  assert.deepEqual(await r.accounts.linked('usr_shared'), []);
  await linking.put('account/shared-route', session);
  assert.deepEqual(await r.accounts.linked('usr_shared'), [{ account_id: 'acc_shared', person_id: 'usr_shared', site: 'depop', token_ref: 'account/shared-route' }]);
  await linking.delete('account/shared-route');
  assert.deepEqual(await r.accounts.linked('usr_shared'), []);
});

test('runtime defaults to the shared SQLite vault so recreated runtimes retain linked sessions', async t => {
  const ref = `account/${crypto.randomUUID()}`, st = memoryStore();
  t.after(async () => { await defaultVault().delete(ref); });
  const first = createRuntime(st, log());
  st.put('account', { id: 'acc_default', user_id: 'usr_default', site: 'depop', token_ref: ref });
  await first.vault.put(ref, { cookies: [], origins: [] });
  assert.deepEqual(await defaultVault().get(ref), { cookies: [], origins: [] });
  const second = createRuntime(st, log());
  assert.equal((await second.accounts.linked('usr_default'))[0]?.account_id, 'acc_default');
});

test('examples off prevents runtime from seeding rows for the example user', t => {
  const before = process.env.SECONDHAND_EXAMPLES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_EXAMPLES; else process.env.SECONDHAND_EXAMPLES = before; });
  process.env.SECONDHAND_EXAMPLES = '0';
  const st = memoryStore();
  const empty = st.exportUser('usr_8f2k');
  createRuntime(st, log(), { vault: memoryVault() });
  assert.deepEqual(st.exportUser('usr_8f2k'), empty);
  assert.deepEqual(st.decisions({ user_id: 'usr_8f2k' }), []);
  assert.deepEqual(st.events({ user_id: 'usr_8f2k' }), []);
});

test('examples on seeds the example user and preserves existing rows as before', t => {
  const before = process.env.SECONDHAND_EXAMPLES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_EXAMPLES; else process.env.SECONDHAND_EXAMPLES = before; });
  process.env.SECONDHAND_EXAMPLES = '1';
  const st = memoryStore();
  createRuntime(st, log(), { vault: memoryVault() });
  assert.ok(st.get('account', 'usr_8f2k', 'acc_dp1'));
  assert.ok(st.rows('item', { user_id: 'usr_8f2k' }).length > 0);
  const beforeSeed = st.exportUser('usr_8f2k');
  createRuntime(st, log(), { vault: memoryVault() });
  assert.deepEqual(st.exportUser('usr_8f2k'), beforeSeed);
});

for (const site of ['depop', 'ebay'] as const) test(`${site} reads without publicClients stay no_route even when SECONDHAND_LIVE_SITES enables writes`, async t => {
  const before = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = before; });
  process.env.SECONDHAND_LIVE_SITES = 'depop,ebay';
  const network = t.mock.method(globalThis, 'fetch', async () => { assert.fail('a site read reached plain fetch without publicClients'); });
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  const result = await r.harness.call(site, 'search', { q: 'levis 501 jeans' });
  assert.equal(network.mock.callCount(), 0);
  assert.ok(!result.ok && result.error.code === 'no_route', JSON.stringify(result));
  if (site === 'ebay') assert.equal(result.meta.route_id, 'ebay.search.page');
  const { runtimePorts } = await import('../intel/public/search.ts');
  assert.equal(runtimePorts.routed(site), false);
});

test('Mercari linked browser names SECONDHAND_CHROME when that variable is unset', async t => {
  const before = { SECONDHAND_LIVE_SITES: process.env.SECONDHAND_LIVE_SITES, SECONDHAND_CHROME: process.env.SECONDHAND_CHROME, SECONDHAND_CHROME_PATH: process.env.SECONDHAND_CHROME_PATH };
  t.after(() => { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  process.env.SECONDHAND_LIVE_SITES = 'mercari';
  delete process.env.SECONDHAND_CHROME;
  delete process.env.SECONDHAND_CHROME_PATH;
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), adapters: [] });
  r.store.put('account', { id: 'acc_mc', user_id: 'owner', site: 'mercari', token_ref: 'fixture/mercari' });
  await r.vault.put('fixture/mercari', { cookies: [], origins: [] });
  const result = await r.harness.call('mercari', 'search', { q: 'jeans', account_id: 'acc_mc', person_id: 'owner' });
  assert.ok(!result.ok);
  assert.match(result.error.message, /needs SECONDHAND_CHROME for its linked browser/);
});

test('re-evaluating runtime.ts reuses the cached composed sources across two imports', async () => {
  const shared = globalThis as typeof globalThis & { __secondhandSources?: ReturnType<typeof composeSources> };
  const sources = shared.__secondhandSources;
  assert.ok(sources, 'runtime did not cache composeSources on globalThis');
  await import(new URL('./runtime.ts?source-cache-first', import.meta.url).href);
  assert.equal(shared.__secondhandSources, sources);
  await import(new URL('./runtime.ts?source-cache-second', import.meta.url).href);
  assert.equal(shared.__secondhandSources, sources);
});

test('runtime.close closes composed sources exactly once when called twice', async t => {
  const shared = globalThis as typeof globalThis & { __secondhandSources?: ReturnType<typeof composeSources> };
  assert.ok(shared.__secondhandSources, 'runtime did not compose sources');
  const close = t.mock.method(shared.__secondhandSources, 'close', async () => {});
  await Promise.all([runtime.close(), runtime.close()]);
  assert.equal(close.mock.callCount(), 1);
});

test('runtime.close does not call shared composed browser cleanup through both publicClients and sources', async t => {
  const shared = globalThis as typeof globalThis & { __secondhandSources?: ReturnType<typeof composeSources> };
  const previous = shared.__secondhandSources;
  t.after(() => { shared.__secondhandSources = previous; });
  let closes = 0;
  const close = async () => { closes++; };
  shared.__secondhandSources = { close, publicClients: {
    close,
    depop: { signed_in: false, doc: async () => { assert.fail('unexpected Depop read'); }, json: async () => { assert.fail('unexpected Depop read'); } },
    ebay: { signed_in: false, page: async () => { assert.fail('unexpected eBay read'); } },
  } };
  const { runtime: composed } = await import(new URL('./runtime.ts?shared-browser-cleanup', import.meta.url).href);
  await Promise.all([composed.close(), composed.close()]);
  assert.equal(closes, 1);
});

test('offline eBay search tries endpoint then page, both no_route, without network', async t => {
  const before = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = before; });
  process.env.SECONDHAND_LIVE_SITES = 'depop';
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline eBay must not fetch'); });
  const sink = memorySink();
  const r = createRuntime(memoryStore(), createLog({ src: 'test', build: 'test', sink }), { vault: memoryVault() });
  const result = await r.harness.call('ebay', 'search', { q: 'levis 501 jeans' });
  assert.ok(!result.ok && result.error.code === 'no_route');
  assert.equal(result.meta.route_id, 'ebay.search.page', 'offline page route must remain registered');
  assert.equal(result.meta.fell_back, true);
  assert.match(sink.text(), /ebay.search.endpoint/);
  assert.match(sink.text(), /ebay.search.page/);
  assert.equal((sink.text().match(/"code":"no_route"/g) ?? []).length, 2, 'each route must log no_route');
  assert.equal(network.mock.callCount(), 0);
});

test('offline eBay does not use a planted page client', async t => {
  const before = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = before; });
  process.env.SECONDHAND_LIVE_SITES = '';
  let loads = 0;
  const ebayPageClient: PageClient = { signed_in: false, async page() { loads++; throw new Error('offline eBay must not load pages'); } };
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), ebayPageClient });
  const result = await r.harness.call('ebay', 'search', { q: 'levis 501 jeans' });
  assert.ok(!result.ok && result.error.code === 'no_route');
  assert.equal(loads, 0);
});

test('eBay publicClients falls from the keyless endpoint to the planted page client through its site service', async t => {
  const before = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = before; });
  process.env.SECONDHAND_LIVE_SITES = 'depop,ebay';
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('planted eBay client must own page reads'); });
  const seen: string[] = [];
  const ebayPageClient: PageClient = { signed_in: false, async page(url, signal) {
    assert.equal(signal.aborted, false);
    seen.push(url);
    const fixture = url === URLS.search('levis 501 jeans', false) ? 'page-search.html' : url === URLS.store('seller_a') ? 'page-store.html' : undefined;
    assert.ok(fixture, 'unexpected page URL');
    return { status: 200, html: readFileSync(new URL(`../harness/sites/ebay/fixtures/${fixture}`, import.meta.url), 'utf8') };
  } };
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), publicClients: {
    ebay: ebayPageClient,
    depop: { signed_in: false, doc: async () => { assert.fail('unexpected Depop read'); }, json: async () => { assert.fail('unexpected Depop read'); } },
    close: async () => {},
  } });
  const search = await r.harness.call<Record<string, unknown>[]>('ebay', 'search', { q: 'levis 501 jeans' });
  assert.ok(search.ok, JSON.stringify(search));
  assert.equal(search.data.length, 3);
  assert.equal(search.data[0].price_cents, 3900);
  assert.equal(search.meta.route_id, 'ebay.search.page');
  assert.equal(search.meta.fell_back, true, 'keyless endpoint must run before the page route');
  const storefront = await r.harness.call('ebay', 'read_storefront', { username: 'seller_a' });
  assert.ok(storefront.ok, JSON.stringify(storefront));
  assert.equal(storefront.meta.route_id, 'ebay.read_storefront.page');
  assert.equal(storefront.meta.fell_back, true);
  const sold = await r.harness.call('ebay', 'search', { q: 'levis 501 jeans', status: 'sold' });
  assert.ok(!sold.ok && sold.error.code === 'auth_expired' && sold.error.hint.do === 'relink');
  assert.equal(sold.meta.route_id, 'ebay.search.page');
  assert.deepEqual(seen, [URLS.search('levis 501 jeans', false), URLS.store('seller_a')]);
  assert.equal(network.mock.callCount(), 0);
});

test('watcher sweeps only the linked Depop account through site adapters and saves its baseline', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-watch-runtime-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'store.json'), st = fileStore(path);
  const calls: string[] = [];
  const products = JSON.parse(readFileSync(new URL('../harness/sites/depop/fixtures/products.json', import.meta.url), 'utf8'));
  const adapters = depopAdapters({ signed_in: true, async doc() { throw new Error('unexpected document read'); }, async json(path) {
    calls.push(path);
    return { status: 200, body: path === PATHS.products('fixture-shop') ? products : { objects: [] } };
  } });
  const other = fakeAdapter('ebay', 'read_listings');
  other.run = async () => { throw new Error('unlinked eBay account must not be swept'); };
  st.put('account', { id: 'acc_linked', user_id: 'usr_watch', site: 'depop', token_ref: 'fixture/session', shop_id: 'fixture-shop', next_check_at: '2020-01-01T00:00:00Z' });
  st.put('account', { id: 'acc_unlinked', user_id: 'usr_watch', site: 'ebay', next_check_at: '2020-01-01T00:00:00Z' });
  st.put('listing', { id: 'ls_watch', user_id: 'usr_watch', item_id: 'it_watch', account_id: 'acc_linked', site: 'depop', external_id: '999002396', state: 'live', data: 'live:depop' });
  const r = createRuntime(st, log(), { vault: memoryVault(), adapters: [...adapters, other] });
  await r.vault.put('fixture/session', { cookies: [], origins: [] });
  assert.deepEqual((await r.watcher.tick()).ran, ['acc_linked']);
  assert.deepEqual(calls, [PATHS.products('fixture-shop'), PATHS.sold('fixture-shop'), PATHS.offers, PATHS.inbox, PATHS.orders]);
  const saved = fileStore(path).get('account', 'usr_watch', 'acc_linked')!;
  assert.equal((saved.watch_snapshot as { listings: { external_id: string }[] }).listings[0].external_id, '999002396');
  assert.equal(st.get('account', 'usr_watch', 'acc_unlinked')?.watch_snapshot, undefined);
  assert.equal('watch_snapshot' in publicRow(saved), false, 'private sweep data stays out of route responses');
  const reopened = fileStore(path);
  reopened.put('account', { ...saved, next_check_at: '2020-01-01T00:00:00Z' });
  products.objects[0].pricing.current_price.price_breakdown.price.amount = '80.00';
  const restarted = createRuntime(reopened, log(), { vault: memoryVault(), adapters });
  await restarted.vault.put('fixture/session', { cookies: [], origins: [] });
  await restarted.watcher.tick();
  assert.ok(reopened.events({ user_id: 'usr_watch' }).some(event => event.action === 'price.changed' && event.item_id === 'it_watch' && event.listing_id === 'ls_watch'), 'restart must diff against the saved baseline and resolve the stored listing');
  await r.vault.delete('fixture/session');
  calls.length = 0;
  await r.watcher.tick();
  assert.deepEqual(calls, [], 'removing vault state stops further sweeps');
});

test('runtime writes use the durable site ledger, dedupe across restart, and keep the account gate first', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-runtime-ledger-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'store.json');
  let writes = 0;
  const adapter: Adapter = { ...fakeAdapter('depop', 'end'), async run() { writes++; return { ok: true, data: { ended: true } }; } };
  const r = createRuntime(fileStore(path), log(), { vault: memoryVault(), adapters: [adapter] });
  const a = r.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  r.store.put('account', { ...a, token_ref: 'fixture/session' });
  const args = { account_id: a.id, person_id: 'usr_8f2k', operation_id: 'op-once', slug: 'fixture-listing' };
  assert.equal((await r.harness.call('depop', 'end', args)).ok, false);
  assert.equal(r.store.systemRows('operation').length, 0);
  await r.vault.put('fixture/session', { cookies: [], origins: [] });
  assert.equal((await r.harness.call('depop', 'end', { ...args, user_id: 'usr_wrong' })).ok, false);
  const first = await r.harness.call('depop', 'end', args);
  assert.equal(first.ok, true);
  await r.harness.call('depop', 'end', args);
  const restarted = createRuntime(fileStore(path), log(), { vault: memoryVault(), adapters: [adapter] });
  await restarted.vault.put('fixture/session', { cookies: [], origins: [] });
  assert.equal((await restarted.harness.call('depop', 'end', args)).ok, true);
  assert.equal(writes, 1, 'duplicate operation must never reach the adapter');
  const rows = restarted.store.systemRows('operation');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].data, 'synthetic');
  assert.equal(rows[0].user_id, a.user_id);
  restarted.store.beginOperation({ id: 'op-interrupted', user_id: a.user_id, site: 'depop', verb: 'end', data: 'synthetic', at: new Date().toISOString() });
  const unknown = await restarted.harness.call('depop', 'end', { ...args, operation_id: 'op-interrupted' });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) assert.equal(unknown.error.hint.do, 'reconcile');
  assert.equal(writes, 1);
});

test('site services label writes live only for the enabled site', async t => {
  const before = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = before; });
  process.env.SECONDHAND_LIVE_SITES = 'depop';
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), adapters: [fakeAdapter('depop', 'end'), fakeAdapter('ebay', 'end')] });
  for (const [site, id] of [['depop', 'acc_dp1'], ['ebay', 'acc_eb1']] as const) {
    const a = r.store.get('account', 'usr_8f2k', id)!;
    r.store.put('account', { ...a, token_ref: `fixture/${site}` });
    await r.vault.put(`fixture/${site}`, { cookies: [], origins: [] });
    await r.harness.call(site, 'end', { account_id: id, person_id: 'usr_8f2k', operation_id: `op-${site}` });
    assert.equal(r.store.get('operation', a.user_id, `op-${site}`)?.data, site === 'depop' ? 'live:depop' : 'synthetic');
  }
});

for (const liveSites of [undefined, '', 'depop']) test(`write guard enforces the per-site live list (${liveSites ?? 'unset'}) for every write verb`, async t => {
  const before = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (before === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = before; });
  if (liveSites === undefined) delete process.env.SECONDHAND_LIVE_SITES;
  else process.env.SECONDHAND_LIVE_SITES = liveSites;
  const seen = new Map<string, CallArgs>();
  const adapters: Adapter[] = (['depop', 'poshmark'] as const).flatMap(site => [...WRITE_VERBS, 'search' as const].map(verb => ({
    ...fakeAdapter(site, verb), async run(args) {
      seen.set(`${site}:${verb}:${args.operation_id ?? 'read'}`, args);
      return { ok: true as const, data: {} };
    },
  })));
  const sink = memorySink();
  const r = createRuntime(memoryStore(), createLog({ src: 'test', build: 'test', sink }), { vault: memoryVault(), adapters });
  for (const site of ['depop', 'poshmark'] as const) {
    const account_id = `acc_guard_${site}`;
    r.store.put('account', { id: account_id, user_id: 'usr_guard', site, token_ref: `fixture/${site}` });
    await r.vault.put(`fixture/${site}`, { cookies: [], origins: [] });
    for (const verb of WRITE_VERBS) for (const dry of [false, true, undefined]) {
      const args = Object.freeze({ account_id, person_id: 'usr_guard', operation_id: `guard-${site}-${verb}-${dry}`, ...(dry !== undefined && { dry }) });
      const result = await r.harness.call(site, verb, args);
      assert.ok(result.ok, JSON.stringify(result));
      const received = seen.get(`${site}:${verb}:${args.operation_id}`)!;
      assert.equal(received.dry, liveSites === site ? dry : true, `${site}.${verb} must respect its own live permission`);
      assert.equal(args.dry, dry, 'the guard must not mutate caller arguments');
    }
    assert.ok((await r.harness.call(site, 'search', { dry: false })).ok);
    assert.equal(seen.get(`${site}:search:read`)?.dry, false, 'reads must keep their arguments');
  }
  const forced = sink.text().trim().split('\n').map(line => JSON.parse(line)).filter(line => line.msg === 'marketplace write forced dry');
  assert.equal(forced.length, WRITE_VERBS.length * 3 * (liveSites === 'depop' ? 1 : 2), 'each forced write must log exactly once');
  for (const line of forced) {
    assert.ok(line.site === 'poshmark' || liveSites !== 'depop' && line.site === 'depop');
    assert.ok(WRITE_VERBS.includes(line.verb));
    assert.ok(String(line.operation_id).startsWith(`guard-${line.site}-${line.verb}-`));
  }
});

for (const setting of ['auto', 'ask_all', 'ask_every_time', 'stricter_rule', 'counter_without_model', 'below_floor_without_model']) test(`watcher respects ${setting} before a ledger write`, async () => {
  let now = Date.parse('2026-11-15T12:00:00Z'), offers = false;
  const products = JSON.parse(readFileSync(new URL('../harness/sites/depop/fixtures/products.json', import.meta.url), 'utf8'));
  const offer = JSON.parse(readFileSync(new URL('../harness/sites/depop/fixtures/offers.json', import.meta.url), 'utf8')).objects[0];
  const adapters = depopAdapters({ signed_in: true, async doc() { throw new Error('unexpected document read'); }, async json(path) {
    const body = path === PATHS.products('fixture-shop') ? products : path === PATHS.offers && offers
      ? { objects: [{ ...offer, product_id: 999002396, amount: { amount: setting === 'counter_without_model' ? '62.00' : setting === 'below_floor_without_model' ? '45.00' : '75.00' }, created_at: new Date(now).toISOString(), status: 'pending' }] } : { objects: [] };
    return { status: 200, body };
  } });
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), adapters, now: () => now });
  r.store.put('account', { id: 'acc_offer', user_id: 'usr_offer', site: 'depop', token_ref: 'fixture/offer', shop_id: 'fixture-shop', next_check_at: new Date(now).toISOString() });
  r.store.put('listing', { id: 'ls_offer', user_id: 'usr_offer', item_id: 'it_offer', account_id: 'acc_offer', site: 'depop', external_id: '999002396', state: 'live' });
  r.store.put('limits', { id: 'it_offer', user_id: 'usr_offer', ask_cents: { amount_cents: 8000, currency: 'USD' }, floor_cents: { amount_cents: 5000, currency: 'USD' }, always_accept_cents: { amount_cents: 7000, currency: 'USD' } });
  if (setting === 'ask_all') r.store.put('limits', { ...r.store.get('limits', 'usr_offer', 'it_offer')!, accept_mode: 'ask_all' });
  if (setting === 'ask_every_time') r.store.put('limits', { id: 'usr_offer', user_id: 'usr_offer', ask_every_time: true });
  if (setting === 'stricter_rule') r.store.put('rule', { id: 'ru_offer', user_id: 'usr_offer', kind: 'accept_offer', state: 'auto', scope: 'it_offer', limits: { always_accept_cents: { amount_cents: 7900, currency: 'USD' } } });
  await r.vault.put('fixture/offer', { cookies: [], origins: [] });
  await r.watcher.tick();
  offers = true; now += 3600000;
  await r.watcher.tick();
  const job = r.store.jobs().find(job => job.kind === 'answer_offer');
  assert.ok(job, 'an observed offer must create a job');
  if (setting !== 'auto') {
    assert.equal(r.store.systemRows('operation').length, 0, setting + ' must ask before writing');
    const decisions = r.store.decisions({ user_id: 'usr_offer', state: 'open' });
    assert.ok(decisions.length > 0);
    const why = 'No acceptance model weighed this; the counter is the midpoint inside your limits.';
    if (setting === 'stricter_rule') {
      assert.equal(decisions[0].kind, 'accept_offer', 'the stricter item rule turns an otherwise automatic acceptance into a person decision');
      assert.notEqual(decisions[0].why, why, 'the acceptance decision must keep its own reason');
      assert.equal(job.args.response, 'accept');
    } else if (setting.endsWith('_without_model')) {
      assert.equal(decisions[0].kind, setting === 'below_floor_without_model' ? 'price_below_floor' : 'counter_offer');
      assert.equal(decisions[0].why, why, 'a midpoint counter must disclose that no acceptance model weighed it');
      assert.equal(job.args.response, 'counter');
      assert.ok(Number(job.args.price_cents) >= 5000 && Number(job.args.price_cents) < 8000);
    } else assert.ok(decisions.every(decision => decision.why !== why), 'other approval requests must keep their own reason');
    return;
  }
  assert.equal(job.args.decided_by, 'negotiation');
  assert.equal(job.args.response, 'accept');
  assert.equal(job.state, 'done');
  const operation = r.store.get('operation', 'usr_offer', `${job.id}:answer_offer`);
  assert.equal(operation?.state, 'done', 'watcher writes must use the runtime ledger');
});

test('watcher leaves API import jobs for the runtime worker that owns their engine', async () => {
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  const job = r.store.insertJob({ user_id: 'usr_8f2k', event_id: 'api-import', kind: 'import' as JobRow['kind'], state: 'queued', account_id: 'acc_dp1', site: 'depop', idempotency_key: 'api-import', args: { listing_ids: [] }, stages: [], attempts: 0, trace_id: 'test', created_at: new Date().toISOString() }).row;
  await r.watcher.tick();
  assert.equal(r.store.getJob(job.id)?.state, 'queued');
  assert.equal(r.store.getJob(job.id)?.attempts, 0);
  await r.pipeline.runOnce(1);
  assert.equal(r.store.getJob(job.id)?.state, 'done');
});

test('route worker leaves sale confirmation to the watcher and can still claim its own job', async () => {
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  const at = new Date().toISOString();
  const event = r.store.insertEvent({ user_id: 'usr_8f2k', source: 'watcher_signed_in', action: 'listing.sold', actor: 'site', dedupe_key: 'sale', observed_at: at, effective_at: at, trace_id: 'test' }).row;
  const queued = { user_id: event.user_id, event_id: event.id, account_id: 'acc_dp1', site: 'depop' as const, state: 'queued' as const, args: {}, stages: [], attempts: 0, trace_id: 'test', created_at: at };
  const sale = r.store.insertJob({ ...queued, kind: 'poll_orders', idempotency_key: 'sale' }).row;
  const own = r.store.insertJob({ ...queued, event_id: 'api-import', kind: 'import' as JobRow['kind'], args: { listing_ids: [] }, idempotency_key: 'import' }).row;
  assert.equal(await r.pipeline.runOnce(1), 1);
  assert.equal(r.store.getJob(sale.id)?.state, 'queued', 'route worker must not turn confirmation into a bare read');
  assert.equal(r.store.getJob(sale.id)?.attempts, 0);
  assert.equal(r.store.getJob(own.id)?.state, 'done', 'watcher jobs must not starve route work');
});

test('runtime preserves the site service fallback route and observation ids', async () => {
  const first = fakeAdapter('depop', 'search'), second = fakeAdapter('depop', 'search');
  first.route_id = 'first'; first.run = async () => fail('page_changed', 'fixture moved', { do: 'author', missing: ['fixture'] });
  second.route_id = 'second'; second.run = async () => ({ ok: true, data: [], observation_ids: ['obs-second'] });
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), adapters: [first, second] });
  const result = await r.harness.call('depop', 'search');
  assert.equal(result.meta.route_id, 'second');
  assert.equal(result.meta.fell_back, true);
  assert.deepEqual(result.meta.observation_ids, ['obs-second']);
});

test('composed watcher confirms a sale and ends the other stored listing through its site service', async () => {
  let now = Date.parse('2026-11-15T12:00:00Z'), sold = false, ended = false;
  const adapters: Adapter[] = (['depop', 'ebay'] as const).flatMap(site =>
    (['read_listings', 'read_offers', 'read_inbox', 'read_orders', 'end'] as const).map(verb => ({
      ...fakeAdapter(site, verb), async run() {
        if (verb === 'end') { assert.equal(site, 'ebay'); ended = true; return { ok: true as const, data: { ended: true } }; }
        if (verb === 'read_listings') return { ok: true as const, data: [{ external_id: 'ext_' + site, price_cents: 7500, state: site === 'depop' && sold ? 'sold' : site === 'ebay' && ended ? 'ended' : 'live' }] };
        if (verb === 'read_orders' && site === 'depop' && sold) return { ok: true as const, data: [{ external_order_id: 'order_fixture', listing_external_id: 'ext_depop', state: 'paid', price_cents: 7500 }] };
        return { ok: true as const, data: [] };
      },
    })));
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), adapters, now: () => now });
  for (const site of ['depop', 'ebay'] as const) {
    r.store.put('account', { id: 'sale_' + site, user_id: 'usr_sale', site, token_ref: 'fixture/' + site, next_check_at: new Date(now).toISOString() });
    await r.vault.put('fixture/' + site, { cookies: [], origins: [] });
    r.store.put('listing', { id: 'ls_' + site, user_id: 'usr_sale', item_id: 'it_sale', site, account_id: 'sale_' + site, external_id: 'ext_' + site, state: 'live' });
  }
  r.store.put('limits', { id: 'it_sale', user_id: 'usr_sale', ask_cents: 8000, floor_cents: 5000, always_accept_cents: 7000 });
  await r.watcher.tick();
  sold = true; now += 3600000;
  await r.watcher.tick();
  assert.equal(ended, true, 'confirmed sale must drain its delist fan-out in the same tick');
  const delist = r.store.jobs({ kind: 'delist' });
  assert.equal(delist.length, 1);
  assert.equal(delist[0].listing_id, 'ls_ebay');
  assert.equal(delist[0].state, 'done');
  assert.equal(r.store.get('operation', 'usr_sale', `${delist[0].id}:end`)?.state, 'done');
});

process.env.SECONDHAND_LIVE_SITES = '';

const log = () => createLog({ src: 'test', build: 'test', sink: memorySink() });
test('composed watcher relinks an expired account and resumes it', async () => {
  const now = Date.parse('2026-11-15T12:00:00Z');
  let expired = true;
  const adapters: Adapter[] = (['read_listings', 'read_offers', 'read_inbox', 'read_orders'] as const).map(verb => ({
    ...fakeAdapter('depop', verb), async run() {
      return expired ? fail('auth_expired', 'fixture expiry', { do: 'relink', site: 'depop' }) : { ok: true as const, data: [] };
    },
  }));
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), adapters, now: () => now });
  r.store.put('account', { id: 'acc_watch', user_id: 'usr_watch', site: 'depop', token_ref: 'fixture/watch', next_check_at: new Date(now).toISOString() });
  await r.vault.put('fixture/watch', { cookies: [], origins: [] });
  await r.watcher.tick();
  assert.equal(r.store.decisions({ user_id: 'usr_watch', subject: 'acc_watch', kind: 'relink', state: 'open' }).length, 1, 'expired sign-in raises one relink decision');
  assert.equal(r.store.get('account', 'usr_watch', 'acc_watch')?.paused, 'auth_expired');
  expired = false;
  await r.watcher.relinked('acc_watch');
  assert.equal(r.store.decisions({ user_id: 'usr_watch', subject: 'acc_watch', kind: 'relink', state: 'open' }).length, 0, 'relink clears the decision');
  assert.equal(r.store.get('account', 'usr_watch', 'acc_watch')?.paused, null, 'relink resumes the account');
  assert.deepEqual((await r.watcher.tick()).ran, ['acc_watch']);
  await r.watcher.cleared('acc_watch');
  assert.deepEqual((await r.watcher.tick()).ran, ['acc_watch'], 'cleared resolves the account and schedules an immediate sweep');
});

test('system accounts are supplied only to the watcher', () => {
  const source = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');
  const uses = source.split('\n').filter(line => /\bsystemAccounts\b/.test(line)).map(line => line.trim());
  assert.equal(uses.length, 2, 'system accounts must occur only at their declaration and watcher injection');
  assert.match(uses[0], /^const systemAccounts\b/);
  assert.match(uses[1], /^const watcher = createWatcher\(\{.*\baccounts: systemAccounts\b/);
});

test('account lookup and harness gate enforce the asking person', async () => {
  const adapter = fakeAdapter('depop', 'search');
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), adapters: [adapter] });
  r.store.put('account', { id: 'acc_owner', user_id: 'owner', site: 'depop', token_ref: 'fixture/owner' });
  await r.vault.put('fixture/owner', { cookies: [], origins: [] });
  assert.equal(await r.accounts.byId('acc_owner', 'other'), undefined, 'another person cannot look up the account');
  assert.equal(await r.accounts.byId('acc_owner'), undefined, 'lookup requires a person');
  assert.equal((await r.accounts.byId('acc_owner', 'owner'))?.person_id, 'owner');
  for (const args of [{ account_id: 'acc_owner', person_id: 'other' }, { account_id: 'acc_owner' }]) {
    const result = await r.harness.call('depop', 'search', args);
    assert.ok(!result.ok && result.error.code === 'policy_refused', 'gate refuses another person or a missing person');
  }
  assert.equal((await r.harness.call('depop', 'search', { account_id: 'acc_owner', person_id: 'owner' })).ok, true);
});

test('runtime shares the route Store and never links a row without vault state', async () => {
  const { store } = await import('./store.ts');
  assert.equal(runtime.store, store);
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  assert.equal(await r.accounts.byId('acc_dp1'), undefined);
  const a = r.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  r.store.put('account', { ...a, token_ref: 'test/session' });
  assert.equal(await r.accounts.byId(a.id, 'usr_8f2k'), undefined);
  await r.vault.put('test/session', { cookies: [], origins: [] });
  assert.equal((await r.accounts.byId(a.id, 'usr_8f2k'))?.account_id, a.id);
  await r.vault.delete('test/session');
  assert.equal(await r.accounts.byId(a.id, 'usr_8f2k'), undefined);
});

test('unlinked account is policy_refused before any adapter runs; offline reads are no_route', async () => {
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  const reply = await r.harness.call('depop', 'read_listings', { account_id: 'acc_dp1', shop_id: 'test' });
  assert.equal(reply.ok, false);
  if (!reply.ok) { assert.equal(reply.error.code, 'policy_refused'); assert.equal(reply.meta.route_id, 'none'); }
  const read = await r.harness.call('depop', 'search', { q: 'test' });
  assert.equal(read.ok, false);
  if (!read.ok) assert.equal(read.error.code, 'no_route');
});

test('pipeline Depop write returns a dry plan and current limits override stale job arguments', async () => {
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  const account = r.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  r.store.put('account', { ...account, token_ref: 'test/session' });
  await r.vault.put('test/session', { cookies: [], origins: [] });
  const enqueue = (key: string, price: number) => {
    const event = r.store.insertEvent({ user_id: 'usr_8f2k', source: 'app', action: 'app.reprice', actor: 'auto', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', dedupe_key: key, observed_at: new Date().toISOString(), effective_at: new Date().toISOString(), trace_id: key }).row;
    return r.store.insertJob({ user_id: event.user_id, event_id: event.id, kind: 'post', state: 'queued', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', idempotency_key: key, args: { slug: 'test-listing', listing: { price_amount: price / 100 }, price_cents: price, floor_cents: 1 }, stages: [], attempts: 0, trace_id: key, created_at: event.observed_at }).row;
  };
  const first = enqueue('dry-write', 8000);
  await r.pipeline.runOnce(1);
  const planned = r.store.getJob(first.id)!;
  assert.equal(planned.state, 'done');
  assert.equal(planned.stages.find(stage => stage.name === 'revise')?.state, 'planned');
  assert.equal((planned.result as { planned: boolean }).planned, true);
  assert.equal(((planned.result as { plan: { dry: boolean } }).plan).dry, true);
  const second = enqueue('new-floor', 8000);
  const limits = r.store.get('limits', 'usr_8f2k', 'it_7c2m')!;
  r.store.put('limits', { ...limits, floor_cents: { amount_cents: 8500, currency: 'USD' } });
  await r.pipeline.runOnce(1);
  assert.ok((r.store.getJob(second.id)?.result as { refused: string }).refused);
  assert.ok(!r.store.getJob(second.id)?.stages.some(s => s.name === 'revise'));
});

test('limits and rules survive a child-process restart without example reseeding overwriting them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-runtime-'));
  const prelude = `
    import assert from 'node:assert/strict';
    import { runtime } from './app/src/edge/api/runtime.ts';
    import { handlers } from './app/src/edge/api/rules.ts';
    import { deps, route } from './app/src/edge/api/http.ts';
    import { createLog, memorySink } from './log/index.js';
    deps.verify = async () => 'usr_8f2k';
    deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
    const call = async (endpoint, body) => {
      const [method, path] = endpoint.split(' ');
      const res = await route(endpoint, handlers[endpoint])(new Request('http://test'+path, { method, headers: { Authorization: 'Bearer test' }, ...(body ? { body: JSON.stringify(body) } : {}) }));
      assert.ok(res.status < 300, await res.clone().text());
      return res.json();
    };
  `;
  const run = (source: string) => {
    const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', prelude + source], { cwd: process.cwd(), env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr + child.stdout);
  };
  try {
    run(`const before = await call('GET /v1/limits'); await call('PUT /v1/limits', { version: before.version, ask_every_time: true, items: [{ item_id: 'it_7c2m', floor_cents: { amount_cents: 8100, currency: 'USD' } }] }); const rule = await call('POST /v1/rules', { kind: 'reply_other', scope: 'all' }); assert.equal(rule.kind, 'reply_other');`);
    run(`const limits = await call('GET /v1/limits'); assert.equal(limits.ask_every_time, true); assert.equal(limits.items[0].floor_cents.amount_cents, 8100); const rules = await call('GET /v1/rules'); assert.ok(rules.data.some(r => r.kind === 'reply_other')); assert.equal(runtime.store.rows('item', { user_id: 'usr_8f2k' }).filter(r => r.id === 'it_7c2m').length, 1);`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('current thresholds, rule conditions and ask_all refuse queued automatic acceptance', async () => {
  for (const [threshold, mode, rule] of [[null, 'auto', false], [{ amount_cents: 7500, currency: 'USD' }, 'ask_all', false], [null, 'auto', true]] as const) {
    const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
    const account = r.store.get('account', 'usr_8f2k', 'acc_dp1')!;
    r.store.put('account', { ...account, token_ref: 'test/session' });
    await r.vault.put('test/session', { cookies: [], origins: [] });
    const limits = r.store.get('limits', 'usr_8f2k', 'it_7c2m')!;
    r.store.put('limits', { ...limits, always_accept_cents: threshold, accept_mode: mode });
    if (rule) r.store.put('rule', { id: 'ru_accept', user_id: 'usr_8f2k', kind: 'accept_offer', scope: 'it_7c2m', state: 'auto', limits: { always_accept_cents: { amount_cents: 9000, currency: 'USD' } } });
    const job = r.store.insertJob({ kind: 'answer_offer', user_id: 'usr_8f2k', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', event_id: 'test', idempotency_key: mode, args: { decision_kind: 'accept_offer', response: 'accept', offer_id: 'test-offer', price_cents: 8000, always_accept_cents: 7500 }, state: 'queued', stages: [], attempts: 0, trace_id: 'test', created_at: new Date().toISOString() }).row;
    await r.pipeline.runOnce(1);
    assert.ok((r.store.getJob(job.id)?.result as { refused: string }).refused, mode);
    assert.equal(r.store.getJob(job.id)?.stages.length, 0, mode);
  }
});

test('turning markdown off refuses an automatic reprice that was already queued', async () => {
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  const limits = r.store.get('limits', 'usr_8f2k', 'it_7c2m')!;
  r.store.put('limits', { ...limits, markdown_on: false });
  const event = r.store.insertEvent({ user_id: 'usr_8f2k', source: 'app', action: 'app.reprice', actor: 'auto', site: 'depop', account_id: 'acc_dp1', item_id: 'it_7c2m', dedupe_key: 'no-markdown', observed_at: new Date().toISOString(), effective_at: new Date().toISOString(), trace_id: 'test' }).row;
  const job = r.store.insertJob({ kind: 'post', user_id: event.user_id, event_id: event.id, idempotency_key: event.dedupe_key, account_id: event.account_id, item_id: event.item_id, site: 'depop', state: 'queued', args: { price_cents: 8000, slug: 'test', listing: { price_amount: 80 } }, stages: [], attempts: 0, trace_id: 'test', created_at: event.observed_at }).row;
  await r.pipeline.runOnce(1);
  assert.equal(r.store.getJob(job.id)?.stages.length, 0);
  const refusal = (r.store.getJob(job.id)?.result as { refused: string }).refused;
  assert.equal(r.store.decisions({ user_id: 'usr_8f2k' }).find(row => row.id === refusal)?.kind, 'markdown');
});

test('runtime harness logs conform to the shared log contract', async () => {
  const sink = memorySink();
  const logger = createLog({ src: 'test.runtime', build: 'test', sink });
  const r = createRuntime(memoryStore(), logger, { vault: memoryVault() });
  await r.harness.call('depop', 'search', { q: 'test' });
  logger.end();
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-runtime-log-'));
  try {
    const file = join(dir, 'proof.jsonl');
    writeFileSync(file, sink.text());
    const result = spawnSync(process.execPath, ['spec/log.mjs', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('system account discovery finds every tenant after restart without route registration', async t => {
  const { fileStore } = await import('../events/file-store.ts');
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-linked-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'store.json'), st = fileStore(path);
  for (const user_id of ['usr_new', 'usr_another']) st.put('account', { id: 'acc_' + user_id, user_id, site: 'depop', token_ref: 'test/' + user_id });
  st.put('account', { id: 'acc_missing', user_id: 'usr_new', site: 'depop', token_ref: 'test/missing' });
  st.put('account', { id: 'acc_deleted', user_id: 'usr_new', site: 'depop', token_ref: 'test/usr_new', deleted: true });
  const r = createRuntime(fileStore(path), log(), { vault: memoryVault() });
  for (const user_id of ['usr_new', 'usr_another']) await r.vault.put('test/' + user_id, { cookies: [], origins: [] });
  assert.deepEqual((await r.accounts.linked()).map(row => row.person_id).sort(), ['usr_another', 'usr_new']);
  assert.deepEqual((await r.accounts.linked('usr_new')).map(row => row.account_id), ['acc_usr_new']);
});

test('route modules never call the system cross-tenant read', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const root = join(process.cwd(), 'app/src/edge/api');
  for (const file of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!file.isFile() || !/\.[cm]?[jt]s$/.test(file.name) || file.name.endsWith('.test.ts') || file.name === 'runtime.ts') continue;
    const path = join(file.parentPath, file.name);
    assert.doesNotMatch(readFileSync(path, 'utf8'), /\bsystemRows\s*(?:<[^>]*>)?\s*\(/, path);
  }
});

test('all seeded product rows keep example provenance through reseeding', () => {
  const st = memoryStore(), r = createRuntime(st, log(), { vault: memoryVault() });
  for (const table of ['item', 'listing', 'account', 'limits', 'rule'] as const) {
    for (const row of st.rows(table, { user_id: 'usr_8f2k' })) assert.equal(row.data, 'example', table + ':' + row.id);
  }
  assert.ok(st.decisions().every(row => row.data === 'example'), 'seeded decisions carry example provenance');
  createRuntime(r.store, log(), { vault: memoryVault() });
  assert.equal(st.get('account', 'usr_8f2k', 'acc_dp1')?.data, 'example');
});

test('Mercari sold reads are registered but make no network call with live sites off', async () => {
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  r.store.put('account', { id: 'acc_mc', user_id: 'owner', site: 'mercari', token_ref: 'mercari-test' });
  await r.vault.put('mercari-test', { cookies: [], origins: [] });
  const fetchBefore = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; throw new Error('unexpected network'); };
  try {
    const result = await r.harness.call('mercari', 'search', { q: 'carhartt hoodie', status: 'sold', account_id: 'acc_mc', person_id: 'owner' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error.message, /live reads are (disabled|unavailable)/);
    assert.equal(fetches, 0);
  } finally { globalThis.fetch = fetchBefore; }
});

test('runtime composes search harness, accounts and explicit unrouted sites; no token means no Apify port', async t => {
  const { ports } = await import('./search.ts'); const previous = { ...ports };
  t.after(() => Object.assign(ports, previous));
  const liveSites = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (liveSites === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = liveSites; });
  process.env.SECONDHAND_LIVE_SITES = '';
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  assert.equal(ports.harness, r.harness); assert.equal(ports.accounts, r.accounts);
  assert.equal(ports.routed('depop'), false); assert.equal(ports.routed('ebay'), false);
  assert.equal(ports.apify, undefined, 'Apify was composed with no passed token');
  createRuntime(memoryStore(), log(), { vault: memoryVault(), apifyToken: 'fixture-token' });
  assert.ok(ports.apify, 'a passed token did not compose the Apify lane');
});

test('public clients route anonymous Depop and eBay reads with no live write site; runtime close closes them once', async t => {
  const { ports } = await import('./search.ts'); const previous = { ...ports };
  t.after(() => Object.assign(ports, previous));
  const liveSites = process.env.SECONDHAND_LIVE_SITES;
  t.after(() => { if (liveSites === undefined) delete process.env.SECONDHAND_LIVE_SITES; else process.env.SECONDHAND_LIVE_SITES = liveSites; });
  process.env.SECONDHAND_LIVE_SITES = '';
  let depopReads = 0, ebayReads = 0, closes = 0;
  const publicClients = {
    depop: { signed_in: false, doc: async () => { depopReads++; return { status: 200, html: readFileSync(new URL('../harness/sites/depop/fixtures/search.html', import.meta.url), 'utf8') }; },
      json: async () => { assert.fail('public Depop search should read its page'); } },
    ebay: { signed_in: false, page: async () => { ebayReads++; return { status: 200, html: readFileSync(new URL('../harness/sites/ebay/fixtures/page-search.html', import.meta.url), 'utf8') }; } },
    close: async () => { closes++; },
  };
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault(), publicClients });
  assert.equal(ports.routed('depop'), true); assert.equal(ports.routed('ebay'), true);
  for (const site of ['depop', 'ebay'] as const) {
    const result = await r.harness.call(site, 'search', { q: 'levis 501 jeans' }); assert.ok(result.ok, JSON.stringify(result));
  }
  assert.equal(depopReads, 1); assert.equal(ebayReads, 1);
  for (const [site, id] of [['depop', 'acc_dp1'], ['ebay', 'acc_eb1']] as const) {
    const account = r.store.get('account', 'usr_8f2k', id)!;
    r.store.put('account', { ...account, token_ref: `fixture/${site}` }); await r.vault.put(`fixture/${site}`, { cookies: [], origins: [] });
    const result = await r.harness.call<{ dry: boolean }>(site, 'end', { account_id: id, person_id: 'usr_8f2k', external_id: '123456789012', offer_id: 'offer-demo', slug: 'seller-item', operation_id: `public-${site}`, dry: false });
    assert.ok(result.ok, JSON.stringify(result)); assert.equal(result.data.dry, true, 'public reads enabled a live write');
  }
  assert.equal(depopReads, 1, 'a write reached Depop through the public client'); assert.equal(ebayReads, 1, 'a write reached eBay through the public client');
  await Promise.all([r.close(), r.close()]); await r.close();
  assert.equal(closes, 1, 'runtime close did not close the public client exactly once');
});


test('the watcher uses the runtime system account lookup with the owner scope when account ids overlap', async t => {
  const r = createRuntime(memoryStore(), log(), { vault: memoryVault() });
  for (const user_id of ['first', 'second']) {
    r.store.put('account', { id: 'shared', user_id, site: 'depop', token_ref: 'fixture/' + user_id, paused: 'blocked' });
    await r.vault.put('fixture/' + user_id, { cookies: [], origins: [] });
  }
  const linked = t.mock.method(r.accounts, 'linked');
  await r.watcher.cleared('shared');
  assert.deepEqual(linked.mock.calls.map(call => call.arguments), [[], ['first']], 'system byId must pass the person to linked');
  assert.equal(r.store.get('account', 'first', 'shared')?.paused, null);
  assert.equal(r.store.get('account', 'second', 'shared')?.paused, 'blocked');
});

test('seeded example rows are unreadable after examples are disabled, including copied foreign example data', async t => {
  const { owned, seedExamples } = await import('./runtime.ts');
  const { deps, route } = await import('./http.ts');
  const env = process.env.SECONDHAND_EXAMPLES, saved = runtime.store;
  t.after(() => { runtime.store = saved; if (env === undefined) delete process.env.SECONDHAND_EXAMPLES; else process.env.SECONDHAND_EXAMPLES = env; });
  const st = memoryStore(); seedExamples(st); runtime.store = st;
  st.put('item', { id: 'it_copy', user_id: 'usr_other', data: 'example' });
  deps.verify = async token => token;
  deps.log = log();
  const read = route('GET /v1/items/:id', ctx => ({ status: 200, body: owned('item', ctx, ctx.params.id) }));
  assert.equal((await read(new Request('http://test/v1/items/it_copy', { headers: { Authorization: 'Bearer usr_other' } }))).status, 404);
  process.env.SECONDHAND_EXAMPLES = '0';
  assert.equal((await read(new Request('http://test/v1/items/it_7c2m', { headers: { Authorization: 'Bearer usr_8f2k' } }))).status, 404);
});
