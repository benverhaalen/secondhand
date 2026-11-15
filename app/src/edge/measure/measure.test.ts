import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { measure, memoryMeasureStore, type Experiment } from './measure.ts';
const sink = memorySink();
const log = createLog({ src: 'test.measure', build: 'test', sink });
const experiment = (): Experiment => ({ id: 'ex_1', user_id: 'usr_1', site: 'depop', category: 'apparel', factor: 'cover', state: 'chosen', budget: { listings: 2, price_floor_kept: true }, arms: [{ id: 'arm_control', design: 'matched_pair', variant: { holdout: true }, listing_ids: [] }, { id: 'arm_change', design: 'matched_pair', variant: { cover: 'worn' }, listing_ids: [] }] });
function rig() { const store = memoryMeasureStore(); return { store, m: measure(store, log) }; }
test('goals and limits persist per person without leaking or sharing mutable references', () => {
  const { m } = rig();
  m.putGoal('usr_1', { month: '2026-11', target_cents: 40000 });
  m.putLimits('usr_1', 'it_1', { floor_cents: 3000, always_accept_cents: 4000, ask_every_time: false });
  assert.equal(m.goal('usr_1', '2026-11')?.target_cents, 40000);
  assert.equal(m.goal('usr_2', '2026-11'), undefined);
  assert.equal(m.limits('usr_2', 'it_1'), undefined);
  const limits = m.limits('usr_1', 'it_1')!; limits.floor_cents = 1;
  assert.equal(m.limits('usr_1', 'it_1')?.floor_cents, 3000);
});
test('refused: an experiment without a holdout or consent cannot start', () => {
  const { m } = rig(); const e = experiment(); e.arms[0].variant = {};
  assert.throws(() => m.start(e, { experiments_consent: true, join_experiment: true }), /holdout/);
  assert.throws(() => m.start(experiment(), { experiments_consent: false, join_experiment: true }), /consent/);
});
test('stops: the exploration limit ends the experiment with no further allocations', () => {
  const { m } = rig(); m.start(experiment(), { experiments_consent: true, join_experiment: true });
  assert.equal(m.allocate('usr_1', 'ex_1', 'arm_control', 'li_1', 4000, 3000).allocated, true);
  const last = m.allocate('usr_1', 'ex_1', 'arm_change', 'li_2', 4000, 3000);
  assert.equal(last.experiment.state, 'ended');
  assert.equal(last.experiment.end_reason, 'exploration_budget');
  assert.equal(m.allocate('usr_1', 'ex_1', 'arm_change', 'li_3', 4000, 3000).allocated, false);
});
test('stops: below-floor assignment ends the experiment without changing a listing', () => {
  const { m } = rig(); m.start(experiment(), { experiments_consent: true, join_experiment: true });
  const result = m.allocate('usr_1', 'ex_1', 'arm_change', 'li_1', 2999, 3000);
  assert.equal(result.allocated, false);
  assert.equal(result.experiment.end_reason, 'price_floor');
  assert.deepEqual(result.experiment.arms[1].listing_ids, []);
});
test('retries do not consume budget twice, cross-arm or foreign allocations fail', () => {
  const { m } = rig(); m.start(experiment(), { experiments_consent: true, join_experiment: true });
  m.allocate('usr_1', 'ex_1', 'arm_control', 'li_1', 4000, 3000);
  assert.equal(m.allocate('usr_1', 'ex_1', 'arm_control', 'li_1', 4000, 3000).allocated, false);
  assert.throws(() => m.allocate('usr_1', 'ex_1', 'arm_change', 'li_1', 4000, 3000), /already assigned/);
  assert.throws(() => m.allocate('usr_2', 'ex_1', 'arm_control', 'li_2', 4000, 3000), /not_found/);
});
test('invalid money, month and an always-accept below floor are rejected', () => {
  const { m } = rig();
  assert.throws(() => m.putGoal('usr_1', { month: '2026-13', target_cents: 100 }), /month/);
  assert.throws(() => m.putLimits('usr_1', 'it_1', { floor_cents: 1000, always_accept_cents: 900, ask_every_time: false }), /floor/);
});
test('budget cannot be exhausted entirely in treatment while the holdout stays empty', () => {
  const { m } = rig(); m.start(experiment(), { experiments_consent: true, join_experiment: true });
  m.allocate('usr_1', 'ex_1', 'arm_change', 'li_1', 4000, 3000);
  assert.throws(() => m.allocate('usr_1', 'ex_1', 'arm_change', 'li_2', 4000, 3000), /holdout/);
  assert.equal(m.allocate('usr_1', 'ex_1', 'arm_control', 'li_2', 4000, 3000).experiment.state, 'ended');
});

after(() => { assert.deepEqual(checkLog([['measure', sink.text()]]).problems, []); });
