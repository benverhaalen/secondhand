import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore, memoryLeases, memoryParams, fakeHarness, JOB_FOR, type JobRow, type Row } from './ports.ts';
import { EVENT_KINDS } from './event.ts';

const ev = { user_id: 'u1', source: 'app', action: 'app.list', dedupe_key: 'k1', actor: 'user', observed_at: 'x', effective_at: 'x', trace_id: 't' } as const;

test('product rows: table-scoped ids, equality filters, versions and tenant isolation', () => {
  const s = memoryStore();
  const item = s.put<Row>('item', { id: 'it_1', user_id: 'u1', state: 'review' });
  assert.equal(item.version, 1, 'an inserted row starts at version 1');
  assert.deepEqual(s.get('item', 'u1', item.id), item, 'get returns the stored row');
  s.put('listing', { id: item.id, user_id: 'u1', state: 'live' });
  s.put('item', { id: 'it_2', user_id: 'u2', state: 'review' });
  assert.equal(s.get('item', 'u2', item.id), undefined, 'get hides another tenant');
  assert.deepEqual(s.rows('item', { user_id: 'u1', state: 'review' }), [item], 'rows hides other tenants');
  assert.deepEqual(s.rows('item', { user_id: 'u1', state: 'live' }), [], 'filters match by equality');
  assert.equal(s.put('item', { ...item, state: 'live' }).version, 2, 'updates increment versions');
  assert.throws(() => s.put('item', item), { code: 'stale' }, 'old versions cannot overwrite newer rows');
  assert.equal(s.put<Row>('item', { id: item.id, user_id: 'u1' }).version, 3, 'unversioned updates increment too');
  assert.equal(s.get('listing', 'u1', item.id)?.version, 1, 'tables have independent rows');
});

test('product rows: transaction rollback restores updates and removes inserts', () => {
  const s = memoryStore();
  const item = s.put('item', { id: 'it_1', user_id: 'u1', state: 'review' });
  assert.throws(() => s.tx(t => {
    t.put('item', { ...item, state: 'live' });
    t.put('order', { id: 'ord_1', user_id: 'u1', item_id: item.id });
    throw new Error('rollback product rows');
  }), /rollback product rows/);
  assert.deepEqual(s.get('item', 'u1', item.id), item, 'rollback restores row and version');
  assert.deepEqual(s.rows('order', { user_id: 'u1' }), [], 'rollback removes new rows');
});

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
