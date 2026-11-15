import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { ApiError, deps, paramsOf, route, served } from './http.ts';
import { example } from './examples.ts';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { kv } from '../store/kv.ts';

const sink = memorySink();
let imports = 0;
async function connectingAddress(header: string | undefined) {
  const previous = process.env.SECONDHAND_PEER_HEADER;
  if (header === undefined) delete process.env.SECONDHAND_PEER_HEADER;
  else process.env.SECONDHAND_PEER_HEADER = header;
  try {
    const url = new URL('./http.ts', import.meta.url);
    url.searchParams.set('test', String(++imports));
    const fresh: typeof import('./http.ts') = await import(url.href);
    return fresh.deps.connectingAddress;
  } finally {
    if (previous === undefined) delete process.env.SECONDHAND_PEER_HEADER;
    else process.env.SECONDHAND_PEER_HEADER = previous;
  }
}
beforeEach(() => {
  sink.lines.length = 0;
  deps.log = createLog({ src: 'test', build: 'test', sink });
  deps.verify = async (t) => (t === 'good' ? 'usr_8f2k' : t === 'other' ? 'usr_other' : null);
  deps.now = () => Date.now();
  deps.kv = kv(new DatabaseSync(':memory:'), () => deps.now());
  deps.connectingAddress = () => '192.0.2.1';
  deps.started = false;
  deps.visitorPerMinute = 30;
});
const call = (h: (r: Request) => Promise<Response>, path: string, init: RequestInit & { token?: string | null } = {}) => {
  const headers = new Headers(init.headers);
  if (init.token !== null) headers.set('Authorization', `Bearer ${init.token ?? 'good'}`);
  return h(new Request(`http://edge.test${path}`, { ...init, headers }));
};

test('params come from the endpoint pattern', () => {
  assert.deepEqual(paramsOf('/v1/items/:id/attributes/:name', '/v1/items/it_7c2m/attributes/size'), { id: 'it_7c2m', name: 'size' });
  assert.equal(paramsOf('/v1/items/:id', '/v1/items/it_7c2m/sell'), null);
});

test('a client-sent user_id is ignored: the token wins, in body and query', async () => {
  let seen: unknown;
  const h = route('PATCH /v1/items/:id', (ctx) => { seen = { user: ctx.user_id, body: ctx.body, q: ctx.query.get('user_id'), id: ctx.params.id }; return { status: 200, body: {} }; });
  await call(h, '/v1/items/it_7c2m?user_id=usr_evil', { method: 'PATCH', body: JSON.stringify({ user_id: 'usr_evil', title: 'x' }) });
  assert.deepEqual(seen, { user: 'usr_8f2k', body: { title: 'x' }, q: null, id: 'it_7c2m' });
});

test('no token or a bad token is 401 unauthenticated in the error shape', async () => {
  const h = route('GET /v1/today', () => ({ status: 200, body: {} }));
  for (const token of [null, 'bad']) {
    const r = await call(h, '/v1/today', { token });
    assert.equal(r.status, 401);
    const b = await r.json();
    assert.equal(b.code, 'unauthenticated'); assert.equal(b.retry.by, 'user'); assert.ok('failed_step' in b && typeof b.message === 'string');
  }
});

test('a replayed idempotency key returns the stored response; a different body is 409 idempotency_mismatch', async () => {
  let n = 0;
  const h = route('POST /v1/captures', () => ({ status: 201, body: { id: `cap_${++n}` } }));
  const init = { method: 'POST', headers: { 'Idempotency-Key': 'k1' }, body: JSON.stringify({ mode: 'shots' }) };
  const a = await (await call(h, '/v1/captures', init)).json();
  const second = await call(h, '/v1/captures', init);
  assert.equal(second.status, 201); assert.deepEqual(await second.json(), a); assert.equal(n, 1);
  const other = await call(h, '/v1/captures', { ...init, body: JSON.stringify({ mode: 'scan' }) });
  assert.equal(other.status, 409); assert.equal((await other.json()).code, 'idempotency_mismatch');
  const otherUser = await call(h, '/v1/captures', { ...init, token: 'other' });
  assert.equal((await otherUser.json()).id, 'cap_2', 'keys are per user');
});

