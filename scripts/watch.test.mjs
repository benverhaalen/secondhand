import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

function savedRows(dir, table) {
  const db = new DatabaseSync(join(dir, 'secondhand.db'), { readOnly: true });
  try {
    const rows = table === 'jobs'
      ? db.prepare('SELECT body FROM jobs ORDER BY seq').all()
      : db.prepare('SELECT body FROM rows WHERE tbl = ? ORDER BY rowid').all(table);
    return rows.map(row => JSON.parse(row.body));
  } finally {
    db.close();
  }
}

function temp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-watch-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function counts(stdout) {
  const lines = stdout.trim().split('\n');
  assert.equal(lines.length, 1, stdout);
  const row = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(row).sort(), ['jobs_run', 'ms', 'ran', 'route_jobs_run', 'skipped', 'stale']);
  for (const value of Object.values(row)) assert.ok(Number.isFinite(value) && value >= 0);
  return row;
}
test('importing the runtime leaves the background job queue free of API example jobs', t => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const { runtime } = await import('./app/src/edge/api/runtime.ts');
    assert.deepEqual(runtime.store.jobs(), [], 'runtime composition imported and seeded API example jobs');
  `], {
    env: { ...process.env, SECONDHAND_DATA_DIR: temp(t), SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
});
test('--once runs the composed runtime, prints one count line, and exits cleanly', t => {
  const child = spawnSync(process.execPath, ['scripts/watch.mjs', '--once'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: temp(t), SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual({ ...counts(child.stdout), ms: 0 }, { ran: 0, skipped: 0, stale: 0, jobs_run: 0, route_jobs_run: 0, ms: 0 });
  assert.match(child.stderr, /session.end/);
  const proof = join(temp(t), 'watch.jsonl');
  writeFileSync(proof, child.stderr.split('\n').filter(line => line.startsWith('{')).join('\n') + '\n');
  const checked = spawnSync(process.execPath, ['spec/log.mjs', proof], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr + checked.stdout);
});

test('--once counts watcher and route jobs separately', t => {
  const dir = temp(t), preload = join(dir, 'queued.mjs');
  writeFileSync(preload, `import { Console } from 'node:console';
    globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
    const { runtime } = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'app/src/edge/api/runtime.ts')).href)});
    const at = new Date().toISOString();
    const event = runtime.store.insertEvent({ user_id: 'usr_watch', source: 'watcher_signed_in', action: 'account_stale', actor: 'site', dedupe_key: 'stale', observed_at: at, effective_at: at, trace_id: 'test' }).row;
    for (const kind of ['relink', 'import']) runtime.store.insertJob({ user_id: event.user_id, event_id: event.id, kind, state: 'queued', idempotency_key: kind, args: { listing_ids: [] }, stages: [], attempts: 0, trace_id: 'test', created_at: at });`);
  const child = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/watch.mjs', '--once'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(counts(child.stdout).jobs_run, 1);
  assert.equal(counts(child.stdout).route_jobs_run, 1);
  assert.ok(savedRows(dir, 'jobs').every(job => job.state === 'done'));
});

test('one --once runs jobs enqueued by the import and unlink routes', t => {
  const dir = temp(t), preload = join(dir, 'routes.mjs');
  const moduleURL = path => JSON.stringify(pathToFileURL(join(process.cwd(), path)).href);
  writeFileSync(preload, `import assert from 'node:assert/strict';
    import { Console } from 'node:console';
    globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
    const { runtime } = await import(${moduleURL('app/src/edge/api/runtime.ts')});
    const { handlers } = await import(${moduleURL('app/src/edge/api/accounts.ts')});
    const { route, deps } = await import(${moduleURL('app/src/edge/api/http.ts')});
    deps.verify = async () => 'usr_8f2k';
    for (let i = 0; i < 2; i++) {
      const endpoint = 'POST /v1/accounts/:id/import';
      const res = await route(endpoint, handlers[endpoint])(new Request('http://test/v1/accounts/acc_dp1/import', {
        method: 'POST', headers: { Authorization: 'Bearer test', 'Idempotency-Key': 'import-' + i },
        body: JSON.stringify({ listings: true, purchases: false }),
      }));
      assert.equal(res.status, 202, await res.clone().text());
    }
    const endpoint = 'DELETE /v1/accounts/:id';
    const res = await route(endpoint, handlers[endpoint])(new Request('http://test/v1/accounts/acc_dp1', {
      method: 'DELETE', headers: { Authorization: 'Bearer test', 'Idempotency-Key': 'unlink' },
    }));
    assert.equal(res.status, 202, await res.clone().text());
    assert.equal(runtime.store.jobs().length, 3);`);
  const child = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/watch.mjs', '--once'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  const jobs = savedRows(dir, 'jobs');
  assert.ok(jobs.every(job => job.state === 'done'), 'one tick must finish all jobs queued by routes');
  assert.equal(counts(child.stdout).route_jobs_run, 3);
  assert.equal(counts(child.stdout).jobs_run, 0);
  assert.ok(savedRows(dir, 'listing').some(row => row.account_id === 'acc_dp1' && !row.import_preview && row.id !== 'ls_dp1'), 'the import engine must have created stored listings');
});

test('--once drains follow-up reconcile work created while running a route job', t => {
  const dir = temp(t), preload = join(dir, 'reconcile.mjs');
  const moduleURL = path => JSON.stringify(pathToFileURL(join(process.cwd(), path)).href);
  writeFileSync(preload, `import { Console } from 'node:console';
    globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
    const { runtime, createRuntime } = await import(${moduleURL('app/src/edge/api/runtime.ts')});
    const { fakeAdapter, fail } = await import(${moduleURL('app/src/edge/harness/protocol.ts')});
    const post = { ...fakeAdapter('depop', 'post'), async run(args) {
      return fail('outcome_unknown', 'fixture interrupted', { do: 'reconcile', operation_id: args.operation_id });
    } };
    Object.assign(runtime, createRuntime(runtime.store, undefined, { adapters: [post, fakeAdapter('depop', 'read_listings')] }));
    const account = runtime.store.get('account', 'usr_8f2k', 'acc_dp1');
    runtime.store.put('account', { ...account, token_ref: 'fixture/session' });
    await runtime.vault.put('fixture/session', { cookies: [], origins: [] });
    const at = new Date().toISOString();
    const event = runtime.store.insertEvent({ user_id: 'usr_8f2k', source: 'app', action: 'app.list', actor: 'user', dedupe_key: 'post', observed_at: at, effective_at: at, trace_id: 'test' }).row;
    runtime.store.insertJob({ user_id: event.user_id, event_id: event.id, kind: 'post', account_id: 'acc_dp1', site: 'depop', state: 'queued', idempotency_key: 'post', args: {}, stages: [], attempts: 0, trace_id: 'test', created_at: at });`);
  const child = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/watch.mjs', '--once'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  const jobs = savedRows(dir, 'jobs');
  assert.deepEqual(jobs.map(job => [job.kind, job.state, job.attempts]), [['post', 'failed', 1], ['reconcile', 'done', 1]], 'new follow-up work must run in the same tick');
  assert.equal(counts(child.stdout).route_jobs_run, 2);
});

test('--once stops draining when remaining route jobs are delayed or cannot take an account lease', t => {
  const dir = temp(t), preload = join(dir, 'delayed.mjs');
  writeFileSync(preload, `import { Console } from 'node:console';
    globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
    const { runtime } = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'app/src/edge/api/runtime.ts')).href)});
    const at = new Date().toISOString();
    const base = { user_id: 'usr_watch', event_id: 'route', state: 'queued', args: {}, stages: [], attempts: 0, trace_id: 'test', created_at: at };
    runtime.store.insertJob({ ...base, kind: 'send_message', account_id: 'acc_busy', site: 'depop', idempotency_key: 'busy' });
    runtime.leases.take('acc_busy', 'other-worker', 60000);
    runtime.store.insertJob({ ...base, kind: 'import', idempotency_key: 'later', next_run_at: new Date(Date.now() + 3600000).toISOString() });
    runtime.store.insertJob({ ...base, kind: 'import', idempotency_key: 'ready', args: { listing_ids: [] } });`);
  const child = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/watch.mjs', '--once'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  const jobs = savedRows(dir, 'jobs');
  assert.deepEqual(jobs.map(job => [job.idempotency_key, job.state, job.attempts]), [['busy', 'queued', 0], ['later', 'queued', 0], ['ready', 'done', 1]]);
  assert.equal(counts(child.stdout).route_jobs_run, 1, 'claims released without running must not count');
});

test('invalid loop cadence exits with a logged error', t => {
  const child = spawnSync(process.execPath, ['scripts/watch.mjs', '--every-s', '0'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: temp(t), SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.match(child.stderr, /"event":"error"/);
});

test('SIGTERM during a loop tick finishes that tick before exiting 0', { timeout: 10000, skip: process.platform === 'win32' && 'Windows delivers no SIGTERM: kill() ends the process at once' }, async t => {
  const dir = temp(t), preload = join(dir, 'slow-tick.mjs');
  // A preload holds the real composition's tick at an observable barrier; no test-only CLI mode.
  writeFileSync(preload, `import { Console } from 'node:console';
    globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
    const { runtime } = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'app/src/edge/api/runtime.ts')).href)});
    const tick = runtime.watcher.tick;
    runtime.watcher.tick = async () => {
      process.stderr.write('tick-entered\\n');
      await new Promise(resolve => setTimeout(resolve, 150));
      const result = await tick();
      process.stderr.write('tick-finished\\n');
      return result;
    };`);
  const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/watch.mjs', '--every-s', '0.01'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  let stdout = '', stderr = '', signalled = false;
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => {
    stderr += data;
    if (!signalled && stderr.includes('tick-entered')) { signalled = true; child.kill('SIGTERM'); }
  });
  const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  assert.deepEqual(status, { code: 0, signal: null }, stderr);
  assert.equal(signalled, true);
  assert.match(stderr, /tick-finished/);
  counts(stdout);
});
