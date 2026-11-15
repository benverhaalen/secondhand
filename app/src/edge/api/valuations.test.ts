import { object } from './captures.ts';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest, ports } from './valuations.ts';

const prefixes = ["valuations"];
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
test('valuations: every specified endpoint is registered and declares its answer source', () => {
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
test('valuations: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('valuations: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["valuations.create",{"item_id":1}],["valuations.create",{"url":"file:///etc/passwd"}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('valuations: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'valuations') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('valuation engine result is persisted on the returned job', async () => {
  const { jobs } = await import('./jobs.ts');
  const e = examples.find(e => e.name === 'valuations.create')!;
  const response = await call(e);
  const body = await response.json();
  const job = jobs.get(body.id, 'usr_8f2k');
  assert.ok(job?.result, 'the route must run Check rather than only return a job example');
  assert.ok(object(job.result));
  assert.equal(job.result.product_id, 'pr_4hd1');
});

test('an outside URL stays queued for identity instead of becoming a product id', async () => {
  const { jobs } = await import('./jobs.ts');
  const e = examples.find(e => e.name === 'valuations.appraise_url')!;
  const body = await (await call(e)).json();
  const job = jobs.get(body.id, 'usr_8f2k');
  assert.equal(job?.state, 'queued');
  assert.equal(job?.result, undefined);
});

const create = examples.find(e => e.name === 'valuations.create')!;
const AS_OF = '2026-11-15T16:00:00.000Z';
const comp = (): import('../../engines/valuation/comps.ts').Comp => ({
  comp_id: 'poshmark:recent', site: 'poshmark', sold_at: '2026-11-15T15:00:00.000Z',
  price_cents: 2400, kind: 'sold', level: 'product', condition: 'good',
  w_match: .5, w_extract: .9, may_model: false, citation: 'https://poshmark.com/listing/recent',
});
async function ownItem(extra: Record<string, unknown> = {}) {
  const { store } = await import('./store.ts');
  return store.put('item', { id: 'it_route_owned', user_id: 'usr_other', title: 'Blue jacket', ...extra });
}
async function result(response: Response) {
  assert.equal(response.status, 202);
  const { jobs } = await import('./jobs.ts');
  const { id } = await response.json();
  const job = jobs.get(id, 'usr_other');
  assert.equal(job?.state, 'done');
  assert.ok(object(job.result));
  return job.result;
}
async function withPorts(run: () => Promise<void>) {
  const saved = { ...ports };
  try {
    deps.now = () => Date.parse(AS_OF);
    ports.sources = () => [];
    ports.observations = { read: async () => [], write: async () => {} };
    await run();
  } finally { Object.assign(ports, saved); }
}

test('another person’s item is 404 before observations or sold sources are read', async () => withPorts(async () => {
  const item = await ownItem(); let reads = 0;
  ports.observations.read = async () => { reads++; return []; };
  ports.sources = () => { reads++; return []; };
  const response = await call(create, { body: { item_id: item.id } });
  assert.equal(response.status, 404); assert.equal((await response.json()).code, 'not_found');
  assert.equal(reads, 0);
}));

test('the example item is 404 to a real person before reading observations', async () => withPorts(async () => {
  let reads = 0;
  ports.observations.read = async () => { reads++; return []; };
  const response = await call(create, { token: 'other' });
  assert.equal(response.status, 404); assert.equal((await response.json()).code, 'not_found');
  assert.equal(reads, 0);
}));

test('a missing or deleted owned item is 404 before reading observations', async () => withPorts(async () => {
  let reads = 0;
  ports.observations.read = async () => { reads++; return []; };
  for (const item_id of ['it_absent', (await ownItem({ deleted: true })).id]) {
    const response = await call(create, { body: { item_id }, token: 'other' });
    assert.equal(response.status, 404); assert.equal((await response.json()).code, 'not_found');
  }
  assert.equal(reads, 0);
}));

test('an owned item without product_id prices under its own id and uses its title', async () => withPorts(async () => {
  const item = await ownItem({ kind: 'clothing', condition: 'fair', size: 'M', family_id: 'jackets', floor_cents: 1700 });
  const engine = ports.valuate; let mapped: Parameters<typeof engine>[0] | undefined;
  ports.valuate = async (value, ctx) => { mapped = value; assert.equal(ctx.person, 'usr_other'); assert.ok(ctx.request_id); return engine(value, ctx); };
  ports.sources = (_search, sites, q) => { assert.equal(q.query, 'Blue jacket'); assert.equal(q.condition, 'fair'); assert.deepEqual(sites, ['mercari', 'poshmark']); return []; };
  const priced = await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
  assert.equal(priced.product_id, item.id); assert.equal(priced.condition, 'fair'); assert.equal(priced.fast, null);
  assert.ok(mapped); assert.equal(mapped.floor_cents, 1700); assert.equal(mapped.kind, 'clothing');
  assert.equal(mapped.size, 'M'); assert.equal(mapped.family_id, 'jackets'); assert.equal(mapped.objective, 'balanced');
}));

test('the request clock retains a comp sold one hour before and the thin answer carries its basis', async () => withPorts(async () => {
  const item = await ownItem({ product_id: 'pr_blue' });
  ports.sources = () => [async () => [comp()]];
  const priced = await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
  assert.equal(priced.product_id, 'pr_blue'); assert.equal(priced.condition, 'good');
  assert.equal(priced.as_of, AS_OF); assert.equal(priced.basis_level, 'product');
  assert.ok(Array.isArray(priced.notes) && priced.notes.includes('too_few'));
  assert.ok(object(priced.range)); assert.equal(priced.range_state, priced.range.state); assert.notEqual(priced.range_state, 'checked');
  assert.ok(Array.isArray(priced.comps)); assert.equal(priced.comps[0].comp_id, comp().comp_id);
  assert.ok(object(priced.gather)); assert.equal(priced.gather.reason, 'too_few');
}));

test('shown-only sold comps are cited, written with their rights, and read on the next request', async () => withPorts(async () => {
  const { observationPort } = await import('./valuations.ts');
  const item = await ownItem({ product_id: 'pr_blue' });
  const rows: import('./valuations.ts').ObservationInput[] = [];
  let reads = 0;
  ports.observations = observationPort({
    read: (_user, q) => { reads++; assert.equal(q.purpose, 'show'); assert.equal(q.product_id, 'pr_blue'); return rows; },
    write: (_user, batch) => { rows.push(...batch); },
  }, 'usr_other', deps.log);
  ports.sources = () => [async () => [comp()]];
  const first = await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
  assert.equal(rows.length, 1); assert.equal(rows[0].rights.may_model, false); assert.equal(rows[0].payload.may_model, false);
  assert.equal(rows[0].kind, 'price'); assert.equal(rows[0].subject_ref, comp().comp_id);
  assert.equal(rows[0].observed_at, comp().sold_at); assert.equal(rows[0].data, 'live:poshmark');
  assert.equal(rows[0].source_route, 'valuation.sold'); assert.equal(rows[0].product_id, 'pr_blue');
  assert.deepEqual(rows[0].rights, { may_store: true, may_model: false, may_show: true, may_share: false, ttl: null });
  assert.ok(object(first.citation)); assert.deepEqual(first.citation.basis_ids, [comp().comp_id]);
  ports.sources = () => [];
  const second = await result(await call(create, { body: { item_id: item.id }, token: 'other', headers: { 'Idempotency-Key': 'second-valuation' } }));
  assert.equal(reads, 2); assert.deepEqual(second.range, first.range);
  assert.ok(Array.isArray(second.comps)); assert.equal(second.comps[0].comp_id, comp().comp_id);
  assert.equal(second.comps[0].may_model, false); assert.equal(rows.length, 1);
}));

test('expired and malformed observation rows never enter the basis and malformed payloads are logged', async () => withPorts(async () => {
  const { observationPort } = await import('./valuations.ts');
  const item = await ownItem({ product_id: 'pr_blue' });
  const sink = memorySink(); deps.log = createLog({ src: 'test', build: 'test', sink });
  const row = { payload: comp(), product_id: 'pr_blue', keep_until: '2026-11-15T15:59:59Z' };
  ports.observations = observationPort({ read: () => [row, { payload: { price_cents: 'invalid' } }], write: () => {} }, 'usr_other', deps.log);
  const priced = await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
  assert.deepEqual(priced.comps, []); assert.match(sink.text(), /valuation.observations.invalid/);
}));

for (const fault of ['engine', 'write', 'read'] as const) test(`${fault} failure is logged and fails its job as unavailable with a fixed message`, async () => withPorts(async () => {
  const item = await ownItem();
  const sink = memorySink(); deps.log = createLog({ src: 'test', build: 'test', sink });
  const fail = async (): Promise<never> => { throw new Error('private fault detail'); };
  if (fault === 'engine') ports.valuate = fail;
  else { ports.observations[fault] = fail; ports.sources = () => [async () => [comp()]]; }
  const response = await call(create, { body: { item_id: item.id }, token: 'other' });
  assert.equal(response.status, 503);
  const error = await response.json();
  assert.equal(error.code, 'unavailable'); assert.equal(error.message, 'The valuation could not be finished.');
  const { jobs } = await import('./jobs.ts');
  const job = jobs.st.jobs({ user_id: 'usr_other' }).at(-1);
  assert.equal(job?.state, 'failed');
  assert.deepEqual(job.error, { code: 'unavailable', message: 'The valuation could not be finished.' });
  assert.match(sink.text(), /private fault detail/);
}));

test('an uncomposed observation write is visible in the request log', async () => {
  const saved = ports.sources;
  const item = await ownItem();
  const sink = memorySink(); deps.log = createLog({ src: 'test', build: 'test', sink });
  deps.now = () => Date.parse(AS_OF);
  try {
    ports.sources = () => [async () => [comp()]];
    await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
    const note = sink.lines.map(line => JSON.parse(line)).find(row => row.msg === 'valuation.observations.not_composed');
    assert.equal(note?.rows, 1); assert.ok(note.req);
  } finally { ports.sources = saved; }
});

test('capture_id retains the example valuation path', async () => {
  const { jobs } = await import('./jobs.ts');
  const response = await call(create, { body: { capture_id: 'cap_3n9q' } });
  assert.equal(response.status, 202);
  const { id } = await response.json();
  const job = jobs.get(id, 'usr_8f2k');
  assert.equal(job?.state, 'done'); assert.ok(object(job.result));
  assert.equal(job.result.product_id, 'pr_4hd1');
});

test('the item’s confirmed capture grade and size reach valuation', async () => withPorts(async () => {
  const item = await ownItem({ category: 'clothing', attributes: [
    { name: 'condition', value: 'fair', confirmed: true }, { name: 'size', value: 'M', confirmed: true },
  ] });
  const engine = ports.valuate;
  ports.valuate = async (value, ctx) => {
    assert.equal(value.condition, 'fair'); assert.equal(value.size, 'M'); assert.equal(value.kind, 'clothing');
    return engine(value, ctx);
  };
  const priced = await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
  assert.equal(priced.condition, 'fair');
}));

for (const invalid of [{ condition: 'bogus' }, { extraction_source: 'bogus' }]) test(`an observation with invalid ${Object.keys(invalid)[0]} is skipped and logged`, async () => withPorts(async () => {
  const { observationPort } = await import('./valuations.ts');
  const item = await ownItem();
  const sink = memorySink(); deps.log = createLog({ src: 'test', build: 'test', sink });
  ports.observations = observationPort({ read: () => [{ payload: { ...comp(), ...invalid } }], write: () => {} }, 'usr_other', deps.log);
  const priced = await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
  assert.deepEqual(priced.comps, []); assert.match(sink.text(), /valuation.observations.invalid/);
}));

for (const [captured, grade] of [['like_new', 'excellent'], ['poor', 'for_parts']]) test(`the confirmed capture grade ${captured} prices as ${grade}`, async () => withPorts(async () => {
  const item = await ownItem({ attributes: [{ name: 'condition', value: captured, confirmed: true }] });
  ports.sources = () => [async () => [{ ...comp(), condition: grade }]];
  const priced = await result(await call(create, { body: { item_id: item.id }, token: 'other' }));
  assert.equal(priced.condition, grade); assert.ok(Array.isArray(priced.comps)); assert.equal(priced.comps.length, 1);
}));