test('an ApiError keeps its code and status; a thrown bug is 503 unavailable with no internals, and is logged', async () => {
  const h1 = route('GET /v1/items/:id', () => { throw new ApiError('not_found', 'gone', 'read'); });
  const r1 = await call(h1, '/v1/items/it_x');
  assert.equal(r1.status, 404); assert.equal((await r1.json()).code, 'not_found');
  const h2 = route('GET /v1/items/:id', () => { throw new Error('db exploded at host 10.0.0.1'); });
  const r2 = await call(h2, '/v1/items/it_x');
  const b2 = await r2.json();
  assert.equal(r2.status, 503); assert.equal(b2.code, 'unavailable'); assert.ok(!JSON.stringify(b2).includes('10.0.0.1'));
  assert.ok(sink.lines.some((l) => l.includes('"event":"error"')));
});

test('a client changing a header or cookie still hits the visitor limit', async () => {
  deps.visitorPerMinute = 2;
  const h = route('POST /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  for (let i = 0; i < 3; i++) {
    const r = await call(h, '/v1/search', { method: 'POST', token: null, body: '{}', headers: {
      'X-Visitor-Id': `vis_${String(i).padStart(8, '0')}`, Cookie: `visitor=${i}`,
      'X-Forwarded-For': `198.51.100.${i}`, 'X-Real-IP': `203.0.113.${i}`,
    } });
    assert.equal(r.status, i < 2 ? 200 : 429);
  }
});

test('20 visits per minute for five minutes reset even behind a current-window bucket; 31 in one minute is limited', async () => {
  let minute = 1;
  deps.now = () => minute * 60000;
  deps.kv.incr('visit', 'peer-current', 60000);
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  for (; minute <= 5; minute++) {
    for (let n = 1; n <= 20; n++) {
      assert.equal((await call(h, '/v1/search', { token: null })).status, 200, `minute ${minute}, visit ${n} carried an old count`);
    }
  }
  for (let n = 1; n <= 31; n++) {
    assert.equal((await call(h, '/v1/search', { token: null })).status, n <= 30 ? 200 : 429, `visit ${n} in one minute`);
  }
});

test('without a peer header the issued id keys the limit; forged or dropped ids start fresh buckets', async () => {
  deps.connectingAddress = await connectingAddress(undefined);
  deps.now = () => 0;
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  assert.equal(deps.connectingAddress(new Request('http://edge.test', { headers: { 'X-Forwarded-For': '198.51.100.1', 'X-Real-IP': '203.0.113.1', Cookie: 'visitor=shared' } })), null);
  const first = await call(h, '/v1/search', { token: null });
  const visitor = first.headers.get('X-Visitor-Id')!;
  for (let n = 2; n <= 31; n++) {
    const response = await call(h, '/v1/search', { token: null, headers: { 'X-Visitor-Id': visitor } });
    assert.equal(response.status, n <= 30 ? 200 : 429, `issued visitor request ${n}`);
    if (n === 31) assert.equal((await response.json()).code, 'rate_limited');
  }
  for (let n = 0; n < 31; n++) {
    const response = await call(h, '/v1/search', { token: null, headers: { 'X-Visitor-Id': `vis_${String(n).padStart(32, '0')}` } });
    assert.equal(response.status, 200, 'forged ids are replaced, but without a peer header the new id starts at 1');
    const issued = response.headers.get('X-Visitor-Id')!;
    assert.notEqual(issued, `vis_${String(n).padStart(32, '0')}`);
    assert.equal(deps.kv.get('visit', issued), 1);
  }
  assert.equal((await call(h, '/v1/search', { token: null })).status, 200, 'dropping the id also starts a fresh bucket');
});

