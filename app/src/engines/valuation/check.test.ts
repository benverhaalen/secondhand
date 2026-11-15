import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, type CheckInput } from './check.ts';
import { comparables, DEFAULTS, type Comp } from './comps.ts';
import { ceiling, MARKS, pointOnSite } from './posture.ts';
import { planOf, weightedPercentile } from './path.ts';
import { memoryStore } from '../param/param.ts';
import { resolve as resolveACI, calibrationForCheck } from './aci.ts';
import { keep } from './keep.ts';
const as_of = '2026-11-15T00:00:00Z';
const comps: Comp[] = Array.from({ length: 8 }, (_, i) => ({ comp_id: `c${i}`, site: 'ebay', sold_at: '2026-11-10T00:00:00Z', price_cents: 4000 + i * 100, kind: 'sold', level: 'variant', condition: 'good', w_match: 1, w_extract: 1, may_model: true, citation: `source:${i}` }));
const input = (): CheckInput => ({ product_id: 'p1', condition: 'good', as_of, floor_cents: 6000, param_version: 1, objective: 'balanced', warm_comps: comps, sources: [], sites: [{ site: 'ebay', curve: { p: () => .6, t: () => 10 }, curve_evidence: { n: 100, calibration_error: .02, citation: 'held-out:curve' } }], log: { timed: (_n, fn) => fn(), error: () => {} } });
test('stalled source answers from cited warm comps at the budget and aborts work', async () => {
  let aborted = false;
  const x = input(); x.budget_ms = 15;
  x.sources = [signal => { signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); }];
  const start = performance.now(); const out = await check(x);
  assert.ok(performance.now() - start < 250);
  assert.equal(out.basis.count, 8); assert.equal(out.partial, true); assert.equal(aborted, true);
});
test('no comps keeps the rough wide band and its basis, without inventing a path', async () => {
  const x = input(); x.warm_comps = []; x.fast = { low: 2000, high: 9000, n: 24, as_of, basis: 'category', state: 'rough' };
  const out = await check(x);
  assert.equal(out.range.state, 'not_checked_yet'); assert.equal(out.range.q10, 2000);
  assert.equal(out.range.q90, 9000); assert.equal(out.basis.count, 24); assert.equal(out.price_path, null);
});
test('no basis hides all estimated numbers', async () => {
  const x = input(); x.warm_comps = [];
  const out = await check(x); assert.equal(out.range.state, 'hidden'); assert.equal(out.range.q50, null);
});
test('planted high floor beats every price rung and auto accept threshold', async () => {
  const out = await check(input()); assert.ok(out.price_path);
  for (const p of [out.price_path.start, out.price_path.list, out.price_path.always_accept, ...out.price_path.ladder.map(r => r.price)]) assert.ok(p >= 6000);
});
test('a failing source names its error instead of silently becoming thin data', async () => {
  const x = input(); x.sources = [async () => { throw new Error('source failed'); }];
  await assert.rejects(check(x), /source failed/);
});
test('fresh rows merge without duplicate basis and deterministically assemble', async () => {
  const x = input(); x.sources = [async () => comps];
  const a = await check(x), b = await check(x);
  assert.deepEqual(a, b); assert.equal(a.basis.count, 8); assert.ok(a.citation);
});

test('missing comp citations are logged and leave a hidden range', async () => {
  const x = input(), errors: unknown[] = []; x.warm_comps = comps.map(c => ({ ...c, citation: '' }));
  x.log.error = (where, error) => errors.push({ where, error });
  const out = await check(x);
  assert.equal(out.range.state, 'hidden'); assert.equal(out.citation, null);
  assert.deepEqual(errors, [{ where: 'valuation.check.uncitable', error: { batch: 0, count: 8 } }]);
});

test('unsupported fee sites are refused at the Check boundary', async () => {
  const x = input(); x.sites = [{ site: 'facebook_local', curve: x.sites[0].curve }];
  await assert.rejects(check(x), /unsupported valuation site/);
});

test('F8: fractional conformal widening produces whole cent range endpoints', async () => {
  const out = await check({ ...input(), calibration: { Q_g: 12.4, group: 'jacket', coverage: .8, passes: true } });
  assert.ok(Number.isInteger(out.range.q10)); assert.ok(Number.isInteger(out.range.q90));
});

test('G: scale-free conformal correction widens overall and site endpoints by the same ratio', async () => {
  const raw = await check(input());
  const widened = await check({ ...input(), calibration: { Q_g: Math.log(1.2), group: 'g', coverage: .8, passes: true } });
  assert.equal(widened.range.q10, Math.round(raw.range.q10! / 1.2));
  assert.equal(widened.range.q90, Math.round(raw.range.q90! * 1.2));
  assert.equal(widened.per_site[0].q10, widened.range.q10);
  assert.equal(widened.per_site[0].q90, widened.range.q90);
  assert.equal(widened.range.basis_level, 'variant');
});

