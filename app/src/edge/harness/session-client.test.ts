import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLog } from '../../../../log/index.js';
import { memoryStore, memoryLeases } from '../events/ports.ts';
import { memoryProfileRegistry, storeProfileRegistry, type ProfileRow } from '../browser/auth.ts';
import { createPool } from '../browser/pool.ts';
import { browserUseCloud, cdpLauncher, registryProfileFor, type CdpPw } from '../browser/cdp.ts';
import { sessionClient, type SessionPage, type SessionResponse } from './session-client.ts';
import { poshmarkAdapters } from './sites/poshmark/adapter.ts';
import { mercariAdapters } from './sites/mercari/adapter.ts';

const owner = { user_id: 'person_a', account_id: 'account_a' };
const row = (site: ProfileRow['site'] = 'poshmark'): ProfileRow => ({ ...owner, site, profile_id: 'profile_a', state: 'linked', linked_at: '2026-11-15T00:00:00.000Z', last_ok_at: null, data: 'synthetic' });
const fixture = (site: string, name: string): unknown => JSON.parse(readFileSync(new URL(`./sites/${site}/fixtures/${name}`, import.meta.url), 'utf8'));
const signal = () => new AbortController().signal;
function setup(site: ProfileRow['site'] = 'poshmark') {
  const registry = memoryProfileRegistry();
  const creates: Record<string, unknown>[] = [], logs: unknown[] = [];
  let refuseStop = false;
  let stops = 0, closedPages = 0, routes = 0, imports = 0, exports = 0;
  let html = '<html>Account</html>', url = '', body: unknown = fixture('poshmark', 'inbox.json');
  const listeners = new Set<(response: SessionResponse) => void>();
  const page: SessionPage = {
    async goto(next) { url = next; for (const f of listeners) f({ url: () => 'https://www.mercari.com/v1/api?operationName=conversationsQuery', status: () => 200, text: async () => JSON.stringify(body), request: () => ({ postData: () => null }) }); return { status: () => 200, text: async () => html }; },
    url: () => url, content: async () => html,
    async evaluate<T, A>(_fn: (a: A) => T | Promise<T>, _arg: A): Promise<T> { return { status: 200, body, url, html: '' } as T; },
    async route() { routes++; }, on(_event, fn) { listeners.add(fn); }, off(_event, fn) { listeners.delete(fn); },
    async waitForLoadState() {}, async close() { closedPages++; },
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
  const options = { pool, registry, launcher, profileRoot: '/unused', leases, log, ttlMs: 60_000, createProfile: async () => 'profile_new' };
  const service = sessionClient(options);
  return { registry, pool, service, newService: (overrides: Partial<Parameters<typeof sessionClient>[0]>) => sessionClient({ ...options, ...overrides }), creates, logs, page, site, counts: () => ({ stops, closedPages, routes, imports, exports }),
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

test('Mercari captures page responses and eBay installs no request interception', async () => {
  const f = setup('mercari'); await f.registry.put(owner.user_id, row('mercari')); f.setBody((fixture('mercari', 'inbox.json') as { api: { body: unknown }[] }).api[0].body);
  const c = await f.service.clientFor('mercari', owner);
  assert.equal((await mercariAdapters(c).find(a => a.manifest.verb === 'read_inbox')!.run({}, signal())).ok, true);
  assert.ok(f.counts().routes > 0); await f.pool.close();
  const e = setup('ebay'); await e.registry.put(owner.user_id, row('ebay'));
  await (await e.service.clientFor('ebay', owner)).page('https://www.ebay.com/sch/i.html', signal());
  assert.equal(e.counts().routes, 0); await e.pool.close();
});

test('link handle is owner checked, viewer is consumed once, finish verifies through adapter and stops before linked', async () => {
  const f = setup();
  const handle = await f.service.startLink('poshmark', owner);
  assert.equal(typeof handle, 'string'); assert.ok(!handle.includes('http'));
  assert.equal(await f.service.liveView('person_b', handle), undefined);
  assert.equal(await f.service.finishLink('person_b', handle), undefined);
  assert.equal(await f.service.liveView(owner.user_id, handle), 'https://viewer.invalid/private');
  assert.equal(await f.service.liveView(owner.user_id, handle), undefined);
  assert.equal((await f.service.finishLink(owner.user_id, handle))?.ok, true);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'linked');
  assert.equal(f.counts().stops, 1); assert.equal(f.counts().exports, 0);
  assert.equal(await f.service.finishLink(owner.user_id, handle), undefined);
});

test('abandoning a link stops the browser and never links; foreign cancellation does nothing', async () => {
  const f = setup(), handle = await f.service.startLink('poshmark', owner);
  await f.service.cancelLink('person_b', handle); assert.equal(f.counts().stops, 0);
  await f.service.cancelLink(owner.user_id, handle); assert.equal(f.counts().stops, 1);
  assert.notEqual((await f.registry.get(owner.user_id, owner.account_id))?.state, 'linked');
});

function noSecrets(value: unknown): void {
  if (typeof value === 'string') assert.doesNotMatch(value, /https?:\/\/|wss?:\/\/|bearer\s|sessionid=|eyJ[a-zA-Z0-9_-]+\./i);
  else if (value && typeof value === 'object') for (const [key, v] of Object.entries(value)) {
    assert.doesNotMatch(key, /cookie|token|storage.?state|localstorage|live.?url|authorization|password/i); noSecrets(v);
  }
}
test('stored rows and captured logs contain no credentials, storage, or viewer address, including failures', async () => {
  const f = setup(); const handle = await f.service.startLink('poshmark', owner);
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

test('link verification challenge stops the browser and cannot publish linked state', async () => {
  const f = setup(), handle = await f.service.startLink('poshmark', owner);
  f.setHtml('<title>Just a moment</title>');
  const result = await f.service.finishLink(owner.user_id, handle);
  assert.ok(result && !result.ok && result.error.code === 'blocked');
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'paused');
  assert.equal(f.counts().stops, 1);
});

test('expired handles stop abandoned browsers and are unavailable to their owner', async () => {
  const f = setup(); let now = Date.now();
  const service = f.newService({ now: () => now, ttlMs: 1000 });
  const handle = await service.startLink('poshmark', owner); now += 1001;
  assert.equal(await service.liveView(owner.user_id, handle), undefined);
  assert.equal(await service.finishLink(owner.user_id, handle), undefined);
  assert.equal(f.counts().stops, 1);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin');
});

test('timer stops a link even if its handle is never used again', async () => {
  const f = setup(), service = f.newService({ ttlMs: 10 });
  const handle = await service.startLink('poshmark', owner);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(f.counts().stops, 1); assert.equal(await service.finishLink(owner.user_id, handle), undefined);
});

test('a failed sign-in navigation stops the browser, frees the lease, and hides vendor errors', async () => {
  const f = setup();
  f.page.goto = async () => { throw new Error('navigation failed https://viewer.invalid/private?sessionid=synthetic'); };
  await assert.rejects(f.service.startLink('poshmark', owner), /link could not start/);
  assert.equal(f.counts().stops, 1); noSecrets(f.logs);
  await assert.rejects(f.service.startLink('poshmark', owner), /link could not start/);
  assert.equal(f.counts().stops, 2);
});

test('a failed adapter verification closes the browser and never links', async () => {
  const f = setup(), handle = await f.service.startLink('poshmark', owner);
  f.page.evaluate = async () => { throw new Error('https://viewer.invalid/private'); };
  await assert.rejects(f.service.finishLink(owner.user_id, handle), /session.verify failed/);
  assert.equal(f.counts().stops, 1);
  assert.equal((await f.registry.get(owner.user_id, owner.account_id))?.state, 'needs_signin'); noSecrets(f.logs);
});

test('link setup cannot outlive its lease and then expose a live browser', async () => {
  const f = setup(); let now = 0;
  const service = f.newService({ now: () => now, ttlMs: 1000, createProfile: async () => { now = 1001; return 'profile_new'; } });
  await assert.rejects(service.startLink('poshmark', owner), /link could not start/);
  assert.equal(f.creates.length, 0);
});

test('completion holds its account lease until the linked row is published', async () => {
  const f = setup(); let blocked = false;
  const registry = { get: f.registry.get, async put(user: string, value: ProfileRow) {
    if (value.state === 'linked') {
      await assert.rejects(f.service.startLink('poshmark', owner), e => {
        blocked = e instanceof Error && 'error' in e && (e.error as { code: string }).code === 'blocked'; return blocked;
      });
    }
    await f.registry.put(user, value);
  } };
  const service = f.newService({ registry }), handle = await service.startLink('poshmark', owner);
  assert.equal((await service.finishLink(owner.user_id, handle))?.ok, true); assert.equal(blocked, true);
});

test('a vendor that refuses stop cannot publish a linked profile', async () => {
  const f = setup(), handle = await f.service.startLink('poshmark', owner); f.refuseStop();
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
  await assert.rejects(Promise.race([read, new Promise((_, reject) => setTimeout(() => reject(new Error('read retained lease after abort')), 50))]), e => e instanceof Error && e.message !== 'read retained lease after abort');
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
