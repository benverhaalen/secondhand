import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest } from './orders.ts';
import { runtime, createRuntime } from './runtime.ts';
import { memoryStore } from '../events/ports.ts';
import { ledger } from '../orders/orders.ts';

const prefixes = ["orders","appointments"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(() => {
  Object.assign(runtime, createRuntime(memoryStore(), createLog({ src: 'test', build: 'test', sink: memorySink() })));
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
test('orders: every specified endpoint is registered and declares its answer source', () => {
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
  if (['items.list', 'conversations.list', 'orders.list'].includes(e.name)) { // a list: a person who owns nothing gets an empty list, never the example rows
    assert.equal(r.status, 200);
    for (const value of Object.values(await r.json() as Record<string, unknown>)) if (Array.isArray(value)) assert.deepEqual(value, [], `${e.name} shows another person's rows`);
    return;
  }
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'unavailable');
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
  if (e.request?.body && Object.keys(e.request.body).length && e.name !== 'orders.ship') {
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
test('orders: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('orders: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["orders.bought_it",{"kind":"purchase","match_id":"mt_77","price_cents":{"amount_cents":-1,"currency":"USD"},"site":"mercari"}],["orders.labels",{"order_ids":[1],"layout":"letter_2up"}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('orders: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'orders') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('order reads use stored orderBook records rather than fixed money values', async () => {
  const row = runtime.store.get('order', 'usr_8f2k', 'ord_2w8')!;
  assert.ok(row, 'the example order must be seeded in the Store');
  runtime.store.put('order', { ...row, price_cents: 1000 });
  const response = await call(examples.find(e => e.name === 'orders.list')!);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data[0].price_cents.amount_cents, 1000);
});

test('orders: unknown fees stay null in the response and kept stays unknown in the ledger', async () => {
  const { ports } = await import('./orders.ts');
  const row = runtime.store.get('order', 'usr_8f2k', 'ord_2w8')!;
  assert.ok(row, 'the fee check must exercise a stored order');
  runtime.store.put('order', { ...row, fees_cents: null });
  const response = await call(examples.find(e => e.name === 'orders.list')!);
  assert.equal(response.status, 200, 'an unknown fee must not crash the route');
  assert.equal((await response.json()).data[0].fees_cents, null, 'unknown fees must not become money or zero');
  assert.equal(ledger(ports.all('usr_8f2k'))[0].kept_cents, null, 'kept cannot be known before fees');
});

test('orders: a reported zero fee remains known money rather than null', async () => {
  const { ports } = await import('./orders.ts');
  const row = runtime.store.get('order', 'usr_8f2k', 'ord_2w8')!;
  assert.ok(row, 'the fee check must exercise a stored order');
  runtime.store.put('order', { ...row, fees_cents: 0 });
  const response = await call(examples.find(e => e.name === 'orders.list')!);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data[0].fees_cents, { amount_cents: 0, currency: 'USD' });
  const rows = ports.all('usr_8f2k');
  assert.equal(ledger(rows)[0].kept_cents, rows[0].price_cents);
});

test('orders list reads only the requesting person and preserves every integer cent', async () => {
  runtime.store.put('order', { id: 'ord_own', user_id: 'usr_other', kind: 'sale', site: 'depop', item_id: 'it_own', state: 'paid', price_cents: 12345, fees_cents: 345, shipping_cents: 678, payout_cents: 12000 });
  const response = await call(examples.find(e => e.name === 'orders.list')!, { token: 'other' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.data.map((row: { id: string }) => row.id), ['ord_own']);
  for (const [key, amount_cents] of Object.entries({ price_cents: 12345, fees_cents: 345, shipping_cents: 678, payout_cents: 12000 })) assert.deepEqual(body.data[0][key], { amount_cents, currency: 'USD' });
});

for (const e of examples.filter(e => e.status < 400 && !(e.endpoint === 'GET /v1/orders'))) {
  test(e.name + ': two real people receive only the unavailable error, even with examples enabled', async t => {
    const previous = process.env.SECONDHAND_EXAMPLES;
    t.after(() => { if (previous === undefined) delete process.env.SECONDHAND_EXAMPLES; else process.env.SECONDHAND_EXAMPLES = previous; });
    process.env.SECONDHAND_EXAMPLES = '1';
    deps.verify = async token => token === 'good' ? 'usr_real_one' : token === 'other' ? 'usr_real_two' : null;
    for (const token of ['good', 'other']) {
      const headers = { 'Idempotency-Key': 'unbuilt-' + e.name };
      for (const body of [e.request?.body, e.request?.body, { ...((e.request?.body ?? {}) as object), changed: true }]) {
        if (e.endpoint.startsWith('GET ') && body !== undefined) continue;
        const r = await call(e, { token, headers, body });
        assert.equal(r.status, 503, e.endpoint);
        const answer = await r.json();
        assert.deepEqual(Object.keys(answer).sort(), ['code', 'failed_step', 'message', 'retry']);
        assert.equal(answer.code, 'unavailable'); assert.equal(answer.retry.by, 'none');
        assert.equal(typeof answer.message, 'string'); assert.equal(answer.failed_step, 'read');
        assert.notDeepEqual(answer, e.response, 'no contract row or figure may be returned');
      }
    }
  });
  test(e.name + ': disabling examples also refuses the example person', async t => {
    const previous = process.env.SECONDHAND_EXAMPLES;
    t.after(() => { if (previous === undefined) delete process.env.SECONDHAND_EXAMPLES; else process.env.SECONDHAND_EXAMPLES = previous; });
    process.env.SECONDHAND_EXAMPLES = '0';
    const r = await call(e);
    assert.equal(r.status, 503); assert.equal((await r.json()).code, 'unavailable');
  });
}
