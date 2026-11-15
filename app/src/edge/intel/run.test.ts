import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { _reset, allEnded, outsideCallCount, runPlan, type Plan, type Route, type PlanTarget, searchParams } from './run.ts';
import { checkAnswer, type AnswerEvent, type Fact } from './answer.ts';

beforeEach(() => _reset());
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms); signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); });
});
const route = (id: string, ms: number, outcome: 'hit' | 'empty' | 'blocked' = 'hit', host = id, calls?: string[]): Route => ({
  route_id: id, host, p95_ms: 50,
  async run(_q, { signal }) { calls?.push(id); await sleep(ms, signal); return { outcome, rows: outcome === 'hit' ? [{ id }] : [], site: 'ebay' }; },
});
const target = (id: string, routes: Route[], deadline_ms = 1000): PlanTarget => ({ target_id: id, query: 'levi 501', deadline_ms, routes, freshness_s: 60 });
const plan = (targets: PlanTarget[], over: Partial<Plan> = {}): Plan => ({
  kind: 'price_now', slots: {}, protocol_version: 1, targets, first_ms: 150, settled_ms: 300,
  calculate: arr => ({ facts: arr.map((a): Fact => ({ name: a.target_id, value: a.rows.length, guarded: { state: 'shown', basis_count: a.rows.length, as_of: null, citation_id: null },
    sources: [{ source_url: `https://x/${a.route_id}`, read_at: '', snapshot_ref: null, fingerprint: '', extractor_version: '', rights: { may_share: true } }] })) }),
  ...over,
});

test('streams partial per arrival, settles at the settled budget, then late', async () => {
  const seen: [AnswerEvent, number][] = [];
  const a = await runPlan(plan([target('t1', [route('a', 10)]), target('t2', [route('b', 60)]), target('t3', [{ ...route('c', 400), async run() { await sleep(400); return { outcome: 'hit', rows: [{ id: 'c' }], site: 'ebay' }; } }])]), (e, x) => seen.push([e, x.facts.length]));
  await allEnded();
  assert.deepEqual(seen, [['answer.partial', 1], ['answer.partial', 2], ['answer.settled', 2], ['answer.late', 3]]);
  assert.equal(a.stage, 'settled');
  assert.ok(a.ms.first! < 60 && a.ms.settled! >= 290);
  assert.deepEqual(checkAnswer(a), []);
});

test('settles early when every target has ended', async () => {
  const a = await runPlan(plan([target('t1', [route('a', 5)])], { settled_ms: 5000 }));
  assert.ok(a.ms.settled! < 100);
});

test('single flight: 50 identical questions in flight make one outside call per route', async () => {
  await Promise.all(Array.from({ length: 50 }, () => runPlan(plan([target('t1', [route('a', 30)])]))));
  assert.equal(outsideCallCount(), 1);
});

test('hedge: when the fastest route fails or stalls past p95, the next host answers, failover under 1 s', async () => {
  const calls: string[] = [];
  const t0 = Date.now();
  const a = await runPlan(plan([target('t1', [route('slow', 900, 'hit', 'h1', calls), route('fast', 20, 'hit', 'h2', calls)])], { settled_ms: 2000 }));
  assert.ok(Date.now() - t0 < 200);
  assert.deepEqual(calls, ['slow', 'fast']);
  assert.equal(a.facts[0]!.sources[0]!.source_url, 'https://x/fast');
  const b = await runPlan(plan([target('t2', [route('dead', 5, 'blocked', 'h3'), route('alive', 5, 'hit', 'h4')])]));
  assert.deepEqual(b.searched.map(s => [s.route_id, s.outcome]), [['dead', 'blocked'], ['alive', 'hit']]);
});

test('a hedge never sends a second call to the same host while the first is in flight', async () => {
  const calls: string[] = [];
  await runPlan(plan([target('t1', [route('r1', 120, 'hit', 'same', calls), route('r2', 5, 'hit', 'same', calls)])]));
  assert.deepEqual(calls, ['r1']);
});

test('a target past its deadline is a timeout in searched, and a failed call is never cached', async () => {
  const a = await runPlan(plan([target('t1', [route('a', 500)], 50)], { settled_ms: 100 }));
  await allEnded();
  assert.deepEqual(a.searched.map(s => s.outcome), ['timeout']);
  const n = outsideCallCount();
  await runPlan(plan([target('t1', [route('b', 5, 'blocked')])]));
  await runPlan(plan([target('t1', [route('b', 5, 'blocked')])]));
  assert.equal(outsideCallCount(), n + 2);
});