test('the configured peer header alone keys the bucket despite rotating visitor ids, forwarding headers and cookies', async () => {
  deps.connectingAddress = await connectingAddress('X-Host-Peer');
  deps.now = () => 0;
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  for (let n = 1; n <= 31; n++) {
    const response = await call(h, '/v1/search', { token: null, headers: {
      'X-Host-Peer': '192.0.2.1', 'X-Visitor-Id': `vis_${String(n).padStart(8, '0')}`,
      'X-Forwarded-For': `198.51.100.${n}`, 'X-Real-IP': `203.0.113.${n}`, Cookie: `visitor=${n}`,
    } });
    assert.equal(response.status, n <= 30 ? 200 : 429, `configured peer visit ${n}`);
  }
  assert.equal((await call(h, '/v1/search', { token: null, headers: { 'X-Host-Peer': '192.0.2.2' } })).status, 200);
});

test('absent or empty configured peer headers return null and fall back to separate visitor ids', async () => {
  deps.connectingAddress = await connectingAddress('X-Host-Peer');
  deps.now = () => 0;
  deps.visitorPerMinute = 1;
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  for (const peer of [undefined, '', '   ']) {
    deps.kv = kv(new DatabaseSync(':memory:'), () => deps.now());
    const headers = new Headers({ 'X-Forwarded-For': '198.51.100.1', 'X-Real-IP': '203.0.113.1', Cookie: 'visitor=shared' });
    if (peer !== undefined) headers.set('X-Host-Peer', peer);
    assert.equal(deps.connectingAddress(new Request('http://edge.test', { headers })), null);
    const first = await call(h, '/v1/search', { token: null, headers });
    const visitor = first.headers.get('X-Visitor-Id')!;
    assert.equal(first.status, 200);
    assert.equal((await call(h, '/v1/search', { token: null, headers })).status, 200);
    headers.set('X-Visitor-Id', visitor);
    assert.equal((await call(h, '/v1/search', { token: null, headers })).status, 429);
  }
});

test('a second request after start is never waking, including an explicit waking dependency error', async () => {
  const h = route('GET /v1/today', () => ({ status: 200, body: {} }));
  await call(h, '/v1/today');
  for (const error of [new Error('slow dependency'), new ApiError('waking', 'dependency starting', 'read', { by: 'auto', after_s: 2 })]) {
    const slow = route('GET /v1/today', () => { throw error; });
    const response = await call(slow, '/v1/today');
    assert.equal(response.status, 503);
    assert.notEqual((await response.json()).code, 'waking');
  }
});

test('only an explicit cold start before the first response can answer waking', async () => {
  const h = route('GET /v1/today', () => { throw new ApiError('waking', 'starting', 'read', { by: 'auto', after_s: 2 }); });
  assert.equal((await (await call(h, '/v1/today')).json()).code, 'waking');
  assert.notEqual((await (await call(h, '/v1/today')).json()).code, 'waking');
});

