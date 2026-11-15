import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { manifest, wantsOn, seedWants, runWant } from './wants.ts';
import { memoryStore } from '../events/ports.ts';
let store = memoryStore();
let handlers = wantsOn(store);

const prefixes = ["wants","matches"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(() => {
  store = memoryStore(); seedWants(store); handlers = wantsOn(store);
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
const reloadWants = (query: string): Promise<typeof import('./wants.ts')> => import(new URL('./wants.ts?' + query, import.meta.url).href);
test('wants: every specified endpoint is registered and declares its answer source', () => {
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
  else { const body = await r.json(); if (e.name === 'wants.create') { assert.ok(store.get('want', 'usr_8f2k', body.id)); body.id = (e.response as { id: string }).id; } assert.deepEqual(body, e.response); }
});
for (const e of examples.filter(e => e.status < 400 && e.endpoint.includes(':id'))) test(e.name + ': another person’s specific row is 404', async () => {
  const r = await call(e, { token: 'other' });
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});
test('wants: a signed-in person without wants receives an empty list', async () => {
  const response = await call(examples.find(e => e.name === 'wants.list')!, { token: 'other' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [], next_cursor: null });
});

test('wants: a new person creates, lists, reads and patches only their own want', async () => {
  const create = examples.find(e => e.name === 'wants.create')!;
  const response = await call(create, { token: 'other' });
  assert.equal(response.status, create.status, 'a person needs no seeded want to create one');
  const created = await response.json();
  assert.ok(store.get('want', 'usr_other', created.id), 'the signed-in person owns the new want');
  const list = await call(examples.find(e => e.name === 'wants.list')!, { token: 'other' });
  assert.equal(list.status, 200);
  const page = await list.json();
  assert.deepEqual(page.data.map((row: { id: string }) => row.id), [created.id]);
  assert.equal(page.next_cursor, null);
  const get = examples.find(e => e.name === 'wants.get')!;
  const read = await call(get, { token: 'other', path: '/v1/wants/' + created.id });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).text, created.text);
  const patch = await call(examples.find(e => e.name === 'wants.patch')!, {
    token: 'other', path: '/v1/wants/' + created.id, body: { version: created.version, text: 'Updated want' },
  });
  assert.equal(patch.status, 200);
  const updated = await (await call(get, { token: 'other', path: '/v1/wants/' + created.id })).json();
  assert.equal(updated.text, 'Updated want');
  assert.equal(updated.version, created.version + 1);
  const matches = await call(examples.find(e => e.name === 'wants.matches')!, { token: 'other', path: '/v1/wants/' + created.id + '/matches' });
  assert.equal(matches.status, 200);
  assert.deepEqual(await matches.json(), { data: [], next_cursor: null });
  for (const name of ['wants.get', 'wants.patch', 'wants.matches']) {
    const e = examples.find(e => e.name === name)!;
    const foreign = await call(e, { path: e.path.replace('want_3ss', created.id) });
    assert.equal(foreign.status, 404, name + ': seeded person cannot access the new want');
    assert.equal((await foreign.json()).code, 'not_found');
  }
  for (const name of ['wants.get', 'wants.patch', 'wants.matches', 'matches.act']) {
    const foreign = await call(examples.find(e => e.name === name)!, { token: 'other' });
    assert.equal(foreign.status, 404, name + ': owning a want cannot grant access to another person’s rows');
    assert.equal((await foreign.json()).code, 'not_found');
  }
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
test('wants: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('wants: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["wants.create",{"text":"jacket","max_total_cents":8000,"sites":["ebay"],"alert":"under"}],["wants.patch",{"version":1,"state":"unknown"}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('wants: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'wants') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('wants: create persists once, lists page to null, and edits its stored version', async () => {
  const e = examples.find(e => e.name === 'wants.create')!;
  const first = await call(e, { headers: { 'Idempotency-Key': 'persist-want' } });
  const created = await first.json();
  await call(e, { headers: { 'Idempotency-Key': 'persist-want' } });
  assert.ok(store.get('want', 'usr_8f2k', created.id), 'created want must be stored');
  const list = examples.find(e => e.name === 'wants.list')!;
  let cursor: string | null = null;
  const ids: string[] = [];
  do {
    const response = await call(list, { path: '/v1/wants?limit=1' + (cursor ? '&cursor=' + cursor : '') });
    const page = await response.json();
    ids.push(...page.data.map((r: { id: string }) => r.id)); cursor = page.next_cursor;
    assert.ok(ids.length < 20, 'pagination must terminate');
  } while (cursor);
  assert.equal(ids.filter(id => id === created.id).length, 1);
});

test('wants: repeated seeding and imports preserve edited rows without duplicates', async () => {
  const row = store.get('want', 'usr_8f2k', 'want_3ss')!;
  store.put('want', { ...row, state: 'ended' });
  seedWants(store); seedWants(store);
  assert.equal(store.rows('want', { user_id: 'usr_8f2k' }).length, 1);
  assert.equal(store.get('want', 'usr_8f2k', row.id)?.state, 'ended');
  const { store: shared } = await import('./store.ts');
  const before = structuredClone(shared.rows('want', { user_id: 'usr_8f2k' }));
  await reloadWants('seed-again=1'); await reloadWants('seed-again=2');
  assert.deepEqual(shared.rows('want', { user_id: 'usr_8f2k' }), before);
});

test('wants: stored edits drive reads; old versions and every foreign resource path are refused', async () => {
  const patch = examples.find(e => e.name === 'wants.patch')!;
  assert.equal((await call(patch, { body: { version: 1, text: 'Updated', fit: { attributes: { size: 'L' } }, max_total_cents: { amount_cents: 12000, currency: 'USD' }, sites: ['depop'], schedule: { every_min: 60 }, alert: 'available' } })).status, 200);
  const get = await call(examples.find(e => e.name === 'wants.get')!);
  const row = await get.json(); assert.equal(row.text, 'Updated'); assert.equal(row.version, 2);
  const stale = await call(patch); assert.equal(stale.status, 409); assert.equal((await stale.json()).current.version, 2);
  store.put('want', { id: 'want_foreign', user_id: 'usr_other', state: 'active' });
  store.put('match', { id: 'mt_foreign', user_id: 'usr_other', want_id: 'want_foreign' });
  for (const name of ['wants.get', 'wants.patch', 'wants.matches', 'matches.act']) {
    const e = examples.find(e => e.name === name)!;
    const path = e.path.replace('want_3ss', 'want_foreign').replace('mt_77', 'mt_foreign');
    assert.equal((await call(e, { path })).status, 404, name);
  }
});

test('matches: all actions persist; not_same blocks a later watch alert even on a price move', async () => {
  const act = examples.find(e => e.name === 'matches.act')!;
  for (const [action, state] of [['dismiss', 'dismissed'], ['save', 'saved'], ['bought', 'bought'], ['not_same', 'dismissed']]) {
    const response = await call(act, { body: { action }, headers: { 'Idempotency-Key': action } });
    assert.equal(response.status, 200);
    assert.equal(store.get('match', 'usr_8f2k', 'mt_77')?.state, state);
  }
  assert.equal(store.rows('order', { user_id: 'usr_8f2k' }).length, 0);
  assert.equal(store.get('match', 'usr_8f2k', 'mt_77')?.not_same, true);
  const listings = [{ id: 'listing-new', title: 'Carhartt J97', route_id: 'test', condition: 'used', relation: 'same_product' as const, site: 'mercari', listing_id: 'new', url: 'https://www.mercari.com/us/item/m00000000001', price_cents: 4000, delivered_cents: 4000, size: 'XL', also_on: [], shipping_estimated: false, shipping_cents: 0, tax_rate: 0 }];
  const result = runWant(store, 'want_3ss', listings, [], { user_id: 'usr_8f2k', now: new Date(), localHour: 12, movement: { p50_prior: 100, p50_recent: 50, sales_recent: 20, band90: .1 } });
  assert.deepEqual(result.push, []); assert.deepEqual(result.digest, []);
  assert.equal(store.get('match', 'usr_8f2k', 'mt_77')?.not_same, true);
});

test('watch: real matches and monitor checkpoints persist and paused wants do not alert', async () => {
  const listings = [{ id: 'listing-fresh', title: 'Carhartt J97', route_id: 'test', condition: 'used', relation: 'same_product' as const, site: 'ebay', listing_id: 'fresh', url: 'https://ebay.com/itm/fresh', price_cents: 4000, delivered_cents: 4500, size: 'XL', also_on: [], shipping_estimated: false, shipping_cents: 500, tax_rate: 0 }];
  const opts = { user_id: 'usr_8f2k', now: new Date('2026-11-15T06:00:00Z'), localHour: 12, checked: { ebay: '2026-11-15T06:00:00Z' }, behind: ['mercari'] };
  const result = runWant(store, 'want_3ss', listings, [], opts);
  assert.equal(result.push.length, 1);
  assert.equal(store.get('match', 'usr_8f2k', result.matches[0].id)?.state, 'alerted');
  const response = await call(examples.find(e => e.name === 'wants.list')!);
  const row = (await response.json()).data[0]; assert.deepEqual(row.checked, opts.checked); assert.deepEqual(row.behind, opts.behind);
  const want = store.get('want', 'usr_8f2k', 'want_3ss')!; store.put('want', { ...want, state: 'paused' });
  assert.deepEqual(runWant(store, want.id, listings, [], opts).push, []);
});

test('watch: generated matches keep API money envelopes', async () => {
  const result = runWant(store, 'want_3ss', [{ id: 'ls_test', title: 'J97', route_id: 'test', condition: 'used', relation: 'same_product' as const, site: 'ebay', listing_id: 'api-money', url: 'https://ebay.com/itm/api-money', price_cents: 4000, delivered_cents: 4500, size: 'XL', also_on: [], shipping_estimated: false, shipping_cents: 500, tax_rate: 0 }], [], { user_id: 'usr_8f2k', now: new Date(), localHour: 12 });
  const response = await call(examples.find(e => e.name === 'wants.matches')!);
  const row = (await response.json()).data.find((r: { id: string }) => r.id === result.matches[0].id);
  assert.deepEqual(row.price_cents, { amount_cents: 4000, currency: 'USD' });
  assert.deepEqual(row.delivered_cents, { amount_cents: 4500, currency: 'USD' });
});

test('wants: changed durable creation key is refused after cache loss', async () => {
  const e = examples.find(e => e.name === 'wants.create')!;
  await call(e); deps.idem.clear();
  const response = await call(e, { body: { ...(e.request!.body as object), text: 'Changed request' } });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'idempotency_mismatch');
});

test('watch: stored matches prevent repeat alerts and saved state beats stale caller prior', async () => {
  const listings = [{ id: 'ls_test', title: 'J97', route_id: 'test', condition: 'used', relation: 'same_product' as const, site: 'ebay', listing_id: 'api-state', url: 'https://ebay.com/itm/api-state', price_cents: 4000, delivered_cents: 4500, size: 'XL', also_on: [], shipping_estimated: false, shipping_cents: 500, tax_rate: 0 }];
  const opts = { user_id: 'usr_8f2k', now: new Date(), localHour: 12 };
  const first = runWant(store, 'want_3ss', listings, [], opts);
  const match = first.matches.find(m => m.url === listings[0].url)!;
  const row = store.get('match', 'usr_8f2k', match.id)!; store.put('match', { ...row, state: 'saved' });
  const next = runWant(store, 'want_3ss', listings, first.matches, opts);
  assert.equal(next.matches.find(m => m.id === match.id)?.state, 'saved');
  assert.deepEqual(runWant(store, 'want_3ss', listings, [], opts).push, []);
});

test('wants: file store reopening preserves seed versions and edits', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileStore } = await import('../events/file-store.ts');
  const directory = mkdtempSync(join(tmpdir(), 'int-wants-'));
  try {
    const path = join(directory, 'store.json');
    const first = fileStore(path); seedWants(first);
    const row = first.get('want', 'usr_8f2k', 'want_3ss')!;
    first.put('want', { ...row, state: 'paused' });
    const reopened = fileStore(path); seedWants(reopened);
    assert.equal(reopened.rows('want', { user_id: 'usr_8f2k' }).length, 1);
    assert.equal(reopened.rows('match', { user_id: 'usr_8f2k' }).length, 1);
    assert.equal(reopened.get('want', 'usr_8f2k', row.id)?.state, 'paused');
    assert.equal(reopened.get('want', 'usr_8f2k', row.id)?.version, 2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
