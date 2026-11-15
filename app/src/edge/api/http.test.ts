import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { ApiError, deps, paramsOf, route, served } from './http.ts';
import { example } from './examples.ts';

const sink = memorySink();
beforeEach(() => {
  sink.lines.length = 0;
  deps.log = createLog({ src: 'test', build: 'test', sink });
  deps.verify = async (t) => (t === 'good' ? 'usr_8f2k' : t === 'other' ? 'usr_other' : null);
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.now();
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

test('an ApiError keeps its code and status; a thrown bug is 503 waking with no internals, and is logged', async () => {
  const h1 = route('GET /v1/items/:id', () => { throw new ApiError('not_found', 'gone', 'read'); });
  const r1 = await call(h1, '/v1/items/it_x');
  assert.equal(r1.status, 404); assert.equal((await r1.json()).code, 'not_found');
  const h2 = route('GET /v1/items/:id', () => { throw new Error('db exploded at host 10.0.0.1'); });
  const r2 = await call(h2, '/v1/items/it_x');
  const b2 = await r2.json();
  assert.equal(r2.status, 503); assert.equal(b2.code, 'waking'); assert.ok(!JSON.stringify(b2).includes('10.0.0.1'));
  assert.ok(sink.lines.some((l) => l.includes('"event":"error"')));
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
