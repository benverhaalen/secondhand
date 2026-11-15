import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, fakeManifest, type Adapter, type AdapterResult } from './protocol.ts';
import { reconcile, writeOnce } from './reconcile.ts';

const readBack = { verb: 'read_listings' as const, match: ['title', 'price_cents'] };
const args = { operation_id: 'op-1', title: 'Denim jacket', price_cents: 4500 };

// A fake site with real state: how the post dies decides whether it landed. `kill` = after the post was sent.
function site(opts: { lands: boolean; readFails?: boolean; kill: 'throw' | 'hang' }) {
  const posts: { id: string; title: string; price_cents: number }[] = [];
  let postCalls = 0;
  const post: Adapter = { route_id: 'x.post', manifest: fakeManifest('depop', 'post'), async run(a, signal) {
    postCalls++;
    if (opts.lands) posts.push({ id: `L${posts.length + 1}`, title: String(a.title), price_cents: Number(a.price_cents) });
    if (opts.kill === 'throw') throw new Error('connection reset');
    return new Promise<AdapterResult>((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))));
  } };
  const read: Adapter = { route_id: 'x.read', manifest: fakeManifest('depop', 'read_listings'), async run() {
    if (opts.readFails) throw new Error('read down');
    return { ok: true, data: [...posts] };
  } };
  return { harness: createHarness({ adapters: [post, read], timeoutMs: 20 }), posts, calls: () => postCalls };
}

test('reconcile: timeout after post: read back, found, settled, no repost', async () => {
  for (const kill of ['throw', 'hang'] as const) {
    const s = site({ lands: true, kill });
    const e = await writeOnce(s.harness, 'depop', 'post', args, readBack);
    assert.equal(e.ok, true);
    if (e.ok) assert.deepEqual(e.data, { id: 'L1', operation_id: 'op-1' });
    assert.equal(s.calls(), 1);
    assert.equal(s.posts.length, 1);
  }
});

test('reconcile: read back succeeds and the write is absent: a decision, never a repost', async () => {
  const s = site({ lands: false, kill: 'throw' });
  const e = await writeOnce(s.harness, 'depop', 'post', args, readBack);
  assert.equal(e.ok, false);
  if (!e.ok) { assert.equal(e.error.code, 'policy_refused'); assert.deepEqual(e.error.hint, { do: 'raise_decision', kind: 'write_absent' }); }
  assert.equal(s.calls(), 1);
  assert.equal(s.posts.length, 0);
});

test('reconcile: read back fails: a decision, no repost', async () => {
  const s = site({ lands: true, readFails: true, kill: 'throw' });
  const e = await writeOnce(s.harness, 'depop', 'post', args, readBack);
  assert.equal(e.ok, false);
  if (!e.ok) assert.deepEqual(e.error.hint, { do: 'raise_decision', kind: 'write_unconfirmed' });
  assert.equal(s.calls(), 1);
  assert.equal(s.posts.length, 1);
});

test('reconcile: zero duplicate posts across 20 kills, however many times it is reconciled', async () => {
  const s = site({ lands: true, kill: 'throw' });
  for (let i = 0; i < 20; i++) {
    const a = { ...args, operation_id: `op-${i}`, title: `Item ${i}` };
    const e = await writeOnce(s.harness, 'depop', 'post', a, readBack);
    assert.equal(e.ok, true);
    await reconcile(s.harness, 'depop', { verb: 'post', args: a }, readBack);
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
