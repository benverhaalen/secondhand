import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool, type Launcher, type LaunchOptions, type PoolContext, type PoolPage } from './pool.ts';
import { loadPlaywright, playwrightLauncher } from './playwright.ts';
import { memoryAccounts, memoryVault, type Accounts, type StorageState } from './auth.ts';
import { browserUseCloud, cdpLauncher, localChrome, type CdpPw } from './cdp.ts';
import { createLog } from '../../../../log/index.js';
import { existsSync } from 'node:fs';

// Every account counts as linked: for tests about the pool's own mechanics.
const allLinked: Accounts = { linked: async () => [], byId: async id => ({ account_id: id, person_id: 'p1', site: 'ebay', token_ref: `ref-${id}` }) };

// A fake launcher: a cold launch costs 30 ms, a page 1 ms; it records every launch and the options it got.
function fakeLauncher(coldMs = 30) {
  const launched: { kind: string; dir?: string; opts: LaunchOptions }[] = [];
  const contexts: { kill(): void }[] = [];
  let openPages = 0, peakPages = 0;
  const ctx = (): PoolContext => {
    let onClose = () => {};
    const c: PoolContext & { kill(): void } = {
      async newPage() { openPages++; peakPages = Math.max(peakPages, openPages); await sleep(1); return { close: async () => { openPages--; } }; },
      async close() { onClose(); }, onClose(fn) { onClose = fn; }, kill() { onClose(); },
    };
    contexts.push(c);
    return c;
  };
  const launcher: Launcher = {
    async persistent(dir, opts) { launched.push({ kind: 'persistent', dir, opts }); await sleep(coldMs); return ctx(); },
    async anonymous(opts) { launched.push({ kind: 'anonymous', opts }); await sleep(coldMs); return ctx(); },
  };
  return { launcher, launched, contexts, peak: () => peakPages };
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test('one session per account: a second job on one profile gets 409, and their steps never interleave', async () => {
  const f = fakeLauncher();
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked });
  const steps: string[] = [];
  const job = (id: string) => ({ account_id: 'acct-1', job_id: id, run: async (_: PoolPage) => { steps.push(`${id}:a`); await sleep(20); steps.push(`${id}:b`); return id; } });
  const [a, b] = await pool.dispatchAll([job('j1'), job('j2')]);
  assert.ok(a.ok);
  assert.ok(!b.ok && b.status === 409);
  assert.deepEqual(steps, ['j1:a', 'j1:b']);
  const again = await pool.dispatch(job('j2'));
  assert.ok(again.ok, 'the lease is free once the first job ends');
});

test('a warmed account dispatches without a launch', async () => {
  const f = fakeLauncher(40);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked });
  await pool.warm(['acct-1']);
  const n = f.launched.length;
  const d = await pool.dispatch({ account_id: 'acct-1', job_id: 'j', run: async () => 1 });
  assert.ok(d.ok && d.warm);
  assert.equal(f.launched.length, n);
  assert.ok(d.ms < 40, `warm dispatch took ${d.ms} ms`);
});

test('each account has its own profile directory and its own steady address; no fingerprint options', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked, address: id => (id === 'acct-1' ? 'http://us-east.proxy:8080' : undefined) });
  await pool.dispatchAll([{ account_id: 'acct-1', job_id: 'a', run: async () => 0 }, { account_id: 'acct-2', job_id: 'b', run: async () => 0 }]);
  const dirs = f.launched.filter(l => l.kind === 'persistent').map(l => l.dir);
  assert.equal(new Set(dirs).size, 2);
  assert.deepEqual(f.launched.find(l => l.dir?.endsWith('acct-1'))?.opts, { headless: true, proxy: { server: 'http://us-east.proxy:8080' } });
  for (const l of f.launched) assert.deepEqual(Object.keys(l.opts).filter(k => !['headless', 'proxy'].includes(k)), []);
});

test('a pool host restart keeps the profile: the next dispatch relaunches the same directory', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked });
  await pool.dispatch({ account_id: 'acct-1', job_id: 'a', run: async () => 0 });
  f.contexts[0].kill();
  const d = await pool.dispatch({ account_id: 'acct-1', job_id: 'b', run: async () => 0 });
  assert.ok(d.ok && !d.warm);
  const dirs = f.launched.filter(l => l.kind === 'persistent').map(l => l.dir);
  assert.equal(dirs.length, 2);
  assert.equal(dirs[0], dirs[1]);
});

