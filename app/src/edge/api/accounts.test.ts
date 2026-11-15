import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest } from './accounts.ts';
import accountExamples from '../../../../spec/examples/accounts.json' with { type: 'json' };
import { runtime, createRuntime } from './runtime.ts';
import { memoryStore } from '../events/ports.ts';

process.env.SECONDHAND_LIVE_SITES = '';

const prefixes = ["accounts"];
const examples: Example[] = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2])).map(e => e.name === 'accounts.import' ? { ...accountExamples.examples[0], name: e.name } : e);
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
test('accounts: every specified endpoint is registered and declares its answer source', () => {
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
for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor' && (e.endpoint.includes(':id')))) test(e.name + ': wrong user cannot read or act on example data', async () => {
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
test('accounts: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('accounts: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["accounts.connect.ebay",{"site":12}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('accounts: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'accounts') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('accounts: limit slices the list and an opaque cursor resumes without duplicates', async () => {
  const e = examples.find(e => e.name === 'accounts.list')!;
  const first = await (await call(e, { path: '/v1/accounts?limit=1' })).json();
  assert.equal(first.data.length, 1); assert.equal(typeof first.next_cursor, 'string');
  const second = await (await call(e, { path: '/v1/accounts?limit=1&cursor=' + first.next_cursor })).json();
  assert.equal(second.data.length, 1); assert.notEqual(first.data[0].id, second.data[0].id); assert.equal(second.next_cursor, null);
  const invalid = await call(e, { path: '/v1/accounts?cursor=not-a-cursor' });
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).code, 'invalid');
});

test('connect persists an unlinked account and unlink revokes it before the job runs', async () => {
  const { runtime } = await import('./runtime.ts');
  const connected = await call(examples.find(e => e.name === 'accounts.connect.depop')!);
  assert.equal(connected.status, 201);
  const account = runtime.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  assert.ok(account); assert.equal(account.token_ref, undefined);
  assert.equal(account.data, 'example', 'reconnect preserves seeded row provenance');
  assert.equal(await runtime.accounts.byId(account.id), undefined);
  const prior = runtime.store.get('account', 'usr_8f2k', 'acc_po1')!;
  runtime.store.put('account', { ...prior, token_ref: 'test/session' });
  await runtime.vault.put('test/session', { cookies: [], origins: [] });
  assert.ok(await runtime.accounts.byId(prior.id));
  const reply = await call(examples.find(e => e.name === 'accounts.unlink')!);
  assert.equal(reply.status, 202);
  assert.equal(await runtime.accounts.byId(prior.id), undefined);
  const job = runtime.store.getJob((await reply.json()).id)!;
  assert.equal(job.account_id, prior.id); assert.equal(job.kind, 'unlink');
});

test('import preview calls the harness and labels the stored fallback', async () => {
  const { runtime } = await import('./runtime.ts');
  const before = runtime.harness.call;
  let calls = 0;
  runtime.harness.call = async (...args) => { calls++; assert.equal(args[0], 'depop'); assert.equal(args[1], 'read_listings'); assert.equal(args[2]?.account_id, 'acc_dp1'); return before(...args); };
  try {
    const response = await call(examples.find(e => e.name === 'accounts.import_preview')!);
    assert.equal(response.status, 200); assert.equal(calls, 1);
    assert.equal(response.headers.get('X-Secondhand-Source'), 'stored');
  } finally { runtime.harness.call = before; }
});

test('an import job creates live rows once and links an existing match without duplicating the item', async () => {
  const response = await call(examples.find(e => e.name === 'accounts.import')!);
  assert.equal(response.status, 202);
  const job = await response.json();
  await runtime.pipeline.runOnce(1);
  const saved = runtime.store.getJob(job.id)!;
  assert.equal(saved.state, 'done');
  const result = saved.result as { item_ids: string[] };
  assert.equal(result.item_ids.length, 2);
  assert.ok(result.item_ids.includes('it_7c2m'));
  assert.equal(runtime.store.rows('item', { user_id: 'usr_8f2k' }).filter(row => row.id === 'it_7c2m').length, 1);
});

test('a successful empty live preview replaces cached rows instead of resurrecting old listings', async () => {
  const original = runtime.harness.call;
  runtime.harness.call = async () => ({ ok: true, data: [] as never, meta: { route_id: 'test', adapter_version: '1', ms: 0, fell_back: false, observation_ids: [] } });
  try {
    const response = await call(examples.find(e => e.name === 'accounts.import_preview')!);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).listings, []);
    assert.equal(response.headers.get('X-Secondhand-Source'), 'live');
  } finally { runtime.harness.call = original; }
});

