// Rests-on: .agents/team/packets/team/80-new-four-jobs-storage.md; spec/redesign/new-results.md.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { handlers as captures, resetCaptures } from './captures.ts';
import { handlers, manifest } from './lookups.ts';

let now = Date.parse('2026-11-15T09:00:00Z');
beforeEach(() => {
  resetCaptures();
  deps.verify = async token => token === 'good' ? 'usr_8f2k' : token === 'other' ? 'usr_other' : null;
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.idem.clear(); deps.visits.clear(); deps.now = () => now;
});
const send = (endpoint: string, path: string, token = 'good', body?: unknown) => {
  const table = endpoint.startsWith('POST /v1/captures') ? captures : handlers;
  const entry = manifest.find(m => m.endpoint === endpoint);
  return route(endpoint, table[endpoint], entry ? { auth: entry.auth } : {})(new Request('http://edge.test' + path, {
    method: endpoint.split(' ')[0], headers: { Authorization: 'Bearer ' + token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }));
};
const open = async (intent: string | undefined, token = 'good') => {
  now += 60_000;
  const r = await send('POST /v1/captures', '/v1/captures', token, { mode: 'shots', purpose: intent === 'sell' || !intent ? 'sell' : intent === 'worth' ? 'appraise' : 'find', ...(intent ? { intent } : {}) });
  assert.equal(r.status, 201);
  return (await r.json()).id as string;
};
const list = async (token = 'good', query = '') => {
  const r = await send('GET /v1/lookups', '/v1/lookups' + query, token);
  assert.equal(r.status, 200);
  return (await r.json()) as { data: { capture_id: string; kind: string; product_id: string | null; short_name: string; at: string }[]; next_cursor: null };
};

test('lookups: the three routes are engine-backed and need a session', () => {
  assert.deepEqual(manifest.map(m => m.endpoint).sort(), ['DELETE /v1/lookups', 'DELETE /v1/lookups/:capture_id', 'GET /v1/lookups']);
  for (const m of manifest) { assert.equal(m.source, 'engine'); assert.equal(m.auth, 'user'); }
});

test('lookups: finds and appraisals only, newest first, in the Lookup shape', async () => {
  const find = await open('find'), worth = await open('worth');
  await open(undefined); await open('sell'); await open('track');
  const body = await list();
  assert.equal(body.next_cursor, null);
  assert.deepEqual(body.data.map(r => [r.capture_id, r.kind]), [[worth, 'worth'], [find, 'find']]);
  for (const row of body.data) {
    assert.deepEqual(Object.keys(row).sort(), ['at', 'capture_id', 'kind', 'product_id', 'short_name']);
    assert.equal(row.product_id, null);
    assert.equal(typeof row.short_name, 'string'); assert.ok(row.short_name.length > 0);
    assert.ok(!Number.isNaN(Date.parse(row.at)));
  }
  assert.ok(body.data[0].at > body.data[1].at);
});

test('lookups: the limit keeps the newest and must be 1 to 100', async () => {
  await open('find'); const newest = await open('worth');
  assert.deepEqual((await list('good', '?limit=1')).data.map(r => r.capture_id), [newest]);
  for (const limit of ['0', '101', 'abc', '-1']) {
    const r = await send('GET /v1/lookups', '/v1/lookups?limit=' + limit);
    assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
});

test('lookups: one person can neither read nor delete another person\'s', async () => {
  const mine = await open('find'), theirs = await open('worth', 'other');
  assert.deepEqual((await list()).data.map(r => r.capture_id), [mine]);
  assert.deepEqual((await list('other')).data.map(r => r.capture_id), [theirs]);
  const one = await send('DELETE /v1/lookups/:capture_id', '/v1/lookups/' + theirs);
  assert.equal(one.status, 404); assert.equal((await one.json()).code, 'not_found');
  assert.equal((await send('DELETE /v1/lookups', '/v1/lookups')).status, 204);
  assert.deepEqual((await list('other')).data.map(r => r.capture_id), [theirs]);
  assert.equal((await send('GET /v1/lookups', '/v1/lookups', 'nobody')).status, 401);
});

test('lookups: delete one, then delete all, and an unknown or non-lookup capture is 404', async () => {
  const a = await open('find'), b = await open('worth'), sold = await open('sell');
  assert.equal((await send('DELETE /v1/lookups/:capture_id', '/v1/lookups/' + a)).status, 204);
  assert.deepEqual((await list()).data.map(r => r.capture_id), [b]);
  for (const id of [a, sold, 'cap_missing']) assert.equal((await send('DELETE /v1/lookups/:capture_id', '/v1/lookups/' + id)).status, 404);
  assert.equal((await send('DELETE /v1/lookups', '/v1/lookups')).status, 204);
  assert.deepEqual((await list()).data, []);
});

test('a person’s searches are kept newest first, once each, at most twenty, and forgotten on request', async () => {
  const { rememberSearch, searchesOf, forgetSearches } = await import('./lookups.ts');
  const rows = new Map<string, unknown>();
  const kv = { get: <T,>(_ns: string, key: string) => rows.get(key) as T | undefined, set: (_ns: string, key: string, value: unknown) => { rows.set(key, value); }, delete: (_ns: string, key: string) => { rows.delete(key); } };
  rememberSearch(kv, 'usr_a', 'levi 501', '2026-11-15T10:00:00Z');
  rememberSearch(kv, 'usr_a', 'carhartt jacket', '2026-11-15T10:01:00Z');
  rememberSearch(kv, 'usr_a', 'Levi 501', '2026-11-15T10:02:00Z');
  assert.deepEqual(searchesOf(kv, 'usr_a').map(r => r.q), ['Levi 501', 'carhartt jacket']);
  assert.deepEqual(searchesOf(kv, 'usr_b'), []);
  for (let i = 0; i < 25; i++) rememberSearch(kv, 'usr_a', `q${i}`, `2026-11-15T11:${String(i).padStart(2, '0')}:00Z`);
  assert.equal(searchesOf(kv, 'usr_a').length, 20);
  forgetSearches(kv, 'usr_a');
  assert.deepEqual(searchesOf(kv, 'usr_a'), []);
});
