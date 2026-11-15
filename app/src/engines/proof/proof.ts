// The proof layer (spec/product.md §6 "The proof layer"): every fact carries `evidence`, every number shown is a guarded number with a `citation`.
// An answer with no basis is refused, never returned as an answer. The thresholds come from param reads, never literals here.
import { createHash } from 'node:crypto';

export type Rights = { may_store: boolean; may_model: boolean; may_show: boolean; may_share: boolean; ttl: string | null };

export type AttributeEvidence = {
  kind: 'image_region' | 'depth' | 'label_text' | 'lookup' | 'owner';
  ref: string; region?: unknown; captured_at: string; extractor_version: string;
};
export type CompEvidence = {
  source_url: string; read_at: string; snapshot_ref: string; fingerprint: string; extractor_version: string; rights: Rights;
};
export type Evidence = AttributeEvidence | CompEvidence;

export type ObservationKind = 'listing' | 'stats' | 'price' | 'rank' | 'fact' | 'trend' | 'retail' | 'rule';
export type Observation = {
  id: string; kind: ObservationKind; site?: string; product_id?: string; subject_ref: string; observed_at: string;
  payload: unknown; evidence: Evidence; source_route: string; retention_class: string; rights_mode: string;
};

export type Citation = {
  id: string; metric: string; filters: unknown; table_versions: { table: string; version: number }[];
  definition_version: string; code_version: string; param_versions: Record<string, number>; model_version: string | null;
  computed_at: string; basis_ids: string[]; basis_hash: string;
};

export type HideReason = 'too_few' | 'too_wide' | 'stale' | 'mixed_types' | 'source_gap' | 'conflict' | 'noise';
export type GuardedNumber = {
  value: number | { lo: number; hi: number }; basis_count: number; as_of: string; citation_id: string;
  state: 'shown' | 'hidden'; hide_reason?: HideReason;
};

// What an answer rests on: its sources, counts, dates and the proof rows it passed.
export type Basis = {
  ids: string[]; sources: string[]; count: number; n_eff: number; oldest: string; newest: string; age_days: number; passed: string[];
};
export type Answer<T> = { ok: true; value: T; basis: Basis; citation: Citation } | { ok: false; refused: 'no_basis' };

export type BasisRow = { id: string; source: string; at: string; weight?: number; price_cents?: number };

const DAY = 86_400_000;

// SHA-256 of the sorted basis ids and prices (money M21), so a recompute can be matched exactly.
export function basisHash(rows: BasisRow[]): string {
  const lines = rows.map((r) => `${r.id}:${r.price_cents ?? ''}`).sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

export function basisOf(rows: BasisRow[], now: string, passed: string[]): Basis {
  const ts = rows.map((r) => Date.parse(r.at)).filter((t) => !Number.isNaN(t));
  const oldest = Math.min(...ts), newest = Math.max(...ts);
  const w = rows.map((r) => r.weight ?? 1), sw = w.reduce((a, b) => a + b, 0), sw2 = w.reduce((a, b) => a + b * b, 0);
  return {
    ids: rows.map((r) => r.id), sources: [...new Set(rows.map((r) => r.source))].sort(), count: rows.length,
    n_eff: sw2 ? (sw * sw) / sw2 : 0, // Kish effective sample size
    oldest: new Date(oldest).toISOString(), newest: new Date(newest).toISOString(),
    age_days: Math.floor((Date.parse(now) - newest) / DAY), passed,
  };
}

export type CitationInput = Omit<Citation, 'id' | 'basis_ids' | 'basis_hash' | 'computed_at'>;

// Wrap a computed value with its basis and citation. No rows, or rows with no readable date, is a refusal.
export function answer<T>(value: T, rows: BasisRow[], cite: CitationInput, now: string, passed: string[] = []): Answer<T> {
  if (rows.length === 0 || rows.some((r) => !r.id || !r.source || Number.isNaN(Date.parse(r.at)))) return { ok: false, refused: 'no_basis' };
  const basis = basisOf(rows, now, passed);
  const basis_hash = basisHash(rows);
  const citation: Citation = { ...cite, id: `cit_${basis_hash.slice(0, 16)}`, basis_ids: basis.ids, basis_hash, computed_at: now };
  return { ok: true, value, basis, citation };
}

// The guard rules, read from params by the caller (proof_min_n_eff starts at 6, proof_max_age_days at 14; product.md §6).
export type GuardRules = { min_n_eff: number; max_age_days: number };

export function guard(a: Answer<number | { lo: number; hi: number }>, rules: GuardRules): GuardedNumber | { state: 'hidden'; hide_reason: 'source_gap'; basis_count: 0 } {
  if (!a.ok) return { state: 'hidden', hide_reason: 'source_gap', basis_count: 0 };
  const g: GuardedNumber = { value: a.value, basis_count: a.basis.count, as_of: a.basis.newest, citation_id: a.citation.id, state: 'shown' };
  const v = a.value;
  const reason: HideReason | undefined =
    a.basis.n_eff < rules.min_n_eff ? 'too_few'
    : a.basis.age_days > rules.max_age_days ? 'stale'
    : typeof v !== 'number' && v.hi - v.lo > (v.lo + v.hi) / 2 ? 'too_wide'
    : undefined;
  return reason ? { ...g, state: 'hidden', hide_reason: reason } : g;
}

// The params this layer reads, with the priors the spec gives. A registry declares these at start.
export const PROOF_PARAMS = [
  { name: 'proof_min_n_eff', family: 'scalar', prior: 6 },
  { name: 'proof_max_age_days', family: 'scalar', prior: 14 },
] as const;

// Append-only in-memory fakes, so every engine stream builds against the shapes before Delta is wired.
export function memoryProof() {
  const observations: Observation[] = [];
  const citations = new Map<string, Citation>();
  return {
    observe(o: Observation) {
      if (observations.some((x) => x.id === o.id)) throw new Error(`observation ${o.id} already written; observations are append-only`);
      observations.push(structuredClone(o));
    },
    observations(filter: Partial<Pick<Observation, 'kind' | 'site' | 'product_id' | 'subject_ref'>> = {}) {
      return observations.filter((o) => Object.entries(filter).every(([k, v]) => o[k as keyof Observation] === v)).map((o) => structuredClone(o));
    },
    cite(c: Citation) { citations.set(c.id, structuredClone(c)); },
    citation(id: string) { const c = citations.get(id); return c ? structuredClone(c) : undefined; },
  };
}
