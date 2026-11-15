import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { observeLogs } from '../log/index.js';
import type { User } from '../app/src/edge/auth.ts';

test('production start names every missing variable before discovery or listening', async () => {
  const { start } = await import('./main.ts');
  const names = ['NODE_ENV', 'SECONDHAND_DATA_DIR', 'SECONDHAND_PEER_HEADER', 'SECONDHAND_VISITOR_KEY', 'DECISION_SIGNING_KEY', 'SECONDHAND_VAULT_KEY'] as const;
  const previous = names.map(name => process.env[name]);
  try {
    process.env.NODE_ENV = 'production';
    for (const name of names.slice(1)) delete process.env[name];
    await assert.rejects(start({ port: -1, ticks: false }), {
      message: `Missing production variables: ${names.slice(1).join(', ')}`,
    });
    const value = randomBytes(32).toString('hex');
    process.env.SECONDHAND_VAULT_KEY = value;
    await assert.rejects(start({ port: -1, ticks: false }), {
      message: `Missing production variables: ${names.slice(1, -1).join(', ')}`,
    });
  } finally {
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i];
    });
  }
});

test('a fresh production entry reports all missing variables before database initialization', () => {
  const env = { ...process.env, NODE_ENV: 'production' };
  const names = ['SECONDHAND_DATA_DIR', 'SECONDHAND_PEER_HEADER', 'SECONDHAND_VISITOR_KEY', 'DECISION_SIGNING_KEY', 'SECONDHAND_VAULT_KEY'];
  delete env.NODE_TEST_CONTEXT;
  for (const name of names) delete env[name];
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./main.ts', import.meta.url))], { env, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  const errors = result.stderr.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line) as { event: string; error?: { msg: string } }).filter(line => line.event === 'error');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].error?.msg, `Missing production variables: ${names.join(', ')}`);
});

