import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createLog } from '../../../../log/index.js';
import { memoryStore, memoryLeases } from '../events/ports.ts';
import { memoryProfileRegistry, storeProfileRegistry, type ProfileRow } from '../browser/auth.ts';
import { createPool } from '../browser/pool.ts';
import { browserUseCloud, cdpLauncher, registryProfileFor, type CdpPw } from '../browser/cdp.ts';
import { SessionClientError, sessionClient, type SessionPage, type SessionResponse } from './session-client.ts';
import { poshmarkAdapters } from './sites/poshmark/adapter.ts';
import { createHarness } from './protocol.ts';
import { mercariAdapters } from './sites/mercari/adapter.ts';

const owner = { user_id: 'person_a', account_id: 'account_a' };
const row = (site: ProfileRow['site'] = 'poshmark'): ProfileRow => ({ ...owner, site, profile_id: 'profile_a', state: 'linked', linked_at: '2026-11-15T00:00:00.000Z', last_ok_at: null, data: 'synthetic' });
const fixture = (site: string, name: string): unknown => JSON.parse(readFileSync(new URL(`./sites/${site}/fixtures/${name}`, import.meta.url), 'utf8'));
const signal = () => new AbortController().signal;
function setup(site: ProfileRow['site'] = 'poshmark') {
  const registry = memoryProfileRegistry();
  const creates: Record<string, unknown>[] = [], logs: unknown[] = [], deleted: string[] = [];
  let profiles = 0;
  let refuseStop = false;
  let stops = 0, closedPages = 0, routes = 0, imports = 0, exports = 0, clicks = 0, contentReads = 0, evaluations = 0;
  const visits: string[] = [];
  let finalUrl: string | undefined, status = 200;
  let html = '<html>Account</html>', url = '', body: unknown = fixture('poshmark', 'inbox.json');
  const listeners = new Set<(response: SessionResponse) => void>();
  const page: SessionPage = {
    async goto(next) { visits.push(next); url = next; for (const f of listeners) f({ url: () => 'https://www.mercari.com/v1/api?operationName=conversationsQuery', status: () => 200, text: async () => JSON.stringify(body), request: () => ({ postData: () => null }) }); return { status: () => status, text: async () => { contentReads++; return html; } }; },
    url: () => url, content: async () => { contentReads++; return html; },
    async evaluate<T, A>(fn: (a: A) => T | Promise<T>, arg: A): Promise<T> {
      evaluations++;
      if (arg && typeof arg === 'object') return runInNewContext(`(${fn.toString()})(input)`, {
        input: arg, document: { documentElement: { outerHTML: html }, querySelector: () => ({ click() { clicks++; } }) },
      }) as T;
      return { status: 200, body, url, html: '' } as T;
    },
    async route() { routes++; }, on(_event, fn) { listeners.add(fn); }, off(_event, fn) { listeners.delete(fn); },
    async waitForLoadState() { if (finalUrl !== undefined) url = finalUrl; }, async close() { closedPages++; },
  };
  const pw: CdpPw<SessionPage> = { chromium: { async connectOverCDP() { return {
    contexts: () => [{ pages: () => [], newPage: async () => page, addCookies: async () => { imports++; }, addInitScript: async () => { imports++; }, storageState: async () => { exports++; return { cookies: [], origins: [] }; }, close: async () => {} }],
    newContext: async () => { throw new Error('unexpected new context'); }, close: async () => {}, on() {},
  }; } } };
  const source = browserUseCloud({ apiKey: 'fake', profileFor: registryProfileFor(registry), fetchFn: async (_input, init) => {
    if (init?.method === 'PATCH') { stops++; return new Response('{}', { status: refuseStop ? 503 : 200 }); }
    creates.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({ id: 'browser_a', cdpUrl: 'https://cdp.invalid', liveUrl: 'https://viewer.invalid/private' }));
  } });
  const launcher = cdpLauncher(pw, source), leases = memoryLeases();
  const log = createLog({ src: 'session.test', build: 'test', sink: line => { logs.push(JSON.parse(line)); } });
  const pool = createPool({ launcher, registry, profileRoot: '/unused', leases, log });
  const options = { pool, registry, launcher, profileRoot: '/unused', leases, log, ttlMs: 60_000, createProfile: async () => { profiles++; return 'profile_new'; }, deleteProfile: async (id: string) => { deleted.push(id); } };
  const service = scanErrors(sessionClient(options));
  return { registry, pool, service, newService: (overrides: Partial<Parameters<typeof sessionClient>[0]>) => scanErrors(sessionClient({ ...options, ...overrides })), creates, logs, deleted, page, site, visits, counts: () => ({ stops, closedPages, routes, imports, exports, profiles, clicks, contentReads, evaluations }),
    setNavigation: (next: string, responseStatus = 200) => { finalUrl = next; status = responseStatus; },
    refuseStop: () => { refuseStop = true; }, setHtml: (value: string) => { html = value; }, setBody: (value: unknown) => { body = value; } };
}

