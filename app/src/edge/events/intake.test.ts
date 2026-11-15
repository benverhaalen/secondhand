import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore } from './ports.ts';
import { EVENT_KINDS } from './event.ts';
import type { EventRow } from './event.ts';
import { JOB_FOR } from './ports.ts';
import { ingest } from './intake.ts';

const base: Omit<EventRow, 'id'> = { user_id: 'u1', source: 'site_push', site: 'ebay', account_id: 'a1', action: 'offer.received', item_id: 'i1', listing_id: 'l1', payload: { cents: 500 }, dedupe_key: 'ebay:a1:n1', actor: 'site', observed_at: 't', effective_at: 't', trace_id: 'tr' };
const setup = () => { const sink = memorySink(); return { store: memoryStore(), sink, log: createLog({ src: 'test', build: 't', sink }) }; };

test('each event writes one event row and one queued job of the routed kind', () => {
  const { store, log } = setup();
  const r = ingest(store, log, base) as any;
  assert.equal(r.duplicate, false);
  const jobs = store.jobs();
  assert.equal(store.events().length, 1);
  assert.equal(jobs.length, 1);
  assert.deepEqual([jobs[0].kind, jobs[0].state, jobs[0].attempts, jobs[0].stages, jobs[0].idempotency_key, jobs[0].event_id, jobs[0].args],
    ['answer_offer', 'queued', 0, [], 'ebay:a1:n1', r.event.id, { cents: 500 }]);
  assert.deepEqual([jobs[0].site, jobs[0].account_id, jobs[0].item_id, jobs[0].listing_id], ['ebay', 'a1', 'i1', 'l1']);
});

test('every event kind starts the job kind JOB_FOR names', () => {
  const { store, log } = setup();
  for (const k of EVENT_KINDS) ingest(store, log, { ...base, action: k, dedupe_key: k });
  for (const k of EVENT_KINDS) assert.equal(store.jobs().find(j => j.idempotency_key === k)?.kind, JOB_FOR[k]);
});

test('dedupe: an event delivered twice is one event and one job, the second says duplicate', () => {
  const { store, log } = setup();
  const a = ingest(store, log, base) as any, b = ingest(store, log, { ...base }) as any;
  assert.equal(b.duplicate, true);
  assert.equal(b.event.id, a.event.id); assert.equal(b.job.id, a.job.id);
  assert.equal(store.events().length, 1); assert.equal(store.jobs().length, 1);
});

test('refused: a missing or blank dedupe key, an unknown action, writes nothing', () => {
  const { store, log } = setup();
  assert.deepEqual(ingest(store, log, { ...base, dedupe_key: '' }), { refused: ['dedupe_key'] });
  assert.deepEqual(ingest(store, log, { ...base, action: 'nope' as any }), { refused: ['action'] });
  assert.equal(store.events().length + store.jobs().length, 0);
});

test('log: one event.received per intake with site, account, dedupe key, duplicate flag', () => {
  const { store, log, sink } = setup();
  ingest(store, log, base); ingest(store, log, base);
  const got = sink.lines.map(l => JSON.parse(l)).filter(l => l.event === 'event.received');
  assert.equal(got.length, 2);
  assert.deepEqual(got.map(l => l.duplicate), [false, true]);
  assert.deepEqual([got[0].source, got[0].kind, got[0].site, got[0].account_id, got[0].dedupe_key], ['site_push', 'offer.received', 'ebay', 'a1', 'ebay:a1:n1']);
});

test('a tx that fails writes neither the event nor the job', () => {
  const { store, log } = setup();
  const bad = { ...store, insertJob() { throw new Error('boom'); } };
  const wrapped = { ...store, tx: (fn: any) => store.tx(() => fn(bad)) } as any;
  assert.throws(() => ingest(wrapped, log, base));
  assert.equal(store.events().length, 0);
});
