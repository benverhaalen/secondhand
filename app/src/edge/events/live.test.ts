import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore, memoryParams } from './ports.ts';
import { listen } from './live.ts';
import type { Frame } from './live.ts';

const fr = (id: string, at = '2026-11-14T00:00:0' + id.slice(-1) + 'Z'): Frame => ({ id, action: 'message.received', at });
async function* frames(list: Frame[], then?: Error) { for (const f of list) yield f; if (then) throw then; }
const setup = (connects: Array<(s: AbortSignal) => AsyncIterable<Frame>>, backfill: (since: string) => Frame[] = () => []) => {
  const store = memoryStore(), sink = memorySink(), delays: number[] = [], since: string[] = []; let n = 0;
  let h: ReturnType<typeof listen>;
  const o = {
    store, log: createLog({ src: 'test', build: 't', sink }), params: memoryParams({ live_reconnect_ms: 1000 }),
    account: 'a1', site: 'ebay', user_id: 'u1', now: () => '2026-11-14T00:00:00Z',
    connect: (s: AbortSignal) => { const c = connects[n++]; if (!c) { h.stop(); return frames([]); } return c(s); },
    backfill: (s: string) => { since.push(s); return backfill(s); },
    sleep: async (ms: number) => { delays.push(ms); },
  };
  h = listen(o);
  return { store, sink, delays, since, h };
};

test('a frame is one live_channel event with the live dedupe key', async () => {
  const { store, h } = setup([() => frames([fr('f1')])]);
  await h.done;
  const [e] = store.events();
  assert.deepEqual([e.source, e.site, e.account_id, e.dedupe_key, e.action], ['live_channel', 'ebay', 'a1', 'ebay:a1:live:f1', 'message.received']);
  assert.equal(store.jobs().length, 1);
});

test('after a drop it backs off, backfills since the last frame, and ingests those once', async () => {
  const { store, delays, since, h } = setup([() => frames([fr('f1')], new Error('closed')), () => frames([fr('f3')])], () => [fr('f1'), fr('f2')]);
  await h.done;
  assert.deepEqual(since[0], '2026-11-14T00:00:01Z');
  assert.deepEqual(delays.slice(0, 2), [1000, 1000]);
  assert.deepEqual(store.events().map(e => e.dedupe_key).sort(), ['ebay:a1:live:f1', 'ebay:a1:live:f2', 'ebay:a1:live:f3']);
});

test('repeated failures double the delay; the delay comes from the live_reconnect_ms param', async () => {
  const bad = () => frames([], new Error('x'));
  const { delays, h } = setup([bad, bad, bad]);
  await h.done;
  assert.deepEqual(delays.slice(0, 3), [1000, 2000, 4000]);
});

test('stop() ends the loop and aborts a pending wait', async () => {
  const store = memoryStore(); let connects = 0;
  const h = listen({
    store, log: createLog({ src: 'test', build: 't', sink: memorySink() }), params: memoryParams({ live_reconnect_ms: 60000 }),
    account: 'a1', site: 'ebay', user_id: 'u1', backfill: () => [],
    connect: () => { connects++; return frames([], new Error('drop')); },
  });
  await new Promise(r => setTimeout(r, 20));
  h.stop();
  await h.done;
  assert.equal(connects, 1);
});

test('a failing backfill is logged and the loop carries on', async () => {
  const { sink, store, h } = setup([() => frames([], new Error('d')), () => frames([fr('f4')])], () => { throw new Error('boom'); });
  await h.done;
  assert.ok(sink.lines.some(l => l.includes('backfill failed')));
  assert.equal(store.events().length, 1);
});
