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

test('product rows: identical ids belong to each tenant and versions advance independently', () => {
  const s = memoryStore();
  const first = s.put('item', { id: 'it_1', user_id: 'u1', state: 'review' });
  const second = s.put('item', { id: 'it_1', user_id: 'u2', state: 'live' });
  assert.equal(second.version, 1, 'another tenant starts its own version');
  assert.deepEqual(s.get('item', 'u1', 'it_1'), first, 'another tenant cannot replace the first row');
  assert.deepEqual(s.get('item', 'u2', 'it_1'), second, 'each tenant can read its own row');
  const updatedFirst = s.put('item', { ...first, state: 'live' });
  assert.equal(updatedFirst.version, 2);
  assert.deepEqual(s.get('item', 'u2', 'it_1'), second, 'first tenant update leaves the second version unchanged');
  const updatedSecond = s.put('item', { ...second, state: 'review' });
  assert.equal(updatedSecond.version, 2);
  assert.deepEqual(s.get('item', 'u1', 'it_1'), updatedFirst, 'second tenant update leaves the first version unchanged');
  assert.deepEqual(s.get('item', 'u2', 'it_1'), updatedSecond);
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

const operation = { id: 'op_1', user_id: 'u1', site: 'ebay', verb: 'post', sku_hash: 'hash_1', data: 'synthetic', at: '2026-11-15T00:00:00Z' } as const;

test('operation claim: duplicate begin preserves the first row and tenant claims are independent', () => {
  const s = memoryStore();
  const first = s.beginOperation(operation);
  assert.equal(first.duplicate, false);
  assert.deepEqual(first.row, { ...operation, state: 'started', attempts: 1, version: 1 });
  assert.deepEqual(s.beginOperation({ ...operation, verb: 'end', at: 'later' }), { row: first.row, duplicate: true });
  assert.deepEqual(s.rows('operation', { user_id: 'u1' }), [first.row]);
  assert.equal(s.get('operation', 'u2', operation.id), undefined);
  assert.deepEqual(s.rows('operation', { user_id: 'u2' }), []);
  const other = s.beginOperation({ ...operation, user_id: 'u2' });
  assert.equal(other.duplicate, false);
  s.settleOperation('u2', operation.id, { state: 'unknown', at: 'later' });
  assert.deepEqual(s.get('operation', 'u1', operation.id), first.row);
  assert.equal(s.get('operation', 'u2', operation.id)?.state, 'unknown');
});

test('operation claim: throwing transaction removes claim so it can be begun again', () => {
  const s = memoryStore();
  assert.throws(() => s.tx(t => { t.beginOperation(operation); throw new Error('abort claim'); }), /abort claim/);
  assert.deepEqual(s.rows('operation', { user_id: 'u1' }), []);
  assert.equal(s.beginOperation(operation).duplicate, false);
});

test('operation settlement: missing rows throw and the first done result is final', () => {
  const s = memoryStore();
  assert.throws(() => s.settleOperation('u1', operation.id, { state: 'done', at: 'later' }), /no operation/);
  s.beginOperation(operation);
  assert.throws(() => s.settleOperation('u2', operation.id, { state: 'done', at: 'later' }), /no operation/);
  const unknown = s.settleOperation('u1', operation.id, { state: 'unknown', attempts: 2, at: 'later' });
  assert.equal(unknown.version, 2);
  assert.equal(unknown.attempts, 2);
  const done = s.settleOperation('u1', operation.id, { state: 'done', envelope: { ok: true, data: { id: 'listing_1' } }, at: 'settled' });
  assert.equal(done.version, 3);
  assert.equal(done.at, 'settled');
  assert.equal(done.data, operation.data);
  assert.deepEqual(s.settleOperation('u1', operation.id, { state: 'done', envelope: { ok: false }, attempts: 5, at: 'replacement' }), done);
  assert.deepEqual(s.settleOperation('u1', operation.id, { state: 'unknown', at: 'replacement' }), done);
  assert.deepEqual(s.beginOperation(operation), { row: done, duplicate: true });
});

for (const key of ['cookie', 'accessToken', 'Authorization', 'password', 'Set-Cookie', 'buyer_name', 'shippingAddress']) {
  test(`operation settlement: refuses nested ${key} without changing the row`, () => {
    const s = memoryStore();
    const { row } = s.beginOperation(operation);
    assert.throws(() => s.settleOperation('u1', operation.id, { state: 'done', envelope: { data: [{ nested: { [key]: 'synthetic' } }] }, at: 'later' }), /envelope/);
    assert.deepEqual(s.get('operation', 'u1', operation.id), row);
  });
}


test('system rows enumerate all tenants with equality filters without widening tenant reads', () => {
  const s = memoryStore();
  const a = s.put('account', { id: 'acc_shared', user_id: 'usr_a', site: 'depop' });
  const b = s.put('account', { id: 'acc_shared', user_id: 'usr_b', site: 'ebay' });
  s.put('item', { id: 'it_other', user_id: 'usr_b' });
  assert.deepEqual(s.systemRows('account'), [a, b]);
  assert.deepEqual(s.systemRows('account', { site: 'ebay' }), [b]);
  assert.deepEqual(s.systemRows('account', { user_id: 'usr_a' }), [a]);
  assert.deepEqual(s.rows('account', { user_id: 'usr_a' }), [a]);
});