test('R4: passes alone cannot label a range checked; final widened range is cited', async () => {
  const x = { ...input(), calibration: { Q_g: .1, group: 'g', coverage: .8, passes: true } };
  assert.equal((await check(x)).range.state, 'not_checked_yet');
  const checked = await check({ ...x, calibration: { ...x.calibration, n: 100, hits: 80 } });
  assert.equal(checked.range.state, 'checked');
  assert.ok(checked.citation?.param_versions.valuation_blend_k !== undefined);
  assert.ok(checked.per_site[0].citation);
});

test('R1: duplicate observations resolve independently of source completion order', async () => {
  const old = comps.map(c => ({ ...c, price_cents: c.price_cents + 500, observed_at: '2026-11-11' }));
  const run = (reverse: boolean) => check({ ...input(), warm_comps: [], sources: [
    async () => { await new Promise(r => setTimeout(r, reverse ? 1 : 5)); return comps; },
    async () => { await new Promise(r => setTimeout(r, reverse ? 5 : 1)); return old; },
  ] });
  assert.deepEqual(await run(false), await run(true));
});

test('R8: invalid calibration refuses, and a wide but supported range stays visible', async () => {
  for (const Q_g of [NaN, Infinity, -1]) await assert.rejects(check({ ...input(), calibration: { Q_g, group: 'g', coverage: .8, passes: true } }), /Q_g/);
  const out = await check({ ...input(), calibration: { Q_g: 1, group: 'g', coverage: .8, passes: false } });
  assert.notEqual(out.range.state, 'hidden');
  assert.ok(out.range.q90! - out.range.q10! > out.range.q50!);
});

for (const curve_evidence of [undefined, { n: 29, calibration_error: .02, citation: 'held-out:curve' },
  { n: 100, calibration_error: .06, citation: 'held-out:curve' }]) {
  test(`a supplied curve answers with unchecked evidence ${JSON.stringify(curve_evidence)}`, async () => {
    const x = input(); x.sites[0].curve_evidence = curve_evidence;
    const out = await check(x);
    assert.deepEqual(out.per_site[0].p_sale, { d7: .6, d30: .6, d90: .6 });
    assert.deepEqual(out.per_site[0].days, { t25: 10, t50: 10, t75: 10 });
    assert.ok(out.price_path); assert.equal(out.per_site[0].curve_checked, false);
  });
}

test('curve_checked is true only for a supplied curve with passing evidence', async () => {
  assert.equal((await check(input())).per_site[0].curve_checked, true);
  const x = input(); delete x.sites[0].curve;
  const out = await check(x);
  assert.equal(out.per_site[0].curve_checked, false);
  assert.equal(out.per_site[0].p_sale, null); assert.equal(out.per_site[0].days, null);
  assert.equal(out.price_path, null);
});

test('D5: extrapolated side uses parent log widening; a supported cap never inverts the range', async () => {
  const x = input(); x.condition = 'excellent';
  const base = await check(x);
  const wide = await check({ ...x, calibration: { Q_g: 0, parent_Q_g: .1, group: 'g', coverage: .8, passes: false } });
  assert.equal(wide.range.q10, base.range.q10);
  assert.equal(wide.range.q90, Math.round(base.range.q90! * Math.exp(.1)));
  const capped = await check({ ...input(), condition: 'new_with_tags', warm_comps: comps.map(c => ({ ...c, condition: 'new_with_tags' })), retail_cap_cents: 4200 });
  assert.ok(capped.range.q10! <= capped.range.q50! && capped.range.q50! <= capped.range.q90!);
  assert.ok(capped.range.q90! <= 4200);
});

test('a warm kind band keeps its endpoints without conformal widening, a cap or an invented median', async () => {
  const x = input(); x.warm_comps = []; x.condition = 'new_with_tags';
  x.fast = { low: 8000, high: 12000, n: 24, as_of, basis: 'category', state: 'rough' };
  const out = await check({ ...x, retail_cap_cents: 5000, calibration: { Q_g: .3, group: 'g', coverage: .8, passes: true, n: 100, hits: 80 } });
  assert.equal(out.range.q10, 8000); assert.equal(out.range.q50, null); assert.equal(out.range.q90, 12000);
  assert.equal(out.range.state, 'not_checked_yet');
  assert.equal(out.per_site[0].q10, 8000); assert.equal(out.per_site[0].q50, null); assert.equal(out.per_site[0].q90, 12000);
  assert.equal(out.per_site[0].basis_level, 'kind');
  assert.ok(out.per_site[0].citation);
  assert.deepEqual(out.citation?.basis_ids, ['band:p1']);
  assert.deepEqual(out.basis.sources, ['category']);
  assert.equal(out.per_site[0].keep_q10, keep('ebay', 8000).keep_cents);
  assert.equal(out.per_site[0].keep_q90, keep('ebay', 12000).keep_cents);
  assert.equal(out.per_site[0].keep_q50, null); assert.equal(out.per_site[0].p_sale, null);
  assert.equal(out.per_site[0].days, null); assert.equal(out.price_path, null); assert.equal(out.modes, null);
});

