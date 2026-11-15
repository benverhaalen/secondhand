import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, LEGACY, fromResolved, weigh, nEff, backOff, adjust, adjustDetail, trim, weightedQuantile, translate, comparables } from './comps.ts';
import { resolve } from './params.ts';
import type { Comp } from './comps.ts';

const legacyComparables: typeof comparables = (target, rows, at, params = LEGACY) => comparables(target, rows, at, { ...params, anchor_enabled: 0, index_enabled: 0, size_enabled: 0, age_enabled: 0, blend_enabled: 0, dedupe_enabled: 0 });

const as_of = '2026-11-14T00:00:00Z';
const comp = (comp_id: string, price_cents: number, fields: Partial<Comp> = {}): Comp => ({
  comp_id, price_cents, site: 'ebay', sold_at: as_of, kind: 'sold', level: 'variant',
  condition: 'good', w_match: 1, w_extract: 1, may_model: false, citation: `sale:${comp_id}`, ...fields,
});
const fixture = [4200, 4500, 4800, 5000, 5500, 6000].map((p, i) => comp(String(i), p, { w_match: [0.9, 0.7, 1, 0.8, 0.6, 0.5][i] }));
const family = [4600, 5200].map((p, i) => comp(`family${i}`, p, { level: 'family', w_match: 0.25 }));
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('worked example: 5.70 backs off to 6.80 and cumulative weighted median is exactly 4800 cents', () => {
  close(nEff(weigh(fixture, as_of).map(c => c.w)), 20.25 / 3.55);
  const result = backOff(weigh([...fixture, ...family, comp('category', 7000, { level: 'category' })], as_of));
  assert.equal(result.level, 'family');
  assert.equal(result.comps.length, 8);
  close(result.n_eff, 25 / 3.675);
  assert.equal(weightedQuantile(result.comps.map(c => c.price_cents), result.comps.map(c => c.w), 0.5), 4800);
  assert.deepEqual(legacyComparables({ condition: 'good' }, [...fixture, ...family], as_of).range, { q10: 4200, q50: 4800, q90: 5500 });
});

test('D1: unknown kinds, asks, retail, stale, future, duplicate and zero-match rows never enter', () => {
  const rows = ['asking', 'retail', 'ended_unsold'].map(kind => comp(kind, 1, { kind: kind as Comp['kind'] }));
  const valid = comp('valid', 4800);
  assert.deepEqual(weigh([...rows, comp('old', 4800, { sold_at: '2025-01-01' }), comp('future', 4800, { sold_at: '2027-01-01' }), comp('no-match', 4800, { w_match: 0 }), valid, valid], as_of).map(c => c.comp_id), ['valid']);
});

test('D1: type multiplication, half-life and learned overrides retain may_model false rows', () => {
  const c = comp('own', 4800, { kind: 'own_order', sold_at: '2026-08-16T00:00:00Z', w_match: 0.5, w_extract: 0.7 });
  close(weigh([c], as_of)[0].w, 1.2 * 0.5 * 0.5 * 0.7);
  close(weigh([c], as_of, { ...DEFAULTS, category_speed: 'fast' })[0].w_age, 0.125);
  close(weigh([c], as_of, { ...DEFAULTS, w_type: { ...DEFAULTS.w_type, own_order: 1 } })[0].w_type, 1);
  assert.equal(nEff([]), 0);
  assert.equal(nEff([0, 0]), 0);
});

test('D2/D3: condition and learned size ratios have target/source direction; drift is capped', () => {
  assert.equal(adjust(comp('a', 4000), { condition: 'excellent' }, () => 0), 4400);
  assert.equal(adjust(comp('b', 4400, { condition: 'excellent' }), { condition: 'good' }, () => 0), 4000);
  assert.equal(adjust(comp('c', 4000, { size: 'S' }), { condition: 'good', size: 'M' }, () => 0, { ...DEFAULTS, size_ratios: { S: 1, M: 1.05 } }), 4200);
  assert.equal(adjust(comp('d', 4000), { condition: 'good' }, () => Math.log(2)), 5000);
  assert.equal(adjust(comp('e', 4000), { condition: 'good' }, () => Math.log(0.5)), 3200);
  assert.equal(adjust(comp('offer', 5000, { kind: 'best_offer' }), { condition: 'good' }, () => 0, { ...DEFAULTS, d_offer_cat: 0.1 }), 4500);
});

