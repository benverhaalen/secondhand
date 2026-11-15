import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeManifest, type Adapter, type Verb } from './protocol.ts';
import { createSiteService, memoryOpStore } from './service.ts';

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
  const svc = createSiteService('depop', [slow(verb, kind, limit * 0.3, st)], { concurrency: 25, warm: async () => { st.warmed = true; } });
  await svc.ready();
  const ms: number[] = [];
  await Promise.all(Array.from({ length: 50 }, async (_, i) => {
    const t0 = performance.now();
    const e = await svc.call(verb, { operation_id: `op-${i}` });
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
  const svc = createSiteService('depop', [slow('search', 'endpoint', 1, st)], { concurrency: 4, warm: async () => { warms++; st.warmed = true; } });
  await svc.ready();
  const t0 = performance.now();
  await svc.call('search', { query: 'x' });
  assert.ok(performance.now() - t0 < 500);               // a cold run would sleep 1000
  assert.equal(warms, 1);
});

test('scaling: over the limit, calls queue and none runs beyond it', async () => {
  const st = state();
  const svc = createSiteService('depop', [slow('search', 'endpoint', 5, st)], { concurrency: 3, warm: async () => { st.warmed = true; } });
  const all = Promise.all(Array.from({ length: 10 }, () => svc.call('search', {})));
  await sleep(1);
  assert.equal(svc.running(), 3);
  assert.equal(svc.queued(), 7);
  await all;
  assert.equal(st.maxInflight, 3);
  assert.equal(svc.running(), 0);
});

test('restart: a service that dies mid-write never runs the same operation_id twice', async () => {
  const ops = memoryOpStore();
  const st = state(); st.warmed = true;
  const hang: Adapter = { route_id: 'h', manifest: fakeManifest('depop', 'post'), run() { st.runs++; return new Promise(() => {}); } };   // the process dies here
  const one = createSiteService('depop', [hang], { concurrency: 2, ops });
  void one.call('post', { operation_id: 'op-9' });       // abandoned: the process is gone
  await sleep(2);
  const two = createSiteService('depop', [slow('post', 'page', 1, st)], { concurrency: 2, ops });
  const e = await two.call('post', { operation_id: 'op-9' });
  assert.equal(e.ok, false);
  if (!e.ok) assert.deepEqual(e.error.hint, { do: 'reconcile', operation_id: 'op-9' });
  assert.equal(st.runs, 1);                               // only the first, dead run
  assert.equal((await two.call('post', { operation_id: 'op-10' })).ok, true);
});

test('restart: a finished write is answered from the record; the same id in flight shares one run; reads simply run again', async () => {
  const ops = memoryOpStore(); const st = state(); st.warmed = true;
  const svc = createSiteService('depop', [slow('post', 'page', 5, st), slow('search', 'endpoint', 1, st)], { concurrency: 4, ops });
  const [a, b] = await Promise.all([svc.call('post', { operation_id: 'op-1' }), svc.call('post', { operation_id: 'op-1' })]);
  assert.deepEqual(a, b);
  const again = createSiteService('depop', [slow('post', 'page', 5, st)], { concurrency: 4, ops });
  assert.equal((await again.call('post', { operation_id: 'op-1' })).ok, true);
  assert.equal(st.runs, 1);
  await svc.call('search', {}); await svc.call('search', {});
  assert.equal(st.runs, 3);
});