test('a family band keeps its cited family basis with no point estimate', async () => {
  const out = await check({ ...input(), warm_comps: [], fast: { low: 2000, high: 9000, n: 24, as_of, basis: 'family', state: 'rough' } });
  assert.equal(out.basis_level, 'family'); assert.equal(out.range.q50, null);
  assert.equal(out.range.q10, 2000); assert.equal(out.range.q90, 9000);
  assert.equal(out.range.state, 'not_checked_yet'); assert.ok(out.citation);
});

test('Q .3 widens 2000 and 6000 asymmetrically to 1482 and 8099 cents', async () => {
  const x = input();
  x.params = { ...DEFAULTS, anchor_enabled: 0, blend_enabled: 0 };
  x.warm_comps = Array.from({ length: 30 }, (_, i) => ({ ...comps[0], comp_id: `asymmetric:${i}`, price_cents: i < 10 ? 2000 : i < 20 ? 4000 : 6000 }));
  const store = memoryStore(), group = { kind: 'apparel' };
  resolveACI(store, group);
  store.apply('valuation_conformal_scores', group, () => ({ value: { scores: [{ score: .3, at: as_of, err: 1 }] }, weight: 1 }), as_of);
  const out = await check({ ...x, calibration: calibrationForCheck(store, group, { q10: 2000, q90: 6000 }) });
  assert.equal(out.range.q10, 1482); assert.equal(out.range.q90, 8099);
  assert.notEqual(2000 - out.range.q10!, out.range.q90! - 6000);
  assert.ok(out.range.q10! >= 0);
});

test('measured .8 coverage flips at n=85 (68 hits); n=80 (64 hits) fails Wilson and n=40 (32 hits) stays unchecked', async () => {
  for (const [n, hits, state] of [[40, 32, 'not_checked_yet'], [80, 64, 'not_checked_yet'], [85, 68, 'checked'],
    [100, 90, 'not_checked_yet'], [100, 70, 'not_checked_yet']] as const) {
    const store = memoryStore(), group = { kind: 'apparel' }; resolveACI(store, group);
    store.apply('valuation_conformal_scores', group, () => ({ value: {
      scores: Array.from({ length: n }, (_, i) => ({ score: i < hits ? -.1 : .3, at: as_of, err: i < hits ? 0 : 1 })),
    }, weight: n }), as_of);
    const out = await check({ ...input(), calibration: calibrationForCheck(store, group, { q10: 2000, q90: 6000 }) });
    assert.equal(out.range.state, state, `n=${n}, hits=${hits}`);
    assert.equal(out.per_site[0].state, state);
  }
});

test('passing calibration cannot check a too_few overall or per-site basis', async () => {
  const calibration = { Q_g: .1, group: 'g', coverage: .8, passes: true, n: 100, hits: 80 };
  const out = await check({ ...input(), warm_comps: comps.slice(0, 2), calibration });
  for (const band of [out.range, out.per_site[0]]) {
    assert.equal(band.state, 'not_checked_yet'); assert.deepEqual(band.notes, ['too_few']);
    assert.equal(band.share_shown, null);
  }
});

test('one site with missing citation is hidden and logged once while the overall and other site still answer', async () => {
  const errors: { where: string; error: unknown }[] = [];
  const x = input(); x.floor_cents = 0;
  const good = [4000, 4100, 4300, 4500, 4600, 4700].map((price_cents, i) => ({ ...comps[i], comp_id: `good:${i}`, price_cents }));
  const bad = [4100, 4200, 4400, 4600].map((price_cents, i) => ({ ...comps[i], comp_id: `bad:${i}`, site: 'facebook' as const, sold_at: '2026-11-11T00:00:00Z', price_cents, citation: '' }));
  x.warm_comps = [...good, ...bad]; x.sites.push({ site: 'facebook', curve: x.sites[0].curve });
  x.log.error = (where, error) => { errors.push({ where, error }); };
  const out = await check(x), ebay = out.per_site.find(s => s.site === 'ebay')!, facebook = out.per_site.find(s => s.site === 'facebook')!;
  assert.ok(out.range.q50); assert.ok(out.citation); assert.ok(ebay.q50); assert.ok(ebay.citation);
  assert.equal(facebook.citation, null); assert.equal(facebook.state, 'hidden');
  assert.equal(facebook.q10, null); assert.equal(facebook.q50, null); assert.equal(facebook.q90, null);
  assert.equal(facebook.keep_q10, null); assert.equal(facebook.keep_q50, null); assert.equal(facebook.keep_q90, null);
  assert.equal(facebook.p_sale, null); assert.equal(facebook.days, null);
  assert.deepEqual(out.citation?.basis_ids, good.map(c => c.comp_id));
  assert.ok(out.last_sale);
  assert.ok(out.modes);
  for (const mode of Object.values(out.modes)) assert.ok(mode.per_site.every(p => p.site === 'ebay'));
  assert.ok(!out.best_sites.includes('facebook'));
  assert.deepEqual(errors, [{ where: 'valuation.check.uncitable', error: { batch: 0, count: 4 } }]);
});