test('D1: adjustment at 25 percent is kept; beyond it is dropped with its cause', () => {
  const rows = [comp('edge', 4000), comp('beyond', 4000)].map((c, i) => ({ ...c, adjusted_cents: i ? 5001 : 5000 }));
  assert.deepEqual(trim(rows).dropped, [{ comp_id: 'beyond', reason: 'adjustment' }]);
});

test('D1: one wild comp is trimmed before quantiles and cannot move the median', () => {
  const result = legacyComparables({ condition: 'good' }, [...fixture, ...family, comp('wild', 99999999)], as_of);
  assert.deepEqual(result.dropped, [{ comp_id: 'wild', reason: 'outlier' }]);
  assert.equal(result.range.q50, 4800);
  const flat = [1, 2, 3, 4, 5, 6].map(i => comp(String(i), 4800));
  assert.deepEqual(legacyComparables({ condition: 'good' }, [...flat, comp('wild', 99999999)], as_of).dropped, [{ comp_id: 'wild', reason: 'outlier' }]);
});

test('D4: absent site uses family back-off and supported translation with endpoint spread', () => {
  const params = { ...DEFAULTS, site_ratios: { depop: { ratio: 1.1, q25: 1, q75: 1.2, n: 20 } } };
  const result = legacyComparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of, params);
  assert.equal(result.level, 'family');
  assert.equal(result.state, 'ok');
  assert.deepEqual(result.range, { q10: 4200, q50: 5300, q90: 6600 });
  assert.equal(translate(4800, 1.1), 5280);
  assert.equal(legacyComparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of).state, 'too_few');
  assert.equal(legacyComparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of, { ...params, site_ratios: { depop: { ...params.site_ratios.depop, n: 19 } } }).state, 'too_few');
});

test('D1: thin and old-only bases stay too_few; empty quantiles have no invented price', () => {
  assert.equal(legacyComparables({ condition: 'good' }, [], as_of).state, 'too_few');
  const old = Array.from({ length: 8 }, (_, i) => comp(String(i), 4800, { sold_at: '2026-06-01' }));
  assert.equal(legacyComparables({ condition: 'good' }, old, as_of).state, 'too_few');
  assert.equal(weightedQuantile([], [], 0.5), null);
  assert.equal(weightedQuantile([100, 200], [1, 1], 0.5), 100);
  assert.equal(weightedQuantile([100, 200], [0, 1], 0), 200);
});

test('determinism: same inputs give identical objects without mutating candidates or params', () => {
  const candidates = [...fixture, ...family];
  const before = JSON.stringify({ candidates, params: DEFAULTS });
  const first = legacyComparables({ condition: 'good' }, candidates, as_of);
  assert.deepEqual(first, legacyComparables({ condition: 'good' }, candidates, as_of));
  assert.equal(JSON.stringify({ candidates, params: DEFAULTS }), before);
  const snapshot = structuredClone(candidates), params = { ...DEFAULTS };
  const prior = structuredClone({ ...params, timeIndex: undefined });
  const current = comparables({ condition: 'good' }, candidates, as_of, params);
  assert.deepEqual(current, comparables({ condition: 'good' }, candidates, as_of, params));
  assert.deepEqual(candidates, snapshot);
  assert.deepEqual({ ...params, timeIndex: undefined }, prior);
  assert.equal(params.timeIndex, DEFAULTS.timeIndex);
});

test('fromResolved names the declared path missing from a resolved set', () => {
  const resolved = resolve(undefined); delete resolved.values.valuation_half_life_days_fast;
  assert.throws(() => fromResolved(resolved), { name: 'RangeError', message: /valuation_half_life_days_fast/ });
});

test('fromResolved refuses an invalid Params field instead of asserting its type', () => {
  const resolved = resolve(undefined); resolved.versions.valuation_blend_k = NaN;
  assert.throws(() => fromResolved(resolved), { name: 'RangeError', message: /param_versions/ });
});

test('D4: sufficient own-site sales win; supported parent ratio replaces a thin category ratio', () => {
  const own = Array.from({ length: 6 }, (_, i) => comp(`depop${i}`, 4849, { site: 'depop' }));
  const params = { ...DEFAULTS,
    site_ratios: { depop: { ratio: 2, q25: 2, q75: 2, n: 19 } },
    parent_site_ratios: { depop: { ratio: 1.1, q25: 1, q75: 1.2, n: 20 } },
  };
  const direct = legacyComparables({ condition: 'good', site: 'depop' }, [...fixture, ...family, ...own], as_of, params);
  assert.equal(direct.state, 'ok');
  assert.deepEqual(direct.range, { q10: 4800, q50: 4800, q90: 4800 });
  assert.equal(direct.comps.length, 6);
  assert.equal(legacyComparables({ condition: 'good', site: 'depop' }, [...fixture, ...family], as_of, params).range.q50, 5300);
});

