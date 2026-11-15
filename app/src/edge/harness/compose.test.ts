import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { createLog, memorySink } from '../../../../log/index.js';
import type { Launcher } from '../browser/pool.ts';
import type { CdpPw } from '../browser/cdp.ts';
import type { PublicPage } from './public-client.ts';
import { API, WWW } from './sites/depop/adapter.ts';
import { composeSources, searchClients } from './compose.ts';

const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const signal = () => new AbortController().signal;
function logger() {
  const sink = memorySink();
  return { sink, log: createLog({ src: 'compose.test', build: 'test', sink }) };
}
function fakeBrowser() {
  const counts = { opened: 0, closed: 0, connected: 0 };
  const pageFetches: string[] = [];
  const page: PublicPage = {
    async goto() { return { status: () => 200 }; },
    async content() { return '<html>synthetic page</html>'; },
    async waitForTimeout() {}, async waitForSelector() {},
    async evaluate<T, A>(fn: string | ((arg: A) => T | Promise<T>), arg: A): Promise<T> {
      return runInNewContext(typeof fn === 'string' ? fn : `(${fn.toString()})(input)`, {
        input: arg,
        fetch: async (url: string) => {
          pageFetches.push(url);
          return { status: 200, ok: true, json: async () => ({ synthetic: true }) };
        },
      }) as Promise<T>;
    },
    on() {}, off() {}, async close() {},
  };
  const context = {
    async newPage() { return page; },
    onClose() {},
    async close() { counts.closed++; },
  };
  const launcher: Launcher<PublicPage> = {
    async anonymous() { counts.opened++; return context; },
    async persistent() { throw new Error('public reads must be anonymous'); },
  };
  const pw: CdpPw = { chromium: { async connectOverCDP() {
    counts.connected++;
    throw new Error('composition must not connect');
  } } };
  return { counts, pageFetches, launcher, pw };
}

test('key present -> cloud chosen with no network call at construction', async t => {
  const { log, sink } = logger(), { pw, counts } = fakeBrowser();
  let fetched = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetched++; throw new Error('unexpected server fetch'); });
  const clients = searchClients({ BROWSER_USE_API_KEY: "present", SECONDHAND_CHROME: '/synthetic/chrome' }, log, {
    pw, exists: () => true,
  });
  assert.equal(clients.browser, 'cloud');
  assert.equal(clients.mercariChrome, '/synthetic/chrome');
  assert.equal(fetched, 0);
  assert.equal(counts.connected, 0);
  assert.equal(clients.routed('depop'), true);
  assert.equal(clients.routed('ebay'), true);
  const notes = sink.lines.map(line => JSON.parse(line) as Record<string, unknown>).filter(entry => entry.event === 'note');
  assert.equal(notes.length, 1);
  assert.equal(notes[0]?.msg, 'search clients composed');
  assert.equal(notes[0]?.browser, 'cloud');
  assert.deepEqual(Object.keys(notes[0]!).sort(), ['browser', 'event', 'level', 'msg', 'seq', 'session', 'src', 'ts']);
  assert.equal(JSON.stringify(notes).includes('/synthetic/chrome'), false);
  await clients.close();
});

test('key absent and Chrome path missing -> none and throwing clients', async () => {
  const { log } = logger();
  const clients = searchClients({ SECONDHAND_CHROME: '/missing/chrome' }, log, { exists: () => false });
  assert.equal(clients.browser, 'none');
  assert.equal(clients.mercariChrome, undefined);
  assert.equal(clients.depop.signed_in, false);
  assert.equal(clients.ebay.signed_in, false);
  await assert.rejects(clients.depop.doc(WWW, signal()), /no browser is composed/);
  await assert.rejects(clients.depop.json('/x', signal()), /no browser is composed/);
  await assert.rejects(clients.ebay.page('https://www.ebay.com', signal()), /no browser is composed/);
  for (const site of ['depop', 'ebay', 'mercari', 'poshmark', 'facebook', 'other']) assert.equal(clients.routed(site), false);
  await clients.close();
});

test('test runner guard prevents cloud and local composition without a launcher', async () => {
  const { log } = logger(), { pw, counts } = fakeBrowser();
  for (const env of [{ NODE_TEST_CONTEXT: '', BROWSER_USE_API_KEY: '' }, { NODE_TEST_CONTEXT: 'child' }]) {
    const clients = searchClients(env, log, { pw, exists: () => true });
    assert.equal(clients.browser, 'none');
    assert.equal(clients.routed('depop'), false);
    await clients.close();
  }
  assert.equal(counts.connected, 0);
});

test('launcher fake used despite env and not launched at construction; JSON stays inside page', async t => {
  const { log } = logger(), fake = fakeBrowser();
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected server fetch'); });
  const clients = searchClients({ NODE_TEST_CONTEXT: 'child', BROWSER_USE_API_KEY: '' }, log, {
    launcher: fake.launcher, pw: fake.pw, exists: () => false,
  });
  assert.notEqual(clients.browser, 'none');
  assert.equal(fake.counts.opened, 0);
  assert.equal(clients.routed('depop'), true);
  assert.equal(clients.routed('ebay'), true);
  for (const site of ['mercari', 'poshmark', 'facebook', 'other']) assert.equal(clients.routed(site), false);
  try {
    assert.equal((await clients.depop.doc(WWW, signal())).status, 200);
    assert.deepEqual(await clients.depop.json('/x', signal()).then(r => JSON.parse(JSON.stringify(r))), {
      status: 200, body: { synthetic: true },
    });
    assert.equal((await clients.ebay.page('https://www.ebay.com', signal())).status, 200);
    assert.deepEqual(fake.pageFetches, [API + '/x']);
    assert.equal(fake.counts.opened, 2);
    assert.equal(fake.counts.connected, 0);
  } finally { await clients.close(); }
});