test('index facts answer at once, before any target', async () => {
  const seen: AnswerEvent[] = [];
  const idx: Fact = { name: 'ask_range', range: { low: 1, high: 2 }, guarded: { state: 'shown', basis_count: 9, as_of: null, citation_id: 'ci' },
    sources: [{ source_url: 'i', read_at: '', snapshot_ref: null, fingerprint: '', extractor_version: '', rights: { may_share: true } }] };
  const a = await runPlan(plan([target('t1', [route('a', 20)])], { index: [idx] }), e => seen.push(e));
  assert.equal(seen[0], 'answer.partial');
  assert.ok(a.ms.first! < 10);
  assert.equal(a.facts[0]!.name, 'ask_range');
});


test('request-only routes are shared in flight but never enter the run cache', async () => {
  const r = { ...route('dupe.search.api', 1), cache: false };
  await Promise.all([runPlan(plan([target('dupe', [r])])), runPlan(plan([target('dupe', [r])]))]);
  assert.equal(outsideCallCount(), 1);
  await runPlan(plan([target('dupe', [r])]));
  assert.equal(outsideCallCount(), 2, 'Dupe rows must not survive the request in the run cache');
});

test('search_cache_max evicts the oldest inserted entry, including after a cache hit', async () => {
  const prior = searchParams.read('search_cache_max', {}).value;
  searchParams.declare({ name: 'search_cache_max', family: 'scalar', prior: 2 });
  try {
    const ask = (id: string) => runPlan(plan([target(id, [route(id, 1)])]));
    await ask('oldest'); await ask('second'); await ask('oldest'); await ask('third');
    const calls = outsideCallCount();
    await ask('second'); assert.equal(outsideCallCount(), calls, 'second entry is retained');
    await ask('oldest'); assert.equal(outsideCallCount(), calls + 1, 'oldest entry was evicted');
  } finally { searchParams.declare({ name: 'search_cache_max', family: 'scalar', prior }); }
});

test('20 searches share the Poshmark lane pace across plans; another site gets its own slot', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  const starts: number[] = [];
  const pace = { per_minute: 20, min_gap_ms: 3000 };
  const read: Route = { route_id: 'public.poshmark', host: 'poshmark.com', site: 'poshmark', lane: 'public_page', pace, p95_ms: 10,
    async run() { starts.push(Date.now()); return { outcome: 'hit', rows: [{}] }; } };
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  const results = Array.from({ length: 20 }, (_, i) => runPlan(plan([
    { ...target(String(i), [read], 60000), query: `query ${i}` },
  ], { settled_ms: 60000 })));
  await flush();
  const other = runPlan(plan([target('other', [{ ...read, route_id: 'ebay.search.page', host: 'ebay.com', site: 'ebay', lane: 'harness',
    async run() { return { outcome: 'hit', rows: [{}] }; } }])], { settled_ms: 1 }));
  await flush();
  assert.equal((await other).searched[0].outcome, 'hit', 'eBay never queues behind Poshmark');
  for (let i = 1; i < 20; i++) { t.mock.timers.tick(3000); await flush(); }
  const answers = await Promise.all(results);
  await allEnded();
  assert.equal(starts.length, 20, 'every slot inside its deadline is read');
  assert.ok(starts.slice(1).every((start, i) => start - starts[i] >= 3000));
  assert.ok(answers.every(a => a.searched[0]?.outcome === 'hit'), 'all twenty reads fit inside the job deadline');
});

test('a paced route reports its applied pace and queue time spends its deadline', async () => {
  const read: Route = { ...route('paced', 5), site: 'poshmark', lane: 'public_page', pace: { per_minute: 6000, min_gap_ms: 25 }, cache: false };
  const ask = (query: string) => runPlan(plan([{ ...target('p', [read], 15), query }], { settled_ms: 100 }));
  const first = await ask('first'), second = await ask('second');
  assert.equal(second.searched[0].outcome, 'timeout');
  assert.deepEqual(second.searched[0].pace, read.pace);
  assert.deepEqual(first.searched[0].pace, read.pace);
});

test('fallbacks share the target active-read budget rather than receiving a fresh deadline', async () => {
  const first = { ...route('fails', 30, 'blocked'), p95_ms: 1000 };
  const second = route('too_late', 40);
  const a = await runPlan(plan([target('one_budget', [first, second], 50)], { settled_ms: 1000 }));
  assert.deepEqual(a.searched.map(s => s.outcome), ['blocked', 'timeout']);
  assert.equal(a.facts.length, 0);
});