test('uncitable ids, invalid or future evidence dates are counted per completed batch before canonicalization', async () => {
  const x = input(), errors: unknown[] = [];
  const bad = [
    { ...comps[0], comp_id: '' },
    { ...comps[0], comp_id: 'future:sold', sold_at: '2027-01-01' },
    { ...comps[0], comp_id: 'future:observed', observed_at: '2027-01-01' },
    { ...comps[0], comp_id: 'future:at', at: '2027-01-01' },
    { ...comps[0], comp_id: 'invalid:date', sold_at: 'invalid' },
  ];
  x.sources = [async () => bad, async () => bad];
  x.log.error = (where, error) => errors.push({ where, error });
  const out = await check(x);
  assert.deepEqual(out.range, (await check(input())).range);
  assert.deepEqual(out.observation_snapshot, comps);
  assert.deepEqual(errors, [1, 2].map(batch => ({ where: 'valuation.check.uncitable', error: { batch, count: bad.length } })));
});

test('an uncited prior cannot hide a priced range: three cited sold rows answer alone and log the omission', async () => {
  const notes: { name: string; fields: Record<string, unknown> }[] = [];
  const x: CheckInput = { ...input(), warm_comps: comps.slice(0, 3), kind: 'shoes', retail_cents: 10000, depreciation: .5 };
  x.log = { ...x.log, note: (name, fields) => notes.push({ name, fields }) };
  const out = await check(x), rowsOnly = await check({ ...x, retail_cents: undefined });
  assert.notEqual(out.range.state, 'hidden');
  assert.deepEqual(out.range, rowsOnly.range);
  assert.deepEqual(out.citation?.basis_ids, x.warm_comps.map(c => c.comp_id));
  assert.ok(out.per_site.every(s => !s.citation?.basis_ids.includes('retail:p1')));
  assert.deepEqual(notes, [{ name: 'valuation.check.retail_uncited', fields: { product_id: 'p1' } }]);
});

test('an uncited prior with no rows hides because nothing prices it', async () => {
  const out = await check({ ...input(), warm_comps: [], kind: 'shoes', retail_cents: 10000, depreciation: .5 });
  assert.equal(out.range.state, 'hidden'); assert.equal(out.range.q50, null);
  assert.equal(out.citation, null); assert.equal(out.basis.count, 0);
});

test('an uncited prior leaves a cited warm band available', async () => {
  const fast = { low: 3000, high: 6000, n: 24, as_of, basis: 'category' as const, state: 'rough' as const };
  const out = await check({ ...input(), warm_comps: [], kind: 'shoes', retail_cents: 10000, depreciation: .5, fast });
  assert.equal(out.range.state, 'not_checked_yet'); assert.equal(out.range.q50, null);
  assert.equal(out.range.q10, fast.low); assert.equal(out.range.q90, fast.high);
  assert.deepEqual(out.citation?.basis_ids, ['band:p1']);
});

test('a cited retail prior cites retail alone even with an unused warm band', async () => {
  const out = await check({ ...input(), warm_comps: [], kind: 'shoes', retail_cents: 10000, depreciation: .5,
    retail_citation: 'retail:shoes', fast: { low: 3000, high: 6000, n: 24, as_of, basis: 'category', state: 'rough' } });
  assert.equal(out.range.q50, 5000); assert.deepEqual(out.citation?.basis_ids, ['retail:p1']);
  assert.equal(out.basis.count, 1); assert.deepEqual(out.basis.sources, ['retail:shoes']);
});

test('a blend cites retail with its surviving prior weight', async () => {
  const x = { ...input(), params: { ...DEFAULTS, anchor_enabled: 0 }, kind: 'shoes', retail_cents: 10000, depreciation: .5, retail_citation: 'retail:shoes' };
  const out = await check(x);
  assert.ok(out.citation?.basis_ids.includes('retail:p1'));
  assert.ok(out.per_site[0].citation?.basis_ids.includes('retail:p1'));
  assert.equal(out.basis.count, out.comps.length + 1);
  const priorWeight = DEFAULTS.blend_k / (out.n_eff + DEFAULTS.blend_k);
  const rows = out.comps.map(c => ({ id: c.comp_id, source: c.citation, at: c.sold_at, price_cents: c.adjusted_cents, weight: c.w }));
  const { basisHash } = await import('../proof/proof.ts');
  assert.equal(out.citation?.basis_hash, basisHash([...rows, { id: 'retail:p1', source: x.retail_citation, at: as_of,
    price_cents: 10000, weight: priorWeight }]));
});

test('retail evidence keeps a distinct basis id when sold ids occupy its name', async () => {
  const rows = comps.map((c, i) => ({ ...c, comp_id: i === 0 ? 'retail:p1' : i === 1 ? 'retail:p1:retail' : c.comp_id }));
  const out = await check({ ...input(), warm_comps: rows, kind: 'shoes', retail_cents: 10000,
    depreciation: .5, retail_citation: 'retail:shoes' });
  assert.ok(out.range.q50); assert.equal(out.basis.count, rows.length + 1);
  assert.ok(rows.every(c => out.citation?.basis_ids.includes(c.comp_id)));
  assert.equal(new Set(out.citation?.basis_ids).size, rows.length + 1);
  assert.ok(out.basis.sources.some(source => source === 'retail:shoes'));
});

