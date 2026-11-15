import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore, memoryLeases, memoryParams, fakeHarness, JOB_FOR, type JobRow } from './ports.ts';
import { EVENT_KINDS } from './event.ts';

const ev = { user_id: 'u1', source: 'app', action: 'app.list', dedupe_key: 'k1', actor: 'user', observed_at: 'x', effective_at: 'x', trace_id: 't' } as const;

test('every event kind routes to one job kind', () => {
  for (const k of EVENT_KINDS) assert.ok(JOB_FOR[k], k);
});

test('store: dedupe, skip-locked claims, tx rollback', () => {
  const s = memoryStore();
  assert.equal(s.insertEvent(ev).duplicate, false);
  assert.equal(s.insertEvent(ev).duplicate, true);
  const job: Omit<JobRow, 'id'> = { kind: 'post', user_id: 'u1', event_id: 'e', idempotency_key: 'k1', args: {}, state: 'queued', stages: [], attempts: 0, trace_id: 't', created_at: 'x' };
  s.insertJob(job); s.insertJob({ ...job, idempotency_key: 'k2' });
  assert.equal(s.claimJobs(1, 'w1').length, 1);
  assert.equal(s.claimJobs(5, 'w2').length, 1); // the first is invisible to w2
  assert.throws(() => s.tx(t => { t.insertEvent({ ...ev, dedupe_key: 'k3' }); throw new Error('die'); }));
  assert.equal(s.events().length, 1);
});

test('lease: a second job gets 409; params: row beats prior', async () => {
  const l = memoryLeases();
  assert.deepEqual(l.take('a1', 'j1', 1000), { ok: true });
  assert.equal((l.take('a1', 'j2', 1000) as { status: number }).status, 409);
  const p = memoryParams({ cadence_hot_s: 90 }, { 'cadence_hot_s@depop': 60 });
  assert.equal(p.get('cadence_hot_s', { site: 'depop' }), 60);
  assert.equal(p.get('cadence_hot_s', { site: 'ebay' }), 90);
  const h = fakeHarness();
  assert.equal((await h.call('ebay', 'end', { account_id: 'a1' })).ok, true);
  assert.equal(h.calls.length, 1);
});