test('SR4 queue time spends the job deadline and an expired eBay slot is never sent', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  const starts: number[] = [];
  const read: Route = { route_id: 'ebay.deadline', host: 'ebay.com', site: 'ebay', lane: 'harness', cache: false,
    pace: { per_minute: 6, min_gap_ms: 10000 }, p95_ms: 3000,
    async run() { starts.push(Date.now()); await sleep(2000); return { outcome: 'empty', rows: [] }; } };
  const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
  const ask = (query: string) => runPlan(plan([{ ...target(query, [read], 10000), query }], { settled_ms: 10000 }));
  const first = ask('first'); await flush();
  t.mock.timers.tick(1000);
  const second = ask('second'); await flush();
  t.mock.timers.tick(1000); await flush(); await first;
  t.mock.timers.tick(9000); await flush();
  const answer = await second;
  assert.equal(answer.searched[0].outcome, 'timeout');
  assert.ok(answer.ms.settled! <= 10000, 'settlement clock started after the pace wait');
  t.mock.timers.tick(20000); await flush();
  assert.deepEqual(starts, [1000], 'the expired queued read was sent');
});

test('SR4 settlement aborts the last shared reader and releases the lane before its own timeout', async () => {
  let aborted = false, secondStarted = false;
  const read: Route = { route_id: 'abort-lane', host: 'ebay.com', site: 'ebay', lane: 'harness', cache: false,
    pace: { per_minute: 1e12, min_gap_ms: 0 }, p95_ms: 100,
    run(q, { signal }) {
      if (q === 'next') { secondStarted = true; return Promise.resolve({ outcome: 'empty', rows: [] }); }
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('cancelled')); }, { once: true }));
    } };
  await runPlan(plan([{ ...target('old', [read], 1000), query: 'old' }], { settled_ms: 20 }));
  assert.equal(aborted, true, 'last settled caller left its shared controller alive');
  await runPlan(plan([{ ...target('next', [read], 100), query: 'next' }], { settled_ms: 100 }));
  assert.equal(secondStarted, true);
});

test('SR4 an older caller ending cannot abort a read still needed by a later caller', async () => {
  let aborted = false;
  const read: Route = { ...route('shared-deadlines', 65), cache: false,
    async run(q, ctx) { ctx.signal.addEventListener('abort', () => { aborted = true; }); return route('shared-deadlines', 65).run(q, ctx); } };
  const older = runPlan(plan([target('older', [read], 30)], { settled_ms: 30 }));
  await sleep(15);
  const newer = runPlan(plan([target('newer', [read], 100)], { settled_ms: 100 }));
  await older;
  assert.equal(aborted, false, 'an active subscriber lost its shared read');
  const answer = await newer;
  assert.equal(answer.searched[0].outcome, 'hit');
  assert.equal(outsideCallCount(), 1);
});

test('SR4 page and harness gaps start at the previous read end, and judgement holds no lane', async () => {
  const { atPace } = await import('./run.ts');
  for (const lane of ['public_page', 'harness']) {
    let endedAt = 0, startedAt = 0;
    const pace = { per_minute: 1e12, min_gap_ms: 15 };
    const first = atPace('site', lane, pace, async readEnded => { await sleep(20); endedAt = Date.now(); readEnded(); await sleep(50); });
    const next = atPace('site', lane, pace, async () => { startedAt = Date.now(); });
    await Promise.all([first, next]);
    assert.ok(startedAt - endedAt >= 14, `${lane} overlapped the read or measured its gap from start`);
    assert.ok(startedAt - endedAt < 50, `${lane} held the lane during judgement`);
  }
});

test('SR4 first is the first source ending even with only empty and failed sources', async () => {
  const answer = await runPlan(plan([target('empty', [route('empty', 5, 'empty')]), target('blocked', [route('blocked', 10, 'blocked')])]));
  assert.equal(typeof answer.ms.first, 'number');
  assert.ok(answer.ms.first! <= answer.ms.settled!);
});

test('SR4 a plan cancelled before entry never sends even an unpaced read', async () => {
  const controller = new AbortController(); controller.abort();
  const answer = await runPlan(plan([target('cancelled', [route('must-not-send', 1)])], { signal: controller.signal }));
  assert.equal(outsideCallCount(), 0, 'pre-cancelled plan sent an outside call');
  assert.equal(answer.stage, 'settled');
});
