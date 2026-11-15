import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valuate, basisOf, saleCurve, type ValuateCtx, type ValuationItem, type ObservationPort } from './valuate.ts';
import { check } from './check.ts';
import { fromResolved, nEff, type Comp } from './comps.ts';
import { DECLARED, resolve } from './params.ts';
import { memoryStore, type ParamStore, type Scope } from '../param/param.ts';
import fs from 'node:fs/promises';
import { fittedReader } from '../param/export.ts';
import { onOurSale } from './aci.ts';

const as_of = '2026-11-15T00:00:00Z';
const ago = (days: number) => new Date(Date.parse(as_of) - days * 86400000).toISOString();
const sales = (n: number): Comp[] => Array.from({ length: n }, (_, i) => ({ comp_id: `comp:${i}`, product_id: 'product:test',
  site: 'ebay', sold_at: ago(5), price_cents: 4000 + i * 100, kind: 'sold', level: 'variant', condition: 'good',
  w_match: 1, w_extract: 1, may_model: true, citation: `source:${i}` }));
const item: ValuationItem = { item_id: 'item:test', product_id: 'product:test', kind: 'shoes', condition: 'good', floor_cents: 0,
  objective: 'balanced', sites: [{ site: 'ebay' }] };
function setup(initial: Comp[] = []) {
  const rows = [...initial], writes: { rows: Comp[]; meta: Parameters<ObservationPort['write']>[1] }[] = [];
  const reads: Parameters<ObservationPort['read']>[0][] = [], errors: { where: string; error: unknown }[] = [];
  const ctx: ValuateCtx = { params: memoryStore(), as_of, sources: [], observations: {
    read: async q => { reads.push(q); return [...rows]; },
    write: async (next, meta) => { writes.push({ rows: next, meta }); rows.push(...next); },
  }, log: { timed: (_name, fn) => fn(), error: (where, error) => { errors.push({ where, error }); } } };
  return { ctx, rows, writes, reads, errors };
}
function promote(store: ParamStore, path: string, value: number, scope: Scope = {}) {
  const declared = DECLARED.find(p => p.path === path)!;
  store.declare(declared);
  const row = store.propose({ name: declared.name, scope, family: 'scalar', value_or_hyperparams: value, prior: declared.prior,
    fitted_on_ids_hash: 'fixture', n_eff: 20, metric: 'fixture', held_out_score: 1, guard_lo: declared.guard_lo ?? null, guard_hi: declared.guard_hi ?? null }, 0);
  assert.equal(store.promote(declared.name, scope, row.version, 0, as_of).promoted, true);
  return row.version;
}

test('link 1: two stored sales keep the price, basis level and too_few note, and request more', async () => {
  const { ctx, writes, reads } = setup(sales(2));
  const { valuation: v, gather } = await valuate(item, ctx);
  assert.ok(v.range.q50); assert.notEqual(v.range.state, 'hidden');
  assert.equal(v.basis_level, 'variant'); assert.deepEqual(v.notes, ['too_few']);
  assert.equal(gather?.reason, 'too_few'); assert.equal(gather?.want_n_eff, 6);
  assert.equal(gather?.n_eff, v.n_eff); assert.equal(writes.length, 0);
  assert.deepEqual(reads, [{ product_id: item.product_id, kind: item.kind, as_of }]);
});

test('links 2/7: a second valuation reads the first source rows and cites their ids', async () => {
  const { ctx, rows, writes } = setup(); const sourceRows = sales(6);
  ctx.sources = [async () => sourceRows];
  const first = await valuate(item, ctx);
  assert.equal(writes.length, 1); assert.deepEqual(rows, sourceRows);
  ctx.sources = [];
  const second = await valuate(item, ctx);
  assert.deepEqual(second, first); assert.equal(second.valuation.basis_level, 'variant'); assert.equal(second.gather, null);
  assert.deepEqual(second.valuation.citation?.basis_ids, sourceRows.map(c => c.comp_id));
});