test('retail citation weight also reflects the recent-variant anchor', async () => {
  const x = { ...input(), kind: 'shoes', retail_cents: 10000, depreciation: .5, retail_citation: 'retail:shoes' };
  const out = await check(x);
  const weight = DEFAULTS.blend_k / (out.n_eff + DEFAULTS.blend_k) *
    DEFAULTS.anchor_blend_k / (DEFAULTS.anchor_k + DEFAULTS.anchor_blend_k);
  const rows = out.comps.map(c => ({ id: c.comp_id, source: c.citation, at: c.sold_at, price_cents: c.adjusted_cents, weight: c.w }));
  const { basisHash } = await import('../proof/proof.ts');
  assert.equal(out.citation?.basis_hash, basisHash([...rows, { id: 'retail:p1', source: x.retail_citation, at: as_of,
    price_cents: 10000, weight }]));
});

test('a retail prior with zero surviving weight needs no citation', async () => {
  const x = { ...input(), params: { ...DEFAULTS, blend_k: 0 }, kind: 'shoes', retail_cents: 10000, depreciation: .5 };
  const out = await check(x), withoutPrior = await check({ ...x, retail_cents: undefined });
  assert.deepEqual(out.range, withoutPrior.range);
  assert.deepEqual(out.citation?.basis_ids, comps.map(c => c.comp_id));
});

test('an uncited prior leaves checked sold coverage visible', async () => {
  const out = await check({ ...input(), kind: 'shoes', retail_cents: 10000, depreciation: .5,
    calibration: { Q_g: 0, group: 'g', coverage: .8, passes: true, n: 100, hits: 80 } });
  assert.equal(out.range.state, 'checked'); assert.equal(out.range.share_shown, .8);
});

test('unchecked .9 sale curve can win against checked .6 and labels the selection and price path', async () => {
  const x = input(); x.floor_cents = 0;
  x.warm_comps = [...comps, ...comps.map(c => ({ ...c, comp_id: `fb:${c.comp_id}`, site: 'facebook' as const }))];
  x.sites.push({ site: 'facebook', curve: { p: () => .9, t: () => .5 } });
  const out = await check(x);
  assert.deepEqual(out.best_sites, ['facebook']); assert.equal(out.curve_checked, false);
  assert.ok(out.price_path); assert.equal(out.price_path.curve_checked, false);
  const checked = await check(input());
  assert.equal(checked.curve_checked, true); assert.equal(checked.price_path?.curve_checked, true);
  assert.equal((await check({ ...input(), sites: [] })).curve_checked, false);
});

test('may_model false rows remain in the priced basis and citation without a drop log', async () => {
  const x = input(), errors: unknown[] = [];
  const row = { ...comps[0], comp_id: 'display:only', price_cents: 5200, may_model: false };
  x.sources = [async () => [row]];
  x.log.error = (where, error) => errors.push({ where, error });
  const out = await check(x);
  assert.ok(out.comps.some(c => c.comp_id === row.comp_id && c.may_model === false));
  assert.ok(out.citation?.basis_ids.includes(row.comp_id));
  assert.ok(out.observation_snapshot.some(c => c.comp_id === row.comp_id));
  assert.equal(out.basis.count, comps.length + 1);
  assert.deepEqual(errors, []);
});

test('last_sale skips the newest uncitable sale and uses the next proved sale', async () => {
  const x = input(); x.warm_comps = [...comps, { ...comps[0], comp_id: 'newest:uncitable', sold_at: as_of, citation: '' }];
  const out = await check(x);
  assert.deepEqual(out.last_sale?.citation.basis_ids, ['c0']);
  assert.equal(out.last_sale?.price_cents, 4000);
});

test('bad site calibration hides and logs that site while the overall and other site survive', async () => {
  for (const calibration of [
    { Q_g: NaN, group: 'bad', coverage: .8, passes: true },
    { Q_g: 30, group: 'bad', coverage: .8, passes: false },
    { Q_g: 0, group: 'bad', coverage: .8, passes: true, n: 2, hits: 3 },
    { Q_g: 0, group: 'bad', coverage: 2, passes: true },
  ]) {
    const x = input(), errors: { where: string; error: unknown }[] = [];
    x.sites.push({ site: 'facebook', curve: x.sites[0].curve, calibration });
    x.log.error = (where, error) => errors.push({ where, error });
    const out = await check(x), bad = out.per_site.find(s => s.site === 'facebook')!;
    assert.ok(out.range.q50); assert.ok(out.per_site.find(s => s.site === 'ebay')?.citation);
    assert.equal(bad.state, 'hidden'); assert.equal(bad.q50, null); assert.equal(bad.citation, null);
    assert.equal(errors.length, 1); assert.equal(errors[0].where, 'valuation.check.site_citation');
    assert.equal((errors[0].error as Error).constructor.name, 'CitationError');
  }
});