test('Store registry survives restart, refuses other owners on reads and writes, and copies rows', async () => {
  const store = memoryStore(), registry = storeProfileRegistry(store);
  await registry.put(owner.user_id, row());
  const restarted = storeProfileRegistry(store);
  assert.equal((await restarted.get(owner.user_id, owner.account_id))?.profile_id, 'profile_a');
  await assert.rejects(restarted.get('person_b', owner.account_id), /owner/);
  await assert.rejects(restarted.put('person_b', { ...row(), user_id: 'person_b' }), /owner/);
  await assert.rejects(restarted.put(owner.user_id, { ...row(), user_id: 'person_b' }), /owner/);
  const copy = await restarted.get(owner.user_id, owner.account_id); copy!.profile_id = 'changed';
  assert.equal((await restarted.get(owner.user_id, owner.account_id))?.profile_id, 'profile_a');
});

test('two signed-in verbs share one cloud profile browser and never import or export storage', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  try {
    const c = await f.service.clientFor('poshmark', owner); assert.equal(c.signed_in, true);
    const ads = poshmarkAdapters(c);
    assert.equal((await ads.find(a => a.manifest.verb === 'read_inbox')!.run({}, signal())).ok, true);
    f.setBody(fixture('poshmark', 'orders.json'));
    assert.equal((await ads.find(a => a.manifest.verb === 'read_orders')!.run({}, signal())).ok, true);
    assert.equal(f.creates.length, 1); assert.equal(f.creates[0].profileId, 'profile_a'); assert.equal(f.creates[0].solveCaptchas, false);
    assert.equal(f.counts().imports, 0); assert.equal(f.counts().exports, 0); assert.equal(f.pool.stats().leased, 0);
  } finally { await f.pool.close(); }
  assert.equal(f.counts().stops, 1);
});

test('unlinked reads relink without launching; another person cannot get a client or start a link', async () => {
  const f = setup();
  const c = await f.service.clientFor('poshmark', owner); assert.equal(c.signed_in, false);
  const result = await poshmarkAdapters(c).find(a => a.manifest.verb === 'read_inbox')!.run({}, signal());
  assert.ok(!result.ok && result.error.code === 'auth_expired' && result.error.hint.do === 'relink');
  await f.registry.put(owner.user_id, row());
  const other = { ...owner, user_id: 'person_b' };
  await assert.rejects(f.service.clientFor('poshmark', other), /owner/);
  await assert.rejects(f.service.startLink('poshmark', other), /owner/);
  assert.equal(f.creates.length, 0);
});

for (const [html, state, code, action] of [
  ['<form><input type="password"></form>', 'needs_signin', 'auth_expired', 'relink'],
  ['<title>Just a moment...</title>', 'paused', 'blocked', 'pause_session'],
] as const) test(`${code} mid-read updates the registry and releases the lease`, async () => {
  const f = setup(); await f.registry.put(owner.user_id, row()); f.setHtml(html);
  const c = await f.service.clientFor('poshmark', owner);
  const result = await poshmarkAdapters(c).find(a => a.manifest.verb === 'read_inbox')!.run({}, signal());
  assert.ok(!result.ok && result.error.code === code && result.error.hint.do === action);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, state);
  assert.equal(c.signed_in, false); assert.equal(f.pool.stats().leased, 0); assert.equal(f.counts().closedPages, 1);
  await f.pool.close();
});

