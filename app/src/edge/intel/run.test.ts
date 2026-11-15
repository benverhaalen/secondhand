import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { _reset, allEnded, outsideCallCount, runPlan, type Plan, type Route, type PlanTarget } from './run.ts';
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
  const a = await runPlan(plan([target('t1', [route('a', 10)]), target('t2', [route('b', 60)]), target('t3', [route('c', 400)])]), (e, x) => seen.push([e, x.facts.length]));
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