test('a foreign error with a citation-like message is rethrown instead of swallowed', async () => {
  const failure = new Error('valuation missing basis');
  const x = input(); let reads = 0;
  x.sites[0].calibration = { get Q_g(): number { if (++reads > 1) throw failure; return 0; }, group: 'bad', coverage: .8, passes: true };
  await assert.rejects(check(x), error => error === failure);
});

test('review: a warm fallback citation names the same level as the displayed range', async () => {
  const x = input(); x.warm_comps = [];
  x.fast = { low: 8000, high: 12000, n: 24, as_of, basis: 'category', state: 'rough' };
  const out = await check(x);
  assert.equal((out.citation?.filters as { basis_level: string }).basis_level, out.range.basis_level);
  assert.equal((out.per_site[0].citation?.filters as { basis_level: string }).basis_level, out.per_site[0].basis_level);
});

test('R4: a future warm band cannot show an uncited fallback', async () => {
  const x = input(); x.warm_comps = [];
  x.fast = { low: 8000, high: 12000, n: 24, as_of: '2027-01-01', basis: 'category', state: 'rough' };
  await assert.rejects(check(x), /basis/);
});

test('R8: invalid curve values at an executable rung refuse the path', async () => {
  const x = input(); x.sites[0].curve = { p: price => price >= x.floor_cents ? NaN : .6, t: () => 10 };
  await assert.rejects(check(x), /curve probability/);
});

test('D12: cancellation exposure changes the chosen set and unknown windows stay single-site', async () => {
  const x = input();
  const sites: CheckInput['sites'] = ['ebay', 'depop'].map(site => ({ ...x.sites[0], site: site as 'ebay' | 'depop', cancel_cost_cents: 0, delist_minutes: 14400 }));
  assert.equal((await check({ ...x, sites })).best_sites.length, 2);
  assert.equal((await check({ ...x, sites: sites.map(s => ({ ...s, cancel_cost_cents: 1000000 })) })).best_sites.length, 1);
  assert.equal((await check({ ...x, sites: sites.map(({ delist_minutes: _, ...s }) => s) })).best_sites.length, 1);
});

test('R4: prior citations retain the target depreciation needed to reproduce their middle', async () => {
  const out = await check({ ...input(), warm_comps: [], kind: 'shoes', retail_cents: 10000, depreciation: .6, retail_citation: 'retail:receipt' });
  assert.equal(out.range.q50, 6000);
  assert.equal((out.citation?.filters as { target?: { depreciation: number } }).target?.depreciation, .6);
});

test('R4: changed caps and warm endpoints cannot reuse a citation for a different shown number', async () => {
  const x = { ...input(), condition: 'new_with_tags', warm_comps: comps.map(c => ({ ...c, condition: 'new_with_tags' })) };
  const a = await check({ ...x, retail_cap_cents: 4100 });
  const b = await check({ ...x, retail_cap_cents: 4500 });
  assert.notEqual(a.citation?.id, b.citation?.id);
  const warm: CheckInput = { ...input(), warm_comps: [], fast: { low: 2000, high: 4000, n: 24, as_of, basis: 'category', state: 'rough' } };
  assert.notEqual((await check(warm)).citation?.id, (await check({ ...warm, fast: { ...warm.fast!, high: 5000 } })).citation?.id);
});

const modeInput = (): CheckInput => ({ ...input(), floor_cents: 0,
  warm_comps: Array.from({ length: 30 }, (_, i) => ({ ...comps[0], comp_id: `mode${i}`, price_cents: 20500 + i * 1000 })),
});

test('modes use the posture quantiles of the kept adjusted sold basis', async () => {
  const out = await check(modeInput());
  assert.ok(out.modes);
  assert.ok(out.modes.fast.ask_cents < out.modes.sell.ask_cents);
  assert.ok(out.modes.sell.ask_cents < out.modes.best.ask_cents);
  for (const mode of ['fast', 'sell', 'best'] as const) {
    const mark = MARKS[planOf(mode).objective];
    assert.equal(out.modes[mode].ask_cents, weightedPercentile(out.comps.map(c => c.adjusted_cents), out.comps.map(c => c.w), .2 + .65 * mark));
    assert.equal(out.modes[mode].per_site.length, 1);
  }
  assert.notEqual(out.modes.fast.ask_cents, out.range.q10);
});

test('modes without a fitted curve have no probability, days or price path', async () => {
  const x = modeInput(); x.sites = [{ site: 'ebay' }];
  const out = await check(x);
  assert.ok(out.modes);
  for (const mode of Object.values(out.modes)) {
    assert.equal(mode.p_sale_30, null); assert.equal(mode.days_t50, null);
  }
  assert.equal(out.per_site[0].p_sale, null); assert.equal(out.per_site[0].days, null);
  assert.equal(out.price_path, null);
  const fitted = await check(modeInput());
  assert.equal(typeof fitted.modes!.sell.p_sale_30, 'number');
  assert.equal(typeof fitted.modes!.sell.days_t50, 'number');
});