test('D1: back-off adds a coarser level when effective count passes but recent sales do not', () => {
  const old = Array.from({ length: 8 }, (_, i) => comp(`old${i}`, 4800, { sold_at: '2026-06-01' }));
  const recent = family.map(c => ({ ...c, w_match: 1 }));
  const result = backOff(weigh([...old, ...recent], as_of));
  assert.equal(result.level, 'family');
  assert.equal(result.comps.length, 10);
});

test('PLANTED: with MAD 0, comps a few percent off the median are kept, a wild one still goes', () => {
  const rows = [5000, 5000, 5000, 5000, 5100, 5200, 4900, 20000].map((p, i) => ({ ...comp(`m${i}`, p), adjusted_cents: p }));
  const { kept, dropped } = trim(rows);
  assert.deepEqual(kept.map(c => c.price_cents).sort(), [4900, 5000, 5000, 5000, 5000, 5100, 5200]);
  assert.deepEqual(dropped.map(d => d.reason), ['outlier']);
});

test('D1 reconciliation: gross adjustment caps a comp even when its adjustments cancel', () => {
  // Condition +35% (new with tags over good) and size -26% net to about 0, but gross is about 0.6 > ln 1.25.
  const params = { ...DEFAULTS, size_ratios: { S: 1, M: 0.74 } };
  const offsetting = comp('offsetting', 5000, { size: 'S' });
  const r = adjustDetail(offsetting, { condition: 'new_with_tags', size: 'M' }, () => 0, params);
  assert.ok(Math.abs(Math.log(r.adjusted_cents / 5000)) < Math.log(1.25), 'net is inside the old cap');
  close(r.gross, Math.log(1.35) + Math.abs(Math.log(0.74)));
  assert.deepEqual(trim([{ ...offsetting, adjusted_cents: r.adjusted_cents, gross: r.gross }], params).dropped, [{ comp_id: 'offsetting', reason: 'adjustment' }]);
});

test('D1 reconciliation: a comp counts less the more it had to be adjusted', () => {
  const params = { ...DEFAULTS, size_ratios: { S: 1, M: 1.1 } };
  const rows = [comp('same', 5000, { size: 'M' }), comp('adjusted', 5000, { size: 'S' })];
  const out = legacyComparables({ condition: 'good', size: 'M' }, rows, as_of, { ...params, min_n_eff: 1, min_recent: 1 });
  const w = Object.fromEntries(out.comps.map(c => [c.comp_id, c.w]));
  close(w.same, 1);
  close(w.adjusted, 1 / (1 + Math.log(1.1) / Math.log(1.25)));
  assert.equal(out.extrapolated, null, 'one comp needed no adjustment, so nothing is extrapolated');
});

test('D1 bracketing: every comp adjusted the same way marks the value as extrapolated', () => {
  const rows = [4000, 4200, 4400].map((p, i) => comp(`worse${i}`, p, { condition: 'fair' }));
  const easy = { ...DEFAULTS, min_n_eff: 1, min_recent: 1, condition_ratios: { ...DEFAULTS.condition_ratios, fair: 0.9 } };
  assert.equal(legacyComparables({ condition: 'good' }, rows, as_of, easy).extrapolated, 'up');
  const better = rows.map(r => ({ ...r, condition: 'excellent' }));
  assert.equal(legacyComparables({ condition: 'good' }, better, as_of, easy).extrapolated, 'down');
  const mixed = [rows[0], better[1]];
  assert.equal(legacyComparables({ condition: 'good' }, mixed, as_of, easy).extrapolated, null);
});

test('D1 bracketing: market drift moves every comp alike and is not extrapolation', () => {
  const rows = [4000, 4200, 4400].map((p, i) => comp(`drift${i}`, p));
  const params = { ...DEFAULTS, min_n_eff: 1, min_recent: 1, timeIndex: () => 0.05 };
  const out = legacyComparables({ condition: 'good' }, rows, as_of, params);
  assert.equal(out.extrapolated, null);
  assert.ok(out.comps.every(c => c.adjusted_cents > c.price_cents), 'time still adjusts the price');
});

