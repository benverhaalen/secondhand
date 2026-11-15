import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLog, memorySink } from '../../../../log/index.js';
import { test } from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freezeBasis, scoreEvent, MarketScore, wilson, type Frozen, type Sale } from './market-score.ts';
import type { Comp } from './comps.ts';

const at = '2026-11-15T00:00:00Z';
const frozen: Frozen = { as_of: '2026-11-14T00:00:00Z', q10: 8000, q50: 10000, q90: 12000, basis_level: 'variant', citation: 'fixture:basis' };
const sale: Sale = { comp_id: 'sale', site: 'ebay', kind: 'shoes', sold_at: at, price_cents: 10000, cluster_id: 'listing' };
const comp = (id: string, fields: Partial<Comp> = {}): Comp => ({ comp_id: id, site: 'ebay', kind: 'sold', sold_at: '2026-11-14T00:00:00Z', price_cents: 10000, level: 'variant', condition: 'good', observed_at: '2026-11-14T00:00:00Z', w_match: 1, w_extract: 1, may_model: false, citation: `fixture:${id}`, ...fields });
const close = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const scored = (id: string, price = 10000, sold_at = at) => scoreEvent(frozen, { ...sale, comp_id: id, price_cents: price, sold_at }, {});

test('a scorer that sees its own sale: the own comp_id never enters a frozen basis', () => {
  assert.deepEqual(freezeBasis([comp('sale'), comp('older')], sale).rows.map(r => r.comp_id), ['older']);
});
test('a cluster sibling leaking in: switch F excludes the entire listing cluster', () => {
  assert.deepEqual(freezeBasis([comp('sibling', { cluster_id: 'listing' }), comp('older')], sale).rows.map(r => r.comp_id), ['older']);
  assert.deepEqual(freezeBasis([comp('sale', { cluster_id: 'listing' }), comp('sibling', { cluster_id: 'listing' })], { ...sale, cluster_id: undefined }).rows, []);
});
test('same-second sales and rows read after the sale never enter the frozen basis', () => {
  const rows = [comp('same-second', { sold_at: at }), comp('future', { sold_at: '2026-11-16' }), comp('read-later', { observed_at: '2026-11-16' }), comp('read-at-sale', { observed_at: at }), comp('older')];
  assert.deepEqual(freezeBasis(rows, sale).rows.map(r => r.comp_id), ['older']);
});
test('Wilson at n = 0 and at a rate of 0 or 1', () => {
  assert.equal(wilson(0, 0), null);
  const zero = wilson(0, 10)!, one = wilson(10, 10)!;
  close(zero[0], 0); close(one[1], 1); close(zero[1], 1 - one[0]);
  assert.ok(zero[1] > 0 && one[0] < 1);
});
test('a median over an even count averages the two middle values', () => {
  const market = new MarketScore({ site: 'ebay', kind: 'shoes' });
  market.add(scored('a')); market.add(scored('b', 20000));
  close(market.read(at).median_pct_off.value, 0.25);
});
test('the decayed copy at age 0 and at one half-life', () => {
  const market = new MarketScore({ site: 'ebay', kind: 'shoes' });
  market.add(scored('a'));
  close(market.read(at).decayed.within_20.n_eff, 1);
  close(market.read('2026-12-15T00:00:00Z').decayed.within_20.n_eff, 1);
  close(market.read('2026-12-15T00:00:00Z').within_20.n_eff, 1);
  close(market.read('2026-12-15T00:00:00Z').decayed.within_20.value, 1);
  market.add(scored('b', 20000, '2026-12-15T00:00:00Z'));
  close(market.read('2026-12-15T00:00:00Z').decayed.within_20.value, 1 / 3);
});
test('very old decayed evidence remains finite, and all-unpriced markets keep unknown intervals', () => {
  const market = new MarketScore({ site: 'ebay', kind: 'shoes' });
  market.add(scored('ancient'));
  const old = market.read('2100-01-01T00:00:00Z').decayed;
  close(old.median_pct_off.value, 0);
  assert.ok(old.within_20.interval_95!.every(Number.isFinite));
  const unpriced = new MarketScore({ site: 'ebay', kind: 'shoes' });
  for (let i = 0; i < 30; i++) unpriced.add(scoreEvent({ ...frozen, q10: null, q50: null, q90: null }, { ...sale, comp_id: String(i) }, {}));
  assert.equal(unpriced.read().state, 'not_checked_yet');
  assert.equal(unpriced.read().within_20.n, 0); assert.equal(unpriced.read().within_20.interval_95, null);
});
test('a market under 30 events is not_checked_yet with its figures, never hidden', () => {
  const market = new MarketScore({ site: 'ebay', kind: 'shoes' });
  for (let i = 0; i < 29; i++) market.add(scored(String(i)));
  assert.equal(market.read(at).state, 'not_checked_yet'); close(market.read(at).within_20.value, 1);
  market.add(scored('29')); assert.equal(market.read(at).state, 'checked');
});
test('no sale date is counted, never scored; each comp_id is scored once', () => {
  const market = new MarketScore({ site: 'ebay', kind: 'shoes' });
  const event = scoreEvent(frozen, { ...sale, sold_at: null }, {});
  market.add(event); market.add(event);
  assert.equal(market.read(at).unscored_no_sale_date, 1); assert.equal(market.read(at).n, 0);
  market.add(scored('valid')); market.add(scored('valid')); assert.equal(market.read(at).n, 1);
});
test('unpriced events retain baselines; exactly 20% and zero-width ranges are inclusive', () => {
  const event = scoreEvent({ ...frozen, q10: 12000, q50: 12000, q90: 12000 }, sale, { last_sale_cents: 8000 });
  assert.equal(event.within_20, true); assert.equal(event.coverage, false); assert.equal(event.width, 0);
  assert.equal(event.baselines.last_sale?.within_20, true);
  close(event.baselines.last_sale!.absolute_pct_error, 0.2);
  const unpriced = scoreEvent({ ...frozen, q10: null, q50: null, q90: null }, sale, { median_90d_cents: 10000 });
  assert.equal(unpriced.priced, false); assert.equal(unpriced.baselines.median_90d?.within_20, true);
  assert.equal(scoreEvent({ ...frozen, q10: 0 }, sale, {}).coverage, true);
});
test('input validation rejects invalid money, partial ranges and invalid dates', () => {
  assert.throws(() => scoreEvent(frozen, { ...sale, price_cents: 0 }, {}), /price_cents/);
  assert.throws(() => scoreEvent({ ...frozen, q10: null }, sale, {}), /range/);
  assert.throws(() => scoreEvent(frozen, { ...sale, sold_at: 'bad' }, {}), /sold_at/);
  assert.throws(() => scoreEvent(frozen, sale, { last_sale_cents: -1 }), /last_sale/);
});
test('parity drift between the languages: the same 42 handwritten events match Python', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/market-score-parity.json', import.meta.url), 'utf8')) as {
    events: { frozen: Frozen; sale: Sale; baselines: { last_sale_cents?: number; median_90d_cents?: number } }[];
    expected: Record<string, Record<string, unknown>>;
  };
  assert.equal(fixture.events.length, 42);
  assert.equal(Object.keys(fixture.expected).length, 3);
  for (const [key, expected] of Object.entries(fixture.expected)) {
    const market = new MarketScore(key === 'overall' ? undefined : JSON.parse(key));
    for (const e of fixture.events) if (key === 'overall' || JSON.stringify({ site: e.sale.site, kind: e.sale.kind }) === key) market.add(scoreEvent(e.frozen, e.sale, e.baselines));
    assert.deepEqual(market.parity(), expected, key);
  }
});

