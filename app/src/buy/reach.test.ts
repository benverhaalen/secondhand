import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SseFrame } from '../edge/api/jobs.ts';
import type { OfferView, SearchAnswer, SearchStage } from '../edge/api/search.ts';
import type { Found } from '../edge/intel/answer.ts';
import { reach } from './reach.ts';

type Recording = { recorded: string; start: { stages: SearchStage[] }; frames: SseFrame[] };
const fixture = (name: string): Recording => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const live = fixture('search-live-levi');
const answer = (f: SseFrame) => f.data.answer as SearchAnswer;
const settled = (r: Recording) => r.frames.find(f => f.event === 'answer.settled')!;
const zero = (): Found => ({ sources_searched: 0, results_found: 0, results_used: 0, dropped_by_reason: {}, sites: {} });
const frame = (event: string, data: Record<string, unknown>): SseFrame => ({ id: 100, event, data });

test('the live stream preserves start order, failed routes, Dupe counts and settled found', () => {
  const r = reach(live.start, live.frames);
  assert.equal(r.skipped, 0);
  assert.equal(r.state, 'done');
  assert.equal(r.query, 'levi 501');
  assert.deepEqual(r.sources.map(s => s.id), ['dupe', 'depop', 'poshmark', 'mercari', 'facebook', 'ebay']);
  for (const id of ['depop', 'mercari', 'facebook', 'ebay']) {
    const s = r.sources.find(s => s.id === id)!;
    assert.equal(s.state, 'failed');
    assert.equal(s.outcome, 'failed');
    assert.deepEqual(s.error, { code: 'no_route', reason: 'no live route composed' });
  }
  const dupe = r.sources.find(s => s.id === 'dupe')!;
  const searched = answer(settled(live)).searched.find(s => s.site === 'dupe')!;
  assert.equal(dupe.state, 'arrived');
  assert.equal(dupe.read, 40);
  assert.equal(dupe.kept, 22);
  assert.deepEqual(dupe.dropped, [{ reason: 'duplicate', count: 18 }]);
  assert.equal(dupe.ms, searched.ms);
  assert.deepEqual(dupe.pace, searched.pace);
  assert.deepEqual(r.landed, live.frames.filter(f => f.event === 'job.stage').map(f => String(f.data.stage).slice(5)));
  assert.deepEqual(r.found, settled(live).data.found);
  assert.deepEqual(r.ms, answer(settled(live)).ms);
  assert.deepEqual(r.pending, []);
});

test('every live prefix uses only its newest received stage and answer, never future counts or progress', () => {
  let previousPending = live.start.stages.map(s => s.name.slice(5));
  for (let k = 0; k <= live.frames.length; k++) {
    const prefix = live.frames.slice(0, k);
    const r = reach(live.start, prefix);
    const newestAnswer = prefix.findLast(f => f.event.startsWith('answer.'));
    const final = prefix.find(f => f.event === 'answer.settled');
    const sum = zero();
    for (const source of r.sources) {
      const stage = prefix.findLast(f => f.event === 'job.stage' && f.data.stage === `site:${source.id}`);
      const found = stage ? stage.data.found as Found : zero();
      assert.equal(source.state, stage?.data.state ?? 'running', `prefix ${k}: ${source.id} state`);
      assert.equal(source.read, found.results_found, `prefix ${k}: ${source.id} read`);
      assert.equal(source.kept, found.results_used, `prefix ${k}: ${source.id} kept`);
      assert.deepEqual(Object.fromEntries(source.dropped.map(d => [d.reason, d.count])), found.dropped_by_reason);
      assert.equal(source.at, stage?.data.at ?? null);
      const searched = newestAnswer ? answer(newestAnswer).searched.find(s => s.site === source.id) : undefined;
      assert.equal(source.ms, searched?.ms ?? null);
      assert.deepEqual(source.pace, searched?.pace ?? null);
      assert.equal(source.cost_usd_est, searched?.cost_usd_est ?? null);
      assert.equal(source.fallback, searched?.fallback ?? null);
      assert.equal(source.outcome, searched?.outcome ?? null);
      for (const key of ['sources_searched', 'results_found', 'results_used'] as const) sum[key] += found[key];
      for (const key of ['sites', 'dropped_by_reason'] as const) {
        for (const [name, count] of Object.entries(found[key])) sum[key][name] = (sum[key][name] ?? 0) + count;
      }
    }
    assert.deepEqual(r.found, final ? final.data.found : sum, `prefix ${k}: found`);
    assert.deepEqual(r.ms, newestAnswer ? answer(newestAnswer).ms : { first: null, settled: null });
    assert.equal(r.query, newestAnswer ? answer(newestAnswer).slots.text : null);
    assert.deepEqual(r.pending, newestAnswer?.data.sites_pending ?? r.sources.filter(s => s.state === 'running').map(s => s.id));
    assert.ok(r.pending.every(id => previousPending.includes(id)), `prefix ${k}: pending only shrinks`);
    previousPending = r.pending;
    assert.equal(r.state, prefix.findLast(f => f.event === 'job.state')?.data.state ?? 'running');
  }
});

