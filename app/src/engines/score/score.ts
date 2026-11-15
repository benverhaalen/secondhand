import { answer, type BasisRow } from '../proof/proof.ts';
import type { ParamStore } from '../param/param.ts';
import type { PlanChoice, Objective } from '../valuation/path.ts';

export type Utility = { expected_keep_cents: number; expected_days: number; holding_cost_cents: number };
export type Axis = { axis: string; state: 'shown' | 'hidden'; value: number | null; citation_id: string };
export type Change = { kind: 'markdown' | 'agent_revision'; price_cents?: number; projected: Utility };
export type ScoreInput = {
  listing_id: string; site: string; as_of: string; floor_cents: number; objective: Objective; plan_choice: PlanChoice;
  now: Utility; best: Utility; axes: Axis[]; basis: BasisRow[]; params: ParamStore;
  receipt?: { keep_cents: number; refund_cents: number; days: number }; changes?: Change[];
  log: { timed: <T>(name: string, fn: () => T) => T };
};

function parts(u: Utility) {
  if (!Object.values(u).every(Number.isFinite) || u.expected_days < 0 || u.holding_cost_cents < 0) throw new RangeError('utility must be finite with nonnegative time and cost');
  const holding_cents = u.expected_days * u.holding_cost_cents;
  return { keep_cents: Math.round(u.expected_keep_cents), days: u.expected_days, holding_cost_cents: Math.round(u.holding_cost_cents), holding_cents: Math.round(holding_cents), utility_cents: Math.round(u.expected_keep_cents - holding_cents) };
}

export function successScore(x: ScoreInput) {
  return x.log.timed('score.success', () => {
    if (!Number.isSafeInteger(x.floor_cents) || x.floor_cents < 0) throw new RangeError('floor_cents must be a whole number of cents, zero or more');
    const receipt = x.receipt;
    if (receipt && (!Object.values(receipt).every(Number.isFinite) || receipt.refund_cents < 0 || receipt.days < 0)) throw new RangeError('invalid sale receipt');
    const now = parts(receipt ? { expected_keep_cents: receipt.keep_cents - receipt.refund_cents, expected_days: receipt.days, holding_cost_cents: x.now.holding_cost_cents } : x.now);
    const best = parts(x.best);
    const required = ['financial', 'quality', 'visibility', 'trend'];
    const hidden = required.some(name => !x.axes.some(a => a.axis === name && a.state === 'shown' && a.value !== null && Number.isFinite(a.value) && !!a.citation_id));
    const versions: Record<string, number> = {};
    const ratio = (u: number) => Math.round(Math.max(0, Math.min(100, 100 * u / best.utility_cents)));
    const raw = best.utility_cents > 0 ? ratio(now.utility_cents) : null;
    const proof = answer(raw ?? 0, x.basis, { metric: 'score.success', filters: { listing_id: x.listing_id, objective: x.objective, plan_choice: x.plan_choice }, table_versions: [], definition_version: 'score.success.U_now/U_best', code_version: 'ss-1', param_versions: versions, model_version: null }, x.as_of);
    const state = hidden || raw === null || !proof.ok ? 'hidden' as const : 'shown' as const;
    let band = 'still_learning';
    if (state === 'shown') {
      const bands = x.params.read('score_bands', { site: x.site });
      versions.score_bands = bands.version;
      const model = bands.value as { cuts?: unknown } | null;
      if (!model || !Array.isArray(model.cuts) || model.cuts.length !== 3 || !model.cuts.every(c => typeof c === 'number' && Number.isFinite(c))) throw new TypeError('invalid score_bands param');
      const cuts = model.cuts as number[];
      if (cuts[0] < 0 || cuts[2] > 100 || cuts[0] >= cuts[1] || cuts[1] >= cuts[2]) throw new RangeError('band thresholds must increase within [0,100]');
      band = raw! >= cuts[2] ? 'strong' : raw! >= cuts[1] ? 'on_track' : raw! >= cuts[0] ? 'needs_attention' : 'at_risk';
      if ((x.plan_choice === 'reserve' || x.plan_choice === 'check') && (band === 'needs_attention' || band === 'at_risk')) band = 'on_track';
    }
    const changes = state === 'hidden' ? [] : (x.changes ?? []).filter(c => c.price_cents === undefined || (Number.isSafeInteger(c.price_cents) && c.price_cents >= x.floor_cents))
      .map(c => {
        const projected = parts(c.projected);
        return { ...c, projected: { expected_keep_cents: projected.keep_cents, expected_days: projected.days, holding_cost_cents: projected.holding_cost_cents }, points: ratio(projected.utility_cents) - raw! };
      }).filter(c => c.points > 0).sort((a, b) => b.points - a.points);
    return { subject_type: 'listing', subject_id: x.listing_id, site: x.site, axis: 'success', state, value: state === 'shown' ? raw : null,
      band, hide_reason: state === 'hidden' ? hidden ? 'axis_hidden' : 'too_few' : null,
      provisional: !receipt, parts: { now, best, axes: x.axes }, change: changes[0] ?? null,
      citation_id: proof.ok ? proof.citation.id : null, citation: proof.ok ? { ...proof.citation, param_versions: versions } : null, model_version: null };
  });
}
