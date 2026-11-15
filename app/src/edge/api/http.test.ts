import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { ApiError, deps, params, paramsOf, route, served } from './http.ts';
import { example } from './examples.ts';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

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
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.now();
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

test('the visitor limiter map stays bounded under 20000 distinct connecting addresses and evicts oldest', async () => {
  let address = 0;
  deps.now = () => 0;
  deps.connectingAddress = () => `peer-${address}`;
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  for (; address < 20000; address++) {
    assert.equal((await call(h, '/v1/search', { token: null })).status, 200);
    assert.ok(deps.visits.size <= 10000, 'visitor limiter exceeded its declared maximum');
  }
  assert.equal(deps.visits.size, 10000);
  assert.ok(!deps.visits.has('peer-0'), 'oldest address must be evicted');
  assert.ok(deps.visits.has('peer-19999'));
  deps.now = () => 60000;
  await call(h, '/v1/search', { token: null });
  assert.equal(deps.visits.size, 1, 'entries past their window must be removed');
});

test('the visitor maximum reads its declared param and never inserts beyond that capacity', async () => {
  const visits = deps.visits;
  params.declare({ name: 'visitor_max_entries', family: 'scalar', prior: 2 });
  deps.visits = new class extends Map<string, { window: number; n: number }> {
    override set(key: string, value: { window: number; n: number }) {
      super.set(key, value);
      assert.ok(this.size <= 2, 'visitor map inserted beyond its param maximum');
      return this;
    }
  }();
  let address = 0;
  deps.connectingAddress = () => `peer-${address++}`;
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  try {
    for (let i = 0; i < 3; i++) assert.equal((await call(h, '/v1/search', { token: null })).status, 200);
  } finally {
    deps.visits = visits;
    params.declare({ name: 'visitor_max_entries', family: 'scalar', prior: 10000, guard_lo: 1 });
  }
});

test('20 visits per minute for five minutes reset even behind a current-window bucket; 31 in one minute is limited', async () => {
  let minute = 1;
  deps.now = () => minute * 60000;
  deps.visits.set('peer-current', { window: minute, n: 1 });
  deps.visits.set('192.0.2.1', { window: minute - 1, n: 20 });
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

test('each visit moves its bucket to the end so capacity eviction removes the least recently visited', async () => {
  deps.now = () => 0;
  params.declare({ name: 'visitor_max_entries', family: 'scalar', prior: 2 });
  let address = 'peer-a';
  deps.connectingAddress = () => address;
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  try {
    for (address of ['peer-a', 'peer-b', 'peer-a', 'peer-c']) {
      assert.equal((await call(h, '/v1/search', { token: null })).status, 200);
    }
    assert.deepEqual([...deps.visits.keys()], ['peer-a', 'peer-c'], 'a refreshed bucket kept its old Map position');
    deps.now = () => 60000;
    await call(h, '/v1/search', { token: null });
    assert.deepEqual([...deps.visits.keys()], ['peer-c'], 'expired buckets survived front-of-map cleanup');
  } finally {
    params.declare({ name: 'visitor_max_entries', family: 'scalar', prior: 10000, guard_lo: 1 });
  }
});

test('without SECONDHAND_PEER_HEADER visitor ids have separate buckets and only the 31st visit is limited', async () => {
  deps.connectingAddress = await connectingAddress(undefined);
  deps.now = () => 0;
  const h = route('GET /v1/search', () => ({ status: 200, body: {} }), { auth: 'visitor' });
  assert.equal(deps.connectingAddress(new Request('http://edge.test', { headers: { 'X-Forwarded-For': '198.51.100.1', 'X-Real-IP': '203.0.113.1', Cookie: 'visitor=shared' } })), null);
  assert.equal((await call(h, '/v1/search', { token: null, headers: { 'X-Visitor-Id': 'vis_visitor2' } })).status, 200);
  for (let n = 1; n <= 31; n++) {
    const response = await call(h, '/v1/search', { token: null, headers: { 'X-Visitor-Id': 'vis_visitor1' } });
    assert.equal(response.status, n <= 30 ? 200 : 429, `visitor 1 visit ${n}`);
  }
  assert.equal((await call(h, '/v1/search', { token: null, headers: { 'X-Visitor-Id': 'vis_visitor2' } })).status, 200);
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
    deps.visits.clear();
    const headers = new Headers({ 'X-Forwarded-For': '198.51.100.1', 'X-Real-IP': '203.0.113.1', Cookie: 'visitor=shared' });
    if (peer !== undefined) headers.set('X-Host-Peer', peer);
    assert.equal(deps.connectingAddress(new Request('http://edge.test', { headers })), null);
    for (const [visitor, status] of [['vis_visitor1', 200], ['vis_visitor2', 200], ['vis_visitor1', 429]] as const) {
      headers.set('X-Visitor-Id', visitor);
      assert.equal((await call(h, '/v1/search', { token: null, headers })).status, status);
    }
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
    execFileSync(process.execPath, [new URL('../../../../spec/log.mjs', import.meta.url).pathname, file]);
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
