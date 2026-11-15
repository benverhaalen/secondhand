import { answer, guard, type BasisRow, type Citation, type GuardRules, type GuardedNumber } from '../proof/proof.ts';
import { numeric, priors, DECLARED, type Values } from './params.ts';
export type Proof = { rows: BasisRow[]; now: string; scope: Record<string, string>; code_version: string; table_versions: { table: string; version: number }[]; model_version?: string; rules?: GuardRules };
export type Published = { number: GuardedNumber; citation: Citation };
export function publish(value: number, metric: string, proof: Proof | undefined, versions: Record<string, number>, values: Values = priors()): Published | null {
  if (DECLARED.some(d => !Number.isSafeInteger(versions[d.name]) || versions[d.name] < 0)) return null;
  if (!proof || !Number.isFinite(value) || !Number.isFinite(Date.parse(proof.now)) ||
      new Set(proof.rows.map(r => r.id)).size !== proof.rows.length ||
      proof.rows.some(r => !Number.isFinite(Date.parse(r.at)) || Date.parse(r.at) > Date.parse(proof.now) || (r.weight !== undefined && (!Number.isFinite(r.weight) || r.weight <= 0)))) return null;
  const a = answer(value, proof.rows, { metric, filters: proof.scope, table_versions: proof.table_versions, definition_version: 'spec/engines/trust.md', code_version: proof.code_version, param_versions: versions, model_version: proof.model_version ?? null }, proof.now);
  const p = numeric(values);
  const g = guard(a, proof.rules ?? { min_n_eff: p('trust_proof_min_n_eff'), max_age_days: p('trust_proof_max_age_days') });
  if (!a.ok || g.state !== 'shown') return null;
  return { number: g, citation: a.citation };
}
