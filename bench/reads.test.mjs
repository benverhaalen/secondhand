import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLog } from '../log/index.js';
import { ebayPageAdapters } from '../app/src/edge/harness/sites/ebay/adapter.ts';
import { depopAdapters } from '../app/src/edge/harness/sites/depop/adapter.ts';
import { run } from './reads.mjs';

function setup(steps) {
  const lines = [], starts = [], waits = [], signals = [];
  let clock = 0, index = 0, closed = 0, active = 0;
  const sink = line => lines.push(line);
  const log = createLog({ src: 'reads.test', build: 'test', sink });
  const client = {
    async search(q, signal) {
      signals.push(signal); starts.push(clock); assert.equal(active++, 0);
      const step = steps[index++];
      try {
        clock += step.ms ?? 1;
        log.note('synthetic browser phase', { nav_ms: 20, waited_ms: 30 });
        return await log.call('browser', 'public.read', { site: 'ebay', path: '/sch/i.html' }, async () => {
          if (step.error) throw step.error;
          return step.result ?? { ok: true, data: Array.from({ length: step.rows ?? 1 }, () => ({ title: q })) };
        }, () => ({ site: 'ebay', status: step.status ?? 200, nav_ms: 20, waited_ms: 30, parsed: 'page', fallback: step.fallback }));
      } finally { active--; }
    },
    async close() { closed++; },
  };
  const adapters = c => [{ manifest: { verb: 'search', site: 'ebay' }, run: (args, signal) => c.search(args.q, signal) }];
  const execute = (queries = steps.map((_, i) => `synthetic private query ${i}`), gapMs = 0) => run({
    client, adapters, queries, gapMs, sink, now: () => clock,
    sleep: async ms => { waits.push(ms); clock += ms; },
  });
  return { execute, client, lines, sink, starts, waits, signals, closed: () => closed };
}
const failure = code => ({ ok: false, error: { code, message: 'private error details', hint: {} } });

test('nearest-rank percentiles exclude empty and failed reads', async () => {
  const f = setup([{ ms: 10 }, { ms: 100 }, { ms: 30 }, { ms: 20 }, { ms: 1000, rows: 0 }, { ms: 2000, result: failure('page_changed') }]);
  const summary = await f.execute();
  assert.equal(summary.p50_ms, 20); assert.equal(summary.p95_ms, 100);
  assert.equal(summary.answered, 4); assert.equal(summary.total, 6); assert.equal(summary.rows, 4);
  assert.equal(f.closed(), 1);
  assert.deepEqual(summary.reads[0], { i: 0, query_hash: createHash('sha256').update('synthetic private query 0').digest('hex').slice(0, 12), class: 'answered', rows: 1, ms: 10, nav_ms: 20, waited_ms: 30, parsed: 'page', fallback: null });
});

test('class counting keeps empty, changed shape, timeout and other failures distinct', async () => {
  const error = new Error('do not persist this query'); error.name = 'TimeoutError';
  const f = setup([{ rows: 2 }, { rows: 0 }, { result: failure('page_changed') }, { error }, { error: new Error('private query in thrown error') }, { result: failure('no_route') }]);
  const summary = await f.execute();
  assert.deepEqual(summary.counts_by_class, { answered: 1, empty: 1, refused: 0, challenged: 0, shape_changed: 1, timed_out: 1, failed: 2 });
  assert.equal(summary.rows, 2); assert.equal(f.closed(), 1);
});

test('a challenge stops before the next query without a retry', async () => {
  const f = setup([{ rows: 2 }, { result: failure('blocked') }, { rows: 3 }]);
  const summary = await f.execute();
  assert.equal(summary.reads.length, 2); assert.equal(summary.counts_by_class.challenged, 1);
  assert.equal(summary.stopped.reason, 'site_backoff'); assert.equal(summary.stopped.class, 'challenged');
  assert.equal(summary.total, 3); assert.equal(f.closed(), 1);
});

for (const status of [401, 404, 429, 500, 503]) test(`HTTP ${status} stops as refused even when the adapter calls it blocked`, async () => {
  const f = setup([{ status, result: failure('blocked') }, { rows: 3 }]);
  const summary = await f.execute();
  assert.equal(summary.reads.length, 1); assert.equal(summary.reads[0].class, 'refused');
  assert.equal(summary.stopped.status, status); assert.equal(f.closed(), 1);
});

