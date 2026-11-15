import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLog, memorySink } from '../log/index.js';
import { startTicks, type TickRuntime } from './ticks.ts';

function fixture() {
  const sink = memorySink();
  const log = createLog({ src: 'server.test', build: 'test', sink });
  const jobs = [{ id: 'job_1', attempts: 0 }];
  const runtime: TickRuntime = {
    store: { jobs: () => jobs },
    watcher: { tick: async () => ({ ran: [], skipped: [], stale: [] }) },
    pipeline: { runOnce: async () => 0 },
  };
  return { sink, log, jobs, runtime };
}

test('watcher runs before the pipeline, which drains only passes that attempted work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runtime, jobs, sink, log } = fixture();
  const calls: string[] = [];
  runtime.watcher.tick = async () => { calls.push('watcher'); jobs[0].attempts++; return { ran: ['x'], skipped: ['x'], stale: [] }; };
  let passes = 0;
  runtime.pipeline.runOnce = async limit => { calls.push(`pipeline:${limit}`); if (++passes === 1) jobs[0].attempts++; return 1; };
  const ticks = startTicks({ runtime, log, everyMs: 10, now: () => 50 });
  await new Promise(resolve => setImmediate(resolve));
  await ticks.stop();
  assert.deepEqual(calls, ['watcher', 'pipeline:1', 'pipeline:1']);
  const event = sink.lines.map(line => JSON.parse(line)).find(row => row.event === 'note' && row.msg === 'watch.tick');
  assert.deepEqual([event.ran, event.skipped, event.stale, event.jobs_run, event.route_jobs_run, event.ms], [1, 1, 0, 1, 1, 0]);
});

test('a throwing tick is logged and the next tick still runs', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runtime, sink, log } = fixture();
  let runs = 0;
  runtime.watcher.tick = async () => { if (++runs === 1) throw new Error('watcher failed'); return { ran: [], skipped: [], stale: [] }; };
  const ticks = startTicks({ runtime, log, everyMs: 10 });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(sink.text(), /watcher failed/);
  t.mock.timers.tick(10);
  await new Promise(resolve => setImmediate(resolve));
  await ticks.stop();
  assert.equal(runs, 2);
  assert.match(sink.text(), /"msg":"watch.tick"/);
});

test('ticks never overlap and stop waits for a slow tick before resolving', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { runtime, log } = fixture();
  const gate = Promise.withResolvers<void>();
  let runs = 0;
  runtime.watcher.tick = async () => { runs++; await gate.promise; return { ran: [], skipped: [], stale: [] }; };
  const ticks = startTicks({ runtime, log, everyMs: 10 });
  t.mock.timers.tick(100);
  assert.equal(runs, 1);
  let stopped = false;
  const stopping = ticks.stop().then(() => { stopped = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, false);
  gate.resolve();
  await stopping;
  t.mock.timers.tick(100);
  assert.equal(runs, 1);
  await ticks.stop();
});

test('an invalid cadence fails before a timer or watcher starts', () => {
  const { runtime, log } = fixture();
  for (const everyMs of [0, -1, NaN, Infinity, 2147483648]) {
    assert.throws(() => startTicks({ runtime, log, everyMs }), /everyMs/);
  }
});
