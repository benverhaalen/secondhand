import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import type { SseFrame } from '../edge/api/jobs.ts';

// Metro needs extensionless imports to select .native.ts; Node's TS runner needs the extension.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === new URL('./client.ts', import.meta.url).href && (specifier === './origin' || specifier === './fetch' || specifier === './vault')) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
} });
const { ApiFailure, createClient } = await import('./client.ts');
const { memoryVault } = await import('./vault.ts');
hooks.deregister();

const fixture = JSON.parse(readFileSync(new URL('../buy/fixtures/search-live-levi.json', import.meta.url), 'utf8')) as { start: { id: string }; frames: SseFrame[] };
const encode = (frames: SseFrame[]) => frames.map(f => `id: ${f.id}\nevent: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`).join('');
const done: SseFrame = { id: 1, event: 'job.state', data: { state: 'done' } };
const visitor = 'vis_example01';
type RequestSeen = { url: string; init: RequestInit; headers: Headers };
function fakeFetch(replies: (Response | Error | ((init: RequestInit) => Response | Promise<Response>))[]) {
  const requests: RequestSeen[] = [];
  return { requests, fetch: async (url: string, init: RequestInit = {}) => {
    requests.push({ url, init, headers: new Headers(init.headers) });
    const reply = replies.shift();
    assert.ok(reply, 'unexpected extra fetch');
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply(init) : reply;
  } };
}
function stream(frames: SseFrame[], drop = false) {
  const bytes = new TextEncoder().encode(encode(frames));
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(bytes); },
    pull(controller) { if (drop) controller.error(new Error('connection dropped')); else controller.close(); },
  }));
}

test('the first visitor header is sent on the next call and a later token is sent as Bearer', async () => {
  const transport = fakeFetch([Response.json({}, { headers: { 'X-Visitor-Id': visitor } }), Response.json({})]);
  const client = createClient({ origin: 'https://api.example/', fetch: transport.fetch });
  assert.equal(client.session.token, null);
  assert.equal(client.session.visitor, null);
  await client.call('GET /v1/health');
  client.session.token = 'test-placeholder';
  await client.call('POST /v1/search', { body: { text: 'levi 501' } });
  assert.equal(transport.requests[0].headers.get('Authorization'), null);
  assert.equal(transport.requests[0].headers.get('X-Visitor-Id'), null);
  assert.equal(transport.requests[1].headers.get('X-Visitor-Id'), visitor);
  assert.equal(transport.requests[1].headers.get('Authorization'), 'Bearer test-placeholder');
  assert.equal(transport.requests[1].url, 'https://api.example/v1/search');
  assert.equal(transport.requests[1].headers.get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(String(transport.requests[1].init.body)), { text: 'levi 501' });
});

test('search returns the recorded 202 body and sends text and filters to /v1/search', async () => {
  const transport = fakeFetch([Response.json(fixture.start, { status: 202 })]);
  const client = createClient({ origin: '', fetch: transport.fetch });
  const filters = { max_delivered_cents: 5000 };
  assert.deepEqual(await client.search('levi 501', filters), fixture.start);
  assert.equal(transport.requests[0].url, '/v1/search');
  assert.equal(transport.requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(String(transport.requests[0].init.body)), { text: 'levi 501', filters });
});

test('a 400 server error preserves status, code, message, failed_step and retry', async () => {
  const retry = { by: 'user', after_s: 2 };
  const transport = fakeFetch([Response.json({ code: 'invalid', message: 'text is required', failed_step: 'parse', retry }, { status: 400, headers: { 'X-Visitor-Id': visitor } })]);
  const client = createClient({ origin: '', fetch: transport.fetch });
  await assert.rejects(client.call('POST /v1/search'), (error: unknown) => {
    assert.ok(error instanceof ApiFailure);
    assert.equal(error.status, 400); assert.equal(error.code, 'invalid');
    assert.equal(error.message, 'text is required'); assert.equal(error.failed_step, 'parse');
    assert.deepEqual(error.retry, retry); return true;
  });
  assert.equal(client.session.visitor, visitor);
});

