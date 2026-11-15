import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest } from './genie.ts';

const prefixes = ["genie"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(() => {
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
test('genie: every specified endpoint is registered and declares its answer source', () => {
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
test('genie: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('genie: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["genie",{"question":"   "}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('genie: a user-scoped connection calls the existing engine and stores its proof citation', async () => {
  const { makeGenieHandler } = await import('./genie.ts');
  const { memoryProof } = await import('../../engines/proof/proof.ts');
  const proof = memoryProof(); const scopes: string[] = []; const calls: string[] = [];
  const now = Date.parse('2026-11-15T05:00:00Z');
  const handler = makeGenieHandler({ proof, snapshot: async () => ({ rows: [{ id: 'sale_1', source: 'user_sales', at: '2026-11-15T05:00:00Z' }], cite: { metric: 'genie', filters: {}, table_versions: [{ table: 'user_sales', version: 7 }], definition_version: '1', code_version: 'test', param_versions: {}, model_version: null } }), forUser: async user_id => {
    scopes.push(user_id);
    return { host: 'https://genie.test', space_id: 'user_space', token: async () => 'fixture', now: () => now, log: deps.log,
      fetch: async input => {
        const path = String(input); calls.push(path);
        if (path.endsWith('start-conversation')) return Response.json({ conversation_id: 'conversation', message_id: 'message' });
        if (path.endsWith('query-result')) return Response.json({ statement_response: { manifest: { schema: { columns: [{ name: 'site' }] }, total_row_count: 1 }, result: { data_array: [['depop']] } } });
        return Response.json({ status: 'COMPLETED', last_updated_timestamp: now, attachments: [{ attachment_id: 'query', query: { query: 'select site from user_sales' } }, { text: { content: 'Depop.' } }] });
      },
    };
  } });
  const response = await route('POST /v1/genie', handler)(new Request('http://edge.test/v1/genie', { method: 'POST', headers: { Authorization: 'Bearer other' }, body: JSON.stringify({ question: 'Which site?' }) }));
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.answer, 'Depop.'); assert.equal(body.sql, 'select site from user_sales'); assert.deepEqual(body.rows, [['depop']]);
  assert.match(body.citation_id, /^ci_/); assert.ok(proof.citation(body.citation_id));
  assert.deepEqual(scopes, ['usr_other']); assert.equal(calls.length, 3);
});

test('genie: no table is a reported failure, never an uncited answer or a fallback success', async () => {
  const { makeGenieHandler } = await import('./genie.ts');
  const { memoryProof } = await import('../../engines/proof/proof.ts');
  const handler = makeGenieHandler({ proof: memoryProof(), forUser: async () => ({ host: 'https://genie.test', space_id: 'user_space', token: async () => 'fixture', log: deps.log,
    fetch: async input => Response.json(String(input).endsWith('start-conversation') ? { conversation_id: 'conversation', message_id: 'message' } : { status: 'COMPLETED', attachments: [{ text: { content: 'An unsupported claim.' } }] }),
  }) });
  const response = await route('POST /v1/genie', handler)(new Request('http://edge.test/v1/genie', { method: 'POST', headers: { Authorization: 'Bearer good' }, body: JSON.stringify({ question: 'Which site?' }) }));
  assert.equal(response.status, 502); assert.equal((await response.json()).code, 'site_failed');
});

test('genie: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'genie') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('genie: an answer without a replayable table snapshot is refused', async () => {
  const { makeGenieHandler } = await import('./genie.ts');
  const { memoryProof } = await import('../../engines/proof/proof.ts');
  const handler = makeGenieHandler({ proof: memoryProof(), forUser: async () => ({ host: 'https://genie.test', space_id: 'user_space', token: async () => 'fixture', log: deps.log,
    fetch: async input => Response.json(String(input).endsWith('start-conversation') ? { conversation_id: 'conversation', message_id: 'message' } : String(input).endsWith('query-result') ? { statement_response: { manifest: { schema: { columns: [{ name: 'site' }] } }, result: { data_array: [['depop']] } } } : { status: 'COMPLETED', attachments: [{ attachment_id: 'query', query: { query: 'select site from user_sales' } }] }),
  }) });
  const response = await route('POST /v1/genie', handler)(new Request('http://edge.test/v1/genie', { method: 'POST', headers: { Authorization: 'Bearer good' }, body: JSON.stringify({ question: 'Which site?' }) }));
  assert.equal(response.status, 503); const error = await response.json(); assert.equal(error.code, 'unavailable'); assert.equal(error.failed_step, 'citation');
});

test('default Genie runs the engine transport and stores the example citation', async () => {
  const { ports } = await import('./genie.ts');
  const response = await call(examples.find(e => e.name === 'genie')!);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(ports.proof.citation(body.citation_id), 'an example-only response has no engine proof');
});