test('public reads are dispatched at once in parallel, capped, and queue past the cap', async () => {
  const f = fakeLauncher(5);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked, publicConcurrency: 4 });
  let live = 0, peak = 0;
  const tasks = Array.from({ length: 12 }, (_, i) => ({ job_id: `s${i}`, run: async () => { live++; peak = Math.max(peak, live); await sleep(15); live--; return i; } }));
  const t0 = performance.now();
  const out = await pool.dispatchAll(tasks);
  assert.ok(out.every(o => o.ok));
  assert.equal(peak, 4);
  assert.ok(performance.now() - t0 < 12 * 15, 'faster than one at a time');
  assert.equal(pool.stats().public, 4);
});

test('a task that throws is an error result, the page is closed and the lease freed', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked });
  const d = await pool.dispatch({ account_id: 'acct-1', job_id: 'a', run: async () => { throw new Error('boom'); } });
  assert.ok(!d.ok && d.status === 'error');
  assert.equal(pool.stats().leased, 0);
  assert.ok((await pool.dispatch({ account_id: 'acct-1', job_id: 'b', run: async () => 1 })).ok);
});

test('past maxAccounts the idle account is closed, never a leased one', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked, maxAccounts: 2 });
  await pool.dispatch({ account_id: 'a1', job_id: 'x', run: async () => 0 });
  const long = pool.dispatch({ account_id: 'a2', job_id: 'y', run: async () => { await sleep(20); return 0; } });
  await sleep(5);
  await pool.dispatch({ account_id: 'a3', job_id: 'z', run: async () => 0 });
  assert.ok((await long).ok);
  assert.equal(pool.stats().accounts, 2);
});