test('Mercari captures page responses without request interception', async () => {
  const f = setup('mercari'); await f.registry.put(owner.user_id, row('mercari')); f.setBody((fixture('mercari', 'inbox.json') as { api: { body: unknown }[] }).api[0].body);
  const c = await f.service.clientFor('mercari', owner);
  assert.equal((await mercariAdapters(c).find(a => a.manifest.verb === 'read_inbox')!.run({}, signal())).ok, true);
  assert.equal(f.counts().routes, 0); await f.pool.close();
  const e = setup('ebay'); await e.registry.put(owner.user_id, row('ebay'));
  await (await e.service.clientFor('ebay', owner)).page('https://www.ebay.com/sch/i.html', signal());
  assert.equal(e.counts().routes, 0); await e.pool.close();
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: link handle is owner checked, viewer is reopenable by its owner, finish verifies the account page and stops`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  const handle = await f.service.startLink('poshmark', owner);
  assert.equal(typeof handle, 'string'); assert.ok(!handle.includes('http'));
  assert.equal(await f.service.liveView('person_b', handle), undefined);
  assert.equal(await f.service.finishLink('person_b', handle), undefined);
  assert.equal(await f.service.liveView(owner.user_id, handle), 'https://viewer.invalid/private');
  assert.equal(await f.service.liveView(owner.user_id, handle), 'https://viewer.invalid/private', 'the owner can reopen the page while the link lives');
  assert.equal((await f.service.finishLink(owner.user_id, handle))?.ok, true);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'linked');
  assert.equal(f.counts().stops, 1); assert.equal(f.counts().exports, 0);
  assert.equal(await f.service.finishLink(owner.user_id, handle), undefined);
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: abandoning a link stops the browser and never links; foreign cancellation does nothing`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  const handle = await f.service.startLink('poshmark', owner);
  await f.service.cancelLink('person_b', handle); assert.equal(f.counts().stops, 0);
  await f.service.cancelLink(owner.user_id, handle); assert.equal(f.counts().stops, 1);
  assert.notEqual((await f.registry.get(owner.user_id, owner.account_id))?.state, 'linked');
});

