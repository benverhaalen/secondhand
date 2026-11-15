// The param registry: every learned weight, threshold, cadence, budget and route cost is a `param` row (spec/product.md §3, §6 "Real-time weights").
// A reader names a declared param and a scope; it gets the champion row for that exact scope, else the nearest parent scope, else the declared prior.
// Fallback only climbs (state -> segment -> site -> kind -> global); it never reads a sibling or a child scope.
// A person-scoped read falls back to the same scope without the person, then the prior, never to another person's row (product.md §3 `param`).

export type Family = 'scalar' | 'beta' | 'normal' | 'gamma' | 'model_ref';
export type Status = 'champion' | 'challenger' | 'retired';
export type Scope = { kind?: string; site?: string; segment?: string; state?: string; person?: string };

export type Param = {
  name: string;
  scope: Scope;
  family: Family;
  value_or_hyperparams: unknown; // scalar: number; beta: {alpha, beta}; normal: {mean, sd}; gamma: {shape, rate}; model_ref: {uri, version}
  prior: unknown;
  version: number;
  fitted_on_ids_hash: string | null;
  n_eff: number;
  metric: string | null;
  held_out_score: number | null; // required on a challenger written by a fit
  guard_lo: number | null;
  guard_hi: number | null;
  origin: 'event' | 'fit';
  previous_version: number | null;
  keep: number | null;
  days_since_last: number | null;
  status: Status;
  frozen: boolean;
  promoted_at: string | null;
};

// What a determination card declares: the prior and guards. A scope with no row reads this.
export type Declared = { name: string; family: Family; prior: unknown; guard_lo?: number; guard_hi?: number; metric?: string };

export type Read = { value: unknown; version: number; n_eff: number; from: 'row' | 'parent' | 'prior'; scope: Scope };

const ORDER = ['person', 'state', 'segment', 'site', 'kind'] as const;

export function scopeKey(s: Scope): string {
  const keys = [...ORDER].reverse();
  if (Object.keys(s).some((k) => !keys.includes(k as keyof Scope))) throw new Error('unknown scope keys');
  return JSON.stringify(Object.fromEntries(keys.filter((k) => s[k] !== undefined).map((k) => [k, s[k]])));
}

// The scope itself first, then each parent, dropping the most specific key that is set.
export function lineage(s: Scope): Scope[] {
  scopeKey(s);
  if (s.person !== undefined) {
    const { person: _, ...shared } = s;
    return [{ ...s }, shared];
  }
  const out: Scope[] = [{ ...s }];
  let cur: Scope = { ...s };
  for (const k of ORDER) {
    if (cur[k] === undefined) continue;
    cur = { ...cur };
    delete cur[k];
    out.push(cur);
  }
  const last = out[out.length - 1];
  if (ORDER.some((k) => last[k] !== undefined)) out.push({});
  return out;
}

export class VersionConflict extends Error {}
export class Unknown extends Error {}

export type Observation = ({ success: number } | { count: number; exposure: number }) & { weight: number; days_since_last?: number };
// Beta/Gamma callbacks update evidence by default, or the complete posterior with explicit elapsed time.
export type Step = (value: unknown, keep: number) => { value: unknown; weight: number };
export type Applied = { applied: boolean; reason: string; anomaly?: boolean; read: Read };
export type Pooled = { mean: number; n_eff: number; versions: number[] };

export interface ParamStore {
  declare(d: Declared): void;
  read(name: string, scope: Scope, as_of?: string): Read;
  rows(name: string, scope: Scope): Param[];
  readPooled(name: string, scope: Scope, as_of?: string): Read | Pooled;
  // A fit writes a challenger; it must carry its held-out score. expectVersion guards a race between two fits.
  propose(p: Omit<Param, 'version' | 'status' | 'promoted_at' | 'frozen' | 'origin' | 'previous_version' | 'keep' | 'days_since_last'>, expectVersion: number): Param;
  // Promote a challenger when it beats the champion's held-out score by more than the noise (higher is better).
  promote(name: string, scope: Scope, version: number, noise: number, at: string, champion_score?: number): { promoted: boolean; reason: string };
  rollback(name: string, scope: Scope, at: string, keep_evidence?: boolean): Param;
  freeze(name: string, scope: Scope, on: boolean): void;
  // A conjugate update in the same transaction as the outcome that informs it; weight is how sure the observation is.
  observe(name: string, scope: Scope, outcome: Observation, at: string): Applied;
  apply(name: string, scope: Scope, step: Step, at: string, days_since_last?: number): Applied;
}

