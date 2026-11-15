import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, scoreCandidate, type MarketingInput, type MoneyCandidate } from './calc.ts';
import { memoryStore } from '../param/param.ts';
const as_of = '2026-11-15T00:00:00Z';
export const fixture = (site: MarketingInput['site'] = 'ebay'): MarketingInput => ({
  item: { item_id: 'i1', kind: 'clothing', attrs: { brand: { value: 'Patagonia', source: 'label', confirmed: true }, model: { value: 'Better Sweater', source: 'label', confirmed: true } }, photos: [{ photo_id: 'front', score: .9 }] },
  site, connected: true, category_allowed: true, fit: 'good', category_id: 'jacket', rows: [], objective: 'balanced',
  cover_style: 'flat_lay', position: [3, 8], floor_cents: 4200, midpoint_cents: 5300, adjusted_cents: [4400, 4800, 5100, 5400, 5800, 6200], weights: [1, 1, 1, 1, 1, 1], sales_12m: 38, sales_90d: 38,
  curve: { p: (_p, d) => 1 - Math.exp(-d / 20), t: (_p, q) => -20 * Math.log(1 - q) },
  keep: p => Math.round(.8675 * p - 40), shipping_modes: ['buyer_pays'], ship_cents: 850,
  metric_basis: Object.fromEntries(['position','shipping','sale_curve','time','alternatives'].map(metric => [metric,Array.from({length:6},(_,i) => ({id:`${metric}:${i}`,source:`fixture:${metric}`,at:'2026-11-15T00:00:00Z'}))])), comp_rows: Array.from({length:6}, (_,i) => ({ id: `c${i}`, source: 'sold:1', at: as_of, price_cents: 4800 })), as_of, params: memoryStore(),
  log: { timed: (_n, fn) => fn() },
});
const example: MoneyCandidate = { candidate_id: '54', objective: 'balanced', horizon_days: 30, shipping_mode: 'buyer_pays', path: [
  { price_cents: 5400, p_sale: .38, net_cents: 4644, at_day: 0 }, { price_cents: 4900, p_sale: .20, net_cents: 4211, at_day: 10 }, { price_cents: 4500, p_sale: .13, net_cents: 3864, at_day: 20 }], expected_days: 14 };
test('worked example selects $54 with $31.09 expected net and $29.61 utility', () => {
  const a = scoreCandidate(example, 1, 5300 * .002);
  assert.equal(a.e_net_cents, 3109); assert.equal(a.utility_cents, 2961);
  const x = fixture(); x.candidates = [example, { ...example, candidate_id: '59', path: [{ price_cents: 5900, p_sale: .25, net_cents: 5078, at_day: 0 }, { price_cents: 5400, p_sale: .20, net_cents: 4644, at_day: 10 }, { price_cents: 4900, p_sale: .14, net_cents: 4211, at_day: 20 }], expected_days: 18 }];
  const p = calculate(x); assert.equal(p.verdict, 'list'); assert.equal(p.price?.start_cents, 5400);
});
test('forbidden lever and missing provenance fail with their cause', () => {
  assert.equal(calculate({ ...fixture('poshmark'), requested_levers: ['relist'] }).suggestions?.[0]?.kind, 'repost');
  assert.throws(() => calculate({ ...fixture(), comp_rows: [{ id: 'c1', source: '', at: as_of }] }), /basis/);
});
test('planted path and likers offer below the floor cannot execute', () => {
  const x = fixture(); x.candidates = [{ ...example, path: [...example.path, { price_cents: 100, p_sale: .1, net_cents: 1, at_day: 25 }] }];
  const p = calculate(x); assert.equal(p.verdict, 'skip');
  const safe = calculate({ ...fixture('poshmark'), floor_cents: 6100 });
  assert.ok(safe.price?.path.every(r => r.price_cents >= 6100));
  assert.equal(safe.standing?.offers_to_likers.on, false);
  assert.equal(safe.standing?.relist.allowed, false);
});
test('fixed gates and sales minimum abstain before scoring', () => {
  assert.equal(calculate({ ...fixture(), connected: false }).skip_reason, 'not_connected');
  assert.equal(calculate({ ...fixture(), sales_12m: 5, sales_90d: 1 }).price, null);
  assert.equal(calculate({ ...fixture(), category_allowed: false }).skip_reason, 'site_bars_category');
});
test('same inputs reconstruct the same citation and plan', () => {
  const x = fixture(); assert.deepEqual(calculate(x), calculate(x));
});