function scanErrors<T extends object>(target: T): T {
  return new Proxy(target, { get(object, key, receiver) {
    const value: unknown = Reflect.get(object, key, receiver);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => Promise.resolve(Reflect.apply(value, object, args)).then(result =>
      result && typeof result === 'object' ? scanErrors(result) : result,
    error => { if (error instanceof SessionClientError) noSecrets(error.message); throw error; });
  } });
}
function noSecrets(value: unknown): void {
  if (typeof value === 'string') assert.doesNotMatch(value, /https?:\/\/|wss?:\/\/|bearer\s|sessionid=|(?:[a-z0-9.-]+|\[[a-f0-9:]+\]):\d+\/\S+|eyJ[a-zA-Z0-9_-]+\./i);
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) {
    assert.doesNotMatch(key, /cookie|token|storage.?state|localstorage|live.?url|authorization|password|cdp|ws_?url|connect/i); noSecrets(v);
  }
}
for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: stored rows and captured logs contain no credentials, storage, or viewer address, including failures`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' }); const handle = await f.service.startLink('poshmark', owner);
  await f.service.finishLink(owner.user_id, handle);
  const store = memoryStore(); await storeProfileRegistry(store).put(owner.user_id, (await f.registry.get(owner.user_id, owner.account_id))!);
  noSecrets(store.dump().rows); noSecrets(f.logs);
  await assert.rejects(f.registry.put(owner.user_id, { ...row(), profile_id: 'https://viewer.invalid/private' }), /profile/);
});

test('a cached client rechecks revoked registry state before creating a browser', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  const c = await f.service.clientFor('poshmark', owner);
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  assert.equal((await c.json('/vm-rest/users/self/inbox', signal())).status, 401);
  assert.equal(c.signed_in, false); assert.equal(f.creates.length, 0);
});

test('pool rejects an unscoped or foreign profile dispatch before launch', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  for (const user_id of [undefined, 'person_b']) {
    const result = await f.pool.dispatch({ user_id, account_id: owner.account_id, site: 'poshmark', job_id: 'foreign', run: async () => 'bad' });
    assert.equal(result.ok, false);
  }
  assert.equal(f.creates.length, 0);
});

test('profile id cannot be shared by two accounts even for one person', async () => {
  const registry = memoryProfileRegistry(); await registry.put(owner.user_id, row());
  await assert.rejects(registry.put(owner.user_id, { ...row(), account_id: 'account_b' }), /profile/);
});

test('Mercari HTTP-200 GraphQL authentication error moves registry to needs_signin', async () => {
  const f = setup('mercari'); await f.registry.put(owner.user_id, row('mercari'));
  f.setBody({ errors: [{ status: 401 }] });
  const c = await f.service.clientFor('mercari', owner);
  const result = await mercariAdapters(c).find(a => a.manifest.verb === 'read_inbox')!.run({}, signal());
  assert.ok(!result.ok && result.error.code === 'auth_expired');
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin');
  await f.pool.close();
});

test('eBay recorded sign-in page relinks and records expired session rather than a block', async () => {
  const f = setup('ebay'); await f.registry.put(owner.user_id, row('ebay'));
  f.setHtml(readFileSync(new URL('./sites/ebay/fixtures/page-sold-signin.html', import.meta.url), 'utf8'));
  const c = await f.service.clientFor('ebay', owner);
  const { ebayPageAdapters } = await import('./sites/ebay/adapter.ts');
  const result = await ebayPageAdapters(c)[0].run({ q: 'jeans', status: 'sold' }, signal());
  assert.ok(!result.ok && result.error.code === 'auth_expired');
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin');
  assert.equal(f.counts().routes, 0); await f.pool.close();
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: link verification challenge stops the browser and cannot publish linked state`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  const handle = await f.service.startLink('poshmark', owner);
  f.setHtml('<title>Just a moment</title>');
  const result = await f.service.finishLink(owner.user_id, handle);
  assert.ok(result && !result.ok && result.error.code === 'blocked');
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin');
  assert.equal(f.counts().stops, 1);
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: expired handles stop abandoned browsers and are unavailable to their owner`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' }); let now = Date.now();
  const service = f.newService({ now: () => now, ttlMs: 1000 });
  const handle = await service.startLink('poshmark', owner); now += 1001;
  assert.equal(await service.liveView(owner.user_id, handle), undefined);
  assert.equal(await service.finishLink(owner.user_id, handle), undefined);
  assert.equal(f.counts().stops, 1);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin');
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: timer stops a link even if its handle is never used again`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  const service = f.newService({ ttlMs: 10 });
  const handle = await service.startLink('poshmark', owner);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.counts().stops, 1); assert.equal(await service.finishLink(owner.user_id, handle), undefined);
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: a failed sign-in navigation stops the browser, frees the lease, and hides vendor errors`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  f.page.goto = async () => { throw new Error('navigation failed https://viewer.invalid/private?sessionid=synthetic'); };
  await assert.rejects(f.service.startLink('poshmark', owner), /link could not start/);
  assert.equal(f.counts().stops, 1); noSecrets(f.logs);
  await assert.rejects(f.service.startLink('poshmark', owner), /link could not start/);
  assert.equal(f.counts().stops, 2);
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: a failed account-page verification closes the browser and never links`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  const handle = await f.service.startLink('poshmark', owner);
  f.page.evaluate = async () => { throw new Error('https://viewer.invalid/private'); };
  await assert.rejects(f.service.finishLink(owner.user_id, handle), /session.verify failed/);
  assert.equal(f.counts().stops, 1);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin'); noSecrets(f.logs);
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: link setup cannot outlive its lease and then expose a live browser`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' }); let now = 0;
  const service = f.newService({ now: () => now, ttlMs: 1000, createProfile: async () => { now = 1001; return 'profile_new'; } });
  await assert.rejects(service.startLink('poshmark', owner), /link could not start/);
  assert.equal(f.creates.length, 0);
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: completion holds its account lease through account-page verification`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  const evaluate = f.page.evaluate; let blocked = false;
  f.page.evaluate = async (fn, arg) => {
    await assert.rejects(f.service.startLink('poshmark', owner), e => {
      blocked = e instanceof SessionClientError && e.error.code === 'rate_limited'; return blocked;
    });
    return evaluate(fn, arg);
  };
  const handle = await f.service.startLink('poshmark', owner);
  assert.equal((await f.service.finishLink(owner.user_id, handle))?.ok, true); assert.equal(blocked, true);
});

