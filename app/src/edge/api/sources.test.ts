import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { example } from './examples.ts';
import { handlers, manifest } from './sources.ts';
import { createReadLedger, readLedger } from '../harness/read-ledger.ts';
import { createHarness, fakeAdapter } from '../harness/protocol.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { routeId, sourcesFor } from '../intel/public/sources.ts';
import { runtimePorts } from '../intel/public/search.ts';

const contract = example('sources.health');
const originalLedger = { ...readLedger };
const originalRuntime = { ...runtimePorts };
const readAt = Date.parse('2026-11-15T13:54:00Z');
type HealthRow = {
  source_id: string; route_id: string; site: string; group: string; lane: string;
  composed: boolean; paused_until: string | null;
};
type HealthBody = { routes: HealthRow[]; reads: { site: string; day: string; classes: Record<string, number>; paused_until: string | null }[] };

beforeEach(() => {
  deps.verify = async token => token === 'good' ? 'usr_8f2k' : token === 'other' ? 'usr_other' : null;
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.idem.clear(); deps.visits.clear(); deps.now = () => readAt;
  Object.assign(readLedger, createReadLedger({ now: () => readAt, log: deps.log, params: memoryStore() }));
  Object.assign(runtimePorts, { accounts: undefined, harness: undefined, dupe: undefined, apify: undefined,
    apifyRuns: undefined, shopping: undefined, routed: () => false });
});
afterEach(() => {
  Object.assign(readLedger, originalLedger);
  Object.assign(runtimePorts, originalRuntime);
});
const call = (path = '/v1/sources/health', token: string | null = 'other') => {
  const entry = manifest.find(m => m.endpoint === contract.endpoint)!;
  return route(contract.endpoint, handlers[contract.endpoint], { auth: entry.auth })(new Request('http://edge.test' + path, {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  }));
};
const body = async (path?: string, token?: string): Promise<HealthBody> => {
  const response = await call(path, token);
  assert.equal(response.status, 200);
  return response.json();
};

test('sources: health keeps its signed-in engine manifest entry and Expo binding', async () => {
  assert.deepEqual(manifest, [{ endpoint: contract.endpoint, source: 'engine', auth: 'user' }]);
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../../app/v1/sources/health+api.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("import '@/edge/auth'"));
  assert.ok(source.includes("export const GET = route('GET /v1/sources/health'"));
});

test('sources.health: response equals its contract example', async () => {
  const response = await call(contract.path, 'good');
  assert.equal(response.status, contract.status);
  assert.ok(response.headers.get('X-Request-Id'));
  assert.deepEqual(await response.json(), contract.response);
});

test('source health returns every person source instead of 404 for a non-example person', async () => {
  const result = await body();
  assert.deepEqual(result.routes.map(row => row.source_id), sourcesFor('person').map(source => source.id));
  for (const source of sourcesFor('person')) {
    const row = result.routes.find(row => row.source_id === source.id)!;
    assert.equal(row.route_id, routeId(source));
    assert.equal(row.site, source.site);
    assert.equal(row.group, source.group);
    assert.equal(row.lane, source.lane);
    assert.equal(Object.hasOwn(row, 'checked_at'), false);
    assert.equal(row.paused_until, null);
  }
  assert.deepEqual(result.reads, []);
});

test('source health route rows contain exactly the approved keys', async () => {
  const result = await body();
  for (const row of result.routes) {
    assert.deepEqual(Object.keys(row).sort(), [
      'source_id', 'route_id', 'site', 'group', 'lane', 'composed', 'paused_until',
    ].sort());
  }
});

test('source health refuses a visitor with 401', async () => {
  const response = await call(undefined, null);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'unauthenticated');
});

test('source health composition follows runtime ports and the harness route', async () => {
  const initial = await body();
  for (const row of initial.routes) {
    assert.equal(row.composed, row.lane === 'mcp' || row.lane === 'public_page');
  }
  runtimePorts.harness = createHarness({ adapters: [fakeAdapter('ebay', 'search')], log: deps.log });
  assert.equal((await body()).routes.find(row => row.site === 'ebay')!.composed, false);
  runtimePorts.routed = site => site === 'ebay';
  const composed = await body();
  assert.equal(composed.routes.find(row => row.site === 'ebay')!.composed, true);
  assert.equal(composed.routes.find(row => row.site === 'depop')!.composed, false);
  runtimePorts.shopping = { search: async () => ({ ok: true, data: { rows: [], dropped: 0, total: 0, keep_until: '2026-11-16T00:00:00Z' } }) };
  assert.equal((await body()).routes.find(row => row.site === 'google_shopping')!.composed, true);
});

test('source health exposes a refusal pause on its route and the unchanged read counts', async () => {
  readLedger.record('depop', 'search', 'refused', 1);
  readLedger.record('ebay', 'search', 'empty', 1);
  const result = await body();
  const until = new Date(readLedger.paused('depop')!.until_ms).toISOString();
  assert.equal(result.routes.find(row => row.site === 'depop')!.paused_until, until);
  assert.equal(result.routes.find(row => row.site === 'ebay')!.paused_until, null);
  assert.deepEqual(result.reads, readLedger.counts().map(row => ({ ...row,
    paused_until: row.site === 'depop' ? until : null })));
  assert.equal(result.reads.find(row => row.site === 'depop')!.classes.refused, 1);
});

test('source health site filter applies to routes and reads and need is ignored', async () => {
  readLedger.record('depop', 'search', 'refused', 1);
  readLedger.record('ebay', 'search', 'empty', 1);
  const filtered = await body('/v1/sources/health?site=ebay');
  assert.deepEqual(filtered.routes.map(row => row.source_id), ['ebay']);
  assert.deepEqual(filtered.reads.map(row => row.site), ['ebay']);
  for (const need of ['sold', 'search', 'unknown']) {
    assert.deepEqual(await body('/v1/sources/health?site=ebay&need=' + need), filtered);
  }
  for (const source of sourcesFor('person')) {
    assert.deepEqual((await body('/v1/sources/health?site=' + source.site)).routes.map(row => row.source_id), [source.id]);
  }
});

test('source health rejects an unknown or empty site with 400 invalid', async () => {
  for (const site of ['nope', '']) {
    const response = await call('/v1/sources/health?site=' + site);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'invalid');
  }
});

test('source health contains no query, person id or account and is the same for every person', async () => {
  const path = '/v1/sources/health?query=private-test-query&person_id=usr_other&account=private-account';
  const result = await body(path);
  assert.deepEqual(await body(path, 'good'), result);
  assert.doesNotMatch(JSON.stringify(result), /private-test-query|private-account|usr_|query|person_id|user_id|account/);
});

test('sources: limit over 100 is refused', async () => {
  const response = await call('/v1/sources/health?limit=101');
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'invalid');
});