test('link 5: write new source ids once, never read rows or duplicate ids', async () => {
  const all = sales(3), { ctx, writes } = setup(all.slice(0, 1));
  ctx.request_id = 'request:test'; ctx.sources = [async () => all, async () => [all[2], all[1]]];
  await valuate(item, ctx);
  assert.deepEqual(writes, [{ rows: all.slice(1), meta: { item_id: item.item_id, as_of, request_id: ctx.request_id } }]);
  await valuate(item, ctx); assert.equal(writes.length, 1);
});

test('link 6: basisOf uses the final adjusted and trimmed weights from check', async () => {
  const rows = sales(8).map((c, i) => ({ ...c, sold_at: ago(i * 20), condition: i % 2 ? 'excellent' : 'good' }));
  const p = fromResolved(resolve(memoryStore()));
  const v = await check({ ...item, condition: 'excellent', as_of, warm_comps: rows, sources: [], params: p, param_version: 999, log: setup().ctx.log });
  const b = basisOf(v.comps, as_of, p);
  assert.equal(b.n_eff, v.n_eff); assert.equal(b.basis_level, v.basis_level);
  assert.equal(b.sold_90d, v.comps.filter(c => Date.parse(c.sold_at) >= Date.parse(ago(90))).length);
  const homogeneous = sales(6), simple = await valuate(item, setup(homogeneous).ctx);
  assert.equal(basisOf(homogeneous, as_of, p).n_eff, simple.valuation.n_eff);
});

test('link 9: promoted age half-life changes the next answer and its citation version', async () => {
  const { ctx } = setup(sales(6).map((c, i) => ({ ...c, sold_at: ago(i * 25), price_cents: 4000 + i * 200 })));
  const first = await valuate(item, ctx);
  const version = promote(ctx.params, 'half_life_days.default', 10);
  const next = await valuate(item, ctx);
  assert.notEqual(next.valuation.n_eff, first.valuation.n_eff);
  assert.notDeepEqual(next.valuation.range, first.valuation.range);
  assert.equal(next.valuation.citation?.param_versions.valuation_half_life_days_default, version);
  assert.equal(next.valuation.citation?.param_versions.valuation, undefined);
});

test('valuate reports per-parameter versions rather than inventing an aggregate version', async () => {
  const { ctx } = setup(sales(6));
  const version = promote(ctx.params, 'half_life_days.default', 10);
  const { valuation } = await valuate(item, ctx);
  assert.equal(valuation.param_version, 0);
  assert.equal(valuation.param_versions.valuation_half_life_days_default, version);
  assert.deepEqual(valuation.param_versions, resolve(ctx.params, { kind: item.kind }).versions);
  assert.deepEqual(valuation.param_versions, valuation.citation?.param_versions);
});

test('registry resolves once per parameter at the supplied person and kind scope', async () => {
  const { ctx } = setup(sales(2)); ctx.person = 'person:test';
  promote(ctx.params, 'min_n_eff', 1, { person: ctx.person, kind: item.kind });
  const read = ctx.params.read.bind(ctx.params), calls: { name: string; scope: Scope }[] = [];
  ctx.params.read = (name, scope, at) => { calls.push({ name, scope }); return read(name, scope, at); };
  const out = await valuate(item, ctx);
  assert.equal(out.gather, null);
  assert.equal(calls.length, DECLARED.length);
  assert.ok(calls.every(c => JSON.stringify(c.scope) === JSON.stringify({ person: ctx.person, kind: item.kind })));
  assert.deepEqual(Object.keys(out.valuation.citation!.param_versions).sort(), DECLARED.map(p => p.name).sort());
});

for (const port of ['read', 'write'] as const) test(`${port} failure logs once and preserves the completed valuation without retrying`, async () => {
  const { ctx, writes, errors } = setup(); const failure = new Error(`${port} unavailable`); let calls = 0;
  ctx.sources = [async () => sales(6)];
  ctx.observations[port] = async () => { calls++; throw failure; };
  const out = await valuate(item, ctx);
  assert.ok(out.valuation.range.q50); assert.ok(out.valuation.citation);
  assert.equal(out.persisted, port === 'read');
  assert.equal(out.valuation.notes.includes('warm_unavailable'), port === 'read');
  assert.equal(calls, 1); assert.equal(writes.length, port === 'read' ? 1 : 0);
  assert.deepEqual(errors, [{ where: `valuation.observations.${port}`, error: failure }]);
});