test('a rejected fetch throws unreachable with status zero and retains the cause', async () => {
  const cause = new TypeError('offline'), transport = fakeFetch([cause]);
  await assert.rejects(createClient({ origin: '', fetch: transport.fetch }).call('GET /v1/health'), (error: unknown) => {
    assert.ok(error instanceof ApiFailure); assert.equal(error.code, 'unreachable');
    assert.equal(error.status, 0); assert.equal(error.cause, cause); return true;
  });
});

test('an HTTP error with a non-JSON body remains an ApiFailure with its HTTP status', async () => {
  const transport = fakeFetch([new Response('proxy offline', { status: 502 })]);
  await assert.rejects(createClient({ origin: '', fetch: transport.fetch }).call('GET /v1/health'), (error: unknown) => {
    assert.ok(error instanceof ApiFailure); assert.equal(error.status, 502); return true;
  });
});

test('a missing device origin fails as unreachable before making a request', async () => {
  const transport = fakeFetch([]);
  await assert.rejects(createClient({ origin: null, fetch: transport.fetch }).call('GET /v1/health'), { code: 'unreachable', status: 0 });
  assert.equal(transport.requests.length, 0);
});

test('EOF after fixture frame 5 resumes with Last-Event-ID 5 and the same visitor and token', async () => {
  const transport = fakeFetch([Response.json(fixture.start, { status: 202, headers: { 'X-Visitor-Id': visitor } }), stream(fixture.frames.slice(0, 5)), stream(fixture.frames.slice(5))]);
  const client = createClient({ origin: '', fetch: transport.fetch });
  const start = await client.search('levi 501'); client.session.token = 'test-placeholder';
  const frames: SseFrame[] = [];
  await client.jobFrames(start.id, { onFrame: f => frames.push(f) });
  assert.deepEqual(frames, fixture.frames);
  assert.equal(transport.requests.length, 3);
  assert.equal(transport.requests[1].headers.get('Last-Event-ID'), null);
  assert.equal(transport.requests[2].headers.get('Last-Event-ID'), '5');
  for (const request of transport.requests.slice(1)) {
    assert.equal(request.headers.get('Accept'), 'text/event-stream');
    assert.equal(request.headers.get('X-Visitor-Id'), visitor);
    assert.equal(request.headers.get('Authorization'), 'Bearer test-placeholder');
    assert.equal(request.url, `/v1/jobs/${fixture.start.id}/events`);
  }
});

test('three reconnect drops in a row exhaust the resume budget and throw stream_lost', async () => {
  const transport = fakeFetch([stream(fixture.frames.slice(0, 5)), stream([], true), stream([], true), stream([], true)]);
  await assert.rejects(createClient({ origin: '', fetch: transport.fetch }).jobFrames(fixture.start.id, { onFrame: () => {} }), { code: 'stream_lost', status: 0 });
  assert.equal(transport.requests.length, 4);
  assert.ok(transport.requests.slice(1).every(r => r.headers.get('Last-Event-ID') === '5'));
});

test('a read error discards a partial block before resuming and preserves delivered frames', async () => {
  const partial = encode(fixture.frames.slice(0, 5)) + 'id: 6\nevent: job.';
  const response = new Response(new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(new TextEncoder().encode(partial)); }, pull(c) { c.error(new Error('dropped')); },
  }));
  const transport = fakeFetch([response, stream(fixture.frames.slice(5))]), frames: SseFrame[] = [];
  await createClient({ origin: '', fetch: transport.fetch }).jobFrames(fixture.start.id, { onFrame: f => frames.push(f) });
  assert.deepEqual(frames, fixture.frames);
  assert.equal(transport.requests[1].headers.get('Last-Event-ID'), '5');
});

test('a null body reads text once and still yields every frame', async () => {
  const response = new Response(null); let reads = 0;
  response.text = async () => { reads++; return encode(fixture.frames); };
  const transport = fakeFetch([response]), frames: SseFrame[] = [];
  await createClient({ origin: '', fetch: transport.fetch }).jobFrames(fixture.start.id, { onFrame: f => frames.push(f) });
  assert.equal(reads, 1); assert.deepEqual(frames, fixture.frames);
  assert.equal(transport.requests.length, 1);
});