test('request start and end carry req and the matched route, and the logged HTTP run passes checkLog', async () => {
  const h = route('GET /v1/items/:id', () => ({ status: 200, body: {} }));
  await call(h, '/v1/items/it_private', { headers: { 'X-Request-Id': 'rq_http_log' } });
  await call(h, '/v1/items/it_private', { token: null });
  const requests = sink.lines.map(line => JSON.parse(line)).filter(line => line.event.startsWith('request.'));
  assert.equal(requests.length, 4);
  for (const line of requests) {
    assert.ok(line.req);
    assert.equal(line.route, '/v1/items/:id');
    assert.ok(!JSON.stringify(line).includes('it_private'), 'raw resource path reached a request log');
  }
  deps.log.end();
  const dir = mkdtempSync(join(tmpdir(), 'j2-http-'));
  try {
    const file = join(dir, 'http.jsonl');
    writeFileSync(file, sink.text());
    const { checkLog } = await import('../../../../spec/log.mjs');
    assert.deepEqual(checkLog([[file, readFileSync(file, 'utf8')]]).problems, []);
    execFileSync(process.execPath, [fileURLToPath(new URL('../../../../spec/log.mjs', import.meta.url)), file]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('bad JSON is 400 invalid; request id goes in and out; every request logs start and end', async () => {
  const h = route('POST /v1/assist', () => ({ status: 202, body: {} }));
  const r = await call(h, '/v1/assist', { method: 'POST', headers: { 'X-Request-Id': 'rq_abc' }, body: '{nope' });
  assert.equal(r.status, 400); assert.equal(r.headers.get('X-Request-Id'), 'rq_abc');
  assert.ok(sink.lines.some((l) => l.includes('request.start')) && sink.lines.some((l) => l.includes('request.end')));
});

test('visitors need no token, get a vis_ id back, and are rate limited with after_s', async () => {
  deps.visitorPerMinute = 2;
  const h = route('POST /v1/search', (ctx) => ({ status: 200, body: { v: ctx.visitor_id } }), { auth: 'visitor' });
  const init = { method: 'POST', token: null, body: '{}' } as const;
  const first = await call(h, '/v1/search', init);
  const vid = first.headers.get('X-Visitor-Id')!;
  assert.match(vid, /^vis_/);
  await call(h, '/v1/search', { ...init, headers: { 'X-Visitor-Id': vid } });
  const third = await call(h, '/v1/search', { ...init, headers: { 'X-Visitor-Id': vid } });
  assert.equal(third.status, 429); const b = await third.json();
  assert.equal(b.code, 'rate_limited'); assert.ok(Number.isInteger(b.retry.after_s));
  deps.visitorPerMinute = 30;
});

test('served() answers exactly the endpoint example', async () => {
  const h = route('GET /v1/today', served('GET /v1/today'));
  const r = await call(h, '/v1/today');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), example('today.get').response);
});

test('served() answers only the ids its examples name; another id is 404 not_found', async () => {
  const h = route('GET /v1/items/:id', served('GET /v1/items/:id'));
  assert.equal((await call(h, '/v1/items/it_7c2m')).status, 200);
  const r = await call(h, '/v1/items/it_someoneelse');
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});


test('simultaneous requests with one Idempotency-Key reject the running duplicate then replay the finished response', async () => {
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  let calls = 0;
  const h = route('POST /v1/captures', async () => { calls++; entered(); if (calls === 1) await gate; return { status: 201, body: { id: 'cap_once' } }; });
  const init = { method: 'POST', headers: { 'Idempotency-Key': 'concurrent' }, body: '{}' };
  const first = call(h, '/v1/captures', init);
  await started;
  let second: Response;
  try {
    second = await call(h, '/v1/captures', init);
    assert.equal(second.status, 409);
    assert.deepEqual(await second.json(), { code: 'stale', message: 'the same request is still running', failed_step: 'idempotency', retry: { by: 'auto', after_s: 1 } });
    const mismatch = await call(h, '/v1/captures', { ...init, body: '{"other":true}' });
    assert.equal((await mismatch.json()).code, 'idempotency_mismatch');
    assert.equal(calls, 1);
  } finally { release(); await first; }
  const third = await call(h, '/v1/captures', init);
  assert.equal(third.status, 201);
  assert.equal(third.headers.get('Idempotent-Replayed'), 'true');
  assert.deepEqual(await third.json(), { id: 'cap_once' });
  assert.equal(calls, 1);
});

for (const failure of ['500', 'throw'] as const) test(`${failure} frees the idempotency slot so a retry runs the handler again`, async () => {
  let calls = 0;
  const h = route('POST /v1/captures', () => {
    if (++calls === 1) {
      if (failure === 'throw') throw new Error('handler failed');
      return { status: 500, body: {} };
    }
    return { status: 201, body: { calls } };
  });
  const init = { method: 'POST', headers: { 'Idempotency-Key': failure }, body: '{}' };
  assert.equal((await call(h, '/v1/captures', init)).status, failure === '500' ? 500 : 503);
  assert.equal((await call(h, '/v1/captures', init)).status, 201);
  assert.equal(calls, 2);
});

test('event streams free the idempotency slot without reading their body', async () => {
  let calls = 0;
  const h = route('POST /v1/stream', () => {
    calls++;
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('data: ready\n\n')); } }), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
    response.clone = () => { throw new Error('stream body must not be read for idempotency'); };
    return response;
  });
  const init = { method: 'POST', headers: { 'Idempotency-Key': 'stream' }, body: '{}' };
  const a = await call(h, '/v1/stream', init), b = await call(h, '/v1/stream', init);
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(calls, 2);
  await a.body!.cancel(); await b.body!.cancel();
});