// Forgetting at a 30-day half-life (marketing-engine §3.5, negotiation §4): after 30 days an old count weighs half.
export const FORGET_DAYS = 30;
export const forget = (days: number): number => 0.5 ** (days / FORGET_DAYS);

// spec/marketing-engine.md#35-update-rules
export const POOL_KAPPA: Declared = { name: 'param_pool_kappa', family: 'scalar', prior: 20 };

export function elapsed(base: Param | undefined, at: string, days?: number): number {
  if (days !== undefined) return days;
  // Out-of-order observations still apply, with zero decay.
  return base?.promoted_at ? Math.max(0, (Date.parse(at) - Date.parse(base.promoted_at)) / 86_400_000) : 0;
}

export function summary(family: Family, value: unknown): number | undefined {
  if (family === 'beta') {
    const v = value as { alpha: number; beta: number };
    return v.alpha / (v.alpha + v.beta);
  }
  if (family === 'gamma') {
    const v = value as { shape: number; rate: number };
    return v.shape / v.rate;
  }
  return undefined;
}

export function observationStep(d: Declared, o: Observation): Step {
  if (d.family === 'beta' && 'success' in o) return (value, keep) => {
    const v = value as { alpha: number; beta: number };
    return { value: { alpha: v.alpha * keep + o.weight * o.success, beta: v.beta * keep + o.weight * (1 - o.success) }, weight: o.weight };
  };
  if (d.family === 'gamma' && 'count' in o) return (value, keep) => {
    const v = value as { shape: number; rate: number };
    return { value: { shape: v.shape * keep + o.weight * o.count, rate: v.rate * keep + o.weight * o.exposure }, weight: o.weight };
  };
  throw new Error(`observe supports beta success or gamma count/exposure; ${d.name} is ${d.family}`);
}

export function evidence(family: Family, value: unknown, prior: unknown): unknown {
  if (family !== 'beta' && family !== 'gamma') return value;
  const v = value as Record<string, number>, p = prior as Record<string, number>;
  return Object.fromEntries(Object.keys(p).map((k) => [k, v[k] - p[k]]));
}

export function withPrior(family: Family, value: unknown, prior: unknown, start: unknown, keep: number): unknown {
  if (family !== 'beta' && family !== 'gamma') return value;
  const v = value as Record<string, number>, p = prior as Record<string, number>, old = start as Record<string, number>;
  return Object.fromEntries(Object.keys(p).map((k) => [k, old[k] * keep + p[k] * (1 - keep) + (v[k] - (old[k] - p[k]) * keep)]));
}

export function decay(row: Param, as_of?: string): Param {
  if (as_of === undefined) return row;
  const keep = forget(elapsed(row, as_of));
  const value = row.value_or_hyperparams as Record<string, number>, prior = row.prior as Record<string, number>;
  return { ...row, n_eff: row.n_eff * keep, value_or_hyperparams: row.family === 'beta' || row.family === 'gamma'
    ? Object.fromEntries(Object.keys(prior).map((k) => [k, value[k] * keep + prior[k] * (1 - keep)]))
    : row.value_or_hyperparams };
}

export function clamped(row: Param): unknown {
  const mean = summary(row.family, row.value_or_hyperparams);
  if (mean === undefined) return row.value_or_hyperparams;
  const bounded = Math.max(row.guard_lo ?? -Infinity, Math.min(row.guard_hi ?? Infinity, mean));
  if (bounded === mean) return row.value_or_hyperparams;
  if (row.family === 'beta') {
    const v = row.value_or_hyperparams as { alpha: number; beta: number };
    const total = v.alpha + v.beta;
    return { alpha: bounded * total, beta: (1 - bounded) * total };
  }
  const v = row.value_or_hyperparams as { shape: number; rate: number };
  return { shape: bounded * v.rate, rate: v.rate };
}

export function rowRead(row: Param, from: Read['from'], scope: Scope, as_of?: string): Read {
  const aged = decay(row, as_of);
  return { value: structuredClone(clamped(aged)), version: row.version, n_eff: aged.n_eff, from, scope };
}