test('successful observation write reports persisted true', async () => {
  const { ctx, writes } = setup(); ctx.sources = [async () => sales(6)];
  const out = await valuate(item, ctx);
  assert.equal(out.persisted, true); assert.equal(writes.length, 1);
});

test('may_model false source observations are priced, cited and persisted unchanged without calibration scores', async () => {
  const { ctx, writes } = setup(), good = sales(8);
  const row = { ...good[0], comp_id: 'display:only', price_cents: 5200, may_model: false };
  const before = ctx.params.rows('valuation_conformal_scores', {});
  ctx.sources = [async () => [...good, row]];
  const out = await valuate(item, ctx);
  assert.ok(out.valuation.comps.some(c => c.comp_id === row.comp_id));
  assert.ok(out.valuation.citation?.basis_ids.includes(row.comp_id));
  assert.deepEqual(writes[0].rows.find(c => c.comp_id === row.comp_id), row);
  assert.equal(out.persisted, true);
  assert.deepEqual(ctx.params.rows('valuation_conformal_scores', {}), before);
});

test('source failure logs once and persists no partial source batch', async () => {
  const { ctx, writes, errors } = setup(); const failure = new Error('source unavailable');
  ctx.sources = [async () => sales(3), async () => { throw failure; }];
  await assert.rejects(valuate(item, ctx), error => error === failure);
  assert.equal(writes.length, 0); assert.equal(errors.length, 1);
});

test('deadline excludes late source rows from both answer and persistence', async () => {
  const { ctx, writes } = setup(sales(2)); ctx.budget_ms = 5;
  let finish!: (rows: Comp[]) => void;
  ctx.sources = [() => new Promise(resolve => { finish = resolve; })];
  const out = await valuate(item, ctx);
  assert.equal(out.valuation.partial, true); assert.equal(writes.length, 0);
  finish(sales(6)); await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 0); assert.equal(out.valuation.comps.length, 2);
});

test('fallback product requests source_gap; enough old variant sales request stale', async () => {
  const product = await valuate(item, setup(sales(6).map(c => ({ ...c, level: 'product', w_match: .5 }))).ctx);
  assert.equal(product.valuation.basis_level, 'product'); assert.equal(product.gather?.reason, 'source_gap');
  const stale = await valuate(item, setup(sales(6).map(c => ({ ...c, sold_at: ago(100) }))).ctx);
  assert.equal(stale.gather?.reason, 'stale'); assert.ok(stale.valuation.notes.includes('stale'));
  const empty = await valuate(item, setup().ctx);
  assert.equal(empty.valuation.range.q50, null); assert.equal(empty.gather?.reason, 'too_few');
});

test('last sale uses the newest variant sale, unadjusted, ahead of newer product sales', async () => {
  const rows = sales(3).map((c, i) => ({ ...c, sold_at: ago(3 - i), price_cents: 4000 + i * 150 }));
  rows[2] = { ...rows[2], level: 'product', w_match: .5 };
  const { valuation } = await valuate({ ...item, condition: 'excellent' }, setup(rows).ctx);
  assert.equal(valuation.last_sale?.price_cents, rows[1].price_cents);
  assert.equal(valuation.last_sale?.sold_at, rows[1].sold_at); assert.equal(valuation.last_sale?.basis_level, 'variant');
  assert.deepEqual(valuation.last_sale?.citation.basis_ids, [rows[1].comp_id]);
});