for (const existing of [false, true]) test(`${existing ? 'owned account' : 'unknown account'}: a vendor that refuses stop cannot publish a linked profile`, async () => {
  const f = setup();
  if (!existing) {
    await assert.rejects(f.service.startLink('poshmark', owner), /account/);
    assert.equal(f.counts().profiles, 0); return;
  }
  await f.registry.put(owner.user_id, { ...row(), state: 'needs_signin' });
  const handle = await f.service.startLink('poshmark', owner); f.refuseStop();
  await assert.rejects(f.service.finishLink(owner.user_id, handle), /profile was not saved/);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin');
  assert.equal(f.counts().stops, 2); noSecrets(f.logs);
});

test('aborting an in-page fetch closes its page and releases its lease promptly', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
  f.page.evaluate = async () => { entered(); return new Promise<never>(() => {}); };
  const controller = new AbortController(), c = await f.service.clientFor('poshmark', owner);
  const read = c.json('/vm-rest/users/self/inbox', controller.signal);
  await started; controller.abort();
  await assert.rejects(Promise.race([read, new Promise((_, reject) => setTimeout(() => reject(new Error('read retained lease after abort')), 50))]), e => e instanceof Error && e.name === 'AbortError');
  assert.equal(f.pool.stats().leased, 0); assert.ok(f.counts().closedPages > 0); await f.pool.close();
});

test('a cancelled late response cannot overwrite a replacement profile', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  let entered!: () => void, finish!: (value: unknown) => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  f.page.evaluate = async <T>() => { entered(); return new Promise<T>(resolve => { finish = value => resolve(value as T); }); };
  const c = await f.service.clientFor('poshmark', owner), controller = new AbortController();
  const read = c.json('/vm-rest/users/self/inbox', controller.signal);
  await started; controller.abort(); await assert.rejects(read);
  await f.registry.put(owner.user_id, { ...row(), profile_id: 'replacement' });
  finish({ status: 401, body: null, html: '', url: 'https://poshmark.com/login' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.profile_id, 'replacement');
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'linked');
  await f.pool.close();
});

test('legacy account migration is refused before creating a vendor profile', async () => {
  const f = setup(), store = memoryStore();
  store.put('account', { id: owner.account_id, user_id: owner.user_id, site: 'poshmark', health: 'broken' });
  let created = 0;
  const service = f.newService({ registry: storeProfileRegistry(store), createProfile: async () => { created++; return 'new'; } });
  await assert.rejects(service.startLink('poshmark', owner));
  assert.equal(created, 0); assert.equal(store.get('account', owner.user_id, owner.account_id)?.health, 'broken');
});


test('concurrent verbs report retry_after through the harness, never author or pause', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const evaluate = f.page.evaluate;
  f.page.evaluate = async (fn, arg) => { entered(); await wait; return evaluate(fn, arg); };
  const h = createHarness({ adapters: poshmarkAdapters(await f.service.clientFor('poshmark', owner)) });
  const first = h.call('poshmark', 'read_inbox'); await started;
  try {
    const second = await h.call('poshmark', 'read_orders');
    assert.ok(!second.ok && second.error.code === 'rate_limited' && second.error.hint.do === 'retry_after');
    assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'linked');
  } finally { release(); await first; await f.pool.close(); }
});

for (const site of ['poshmark', 'mercari', 'depop', 'ebay'] as const) test(`${site} default never routes requests`, async () => {
  const f = setup(site); await f.registry.put(owner.user_id, row(site));
  const c = await f.service.clientFor(site, owner), url = `https://${site !== 'poshmark' ? 'www.' : ''}${site}.com/`;
  if ('doc' in c) await c.doc(url, signal()); else await c.page(url, signal());
  assert.equal(f.counts().routes, 0); await f.pool.close();
});

for (const ending of ['cancel', 'expiry', 'failure'] as const) test(`relink ${ending} preserves the entire linked row and profile`, async () => {
  const f = setup(); await f.registry.put(owner.user_id, row()); let now = 0;
  const service = f.newService({ now: () => now });
  const handle = await service.startLink('poshmark', owner);
  assert.deepEqual(await f.registry.get(owner.user_id, owner.account_id), row());
  assert.equal(f.creates[0].profileId, 'profile_new');
  if (ending === 'cancel') await service.cancelLink(owner.user_id, handle);
  if (ending === 'expiry') { now = 60_001; await service.liveView(owner.user_id, handle); }
  if (ending === 'failure') { f.setHtml('<input type="password">'); await service.finishLink(owner.user_id, handle); }
  assert.deepEqual(await f.registry.get(owner.user_id, owner.account_id), row());
  assert.deepEqual(f.deleted, ['profile_new']);
});