test('reads run serially with a start-to-start gap and never catch up in a burst', async () => {
  const f = setup([{ ms: 2 }, { ms: 15 }, { ms: 2 }]);
  await f.execute(undefined, 10);
  assert.deepEqual(f.starts, [0, 10, 25]); assert.deepEqual(f.waits, [8]);
});

test('no written line or summary carries query text, rows, titles or raw errors', async () => {
  const queries = ['unusual private words & more', 'other private words'];
  const f = setup([{ rows: 2 }, { result: failure('page_changed') }]);
  const summary = await f.execute(queries);
  const written = f.lines.join('\n') + JSON.stringify(summary);
  for (const value of [...queries, 'private error details', '"title"', '"data"']) assert.ok(!written.includes(value), value);
  assert.equal(f.lines.filter(line => JSON.parse(line).event === 'call.start').length, 2);
  assert.equal(f.lines.filter(line => JSON.parse(line).event === 'call.end').length, 2);
  assert.equal(f.lines.filter(line => JSON.parse(line).msg === 'synthetic browser phase').length, 2);
});

test('no answered reads yields null percentiles rather than a fabricated zero', async () => {
  const f = setup([{ rows: 0 }]);
  const summary = await f.execute();
  assert.equal(summary.p50_ms, null); assert.equal(summary.p95_ms, null);
});

test('SIGINT aborts the active adapter, closes once and keeps its partial summary', async () => {
  const f = setup([{ rows: 1 }, { rows: 1 }]);
  f.client.search = async (_q, signal) => {
    process.emit('SIGINT'); assert.equal(signal.aborted, true);
    throw Object.assign(new Error('private abort'), { name: 'AbortError' });
  };
  const summary = await f.execute();
  assert.equal(summary.reads.length, 1); assert.equal(summary.stopped.reason, 'sigint'); assert.equal(f.closed(), 1);
});

test('real eBay page adapters search the injected client without storing listing fields', async () => {
  const lines = [], calls = [];
  const html = readFileSync(new URL('../app/src/edge/harness/sites/ebay/fixtures/page-search.html', import.meta.url), 'utf8');
  const client = { signed_in: false, page: async url => { calls.push(url); return { status: 200, html }; }, close: async () => {} };
  const summary = await run({ client, adapters: ebayPageAdapters, queries: ['private denim search'], gapMs: 0, sink: line => lines.push(line), now: () => 0, sleep: async () => {} });
  assert.equal(summary.reads[0].class, 'answered'); assert.equal(summary.reads[0].rows, 3);
  assert.match(calls[0], /_nkw=private\+denim\+search/); assert.ok(!lines.join('').includes('private denim search'));
});

test('real Depop page adapters use doc once and count an empty search', async () => {
  let calls = 0, closed = 0;
  const client = { signed_in: false, doc: async () => { calls++; return { status: 200, html: readFileSync(new URL('../app/src/edge/harness/sites/depop/fixtures/search-empty.html', import.meta.url), 'utf8') }; }, close: async () => { closed++; } };
  const summary = await run({ client, adapters: depopAdapters, queries: ['private search'], gapMs: 0, sink: () => {}, now: () => 0, sleep: async () => {} });
  assert.equal(summary.reads[0].class, 'empty'); assert.equal(calls, 1); assert.equal(closed, 1);
});

for (const [status, html, classification] of [
  [503, '<title>Error Page | eBay</title>', 'refused'],
  [200, '<title>Error Page | eBay</title><p>captcha</p>', 'challenged'],
]) test(`an eBay ${classification} stops before its adapter can navigate to another host`, async () => {
  let calls = 0;
  const client = { signed_in: false, page: async () => { calls++; return { status, html }; }, close: async () => {} };
  const summary = await run({ client, adapters: ebayPageAdapters, queries: ['private', 'next private'], gapMs: 0, sink: () => {}, now: () => 0, sleep: async () => {} });
  assert.equal(calls, 1); assert.equal(summary.reads.length, 1); assert.equal(summary.reads[0].class, classification);
});