test('last sale falls back to product and is null without variant or product sales', async () => {
  const rows = sales(2).map((c, i) => ({ ...c, level: 'product' as const, w_match: .5, sold_at: ago(2 - i) }));
  const { valuation } = await valuate(item, setup(rows).ctx);
  assert.equal(valuation.last_sale?.basis_level, 'product'); assert.equal(valuation.last_sale?.price_cents, rows[1].price_cents);
  assert.equal((await valuate(item, setup().ctx)).valuation.last_sale, null);
  assert.equal((await valuate(item, setup(rows.map(c => ({ ...c, level: 'family' }))).ctx)).valuation.last_sale, null);
});

test('same registry, ports and as_of give identical output', async () => {
  const { ctx } = setup(sales(6)); ctx.sources = [async () => sales(6)];
  assert.deepEqual(await valuate(item, ctx), await valuate(item, ctx));
});

test('persistence retains new source observations even when outside the as_of pricing snapshot', async () => {
  const { ctx, writes } = setup(); const rows = sales(2).map(c => ({ ...c, sold_at: ago(-1) }));
  ctx.sources = [async () => rows];
  const { valuation } = await valuate(item, ctx);
  assert.equal(valuation.comps.length, 0); assert.deepEqual(writes[0]?.rows, rows);
});

test('last sale remains the raw newest variant sale even beyond the pricing age cut', async () => {
  const rows = sales(2); rows[0].sold_at = ago(400); rows[1].level = 'product';
  const { valuation } = await valuate(item, setup(rows).ctx);
  assert.equal(valuation.last_sale?.basis_level, 'variant');
  assert.deepEqual(valuation.last_sale?.citation.basis_ids, [rows[0].comp_id]);
});

test('mixing raw comps into a basis never replaces weights already calculated for the item', async () => {
  const { valuation } = await valuate(item, setup(sales(2)).ctx);
  const params = fromResolved(resolve(memoryStore()));
  const raw = { ...sales(1)[0], comp_id: 'raw', sold_at: as_of };
  const final = valuation.comps.map((c, i) => ({ ...c, w: (i + 1) / 10 }));
  const measured = basisOf([...final, raw], as_of, params);
  assert.equal(measured.n_eff, nEff([.1, .2, 1]));
});

test('an empty basis with a promoted zero sample threshold still requests fresh evidence', async () => {
  const { ctx } = setup(); promote(ctx.params, 'min_n_eff', 0);
  const out = await valuate(item, ctx);
  assert.equal(out.gather?.reason, 'stale');
});

async function fitted(ctx: ValuateCtx, scopes: string[] = ['hackathon_demo']) {
  let pending: Promise<unknown> = Promise.resolve(); const notes: unknown[] = [];
  ctx.fitted = fittedReader({ path: new URL('../param/fixtures/export-latest.json', import.meta.url).pathname, scopes,
    log: { ...ctx.log, timed: (_name, fn) => { const result = fn(); pending = Promise.resolve(result); return result; },
      note: (...args) => { notes.push(args); } } });
  ctx.fitted.loaded(); await pending; return notes;
}
const sneakers: ValuationItem = { ...item, kind: 'sneakers', sites: [{ site: 'mercari' }] };
const mercariSales = () => sales(8).map(c => ({ ...c, site: 'mercari' as const }));

test('exported site-free calibration checks a cited sneakers range and names its run in the citation', async () => {
  const { ctx } = setup(mercariSales()); await fitted(ctx);
  const { valuation } = await valuate(sneakers, ctx);
  assert.equal(valuation.range.group, 'export:fixture:DB4:2026-11-15:sneakers');
  assert.equal(valuation.range.state, 'checked');
  assert.equal(valuation.per_site[0].curve_checked, true);
  // Site and item medians agree: ratio 1 is halfway between .5 and 1.5.
  assert.deepEqual(valuation.per_site[0].p_sale, { d7: .1875, d30: .375, d90: .625 });
  assert.ok(JSON.stringify(valuation.citation).includes('fixture:DB4:2026-11-15 measures:fixture.calibration'));
});