test('a floor above fast holds the mode at the floor', async () => {
  const x = modeInput(); x.floor_cents = 35000;
  const out = await check(x);
  assert.equal(out.modes!.fast.ask_cents, 35000);
  assert.equal(out.modes!.fast.held_by, 'floor');
});

test('too few comps hides the modes', async () => {
  const x = modeInput(); x.warm_comps = x.warm_comps.slice(0, 2);
  assert.equal((await check(x)).modes, null);
});

test('each mode selects the site with the highest keep and retains every site point', async () => {
  const x = modeInput();
  x.warm_comps.push(...x.warm_comps.map(c => ({ ...c, comp_id: `fb:${c.comp_id}`, site: 'facebook' as const })));
  x.sites.push({ site: 'facebook', curve: x.sites[0].curve });
  const out = await check(x);
  for (const mode of Object.values(out.modes!)) {
    assert.equal(mode.site, 'facebook'); assert.equal(mode.per_site.length, 2);
    assert.equal(mode.keep_cents, Math.max(...mode.per_site.map(p => p.keep_cents)));
  }
});


test('missing curve with retained evidence keeps prices but cannot execute', async () => {
  const x = modeInput();
  x.sites = x.sites.map(({ curve: _, ...site }) => site);
  const out = await check(x);
  assert.ok(out.range.q50);
  assert.ok(out.per_site[0].citation);
  assert.ok(out.per_site[0].keep_q50);
  assert.equal(out.per_site[0].p_sale, null);
  assert.equal(out.per_site[0].days, null);
  assert.equal(out.price_path, null);
  assert.deepEqual(out.best_sites, []);
  assert.ok(out.modes);
  for (const mode of Object.values(out.modes)) {
    assert.equal(mode.p_sale_30, null);
    assert.equal(mode.days_t50, null);
  }
});

test('a curve-less site stays in mode points but outside executable site selection', async () => {
  const x = modeInput();
  x.warm_comps.push(...x.warm_comps.map(c => ({ ...c, comp_id: `fb:${c.comp_id}`, site: 'facebook' as const })));
  x.sites.push({ site: 'facebook', curve_evidence: x.sites[0].curve_evidence, cancel_cost_cents: 0, delist_minutes: 5 });
  const out = await check(x);
  assert.deepEqual(out.best_sites, ['ebay']);
  assert.ok(out.price_path);
  const site = out.per_site.find(s => s.site === 'facebook')!;
  assert.equal(site.p_sale, null);
  assert.equal(site.days, null);
  for (const mode of Object.values(out.modes!)) {
    assert.equal(mode.site, 'facebook');
    assert.equal(mode.per_site.length, 2);
    assert.equal(mode.p_sale_30, null);
    assert.equal(mode.days_t50, null);
  }
});

test('modes use the resolved condition and size adjustments of the target', async () => {
  const x = modeInput();
  x.condition = 'excellent'; x.size = 'M';
  x.params = { ...DEFAULTS, condition_ratios: { ...DEFAULTS.condition_ratios, excellent: 1.05 }, size_ratios: { S: 1, M: 1.05 } };
  x.warm_comps = x.warm_comps.map(c => ({ ...c, size: 'S' }));
  const out = await check(x);
  assert.ok(out.modes);
  assert.ok(out.comps.every(c => c.adjusted_cents > c.price_cents));
  for (const choice of ['fast', 'sell', 'best'] as const) {
    const point = pointOnSite({ ...x.sites[0], top: [], offer_discount: 0,
      sold: out.comps.map(c => ({ price_cents: c.adjusted_cents, w: c.w, sold_at: c.sold_at })) },
    MARKS[planOf(choice).objective], x.floor_cents, ceiling([], [], x.as_of));
    assert.ok(point);
    assert.deepEqual(out.modes[choice], { ...point, per_site: [point] });
  }
});

test('recalled valuations and an empty set of site points hide every mode', async () => {
  assert.equal((await check({ ...modeInput(), recalled: true })).modes, null);
  assert.equal((await check({ ...modeInput(), sites: [] })).modes, null);
});


test('the prior weight cannot disagree between comparables and the citation after a kind band', async () => {
  const x: CheckInput = { ...input(), kind: 'shoes', retail_cents: 10000, depreciation: .5,
    retail_citation: 'retail:shoes', kind_band: { q10: 3000, q50: 4500, q90: 6000, n_eff: 12 } };
  const found = comparables(x, x.warm_comps, as_of);
  const withoutBand = comparables({ ...x, kind_band: undefined }, x.warm_comps, as_of);
  assert.ok(found.retail_weight > 0 && found.retail_weight < withoutBand.retail_weight);
  const out = await check(x);
  assert.deepEqual(out.range.q50, found.range.q50);
  const rows = found.comps.map(c => ({ id: c.comp_id, source: c.citation, at: c.sold_at, price_cents: c.adjusted_cents, weight: c.w }));
  const { basisHash } = await import('../proof/proof.ts');
  const expected = basisHash([...rows, { id: 'retail:p1', source: x.retail_citation!, at: as_of,
    price_cents: 10000, weight: found.retail_weight }]);
  assert.equal(out.citation?.basis_hash, expected);
  assert.equal(out.per_site[0].citation?.basis_hash, expected);
});

