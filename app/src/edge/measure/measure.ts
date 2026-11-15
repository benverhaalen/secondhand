// Rests-on: backend plan me-1; spec/product.md goal, limits, experiment, arm;
// spec/determinations/listing-and-marketing.md D22. The plan's measure.md link describes a different feature.
import type { Log } from '../../../../log/index.js';
export interface Goal { month: string; target_cents: number; target_sales?: number }
export interface Limits { floor_cents: number; always_accept_cents?: number; ask_every_time: boolean }
export interface Experiment {
  id: string; user_id: string; site: string; category: string; factor: string;
  state: 'suggested' | 'chosen' | 'running' | 'ended';
  budget: { listings: number; price_floor_kept: boolean };
  arms: { id: string; design: 'matched_pair' | 'before_after'; variant: Record<string, unknown>; listing_ids: string[] }[];
  end_reason?: 'exploration_budget' | 'price_floor' | 'ranker_changed' | 'result_reached';
}
export interface MeasureStore {
  goal(user_id: string, month: string): Goal | undefined;
  putGoal(user_id: string, goal: Goal): void;
  limits(user_id: string, item_id: string): Limits | undefined;
  putLimits(user_id: string, item_id: string, limits: Limits): void;
  experiment(user_id: string, id: string): Experiment | undefined;
  // Atomic read/update: a Lakebase implementation locks the row for the callback.
  changeExperiment(user_id: string, id: string, fn: (current: Experiment | undefined) => Experiment): Experiment;
}
export function memoryMeasureStore(): MeasureStore {
  const goals = new Map<string, Goal>(), limits = new Map<string, Limits>(), experiments = new Map<string, Experiment>();
  const key = (user: string, id: string) => JSON.stringify([user, id]);
  return {
    goal: (u, m) => structuredClone(goals.get(key(u, m))), putGoal: (u, g) => { goals.set(key(u, g.month), structuredClone(g)); },
    limits: (u, i) => structuredClone(limits.get(key(u, i))), putLimits: (u, i, l) => { limits.set(key(u, i), structuredClone(l)); },
    experiment: (u, i) => structuredClone(experiments.get(key(u, i))),
    changeExperiment(u, i, fn) { const row = fn(structuredClone(experiments.get(key(u, i)))); experiments.set(key(u, i), structuredClone(row)); return structuredClone(row); },
  };
}
function integer(value: number, name: string, min = 0) { if (!Number.isSafeInteger(value) || value < min) throw new Error(`invalid ${name}`); }
export function measure(store: MeasureStore, log: Log) {
  const change = (user_id: string, id: string, fn: (e: Experiment | undefined) => Experiment) => {
    const row = store.changeExperiment(user_id, id, fn);
    log.event('state.change', { entity: 'experiment', id, to: row.state, reason: row.end_reason });
    return row;
  };
  return {
    goal: (user_id: string, month: string) => store.goal(user_id, month),
    limits: (user_id: string, item_id: string) => store.limits(user_id, item_id),
    putGoal(user_id: string, goal: Goal) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(goal.month)) throw new Error('invalid month');
      integer(goal.target_cents, 'target_cents', 1);
      if (goal.target_sales !== undefined) integer(goal.target_sales, 'target_sales', 1);
      store.putGoal(user_id, goal);
      log.event('state.change', { entity: 'goal', id: `${user_id}:${goal.month}`, to: 'active' });
    },
    putLimits(user_id: string, item_id: string, limits: Limits) {
      integer(limits.floor_cents, 'floor_cents');
      if (limits.always_accept_cents !== undefined) { integer(limits.always_accept_cents, 'always_accept_cents'); if (limits.always_accept_cents < limits.floor_cents) throw new Error('always_accept below floor'); }
      store.putLimits(user_id, item_id, limits);
      log.event('state.change', { entity: 'limits', id: item_id, to: 'set', user_id });
    },
    start(experiment: Experiment, approval: { experiments_consent: boolean; join_experiment: boolean }) {
      if (!approval.experiments_consent || !approval.join_experiment) throw new Error('consent and join_experiment approval required');
      if (experiment.state !== 'chosen') throw new Error('experiment not chosen');
      integer(experiment.budget.listings, 'budget.listings', 2);
      if (!experiment.budget.price_floor_kept) throw new Error('price floor required');
      const arms = experiment.arms;
      if (arms.length < 2 || !arms.some(a => a.variant.holdout === true) || !arms.some(a => a.variant.holdout !== true)) throw new Error('holdout and treatment required');
      if (new Set(arms.map(a => a.id)).size !== arms.length || arms.some(a => a.listing_ids.length)) throw new Error('invalid initial arms');
      return change(experiment.user_id, experiment.id, existing => {
        if (existing) throw new Error('experiment already exists');
        return { ...structuredClone(experiment), state: 'running' };
      });
    },
    allocate(user_id: string, id: string, arm_id: string, listing_id: string, price_cents: number, floor_cents: number) {
      integer(price_cents, 'price_cents'); integer(floor_cents, 'floor_cents');
      let allocated = false;
      const experiment = change(user_id, id, e => {
        if (!e) throw new Error('not_found');
        const arm = e.arms.find(a => a.id === arm_id);
        if (!arm) throw new Error('arm not_found');
        const assigned = e.arms.find(a => a.listing_ids.includes(listing_id));
        if (assigned && assigned.id !== arm_id) throw new Error('listing already assigned');
        if (assigned || e.state === 'ended') return e;
        if (e.state !== 'running') throw new Error('experiment not running');
        if (price_cents < floor_cents) return { ...e, state: 'ended', end_reason: 'price_floor' };
        const count = e.arms.reduce((n, a) => n + a.listing_ids.length, 0);
        if (count >= e.budget.listings) return { ...e, state: 'ended', end_reason: 'exploration_budget' };
        const prospective = e.arms.map(a => ({ ...a, listing_ids: a.id === arm_id ? [...a.listing_ids, listing_id] : a.listing_ids }));
        const missingGroups = [true, false].filter(holdout => !prospective.some(a => (a.variant.holdout === true) === holdout && a.listing_ids.length));
        if (e.budget.listings - count - 1 < missingGroups.length) throw new Error('holdout and treatment allocation required within budget');
        arm.listing_ids.push(listing_id); allocated = true;
        if (count + 1 === e.budget.listings) { e.state = 'ended'; e.end_reason = 'exploration_budget'; }
        return e;
      });
      return { allocated, experiment };
    },
    stop(user_id: string, id: string, reason: Experiment['end_reason']) {
      return change(user_id, id, e => { if (!e) throw new Error('not_found'); return { ...e, state: 'ended', end_reason: reason }; });
    },
  };
}