test('streaming decoding preserves UTF-8 characters split across byte chunks', async () => {
  const frame = { ...done, data: { state: 'done', text: 'café 🧥' } };
  const bytes = new TextEncoder().encode(encode([frame]));
  const response = new Response(new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } }));
  const transport = fakeFetch([response]), frames: SseFrame[] = [];
  await createClient({ origin: '', fetch: transport.fetch }).jobFrames('job_test', { onFrame: f => frames.push(f) });
  assert.deepEqual(frames, [frame]);
});

test('job.state failed is terminal and closes a reader without waiting for EOF', async () => {
  let cancelled = false;
  const frame = { ...done, data: { state: 'failed' } };
  const response = new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(encode([frame]))); }, cancel() { cancelled = true; } }));
  const transport = fakeFetch([response]), frames: SseFrame[] = [];
  await createClient({ origin: '', fetch: transport.fetch }).jobFrames('job_test', { onFrame: f => frames.push(f) });
  assert.deepEqual(frames, [frame]); assert.equal(cancelled, true);
});

test('an HTTP stream refusal propagates its API error without reconnecting', async () => {
  const transport = fakeFetch([Response.json({ code: 'not_found', message: 'wrong visitor' }, { status: 404 })]);
  await assert.rejects(createClient({ origin: '', fetch: transport.fetch }).jobFrames('job_test', { onFrame: () => {} }), { code: 'not_found', status: 404 });
  assert.equal(transport.requests.length, 1);
});

test('a frame callback failure propagates without reconnecting', async () => {
  for (const cause of [new Error('render failed'), new ApiFailure(0, 'unreachable', 'callback failed')]) {
    const transport = fakeFetch([stream([done])]);
    await assert.rejects(createClient({ origin: '', fetch: transport.fetch }).jobFrames('job_test', { onFrame: () => { throw cause; } }), error => error === cause);
    assert.equal(transport.requests.length, 1);
  }
});

test('an already aborted signal ends quietly without fetching or reconnecting', async () => {
  const controller = new AbortController(); controller.abort();
  const transport = fakeFetch([]);
  await createClient({ origin: '', fetch: transport.fetch }).jobFrames('job_test', { signal: controller.signal, onFrame: () => assert.fail('frame after abort') });
  assert.equal(transport.requests.length, 0);
});

test('aborting while a reader waits cancels it and ends quietly without reconnecting', async () => {
  const controller = new AbortController(); let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({ pull() { controller.abort(); }, cancel() { cancelled = true; } }, { highWaterMark: 0 }));
  const transport = fakeFetch([response]);
  await createClient({ origin: '', fetch: transport.fetch }).jobFrames('job_test', { signal: controller.signal, onFrame: () => assert.fail('frame after abort') });
  assert.equal(cancelled, true); assert.equal(transport.requests.length, 1);
});

test('aborting inside onFrame stops delivery of the remaining buffered frames', async () => {
  const controller = new AbortController(), transport = fakeFetch([stream(fixture.frames)]), frames: SseFrame[] = [];
  await createClient({ origin: '', fetch: transport.fetch }).jobFrames('job_test', { signal: controller.signal, onFrame: frame => { frames.push(frame); controller.abort(); } });
  assert.deepEqual(frames, fixture.frames.slice(0, 1)); assert.equal(transport.requests.length, 1);
});

test('origin uses EXPO_PUBLIC_API_ORIGIN when set and same-origin when absent', async () => {
  const before = process.env.EXPO_PUBLIC_API_ORIGIN;
  const fresh = (query: string): Promise<typeof import('./origin.ts')> => import(`./origin.ts?${query}`);
  try {
    process.env.EXPO_PUBLIC_API_ORIGIN = 'https://api.example';
    assert.equal((await fresh('configured')).origin, 'https://api.example');
    delete process.env.EXPO_PUBLIC_API_ORIGIN;
    assert.equal((await fresh('absent')).origin, '');
    process.env.EXPO_PUBLIC_API_ORIGIN = '';
    assert.equal((await fresh('empty')).origin, '');
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_API_ORIGIN;
    else process.env.EXPO_PUBLIC_API_ORIGIN = before;
  }
});