test('a fee flag that could never fire uses the valuation date unless the sale supplies its own', async () => {
  for (const [date, expected] of [['2026-12-15', true], ['2026-12-13', false]] as const) {
    const out = await check({ ...input(), as_of: date });
    assert.equal(out.per_site[0].fees_may_have_changed, expected);
  }
  const out = await check({ ...input(), as_of: '2026-12-15', sites: [{ site: 'ebay', sale: { as_of: '2026-12-13' } }] });
  assert.equal(out.per_site[0].fees_may_have_changed, false);
});

test('a hard-coded tax rate cannot bypass the registry at Check or override a known buyer rate', async () => {
  const store = memoryStore();
  const { resolve } = await import('./params.ts'); resolve(store);
  store.apply('valuation_sales_tax_rate', {}, () => ({ value: .1, weight: 1 }), as_of);
  const x = { ...input(), store, warm_comps: comps.map(c => ({ ...c, price_cents: 10000 })) };
  const out = await check(x);
  assert.equal(out.per_site[0].keep_q50, 8464);
  assert.ok(out.modes);
  assert.equal(out.modes.sell.keep_cents, keep('ebay', out.modes.sell.ask_cents, { tax_rate: .1 }).keep_cents);
  assert.equal(out.citation?.param_versions.valuation_sales_tax_rate, store.read('valuation_sales_tax_rate', {}).version);
  const known = await check({ ...x, sites: [{ site: 'ebay', sale: { tax_rate: 0 } }] });
  assert.equal(known.per_site[0].keep_q50, 8600);
  assert.ok(known.modes);
  assert.equal(known.modes.sell.keep_cents, keep('ebay', known.modes.sell.ask_cents, { tax_rate: 0 }).keep_cents);
});

test('last_sale prefers a variant over a newer product sale, falls back to product, then null', async () => {
  const variant = { ...comps[0], comp_id: 'variant:older', sold_at: '2026-11-01' };
  const product = { ...comps[1], comp_id: 'product:newer', level: 'product' as const, sold_at: '2026-11-14' };
  const x = input();
  assert.deepEqual((await check({ ...x, warm_comps: [variant, product] })).last_sale?.citation.basis_ids, [variant.comp_id]);
  const fallback = (await check({ ...x, warm_comps: [product] })).last_sale;
  assert.equal(fallback?.basis_level, 'product'); assert.equal(fallback?.price_cents, product.price_cents);
  assert.deepEqual(fallback?.citation.basis_ids, [product.comp_id]);
  assert.equal((await check({ ...x, warm_comps: [{ ...product, level: 'family' }] })).last_sale, null);
  assert.equal((await check({ ...x, warm_comps: [] })).last_sale, null);
});


test('an uncited prior omission is still recorded by a legacy logger without note', async () => {
  const entries: { where: string; fields: unknown }[] = [];
  const x = { ...input(), warm_comps: comps.slice(0, 3), kind: 'shoes', retail_cents: 10000, depreciation: .5 };
  x.log.error = (where, fields) => entries.push({ where, fields });
  const out = await check(x);
  assert.notEqual(out.range.state, 'hidden');
  assert.deepEqual(entries, [{ where: 'valuation.check.retail_uncited', fields: { product_id: 'p1' } }]);
});

test('last_sale excludes listed-dated variants even before a dated product sale', async () => {
  const listed = { ...comps[0], comp_id: 'listed:variant', dated_by: 'listed' as const, sold_at: '2026-11-14' };
  const sold = { ...comps[1], comp_id: 'sold:product', level: 'product' as const, dated_by: 'sold' as const };
  assert.equal((await check({ ...input(), warm_comps: [listed] })).last_sale, null);
  const out = await check({ ...input(), warm_comps: [listed, sold] });
  assert.deepEqual(out.last_sale?.citation.basis_ids, [sold.comp_id]);
});

test('proof comp rows distinguish listing dates from sale dates', async () => {
  const listed = { ...comps[0], comp_id: 'listed:variant', dated_by: 'listed' as const };
  const out = await check({ ...input(), warm_comps: [listed, comps[1]] });
  assert.ok(out.citation);
  const filters = out.citation.filters as { comps: Record<string, unknown>[] };
  assert.ok(Array.isArray(filters.comps), 'the proof must preserve per-comp date provenance');
  const listedRow = filters.comps.find(c => c.id === listed.comp_id);
  const soldRow = filters.comps.find(c => c.id === comps[1].comp_id);
  assert.ok(listedRow); assert.ok(soldRow);
  assert.equal(Object.hasOwn(listedRow, 'sold_at'), false);
  assert.equal(listedRow.listed_at, listed.sold_at); assert.equal(listedRow.dated_by, 'listed');
  assert.equal(soldRow.sold_at, comps[1].sold_at); assert.equal(soldRow.dated_by, 'sold');
  assert.ok(out.per_site[0].citation);
  assert.deepEqual((out.per_site[0].citation.filters as { comps: unknown }).comps, filters.comps);
});
