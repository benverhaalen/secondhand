import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fail, fakeManifest, VERBS, isWrite, type Adapter, type AdapterResult, type CallArgs, type Verb } from './protocol.ts';
import { createSiteService } from './service.ts';
import { memoryStore } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';
import { createHash } from 'node:crypto';
import { createReadLedger } from './read-ledger.ts';
import { memoryStore as paramStore } from '../../engines/param/param.ts';

const options = () => {
  const log = createLog({ src: 'service.test', build: 'test', sink: memorySink() });
  return { store: memoryStore(), data: 'synthetic' as const, log, ledger: createReadLedger({ now: Date.now, log, params: paramStore() }) };
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];

// §5 budgets scaled by 1/20: endpoint read 1.5 s -> 75 ms, page read 8 s -> 400 ms, write 20 s -> 1000 ms. Real latency is 30% of the budget.
const SCALE = 20;
const budget = { endpoint: 1500 / SCALE, page: 8000 / SCALE, write: 20000 / SCALE };

type St = { runs: number; inflight: number; maxInflight: number; warmed: boolean };
const state = (): St => ({ runs: 0, inflight: 0, maxInflight: 0, warmed: false });

function slow(verb: Verb, kind: 'endpoint' | 'page', ms: number, st: St): Adapter {
  return { route_id: `slow.${verb}`, manifest: fakeManifest('depop', verb, { route_kind: kind }), async run(a) {
    st.runs++; st.inflight++; st.maxInflight = Math.max(st.maxInflight, st.inflight);
    if (!st.warmed) await sleep(1000);                    // a cold start would cost this
    await sleep(ms);
    st.inflight--;
    return { ok: true, data: verb === 'post' ? { id: 'P1', operation_id: a.operation_id } : [] };
  } };
}

async function burst(verb: Verb, kind: 'endpoint' | 'page', limit: number) {
  const st = state();
  const svc = createSiteService('depop', [slow(verb, kind, limit * 0.3, st)], { ...options(), concurrency: 25, warm: async () => { st.warmed = true; } });
  await svc.ready();
  const ms: number[] = [];
  await Promise.all(Array.from({ length: 50 }, async (_, i) => {
    const t0 = performance.now();
    const e = await svc.call(verb, { user_id: 'u1', operation_id: `op-${i}` });
    assert.equal(e.ok, true);
    ms.push(performance.now() - t0);
  }));
  return { p95: p95(ms), st };
}

test('scaling: a burst of 50 concurrent calls holds the §5 p95 for each kind, under the concurrency limit', async () => {
  const e = await burst('search', 'endpoint', budget.endpoint);
  const pg = await burst('read_listings', 'page', budget.page);
  const w = await burst('post', 'page', budget.write);
  assert.ok(e.p95 < budget.endpoint, `endpoint p95 ${e.p95}`);
  assert.ok(pg.p95 < budget.page, `page p95 ${pg.p95}`);
  assert.ok(w.p95 < budget.write, `write p95 ${w.p95}`);
  for (const r of [e, pg, w]) { assert.equal(r.st.runs, 50); assert.ok(r.st.maxInflight <= 25); }
});

test('scaling: no call pays a start-up; adapters are warmed once at start', async () => {
  const st = state(); let warms = 0;
  const svc = createSiteService('depop', [slow('search', 'endpoint', 1, st)], { ...options(), concurrency: 4, warm: async () => { warms++; st.warmed = true; } });
  await svc.ready();
  const t0 = performance.now();
  await svc.call('search', { query: 'x' });
  assert.ok(performance.now() - t0 < 500);               // a cold run would sleep 1000
  assert.equal(warms, 1);
});

test('scaling: over the limit, calls queue and none runs beyond it', async () => {
  const st = state();
  const svc = createSiteService('depop', [slow('search', 'endpoint', 5, st)], { ...options(), concurrency: 3, warm: async () => { st.warmed = true; } });
  const all = Promise.all(Array.from({ length: 10 }, () => svc.call('search', {})));
  await sleep(1);
  assert.equal(svc.running(), 3);
  assert.equal(svc.queued(), 7);
  await all;
  assert.equal(st.maxInflight, 3);
  assert.equal(svc.running(), 0);
});