test('a delayed unlink job cannot revoke a newer sign-in on the same account', async () => {
  const unlinked = await call(examples.find(e => e.name === 'accounts.unlink')!, { path: '/v1/accounts/acc_dp1' });
  assert.equal(unlinked.status, 202);
  await call(examples.find(e => e.name === 'accounts.connect.depop')!);
  const row = runtime.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  runtime.store.put('account', { ...row, token_ref: 'test/new-session' });
  await runtime.vault.put('test/new-session', { cookies: [], origins: [] });
  await runtime.pipeline.runOnce(1);
  assert.ok(await runtime.accounts.byId('acc_dp1'));
});

test('offline linked preview reports no_route, and a stale unlink leaves the link intact', async () => {
  const row = runtime.store.get('account', 'usr_8f2k', 'acc_dp1')!;
  const linked = runtime.store.put('account', { ...row, token_ref: 'test/session' });
  await runtime.vault.put('test/session', { cookies: [], origins: [] });
  const preview = await call(examples.find(e => e.name === 'accounts.import_preview')!);
  assert.equal(preview.status, 200); assert.equal(preview.headers.get('X-Secondhand-Reason'), 'no_route');
  assert.deepEqual(await preview.json(), examples.find(e => e.name === 'accounts.import_preview')!.response);
  const response = await call(examples.find(e => e.name === 'accounts.unlink')!, { path: '/v1/accounts/acc_dp1', headers: { 'If-Match': String(linked.version! - 1) } });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'stale');
  assert.ok(await runtime.accounts.byId('acc_dp1'));
});


test('new people list empty accounts, connect their own and cannot act on each others ids', async () => {
  const byName = (name: string) => examples.find(e => e.name === name)!;
  const empty = await call(byName('accounts.list'), { token: 'other' });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { data: [], next_cursor: null });
  const connected = await call(byName('accounts.connect.depop'), { token: 'other' });
  assert.equal(connected.status, 201);
  const account = await connected.json();
  assert.notEqual(account.id, 'acc_dp1');
  const own = runtime.store.get('account', 'usr_other', account.id)!;
  assert.ok(own); assert.equal(own.data, undefined);
  const listed = await (await call(byName('accounts.list'), { token: 'other' })).json();
  assert.deepEqual(listed.data.map((row: { id: string }) => row.id), [account.id]);
  for (const [name, suffix] of [['accounts.unlink', ''], ['accounts.import_preview', '/import-preview'], ['accounts.import', '/import']]) {
    assert.equal((await call(byName(name), { path: '/v1/accounts/' + account.id + suffix })).status, 404, name);
    assert.equal((await call(byName(name), { token: 'other', path: '/v1/accounts/acc_dp1' + suffix })).status, 404, name);
  }
  assert.equal((await call(byName('accounts.unlink'), { token: 'other', path: '/v1/accounts/' + account.id })).status, 202);
});

test('successful harness listing reads carry live site provenance', async () => {
  const original = runtime.harness.call;
  runtime.harness.call = async () => ({ ok: true, data: [{ external_id: 'dp-1001', title: 'Test', price_cents: 1000 }] as never, meta: { route_id: 'test', adapter_version: '1', ms: 0, fell_back: false, observation_ids: [] } });
  try {
    assert.equal((await call(examples.find(e => e.name === 'accounts.import_preview')!)).status, 200);
    const rows = runtime.store.rows('listing', { user_id: 'usr_8f2k', external_id: 'dp-1001' });
    assert.equal(rows.find(row => row.preview_current === true)?.data, 'live:depop');
    assert.equal(rows.find(row => row.id === 'ls_import_dp-1001')?.data, 'example', 'live reads preserve example provenance');
    assert.equal(rows.find(row => row.id === 'ls_import_dp-1001')?.preview_current, false);
  } finally { runtime.harness.call = original; }
});