test('a 429 that names the daily cap keeps it, so the chat can say the demo is used up for today', async () => {
  const client = createClient({ origin: '', fetch: async () => new Response(JSON.stringify({ code: 'rate_limited', message: 'cap', retry: { by: 'auto', after_s: 3600 }, cap: 'daily' }), { status: 429 }) });
  await assert.rejects(client.call('POST /v1/assist', { body: { text: 'x' } }), (e: unknown) => e instanceof ApiFailure && e.status === 429 && e.cap === 'daily' && e.retry?.after_s === 3600);
});

// A server that issues one access token per refresh and takes the refresh token it was given, as auth.ts does.
function tokenServer(start = 'a1') {
  let access = start, refresh = 'r1', refreshes = 0;
  const fetch = async (url: string, init: RequestInit = {}) => {
    const path = new URL(url, 'https://api.example').pathname;
    if (path === '/v1/auth/refresh') {
      refreshes++;
      await new Promise(r => setTimeout(r, 20));
      const sent = JSON.parse(String(init.body)).refresh_token;
      if (sent !== refresh) return new Response(JSON.stringify({ code: 'unauthenticated', message: 'reused' }), { status: 401 });
      access = `a${refreshes + 1}`; refresh = `r${refreshes + 1}`;
      return new Response(JSON.stringify({ access_token: access, refresh_token: refresh, expires_at: '2026-11-15T12:00:00Z' }));
    }
    const ok = new Headers(init.headers).get('Authorization') === `Bearer ${access}`;
    return ok ? new Response(JSON.stringify({ ok: true })) : new Response(JSON.stringify({ code: 'unauthenticated', message: 'token expired or unknown' }), { status: 401 });
  };
  return { fetch, expire: () => { access = `x${Math.random()}`; }, get refreshes() { return refreshes; }, get refresh() { return refresh; } };
}
const pair = { access_token: 'a1', refresh_token: 'r1', expires_at: '2026-11-15T11:00:00Z' };

test('the tokens a device kept are sent from the first call after launch', async () => {
  const srv = tokenServer(), vault = memoryVault();
  await vault.set(pair);
  const client = createClient({ origin: '', fetch: srv.fetch, vault });
  assert.deepEqual(await client.call('GET /v1/me'), { ok: true });
});

test('an expired access token is refreshed once and the call retried with the new one; the new pair is kept', async () => {
  const srv = tokenServer(), vault = memoryVault();
  const client = createClient({ origin: '', fetch: srv.fetch, vault });
  await client.signIn(pair);
  srv.expire();
  assert.deepEqual(await client.call('GET /v1/me'), { ok: true });
  assert.equal(srv.refreshes, 1);
  assert.equal((await vault.get())?.refresh_token, srv.refresh);
});

test('five calls that all meet an expired token share one refresh, since a refresh token works once', async () => {
  const srv = tokenServer();
  const client = createClient({ origin: '', fetch: srv.fetch, vault: memoryVault() });
  await client.signIn(pair);
  srv.expire();
  const out = await Promise.all([1, 2, 3, 4, 5].map(() => client.call('GET /v1/today')));
  assert.equal(out.length, 5);
  assert.equal(srv.refreshes, 1, 'one refresh for five 401s');
});

test('a refused refresh signs the device out and the call fails as unauthenticated, without a loop', async () => {
  const srv = tokenServer(), vault = memoryVault();
  const client = createClient({ origin: '', fetch: srv.fetch, vault });
  await client.signIn({ ...pair, refresh_token: 'stale' });
  srv.expire();
  await assert.rejects(client.call('GET /v1/me'), (e: unknown) => e instanceof ApiFailure && e.status === 401);
  assert.equal(srv.refreshes, 1);
  assert.equal(await vault.get(), null);
  assert.equal(client.session.token, null);
});