test('forged and old unsigned visitor ids are replaced; a signed id is retained and matches the client regex', async () => {
  const h = route('GET /v1/search', ctx => ({ status: 200, body: { visitor: ctx.visitor_id } }), { auth: 'visitor' });
  for (const forged of ['vis_abcdefghijkl00000000000000000000', 'vis_example01']) {
    const a = await call(h, '/v1/search', { token: null, headers: { 'X-Visitor-Id': forged } });
    const issued = a.headers.get('X-Visitor-Id')!;
    assert.notEqual(issued, forged); assert.equal(issued.length, 36); assert.match(issued, /^vis_[a-z0-9]{8,32}$/);
    assert.equal((await a.json()).visitor, issued);
    const b = await call(h, '/v1/search', { token: null, headers: { 'X-Visitor-Id': issued } });
    assert.equal(b.headers.get('X-Visitor-Id'), issued);
  }
});

test('two route bundles and reopened SQLite handles share idempotency slots and visitor buckets', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'http-shared-'));
  let first = new DatabaseSync(join(dir, 'state.db'));
  const second = new DatabaseSync(join(dir, 'state.db'));
  try {
    const fresh: typeof import('./http.ts') = await import(new URL(`./http.ts?bundle=${++imports}`, import.meta.url).href);
    deps.kv = kv(first, () => deps.now());
    Object.assign(fresh.deps, deps, { kv: kv(second, () => deps.now()) });
    let calls = 0;
    const handler = () => ({ status: 201, body: { calls: ++calls } });
    const a = route('POST /v1/captures', handler), b = fresh.route('POST /v1/captures', handler);
    const init = { method: 'POST', headers: { 'Idempotency-Key': 'shared' }, body: '{}' };
    const original = await call(a, '/v1/captures', init);
    const va = route('GET /v1/search', handler, { auth: 'visitor' }), vb = fresh.route('GET /v1/search', handler, { auth: 'visitor' });
    const visitor = (await call(va, '/v1/search', { token: null })).headers.get('X-Visitor-Id')!;
    first.close(); first = new DatabaseSync(join(dir, 'state.db'));
    deps.kv = kv(first, () => deps.now());
    const replay = await call(b, '/v1/captures', init);
    assert.equal(replay.headers.get('Idempotent-Replayed'), 'true');
    assert.deepEqual(await replay.json(), await original.json()); assert.equal(calls, 2, 'one capture handler and one visitor handler ran');
    for (let i = 1; i <= 30; i++) {
      const response = await call(i % 2 ? va : vb, '/v1/search', { token: null, headers: { 'X-Visitor-Id': visitor } });
      assert.equal(response.status, i < 30 ? 201 : 429);
      assert.equal(response.headers.get('X-Visitor-Id'), visitor, 'both bundles accept the same signed id');
    }
  } finally { first.close(); second.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('finished idempotency slots expire after 24 hours with the injected clock', async () => {
  let now = 0, calls = 0;
  deps.now = () => now;
  const h = route('POST /v1/captures', () => ({ status: 201, body: { calls: ++calls } }));
  const init = { method: 'POST', headers: { 'Idempotency-Key': 'expiry' }, body: '{}' };
  await call(h, '/v1/captures', init);
  now = 86400000 - 1;
  assert.equal((await call(h, '/v1/captures', init)).headers.get('Idempotent-Replayed'), 'true');
  now++;
  assert.equal((await call(h, '/v1/captures', init)).headers.get('Idempotent-Replayed'), null);
  assert.equal(calls, 2);
});