export function rollbackRow(rows: Param[], cur: Param, at: string, keep_evidence = false): Param {
  const byVersion = new Map(rows.map((r) => [r.version, r]));
  const events: Param[] = [];
  let prev: Param | undefined = cur;
  while (prev) {
    if (prev !== cur && (cur.origin === 'fit' || prev.origin === 'fit')) break;
    if (prev.origin === 'event') events.push(prev);
    prev = prev.previous_version === null ? undefined : byVersion.get(prev.previous_version);
  }
  if (!prev) throw new Error(`${cur.name} has no earlier promoted fitted version`);
  if (cur.origin === 'fit' || !keep_evidence) return { ...prev, status: 'champion', promoted_at: at };
  if (cur.family !== 'beta' && cur.family !== 'gamma') throw new Error('keep_evidence supports beta or gamma');
  const value = { ...(prev.value_or_hyperparams as Record<string, number>) };
  let n_eff = prev.n_eff;
  let factor = events.length ? forget(elapsed(events[0], at)) : 1;
  for (const row of events) {
    if (row.keep === null) throw new Error('event history lacks decay metadata for keep_evidence');
    const base = row.previous_version === null ? undefined : byVersion.get(row.previous_version);
    const start = base?.value_or_hyperparams ?? row.prior;
    const old = (row.days_since_last !== null ? start : evidence(row.family, start, row.prior)) as Record<string, number>;
    const next = (row.days_since_last !== null ? row.value_or_hyperparams : evidence(row.family, row.value_or_hyperparams, row.prior)) as Record<string, number>;
    for (const k of Object.keys(value)) value[k] += (next[k] - old[k] * row.keep) * factor;
    n_eff += (row.n_eff - (base?.n_eff ?? 0) * row.keep) * factor;
    factor *= row.keep;
  }
  // Keep the fitted snapshot immutable; retained evidence is a new event version linked to it.
  return { ...prev, version: Math.max(...rows.map((r) => r.version)) + 1, origin: 'event', status: 'champion',
    previous_version: prev.version, keep: 1, days_since_last: null, value_or_hyperparams: value, n_eff, promoted_at: at };
}

// Fold only the supplied lineage, including its prior: a person never climbs beyond its shared scope.
export function pool(d: Declared, rows: (Param | undefined)[], kappa: number, as_of?: string): Pooled {
  rows = rows.map((row) => row ? decay(row, as_of) : undefined);
  let mean = summary(d.family, d.prior)!;
  for (const row of [...rows].reverse()) {
    if (row) mean = (row.n_eff * summary(d.family, clamped(row))! + kappa * mean) / (row.n_eff + kappa);
  }
  return { mean, n_eff: rows.find((row) => row !== undefined)?.n_eff ?? 0, versions: rows.flatMap((row) => row ? [row.version] : []) };
}