// The measurement on a real Chromium: cold launch against a warm dispatch. Runs where Playwright and its browser are installed.
const pw = loadPlaywright();
test('real Chromium: a warm dispatch is far faster than a cold launch, and 8 run in parallel', { skip: pw ? false : 'Playwright not found: set SECONDHAND_PLAYWRIGHT' }, async t => {
  const launcher = playwrightLauncher(pw!);
  const root = mkdtempSync(join(tmpdir(), 'sh-pool-'));
  const pool = createPool({ launcher, profileRoot: root, publicConcurrency: 8, accounts: allLinked });
  try {
    const page = async (p: PoolPage) => { await (p as unknown as { setContent(h: string): Promise<void> }).setContent('<p>ok</p>'); return 1; };
    const cold = await pool.dispatch({ account_id: 'acct-cold', job_id: 'c', run: page });
    await pool.warm(['acct-warm'], 8);
    const warm = await pool.dispatch({ account_id: 'acct-warm', job_id: 'w', run: page });
    const t0 = performance.now();
    const par = await pool.dispatchAll(Array.from({ length: 8 }, (_, i) => ({ job_id: `p${i}`, run: page })));
    const parMs = performance.now() - t0;
    assert.ok(cold.ok && warm.ok && par.every(p => p.ok));
    t.diagnostic(`cold_ms=${Math.round(cold.ms)} warm_ms=${Math.round(warm.ms)} parallel8_ms=${Math.round(parMs)}`);
    assert.ok(warm.ms < cold.ms / 3, `warm ${warm.ms} vs cold ${cold.ms}`);
    assert.ok(warm.ms < 500);
  } finally {
    await pool.close();
    await launcher.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test('linked accounts only: a planted unlinked site gets zero launches and zero jobs, warming included', async () => {
  const f = fakeLauncher(1);
  const vault = memoryVault();
  await vault.put('ref-depop', { cookies: [], origins: [] });
  const accounts = memoryAccounts([
    { account_id: 'a-depop', person_id: 'p1', site: 'depop', token_ref: 'ref-depop' },
    { account_id: 'a-mercari', person_id: 'p1', site: 'mercari' },                      // planted: a row with no stored sign-in
    { account_id: 'a-posh', person_id: 'p1', site: 'poshmark', token_ref: 'ref-none' },  // a token_ref the vault does not hold
  ], vault);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts, vault, publicConcurrency: 1 });
  await pool.warmLinked('p1', 0);
  assert.deepEqual(f.launched.map(l => l.dir?.split(/[\\/]/).pop()), ['a-depop']);
  let ran = 0;
  const out = await pool.dispatchAll(['a-mercari', 'a-posh', 'a-ghost'].map(id => ({ account_id: id, job_id: id, run: async () => { ran++; return 0; } })));
  assert.ok(out.every(o => !o.ok && o.status === 'not_linked'));
  assert.equal(ran, 0);
  assert.equal(f.launched.length, 1);
  const none = await createPool({ launcher: f.launcher, profileRoot: '/p' }).dispatch({ account_id: 'a-depop', job_id: 'x', run: async () => 0 });
  assert.ok(!none.ok && none.status === 'not_linked', 'with no account list configured, no account runs');
  assert.equal(f.launched.length, 1);
});

test('sign-in state loads at lease start, is exported at lease end, and never reaches a log line', async () => {
  const secret = 'sess-SECRET-cookie-value';
  const state = (v: string): StorageState => ({ cookies: [{ name: 'sid', value: v, domain: '.depop.com', path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' }], origins: [] });
  const vault = memoryVault();
  await vault.put('ref-a', state(secret));
  const loaded: StorageState[] = [];
  let current = state(secret);
  const launcher: Launcher = {
    async persistent() { return { newPage: async () => ({ close: async () => {} }), close: async () => {}, onClose() {},
      loadState: async (s: StorageState) => { loaded.push(s); }, exportState: async () => current }; },
    async anonymous() { throw new Error('unused'); },
  };
  const lines: string[] = [];
  const log = createLog({ src: 'browser', build: 'test', sink: (l: string) => { lines.push(l); } });
  const accounts = memoryAccounts([{ account_id: 'a', person_id: 'p1', site: 'depop', token_ref: 'ref-a' }], vault);
  const pool = createPool({ launcher, profileRoot: '/profiles', accounts, vault, log });
  assert.ok((await pool.dispatch({ account_id: 'a', job_id: 'j1', run: async () => { current = state(`${secret}-rotated`); return 1; } })).ok);
  assert.ok((await pool.dispatch({ account_id: 'a', job_id: 'j2', run: async () => 2 })).ok);
  assert.equal(loaded.length, 1, 'loaded once per launch, not per lease');
  assert.equal(loaded[0].cookies[0].value, secret);
  assert.equal((await vault.get('ref-a'))?.cookies[0].value, `${secret}-rotated`, 'the rotated cookie went back to the vault');
  assert.ok(lines.length > 0 && !lines.join('').includes('SECRET'));
});

test('browser-use cloud: the key goes only in its header, never a URL; the browser is stopped on close', async () => {
  const calls: { url: string; method?: string; key?: string; body?: string }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method, key: (init?.headers as Record<string, string>)['X-Browser-Use-API-Key'], body: String(init?.body) });
    if (init?.method === 'POST') return new Response(JSON.stringify({ id: 'b-1', cdpUrl: 'wss://cdp.example/x' }), { status: 200 });
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  let connected = '';
  const ctx = { pages: () => [], newPage: async () => ({ close: async () => {} }), addCookies: async () => {}, addInitScript: async () => {},
    storageState: async (): Promise<StorageState> => ({ cookies: [], origins: [] }), close: async () => {} };
  const pw: CdpPw = { chromium: { connectOverCDP: async (url: string) => { connected = url; return { contexts: () => [ctx], newContext: async () => ctx, close: async () => {}, on() {} }; } } };
  const launcher = cdpLauncher(pw, browserUseCloud({ apiKey: 'KEY-123', fetchFn }));
  const c = await launcher.persistent('/profiles/a', { headless: true });
  assert.equal(connected, 'wss://cdp.example/x');
  await c.close();
  assert.deepEqual(calls.map(x => [x.method, x.url]), [['POST', 'https://api.browser-use.com/api/v4/browsers'], ['PATCH', 'https://api.browser-use.com/api/v4/browsers/b-1']]);
  assert.ok(calls.every(x => x.key === 'KEY-123' && !x.url.includes('KEY-123')));
  assert.match(calls[0].body ?? '', /"proxyCountryCode":"us"/);
  assert.doesNotMatch(calls[0].body ?? '', /captcha/i);
  const bad = cdpLauncher(pw, browserUseCloud({ apiKey: 'KEY-123', fetchFn: (async () => new Response('no', { status: 401 })) as unknown as typeof fetch }));
  await assert.rejects(bad.persistent('/p', { headless: true }), (e: Error) => !e.message.includes('KEY-123'));
});

// The real browser-use shape: a local Chrome on a kept profile, reached over CDP; its sign-in survives a relaunch.
const chrome = [process.env.SECONDHAND_CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => p && existsSync(p));
test('real local Chrome over CDP: state loads, exports, survives a relaunch; warm dispatch is fast', { skip: pw && chrome ? false : 'needs Playwright and Chrome' }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'sh-cdp-'));
  const vault = memoryVault();
  await vault.put('ref-a', { cookies: [{ name: 'sid', value: 'test-only-value', domain: 'example.com', path: '/', expires: Math.floor(Date.now() / 1000) + 3600, httpOnly: true, secure: true, sameSite: 'Lax' }], origins: [] });
  const accounts = memoryAccounts([{ account_id: 'a', person_id: 'p1', site: 'depop', token_ref: 'ref-a' }], vault);
  const launcher = cdpLauncher(pw as unknown as CdpPw, localChrome({ executablePath: chrome!, scratch: join(root, 'anon') }));
  const mk = () => createPool({ launcher, profileRoot: join(root, 'profiles'), accounts, vault });
  let pool = mk();
  try {
    const cold = await pool.dispatch({ account_id: 'a', job_id: 'j1', run: async () => 1 });
    const warm = await pool.dispatch({ account_id: 'a', job_id: 'j2', run: async () => 2 });
    assert.ok(cold.ok && warm.ok && warm.warm, JSON.stringify([cold, warm]));
    t.diagnostic(`cdp_cold_ms=${Math.round(cold.ms)} cdp_warm_ms=${Math.round(warm.ms)}`);
    assert.ok(warm.ms < cold.ms);
    assert.equal((await vault.get('ref-a'))?.cookies.find(c => c.name === 'sid')?.value, 'test-only-value');
    await pool.close();
    await vault.put('ref-a', { cookies: [], origins: [] }); // the profile directory alone must carry the login across a relaunch
    pool = mk();
    assert.ok((await pool.dispatch({ account_id: 'a', job_id: 'j3', run: async () => 3 })).ok);
    assert.equal((await vault.get('ref-a'))?.cookies.find(c => c.name === 'sid')?.value, 'test-only-value');
  } finally {
    await pool.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});

test('a site whose profile says headed gets a real window, for accounts and public reads; the rest run headless', async () => {
  const f = fakeLauncher(1);
  const accounts: Accounts = { linked: async () => [], byId: async id => ({ account_id: id, person_id: 'p1', site: id === 'a-depop' ? 'depop' : 'ebay', token_ref: `ref-${id}` }) };
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts, publicConcurrency: 2 });
  await pool.dispatchAll([{ account_id: 'a-depop', job_id: '1', run: async () => 0 }, { account_id: 'a-ebay', job_id: '2', run: async () => 0 }]);
  assert.equal(f.launched.find(l => l.dir?.endsWith('a-depop'))?.opts.headless, false);
  assert.equal(f.launched.find(l => l.dir?.endsWith('a-ebay'))?.opts.headless, true);
  await pool.dispatch({ site: 'mercari', job_id: 'm', run: async () => 0 });
  await pool.dispatch({ site: 'poshmark', job_id: 'p', run: async () => 0 });
  await pool.dispatch({ site: 'mercari', job_id: 'm2', run: async () => 0 });
  assert.deepEqual(f.launched.filter(l => l.kind === 'anonymous').map(l => l.opts.headless), [false, true], 'the headed public slot is reused for the second Mercari read');
});

