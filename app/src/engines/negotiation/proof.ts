import { answer, guard, type Answer, type BasisRow } from '../proof/proof.ts';
import type { Resolved } from './params.ts';
export type ProofContext = { rows: BasisRow[]; now: string; code_version: string; table_versions?: { table: string; version: number }[] };
export type Proved = { answer: Answer<number>; guarded: ReturnType<typeof guard> };
export function prove(value: number | null, metric: string, context: ProofContext | undefined, params: Resolved): Proved {
  const a = value === null || !Number.isFinite(value) || !context ? { ok: false as const, refused: 'no_basis' as const } : answer(value, context.rows, {
    metric, filters: {}, table_versions: context.table_versions ?? [], definition_version: 'spec/engines/negotiation.md#3-the-calculation',
    code_version: context.code_version, param_versions: params.versions, model_version: null,
  }, context.now, ['limits', 'integer_cents', 'probability']);
  return { answer: a, guarded: guard(a, { min_n_eff: params.values.negotiation_proof_min_n, max_age_days: params.values.negotiation_proof_max_age_days }) };
}