test('a timed-out live refresh retains the cached batch and moves refreshing to kept only at settlement', () => {
  const recorded = fixture('search-late-cached');
  const first = recorded.frames.findIndex(f => f.event === 'answer.partial' && f.data.site === 'poshmark');
  const cached = reach(recorded.start, recorded.frames.slice(0, first + 1)).sources.find(s => s.id === 'poshmark')!;
  assert.equal(cached.cached, 'refreshing');
  assert.equal(cached.state, 'arrived');
  assert.ok(cached.kept > 0);
  const r = reach(recorded.start, recorded.frames);
  const final = r.sources.find(s => s.id === 'poshmark')!;
  assert.equal(r.skipped, 0);
  assert.equal(final.cached, 'kept');
  assert.equal(final.state, 'late');
  assert.equal(final.outcome, 'timeout');
  assert.equal(final.kept, cached.kept);
  assert.equal(final.read, cached.read);
  assert.deepEqual(r.results, settled(recorded).data.results);
});

test('Mercari without an account arrives with needs_account and no invented error', () => {
  const recorded = fixture('search-needs-account');
  const r = reach(recorded.start, recorded.frames);
  assert.equal(r.skipped, 0);
  assert.equal(r.state, 'done');
  assert.equal(r.sources[0].state, 'arrived');
  assert.equal(r.sources[0].outcome, 'needs_account');
  assert.equal(r.sources[0].error, null);
  assert.equal(answer(settled(recorded)).searched[0].reason, "needs the person's account");
});

test('missing found, unknown events, non-object data and an unasked source are skipped atomically', () => {
  const stage = live.frames.find(f => f.event === 'job.stage')!;
  const { found: _found, ...withoutFound } = stage.data;
  const bad: unknown[] = [frame('job.stage', withoutFound), frame('future.event', {}), { id: 101, event: 'job.stage', data: 4 },
    frame('job.stage', { ...stage.data, stage: 'site:unasked' })];
  const r = reach(live.start, [...bad, ...live.frames]);
  assert.deepEqual(r, { ...reach(live.start, live.frames), skipped: 4 });
  assert.deepEqual(reach(live.start, bad).found, zero());
});

test('a failed job exposes its error without changing sources that have no stage', () => {
  const r = reach(live.start, [frame('job.state', { state: 'failed', error: { code: 'site_failed', message: 'search failed' } })]);
  assert.equal(r.state, 'failed');
  assert.deepEqual(r.error, { code: 'site_failed', message: 'search failed' });
  assert.ok(r.sources.every(s => s.state === 'running' && s.read === 0 && s.kept === 0));
});

test('partials concatenate each source once in landing order; settlement uses exactly the server order', () => {
  for (let k = 0; k <= live.frames.length; k++) {
    const prefix = live.frames.slice(0, k);
    const final = prefix.find(f => f.event === 'answer.settled');
    const landed = [...new Set(prefix.filter(f => f.event === 'job.stage').map(f => String(f.data.stage).slice(5)))];
    const expected = final?.data.results ?? landed.flatMap(id => prefix.findLast(f => f.event === 'answer.partial' && f.data.site === id)?.data.results as OfferView[] ?? []);
    assert.deepEqual(reach(live.start, prefix).results, expected, `prefix ${k}`);
  }
  const recorded = fixture('search-late-cached');
  const before = recorded.frames.slice(0, recorded.frames.findIndex(f => f.event === 'answer.settled'));
  const partial = before.findLast(f => f.event === 'answer.partial' && f.data.site === 'poshmark')!;
  assert.deepEqual(reach(recorded.start, before).results, partial.data.results);
});

test('a resumed stream without the 202 discovers sources in landing order', () => {
  const r = reach(null, live.frames);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.sources.map(s => s.id), r.landed);
  assert.deepEqual(r.landed, reach(live.start, live.frames).landed);
  assert.deepEqual(r.results, settled(live).data.results);
  assert.deepEqual(r.found, settled(live).data.found);
  assert.deepEqual(reach(null, []), { state: 'running', query: null, sources: [], landed: [], pending: [], found: zero(), ms: { first: null, settled: null }, results: [], error: null, skipped: 0 });
});

test('replaying a fold is pure and cannot mutate the start or the recorded frames', () => {
  const frozen = <T>(value: T): T => {
    if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
    return value;
  };
  const recorded = frozen(structuredClone(live));
  assert.deepEqual(reach(recorded.start, recorded.frames), reach(live.start, live.frames));
});

