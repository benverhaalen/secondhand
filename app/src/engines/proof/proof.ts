// The proof layer (spec/product.md §6 "The proof layer"): every fact carries `evidence`, every number shown is a guarded number with a `citation`.
// An answer with no basis is refused, never returned as an answer. The thresholds come from param reads, never literals here.
import { createHash } from 'node:crypto';
import type { ParamStore, Scope } from '../param/param.ts';
import { resolve } from './params.ts';
export { DECLARED as PROOF_PARAMS } from './params.ts';

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
  basis_level?: string; notes?: HideReason[]; state: 'shown' | 'hidden'; hide_reason?: HideReason;
};

// What an answer rests on: its sources, counts, dates and the proof rows it passed.
export type Basis = {
  ids: string[]; sources: string[]; count: number; n_eff: number; oldest: string; newest: string; age_days: number; passed: string[];
};
export type Answer<T> = { ok: true; value: T; basis_level: string; basis: Basis; citation: Citation } | { ok: false; refused: 'no_basis' | 'conflict' };
export type AnswerInput = { basis_level?: string; conflict?: boolean };

export type BasisRow = { id: string; source: string; at: string; weight?: number; price_cents?: number };

const DAY = 86_400_000; // Fixed unit conversion: milliseconds per day.

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(k => record[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(record[k])}`).join(',')}}`;
  }
  throw new RangeError('citation identity must be finite JSON');
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function validateRows(rows: BasisRow[]): void {
  const ids = new Set<string>();
  for (const r of rows) {
    if (ids.has(r.id)) throw new RangeError(`duplicate basis id ${r.id}`);
    ids.add(r.id);
    if (!Number.isFinite(r.weight ?? 1) || (r.weight ?? 1) < 0) throw new RangeError('weight must be finite and nonnegative');
    if (r.price_cents !== undefined && (!Number.isSafeInteger(r.price_cents) || r.price_cents < 0))
      throw new RangeError('price_cents must be nonnegative safe integer cents');
  }
}

export function basisHash(rows: BasisRow[]): string {
  validateRows(rows);
  const frozen = rows.map(r => ({ id: r.id, source: r.source, at: r.at, weight: r.weight ?? 1, price_cents: r.price_cents ?? null }));
  frozen.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return hash(frozen);
}

export function basisOf(rows: BasisRow[], now: string, passed: string[]): Basis {
  validateRows(rows);
  const current = Date.parse(now);
  if (!Number.isFinite(current)) throw new RangeError('now must be a valid date');
  if (!rows.length) throw new RangeError('basis must contain rows');
  const ts = rows.map(r => Date.parse(r.at));
  if (ts.some(t => !Number.isFinite(t) || t > current)) throw new RangeError('basis date must be valid and not after now');
  const oldest = ts.reduce((a, b) => Math.min(a, b)), newest = ts.reduce((a, b) => Math.max(a, b));
  const weights = rows.map(r => r.weight ?? 1).sort((a, b) => a - b);
  const scale = weights[weights.length - 1];
  const w = weights.map(weight => scale ? weight / scale : 0);
  const sw = w.reduce((a, b) => a + b, 0), sw2 = w.reduce((a, b) => a + b * b, 0);
  return {
    ids: rows.map(r => r.id), sources: [...new Set(rows.map(r => r.source))].sort(), count: rows.length,
    n_eff: sw2 ? (sw * sw) / sw2 : 0, // Kish effective sample size, normalized to avoid overflow/underflow.
    oldest: new Date(oldest).toISOString(), newest: new Date(newest).toISOString(),
    age_days: Math.floor((current - newest) / DAY), passed: [...passed],
  };
}

export type CitationInput = Omit<Citation, 'id' | 'basis_ids' | 'basis_hash' | 'computed_at'>;

function citationId(cite: CitationInput, basis_hash: string): string {
  const { metric, filters, table_versions, definition_version, code_version, param_versions, model_version } = cite;
  return `cit_${hash({ metric, filters, table_versions, definition_version, code_version, param_versions, model_version, basis_hash })}`;
}

// Wrap a computed value with a frozen basis and citation; invalid evidence is refused.
export function answer<T>(value: T, rows: BasisRow[], cite: CitationInput, now: string, passed: string[] = [], input: AnswerInput = {}): Answer<T> {
  if (input.conflict) return { ok: false, refused: 'conflict' };
  if (!Number.isFinite(Date.parse(now)) || rows.length === 0 || rows.some((r) => !r.id || !r.source || !Number.isFinite(Date.parse(r.at)) || Date.parse(r.at) > Date.parse(now))) return { ok: false, refused: 'no_basis' };
  const basis = basisOf(rows, now, passed);
  const basis_hash = basisHash(rows);
  const citation: Citation = { ...structuredClone(cite), id: citationId(cite, basis_hash), basis_ids: [...basis.ids].sort(), basis_hash, computed_at: now };
  return { ok: true, value, basis_level: input.basis_level ?? 'variant', basis, citation };
}

type NumberValue = GuardedNumber['value'];
export type LadderLevel<T extends NumberValue = NumberValue> = { basis_level: string; rows: BasisRow[]; value: T | null | undefined };
export type LadderInput = { store?: ParamStore; scope?: Scope; conflict?: boolean };

