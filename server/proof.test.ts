import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
type RunningServer = {
  child: ChildProcess;
  closed: boolean;
  exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  error(): Error | undefined;
};

async function within<T>(work: Promise<T>, ms: number, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${step}: timed out after ${ms} ms`)), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('SV0, SV1, SV3: sign in through the routes on the built server, write through two routes, restart, and everything holds', { timeout: 65_000 }, async t => {
  const folder = await mkdtemp(join(tmpdir(), 'secondhand-proof-'));
  const email = 'server-proof@example.invalid';
  const code = '246810';
  let logs = '';
  let accessToken = '';
  let refreshToken = '';
  const safe = (text: string) => [email, code, accessToken, refreshToken].filter(Boolean)
    .reduce((value, secret) => value.replaceAll(secret, '[redacted]'), text);
  const children: RunningServer[] = [];
  t.after(async () => {
    try {
      for (const server of children) {
        if (!server.closed) {
          server.child.kill('SIGKILL');
          await within(server.exit, 10_000, 'cleanup child exit');
        }
      }
    } finally {
      await rm(folder, { recursive: true, force: true });
      if (!t.passed) t.diagnostic(safe(logs));
    }
  });

  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string', 'free port probe has a TCP address');
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  const origin = `http://127.0.0.1:${port}`;

  function launch(): RunningServer {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    env.NODE_ENV = 'development';
    const child = spawn(process.execPath, ['server/main.ts'], {
      cwd: root,
      env: { ...env, SECONDHAND_DATA_DIR: folder, PORT: String(port), SECONDHAND_DEV_CODE: code, SECONDHAND_TICK_S: '30' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { logs += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { logs += chunk; });
    let spawnError: Error | undefined;
    child.once('error', error => { spawnError = error; });
    const server: RunningServer = { child, closed: false, exit: new Promise(resolve => {
      child.once('close', (code, signal) => { server.closed = true; resolve({ code, signal }); });
    }), error: () => spawnError };
    children.push(server);
    return server;
  }

  async function healthy(server: RunningServer, step: string) {
    const deadline = Date.now() + 15_000;
    let last = 'no health response';
    while (Date.now() < deadline) {
      assert.ifError(server.error());
      assert.equal(server.closed, false, `${step}: child exited before /healthz answered`);
      try {
        const response = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(Math.max(1, Math.min(500, deadline - Date.now()))) });
        const body = await response.text();
        if (response.status === 200) return;
        assert.fail(`${step}: GET /healthz -> ${response.status}: ${safe(body)}`);
      } catch (error) {
        if (error instanceof TypeError && error.cause instanceof Error && 'code' in error.cause && error.cause.code === 'ECONNREFUSED') last = error.cause.message;
        else if (error instanceof Error && error.name === 'TimeoutError') last = error.message;
        else throw error;
      }
      await delay(100);
    }
    assert.fail(`${step}: /healthz did not answer 200 within 15 s: ${last}`);
  }

  async function stop(server: RunningServer, step: string) {
    assert.equal(server.closed, false, `${step}: child must still be running`);
    assert.equal(server.child.kill('SIGTERM'), true, `${step}: SIGTERM delivered`);
    const exit = await within(server.exit, 10_000, step);
    assert.deepEqual(exit, { code: 0, signal: null }, `${step}: graceful exit`);
  }

  async function route(step: string, method: string, path: string, status: number, body?: Record<string, unknown>) {
    const response = await fetch(origin + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5_000),
    });
    const text = await response.text();
    assert.equal(response.status, status, `${step}: ${method} ${path} -> ${response.status}: ${safe(text)}`);
    const result: unknown = JSON.parse(text);
    assert.ok(result && typeof result === 'object' && !Array.isArray(result), `${step}: response is an object`);
    return result as Record<string, unknown>;
  }

  const first = launch();
  await healthy(first, 'first startup');
  await route('start email sign-in', 'POST', '/v1/auth/email/start', 202, { email });
  await route('reject wrong code for an active challenge', 'POST', '/v1/auth/email/verify', 401, { email, code: '000000' });
  const signedIn = await route('verify email sign-in', 'POST', '/v1/auth/email/verify', 200, { email, code });
  assert.ok(typeof signedIn.access_token === 'string' && signedIn.access_token.length > 0, 'verification returns an access token');
  assert.ok(typeof signedIn.refresh_token === 'string' && signedIn.refresh_token.length > 0, 'verification returns a refresh token');
  accessToken = signedIn.access_token;
  refreshToken = signedIn.refresh_token;
  const user = signedIn.user as Record<string, unknown>;
  assert.ok(user && typeof user.id === 'string' && user.id.length > 0, 'verification returns a user id');
  assert.equal((await route('cross-route identity', 'GET', '/v1/me', 200)).id, user.id, 'me recognizes the sign-in route user');

  const limits = await route('write limits', 'PUT', '/v1/limits', 200, { version: 0, ask_every_time: true });
  const rule = await route('write rule after limits', 'POST', '/v1/rules', 201, { kind: 'markdown', scope: 'all' });
  assert.ok(typeof rule.id === 'string' && rule.id.length > 0, 'rule write returns an id');
  async function rows(step: string) {
    const readLimits = await route(`${step}: read limits`, 'GET', '/v1/limits', 200);
    assert.equal(readLimits.ask_every_time, true, `${step}: rule write preserved the limits row`);
    assert.equal(readLimits.version, limits.version, `${step}: limits version survives`);
    const readRules = await route(`${step}: read rules`, 'GET', '/v1/rules', 200);
    assert.ok(Array.isArray(readRules.data), `${step}: rules returns a data list`);
    assert.deepEqual(readRules.data.find((row: Record<string, unknown>) => row.id === rule.id), rule, `${step}: rule row survives intact`);
  }
  await rows('before restart');
  await stop(first, 'first shutdown');
  const second = launch();
  await healthy(second, 'restart on the same folder and port');
  assert.equal((await route('same token after restart', 'GET', '/v1/me', 200)).id, user.id, 'persisted token identifies the same user');
  await rows('after restart');
  await stop(second, 'second shutdown');
  assert.equal(logs.includes(code), false, 'child stdout/stderr must not contain the development code');
  assert.equal(logs.includes(email), false, 'child stdout/stderr must not contain the email address');
});