test('one Node server shares sign-in state, rows and streams across route wrappers', { timeout: 15_000 }, async t => {
  const folder = await mkdtemp(join(tmpdir(), 'secondhand-server-'));
  const previous = process.env.SECONDHAND_DATA_DIR;
  process.env.SECONDHAND_DATA_DIR = folder;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== '127.0.0.1') throw new Error('test disallows outside network');
    return originalFetch(input, init);
  };
  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.SECONDHAND_DATA_DIR; else process.env.SECONDHAND_DATA_DIR = previous;
    await rm(folder, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  const { start } = await import('./main.ts');
  const { store } = await import('../app/src/edge/auth.ts');
  const { runtime } = await import('../app/src/edge/api/runtime.ts');
  const recoverable = runtime.store as typeof runtime.store & { recover?: () => number };
  const previousRecover = recoverable.recover;
  let recoveries = 0;
  recoverable.recover = () => { recoveries++; return 3; };
  t.after(() => { if (previousRecover) recoverable.recover = previousRecover; else delete recoverable.recover; });
  const server = await start({ host: '127.0.0.1', port: 0, ticks: false });
  t.after(() => server.close());
  assert.equal(recoveries, 1);
  const stamp = new Date().toISOString();
  const user: User = {
    id: `usr_${randomBytes(6).toString('hex')}`, locale: 'en-US', currency: 'USD', timezone: 'America/Chicago', disclosure_pref: 'plain',
    target_profit_cents: { amount_cents: 0, currency: 'USD' }, notification_pref: [], experiments_consent: false, tutorial_seen: false,
    last_open_at: stamp, onboarding: { done_steps: [], finished_at: null }, push_token_ref: null, created_at: stamp, updated_at: stamp, version: 1,
  };
  const token = randomBytes(32).toString('base64url');
  await store.createUser(user);
  await store.putSession(createHash('sha256').update(token).digest('hex'), { user_id: user.id, kind: 'access', expires_at: Date.now() + 3600e3, family: 'f1' });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  await t.test('a session planted in auth.ts is recognized by the /v1/me wrapper', async () => {
    const response = await fetch(`${server.url}/v1/me`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, user.id);
  });
  await t.test('two route writes in turn preserve both limits and rule rows', async () => {
    const limits = await fetch(`${server.url}/v1/limits`, { method: 'PUT', headers, body: JSON.stringify({ version: 0, ask_every_time: true }) });
    assert.equal(limits.status, 200, await limits.text());
    const rule = await fetch(`${server.url}/v1/rules`, { method: 'POST', headers, body: JSON.stringify({ kind: 'markdown', scope: 'all' }) });
    assert.equal(rule.status, 201);
    const created = await rule.json();
    const readLimits = await fetch(`${server.url}/v1/limits`, { headers });
    assert.equal((await readLimits.json()).ask_every_time, true);
    const readRules = await fetch(`${server.url}/v1/rules`, { headers });
    assert.ok((await readRules.json()).data.some((row: { id: string }) => row.id === created.id));
  });
  await t.test('404 and 405 preserve the API error shape and healthz bypasses deep health', async () => {
    for (const [path, method, status] of [['/missing', 'GET', 404], ['/v1/me', 'PUT', 405], ['/healthz', 'POST', 405]] as const) {
      const response = await fetch(server.url + path, { method });
      assert.equal(response.status, status);
      const error = await response.json();
      assert.equal(typeof error.code, 'string');
      assert.equal(typeof error.message, 'string');
      assert.equal(error.failed_step, 'route');
      assert.deepEqual(error.retry, { by: 'none' });
      if (status === 405) assert.deepEqual(response.headers.get('allow')?.split(', ').sort(), path === '/healthz' ? ['GET'] : ['DELETE', 'GET', 'PATCH']);
    }
    const response = await fetch(`${server.url}/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
  await t.test('a visitor search returns a job whose SSE stream sends event frames', async () => {
    const response = await fetch(`${server.url}/v1/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'levis 501' }) });
    assert.equal(response.status, 202);
    const visitor = response.headers.get('x-visitor-id');
    assert.ok(visitor);
    const job = await response.json();
    assert.equal(typeof job.id, 'string');
    const controller = new AbortController();
    const events = await fetch(`${server.url}/v1/jobs/${job.id}/events`, { headers: { 'X-Visitor-Id': visitor }, signal: controller.signal });
    assert.equal(events.status, 200);
    assert.match(events.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = events.body!.getReader();
    const frame = await reader.read();
    assert.match(new TextDecoder().decode(frame.value), /event:/);
    await reader.cancel();
    controller.abort();
  });
  await t.test('close resolves despite connected SSE, a client that stops reading, and an unfinished upload', async () => {
    const { jobs } = await import('../app/src/edge/api/jobs.ts');
    const id = `job_${randomBytes(6).toString('hex')}`;
    jobs.put({ id, kind: 'search', state: 'running' }, user.id);
    jobs.append(id, 'job.state', { state: 'running' });
    const response = await fetch(`${server.url}/v1/jobs/${id}/events`, { headers });
    const reader = response.body!.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /event:/);
    const stalledId = `job_${randomBytes(6).toString('hex')}`;
    jobs.put({ id: stalledId, kind: 'search', state: 'running' }, user.id);
    jobs.append(stalledId, 'job.state', { state: 'running' });
    const stalled = await fetch(`${server.url}/v1/jobs/${stalledId}/events`, { headers });
    jobs.append(stalledId, 'job.state', { state: 'running', padding: 'x'.repeat(8 * 1024 * 1024) });
    await new Promise(resolve => setImmediate(resolve));
    const uploadStarted = Promise.withResolvers<void>();
    const unobserve = observeLogs(line => {
      const entry = JSON.parse(line) as { event: string; method?: string; route?: string };
      if (entry.event === 'request.start' && entry.method === 'POST' && entry.route === '/v1/rules') uploadStarted.resolve();
    });
    const uploadErrors: Error[] = [];
    const upload = request(`${server.url}/v1/rules`, { method: 'POST', headers: { ...headers, 'Content-Length': '10000' } });
    upload.on('error', error => uploadErrors.push(error));
    const uploadClosed = new Promise<void>(resolve => upload.once('close', resolve));
    upload.write('{');
    await uploadStarted.promise;
    unobserve();
    const originalClose = runtime.close;
    let closed = 0;
    runtime.close = async () => { closed++; await originalClose(); };
    try {
      await server.close();
      assert.equal(closed, 1);
      assert.equal((await reader.read()).done, true);
      await uploadClosed;
      assert.ok(uploadErrors.every(error => 'code' in error && error.code === 'ECONNRESET'));
      await server.close();
      assert.equal(closed, 1);
    } finally {
      runtime.close = originalClose;
      upload.destroy();
      await reader.cancel();
      await stalled.body!.cancel().catch(error => { assert.ok(error instanceof TypeError, 'a forcibly closed fetch stream reports a transport error'); });
      unobserve();
    }
  });
});