function validateValue(value: NumberValue): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('value must be finite');
  } else if (!Number.isFinite(value.lo) || !Number.isFinite(value.hi) || value.lo > value.hi) {
    throw new RangeError('range must have finite ordered bounds');
  }
}

// spec/engines/valuation.md §3: blend local evidence with the next stated level; the caller supplies the value's units.
export function ladder<T extends NumberValue>(levels: LadderLevel<T>[], cite: CitationInput, now: string, passed: string[] = [], input: LadderInput = {}): Answer<T> {
  if (input.conflict) return { ok: false, refused: 'conflict' };
  const stated: Extract<Answer<T>, { ok: true }>[] = [];
  for (const level of levels) {
    if (!level.rows.length || level.value === null || level.value === undefined) continue;
    validateValue(level.value);
    const a = answer(level.value, level.rows, cite, now, passed, { basis_level: level.basis_level });
    if (!a.ok) continue;
    stated.push(a);
    if (typeof a.value !== 'number') break;
  }
  if (!stated.length) return { ok: false, refused: 'no_basis' };
  const { values, versions, scopes } = resolve(input.store, input.scope ?? {}, ['proof_blend_k']);
  const k = values.proof_blend_k;
  const first = stated[0];
  let value = stated[stated.length - 1].value;
  for (let i = stated.length - 2; i >= 0; i--) {
    const local = stated[i];
    if (typeof local.value !== 'number' || typeof value !== 'number') throw new RangeError('numeric ladder levels must have numeric values');
    const weight = local.basis.n_eff / (local.basis.n_eff + k);
    value = (weight * local.value + (1 - weight) * value) as T;
  }
  const frozen = stated.map(a => ({ basis_level: a.basis_level, value: a.value, basis_hash: a.citation.basis_hash }));
  const basis_hash = hash(frozen);
  const citation: Citation = {
    ...first.citation,
    filters: { calculation: structuredClone(cite.filters), ladder: structuredClone(frozen), param_scopes: { proof_blend_k: scopes.proof_blend_k } },
    param_versions: { ...cite.param_versions, proof_blend_k: versions.proof_blend_k },
    basis_ids: [...new Set(stated.flatMap(a => a.citation.basis_ids))].sort(), basis_hash,
  };
  citation.id = citationId(citation, basis_hash);
  return { ...first, value, citation };
}

// The guard rules, read from params by the caller (proof_min_n_eff starts at 6, proof_max_age_days at 14; product.md §6).
export type GuardRules = { min_n_eff: number; max_age_days: number };

export function guard(a: Answer<NumberValue>, rules: GuardRules): (GuardedNumber & { state: 'shown'; hide_reason?: never }) | { state: 'hidden'; hide_reason: 'source_gap' | 'conflict'; basis_count: 0 } {
  for (const name of ['min_n_eff', 'max_age_days'] as const) {
    if (!Number.isFinite(rules[name]) || rules[name] <= 0) throw new RangeError(`${name} must be finite and positive`);
  }
  if (!a.ok) return { state: 'hidden', hide_reason: a.refused === 'conflict' ? 'conflict' : 'source_gap', basis_count: 0 };
  validateValue(a.value);
  const v = a.value;
  const age_days = (Date.parse(a.citation.computed_at) - Date.parse(a.basis.newest)) / DAY;
  // Fixed algebra: hi - lo > (lo + hi) / 2 iff hi > 3 * lo; an overflowed threshold still compares correctly.
  const too_wide = typeof v !== 'number' && v.hi > 3 * v.lo;
  const notes: HideReason[] = [];
  if (a.basis.n_eff < rules.min_n_eff) notes.push('too_few');
  if (age_days > rules.max_age_days) notes.push('stale');
  if (too_wide) notes.push('too_wide');
  return { value: a.value, basis_count: a.basis.count, as_of: a.basis.newest, citation_id: a.citation.id,
    basis_level: a.basis_level, state: 'shown', notes };
}

// Return the guarded result and its updated citation so it can be stored under the same id.
export function guardWith(store: ParamStore | undefined, scope: Scope, a: Answer<number | { lo: number; hi: number }>) {
  const { values, versions, scopes } = resolve(store, scope, ['proof_min_n_eff', 'proof_max_age_days']);
  const citation: Citation | null = a.ok ? { ...structuredClone(a.citation),
    filters: { calculation: structuredClone(a.citation.filters), param_scopes: scopes },
    param_versions: { ...a.citation.param_versions, ...versions },
  } : null;
  if (citation) citation.id = citationId(citation, citation.basis_hash);
  const guarded = guard(a.ok && citation ? { ...a, citation } : a, {
    min_n_eff: values.proof_min_n_eff, max_age_days: values.proof_max_age_days,
  });
  return { guarded, param_versions: versions, citation };
}

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
    cite(c: Citation) {
      const existing = citations.get(c.id);
      if (existing && canonical(existing) !== canonical(c)) throw new Error(`citation ${c.id} already written with different contents`);
      if (!existing) citations.set(c.id, structuredClone(c));
    },
    citation(id: string) { const c = citations.get(id); return c ? structuredClone(c) : undefined; },
  };
}
