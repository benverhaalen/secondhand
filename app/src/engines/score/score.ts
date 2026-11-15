import { answer, guard, PROOF_PARAMS, type BasisRow } from '../proof/proof.ts';
import { memoryStore, type ParamStore } from '../param/param.ts';
import type { PlanChoice, Objective } from '../valuation/path.ts';

import { resolve } from './params.ts';
import { money, rounded } from './money.ts';

export type Utility = { expected_keep_cents: number; expected_days: number; holding_cost_cents: number };
export type Axis = { axis: string; state: 'shown' | 'hidden'; value: number | null; citation_id: string };
export type Change = { kind: 'markdown' | 'agent_revision'; price_cents?: number; projected: Utility };
export type ScoreInput = {
  listing_id: string; site: string; as_of: string; floor_cents: number; objective: Objective; plan_choice: PlanChoice;
  now: Utility; best: Utility; axes: Axis[]; basis: BasisRow[]; params?: ParamStore; person?: string; resolved?: ReturnType<typeof resolve>;
  receipt?: { keep_cents: number; refund_cents: number; days: number }; changes?: Change[];
  log: { timed: <T>(name: string, fn: () => T) => T };
};

function parts(u: Utility) {
  money(u.expected_keep_cents, 'expected_keep_cents'); money(u.holding_cost_cents, 'holding_cost_cents');
  if (!Number.isFinite(u.expected_days) || u.expected_days < 0) throw new RangeError('expected_days must be finite and nonnegative');
  const holding_cents = rounded(u.expected_days * u.holding_cost_cents, 'holding_cents');
  return { keep_cents: u.expected_keep_cents, days: u.expected_days, holding_cost_cents: u.holding_cost_cents, holding_cents, utility_cents: rounded(u.expected_keep_cents - holding_cents, 'utility_cents') };
}

export function successScore(x: ScoreInput) {
  return x.log.timed('score.success', () => {
    if (!Number.isSafeInteger(x.floor_cents) || x.floor_cents < 0) throw new RangeError('floor_cents must be a whole number of cents, zero or more');
    if (!Number.isFinite(Date.parse(x.as_of))) throw new RangeError('invalid as_of');
    for (const change of x.changes ?? []) {
      if (change.price_cents !== undefined) money(change.price_cents, 'price_cents');
      parts(change.projected);
    }
    const receipt = x.receipt;
    if (receipt) {
      money(receipt.keep_cents, 'keep_cents'); money(receipt.refund_cents, 'refund_cents');
      if (!Number.isFinite(receipt.days) || receipt.days < 0 || receipt.refund_cents > receipt.keep_cents) throw new RangeError('invalid sale receipt');
    }
    const now = parts(receipt ? { expected_keep_cents: receipt.keep_cents - receipt.refund_cents, expected_days: receipt.days, holding_cost_cents: x.now.holding_cost_cents } : x.now);
    const best = parts(x.best);
    const required = ['financial', 'quality', 'visibility', 'trend'];
    const hidden = required.some(name => !x.axes.some(a => a.axis === name && a.state === 'shown' && a.value !== null && Number.isFinite(a.value) && !!a.citation_id));
    const store = x.params ?? memoryStore();
    const resolved = x.resolved ?? resolve(store, {site: x.site, person: x.person});
    const versions = resolved.versions;
    const rules: Record<string, number> = {};
    for (const entry of PROOF_PARAMS) {
      store.declare(entry);
      const read = store.read(entry.name, {site: x.site});
      if (typeof read.value !== 'number' || !Number.isFinite(read.value) || read.value < 0) throw new RangeError(`invalid ${entry.name}`);
      rules[entry.name] = read.value; versions[entry.name] = read.version;
    }
    const guardRules = {min_n_eff: rules.proof_min_n_eff, max_age_days: rules.proof_max_age_days};
    const ratio = (u: number) => Math.round(Math.max(0, Math.min(100, 100 * u / best.utility_cents)));
    const raw = best.utility_cents > 0 ? ratio(now.utility_cents) : null;
    const proof = answer(raw ?? 0, x.basis, { metric: 'score.success', filters: { listing_id: x.listing_id, objective: x.objective, plan_choice: x.plan_choice }, table_versions: [], definition_version: 'score.success.U_now/U_best', code_version: 'ss-1', param_versions: versions, model_version: null }, x.as_of);
    const checked = guard(proof, guardRules);
    const state = hidden || raw === null || checked.state === 'hidden' ? 'hidden' as const : 'shown' as const;
    let band = 'still_learning';
    if (state === 'shown' && resolved.values.score_bands !== null) {
      const model = resolved.values.score_bands as { cuts?: unknown } | null;
      if (!model || !Array.isArray(model.cuts) || model.cuts.length !== 3 || !model.cuts.every(c => typeof c === 'number' && Number.isFinite(c))) throw new TypeError('invalid score_bands param');
      const cuts = model.cuts as number[];
      if (cuts[0] < 0 || cuts[2] > 100 || cuts[0] >= cuts[1] || cuts[1] >= cuts[2]) throw new RangeError('band thresholds must increase within [0,100]');
      band = raw! >= cuts[2] ? 'strong' : raw! >= cuts[1] ? 'on_track' : raw! >= cuts[0] ? 'needs_attention' : 'at_risk';
      if ((x.plan_choice === 'reserve' || x.plan_choice === 'check') && (band === 'needs_attention' || band === 'at_risk')) band = 'on_track';
    }
    const changes = state === 'hidden' ? [] : (x.changes ?? []).filter(c => c.kind !== 'markdown' && c.price_cents === undefined || (c.price_cents !== undefined && Number.isSafeInteger(c.price_cents) && c.price_cents >= x.floor_cents))
      .map(c => {
        const projected = parts(c.projected);
        return { ...c, projected: { expected_keep_cents: projected.keep_cents, expected_days: projected.days, holding_cost_cents: projected.holding_cost_cents }, points: ratio(projected.utility_cents) - raw!, proof: guard(answer(ratio(projected.utility_cents) - raw!, x.basis, { metric: 'score.change', filters: { kind: c.kind, price_cents: c.price_cents }, table_versions: [], definition_version: 'score.success.U_now/U_best', code_version: 'ss-1', param_versions: versions, model_version: null }, x.as_of), guardRules) };
      }).filter(c => c.points > 0 && c.proof.state === 'shown').sort((a, b) => b.points - a.points || a.kind.localeCompare(b.kind) || (a.price_cents ?? 0) - (b.price_cents ?? 0));
    return { subject_type: 'listing', subject_id: x.listing_id, site: x.site, axis: 'success', state, value: state === 'shown' ? raw : null,
      band, hide_reason: state === 'hidden' ? hidden ? 'axis_hidden' : checked.state === 'hidden' ? checked.hide_reason : 'nonpositive_best' : null,
      provisional: !receipt, parts: { now, best, axes: x.axes }, change: changes[0] ?? null,
      citation_id: proof.ok ? proof.citation.id : null, citation: proof.ok ? { ...proof.citation, param_versions: versions } : null, model_version: null };
  });
}
