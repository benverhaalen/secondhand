import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from './param/param.ts';
import { onSoldComp, onExposure, velocity } from './demand/velocity.ts';
import { onOurSale, qg, calibrationForCheck } from './valuation/aci.ts';
import { check, type CheckInput } from './valuation/check.ts';
import { staleStep, type StaleInput } from './valuation/path.ts';
import { onStats, interest } from './marketing/interest.ts';
import { createLog, memorySink } from '../../../log/index.js';

const start = '2026-08-01T00:00:00Z';
const day = (n: number) => new Date(Date.parse(start) + n * 86_400_000).toISOString();

test('sold comps change the next velocity; eight-week-old evidence loses half its weight', () => {
  const store = memoryStore(), product = { kind: 'apparel', product_id: 'p1' };
  const before = velocity(store, product, start);
  for (let i = 1; i <= 6; i++) {
    const at = day(i * 2);
    onExposure(store, product, 2 / 6, at);
    onSoldComp(store, product, at);
    assert.ok(velocity(store, product, at).mean > before.mean, `comp ${i} must affect the next read`);
  }
  const after = velocity(store, product, day(12));
  assert.ok(after.mean > before.mean);
  assert.ok(after.p90 - after.p10 < before.p90 - before.p10, 'observed exposure narrows the posterior');
  const row = store.rows('demand_velocity', { kind: product.kind, segment: product.product_id }).find(r => r.status === 'champion')!;
  const faded = velocity(store, product, day(68));
  const raw = row.value_or_hyperparams as { shape: number; rate: number };
  const rate = 2 + (raw.rate - 2) * .5;
  const shape = 4 + (raw.shape - 4) * .5;
  const expected = (row.n_eff * .5 * shape / rate + 20 * before.mean) / (row.n_eff * .5 + 20);
  assert.ok(Math.abs(faded.mean - expected) <= 1e-12);
  assert.ok(faded.mean > before.mean && faded.mean < after.mean, 'quiet time decays the rise toward the kind');
  assert.deepEqual(velocity(store, product, day(68)), faded, 'repeating a read must not forget twice');
  onExposure(store, product, 0, day(68));
  const retained = store.read('demand_velocity', { kind: product.kind, segment: product.product_id }).n_eff / row.n_eff;
  assert.ok(Math.abs(retained - .5) <= 1e-12, `one eight-week half-life retains ${retained}`);
});

function checkInput(): CheckInput {
  return {
    product_id: 'p1', condition: 'good', as_of: day(1), floor_cents: 0, objective: 'balanced', param_version: 0,
    warm_comps: Array.from({ length: 8 }, (_, i) => ({ comp_id: `c${i}`, site: 'ebay', sold_at: start,
      price_cents: 4000 + 100 * i, kind: 'sold', level: 'variant', condition: 'good', w_match: 1, w_extract: 1,
      may_model: true, citation: `fixture:c${i}` })),
    sources: [], sites: [], log: { timed: (_name, fn) => fn(), error: (_where, error) => { throw error; } },
  };
}

test('our sales persist ACI and log scores; the next existing Check widens and then recovers', async () => {
  const store = memoryStore(), group = { kind: 'apparel' };
  const initial = qg(store, group);
  const base = await check(checkInput());
  assert.ok(base.range.q10 !== null && base.range.q90 !== null);
  const issued = { q10: base.range.q10, q90: base.range.q90 };
  for (let i = 0; i < 30; i++) {
    onOurSale(store, group, issued, 6000 + i * 100, day(i / 100));
    assert.ok(qg(store, group) > initial, `sale ${i} must be visible immediately`);
  }
  const missed = qg(store, group);
  const wide = await check({ ...checkInput(), calibration: calibrationForCheck(store, group, issued) });
  assert.ok(wide.range.q10! < base.range.q10! && wide.range.q90! > base.range.q90!);
  for (let i = 0; i < 30; i++) onOurSale(store, group, issued, base.range.q50!, day(1 + i / 100));
  assert.ok(qg(store, group) < missed, 'inside sales reduce the weighted conformal quantile');
  const recovered = await check({ ...checkInput(), calibration: calibrationForCheck(store, group, issued) });
  assert.ok(recovered.range.q90! - recovered.range.q10! < wide.range.q90! - wide.range.q10!);
});

test('three days of weak view counts change standing and the next stale decision; recovery reverses it', async () => {
  const store = memoryStore(), band = { kind: 'apparel', site: 'ebay' }, listing = { ...band, listing_id: 'li_1' };
  onStats(store, band, 2400, 240, start);
  const before = interest(store, listing, start);
  assert.equal(before.standing, 'on_plan');
  const rate = velocity(store, { kind: listing.kind, product_id: 'p1' }, start).mean;
  // The synthetic fixture uses §3's Poisson rate; seven converts its weeks to days.
  const curve = { p: (_price: number, days: number) => 1 - Math.exp(-rate * days / 7),
    t: (_price: number, q: number) => -Math.log1p(-q) / rate * 7 };
  const priced = await check({ ...checkInput(), sites: [{ site: 'ebay', curve }] });
  assert.ok(priced.price_path && priced.range.q50 !== null);
  const plan = priced.price_path;
  const next = plan.ladder.find(r => r.price < plan.list);
  assert.ok(next);
  const stale = (read: ReturnType<typeof interest>) => staleStep({
    site: 'ebay', age_days: curve.t(plan.start, .5), m_days: curve.t(plan.start, .5),
    price_cents: plan.list, p50_cents: priced.range.q50!,
    interest: read.mean, interest_median: read.interest_median, next_rung_cents: next.price, floor_cents: plan.floor,
    on_sites: priced.best_sites, best_sites: priced.best_sites, has_watchers_verb: false,
  } satisfies StaleInput);
  assert.equal(stale(before).kind, 'none');
  for (let i = 1; i <= 3; i++) onStats(store, listing, 1, 24, day(i));
  const behind = interest(store, listing, day(3));
  assert.equal(behind.standing, 'behind');
  assert.equal(stale(behind).kind, 'markdown');
  onStats(store, listing, 20_000, 24, day(4));
  const recovered = interest(store, listing, day(4));
  assert.equal(recovered.standing, 'ahead');
  assert.equal(stale(recovered).kind, 'none');
});

test('event inputs, resulting registry versions, and errors can be replayed through log/', () => {
  const sink = memorySink(), log = createLog({ src: 'engine.realtime', build: 'test', sink, seed: 1 });
  const store = memoryStore();
  onSoldComp(store, { kind: 'apparel', product_id: 'p1' }, start, log);
  onExposure(store, { kind: 'apparel', product_id: 'p1' }, 1, start, log);
  onOurSale(store, { kind: 'apparel' }, { q10: 4000, q90: 5000 }, 6000, start, log);
  onStats(store, { kind: 'apparel', site: 'ebay', listing_id: 'li_1' }, 10, 24, start, log);
  assert.throws(() => onStats(store, { kind: 'apparel' }, -1, 24, start, log), /views/);
  log.end();
  const lines = sink.lines.map(line => JSON.parse(line) as { event: string; msg?: string; result?: { applied: boolean } });
  assert.equal(lines.filter(line => line.event === 'error').length, 1);
  for (const name of ['demand.onSoldComp', 'demand.onExposure', 'valuation.onOurSale', 'marketing.onStats']) {
    assert.ok(lines.some(line => line.msg === name + '.input'), name + ' input');
    assert.ok(lines.some(line => line.msg === name + '.result' && line.result?.applied), name + ' state change');
  }
});