test('the final price rung keeps selling through the full horizon', () => {
  const x = fixture(); x.adjusted_cents = [5000]; x.weights = [1];
  x.curve = { p: (_p, d) => 1 - Math.exp(-d / 20), t: () => 20 * Math.log(2) };
  const plan = calculate(x);
  assert.equal(plan.verdict, 'list'); assert.ok('scores' in plan); assert.ok(plan.scores); assert.ok(Math.abs(plan.scores.p_sale.d30! - (1 - Math.exp(-30 / 20))) < 1e-9);
});
test('greater visibility lowers holding time using the same survival curve', () => {
  const curve = { p: (_p: number, d: number) => 1 - Math.exp(-d / 20), t: () => 14 };
  const c: MoneyCandidate = { candidate_id: 'one', objective: 'balanced', horizon_days: 30, shipping_mode: 'buyer_pays', path: [{ price_cents: 5000, net_cents: 4000, p_sale: curve.p(5000, 30), at_day: 0 }], expected_days: 16 };
  const base = scoreCandidate(c, 1, 10, curve), visible = scoreCandidate(c, 2, 10, curve);
  assert.ok(visible.expected_days < base.expected_days); assert.ok(visible.p_sale > base.p_sale);
});

test('Poshmark liker offers stay off without the required shipping discount', () => {
  const x = fixture('poshmark');
  assert.equal(calculate(x).standing?.offers_to_likers.on, false);
  const offered = calculate({ ...x, shipping_discount_cents: 200 }).standing?.offers_to_likers;
  assert.equal(offered?.cooldown_days, 'unknown');
  assert.equal(offered?.on, false);
});

test('F3: bundle is enabled only where a sourced bundle lever exists', () => {
  for (const site of ['ebay', 'mercari', 'facebook'] as const)
    assert.equal(calculate(fixture(site)).standing?.bundle.on, false, site);
  assert.equal(calculate(fixture('poshmark')).standing?.bundle.on, true);
});
test('F3: Poshmark liker discount and seller shipping together preserve net floor', () => {
  const x = { ...fixture('poshmark'), floor_cents: 4200, ship_cents: 2000, shipping_discount_cents: 2000, keep: (p: number) => Math.round(.8 * p) };
  const out = calculate(x);
  const offer = out.standing?.offers_to_likers;
  assert.ok(offer);
  assert.ok(!offer.on || x.keep(offer.amount_cents!) - offer.shipping_discount_cents >= x.keep(x.floor_cents));
});

test('F8: fractional shipping cents are refused on every site', () => {
  for (const site of ['ebay', 'poshmark'] as const) {
    assert.throws(() => calculate({ ...fixture(site), ship_cents: 850.5 }), /whole cents/);
    assert.throws(() => calculate({ ...fixture(site), shipping_discount_cents: .5 }), /whole cents/);
  }
});

test('D1 requires both sale minimums', () => {
  for (const [sales_12m, sales_90d] of [[5, 2], [6, 1]]) assert.equal(calculate({ ...fixture(), sales_12m, sales_90d }).verdict, 'skip');
});
test('liker offers compare keep with keep at the floor in the same shipping mode', () => {
  const x = { ...fixture('ebay'), candidates: [{ ...example, path: [{ price_cents: 5400, net_cents: 4320, p_sale: .8, at_day: 0 }] }], shipping_discount_cents: 100, keep: (p: number) => Math.round(p * .8) };
  assert.equal(calculate(x).standing?.offers_to_likers.on, true);
  assert.equal(calculate({ ...x, shipping_discount_cents: 800 }).standing?.offers_to_likers.on, false);
});
test('candidate costs and path clocks refuse invalid inputs', () => {
  for (const cost of [-1, NaN, Infinity]) assert.throws(() => scoreCandidate(example, 1, cost), /holding_cost/);
  for (const at_day of [-1, NaN, 31]) assert.throws(() => scoreCandidate({ ...example, path: [{ ...example.path[0], at_day }] }, 1, 1), /at_day/);
  assert.throws(() => scoreCandidate({ ...example, path: [example.path[1], example.path[0]] }, 1, 1), /at_day/);
});
test('visibility refuses an absent denominator and tied presentation is deterministic', () => {
  const a = { visibility: 1, views: 10, comp_views: 10, cover_id: 'a', title_form: 'a' };
  const b = { ...a, cover_id: 'b', title_form: 'b', views: 15 };
  assert.throws(() => calculate({ ...fixture(), presentation: [{ ...a, comp_views: 0 }] }), /comp_views/);
  assert.deepEqual(calculate({ ...fixture(), presentation: [a,b] }), calculate({ ...fixture(), presentation: [b,a] }));
});
test('cooldowns come from the site; Poshmark engagement is handed to the person', () => {
  const out = calculate({ ...fixture('poshmark'), requested_levers: ['share', 'like', 'repost'] });
  assert.equal(out.standing?.relist.allowed, false);
  assert.equal(out.suggestions?.length, 3);
  assert.ok(out.suggestions?.every(s => s.handoff && s.site === 'poshmark' && s.reason));
  assert.equal(calculate(fixture('ebay')).standing?.offers_to_likers.cooldown_days, 2);
  assert.equal(calculate(fixture('facebook')).standing?.offers_to_likers.cooldown_days, null);
});