test('unknown account is refused before any vendor profile or browser is created', async () => {
  const f = setup();
  await assert.rejects(f.service.startLink('poshmark', owner), /account/);
  assert.equal(f.counts().profiles, 0); assert.equal(f.creates.length, 0);
});

for (const stage of ['launch', 'navigation', 'cancel', 'expiry', 'verification'] as const) test(`unpublished profile is deleted after ${stage}`, async () => {
  const f = setup(); await f.registry.put(owner.user_id, row()); let now = 0;
  const service = f.newService({ now: () => now, ...(stage === 'launch' ? { launcher: {
    persistent: async () => { throw new Error('vendor.invalid:9222/private'); },
    anonymous: async () => { throw new Error('unexpected anonymous launch'); },
  } } : {}) });
  if (stage === 'navigation') f.page.goto = async () => { throw new Error('vendor.invalid:9222/private'); };
  if (stage === 'launch' || stage === 'navigation') await assert.rejects(service.startLink('poshmark', owner));
  else {
    const handle = await service.startLink('poshmark', owner);
    if (stage === 'cancel') await service.cancelLink(owner.user_id, handle);
    if (stage === 'expiry') { now = 60_001; await service.liveView(owner.user_id, handle); }
    if (stage === 'verification') { f.setHtml('<input type="password">'); await service.finishLink(owner.user_id, handle); }
  }
  assert.deepEqual(f.deleted, ['profile_new']);
  assert.deepEqual(await f.registry.get(owner.user_id, owner.account_id), row()); noSecrets(f.logs);
});

test('failed deletion logs only the profile id and releases the lease', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  const service = f.newService({ deleteProfile: async () => { throw new Error('vendor.invalid:9222/private bearer secret'); } });
  const handle = await service.startLink('poshmark', owner); await service.cancelLink(owner.user_id, handle);
  noSecrets(f.logs);
  assert.match(JSON.stringify(f.logs), /profile_new/);
  const next = await f.service.startLink('poshmark', owner); await f.service.cancelLink(owner.user_id, next);
});

for (const site of ['poshmark', 'mercari', 'depop'] as const) for (const empty of [true, false]) test(`${site} ${empty ? 'empty' : 'populated'} inbox does not affect account-page verification`, async () => {
  const f = setup(site); await f.registry.put(owner.user_id, row(site));
  f.setBody(site === 'mercari' ? (empty ? { data: { conversations: { conversationsList: [] } } } : (fixture(site, 'inbox.json') as { api: { body: unknown }[] }).api[0].body) : empty ? (site === 'poshmark' ? { data: [] } : { objects: [] }) : fixture(site, 'inbox.json'));
  const handle = await f.service.startLink(site, owner);
  const result = await f.service.finishLink(owner.user_id, handle);
  assert.ok(result?.ok);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.profile_id, 'profile_new');
  assert.equal(f.counts().evaluations, 1);
  assert.equal(f.counts().contentReads, 0);
});

test('no-secret scan rejects connection key names and bare endpoints', () => {
  for (const key of ['cdp', 'ws_url', 'wsUrl', 'connect']) assert.throws(() => noSecrets({ [key]: 'secret' }));
  for (const value of ['localhost:9222/devtools/browser/secret', '127.0.0.1:9222/private', 'vendor.invalid:443/private']) assert.throws(() => noSecrets(value));
});

test('vendor SessionClientError text is sanitized before logging or escaping', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  const service = f.newService({ createProfile: async () => { throw new SessionClientError({ code: 'blocked', message: 'vendor.invalid:9222/private bearer secret', hint: { do: 'pause_session', site: 'poshmark' } }); } });
  await assert.rejects(service.startLink('poshmark', owner), /link could not start/);
  noSecrets(f.logs);
});

for (const foreign of [false, true]) test(`an already published ${foreign ? 'foreign' : 'own'} profile is never launched or deleted as pending`, async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  if (foreign) await f.registry.put('person_b', { ...row(), user_id: 'person_b', account_id: 'account_b', profile_id: 'profile_b' });
  const service = f.newService({ createProfile: async () => foreign ? 'profile_b' : 'profile_a' });
  await assert.rejects(service.startLink('poshmark', owner), /link could not start/);
  assert.deepEqual(f.deleted, []); assert.equal(f.creates.length, 0);
  assert.deepEqual(await f.registry.get(owner.user_id, owner.account_id), row());
});

