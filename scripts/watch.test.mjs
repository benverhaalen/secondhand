import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function temp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-watch-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function counts(stdout) {
  const lines = stdout.trim().split('\n');
  assert.equal(lines.length, 1, stdout);
  const row = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(row).sort(), ['jobs_run', 'ms', 'ran', 'skipped', 'stale']);
  for (const value of Object.values(row)) assert.ok(Number.isFinite(value) && value >= 0);
  return row;
}
test('--once runs the composed runtime, prints one count line, and exits cleanly', t => {
  const child = spawnSync(process.execPath, ['scripts/watch.mjs', '--once'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: temp(t), SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual({ ...counts(child.stdout), ms: 0 }, { ran: 0, skipped: 0, stale: 0, jobs_run: 0, ms: 0 });
  assert.match(child.stderr, /session.end/);
  const proof = join(temp(t), 'watch.jsonl');
  writeFileSync(proof, child.stderr.split('\n').filter(line => line.startsWith('{')).join('\n') + '\n');
  const checked = spawnSync(process.execPath, ['spec/log.mjs', proof], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr + checked.stdout);
});

test('--once counts jobs actually run, leaving unrelated queued work alone', t => {
  const dir = temp(t), preload = join(dir, 'queued.mjs');
  writeFileSync(preload, `import { Console } from 'node:console';
    globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
    const { runtime } = await import(${JSON.stringify(pathToFileURL(join(process.cwd(), 'app/src/edge/api/runtime.ts')).href)});
    const at = new Date().toISOString();
    const event = runtime.store.insertEvent({ user_id: 'usr_watch', source: 'watcher_signed_in', action: 'account_stale', actor: 'site', dedupe_key: 'stale', observed_at: at, effective_at: at, trace_id: 'test' }).row;
    for (const kind of ['relink', 'import']) runtime.store.insertJob({ user_id: event.user_id, event_id: event.id, kind, state: 'queued', idempotency_key: kind, args: {}, stages: [], attempts: 0, trace_id: 'test', created_at: at });`);
  const child = spawnSync(process.execPath, ['--import', preload, 'scripts/watch.mjs', '--once'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: dir, SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(counts(child.stdout).jobs_run, 1);
});

test('invalid loop cadence exits with a logged error', t => {
  const child = spawnSync(process.execPath, ['scripts/watch.mjs', '--every-s', '0'], {
    env: { ...process.env, SECONDHAND_DATA_DIR: temp(t), SECONDHAND_LIVE_SITES: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.match(child.stderr, /"event":"error"/);
});

test('SIGTERM during a loop tick finishes that tick before exiting 0', { timeout: 10000 }, async t => {
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
  const child = spawn(process.execPath, ['--import', preload, 'scripts/watch.mjs', '--every-s', '0.01'], {
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