test('marketing executes valuation ladder endings and drift', async () => {
  const {ladder} = await import('../valuation/path.ts');
  const x = {...fixture(), drift: .05, ending:{above_cents:2000,digits:[5,8]}};
  const expected = ladder(x.adjusted_cents,x.weights,x.ending,x.drift);
  const out = calculate(x);
  assert.ok(out.price?.path.every(r => expected.includes(r.price_cents)));
});
test('unsupported proof hides the plan and every metric has its own guard and citation', () => {
  const x = fixture();
  assert.equal(calculate({...x,comp_rows:x.comp_rows.slice(0,1)}).verdict,'skip');
  assert.equal(calculate({...x,as_of:'2030-01-01'}).verdict,'skip');
  const out = calculate(x);
  assert.equal(out.metrics?.e_net_cents.state,'shown');
  assert.notEqual(out.metrics?.utility_cents.citation?.id,out.metrics?.e_net_cents.citation?.id);
});

test('scoped params replace visibility and timing priors and are cited', async () => {
  const {resolve, DECLARED} = await import('./params.ts');
  const x = fixture(); const scope = {site:x.site,segment:x.category_id}; resolve(x.params!,scope);
  for (const [name,value] of [['marketing_vis_exponent',0],['marketing_timing_min_n',1],['marketing_timing_horizon_h',100]] as const) {
    const entry = DECLARED.find(e => e.name === name)!;
    const row = x.params!.propose({...entry,scope,value_or_hyperparams:value,prior:entry.prior,n_eff:100,fitted_on_ids_hash:null,metric:'utility',held_out_score:1,guard_lo:null,guard_hi:null},0);
    x.params!.promote(name,scope,row.version,0,x.as_of);
  }
  const out = calculate({...x,person:'owner',presentation:[{visibility:1,views:100,comp_views:10,cover_id:'a',title_form:'a'}],timing:{n:2,lift:2,noise:1,peak_at:'2026-11-18T10:00:00Z'}});
  assert.equal(out.list_at,'2026-11-18T10:00:00Z');
  assert.equal(out.citation?.param_versions.marketing_vis_exponent,1);
  assert.equal(out.metrics?.e_net_cents.citation?.param_versions.marketing_timing_horizon_h,1);
});
test('candidate money refuses fractional or unsafe cents by field', () => {
  for (const field of ['price_cents','net_cents'] as const) for (const value of [.5,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])
    assert.throws(() => scoreCandidate({...example,path:[{...example.path[0],[field]:value}]},1,1),new RegExp(field));
});

test('fresh sold comps cannot certify absent or stale rank evidence', () => {
  const x = fixture();
  const out = calculate({...x, metric_basis:{...x.metric_basis,position:[]}});
  assert.equal(out.metrics?.position.state,'hidden');
  assert.equal(out.scores?.position,null);
});

test('all alternative quantities require the alternative model basis', () => {
  const x = fixture(); const out = calculate({...x,metric_basis:{...x.metric_basis,alternatives:[]}});
  assert.deepEqual(out.alternatives,[]);
  assert.ok(out.metrics?.alternatives.every(a => a.p_sale.state === 'hidden' && a.tts_days.every(t => t === null || t.state === 'hidden')));
});
