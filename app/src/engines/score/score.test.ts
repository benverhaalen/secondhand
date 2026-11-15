import { test } from 'node:test';
import assert from 'node:assert/strict';
import { successScore, type ScoreInput } from './score.ts';
import { memoryStore } from '../param/param.ts';
function fixture(): ScoreInput {
  const params = memoryStore();
  params.declare({ name: 'score_bands', family: 'model_ref', prior: null });
  const model = params.propose({ name: 'score_bands', scope: {site:'ebay'}, family: 'model_ref', value_or_hyperparams: {cuts:[35,60,85]}, prior:null, fitted_on_ids_hash:null, n_eff:100, metric:'brier', held_out_score:0, guard_lo:null, guard_hi:null }, 0);
  params.promote('score_bands', {site:'ebay'}, model.version, 0, '2026-11-15');
  return { listing_id: 'l1', as_of: '2026-11-15T00:00:00Z', site: 'ebay', floor_cents: 4000, objective: 'balanced', plan_choice: 'sell',
    now: { expected_keep_cents: 4000, expected_days: 10, holding_cost_cents: 10 }, best: { expected_keep_cents: 5000, expected_days: 10, holding_cost_cents: 10 },
    axes: ['financial', 'quality', 'visibility', 'trend'].map(axis => ({ axis, state: 'shown', value: .8, citation_id: `citation:${axis}` })),
    basis: Array.from({length:6}, (_,i) => ({ id: `sold${i}`, source: 'fixture:sold', at: '2026-11-14', price_cents: 5000 })), params, log: { timed: (_n, fn) => fn() } };
}
test('no sale yet is provisional and score opens to utility parts and citations', () => {
  const out = successScore(fixture()); assert.equal(out.state, 'shown'); assert.equal(out.provisional, true);
  assert.equal(out.value, Math.round(100 * 3900 / 4900));
  assert.equal(out.parts.now.keep_cents, 4000); assert.equal(out.parts.now.holding_cents, 100); assert.ok(out.citation_id);
});
test('refund rescored from net kept and actual days', () => {
  const x = fixture(); x.receipt = { keep_cents: 5000, refund_cents: 0, days: 10 };
  const before = successScore(x); const after = successScore({ ...x, receipt: { ...x.receipt, refund_cents: 2000 } });
  assert.equal(before.provisional, false); assert.ok(after.value! < before.value!); assert.equal(after.parts.now.keep_cents, 3000);
});
test('a hidden axis hides the combined score and band', () => {
  const x = fixture(); x.axes[2].state = 'hidden';
  const out = successScore(x); assert.equal(out.state, 'hidden'); assert.equal(out.value, null); assert.equal(out.band, 'still_learning');
});
test('best unavailable or missing axis cannot publish a number', () => {
  const x = fixture(); x.best.expected_keep_cents = 0;
  assert.equal(successScore(x).value, null);
  assert.equal(successScore({ ...fixture(), axes: [] }).value, null);
});
test('planted price fix below floor is never recommended', () => {
  const x = fixture(); x.changes = [{ kind: 'markdown', price_cents: 100, projected: { ...x.best } }, { kind: 'agent_revision', projected: { ...x.best, expected_keep_cents: 4800 } }];
  const out = successScore(x); assert.equal(out.change?.kind, 'agent_revision');
});
test('reserve and checking intent never gets attention or risk bands', () => {
  const x = fixture(); x.now.expected_keep_cents = 500;
  assert.equal(successScore({ ...x, plan_choice: 'reserve' }).band, 'on_track');
});
test('invalid net or reversed band thresholds name the cause', () => {
  assert.throws(() => successScore({ ...fixture(), now: { expected_keep_cents: NaN, expected_days: 1, holding_cost_cents: 1 } }), /finite/);
});

test('F7: an invalid floor cannot authorize a markdown to zero', () => {
  for (const floor_cents of [-1, NaN, Infinity, .5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
    const x = { ...fixture(), floor_cents } as ScoreInput;
    x.changes = [{ kind: 'markdown', price_cents: 0, projected: x.best }];
    assert.throws(() => successScore(x), /floor_cents must be a whole number/);
  }
  assert.equal(successScore({ ...fixture(), floor_cents: 0 }).state, 'shown');
});

test('fractional money in utility and projections refuses with its field', () => {
  for (const field of ['expected_keep_cents', 'holding_cost_cents']) {
    const x = fixture();
    assert.throws(() => successScore({...x, now: {...x.now, [field]: .5}}), new RegExp(field));
    assert.throws(() => successScore({...x, changes:[{kind:'agent_revision', projected:{...x.best, [field]: .5}}]}), new RegExp(field));
  }
});

test('thin and stale proof hide success and projections', () => {
  const x = fixture();
  assert.equal(successScore({ ...x, basis: x.basis.slice(0, 1) }).state, 'hidden');
  assert.equal(successScore({ ...x, basis: Array.from({length: 6}, (_,i) => ({id: `old${i}`, source: 'sold', at: '2020-01-01'})) }).state, 'hidden');
});
test('markdown needs a price and tied changes use kind then price', () => {
  const x = fixture();
  assert.equal(successScore({ ...x, changes: [{kind: 'markdown', projected: x.best}] }).change, null);
  const changes = [{kind: 'markdown' as const, price_cents: 4500, projected: x.best}, {kind: 'agent_revision' as const, projected: x.best}];
  assert.deepEqual(successScore({...x, changes}).change, successScore({...x, changes: [...changes].reverse()}).change);
});

test('invalid change money refuses at the boundary even with hidden axes', () => {
  const x = fixture();
  for (const price_cents of [-1,.5,NaN,Infinity]) assert.throws(() => successScore({...x,axes:[],changes:[{kind:'markdown',price_cents,projected:x.best}]}),/price_cents/);
});
test('proof guard reads champion thresholds and records their versions', () => {
  const x = fixture();
  x.params!.declare({name:'proof_min_n_eff',family:'scalar',prior:6});
  const row = x.params!.propose({name:'proof_min_n_eff',family:'scalar',scope:{site:x.site},value_or_hyperparams:1,prior:6,n_eff:10,fitted_on_ids_hash:null,metric:'coverage',held_out_score:1,guard_lo:0,guard_hi:null},0);
  x.params!.promote(row.name,row.scope,row.version,0,x.as_of);
  const out = successScore({...x,basis:x.basis.slice(0,1)});
  assert.equal(out.state,'shown'); assert.equal(out.citation?.param_versions.proof_min_n_eff,1);
});