test('SR10 with the live flag: Depop doc and JSON never call server fetch without a browser', async t => {
  const { log } = logger();
  const calls: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (...args: unknown[]) => { calls.push(args); throw new Error('unexpected fetch'); });
  const clients = searchClients({ SECONDHAND_LIVE_SITES: 'depop' }, log, { exists: () => false });
  await assert.rejects(clients.depop.json('/x', signal()), /no browser is composed/);
  await assert.rejects(clients.depop.doc(WWW + '/search/', signal()), /no browser is composed/);
  assert.deepEqual(calls, []);
  await clients.close();
});

test('local Chrome selection prefers the configured path, then the default Windows path', async () => {
  const { log } = logger(), { pw, counts } = fakeBrowser();
  for (const configuredExists of [true, false]) {
    const checked: string[] = [];
    const clients = searchClients({ SECONDHAND_CHROME: '/synthetic/chrome' }, log, { pw, exists(path) {
      checked.push(path);
      return path === windowsChrome || configuredExists;
    } });
    assert.equal(clients.browser, 'local');
    assert.equal(clients.mercariChrome, configuredExists ? '/synthetic/chrome' : windowsChrome);
    assert.deepEqual(checked, configuredExists ? ['/synthetic/chrome'] : ['/synthetic/chrome', windowsChrome]);
    await clients.close();
  }
  assert.equal(counts.connected, 0);
});

test('legacy Chrome env name is ignored', async () => {
  const { log } = logger();
  const clients = searchClients({ SECONDHAND_CHROME_PATH: '/synthetic/legacy' }, log, { exists: path => path === '/synthetic/legacy' });
  assert.equal(clients.browser, 'none');
  await clients.close();
});

test('close idempotent: each public context closes once and none resolves', async () => {
  const { log } = logger(), fake = fakeBrowser();
  const clients = searchClients({}, log, { launcher: fake.launcher, exists: () => false });
  await clients.depop.doc(WWW, signal());
  await clients.ebay.page('https://www.ebay.com', signal());
  const first = clients.close();
  assert.equal(clients.close(), first);
  await Promise.all([first, clients.close()]);
  assert.equal(fake.counts.closed, 2);
  await assert.rejects(clients.depop.doc(WWW, signal()), /closed/);
  const none = searchClients({}, log, { exists: () => false });
  await Promise.all([none.close(), none.close()]);
});

test('composeSources gives createRuntime no public clients and no Apify token when no browser is composed', async () => {
  const sources = composeSources({ env: { NODE_TEST_CONTEXT: '1', BROWSER_USE_API_KEY: 'present', APIFY_TOKEN: 'present' }, log: createLog({ src: 'test', build: 'test', sink: memorySink() }), now: Date.now });
  assert.equal(sources.publicClients, undefined);
  assert.equal(sources.apifyToken, undefined);
  await sources.close();
});

test('Shopping composition: token presence installs the search port; absent token is unrouted without fetch', async () => {
  const { runtimePorts } = await import('../intel/public/search.ts');
  const original = runtimePorts.shopping;
  const { log, sink } = logger(); let calls = 0;
  try {
    for (const token of [undefined, '', '   ']) {
      const composed = composeSources({ env: { NODE_TEST_CONTEXT: '1', TREG_TOKEN: token }, log, fetch: async () => assert.fail('no token fetched') });
      assert.equal(composed.shopping, undefined); assert.equal(runtimePorts.shopping, undefined); await composed.close();
    }
    const sentinel = 'SYNTHETIC_COMPOSE_SECRET';
    const composed = composeSources({ env: { NODE_TEST_CONTEXT: '1', TREG_TOKEN: sentinel }, log,
      fetch: async () => { calls++; return new Response('{"shopping":[]}'); } });
    assert.ok(composed.shopping); assert.equal(runtimePorts.shopping, composed.shopping); assert.equal(calls, 0);
    assert.ok((await composed.shopping.search({ q: 'synthetic' }, signal())).ok); assert.equal(calls, 1);
    assert.equal(sink.text().includes(sentinel), false); assert.equal(JSON.stringify(composed).includes(sentinel), false);
    await composed.close();
  } finally { runtimePorts.shopping = original; }
});

test('Shopping test runner guard never composes a real fetch even with a token', async () => {
  const { runtimePorts } = await import('../intel/public/search.ts'); const original = runtimePorts.shopping;
  try {
    for (const env of [{ NODE_TEST_CONTEXT: '1', TREG_TOKEN: 'synthetic' }, { TREG_TOKEN: 'synthetic' }]) {
      const composed = composeSources({ env, log: logger().log });
      assert.equal(composed.shopping, undefined); await composed.close();
    }
  } finally { runtimePorts.shopping = original; }
});
