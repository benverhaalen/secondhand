import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest, resetItems } from './items.ts';

const prefixes = ["items"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(t => {
  const fixture = examples.find(e => t.name.startsWith(e.name + ':'));
  const body = fixture?.request?.body as { version?: number } | undefined;
  resetItems(fixture?.endpoint === 'PATCH /v1/items/:id/attributes/:name' ? body?.version : undefined);
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
test('items: every specified endpoint is registered and declares its answer source', () => {
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
test('items: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('items: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["items.patch",{"version":12,"cost":{"amount_cents":1.5,"currency":"USD"}}],["items.strategy",{"version":15,"plan_choice":"unknown","floor_cents":{"amount_cents":7,"currency":"USD"}}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

for (const name of ['items.get.not_found', 'items.patch.bad_body', 'items.strategy.below_floor']) test(name + ': failure matches its example', async () => {
  const e = examples.find(e => e.name === name)!; const r = await call(e);
  assert.equal(r.status, e.status); assert.deepEqual(await r.json(), e.response);
});

test('items: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'items') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('item card rejects attributes without evidence through the engine port', async () => {
  const { ports } = await import('./items.ts');
  const read = ports.read;
  try {
    ports.read = async (user, id) => {
      const row = await read(user, id);
      assert.ok(row);
      row.attributes[0].evidence = [];
      return row;
    };
    const response = await call(examples.find(e => e.name === 'items.get')!);
    assert.equal(response.status, 503, 'assembleCard must check the port data');
  } finally { ports.read = read; }
});

test('attribute corrections use mergeAttribute and are visible on the next card read', async () => {
  resetItems(13);
  const corrected = examples.find(e => e.name === 'items.attribute.correct')!;
  assert.equal((await call(corrected)).status, 200);
  const response = await call(examples.find(e => e.name === 'items.get')!);
  const body = await response.json();
  const size = body.attributes.find((a: { name: string }) => a.name === 'size');
  assert.equal(size.value, 'XL'); assert.equal(size.source, 'you_said'); assert.equal(size.confirmed, true);
});

test('plan choices take their objective from the valuation plan engine', async () => {
  const { planPorts } = await import('./items.ts');
  const read = planPorts.read;
  try {
    planPorts.read = async id => {
      const value = await read(id);
      value.choices[1].objective = 'balanced';
      return value;
    };
    const response = await call(examples.find(e => e.name === 'items.plan_choices')!);
    assert.equal((await response.json()).choices[1].objective, 'quick');
  } finally { planPorts.read = read; }
});

test('an attribute edit refuses a stale item version after a successful edit', async () => {
  resetItems(13);
  const e = examples.find(e => e.name === 'items.attribute.correct')!;
  assert.equal((await call(e)).status, 200);
  const second = await call(e);
  assert.equal(second.status, 409);
});

test('concurrent attribute corrections cannot overwrite the same item version', async () => {
  resetItems(13);
  const e = examples.find(e => e.name === 'items.attribute.correct')!;
  const responses = await Promise.all([call(e), call(e, { body: { version: 13, value: 'M' } })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
});