test('restart: a service that dies mid-write never runs the same operation_id twice', async () => {
  const store = memoryStore();
  const st = state(); st.warmed = true;
  const pending = Promise.withResolvers<AdapterResult>();
  const began = Promise.withResolvers<void>();
  const hang: Adapter = { route_id: 'h', manifest: fakeManifest('depop', 'post'), run() { st.runs++; began.resolve(); return pending.promise; } };
  const one = createSiteService('depop', [hang], { ...options(), concurrency: 2, store });
  const abandoned = one.call('post', { user_id: 'u1', operation_id: 'op-9' });
  await began.promise;
  try {
    assert.equal(store.get('operation', 'u1', 'op-9')?.state, 'started');
    const second = state(); second.warmed = true;
    const two = createSiteService('depop', [slow('post', 'page', 1, second)], { ...options(), concurrency: 2, store });
    const e = await two.call('post', { user_id: 'u1', operation_id: 'op-9' });
    assert.ok(!e.ok);
    assert.equal(e.error.code, 'outcome_unknown');
    assert.deepEqual(e.error.hint, { do: 'reconcile', operation_id: 'op-9' });
    assert.equal(st.runs, 1);
    assert.equal(second.runs, 0);
    assert.equal((await two.call('post', { user_id: 'u1', operation_id: 'op-10' })).ok, true);
  } finally {
    pending.resolve({ ok: true, data: {} });
    await abandoned;
  }
});

test('restart: a finished write is answered from the record; the same id in flight shares one run; reads simply run again', async () => {
  const store = memoryStore(); const st = state(); st.warmed = true;
  const svc = createSiteService('depop', [slow('post', 'page', 5, st), slow('search', 'endpoint', 1, st)], { ...options(), concurrency: 4, store });
  const [a, b] = await Promise.all([svc.call('post', { user_id: 'u1', operation_id: 'op-1' }), svc.call('post', { user_id: 'u1', operation_id: 'op-1' })]);
  assert.deepEqual(a, b);
  const second = state(); second.warmed = true;
  const again = createSiteService('depop', [slow('post', 'page', 5, second)], { ...options(), concurrency: 4, store });
  assert.deepEqual(await again.call('post', { user_id: 'u1', operation_id: 'op-1' }), a);
  assert.equal(second.runs, 0);
  assert.equal(st.runs, 1);
  await svc.call('search', {}); await svc.call('search', {});
  assert.equal(st.runs, 3);
});


test('an adapter answering outcome_unknown leaves the operation unknown and a restart never replays it', async () => {
  const o = options(); let writes = 0;
  const adapter: Adapter = { route_id: 'unknown', manifest: fakeManifest('depop', 'post'), async run(a) {
    writes++;
    return fail('outcome_unknown', 'write interrupted', { do: 'reconcile', operation_id: a.operation_id! });
  } };
  const args = { user_id: 'u1', operation_id: 'op-unknown' };
  const e = await createSiteService('depop', [adapter], { ...o, concurrency: 1 }).call('post', args);
  assert.equal(e.ok, false);
  assert.equal(o.store.get('operation', 'u1', args.operation_id)?.state, 'unknown');
  const again = await createSiteService('depop', [adapter], { ...o, concurrency: 1 }).call('post', args);
  if (!again.ok) assert.deepEqual(again.error.hint, { do: 'reconcile', operation_id: args.operation_id });
  assert.equal(writes, 1);
});

test('a nested token envelope is returned but never stored, the row is unknown and one error is logged', async () => {
  const o = options(), sink = memorySink();
  const log = createLog({ src: 'service.test', build: 'test', sink });
  const data = { nested: [{ token: 'synthetic' }] };
  const adapter: Adapter = { route_id: 'private', manifest: fakeManifest('depop', 'post'), async run() { return { ok: true, data }; } };
  const e = await createSiteService('depop', [adapter], { ...o, log, concurrency: 1 }).call('post', { user_id: 'u1', operation_id: 'op-private' });
  assert.ok(e.ok);
  assert.deepEqual(e.data, data);
  const row = o.store.get('operation', 'u1', 'op-private');
  assert.equal(row?.state, 'unknown');
  assert.equal(row?.envelope, undefined);
  assert.equal(sink.lines.map(line => JSON.parse(line) as { event: string }).filter(line => line.event === 'error').length, 1);
});