test('exported calibration never bypasses thin basis, checked minimum, coverage, or Wilson thresholds', async () => {
  const thin = setup(mercariSales().slice(0, 2)); await fitted(thin.ctx);
  assert.equal((await valuate(sneakers, thin.ctx)).valuation.range.state, 'not_checked_yet');
  for (const [path, value] of [['checked_min_n', 201], ['coverage_min', .81], ['coverage_max', .79], ['checked_wilson_min', .9]] as const) {
    const { ctx } = setup(mercariSales()); await fitted(ctx);
    promote(ctx.params, path, value, { kind: 'sneakers' });
    const { valuation } = await valuate(sneakers, ctx);
    assert.match(valuation.range.group!, /^export:/);
    assert.equal(valuation.range.state, 'not_checked_yet', path);
  }
});

test('scope exclusion logs once and leaves valuation identical to no fitted reader', async () => {
  const baseline = await valuate(sneakers, setup(mercariSales()).ctx);
  const { ctx } = setup(mercariSales()); const notes = await fitted(ctx, []);
  assert.deepEqual(await valuate(sneakers, ctx), baseline);
  assert.deepEqual(await valuate(sneakers, ctx), baseline);
  assert.equal(notes.length, 2);
});

test('jeans never uses sneakers calibration or curve and depop never uses mercari curve', async () => {
  const { ctx } = setup(mercariSales()); await fitted(ctx);
  const jeans = (await valuate({ ...sneakers, kind: 'jeans' }, ctx)).valuation;
  assert.equal(jeans.range.group, null);
  assert.equal(jeans.per_site[0].p_sale, null);
  const { valuation } = await valuate({ ...sneakers, sites: [{ site: 'depop' }] }, ctx);
  assert.equal(valuation.per_site[0].p_sale, null);
});

test('a site price outside the fitted ratios clamps odds to the end bin using the item median', async () => {
  const rows = [...sales(24).map(c => ({ ...c, price_cents: 1000 })),
    ...mercariSales().map(c => ({ ...c, comp_id: `mercari:${c.comp_id}` }))];
  const { ctx } = setup(rows); await fitted(ctx);
  const { valuation } = await valuate(sneakers, ctx);
  const site = valuation.per_site[0];
  assert.equal(valuation.range.q50, 1000);
  assert.ok(site.q50! / valuation.range.q50! > 1.5);
  assert.equal(site.curve_checked, true);
  assert.deepEqual(site.p_sale, { d7: .125, d30: .25, d90: .5 });
});

test('a null item median still answers without a fitted curve', async () => {
  const { ctx } = setup(); await fitted(ctx);
  const { valuation, gather } = await valuate(sneakers, ctx);
  assert.equal(valuation.range.q50, null);
  assert.equal(valuation.per_site[0].curve_checked, false);
  assert.equal(valuation.per_site[0].p_sale, null);
  assert.equal(valuation.per_site[0].days, null);
  assert.ok(gather);
});

async function curveFit(site = 'mercari') {
  const { ctx } = setup(); await fitted(ctx);
  return ctx.fitted!.curve({ kind: 'sneakers', site })!.value_or_hyperparams;
}

test('fitted probabilities interpolate between ratio bins and clamp both ends', async () => {
  const curve = saleCurve(await curveFit(), 4000);
  // At ratio 1, each probability is the mean of the .5 and 1.5 bins.
  assert.deepEqual([7, 30, 90].map(day => curve.p(4000, day)), [.1875, .375, .625]);
  // Ratio 1.25 is three quarters of the way from .5 to 1.5.
  assert.deepEqual([7, 30, 90].map(day => curve.p(5000, day)), [.15625, .3125, .5625]);
  assert.deepEqual([7, 30, 90].map(day => curve.p(8000, day)), [.125, .25, .5]);
  assert.deepEqual([7, 30, 90].map(day => curve.p(1000, day)), [.25, .5, .75]);
});

test('fitted probabilities start at zero, interpolate every day segment and stop growing after day 90', async () => {
  const curve = saleCurve(await curveFit(), 4000);
  assert.equal(curve.p(4000, 0), 0);
  assert.equal(curve.p(4000, 3.5), .09375);
  assert.equal(curve.p(4000, 18.5), .28125);
  assert.equal(curve.p(4000, 60), .5);
  assert.equal(curve.p(4000, 120), .625);
});