test('unreadable nested counts, answers, offers and states are skipped before applying any part', () => {
  const stage = live.frames.find(f => f.event === 'job.stage')!;
  const partial = live.frames.find(f => f.event === 'answer.partial' && (f.data.results as OfferView[]).length)!;
  const bad = [null, [], frame('job.stage', { ...stage.data, found: { ...zero(), results_found: NaN } }),
    frame('job.stage', { ...stage.data, state: 'invented' }),
    frame('answer.partial', { ...partial.data, answer: { ...answer(partial), ms: { first: '1', settled: null } } }),
    frame('answer.partial', { ...partial.data, results: [{ ...(partial.data.results as OfferView[])[0], price_cents: { amount_cents: '2500', currency: 'USD' } }] }),
    frame('job.state', { state: 'failed', error: { code: 'site_failed' } })];
  assert.deepEqual(reach(live.start, bad), { ...reach(live.start, []), skipped: bad.length });
});

test('drop reasons sort by count descending and then by reason, with no accumulated refresh counts', () => {
  const stage = live.frames.find(f => f.event === 'job.stage')!;
  const found = { ...zero(), sources_searched: 1, results_found: 8, results_used: 2, dropped_by_reason: { z: 2, a: 2, b: 1 } };
  const frames = [stage, frame('job.stage', { ...stage.data, found })];
  const r = reach(live.start, frames);
  assert.deepEqual(r.sources.find(s => s.id === 'depop')!.dropped, [{ reason: 'a', count: 2 }, { reason: 'z', count: 2 }, { reason: 'b', count: 1 }]);
  assert.deepEqual(r.found, found);
  assert.deepEqual(r.landed, ['depop']);
});

test('Apify fallback, cost and offer provenance survive the fold without changing rank', () => {
  const partial = structuredClone(live.frames.find(f => f.event === 'answer.partial' && (f.data.results as OfferView[]).length)!);
  const a = answer(partial);
  const site = String(partial.data.site);
  a.searched = a.searched.map(s => s.site === site ? { ...s, fallback: 'apify', cost_usd_est: 0.029 } : s);
  partial.data.results = (partial.data.results as OfferView[]).map(o => ({ ...o, via: 'apify', actor: 'automation-lab~ebay-scraper', may_model: false, use_scope: 'hackathon_demo' }));
  const r = reach(live.start, [partial]);
  assert.equal(r.skipped, 0);
  assert.equal(r.sources.find(s => s.id === site)!.fallback, 'apify');
  assert.equal(r.sources.find(s => s.id === site)!.cost_usd_est, 0.029);
  assert.deepEqual(r.results, partial.data.results);
});

test('a stage without an error still exposes the newest searched error; a stage error takes precedence', () => {
  const partial = structuredClone(live.frames.find(f => f.event === 'answer.partial')!);
  const stage = structuredClone(live.frames.find(f => f.event === 'job.stage')!);
  const { error: _error, ...noError } = stage.data;
  let r = reach(live.start, [partial, frame('job.stage', noError)]);
  assert.deepEqual(r.sources.find(s => s.id === 'depop')!.error, { code: 'no_route', reason: 'no live route composed' });
  stage.data.error = { code: 'stage_code', message: 'stage reason' };
  r = reach(live.start, [stage, partial]);
  assert.deepEqual(r.sources.find(s => s.id === 'depop')!.error, { code: 'stage_code', reason: 'stage reason' });
});

test('an unreadable offer relation is skipped without coercion or an exception', () => {
  const partial = structuredClone(live.frames.find(f => f.event === 'answer.partial' && (f.data.results as OfferView[]).length)!);
  partial.data.results = [{ ...(partial.data.results as OfferView[])[0], relation: Object.create(null) as object }];
  assert.deepEqual(reach(live.start, [partial]), { ...reach(live.start, []), skipped: 1 });
});

test('unknown offer metadata cannot make an otherwise readable frame throw during the fold', () => {
  const partial = structuredClone(live.frames.find(f => f.event === 'answer.partial' && (f.data.results as OfferView[]).length)!);
  const results = partial.data.results as OfferView[];
  partial.data.results = results.map(o => ({ ...o, future_metadata: () => undefined }));
  const r = reach(live.start, [partial]);
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.results.map(o => o.id), results.map(o => o.id));
});

test('without a 202, a running stage seen early cannot take the place of the source that lands first', () => {
  const stage = (id: string, state: SearchStage['state']) => frame('job.stage', { stage: `site:${id}`, state, at: '2026-11-15T00:00:00.000Z', found: zero() });
  const r = reach(null, [stage('a', 'running'), stage('b', 'arrived'), stage('a', 'arrived')]);
  assert.deepEqual(r.landed, ['b', 'a']);
  assert.deepEqual(r.sources.map(s => s.id), ['b', 'a']);
});

test('sparse searched, pending and result arrays are unreadable frames, never undefined screen fields', () => {
  const partial = live.frames.find(f => f.event === 'answer.partial')!;
  const final = settled(live);
  const sparse: unknown[] = new Array(1);
  const bad = [frame('answer.partial', { ...partial.data, answer: { ...answer(partial), searched: sparse } }),
    frame('answer.partial', { ...partial.data, sites_pending: sparse }),
    frame('answer.partial', { ...partial.data, results: sparse }),
    frame('answer.settled', { ...final.data, searched: sparse })];
  assert.deepEqual(reach(live.start, bad), { ...reach(live.start, []), skipped: bad.length });
});
