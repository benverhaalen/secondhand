import { memoryStore, type ParamStore, type Scope } from '../param/param.ts';
const scopes = ['kind', 'site', 'segment', 'person'] as const;
const source = 'spec/engines/negotiation.md#4-learning';
const SCALARS = [
  { name: 'negotiation_half_life_days', family: 'scalar', prior: 30, guard_lo: 1, scopes, source },
  { name: 'negotiation_buy_min_probability', family: 'scalar', prior: .7, guard_lo: 0, guard_hi: 1, scopes, source: 'spec/determinations/money.md#d17-most-a-buyer-should-pay' },
  { name: 'negotiation_buy_risk_share', family: 'scalar', prior: .03, guard_lo: 0, guard_hi: 1, scopes, source: 'spec/determinations/money.md#d17-most-a-buyer-should-pay' },
  { name: 'negotiation_p_lo', family: 'scalar', prior: .02, guard_lo: 0, guard_hi: 1, scopes, source },
  { name: 'negotiation_p_hi', family: 'scalar', prior: .98, guard_lo: 0, guard_hi: 1, scopes, source },
  { name: 'negotiation_switch_n', family: 'scalar', prior: 50, guard_lo: 1, scopes, source },
  { name: 'negotiation_calibration_error', family: 'scalar', prior: .05, guard_lo: 0, guard_hi: 1, scopes, source },
  { name: 'negotiation_prior_guard_share', family: 'scalar', prior: .5, guard_lo: 0, scopes, source },
  { name: 'negotiation_calibration_n', family: 'scalar', prior: 30, guard_lo: 1, scopes, source },
  { name: 'negotiation_pooling', family: 'scalar', prior: 1, guard_lo: 0, scopes, source: 'spec/engines/negotiation.md#4-learning (agent proposal numerical budget)' },
  { name: 'negotiation_max_rounds', family: 'scalar', prior: 4, guard_lo: 1, scopes, source: 'spec/engines/negotiation.md#4-learning (agent proposal numerical budget)' },
  { name: 'negotiation_rollback_days', family: 'scalar', prior: 7, guard_lo: 0, scopes, source },
  { name: 'negotiation_rollback_se', family: 'scalar', prior: 2, guard_lo: 0, scopes, source },
  { name: 'negotiation_bootstrap_n', family: 'scalar', prior: 2000, guard_lo: 1, scopes, source: 'spec/engines/negotiation.md#4-learning (bootstrap numerical budget; agent proposal)' },
  { name: 'negotiation_bootstrap_tail', family: 'scalar', prior: .025, guard_lo: 0, guard_hi: .5, scopes, source },
  { name: 'negotiation_q_return', family: 'scalar', prior: .2, guard_lo: 0, guard_hi: 1, scopes, source },
  { name: 'negotiation_wait_lead_hours', family: 'scalar', prior: 2, guard_lo: 0, scopes, source: 'spec/engines/negotiation.md#3-the-calculation' },
  { name: 'negotiation_proof_min_n', family: 'scalar', prior: 6, guard_lo: 1, scopes, source: 'spec/product.md#the-proof-layer' },
  { name: 'negotiation_proof_max_age_days', family: 'scalar', prior: 14, guard_lo: 0, scopes, source: 'spec/product.md#the-proof-layer' },
] as const;
export const POLICY = { name: 'negotiation_policy', family: 'model_ref', prior: 'champion', scopes, source } as const;
export const DECLARED = [...SCALARS, POLICY] as const;
export type Name = typeof SCALARS[number]['name'];
export type Resolved = { values: Record<Name, number> & { negotiation_policy: 'champion' | 'challenger' }; versions: Record<string, number> };
export function resolve(store: ParamStore = memoryStore(), scope: Scope = {}): Resolved {
  const values = {} as Record<Name, number>, versions: Record<string, number> = {};
  for (const d of SCALARS) {
    store.declare(d);
    const r = store.read(d.name, scope);
    values[d.name] = r.value as number; versions[d.name] = r.version;
  }
  store.declare(POLICY);
  const policy = store.read(POLICY.name, scope);
  if (policy.value !== 'champion' && policy.value !== 'challenger') throw new RangeError('negotiation_policy');
  versions.negotiation_policy = policy.version;
  const result: Resolved = { values: { ...values, negotiation_policy: policy.value }, versions }; validate(result); return result;
}
export function validate(p: Resolved): void {
  if (p.values.negotiation_policy !== 'champion' && p.values.negotiation_policy !== 'challenger') throw new RangeError('negotiation_policy');
  for (const d of SCALARS) {
    const v = p.values[d.name];
    if (!Number.isFinite(v) || v < d.guard_lo || ('guard_hi' in d && v > d.guard_hi)) throw new RangeError(d.name);
    if (!(d.name in p.versions) || !Number.isSafeInteger(p.versions[d.name]) || p.versions[d.name] < 0) throw new RangeError(`${d.name} version`);
  }
  if (p.values.negotiation_p_lo <= 0 || p.values.negotiation_p_hi >= 1) throw new RangeError('negotiation probability bounds');
  if (p.values.negotiation_p_lo >= p.values.negotiation_p_hi) throw new RangeError('negotiation probability bounds');
  for (const name of ['negotiation_switch_n', 'negotiation_bootstrap_n', 'negotiation_calibration_n', 'negotiation_max_rounds'] as const) if (!Number.isSafeInteger(p.values[name])) throw new RangeError(name);
}
