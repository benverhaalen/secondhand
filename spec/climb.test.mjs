import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank } from '../log/climb.mjs';

const at = ms => new Date(Date.UTC(2026, 10, 15, 0, 0, 0, ms)).toISOString();
let seq = 0;
const line = (ms, event, rest = {}) => ({ ts: at(ms), session: 's_1', seq: seq++, src: 'test', level: rest.ok === false ? 'error' : 'info', event, ...rest });

test('rank puts the work that costs the most time first, and counts the time failures threw away', () => {
  seq = 0;
  const r = rank([
    line(0, 'timing', { name: 'check.links', ok: true, ms: 900 }),
    line(0, 'timing', { name: 'check.links', ok: true, ms: 1100 }),
    line(0, 'timing', { name: 'check.brand', ok: true, ms: 50 }),
    line(0, 'call.start', { call: 'c1', kind: 'model', name: 'gpt.extract' }),
    line(3000, 'call.end', { call: 'c1', ok: false, ms: 3000, cost_usd: 0.02, error: { type: 'Timeout', msg: 'late' } }),
    line(3000, 'call.start', { call: 'c2', kind: 'model', name: 'gpt.extract' }),
    line(4000, 'call.end', { call: 'c2', ok: true, ms: 1000, cost_usd: 0.02, tokens_in: 900, tokens_out: 100 }),
  ]);
  assert.deepEqual(r.work.map(w => [w.what, w.n, w.failed, w.total_ms, w.failed_ms]), [
    ['call model gpt.extract', 2, 1, 4000, 3000],
    ['timing check.links', 2, 0, 2000, 0],
    ['timing check.brand', 1, 0, 50, 0],
  ]);
  assert.deepEqual([r.work[0].cost_usd, r.work[0].tokens], [0.04, 1000]);
});

test('rank splits a job into the wait before it ran and the run, per kind, and sums an agent run with its calls', () => {
  seq = 0;
  const r = rank([
    line(0, 'job.state', { job: 'j1', kind: 'image', state: 'queued' }),
    line(5000, 'job.state', { job: 'j1', kind: 'image', state: 'running' }),
    line(7000, 'job.state', { job: 'j1', kind: 'image', state: 'done' }),
    line(0, 'job.state', { job: 'j2', kind: 'image', state: 'queued' }),
    line(1000, 'job.state', { job: 'j2', kind: 'image', state: 'running' }),
    line(9000, 'job.state', { job: 'j2', kind: 'image', state: 'failed', error: { type: 'E', msg: 'x' } }),
    line(0, 'agent.start', { run: 'r1', agent: 'lister' }),
    line(10, 'call.start', { call: 'c1', kind: 'model', name: 'm', run: 'r1' }),
    line(20, 'call.end', { call: 'c1', ok: true, ms: 10, cost_usd: 0.5, run: 'r1' }),
    line(30, 'agent.end', { run: 'r1', ok: true, steps: 3, ms: 30 }),
  ]);
  assert.deepEqual(r.jobs, [{ kind: 'image', n: 2, failed: 1, wait_total_ms: 6000, wait_p95_ms: 5000, run_total_ms: 10000, run_p95_ms: 8000, failed_ms: 8000 }]);
  assert.deepEqual(r.agents, [{ agent: 'lister', n: 1, failed: 0, steps: 3, total_ms: 30, cost_usd: 0.5 }]);
});