test('fitted days solve the first crossing exactly and return null for an unreachable probability', async () => {
  const curve = saleCurve(await curveFit(), 4000);
  assert.equal(curve.t(4000, 0), 0);
  assert.equal(curve.t(4000, .09375), 3.5);
  assert.equal(curve.t(4000, .28125), 18.5);
  assert.equal(curve.t(4000, .5), 60);
  assert.equal(curve.t(4000, .625), 90);
  assert.equal(curve.t(4000, .75), null);
  assert.equal(curve.t(8000, .5), 90);
  assert.equal(curve.t(1000, .5), 30);
});

test('a price-blind curve ignores price and returns exported t25, t50 and t75 before solving other quantiles', async () => {
  const fit = await curveFit('stockx'), curve = saleCurve(fit, 4000);
  for (const price of [100, 4000, 100000]) {
    assert.deepEqual([7, 30, 90].map(day => curve.p(price, day)), [.2, .5, .8]);
    assert.equal(curve.t(price, .25), fit.t![0]);
    assert.equal(curve.t(price, .5), fit.t![1]);
    assert.equal(curve.t(price, .75), fit.t![2]);
    assert.equal(curve.t(price, .1), 3.5);
    assert.equal(curve.t(price, .9), null);
  }
});

test('valuate preserves measured days past 90 and a not-reached share from a DB4 price-blind row', async () => {
  const { ctx, errors } = setup(sales(8));
  let pending: Promise<unknown> = Promise.resolve();
  ctx.fitted = fittedReader({ path: new URL('../param/fixtures/export-db4-shape.json', import.meta.url).pathname,
    scopes: ['hackathon_demo'], log: { ...ctx.log, note: () => {},
      timed: (_name, fn) => { const result = fn(); pending = Promise.resolve(result); return result; } } });
  ctx.fitted.loaded(); await pending;
  const { valuation } = await valuate({ ...item, kind: 'cards_collectibles' }, ctx);
  assert.deepEqual(valuation.per_site[0].days, { t25: 30, t50: 107, t75: null });
  assert.deepEqual(errors, []);
});

test('a price-blind not-reached share stays null even when horizon probabilities could imply a day', async () => {
  const fit = await curveFit('stockx');
  fit.t = [null, 107, null];
  const curve = saleCurve(fit, 4000);
  for (const price of [100, 4000, 100000]) {
    assert.equal(curve.t(price, .25), null);
    assert.equal(curve.t(price, .5), 107);
    assert.equal(curve.t(price, .75), null);
  }
});

test('flat probability segments return their first crossing without division by zero', async () => {
  const fit = await curveFit(); fit.bins = [{ ratio: 1, p: [0, .5, .5] }]; fit.t = null;
  const curve = saleCurve(fit, 4000);
  assert.equal(curve.t(4000, 0), 0);
  assert.equal(curve.t(4000, .5), 30);
  assert.equal(curve.t(4000, .75), null);
});

test('multi-bin curves solve days from the interpolated probabilities even if exported t is present', async () => {
  const fit = await curveFit(); fit.t = [1, 2, 3];
  assert.equal(saleCurve(fit, 4000).t(4000, .5), 60);
});

test('fitted curves preserve the one completed source read, deadline and persistence snapshot', async () => {
  const { ctx, writes } = setup(); await fitted(ctx); ctx.budget_ms = 5;
  let calls = 0, finish!: (rows: Comp[]) => void;
  ctx.sources = [async () => { calls++; return mercariSales(); },
    () => new Promise(resolve => { finish = resolve; })];
  const { valuation } = await valuate(sneakers, ctx);
  assert.equal(calls, 1);
  assert.equal(valuation.partial, true);
  assert.deepEqual(valuation.per_site[0].p_sale, { d7: .1875, d30: .375, d90: .625 });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].rows, mercariSales());
  finish(sales(30)); await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(valuation.observation_snapshot.length, 8);
});