test('a pending profile delete cannot retain the account lease', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const service = f.newService({ deleteProfile: async () => { entered(); await pending; } });
  const handle = await service.startLink('poshmark', owner), cancellation = service.cancelLink(owner.user_id, handle);
  await started;
  try {
    const c = await f.service.clientFor('poshmark', owner);
    assert.equal((await c.json('/vm-rest/users/self/inbox', signal())).status, 200);
  } finally { release(); await cancellation; await f.pool.close(); }
});

test('a pre-aborted read stays an AbortError without leaking its reason or launching', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  const c = await f.service.clientFor('poshmark', owner), controller = new AbortController();
  controller.abort(new Error('vendor.invalid:9222/private'));
  await assert.rejects(c.json('/vm-rest/users/self/inbox', controller.signal), e => { assert.ok(e instanceof Error); noSecrets(e.message); return e.name === 'AbortError'; });
  assert.equal(f.creates.length, 0); noSecrets(f.logs);
});

test('relink leaves the previous warm browser available after cancellation', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  const c = await f.service.clientFor('poshmark', owner);
  await c.json('/vm-rest/users/self/inbox', signal());
  const previous = await f.registry.get(owner.user_id, owner.account_id);
  const handle = await f.service.startLink('poshmark', owner);
  assert.equal(f.counts().stops, 0);
  await f.service.cancelLink(owner.user_id, handle);
  assert.deepEqual(await f.registry.get(owner.user_id, owner.account_id), previous);
  await c.json('/vm-rest/users/self/inbox', signal());
  assert.equal(f.creates.length, 2); await f.pool.close();
});

test('pending launch option cannot bypass registry ownership for a published profile', async () => {
  const f = setup(); await f.registry.put(owner.user_id, row());
  await f.registry.put('person_b', { ...row(), user_id: 'person_b', account_id: 'account_b', profile_id: 'profile_b' });
  const resolve = registryProfileFor(f.registry);
  for (const pending_profile_id of ['profile_a', 'profile_b', 'vendor.invalid:9222/private']) {
    await assert.rejects(resolve('/unused', { ...owner, headless: true, pending_profile_id }), /profile/);
  }
  assert.equal(await resolve('/unused', { ...owner, headless: true, pending_profile_id: 'profile_new' }), 'profile_new');
  assert.equal(await resolve('/unused', { ...owner, headless: true }), 'profile_a');
});

test('eBay startLink opens its sign-in page with no interception or solver', async () => {
  const f = setup('ebay'); await f.registry.put(owner.user_id, row('ebay'));
  const handle = await f.service.startLink('ebay', owner);
  assert.deepEqual(f.visits, ['https://signin.ebay.com/']);
  assert.equal(f.creates[0].solveCaptchas, false);
  assert.equal(f.counts().routes, 0);
  await f.service.cancelLink(owner.user_id, handle);
});

const linkPages = {
  ebay: { account: 'https://www.ebay.com/mys/home', login: 'https://signin.ebay.com/ws/eBayISAPI.dll?SignIn&private_query=synthetic' },
  poshmark: { account: 'https://poshmark.com/user/account-info', login: 'https://poshmark.com/login?private_query=synthetic' },
  depop: { account: 'https://www.depop.com/settings/', login: 'https://www.depop.com/login/?private_query=synthetic' },
  mercari: { account: 'https://www.mercari.com/mypage/', login: 'https://www.mercari.com/login/?private_query=synthetic' },
} as const;