test('two users with the same operation_id have independent in-flight and durable records', async () => {
  const st = state(); st.warmed = true;
  const o = options(), svc = createSiteService('depop', [slow('post', 'page', 5, st)], { ...o, concurrency: 2 });
  const results = await Promise.all(['u1', 'u2'].map(user_id => svc.call('post', { user_id, operation_id: 'shared' })));
  assert.ok(results.every(e => e.ok));
  assert.equal(st.runs, 2);
  for (const user of ['u1', 'u2']) assert.equal(o.store.get('operation', user, 'shared')?.state, 'done');
});

test('post markers are stable sha256 prefixes and a listing sku is preserved in args and the ledger', async () => {
  const seen: CallArgs[] = [], o = options();
  const adapter: Adapter = { route_id: 'marker', manifest: fakeManifest('depop', 'post'), async run(a) { seen.push(a); return { ok: true, data: {} }; } };
  const svc = createSiteService('depop', [adapter], { ...o, concurrency: 2, now: () => 1000 });
  for (const a of [
    { user_id: 'u1', operation_id: 'op-a' }, { user_id: 'u2', operation_id: 'op-a' },
    { user_id: 'u1', operation_id: 'op-b' }, { user_id: 'u1', operation_id: 'op-c', listing: { sku: 'seller-sku' } },
  ]) await svc.call('post', a);
  const expected = 'sh' + createHash('sha256').update('op-a').digest('hex').slice(0, 16);
  assert.match(String(seen[0].sku_hash), /^sh[0-9a-f]{16}$/);
  assert.equal(seen[0].sku_hash, expected);
  assert.equal(seen[1].sku_hash, expected);
  assert.notEqual(seen[2].sku_hash, expected);
  assert.equal(seen[3].sku_hash, 'seller-sku');
  assert.deepEqual(seen[3].listing, { sku: 'seller-sku' });
  const row = o.store.get('operation', 'u1', 'op-a');
  assert.equal(row?.sku_hash, expected);
  assert.equal(row?.at, '1970-01-01T00:00:01.000Z');
  assert.equal(row?.data, 'synthetic');
  assert.equal(row?.site, 'depop');
  assert.equal(row?.verb, 'post');
  assert.equal(o.store.get('operation', 'u1', 'op-c')?.sku_hash, 'seller-sku');
});

test('a ledger write without user_id fails before an adapter runs', async () => {
  const st = state(); st.warmed = true;
  const svc = createSiteService('depop', [slow('post', 'page', 1, st)], { ...options(), concurrency: 1 });
  await assert.rejects(svc.call('post', { operation_id: 'missing-user' }), /user_id/);
  assert.equal(st.runs, 0);
});

function readRig(concurrency = 1) {
  let time = 0, calls = 0;
  let response: AdapterResult = fail('blocked', 'a bot check', { do: 'pause_session', site: 'depop' });
  const sink = memorySink();
  const log = createLog({ src: 'service.reads.test', build: 'test', sink });
  const ledger = createReadLedger({ now: () => time, log, params: paramStore() });
  const adapters = VERBS.map(verb => ({ route_id: `read-test.${verb}`, manifest: fakeManifest('depop', verb),
    async run() { calls++; return response; } }));
  const service = createSiteService('depop', adapters, { ...options(), log, ledger, now: () => time, concurrency });
  return { service, ledger, sink, calls: () => calls, set: (t: number) => { time = t; }, answer: (r: AdapterResult) => { response = r; } };
}