test('fitted curve replay logs uncitable rows once with their original batch and keeps that site hidden', async () => {
  const { ctx, errors } = setup(mercariSales()); await fitted(ctx); errors.length = 0;
  ctx.sources = [async () => [{ ...sales(1)[0], comp_id: 'uncited', site: 'depop', citation: '' }]];
  const { valuation } = await valuate({ ...sneakers, sites: [{ site: 'mercari' }, { site: 'depop' }] }, ctx);
  assert.deepEqual(valuation.per_site.find(s => s.site === 'mercari')?.p_sale, { d7: .1875, d30: .375, d90: .625 });
  assert.equal(valuation.per_site.find(s => s.site === 'depop')?.state, 'hidden');
  assert.deepEqual(errors, [{ where: 'valuation.check.uncitable', error: { batch: 1, count: 1 } }]);
});

test('fitted curve replay logs a bad site calibration once and keeps the site hidden', async () => {
  const { ctx, errors } = setup(mercariSales()); await fitted(ctx); errors.length = 0;
  const { valuation } = await valuate({ ...sneakers, sites: [{ site: 'mercari',
    calibration: { Q_g: -1, group: 'fixture:bad', n: 200, hits: 160, coverage: .8, passes: true } }] }, ctx);
  assert.equal(valuation.per_site[0].state, 'hidden');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].where, 'valuation.check.site_citation');
  assert.match((errors[0].error as Error).message, /Q_g/);
});

test('fitted curve replay preserves a logger with inherited methods and its receiver', async () => {
  const { ctx, errors } = setup(mercariSales()); await fitted(ctx);
  class Logger {
    names: string[] = [];
    timed<T>(name: string, fn: () => T): T { this.names.push(name); return fn(); }
    error(where: string, error: unknown) { errors.push({ where, error }); }
  }
  const log = new Logger(); ctx.log = log;
  const { valuation } = await valuate(sneakers, ctx);
  assert.deepEqual(valuation.per_site[0].p_sale, { d7: .1875, d30: .375, d90: .625 });
  assert.equal(log.names.filter(name => name === 'valuation.check').length, 2);
});

test('our exact group takes over only at conformal_parent_min; parent and other person scores never take over', async () => {
  const { ctx } = setup(mercariSales()); ctx.person = 'person:test'; await fitted(ctx);
  const group = { kind: 'sneakers', person: ctx.person };
  for (let i = 0; i < 40; i++) onOurSale(ctx.params, { kind: 'sneakers' }, { q10: 4000, q90: 5000 }, 4500, as_of);
  for (let i = 0; i < 29; i++) onOurSale(ctx.params, group, { q10: 4000, q90: 5000 }, 4500, as_of);
  assert.match((await valuate(sneakers, ctx)).valuation.range.group!, /^export:/);
  onOurSale(ctx.params, group, { q10: 4000, q90: 5000 }, 4500, as_of);
  assert.equal((await valuate(sneakers, ctx)).valuation.range.group, JSON.stringify(group));
  const other = await valuate(sneakers, { ...ctx, person: 'person:other' });
  assert.match(other.valuation.range.group!, /^export:/);
});

test('a refresh in flight does not delay valuate or discard the previous calibration', async t => {
  const { ctx } = setup(mercariSales()); let now = 0, pending: Promise<unknown> = Promise.resolve();
  ctx.fitted = fittedReader({ path: new URL('../param/fixtures/export-latest.json', import.meta.url).pathname,
    scopes: ['hackathon_demo'], now: () => now, every_ms: 10,
    log: { ...ctx.log, note: () => {}, timed: (_name, fn) => { const result = fn(); pending = Promise.resolve(result); return result; } } });
  ctx.fitted.loaded(); await pending; const baseline = await valuate(sneakers, ctx);
  const read = fs.readFile; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof read>) => { await gate; return read(...args); });
  now = 11;
  try {
    const result = await Promise.race([valuate(sneakers, ctx), new Promise<never>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('valuate waited for fitted refresh')), 1000); timer.unref();
    })]);
    assert.deepEqual(result, baseline);
  } finally { release(); await pending; }
});
