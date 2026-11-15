import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, fakeManifest, type Adapter } from '../protocol.ts';
import { createRouteTable, createWebview, type Job } from './webview.ts';

const meta = { route_id: 'phone', adapter_version: '1.0.0', ms: 5, fell_back: false, observation_ids: [] };
const read = fakeManifest('depop', 'read_listings', { controls: ['#list'] });
const post = fakeManifest('depop', 'post', { controls: ['#title', '#send'], read_back: { verb: 'read_listings', match: ['title', 'price_cents'] } });

function setup() {
  let t = 0, hostedPosts = 0;
  const rows: { id: string; title: string; price_cents: number }[] = [];
  const adapters: Adapter[] = [
    { route_id: 'h.read', manifest: fakeManifest('depop', 'read_listings'), async run() { return { ok: true, data: [...rows] }; } },
    { route_id: 'h.post', manifest: fakeManifest('depop', 'post'), async run() { hostedPosts++; return { ok: true, data: { id: 'H', operation_id: 'x' } }; } },
  ];
  const w = createWebview({ hosted: createHarness({ adapters }), manifests: [read, post], now: () => t, heartbeatMs: 1000 });
  return { w, rows, hostedPosts: () => hostedPosts, tick: (ms: number) => { t += ms; } };
}
const readJob: Job = { job_id: 'j1', account_id: 'a1', site: 'depop', verb: 'read_listings', args: {} };
const postJob: Job = { job_id: 'j2', account_id: 'a1', site: 'depop', verb: 'post', args: { operation_id: 'op-1', title: 'Jacket', price_cents: 4500 } };

test('webview.test.ts: hand-off', async () => {
  const s = setup();
  const r = s.w.offer(readJob);
  assert.deepEqual(r?.controls, ['#list']);
  s.tick(900); assert.equal(s.w.heartbeat('j1'), true);
  s.tick(900); assert.deepEqual(await s.w.tick(), []);            // the beat kept it alive
  s.tick(1001);
  const moved = await s.w.tick();                                 // app closed mid-recipe: the job moves to hosted
  assert.equal(moved[0]?.route, 'hosted');
  assert.equal(moved[0]?.envelope.ok, true);
  assert.deepEqual(s.w.pending(), []);

  // a write: the post landed before the app closed; reconcile finds it, hosted never reposts
  s.w.offer(postJob); s.rows.push({ id: 'L1', title: 'Jacket', price_cents: 4500 });
  s.tick(1001);
  const w1 = (await s.w.tick())[0]!.envelope;
  assert.deepEqual(w1.ok && w1.data, { id: 'L1', operation_id: 'op-1' });
  assert.equal(s.hostedPosts(), 0);
  // absent: a decision, still no replay
  s.rows.length = 0; s.w.offer(postJob); s.tick(1001);
  const w2 = (await s.w.tick())[0]!.envelope;
  assert.equal(w2.ok, false);
  assert.equal(s.hostedPosts(), 0);
  // no phone while the app is closed; default order, measured override
  assert.equal(createWebview({ hosted: createHarness({ adapters: [] }), manifests: [read], now: () => 0, appOpen: () => false }).offer(readJob), null);
  const rt = createRouteTable({ 'depop.post': ['hosted'] });
  assert.deepEqual(rt.rank('ebay', 'search', true), ['phone', 'hosted', 'cookie', 'extension']);
  assert.deepEqual(rt.rank('depop', 'post', false), ['hosted', 'cookie', 'extension']);
});

test('webview.test.ts: envelope', () => {
  const s = setup(); s.w.offer(readJob);
  for (const bad of [null, 'x', {}, { job_id: 'zz', envelope: { ok: true, data: [], meta } }, { job_id: 'j1', envelope: { ok: true } },
    { job_id: 'j1', envelope: { ok: true, data: [] } }, { job_id: 'j1', envelope: { ok: false, error: { code: 'blocked', message: 'm', hint: { do: 'relink' } }, meta } }]) {
    assert.equal((s.w.receive(bad) as { ok: boolean }).ok, false);
  }
  assert.deepEqual(s.w.pending(), ['j1']);                        // nothing malformed completed the job
  const good = s.w.receive({ job_id: 'j1', envelope: { ok: true, data: [], meta } });
  assert.equal(good.ok, true);
  assert.deepEqual(s.w.pending(), []);
});
