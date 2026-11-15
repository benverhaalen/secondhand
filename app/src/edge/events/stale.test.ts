import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore } from './ports.ts';
import type { JobRow, Store } from './ports.ts';
import { markStale, markRelinked, onHarnessError } from './stale.ts';

const log = () => createLog({ src: 'test', build: 't', sink: memorySink() });
let k = 0;
const job = (s: Store, over: Partial<JobRow> = {}) => s.insertJob({
  kind: 'post', user_id: 'u1', event_id: 'e', idempotency_key: `k${++k}`, site: 'ebay', account_id: 'a1', args: {},
  state: 'queued', stages: [], attempts: 0, trace_id: 't', created_at: '2026-11-14T00:00:00Z', ...over,
}).row;

test('markStale pauses queued and running jobs of the account, releases running, raises one relink', () => {
  const s = memoryStore();
  const q = job(s), r = job(s, { state: 'running', attempts: 2, stages: [{ name: 'a', state: 'arrived' }] });
  const other = job(s, { account_id: 'a2' }), done = job(s, { state: 'done' });
  const c = markStale(s, log(), { user_id: 'u1', account_id: 'a1', site: 'ebay' });
  assert.deepEqual([c.paused, c.released], [2, 1]);
  assert.equal(s.getJob(q.id)!.paused, 'account_stale');
  const rr = s.getJob(r.id)!;
  assert.deepEqual([rr.paused, rr.state, rr.attempts, rr.stages.length], ['account_stale', 'queued', 2, 1]);
  assert.equal(s.getJob(other.id)!.paused, undefined);
  assert.equal(s.getJob(done.id)!.paused, undefined);
  const d = s.decisions({ kind: 'relink' });
  assert.equal(d.length, 1);
  assert.deepEqual([d[0].subject, d[0].options, d[0].state], ['a1', [{ id: 'relink', label: 'Re-link' }], 'open']);
});

test('a paused job is not claimed; a second markStale makes no second decision', () => {
  const s = memoryStore(); job(s);
  markStale(s, log(), { user_id: 'u1', account_id: 'a1' });
  assert.equal(s.claimJobs(5, 'w').length, 0);
  assert.equal(markStale(s, log(), { user_id: 'u1', account_id: 'a1' }).duplicate, true);
  assert.equal(s.decisions({ kind: 'relink' }).length, 1);
});

test('markRelinked resumes the jobs with attempts unchanged and closes the decision', () => {
  const s = memoryStore(); const j = job(s, { state: 'running', attempts: 3 });
  markStale(s, log(), { user_id: 'u1', account_id: 'a1' });
  const r = markRelinked(s, log(), { user_id: 'u1', account_id: 'a1' });
  assert.deepEqual(r, { resumed: 1, closed: 1 });
  assert.deepEqual([s.getJob(j.id)!.paused, s.getJob(j.id)!.attempts], [undefined, 3]);
  assert.equal(s.decisions({ kind: 'relink' })[0].state, 'answered');
  assert.equal(s.claimJobs(5, 'w').length, 1);
});

test('only auth_expired calls markStale', () => {
  const s = memoryStore(); const j = job(s);
  assert.equal(onHarnessError(s, log(), j, { code: 'rate_limited' }), undefined);
  assert.equal(s.decisions().length, 0);
  assert.equal(onHarnessError(s, log(), j, { code: 'auth_expired' })!.paused, 1);
  assert.equal(s.decisions({ kind: 'relink' }).length, 1);
});
