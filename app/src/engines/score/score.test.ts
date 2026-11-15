import { test } from 'node:test';
import assert from 'node:assert/strict';
import { successScore, type ScoreInput } from './score.ts';
import { memoryStore } from '../param/param.ts';
function fixture(): ScoreInput {
  const params = memoryStore();
  params.declare({ name: 'score_bands', family: 'model_ref', prior: { cuts: [35, 60, 85] } });
  return { listing_id: 'l1', as_of: '2026-11-15T00:00:00Z', site: 'ebay', floor_cents: 4000, objective: 'balanced', plan_choice: 'sell',
    now: { expected_keep_cents: 4000, expected_days: 10, holding_cost_cents: 10 }, best: { expected_keep_cents: 5000, expected_days: 10, holding_cost_cents: 10 },
    axes: ['financial', 'quality', 'visibility', 'trend'].map(axis => ({ axis, state: 'shown', value: .8, citation_id: `citation:${axis}` })),
    basis: [{ id: 'sold1', source: 'fixture:sold', at: '2026-11-14', price_cents: 5000 }], params, log: { timed: (_n, fn) => fn() } };
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
