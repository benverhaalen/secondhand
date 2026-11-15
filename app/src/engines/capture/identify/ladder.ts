import { memoryStore, type ParamStore, type Scope } from '../../param/param.ts';

// Rests-on: jobs/identity/params.py DECLARED; jobs/identity/ladder.py.
export const DECLARED = [
  {name: 'identity_rung_1', family: 'scalar', prior: 1},
  {name: 'identity_rung_2', family: 'scalar', prior: 0.8},
  {name: 'identity_rung_3', family: 'scalar', prior: 0.5},
  {name: 'identity_rung_4', family: 'scalar', prior: 0.3},
  {name: 'identity_q_kind', family: 'scalar', prior: 0.6},
  {name: 'identity_max_pick', family: 'scalar', prior: 4},
  {name: 'identify_spend_cap_capture_micro', family: 'scalar', prior: 3000, guard_lo: 0, guard_hi: 3000},
  {name: 'identify_spend_cap_day_micro', family: 'scalar', prior: 100000, guard_lo: 0, guard_hi: 100000},
  {name: 'identify_lens_crop', family: 'scalar', prior: 0.8, guard_lo: 0, guard_hi: 1},
  {name: 'identify_lens_url_ttl_s', family: 'scalar', prior: 120, guard_lo: 0, guard_hi: 120},
] as const;
export type ParamName = typeof DECLARED[number]['name'];
export type Hit = {rung: number; product: string; s: number};
export type Candidates = Record<string, [number, Set<number>]>;

export function bound(params: ParamStore, name: ParamName, scope: Scope = {}): number {
  params.declare(DECLARED.find(entry => entry.name === name)!);
  const value = params.read(name, scope).value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (name === 'identity_max_pick' ? 1 : 0) || (name !== 'identity_max_pick' && value > 1))
    throw new RangeError(`${name} outside guard`);
  return value;
}
function unit(value: number, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1`);
}
function rung(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 4) throw new RangeError('rung must be 1, 2, 3 or 4');
}
function validate(cands: Candidates) {
  for (const [score, rungs] of Object.values(cands)) {
    unit(score, 'candidate similarity');
    if (!rungs.size) throw new RangeError('rung must be 1, 2, 3 or 4');
    for (const value of rungs) rung(value);
  }
}
export function candidates(hits: readonly Hit[], params: ParamStore = memoryStore(), scope: Scope = {}): Candidates {
  const out: Candidates = Object.create(null) as Candidates;
  for (const hit of hits) {
    rung(hit.rung);
    unit(hit.s, 'similarity');
    const [score, rungs] = out[hit.product] ?? [0, new Set<number>()];
    out[hit.product] = [Math.max(score, bound(params, `identity_rung_${hit.rung}` as ParamName, scope) * hit.s), new Set([...rungs, hit.rung])];
  }
  return out;
}
export function conformal_set(cands: Candidates, q_hat: number): string[] {
  unit(q_hat, 'q_hat');
  validate(cands);
  return Object.keys(cands).filter(product => cands[product][0] >= 1 - q_hat)
    .sort((a, b) => cands[b][0] - cands[a][0] || (a < b ? -1 : a > b ? 1 : 0));
}
export function action(set: readonly string[], params: ParamStore = memoryStore(), scope: Scope = {}): 'confirm'|'pick'|'ask' {
  if (set.length === 1) return 'confirm';
  return set.length >= 2 && set.length <= bound(params, 'identity_max_pick', scope) ? 'pick' : 'ask';
}
export function label(product: string, cands: Candidates, confirmed: boolean): 'exact'|'likely_same_model' {
  validate(cands);
  if (confirmed || cands[product][1].has(1) || cands[product][1].has(2)) return 'exact';
  return 'likely_same_model';
}
