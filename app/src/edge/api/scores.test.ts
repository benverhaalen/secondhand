import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest } from './scores.ts';

const prefixes = ["scores","sites","citations","experiments"];
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
test('scores: every specified endpoint is registered and declares its answer source', () => {
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
  else if (e.name === 'scores.list') {
    const body = await r.json();
    const { data } = e.response as { data: object[] };
    assert.deepEqual(body.data.slice(0, data.length), data);
    assert.equal(body.data.length, data.length + 1);
    assert.equal(body.data.at(-1).axis, 'success');
    assert.equal(body.data.at(-1).state, 'hidden');
    assert.equal(body.data.at(-1).hide_reason, 'source_gap');
  } else assert.deepEqual(await r.json(), e.response);
});
for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor')) test(e.name + ': wrong user cannot read or act on example data', async () => {
  const r = await call(e, { token: 'other' });
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
test('scores: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('scores: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["experiments.consent",{"on":"yes"}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('scores: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'scores') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('citations: a Genie proof citation can be opened only by its owner', async () => {
  const { ports, citationOwners } = await import('./genie.ts');
  const citation = { id: 'ci_testproof', metric: 'genie', filters: { sql: 'select site from user_sales' }, table_versions: [], definition_version: '1', code_version: 'genie-1', param_versions: {}, model_version: null, computed_at: '2026-11-15T05:00:00Z', basis_ids: ['user_sales'], basis_hash: 'hash' };
  ports.proof.cite(citation); citationOwners.set(citation.id, 'usr_other');
  const e = examples.find(e => e.name === 'citations.get')!;
  const own = await call(e, { path: '/v1/citations/' + citation.id, token: 'other' });
  assert.equal(own.status, 200);
  const body = await own.json(); assert.equal(body.id, citation.id); assert.equal(body.basis_count, 1); assert.equal(body.definition_version, 1); assert.deepEqual(body.filters, citation.filters);
  const foreign = await call(e, { path: '/v1/citations/' + citation.id, token: 'good' });
  assert.equal(foreign.status, 404);
});

test('scores: match is a valid subject type; an unknown match is 404 rather than a shape error', async () => {
  const e = examples.find(e => e.name === 'scores.list')!;
  const r = await call(e, { path: '/v1/scores?subject_type=match&subject_id=mt_unknown' });
  assert.equal(r.status, 404);
});

test('scores: explicit pagination works when the default example omits next_cursor', async () => {
  const e = examples.find(e => e.name === 'scores.list')!;
  const first = await (await call(e, { path: e.path + '&limit=1' })).json();
  assert.equal(first.data.length, 1); assert.equal(typeof first.next_cursor, 'string');
  const second = await (await call(e, { path: e.path + '&limit=1&cursor=' + first.next_cursor })).json();
  assert.equal(second.data.length, 1); assert.notEqual(second.data[0].id, first.data[0].id); assert.equal(typeof second.next_cursor, 'string');
  const third = await (await call(e, { path: e.path + '&limit=1&cursor=' + second.next_cursor })).json();
  assert.equal(third.data.length, 1); assert.equal(third.data[0].axis, 'success'); assert.equal(third.next_cursor, null);
});

test('scores run successScore from the typed utility input', async () => {
  const { ports } = await import('./scores.ts');
  const read = ports.read;
  try {
    ports.read = async () => {
      const x = await read('usr_8f2k', 'ls_e81');
      return { ...x, axes: ['financial', 'quality', 'visibility', 'trend'].map(axis => ({ axis, state: 'shown', value: .8, citation_id: 'ci_axis' })),
        now: { expected_keep_cents: 8000, expected_days: 0, holding_cost_cents: 0 }, best: { expected_keep_cents: 10000, expected_days: 0, holding_cost_cents: 0 }, basis: [{ id: 'sale1', source: 'test', at: x.as_of }] };
    };
    const response = await call(examples.find(e => e.name === 'scores.list')!);
    const body = await response.json();
    const success = body.data.find((row: { axis: string }) => row.axis === 'success');
    assert.equal(success.value, 80); assert.equal(success.state, 'shown');
    const visibility = body.data.find((row: { axis: string }) => row.axis === 'visibility');
    assert.equal(visibility.value, .8); assert.equal(visibility.state, 'shown'); assert.equal(visibility.hide_reason, undefined);
  } finally { ports.read = read; }
});

for (const e of examples.filter(e => e.status < 400 && !(false))) {
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
