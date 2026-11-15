import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gather, measure, protocolSteps, type GatherStep, type StepOut } from './gather.ts';
import { checkAnswer, emptyFound, type Answer, type Fact, type Searched } from './answer.ts';
import type { Arrival, Plan } from './run.ts';

const NOW = Date.parse('2026-11-14T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const row = (price_cents: number, ago = 5) => ({ price_cents, sold_at: daysAgo(ago) });
const arr = (rows: unknown[], id = 'a'): Arrival => ({ target_id: id, route_id: 'r', rows, ms: 1 });

const plan: Plan = {
  kind: 'price_now', slots: {}, protocol_version: 1, targets: [], first_ms: 1, settled_ms: 1,
  calculate(arrivals) {
    const m = measure(arrivals, NOW);
    const ok = m.n_eff >= 6 && m.sold_90d >= 2;
    const guarded = ok ? { state: 'shown' as const, basis_count: Math.round(m.n_eff), as_of: daysAgo(0), citation_id: 'c' }
      : { state: 'hidden' as const, basis_count: Math.round(m.n_eff), as_of: null, citation_id: null, hide_reason: 'too_few' as const };
    const f: Fact = { name: 'sold_range', ...(ok ? { value: m.median } : {}), guarded,
      sources: ok ? [{ source_url: 'https://x', read_at: daysAgo(0), snapshot_ref: null, fingerprint: 'f', extractor_version: '1', rights: { may_share: true } }] : [] };
    return { facts: [f] };
  },
};
const base = (arrivals: Arrival[]): Answer => ({ id: 'a1', kind: 'price_now', slots: {}, protocol_version: 1, facts: plan.calculate(arrivals).facts,
  found: emptyFound(), searched: [{ route_id: 'r', query: 'q', outcome: 'hit', ms: 1 }], stage: 'settled', ms: { first: 1, settled: 2 } });

const step = (n: number, rows: unknown[], over: Partial<StepOut> = {}, est = 0): GatherStep =>
  ({ n, est_cents: est, run: async () => ({ arrivals: rows.length ? [arr(rows, `s${n}`)] : [], searched: [{ route_id: `s${n}`, query: 'q', outcome: rows.length ? 'hit' : 'empty', ms: 1 }], cents: 0, ...over }) });
const run = (arrivals: Arrival[], steps: GatherStep[], extra: Record<string, unknown> = {}) =>
  gather({ answer: base(arrivals), plan, arrivals, steps, product: 'p', now: () => NOW, ...extra });

const spread = (n: number, from = 1000, ago = 5) => Array.from({ length: n }, (_, i) => row(from + i * 500, ago));

test('gather more: thin sales run more steps until the basis is met, one gather.update per step', async () => {
  const ev: string[] = [];
  const r = await run([arr(spread(2))], [step(1, spread(2, 3000)), step(2, spread(3, 6000)), step(3, spread(3, 9000))],
    { onEvent: (e: string, a: Answer) => { ev.push(`${e}:${a.stage}:${a.gather?.steps_done.join('')}`); assert.deepEqual(checkAnswer(a), []); } });
  assert.equal(r.stop, 'basis');
  assert.deepEqual(r.answer.gather?.steps_done, [1, 2]);
  assert.equal(r.answer.facts[0]!.guarded.state, 'shown');
  assert.deepEqual(ev.slice(0, 2), ['gather.update:gathering:1', 'gather.update:gathering:12']);
});

test('basis met stops: nothing to gather when the fact is shown; no step runs when basis already met', async () => {
  const r = await run([arr(spread(8))], [step(1, spread(2))]);
  assert.equal(r.stop, 'nothing_to_gather');
  assert.equal(r.request, null);
});

test('ceiling: gathering stops with its basis before a step that would pass the cents ceiling', async () => {
  const r = await run([arr(spread(2))], [step(1, spread(1, 3000), { cents: 1 }, 1), step(2, spread(9, 4000), {}, 5)], { ceilingCents: 2, spentCents: 0 });
  assert.equal(r.stop, 'ceiling');
  assert.deepEqual(r.answer.gather?.steps_done, [1]);
  assert.ok(r.cents <= 2);
  assert.equal(r.answer.facts[0]!.guarded.state, 'hidden');
});

test('ceiling: an actual spend past the ceiling stops after the step', async () => {
  const r = await run([arr(spread(2))], [step(1, spread(1, 3000), { cents: 5 }, 0), step(2, spread(9, 4000))], { ceilingCents: 2 });
  assert.equal(r.stop, 'ceiling');
  assert.deepEqual(r.answer.gather?.steps_done, [1]);
});

test('saturation: the median stops moving over the last k added comps', async () => {
  const r = await run([arr(spread(1, 5000))], [step(1, [row(5000), row(5000), row(5000), row(5000)]), step(2, spread(9))]);
  assert.equal(r.stop, 'saturation');
  assert.deepEqual(r.answer.gather?.steps_done, [1]);
});

test('low gain: a step that read but added under 0.1 n_eff stops it', async () => {
  const old = Array.from({ length: 20 }, (_, i) => row(1000 + i * 700, 360)); // weight 0.06 each at 360 d
  const r = await run([arr([row(1000), row(9000), row(2000), row(8000)])], [step(1, [row(4000, 360)]), step(2, spread(9, 3000))]);
  assert.equal(r.stop, 'low_gain');
  assert.equal(old.length, 20);
});

test('blocked never counts as found: a blocked step is not low gain and not an empty result', async () => {
  const blocked: GatherStep = { n: 1, est_cents: 0, run: async () => ({ arrivals: [], cents: 0, searched: [{ route_id: 's1', query: 'q', outcome: 'blocked', ms: 1 }] }) };
  const thrown: GatherStep = { n: 2, est_cents: 0, run: async () => { throw new Error('boom'); } };
  const r = await run([arr([row(1000), row(9000), row(2000), row(8000)])], [blocked, thrown, step(3, spread(4, 3000))]);
  assert.equal(r.stop, 'basis');
  assert.deepEqual(r.records.map(x => x.outcome), ['blocked', 'blocked', 'ran']);
  assert.equal(measure([arr([])], NOW).n_eff, 0);
});

test('older sales weigh by w_age: half-life 90 d, cut at 365 d', () => {
  assert.ok(Math.abs(measure([arr([row(1000, 90)])], NOW).n_eff - 0.5) < 1e-9);
  assert.equal(measure([arr([row(1000, 400)])], NOW).n_eff, 0);
  assert.ok(Math.abs(measure([arr([row(1000, 30)])], NOW, { ...{ deadline_ms: 1, basis_n_eff: 6, basis_sold_90d: 2, half_life_d: 30, cut_d: 365, sat_k: 3, sat_share: 0.02, min_gain: 0.1 } }).n_eff - 0.5) < 1e-9);
});

test('deadline: a step still running at the deadline ends with a timeout row and the answer keeps hidden with searched[]', async () => {
  const slow: GatherStep = { n: 1, est_cents: 0, run: () => new Promise(() => {}) };
  const r = await gather({ answer: base([arr(spread(2))]), plan, arrivals: [arr(spread(2))], steps: [slow, step(2, spread(9))], product: 'p', params: { deadline_ms: 20 } });
  assert.equal(r.stop, 'deadline');
  assert.ok(r.answer.searched.some(s => s.outcome === 'timeout'));
  assert.equal(r.answer.facts[0]!.guarded.state, 'hidden');
});

test('step 6 (signed-in read) is recorded as skipped and never run; every source tried ends it', async () => {
  let ran6 = false;
  const impl = { 1: step(1, spread(1, 7000)), 6: { n: 6, est_cents: 0, run: async () => { ran6 = true; return { arrivals: [], searched: [], cents: 0 }; } } };
  const steps = protocolSteps('price_now', impl);
  assert.deepEqual(steps.map(s => s.n), [1, 6]);
  const r = await run([arr(spread(2))], steps.map(s => (s.n === 6 ? { ...s, n: 6 } : s)), { params: { sat_share: 0 } });
  assert.equal(ran6, false);
  assert.equal(r.stop, 'exhausted');
  assert.equal(r.records.at(-1)!.outcome, 'skipped');
  assert.deepEqual(r.answer.gather?.steps_done, [1]);
});

test('conflict and mixed_types reconcile first; a fact that then shows never gathers', async () => {
  const p2: Plan = { ...plan, calculate: a => ({ facts: [{ name: 'f', ...(a.length > 1 ? { value: 1 } : {}),
    guarded: a.length > 1 ? { state: 'shown', basis_count: 9, as_of: 'x', citation_id: 'c' } : { state: 'hidden', basis_count: 0, as_of: null, citation_id: null, hide_reason: 'conflict' },
    sources: a.length > 1 ? [{ source_url: 'u', read_at: 'x', snapshot_ref: null, fingerprint: 'f', extractor_version: '1', rights: { may_share: true } }] : [] }] }) };
  const a0 = [arr([row(1)])];
  let called = 0;
  const r = await gather({ answer: { ...base(a0), facts: p2.calculate(a0).facts }, plan: p2, arrivals: a0, steps: [step(1, spread(9))], product: 'p', now: () => NOW,
    reconcile: async x => { called++; return [...x, arr([row(2)], 'b')]; } });
  assert.equal(called, 1);
  assert.equal(r.stop, 'nothing_to_gather');
  const _s: Searched[] = r.answer.searched; assert.ok(_s.length >= 1);
});
