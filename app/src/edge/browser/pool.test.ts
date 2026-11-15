import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool, type Launcher, type LaunchOptions, type PoolContext, type PoolPage } from './pool.ts';
import { loadPlaywright, playwrightLauncher } from './playwright.ts';

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
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles' });
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
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles' });
  await pool.warm(['acct-1']);
  const n = f.launched.length;
  const d = await pool.dispatch({ account_id: 'acct-1', job_id: 'j', run: async () => 1 });
  assert.ok(d.ok && d.warm);
  assert.equal(f.launched.length, n);
  assert.ok(d.ms < 40, `warm dispatch took ${d.ms} ms`);
});

test('each account has its own profile directory and its own steady address; no fingerprint options', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', address: id => (id === 'acct-1' ? 'http://us-east.proxy:8080' : undefined) });
  await pool.dispatchAll([{ account_id: 'acct-1', job_id: 'a', run: async () => 0 }, { account_id: 'acct-2', job_id: 'b', run: async () => 0 }]);
  const dirs = f.launched.filter(l => l.kind === 'persistent').map(l => l.dir);
  assert.equal(new Set(dirs).size, 2);
  assert.deepEqual(f.launched.find(l => l.dir?.endsWith('acct-1'))?.opts, { headless: true, proxy: { server: 'http://us-east.proxy:8080' } });
  for (const l of f.launched) assert.deepEqual(Object.keys(l.opts).filter(k => !['headless', 'proxy'].includes(k)), []);
});

test('a pool host restart keeps the profile: the next dispatch relaunches the same directory', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles' });
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
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', publicConcurrency: 4 });
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
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles' });
  const d = await pool.dispatch({ account_id: 'acct-1', job_id: 'a', run: async () => { throw new Error('boom'); } });
  assert.ok(!d.ok && d.status === 'error');
  assert.equal(pool.stats().leased, 0);
  assert.ok((await pool.dispatch({ account_id: 'acct-1', job_id: 'b', run: async () => 1 })).ok);
});

test('past maxAccounts the idle account is closed, never a leased one', async () => {
  const f = fakeLauncher(1);
  const pool = createPool({ launcher: f.launcher, profileRoot: '/profiles', maxAccounts: 2 });
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
  const pool = createPool({ launcher, profileRoot: root, publicConcurrency: 8 });
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
