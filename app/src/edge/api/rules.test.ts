import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest } from './rules.ts';
import { runtime, createRuntime } from './runtime.ts';
import { memoryStore } from '../events/ports.ts';

process.env.SECONDHAND_LIVE_SITES = '';

const prefixes = ["rules","limits"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(t => {
  Object.assign(runtime, createRuntime(memoryStore(), createLog({ src: 'test', build: 'test', sink: memorySink() })));
  if (t.name.startsWith('rules.delete:')) runtime.store.put('rule', { ...(examples.find(e => e.name === 'rules.promote')!.response as Record<string, unknown>), version: undefined, id: 'ru_b2', user_id: 'usr_8f2k' });
  deps.verify = async token => token === 'good' ? 'usr_8f2k' : token === 'other' ? 'usr_other' : null;
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.now();
});
const call = (e: Example, options: { body?: unknown; raw?: string; path?: string; token?: string | null; headers?: Record<string, string> } = {}) => {
  const token = options.token === undefined ? (e.auth === 'visitor' ? null : 'good') : options.token;
  const entry = manifest.find(m => m.endpoint === e.endpoint)!;
  return route(e.endpoint, handlers[e.endpoint], { auth: entry.auth })(new Request('http://edge.test' + (options.path ?? e.path), {
    method: e.endpoint.split(' ')[0],
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...e.request?.headers, ...options.headers },
    body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : e.request?.body === undefined ? undefined : JSON.stringify(e.request.body)),
  }));
};
test('rules: every specified endpoint is registered and declares its answer source', () => {
  assert.deepEqual(Object.keys(handlers).sort(), [...new Set(examples.filter(e => e.status < 400).map(e => e.endpoint))].sort());
  assert.deepEqual(manifest.map(m => m.endpoint).sort(), Object.keys(handlers).sort());
  for (const m of manifest) assert.ok(['example', 'engine'].includes(m.source));
});
for (const e of examples.filter(e => e.status < 400)) test(e.name + ': response equals its contract example', async () => {
  const r = await call(e);
  assert.equal(r.status, e.status);
  assert.ok(r.headers.get('X-Request-Id'));
  for (const [key, value] of Object.entries(e.headers ?? {})) assert.equal(r.headers.get(key), value);
  if (e.response === null) assert.equal(await r.text(), '');
  else assert.deepEqual(await r.json(), e.response);
});
for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor')) test(e.name + ': wrong user cannot read or act on example data', async () => {
  const r = await call(e, { token: 'other' });
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});
for (const e of examples.filter(e => e.status < 400 && e.endpoint.includes(':id'))) test(e.name + ': unknown resource is 404', async () => {
  const pattern = e.endpoint.split(' ')[1].split('/'), parts = e.path.split('?')[0].split('/');
  parts[pattern.indexOf(':id')] = 'not_mine';
  const r = await call(e, { path: parts.join('/') });
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});
for (const e of examples.filter(e => e.status < 400 && ['POST', 'PATCH', 'PUT'].includes(e.endpoint.split(' ')[0]))) test(e.name + ': malformed body is 400 with code', async () => {
  for (const raw of ['{', '[]', 'null']) {
    const r = await call(e, { raw }); assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
  if (e.request?.body && Object.keys(e.request.body).length) {
    const r = await call(e, { body: {} }); assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
});
for (const e of examples.filter(e => e.status < 400 && e.endpoint.startsWith('POST '))) test(e.name + ': reconnect replays same action and rejects changed body', async () => {
  const headers = { 'Idempotency-Key': 'test_reconnect', ...(e.auth === 'visitor' ? { 'X-Visitor-Id': 'vis_worker01' } : {}) };
  const first = await call(e, { headers }), again = await call(e, { headers });
  assert.equal(again.status, first.status); assert.equal(await again.text(), await first.text());
  assert.equal(again.headers.get('Idempotent-Replayed'), 'true');
  const changed = await call(e, { headers, body: { ...((e.request?.body ?? {}) as object), changed: true } });
  assert.equal(changed.status, 409); assert.equal((await changed.json()).code, 'idempotency_mismatch');
});

for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor')) test(e.name + ': no bearer is 401', async () => {
  assert.equal((await call(e, { token: null })).status, 401);
});
for (const e of examples.filter(e => e.status < 400 && e.request?.body && typeof e.request.body === 'object' && 'version' in e.request.body)) test(e.name + ': stale version cannot act', async () => {
  const body = e.request!.body as Record<string, unknown>;
  const r = await call(e, { body: { ...body, version: Number(body.version) + 100 } });
  assert.equal(r.status, 409); const error = await r.json(); assert.equal(error.code, 'stale'); assert.equal(error.current.version, body.version);
});
test('rules: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('rules: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["rules.promote",{"from_decision_id":123}],["limits.put",{"version":5,"ask_every_time":"yes"}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('rules.create.locked: policy failure matches its example', async () => {
  const e = examples.find(e => e.name === 'rules.create.locked')!; const r = await call(e);
  assert.equal(r.status, e.status); assert.deepEqual(await r.json(), e.response);
});

test('rules: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'rules') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('limits update is read back from the Store and the previous version becomes stale', async () => {
  const update = examples.find(e => e.name === 'limits.put')!;
  assert.equal((await call(update)).status, 200);
  const current = await (await call(examples.find(e => e.name === 'limits.get')!)).json();
  assert.equal(current.ask_every_time, true); assert.equal(current.items[0].floor_cents.amount_cents, 7500);
  assert.equal((await call(update)).status, 409);
});

test('new rules are listed, deletion persists, and acceptance below the floor is refused', async () => {
  const e = examples.find(e => e.name === 'rules.promote')!;
  const created = await call(e, { body: { kind: 'reply_other', scope: 'it_7c2m' } });
  assert.equal(created.status, 201);
  const rule = await created.json();
  const listed = await (await call(examples.find(e => e.name === 'rules.list')!)).json();
  assert.ok(listed.data.some((r: { id: string }) => r.id === rule.id));
  assert.equal((await call(examples.find(e => e.name === 'rules.delete')!, { path: '/v1/rules/' + rule.id })).status, 204);
  assert.equal((await call(examples.find(e => e.name === 'rules.delete')!, { path: '/v1/rules/' + rule.id })).status, 404);
  const invalid = await call(e, { headers: { 'Idempotency-Key': 'below-floor' }, body: { kind: 'accept_offer', scope: 'it_7c2m', limits: { always_accept_cents: { amount_cents: 6000, currency: 'USD' } } } });
  assert.equal(invalid.status, 422); assert.equal((await invalid.json()).code, 'outside_limits');
});

test('pickup and handover limit edits persist and locked rows cannot be deleted', async () => {
  const e = examples.find(e => e.name === 'limits.put')!;
  const response = await call(e, { body: { version: 5, handover: ['pickup'], pickup_windows: [{ weekday: 'sun', from: '10:00', to: '12:00' }], saved_spot: { label: 'Meeting spot' } } });
  assert.equal(response.status, 200);
  const current = await (await call(examples.find(e => e.name === 'limits.get')!)).json();
  assert.deepEqual(current.handover, ['pickup']); assert.equal(current.saved_spot.label, 'Meeting spot');
  runtime.store.put('rule', { id: 'ru_locked', user_id: 'usr_8f2k', kind: 'share_address', scope: 'all', state: 'auto' });
  const locked = await call(examples.find(e => e.name === 'rules.delete')!, { path: '/v1/rules/ru_locked' });
  assert.equal(locked.status, 403); assert.equal((await locked.json()).code, 'locked');
});

test('a stale rule deletion leaves the rule active', async () => {
  const response = await call(examples.find(e => e.name === 'rules.delete')!, { path: '/v1/rules/ru_c1', headers: { 'If-Match': '0' } });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'stale');
  assert.equal(runtime.store.get('rule', 'usr_8f2k', 'ru_c1')!.state, 'auto');
});
