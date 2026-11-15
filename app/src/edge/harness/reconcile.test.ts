import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, fakeManifest, type Adapter, type AdapterResult, type Harness } from './protocol.ts';
import { reconcile, writeOnce } from './reconcile.ts';
import { createSiteService } from './service.ts';
import { memoryStore } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const readBack = { verb: 'read_listings' as const, match: ['title', 'price_cents'] };
const args = { user_id: 'u1', operation_id: 'op-1', title: 'Denim jacket', price_cents: 4500 };

// A fake site with real state: how the post dies decides whether it landed. `kill` = after the post was sent.
function site(opts: { lands: boolean; readFails?: boolean; kill: 'throw' | 'hang' }) {
  const posts: { external_id: string; sku: unknown; title: string; price_cents: number }[] = [];
  let postCalls = 0, readCalls = 0;
  const post: Adapter = { route_id: 'x.post', manifest: fakeManifest('depop', 'post'), async run(a, signal) {
    postCalls++;
    if (opts.lands) posts.push({ sku: a.sku_hash, external_id: `L${posts.length + 1}`, title: String(a.title), price_cents: Number(a.price_cents) });
    if (opts.kill === 'throw') throw new Error('connection reset');
    return new Promise<AdapterResult>((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
  } };
  const read: Adapter = { route_id: 'x.read', manifest: fakeManifest('depop', 'read_listings'), async run() {
    readCalls++;
    if (opts.readFails) throw new Error('read down');
    return { ok: true, data: [...posts] };
  } };
  const store = memoryStore();
  const svc = createSiteService('depop', [post, read], { store, data: 'synthetic', concurrency: 1, timeoutMs: 20,
    log: createLog({ src: 'reconcile.test', build: 'test', sink: memorySink() }) });
  const harness: Harness = { call: (_site, verb, args) => svc.call(verb, args) };
  return { harness, posts, calls: () => postCalls, reads: () => readCalls, options: { store, sleep: async (_ms: number) => {} } };
}

test('reconcile: timeout after post: read back, found, settled, no repost', async () => {
  for (const kill of ['throw', 'hang'] as const) {
    const s = site({ lands: true, kill });
    const e = await writeOnce(s.harness, 'depop', 'post', args, readBack, s.options);
    assert.equal(e.ok, true);
    if (e.ok) assert.deepEqual(e.data, { id: 'L1', operation_id: 'op-1' });
    assert.equal(s.calls(), 1);
    assert.equal(s.posts.length, 1);
    assert.equal(s.options.store.get('operation', 'u1', 'op-1')?.state, 'done');
  }
});

test('reconcile: read back succeeds and the write is absent: a decision, never a repost', async () => {
  const s = site({ lands: false, kill: 'throw' });
  const e = await writeOnce(s.harness, 'depop', 'post', args, readBack, s.options);
  assert.equal(e.ok, false);
  if (!e.ok) { assert.equal(e.error.code, 'policy_refused'); assert.deepEqual(e.error.hint, { do: 'raise_decision', kind: 'write_absent' }); }
  assert.equal(s.calls(), 1);
  assert.equal(s.posts.length, 0);
  assert.equal(s.reads(), 3);
});

test('reconcile: read back fails: a decision, no repost', async () => {
  const s = site({ lands: true, readFails: true, kill: 'throw' });
  const e = await writeOnce(s.harness, 'depop', 'post', args, readBack, s.options);
  assert.equal(e.ok, false);
  if (!e.ok) assert.deepEqual(e.error.hint, { do: 'raise_decision', kind: 'write_unconfirmed' });
  assert.equal(s.calls(), 1);
  assert.equal(s.posts.length, 1);
  assert.equal(s.reads(), 1);
});

test('reconcile: zero duplicate posts across 20 kills, however many times it is reconciled', async () => {
  const s = site({ lands: true, kill: 'throw' });
  for (let i = 0; i < 20; i++) {
    const a = { ...args, operation_id: `op-${i}`, title: `Item ${i}` };
    const e = await writeOnce(s.harness, 'depop', 'post', a, readBack, s.options);
    assert.equal(e.ok, true);
    await reconcile(s.harness, 'depop', { verb: 'post', args: a }, readBack, s.options);
  }
  assert.equal(s.posts.length, 20);
  assert.equal(s.calls(), 20);
});

test('reconcile: a clean ok write is returned as is, with no read-back', async () => {
  const s = site({ lands: true, kill: 'throw' });
  const ok: Adapter = { route_id: 'y', manifest: fakeManifest('ebay', 'post'), async run() { return { ok: true, data: { id: 'E1' } }; } };
  const e = await writeOnce(createHarness({ adapters: [ok] }), 'ebay', 'post', args, readBack);
  assert.equal(e.ok, true);
  assert.equal(s.calls(), 0);
});


test('a post is found by its durable sku on the second read, returns external_id and settles done', async () => {
  const store = memoryStore();
  store.beginOperation({ id: 'op-1', user_id: 'u1', site: 'depop', verb: 'post', sku_hash: 'seller-sku', data: 'synthetic', at: 'start' });
  store.settleOperation('u1', 'op-1', { state: 'unknown', at: 'unknown' });
  let reads = 0, writes = 0;
  const read: Adapter = { route_id: 'delayed', manifest: fakeManifest('depop', 'read_listings'), async run() {
    reads++;
    return { ok: true, data: reads === 1 ? [{ sku: 'another', external_id: 'wrong' }]
      : [{ sku: 'seller-sku', external_id: 'site-id', id: 'other-id' }] };
  } };
  const post: Adapter = { route_id: 'never', manifest: fakeManifest('depop', 'post'), async run() { writes++; return { ok: true, data: {} }; } };
  const waits: number[] = [];
  const e = await reconcile(createHarness({ adapters: [read, post] }), 'depop', { verb: 'post', args },
    { verb: 'read_listings', match: ['external_id'] }, { store, sleep: async ms => { waits.push(ms); }, now: () => 2000 });
  assert.ok(e.ok);
  assert.deepEqual(e.data, { id: 'site-id', operation_id: 'op-1' });
  assert.equal(reads, 2);
  assert.equal(writes, 0);
  assert.deepEqual(waits, [2000]);
  const row = store.get('operation', 'u1', 'op-1');
  assert.equal(row?.state, 'done');
  assert.equal(row?.at, '1970-01-01T00:00:02.000Z');
  assert.deepEqual(row?.envelope, e);
});

test('no marker hit after three reads returns write_absent with exactly three reads and zero writes', async () => {
  const store = memoryStore();
  store.beginOperation({ id: 'op-1', user_id: 'u1', site: 'depop', verb: 'post', sku_hash: 'expected', data: 'synthetic', at: 'start' });
  let reads = 0, writes = 0;
  const read: Adapter = { route_id: 'absent', manifest: fakeManifest('depop', 'read_listings'), async run() {
    reads++; return { ok: true, data: [{ id: 'wrong', sku: 'other', title: args.title, price_cents: args.price_cents }] };
  } };
  const post: Adapter = { route_id: 'never', manifest: fakeManifest('depop', 'post'), async run() { writes++; return { ok: true, data: {} }; } };
  const waits: number[] = [];
  const e = await reconcile(createHarness({ adapters: [read, post] }), 'depop', { verb: 'post', args }, readBack,
    { store, sleep: async ms => { waits.push(ms); } });
  assert.ok(!e.ok);
  assert.deepEqual(e.error.hint, { do: 'raise_decision', kind: 'write_absent' });
  assert.equal(reads, 3);
  assert.equal(writes, 0);
  assert.deepEqual(waits, [2000, 5000]);
  assert.equal(store.get('operation', 'u1', 'op-1')?.state, 'started');
});

test('a non-post write still matches every manifest field and falls back to row.id', async () => {
  const store = memoryStore();
  store.beginOperation({ id: 'op-1', user_id: 'u1', site: 'depop', verb: 'revise', data: 'synthetic', at: 'start' });
  const read: Adapter = { route_id: 'revised', manifest: fakeManifest('depop', 'read_listings'), async run() {
    return { ok: true, data: [{ id: 'wrong', title: args.title, price_cents: 1 }, { id: 'revised', title: args.title, price_cents: args.price_cents }] };
  } };
  const e = await reconcile(createHarness({ adapters: [read] }), 'depop', { verb: 'revise', args }, readBack,
    { store, sleep: async () => {} });
  assert.ok(e.ok);
  assert.equal(e.data.id, 'revised');
  assert.equal(store.get('operation', 'u1', 'op-1')?.state, 'done');
});

test('reconcile refuses a write configured as read_back before calling the harness', async () => {
  let calls = 0;
  const harness: Harness = { async call() { calls++; throw new Error('must not run'); } };
  await assert.rejects(reconcile(harness, 'depop', { verb: 'post', args }, { verb: 'post', match: [] }), /read/);
  assert.equal(calls, 0);
});

test('an existing caller without ledger or marker context still reconciles a post by manifest fields', async () => {
  const read: Adapter = { route_id: 'legacy', manifest: fakeManifest('depop', 'read_listings'), async run() {
    return { ok: true, data: [{ id: 'existing-post', title: args.title, price_cents: args.price_cents }] };
  } };
  const e = await reconcile(createHarness({ adapters: [read] }), 'depop', { verb: 'post', args }, readBack, { sleep: async () => {} });
  assert.ok(e.ok);
  assert.deepEqual(e.data, { id: 'existing-post', operation_id: 'op-1' });
});

test('a ledger-backed post without a marker never confirms a row by manifest fields', async () => {
  const store = memoryStore();
  store.beginOperation({ id: 'op-1', user_id: 'u1', site: 'depop', verb: 'post', data: 'synthetic', at: 'start' });
  let reads = 0;
  const read: Adapter = { route_id: 'missing-marker', manifest: fakeManifest('depop', 'read_listings'), async run() {
    reads++; return { ok: true, data: [{ id: 'wrong', title: args.title, price_cents: args.price_cents }] };
  } };
  const e = await reconcile(createHarness({ adapters: [read] }), 'depop', { verb: 'post', args }, readBack, { store, sleep: async () => {} });
  assert.ok(!e.ok);
  assert.deepEqual(e.error.hint, { do: 'raise_decision', kind: 'write_absent' });
  assert.equal(reads, 3);
  assert.equal(store.get('operation', 'u1', 'op-1')?.state, 'started');
});
