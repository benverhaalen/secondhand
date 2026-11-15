import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from './file-store.ts';
import type { JobRow } from './ports.ts';

const ev = { user_id: 'u1', source: 'app', action: 'app.list', dedupe_key: 'k1', actor: 'user', observed_at: 'x', effective_at: 'x', trace_id: 't' } as const;
const job: Omit<JobRow, 'id'> = { kind: 'post', user_id: 'u1', event_id: 'e', idempotency_key: 'k1', args: {}, state: 'queued', stages: [], attempts: 0, trace_id: 't', created_at: 'x' };
function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-store-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'data', 'store.json');
}

test('reload preserves events, jobs, decisions, product rows and uniqueness', t => {
  const path = fixture(t), s = fileStore(path);
  const event = s.insertEvent(ev).row;
  const queued = s.insertJob(job).row;
  const decision = s.raiseDecision({ user_id: 'u1', kind: 'first_post', subject: 'it_1', why: 'approval', options: [] }).row;
  s.updateJob(queued.id, { attempts: 1 });
  s.updateDecision(decision.id, { state: 'answered' });
  const item = s.put('item', { id: 'it_1', user_id: 'u1', state: 'review' });
  const loaded = fileStore(path);
  assert.deepEqual(loaded.events(), [event], 'events survive reload');
  assert.equal(loaded.getJob(queued.id)?.attempts, 1, 'job updates survive reload');
  assert.equal(loaded.decisions()[0].state, 'answered', 'decision updates survive reload');
  assert.deepEqual(loaded.get('item', 'u1', item.id), item, 'product rows survive reload');
  assert.equal(loaded.insertEvent(ev).duplicate, true, 'event dedupe survives reload');
  assert.equal(loaded.insertJob(job).duplicate, true, 'job idempotency survives reload');
  assert.equal(loaded.insertEvent({ ...ev, user_id: 'u2' }).duplicate, false, 'event uniqueness is per tenant');
  assert.equal(loaded.insertJob({ ...job, user_id: 'u2' }).duplicate, false, 'job uniqueness is per tenant');
  assert.equal(existsSync(path + '.tmp'), false, 'atomic rename leaves no temporary file');
});

test('product rows with the same id retain independent tenants and versions after reload', t => {
  const path = fixture(t), s = fileStore(path);
  const first = s.put('item', { id: 'it_1', user_id: 'u1', state: 'review' });
  const second = s.put('item', { id: 'it_1', user_id: 'u2', state: 'live' });
  const loaded = fileStore(path);
  assert.deepEqual(loaded.get('item', 'u1', 'it_1'), first, 'first tenant survives the second insert');
  assert.deepEqual(loaded.get('item', 'u2', 'it_1'), second, 'second tenant survives reload');
  const updatedFirst = loaded.put('item', { ...first, state: 'live' });
  const updatedSecond = loaded.put('item', { ...second, state: 'review' });
  const restarted = fileStore(path);
  assert.equal(updatedFirst.version, 2);
  assert.equal(updatedSecond.version, 2);
  assert.deepEqual(restarted.get('item', 'u1', 'it_1'), updatedFirst, 'second update does not move the first version');
  assert.deepEqual(restarted.get('item', 'u2', 'it_1'), updatedSecond, 'first update does not move the second version');
});

test('transactions persist together; throwing transactions leave file and memory unchanged', t => {
  const path = fixture(t), s = fileStore(path);
  s.put('item', { id: 'it_1', user_id: 'u1' });
  const before = readFileSync(path, 'utf8');
  assert.throws(() => s.tx(tx => {
    tx.put('order', { id: 'ord_1', user_id: 'u1' });
    s.insertEvent(ev);
    assert.equal(readFileSync(path, 'utf8'), before, 'no partial transaction is saved');
    throw new Error('abort');
  }), /abort/);
  assert.equal(readFileSync(path, 'utf8'), before, 'rollback leaves file bytes unchanged');
  assert.deepEqual(s.events(), [], 'rollback restores events');
  assert.deepEqual(s.rows('order', { user_id: 'u1' }), [], 'rollback restores rows');
  s.tx(tx => {
    tx.put('order', { id: 'ord_2', user_id: 'u1' });
    tx.tx(inner => inner.insertEvent(ev));
    assert.equal(readFileSync(path, 'utf8'), before, 'nested commits wait for outer transaction');
  });
  assert.equal(fileStore(path).rows('order', { user_id: 'u1' }).length, 1, 'commit saves product rows');
  assert.equal(fileStore(path).events().length, 1, 'commit saves events');
});

test('unlink jobs inserted by the pipeline survive reload with other stored rows', t => {
  const path = fixture(t), s = fileStore(path);
  const item = s.put('item', { id: 'it_1', user_id: 'u1' });
  const row = s.insertJob({ ...job, kind: 'unlink' as JobRow['kind'] }).row;
  const loaded = fileStore(path);
  assert.deepEqual(loaded.getJob(row.id), row, 'pipeline job kinds survive reload');
  assert.deepEqual(loaded.get('item', 'u1', item.id), item, 'pipeline jobs do not make product rows unloadable');
});