const replayInput = { run_id: 'fixture', contestant: 'engine_all_on', item_id: 'sale', site: 'ebay', kind: 'shoes', as_of: '2026-11-14T00:00:00Z', sold_at: at, q10_cents: 8000, q50_cents: 10000, q90_cents: 12000, truth_cents: 10000, shown: true };
function replay(estimate: object, predictions: object[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'market-score-test-'));
  try {
    const estimates = join(dir, 'estimates.jsonl'), baseline = join(dir, 'predictions.jsonl');
    writeFileSync(estimates, JSON.stringify(estimate) + '\n');
    writeFileSync(baseline, predictions.map(e => JSON.stringify(e)).join('\n'));
    return spawnSync(process.execPath, [fileURLToPath(new URL('../../../../scripts/market-replay.mjs', import.meta.url)), '--estimates', estimates, '--predictions', baseline, '--log', join(dir, 'run.jsonl')], { encoding: 'utf8', timeout: 10000 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('replay preserves an explicit missing sale date as unscored', () => {
  const result = replay({ ...replayInput, sold_at: null });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /overall: n=0;/);
  assert.match(result.stdout, /unscored_no_sale_date=1/);
});
test('replay rejects an estimate frozen at or after the actual sale', () => {
  for (const as_of of [at, '2026-11-16T00:00:00Z']) {
    const result = replay({ ...replayInput, as_of });
    assert.equal(result.status, 1, result.stdout); assert.match(result.stderr, /frozen.*sale/);
  }
});
test('replay rejects a paired baseline from a different freeze time', () => {
  const result = replay(replayInput, [{ contestant: 'last_sale', item_id: 'sale', as_of: '2026-11-16T00:00:00Z', q50: 50000, shown: true }]);
  assert.equal(result.status, 1, result.stdout); assert.match(result.stderr, /baseline.*freeze/);
});
test('replay rejects incomplete conformal ranges instead of mixing raw endpoints into them', () => {
  const result = replay(replayInput, [{ contestant: 'all_conformal', item_id: 'sale', as_of: replayInput.as_of, q10: null, q50: 10000, q90: 12000, shown: true }]);
  assert.equal(result.status, 1, result.stdout); assert.match(result.stderr, /range/);
});


test('missing cluster identity refuses the basis even when comp ids differ', () => {
  assert.throws(() => freezeBasis([comp('other')], { ...sale, cluster_id: undefined }), /cluster/);
  assert.throws(() => freezeBasis([comp('sale')], { ...sale, cluster_id: undefined }), /cluster/);
});
test('freeze at or after the sale is a typed logged refusal', () => {
  const sink = memorySink(), log = createLog({ src: 'test', build: 'test', sink });
  for (const as_of of [at, '2026-11-16T00:00:00Z']) {
    assert.throws(() => scoreEvent({ ...frozen, as_of }, sale, {}, log), error => error instanceof Error && error.name === 'FrozenAfterSale');
  }
  assert.equal(sink.lines.filter(line => line.includes('FrozenAfterSale')).length, 2);
  assert.doesNotMatch(sink.text(), /price_cents|10000|q50/);
});
test('decayed effective count uses squared weight sum, not the raw count or evidence mass', () => {
  const market = new MarketScore();
  for (let i = 0; i < 30; i++) market.add(scored(String(i)));
  market.add(scored('recent', 10000, '2028-11-15T00:00:00Z'));
  const score = market.read('2028-11-15T00:00:00Z');
  assert.equal(score.state, 'checked');
  assert.equal(score.decayed.state, 'not_checked_yet');
  assert.ok(score.decayed.n_eff < 2);
  assert.equal(score.decayed.within_20.n, 31);
});
test('two identical paired differences cannot claim a zero-width interval or checked state', () => {
  const market = new MarketScore();
  for (let i = 0; i < 30; i++) market.add(scoreEvent(frozen, { ...sale, comp_id: String(i) }, i < 2 ? { last_sale_cents: 20000 } : {}));
  const score = market.read();
  assert.equal(score.vs_last_sale.n, 2);
  assert.equal(score.vs_last_sale.interval_95, null);
  assert.equal(score.state, 'not_checked_yet');
});
test('median intervals use exact binomial ranks and require ten observations', () => {
  const market = new MarketScore();
  for (let i = 0; i < 9; i++) market.add(scoreEvent({ ...frozen, q90: 20000 + i * 1000 }, { ...sale, comp_id: String(i), price_cents: 10000 + i * 1000 }, {}));
  assert.equal(market.read().median_pct_off.interval_95, null);
  market.add(scoreEvent({ ...frozen, q90: 29000 }, { ...sale, comp_id: '9', price_cents: 19000 }, {}));
  // n=10: P(Bin(10,.5) <= 1)=(1+10)/1024=.010742 < .025;
  // adding rank 2 gives 56/1024=.054688, so use order statistics 2 and 9.
  assert.deepEqual(market.read().median_pct_off.interval_95, [1000 / 11000, 8000 / 18000]);
  assert.deepEqual(market.read().median_range_width.interval_95, [1.3, 2]);
});
test('basis hashes resolve sorted scored event ids and ignore unscored dates and insertion order', () => {
  const a = new MarketScore(), b = new MarketScore();
  a.add(scored('b')); a.add(scored('a'));
  b.add(scored('a')); b.add(scored('b'));
  a.add(scoreEvent(frozen, { ...sale, comp_id: 'unknown', sold_at: null }, {}));
  const expected = { count: 2, ids: ['a', 'b'], sha256: createHash('sha256').update(JSON.stringify(['a', 'b'])).digest('hex') };
  assert.deepEqual(a.read().basis, expected);
  assert.deepEqual(b.read().basis, expected);
  assert.deepEqual(a.read().decayed.basis, expected);
});
test('add logs each accepted, duplicate, and refused event without prices', () => {
  const sink = memorySink(), log = createLog({ src: 'test', build: 'test', sink });
  const market = new MarketScore({ site: 'ebay', kind: 'shoes' }, undefined, log);
  market.add(scored('accepted')); market.add(scored('accepted'));
  assert.throws(() => market.add({ ...scored('wrong'), site: 'other' }), /market/);
  const events = sink.lines.map(line => JSON.parse(line)).filter(e => e.stage === 'event');
  assert.equal(events.length, 3);
  assert.ok(events.every(e => e.state === undefined), 'job.stage reserves state for job lifecycle values');
  assert.doesNotMatch(sink.text(), /price_cents|10000|q50/);
});
test('proxy replay states the synthetic freeze and limits its proof to recorded-estimate parity', () => {
  const { sold_at, ...proxy } = replayInput;
  const result = replay(proxy);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /as_of = sold_at - 1 s/);
  assert.match(result.stderr, /parity of the scorer over the ablation.s recorded estimates/);
  assert.match(result.stderr, /does not prove prequential freezing/);
});

test('add logs malformed dates as refused and never accumulates them', () => {
  const sink = memorySink(), log = createLog({ src: 'test', build: 'test', sink });
  const market = new MarketScore(undefined, undefined, log);
  assert.throws(() => market.add({ ...scored('invalid'), frozen: { ...frozen, as_of: 'invalid' } }), /as_of/);
  assert.equal(market.read().n, 0);
  assert.equal(sink.lines.map(line => JSON.parse(line)).filter(e => e.stage === 'event' && e.score_state === 'refused').length, 1);
});

test('an undated observation cannot prove availability before the sale', () => {
  assert.deepEqual(freezeBasis([comp('unknown', { observed_at: undefined })], sale).rows, []);
});
test('ten identical paired outcomes retain uncertainty above the minimum count', () => {
  const market = new MarketScore();
  for (let i = 0; i < 10; i++) market.add(scoreEvent(frozen, { ...sale, comp_id: String(i) }, { last_sale_cents: 20000 }));
  const bounds = market.read().vs_last_sale.interval_95;
  assert.ok(bounds !== null && bounds[0] < 1 && bounds[1] === 1);
});