for (const site of ['ebay', 'poshmark', 'depop', 'mercari'] as const) {
  for (const outcome of ['account', 'account_child', 'signin', 'unexpected_signin', 'challenge', '403', 'unexpected', 'query', 'signin_form', 'non_2xx', 'null_response', 'other_origin', 'other_scheme', 'navigation_error'] as const) test(`${site} account verification: ${outcome}`, async () => {
    const f = setup(site); await f.registry.put(owner.user_id, row(site));
    const handle = await f.service.startLink(site, owner);
    const account = linkPages[site].account;
    const final = outcome === 'account_child' ? `${account.replace(/\/$/, '')}/details?private_query=synthetic` : outcome === 'unexpected_signin' ? 'https://unexpected.invalid/login?private_query=synthetic' : outcome === 'signin' ? linkPages[site].login : outcome === 'unexpected' ? new URL('/unrelated', account).href :
      outcome === 'other_origin' ? account.replace(new URL(account).hostname, 'unexpected.invalid') :
      outcome === 'other_scheme' ? account.replace('https:', 'http:') : `${account}?private_query=synthetic#private_fragment`;
    f.setNavigation(final, outcome === '403' ? 403 : outcome === 'non_2xx' ? 500 : outcome === 'account_child' ? 204 : 200);
    if (outcome === 'challenge') f.setHtml('<title>Just a moment...</title>');
    if (outcome === '403' || outcome === 'signin_form' || outcome === 'unexpected_signin') f.setHtml('<input type="password">');
    if (outcome === 'null_response') {
      const goto = f.page.goto;
      f.page.goto = async (url, opts) => { await goto(url, opts); return null; };
    }
    if (outcome === 'navigation_error') f.page.goto = async () => { throw new Error(final); };
    if (outcome === 'navigation_error') {
      await assert.rejects(f.service.finishLink(owner.user_id, handle), error => {
        assert.ok(error instanceof Error); assert.equal(error.message, 'session.verify failed'); return true;
      });
    } else {
      const result = await f.service.finishLink(owner.user_id, handle);
      assert.ok(result);
      if (outcome === 'account' || outcome === 'query' || outcome === 'account_child') {
        assert.ok(result.ok);
        const published = await f.registry.get(owner.user_id, owner.account_id);
        assert.equal(published?.state, 'linked'); assert.equal(published?.profile_id, 'profile_new');
        assert.equal(published?.data, 'captured'); assert.ok(published?.linked_at); assert.equal(published?.last_ok_at, published?.linked_at);
        assert.deepEqual(f.deleted, []);
      } else {
        assert.ok(!result.ok);
        const code = outcome === 'signin' || outcome === 'signin_form' ? 'auth_expired' : outcome === 'challenge' || outcome === '403' ? 'blocked' : 'page_changed';
        assert.equal(result.error.code, code);
        assert.equal(result.error.hint.do, code === 'auth_expired' ? 'relink' : code === 'blocked' ? 'pause_session' : 'author');
      }
      assert.doesNotMatch(JSON.stringify(result), /private_query|private_fragment/);
      assert.equal(f.visits[1], account);
    }
    if (outcome !== 'account' && outcome !== 'query' && outcome !== 'account_child') {
      assert.deepEqual(await f.registry.get(owner.user_id, owner.account_id), row(site));
      assert.deepEqual(f.deleted, ['profile_new']);
    }
    assert.equal(f.counts().stops, 1); assert.equal(f.counts().clicks, 0);
    assert.equal(f.counts().routes, 0); assert.equal(f.counts().imports, 0); assert.equal(f.counts().exports, 0);
    assert.equal(f.counts().contentReads, 0);
    assert.doesNotMatch(JSON.stringify(f.logs), /private_query|private_fragment/); noSecrets(f.logs);
    assert.equal(await f.service.finishLink(owner.user_id, handle), undefined);
  });
}

for (const site of ['ebay', 'poshmark', 'depop', 'mercari'] as const) {
  for (const unavailable of ['settle', 'state'] as const) test(`${site} HTTP 403 stays blocked when ${unavailable} is unavailable`, async () => {
    const f = setup(site); await f.registry.put(owner.user_id, row(site));
    const handle = await f.service.startLink(site, owner);
    f.setNavigation(linkPages[site].account, 403);
    if (unavailable === 'settle') f.page.waitForLoadState = async () => { throw new Error('private_query=synthetic'); };
    else f.page.evaluate = async () => { throw new Error('private_query=synthetic'); };
    const result = await f.service.finishLink(owner.user_id, handle);
    assert.ok(result && !result.ok && result.error.code === 'blocked' && result.error.hint.do === 'pause_session');
    assert.deepEqual(await f.registry.get(owner.user_id, owner.account_id), row(site));
    assert.deepEqual(f.deleted, ['profile_new']);
    assert.equal(f.counts().stops, 1); assert.equal(f.counts().clicks, 0);
    assert.equal(f.counts().contentReads, 0); assert.equal(f.counts().evaluations, 0); noSecrets(f.logs);
  });
}
