import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore } from './ports.ts';
import type { EventRow } from './event.ts';
import { withOutbox, deliver } from './outbox.ts';

const ev: Omit<EventRow, 'id'> = { user_id: 'u1', source: 'app', action: 'app.list', item_id: 'i1', dedupe_key: 'app:i1:list:1', actor: 'user', observed_at: 't', effective_at: 't', trace_id: 'tr' };
const log = () => createLog({ src: 'test', build: 't', sink: memorySink() });
// the route's "change" is a decision row, written through the same tx
const change = (t: any) => t.raiseDecision({ user_id: 'u1', kind: 'first_post', subject: 'i1', why: 'w', options: [] });

test('the change and its event commit together', () => {
  const s = memoryStore();
  const r = withOutbox(s, log(), t => ({ result: change(t).row.id, event: ev }));
  assert.equal(s.decisions().length, 1); assert.equal(s.events().length, 1); assert.equal(s.jobs().length, 1);
  assert.equal(r.event.action, 'app.list');
});

test('rollback: a refused event rolls the change back', () => {
  const s = memoryStore();
  assert.throws(() => withOutbox(s, log(), t => ({ result: change(t), event: { ...ev, dedupe_key: '' } })));
  assert.equal(s.decisions().length + s.events().length + s.jobs().length, 0);
});

test('rollback: a throwing event write rolls the change back', () => {
  const s = memoryStore();
  const wrapped = { ...s, tx: (fn: any) => s.tx(() => fn({ ...s, insertEvent() { throw new Error('db down'); } })) } as any;
  assert.throws(() => withOutbox(wrapped, log(), t => ({ result: change(t), event: ev })), /db down/);
  assert.equal(s.decisions().length, 0);
});

test('delivery: every undelivered event reaches the consumer once, then none', async () => {
  const s = memoryStore(); const seen: string[] = [];
  withOutbox(s, log(), () => ({ result: 1, event: ev }));
  withOutbox(s, log(), () => ({ result: 2, event: { ...ev, dedupe_key: 'k2' } }));
  const c = (e: EventRow) => { seen.push(e.id); };
  assert.deepEqual(await deliver(s, c, { worker: 'w' }), { delivered: 2, failed: 0 });
  assert.deepEqual(await deliver(s, c, { worker: 'w' }), { delivered: 0, failed: 0 });
  assert.equal(seen.length, 2);
});

test('crash after commit: committed, then the process dies, a fresh deliver delivers it', async () => {
  const s = memoryStore();
  withOutbox(s, log(), () => ({ result: 1, event: ev }));
  await assert.rejects(async () => { throw new Error('process died before delivery'); });
  const seen: string[] = [];
  await deliver(s, e => { seen.push(e.id); }, { worker: 'w2' });
  assert.equal(seen.length, 1);
});

test('delivery twice (crash between consumer and marker): the idempotent consumer does its effect once', async () => {
  const s = memoryStore(); const effects = new Set<string>(); let calls = 0;
  withOutbox(s, log(), () => ({ result: 1, event: ev }));
  const consumer = (e: EventRow) => { calls++; effects.add(e.id); };
  const real = s.updateJob; let die = true;
  s.updateJob = (id, p) => { if (die) { die = false; throw new Error('crash before marker'); } return real(id, p); };
  assert.deepEqual(await deliver(s, consumer, { worker: 'w' }), { delivered: 0, failed: 1 });
  await deliver(s, consumer, { worker: 'w' });
  assert.equal(calls, 2); assert.equal(effects.size, 1);
});

test('a failing consumer leaves the event undelivered and does not stop the others', async () => {
  const s = memoryStore(); const seen: string[] = [];
  withOutbox(s, log(), () => ({ result: 1, event: ev }));
  withOutbox(s, log(), () => ({ result: 2, event: { ...ev, dedupe_key: 'k2' } }));
  let first = true;
  const r = await deliver(s, e => { if (first) { first = false; throw new Error('x'); } seen.push(e.id); }, { worker: 'w' });
  assert.deepEqual(r, { delivered: 1, failed: 1 });
  await deliver(s, e => { seen.push(e.id); }, { worker: 'w' });
  assert.equal(seen.length, 2);
});