for (const action of ['claimJobs', 'release'] as const) test(`${action} changes only memory without rewriting the file`, t => {
  const path = fixture(t), s = fileStore(path);
  const row = s.insertJob(job).row;
  if (action === 'release') s.claimJobs(1, 'worker');
  const before = readFileSync(path, 'utf8');
  utimesSync(path, new Date('2000-01-01T00:00:00Z'), new Date('2000-01-01T00:00:00Z'));
  const modified = statSync(path, { bigint: true }).mtimeNs;
  if (action === 'claimJobs') {
    assert.deepEqual(s.claimJobs(1, 'worker'), [row]);
    assert.equal(s.claims.get(row.id), 'worker');
  } else {
    s.release(row.id);
    assert.equal(s.claims.has(row.id), false);
  }
  assert.equal(statSync(path, { bigint: true }).mtimeNs, modified, `${action} must not rewrite the file`);
  assert.equal(readFileSync(path, 'utf8'), before);
});

test('restart queues running jobs, preserves stage checkpoints and discards worker claims', t => {
  const path = fixture(t), s = fileStore(path);
  const row = s.insertJob(job).row;
  s.claimJobs(1, 'dead-worker');
  const stages = [{ name: 'write', state: 'started' as const }];
  s.updateJob(row.id, { state: 'running', stages });
  const loaded = fileStore(path);
  assert.equal(loaded.claims.size, 0, 'worker claims do not survive restart');
  assert.equal(loaded.getJob(row.id)?.state, 'queued', 'dead-worker running jobs return to queue');
  assert.deepEqual(loaded.getJob(row.id)?.stages, stages, 'checkpoints survive for read-back');
  assert.equal(loaded.claimJobs(1, 'new-worker')[0]?.id, row.id, 'recovered jobs are claimable');
});

test('failed disk writes throw and roll back memory without replacing the saved file', t => {
  const path = fixture(t), s = fileStore(path);
  s.put('item', { id: 'it_1', user_id: 'u1' });
  const before = readFileSync(path, 'utf8');
  mkdirSync(path + '.tmp');
  assert.throws(() => s.put('order', { id: 'ord_1', user_id: 'u1' }), 'disk errors propagate');
  assert.equal(readFileSync(path, 'utf8'), before, 'failed atomic save leaves the old file');
  assert.deepEqual(s.rows('order', { user_id: 'u1' }), [], 'failed persistence does not leave an unsaved row in memory');
});

test('corrupt JSON and invalid state shapes throw with the path and preserve data', t => {
  const path = fixture(t);
  const s = fileStore(path);
  s.put('item', { id: 'it_1', user_id: 'u1' });
  const valid = JSON.parse(readFileSync(path, 'utf8'));
  const invalidKinds = ['', null, 42, undefined].map(kind => JSON.stringify({ ...valid, jobs: [{ ...job, id: 'job_1', kind }] }));
  for (const data of ['{', 'null', '{}', JSON.stringify({ ...valid, jobs: [{}] }), ...invalidKinds, JSON.stringify({ ...valid, rows: { item: [null] } })]) {
    writeFileSync(path, data);
    assert.throws(() => fileStore(path), error => error instanceof Error && error.message.includes(path), 'invalid state must name its path');
    assert.equal(readFileSync(path, 'utf8'), data, 'invalid state is never replaced with empty data');
  }
});

const operation = { id: 'op_1', user_id: 'u1', site: 'ebay', verb: 'post', data: 'synthetic', at: '2026-11-15T00:00:00Z' } as const;

test('operation ledger: restart preserves started claims and done results without a second claim', t => {
  const path = fixture(t), s = fileStore(path);
  const { row } = s.beginOperation(operation);
  const loaded = fileStore(path);
  assert.deepEqual(loaded.get('operation', 'u1', operation.id), row);
  assert.deepEqual(loaded.rows('operation', { user_id: 'u1', state: 'started' }), [row]);
  assert.deepEqual(loaded.beginOperation(operation), { row, duplicate: true });
  const unknown = loaded.settleOperation('u1', operation.id, { state: 'unknown', at: 'read-back' });
  assert.deepEqual(fileStore(path).get('operation', 'u1', operation.id), unknown);
  const done = loaded.settleOperation('u1', operation.id, { state: 'done', envelope: { ok: true, data: { id: 'listing_1' } }, at: 'settled' });
  const restarted = fileStore(path);
  assert.deepEqual(restarted.settleOperation('u1', operation.id, { state: 'done', envelope: { ok: false }, at: 'later' }), done);
  assert.deepEqual(fileStore(path).get('operation', 'u1', operation.id), done);
});

test('operation ledger: rollback and refused envelopes leave memory and disk unchanged', t => {
  const path = fixture(t), s = fileStore(path);
  s.beginOperation(operation);
  const before = readFileSync(path, 'utf8');
  assert.throws(() => s.tx(tx => { tx.beginOperation({ ...operation, id: 'op_2' }); throw new Error('abort claim'); }), /abort claim/);
  assert.equal(s.get('operation', 'u1', 'op_2'), undefined);
  assert.throws(() => s.settleOperation('u1', operation.id, { state: 'done', envelope: { data: [{ cookie: 'synthetic' }] }, at: 'later' }), /envelope/);
  assert.equal(readFileSync(path, 'utf8'), before);
  assert.deepEqual(s.get('operation', 'u1', operation.id), fileStore(path).get('operation', 'u1', operation.id));
  mkdirSync(path + '.tmp');
  assert.throws(() => s.beginOperation({ ...operation, id: 'op_2' }));
  assert.equal(s.get('operation', 'u1', 'op_2'), undefined);
  assert.throws(() => s.settleOperation('u1', operation.id, { state: 'unknown', at: 'later' }));
  assert.equal(readFileSync(path, 'utf8'), before);
  assert.equal(s.get('operation', 'u1', operation.id)?.state, 'started');
});