test('review: two tasks of one job on one account: the second gets 409 and the first never frees the lease early', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', accounts: allLinked });
  const slow = { account_id: 'a', job_id: 'same', run: async () => { await sleep(20); return 1; } };
  const [a, b] = await pool.dispatchAll([slow, slow]);
  assert.ok(a.ok && !b.ok && b.status === 409);
});

test('review: a failed load, a failed run, or a logged-out export never overwrites the stored sign-in', async () => {
  const good: StorageState = { cookies: [{ name: 'sid', value: 'good', domain: '.depop.com', path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' }], origins: [] };
  const vault = memoryVault();
  await vault.put('ref-a', good);
  const accounts = memoryAccounts([{ account_id: 'a', person_id: 'p1', site: 'ebay', token_ref: 'ref-a' }], vault);
  let failLoad = true, exported: StorageState = { cookies: [], origins: [] };
  const launcher: Launcher = {
    async persistent() { return { newPage: async () => ({ close: async () => {} }), close: async () => {}, onClose() {},
      loadState: async () => { if (failLoad) throw new Error('load failed'); }, exportState: async () => exported }; },
    async anonymous() { throw new Error('unused'); },
  };
  const pool = createPool({ launcher, profileRoot: '/profiles', accounts, vault });
  assert.ok(!(await pool.dispatch({ account_id: 'a', job_id: 'j1', run: async () => 1 })).ok);
  assert.deepEqual(await vault.get('ref-a'), good, 'a failed load keeps the stored state');
  failLoad = false;
  assert.ok(!(await pool.dispatch({ account_id: 'a', job_id: 'j2', run: async () => { throw new Error('boom'); } })).ok);
  assert.deepEqual(await vault.get('ref-a'), good, 'a failed run keeps the stored state');
  assert.ok((await pool.dispatch({ account_id: 'a', job_id: 'j3', run: async () => 1 })).ok);
  assert.deepEqual(await vault.get('ref-a'), good, 'an export with no cookies (logged out) keeps the stored state');
});