test('D2: a size known on one side only is not adjusted and costs no weight', () => {
  const params = { ...DEFAULTS, size_ratios: { S: 1, M: 1.1 } };
  const r = adjustDetail(comp('sized', 5000, { size: 'M' }), { condition: 'good' }, () => 0, params);
  assert.equal(r.adjusted_cents, 5000);
  assert.equal(r.gross, 0);
});

test('D1 end to end: a comp past the gross cap leaves the set through comparables', () => {
  const params = { ...DEFAULTS, min_n_eff: 1, min_recent: 1, size_ratios: { S: 1, M: 0.74 } };
  const rows = [comp('fine', 5000, { condition: 'new_with_tags', size: 'M' }), comp('offsetting', 5000, { size: 'S' })];
  const out = legacyComparables({ condition: 'new_with_tags', size: 'M' }, rows, as_of, params);
  assert.deepEqual(out.comps.map(c => c.comp_id), ['fine']);
  assert.deepEqual(out.dropped, [{ comp_id: 'offsetting', reason: 'adjustment' }]);
});

test('R2/R8: invalid cents and nonfinite weights refuse at the boundary', () => {
  for (const bad of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => weigh([comp('bad', bad)], as_of), /price_cents/);
    assert.throws(() => weightedQuantile([bad], [1], .5), /cents/);
  }
  assert.throws(() => weightedQuantile([100], [Infinity], .5), /weight/);
  assert.throws(() => translate(1.5, 1), /cents/);
});

test('A: recent variant anchor moves the middle, retains the comp spread, and is never a gate', () => {
  const rows = Array.from({ length: 20 }, (_, i) => comp(`a${i}`, i < 15 ? 10000 : 12000, { sold_at: `2026-10-${String(i + 1).padStart(2, '0')}` }));
  const off = { ...DEFAULTS, anchor_enabled: 0, blend_enabled: 0 };
  const before = comparables({ condition: 'good' }, rows, as_of, off);
  const after = comparables({ condition: 'good' }, rows, as_of, { ...off, anchor_enabled: 1 });
  assert.ok(after.range.q50! > before.range.q50!);
  const shift = 5 / 11 * Math.log(1.2);
  assert.equal(after.range.q10, Math.round(10000 * Math.exp(shift) / 100) * 100);
  assert.equal(after.range.q90, Math.round(12000 * Math.exp(shift) / 100) * 100);
  assert.equal(comparables({ condition: 'good' }, [comp('product', 10000, { level: 'product' })], as_of).basis_level, 'product');
});

test('B/C: fits use strictly earlier model-eligible sales, and isolate families', () => {
  const rows = Array.from({ length: 30 }, (_, i) => comp(`fit${i}`, i < 15 ? 10000 : 12000, {
    sold_at: `2026-10-${String(i + 1).padStart(2, '0')}`, product_id: 'p', family_id: 'f', size: i % 2 ? 'L' : 'S', may_model: true,
  }));
  const target = { condition: 'good', family_id: 'f', size: 'L' };
  const params = { ...DEFAULTS, index_enabled: 1, size_enabled: 1 };
  const baseline = comparables(target, rows, as_of, params);
  const polluted = [...rows, ...rows.map(c => ({ ...c, comp_id: `future${c.comp_id}`, sold_at: '2027-01-01', price_cents: 1000000 }))];
  assert.deepEqual(comparables(target, polluted, as_of, params), baseline);
  assert.ok(baseline.comps.some(c => c.adjusted_cents !== c.price_cents));
});

test('D: family half-life changes age weights only when enabled', () => {
  const old = comp('old', 10000, { sold_at: '2026-08-16', family_id: 'f' });
  close(weigh([old], as_of, { ...DEFAULTS, family_half_life_days: { f: 30 }, age_enabled: 1 })[0].w_age, .125);
  close(weigh([old], as_of, { ...DEFAULTS, family_half_life_days: { f: 30 }, age_enabled: 0 })[0].w_age, .5);
});

test('E: sparse evidence blends log quantiles with its parent, kind and retail prior answer', () => {
  const params = { ...DEFAULTS, anchor_enabled: 0, blend_enabled: 1 };
  const rows = [comp('v', 10000), comp('p', 20000, { level: 'product' })];
  const result = comparables({ condition: 'good' }, rows, as_of, params);
  assert.equal(result.range.q50, Math.round(Math.exp((Math.log(10000) + 6 * Math.log(20000)) / 7) / 100) * 100);
  assert.equal(result.basis_level, 'variant');
  assert.equal(comparables({ condition: 'good', kind: 'shoes' }, [comp('kind', 9000, { level: 'category', w_match: 1 })], as_of, params).basis_level, 'kind');
  const prior = comparables({ condition: 'good', kind: 'shoes', retail_cents: 10000, depreciation: .6 }, [], as_of, params);
  assert.equal(prior.basis_level, 'prior');
  assert.equal(prior.range.q50, 6000);
});