export function memoryStore(): ParamStore {
  const declared = new Map<string, Declared>([[POOL_KAPPA.name, POOL_KAPPA]]);
  const table = new Map<string, Param[]>(); // key name|scope -> every version
  const key = (n: string, s: Scope) => `${n}#${scopeKey(s)}`;
  const decl = (n: string) => {
    const d = declared.get(n);
    if (!d) throw new Unknown(`param ${n} is not declared`);
    return d;
  };
  const champion = (n: string, s: Scope) => table.get(key(n, s))?.find((p) => p.status === 'champion');
  const latest = (n: string, s: Scope) => Math.max(0, ...(table.get(key(n, s)) ?? []).map((p) => p.version));

  const store: ParamStore = {
    declare(d) { declared.set(d.name, d); },
    rows(n, s) { return (table.get(key(n, s)) ?? []).map((p) => ({ ...p })); },
    read(n, s, as_of) {
      const d = decl(n);
      const line = lineage(s);
      for (let i = 0; i < line.length; i++) {
        const c = champion(n, line[i]);
        if (c) return rowRead(c, i === 0 ? 'row' : 'parent', line[i], as_of);
      }
      return { value: d.prior, version: 0, n_eff: 0, from: 'prior', scope: {} };
    },
    readPooled(n, s, as_of) {
      const d = decl(n);
      if (d.family !== 'beta' && d.family !== 'gamma') return store.read(n, s, as_of);
      return pool(d, lineage(s).map((scope) => champion(n, scope)), store.read(POOL_KAPPA.name, {}, as_of).value as number, as_of);
    },
    propose(p, expectVersion) {
      decl(p.name);
      if (p.held_out_score === null || p.held_out_score === undefined || Number.isNaN(p.held_out_score))
        throw new Error(`a fit wrote ${p.name} without its held-out score`);
      const v = latest(p.name, p.scope);
      if (v !== expectVersion) throw new VersionConflict(`${p.name} is at v${v}, fit expected v${expectVersion}`);
      const row: Param = { ...p, origin: 'fit', previous_version: null, keep: null, days_since_last: null, version: v + 1, status: 'challenger', promoted_at: null, frozen: false };
      table.set(key(p.name, p.scope), [...(table.get(key(p.name, p.scope)) ?? []), row]);
      return { ...row };
    },
    promote(n, s, version, noise, at, champion_score) {
      const rows = table.get(key(n, s)) ?? [];
      const ch = rows.find((p) => p.version === version && p.status === 'challenger');
      if (!ch) return { promoted: false, reason: 'no such challenger' };
      const cur = rows.find((p) => p.status === 'champion');
      if (cur?.frozen) return { promoted: false, reason: 'frozen' };
      const score = champion_score ?? cur?.held_out_score;
      if (cur && score !== null && score !== undefined && (ch.held_out_score ?? -Infinity) - score <= noise)
        return { promoted: false, reason: 'lost held-out' };
      if (cur) {
        cur.status = 'retired';
        if (champion_score !== undefined) cur.held_out_score = champion_score;
      }
      ch.previous_version = cur?.version ?? null;
      ch.status = 'champion';
      ch.promoted_at = at;
      return { promoted: true, reason: cur ? `beat v${cur.version}` : 'first champion' };
    },
    rollback(n, s, at, keep_evidence) {
      const rows = table.get(key(n, s)) ?? [];
      const cur = rows.find((p) => p.status === 'champion');
      if (!cur) throw new Error(`${n} has no champion to roll back`);
      const restored = rollbackRow(rows, cur, at, keep_evidence);
      cur.status = 'retired';
      const prev = rows.find((r) => r.version === restored.version);
      if (prev) Object.assign(prev, restored);
      else rows.push(restored);
      return structuredClone(restored);
    },
    freeze(n, s, on) { for (const p of table.get(key(n, s)) ?? []) p.frozen = on; },
    observe(n, s, o, at) {
      return store.apply(n, s, observationStep(decl(n), o), at, o.days_since_last);
    },
    apply(n, s, step, at, days) {
      const d = decl(n);
      const base = champion(n, s);
      if (base?.frozen) return { applied: false, reason: 'frozen', read: store.read(n, s) };
      const inherited = lineage(s).slice(1).map((scope) => champion(n, scope)).find((row) => row !== undefined);
      const start = base?.value_or_hyperparams ?? inherited?.value_or_hyperparams ?? d.prior;
      const prior = base?.prior ?? start;
      const keep = forget(elapsed(base, at, days));
      // Explicit caller forgetting wins for this update: restoring full prior mass would pin recovery.
      const next = step(structuredClone(days === undefined ? evidence(d.family, start, prior) : start), keep);
      if (days === undefined) next.value = withPrior(d.family, next.value, prior, start, keep);
      const mean = summary(d.family, next.value);
      const lo = base?.guard_lo ?? d.guard_lo, hi = base?.guard_hi ?? d.guard_hi;
      const anomaly = mean !== undefined && ((lo != null && mean < lo) || (hi != null && mean > hi));
      const rows = table.get(key(n, s)) ?? [];
      if (base) base.status = 'retired';
      const row: Param = {
        name: n, scope: { ...s }, family: d.family, value_or_hyperparams: next.value, prior: structuredClone(prior), origin: 'event', previous_version: base?.version ?? null, keep, days_since_last: days ?? null, version: latest(n, s) + 1,
        fitted_on_ids_hash: null, n_eff: (base?.n_eff ?? 0) * keep + next.weight, metric: d.metric ?? null, held_out_score: base?.held_out_score ?? null,
        guard_lo: lo ?? null, guard_hi: hi ?? null, status: 'champion', frozen: false, promoted_at: at,
      };
      table.set(key(n, s), [...rows, row]);
      return { applied: true, reason: anomaly ? 'clamped' : 'updated', ...(anomaly ? { anomaly: true } : {}), read: store.read(n, s) };
    },
  };
  return store;
}

// The 60 s read cache in front of any store (§6). A write path calls invalidate().
export function cached(store: ParamStore, now: () => number, ttlMs: number) {
  const hit = new Map<string, { at: number; r: Read }>();
  return {
    read(n: string, s: Scope, as_of?: string): Read {
      const k = JSON.stringify([n, scopeKey(s), as_of]);
      const h = hit.get(k);
      if (h && now() - h.at < ttlMs) return h.r;
      const r = store.read(n, s, as_of);
      hit.set(k, { at: now(), r });
      return r;
    },
    invalidate() { hit.clear(); },
  };
}

// Buying-conversation priors from the route brief (2026-11-15); effort awaits the scored evaluation.
export const assistParams = memoryStore();
for (const declaration of [
  { name: 'assist_effort', family: 'scalar', prior: 'low' },
  { name: 'assist_turn_max_usd', family: 'scalar', prior: 0.25, guard_lo: 0 },
  { name: 'assist_turn_deadline_ms', family: 'scalar', prior: 90000, guard_lo: 1 },
  { name: 'assist_visitor_daily_cents', family: 'scalar', prior: 500, guard_lo: 0 },
] satisfies Declared[]) assistParams.declare(declaration);