test('a challenge fails to pause the next read, leaks query text, or falls through to another adapter', async () => {
  const r = readRig();
  const query = 'planted-query-do-not-log?private=fixture';
  const first = await r.service.call('search', { query, url: `https://fixture.test/?q=${query}` });
  assert.ok(!first.ok && first.error.code === 'blocked');
  r.set(1001);
  const next = await r.service.call('search', { query });
  assert.ok(!next.ok);
  assert.equal(next.error.code, 'rate_limited');
  assert.equal(next.error.message, 'the site asked us to slow down');
  assert.deepEqual(next.error.hint, { do: 'retry_after', after_s: 899 });
  assert.equal(r.calls(), 1);
  assert.equal(r.ledger.counts('depop')[0].classes.challenged, 1);
  assert.equal(r.ledger.counts('depop')[0].classes.refused, 0);
  assert.ok(r.sink.lines.every(line => !line.includes(query) && !line.includes('fixture.test')));
});

test('a read already queued before the challenge is sent during the pause', async () => {
  const r = readRig();
  const result = await Promise.all([r.service.call('search'), r.service.call('search'), r.service.call('read_listings')]);
  assert.equal(r.calls(), 1);
  for (const e of result.slice(1)) assert.ok(!e.ok && e.error.code === 'rate_limited');
  assert.equal(r.service.running(), 0);
  assert.equal(r.service.queued(), 0);
});

test('a write during a read pause is withheld or counted as a read', async () => {
  const r = readRig();
  await r.service.call('search');
  r.answer({ ok: true, data: { id: 'posted' } });
  assert.equal((await r.service.call('post', { user_id: 'u1', operation_id: 'write-in-pause' })).ok, true);
  assert.equal(r.calls(), 2);
  assert.equal(r.ledger.counts('depop')[0].classes.answered, 0);
  assert.ok(r.ledger.paused('depop'));
});

test('reads other than search are omitted from the ledger', async () => {
  const r = readRig();
  r.answer({ ok: true, data: [] });
  const reads = VERBS.filter(v => !isWrite(v));
  for (const verb of reads) await r.service.call(verb);
  assert.equal(r.ledger.counts('depop')[0].classes.empty, reads.length);
});

test('an expired pause fails to send a clean read and reset back-off', async () => {
  const r = readRig();
  await r.service.call('search');
  r.set(900_000);
  r.answer({ ok: true, data: [] });
  assert.equal((await r.service.call('search')).ok, true);
  r.answer(fail('blocked', 'HTTP 403', { do: 'pause_session', site: 'depop' }));
  await r.service.call('search');
  assert.equal(r.ledger.paused('depop')?.until_ms, 1_800_000);
});

test('a harness deadline is counted as a refusal and incorrectly pauses reads', async () => {
  const o = options();
  const adapter: Adapter = { route_id: 'timeout', manifest: fakeManifest('depop', 'search'),
    run: (_args, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted by deadline')))) };
  const service = createSiteService('depop', [adapter], { ...o, concurrency: 1, timeoutMs: 2 });
  await service.call('search');
  assert.equal(o.ledger.counts('depop')[0].classes.timed_out, 1);
  assert.equal(o.ledger.paused('depop'), undefined);
});

test('a paused read waits for startup instead of answering immediately', async () => {
  const o = options();
  o.ledger.record('depop', 'search', 'challenged', 1);
  const service = createSiteService('depop', [slow('search', 'page', 1, state())], {
    ...o, concurrency: 1, warm: () => new Promise<void>(() => {}),
  });
  const result = await Promise.race([service.call('search'), sleep(20).then(() => undefined)]);
  assert.ok(result && !result.ok && result.error.code === 'rate_limited');
});

for (const kind of ['HTTP 403', 'bot check']) test(`${kind} falls through to a second route or retries the first`, async () => {
  const o = options(); let first = 0, fallback = 0;
  const adapters: Adapter[] = [
    { route_id: 'first', manifest: fakeManifest('depop', 'search'), async run() {
      first++; return fail('blocked', kind, { do: 'pause_session', site: 'depop' });
    } },
    { route_id: 'fallback', manifest: fakeManifest('depop', 'search'), async run() {
      fallback++; return { ok: true, data: [] };
    } },
  ];
  const service = createSiteService('depop', adapters, { ...o, concurrency: 1 });
  await service.call('search'); await service.call('search');
  assert.deepEqual([first, fallback], [1, 0]);
});