test('F: cross-posts are one physical item; newest sold copy wins independent of arrival order', () => {
  const rows = [comp('a', 10000, { cluster_id: 'one', sold_at: '2026-11-01' }), comp('b', 11000, { cluster_id: 'one', sold_at: '2026-11-02' })];
  assert.equal(weigh(rows, as_of).length, 1);
  assert.equal(weigh(rows, as_of)[0].comp_id, 'b');
  assert.deepEqual(weigh(rows, as_of), weigh([...rows].reverse(), as_of));
});

test('D2: completeness and works affect gross adjustment before trimming', () => {
  const detail = adjustDetail(comp('missing', 9000, { completeness: ['box_missing'], works: 'said' }), { condition: 'good', completeness: [], works: 'verified' }, () => 0);
  assert.equal(detail.adjusted_cents, Math.round(9000 / .9 / .92));
  assert.ok(detail.gross > 0);
});

test('R1: conflicting duplicate metadata has a stable winner, even at the same date and cents', () => {
  const a = comp('same', 5000, { condition: 'good' });
  const b = comp('same', 5000, { condition: 'excellent' });
  assert.deepEqual(comparables({ condition: 'good' }, [a, b], as_of), comparables({ condition: 'good' }, [b, a], as_of));
});

test('R3: registry reads reach arithmetic, carry versions, and missing resolved values refuse', async () => {
  const { resolve } = await import('./params.ts');
  const { fromResolved } = await import('./comps.ts');
  const { memoryStore } = await import('../param/param.ts');
  const store = memoryStore();
  const read = store.read.bind(store);
  store.read = (name, scope) => ({ ...read(name, scope), value: name === 'valuation_w_extract_structured' ? .45 : read(name, scope).value, version: 7 });
  const resolved = resolve(store, { kind: 'shoes', segment: 'f' });
  const params = fromResolved(resolved);
  const out = comparables({ condition: 'good' }, [comp('structured', 5000, { extraction_source: 'structured', w_extract: .9 })], as_of, params);
  close(out.comps[0].w, .45);
  assert.equal(out.param_versions.valuation_w_extract_structured, 7);
  delete resolved.values.valuation_anchor_k;
  assert.throws(() => fromResolved(resolved), /valuation_anchor_k/);
});

test('R2: invalid money on a duplicate or future observation still refuses at entry', () => {
  assert.throws(() => weigh([comp('same', 5000), comp('same', -1)], as_of), /price_cents/);
  assert.throws(() => weigh([comp('future', 1.5, { sold_at: '2027-01-01' })], as_of), /price_cents/);
});

test('B: family index uses prior product medians and the declared exponential decay', async () => {
  const { fitHistory } = await import('./comps.ts');
  const rows = [
    comp('i1', 10000, { sold_at: '2026-09-01', product_id: 'p', family_id: 'f', may_model: true }),
    comp('i2', 11000, { sold_at: '2026-09-02', product_id: 'p', family_id: 'f', may_model: true }),
    comp('i3', 10000, { sold_at: '2026-10-02', product_id: 'p', family_id: 'f', may_model: true }),
  ];
  const fitted = fitHistory(rows, as_of);
  close(fitted.index('f', '2026-09-02'), 0);
  close(fitted.index('f', '2026-09-03'), Math.log(1.1));
  close(fitted.index('f', as_of), (.5 * Math.log(1.1) + Math.log(10000 / 10500)) / 1.5);
  close(fitted.index('other', as_of), 0);
});

test('C: one observation per size shrinks the measured size contrast by exactly 1/21', async () => {
  const { fitHistory } = await import('./comps.ts');
  const rows = ['S', 'L'].map((size, i) => comp(size, 10000 * (i + 1), { size, sold_at: '2026-10-01', product_id: 'p', family_id: 'f', may_model: true }));
  const fitted = fitHistory(rows, as_of);
  close(fitted.size_ratios.f.L / fitted.size_ratios.f.S, 2 ** (1 / 21));
});
