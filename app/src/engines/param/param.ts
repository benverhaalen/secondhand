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
  status: Status;
  frozen: boolean;
  promoted_at: string | null;
};

// What a determination card declares: the prior and guards. A scope with no row reads this.
export type Declared = { name: string; family: Family; prior: unknown; guard_lo?: number; guard_hi?: number; metric?: string };

export type Read = { value: unknown; version: number; n_eff: number; from: 'row' | 'parent' | 'prior'; scope: Scope };

const ORDER = ['person', 'state', 'segment', 'site', 'kind'] as const;

export function scopeKey(s: Scope): string {
  return ORDER.slice().reverse().map((k) => `${k}=${s[k] ?? ''}`).join('|');
}

// The scope itself first, then each parent, dropping the most specific key that is set.
export function lineage(s: Scope): Scope[] {
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
export type Step = (value: unknown, keep: number) => { value: unknown; weight: number };
export type Applied = { applied: boolean; reason: string; read: Read };
export type Pooled = { mean: number; n_eff: number; versions: number[] };

export interface ParamStore {
  declare(d: Declared): void;
  read(name: string, scope: Scope): Read;
  rows(name: string, scope: Scope): Param[];
  readPooled(name: string, scope: Scope): Read | Pooled;
  // A fit writes a challenger; it must carry its held-out score. expectVersion guards a race between two fits.
  propose(p: Omit<Param, 'version' | 'status' | 'promoted_at' | 'frozen'>, expectVersion: number): Param;
  // Promote a challenger when it beats the champion's held-out score by more than the noise (higher is better).
  promote(name: string, scope: Scope, version: number, noise: number, at: string, champion_score?: number): { promoted: boolean; reason: string };
  rollback(name: string, scope: Scope, at: string): Param;
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

// Fold only the supplied lineage, including its prior: a person never climbs beyond its shared scope.
export function pool(d: Declared, rows: (Param | undefined)[], kappa: number): Pooled {
  let mean = summary(d.family, d.prior)!;
  for (const row of [...rows].reverse()) {
    if (row) mean = (row.n_eff * summary(d.family, row.value_or_hyperparams)! + kappa * mean) / (row.n_eff + kappa);
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
    read(n, s) {
      const d = decl(n);
      const line = lineage(s);
      for (let i = 0; i < line.length; i++) {
        const c = champion(n, line[i]);
        if (c) return { value: c.value_or_hyperparams, version: c.version, n_eff: c.n_eff, from: i === 0 ? 'row' : 'parent', scope: line[i] };
      }
      return { value: d.prior, version: 0, n_eff: 0, from: 'prior', scope: {} };
    },
    readPooled(n, s) {
      const d = decl(n);
      if (d.family !== 'beta' && d.family !== 'gamma') return store.read(n, s);
      return pool(d, lineage(s).map((scope) => champion(n, scope)), store.read(POOL_KAPPA.name, {}).value as number);
    },
    propose(p, expectVersion) {
      decl(p.name);
      if (p.held_out_score === null || p.held_out_score === undefined || Number.isNaN(p.held_out_score))
        throw new Error(`a fit wrote ${p.name} without its held-out score`);
      const v = latest(p.name, p.scope);
      if (v !== expectVersion) throw new VersionConflict(`${p.name} is at v${v}, fit expected v${expectVersion}`);
      const row: Param = { ...p, version: v + 1, status: 'challenger', promoted_at: null, frozen: false };
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
      ch.status = 'champion';
      ch.promoted_at = at;
      return { promoted: true, reason: cur ? `beat v${cur.version}` : 'first champion' };
    },
    rollback(n, s, at) {
      const rows = table.get(key(n, s)) ?? [];
      const cur = rows.find((p) => p.status === 'champion');
      if (!cur) throw new Error(`${n} has no champion to roll back`);
      const prev = rows.filter((p) => p.version < cur.version && p.promoted_at !== null).sort((a, b) => b.version - a.version)[0];
      if (!prev) throw new Error(`${n} has no earlier promoted version`);
      cur.status = 'retired';
      prev.status = 'champion';
      prev.promoted_at = at;
      return { ...prev };
    },
    freeze(n, s, on) { for (const p of table.get(key(n, s)) ?? []) p.frozen = on; },
    observe(n, s, o, at) {
      return store.apply(n, s, observationStep(decl(n), o), at, o.days_since_last);
    },
    apply(n, s, step, at, days) {
      const d = decl(n);
      const base = champion(n, s);
      if (base?.frozen) return { applied: false, reason: 'frozen', read: store.read(n, s) };
      const start = base?.value_or_hyperparams ?? store.read(n, s).value;
      const keep = forget(elapsed(base, at, days));
      const next = step(structuredClone(start), keep);
      const mean = summary(d.family, next.value);
      const lo = base?.guard_lo ?? d.guard_lo, hi = base?.guard_hi ?? d.guard_hi;
      if (mean !== undefined && ((lo !== undefined && lo !== null && mean < lo) || (hi !== undefined && hi !== null && mean > hi)))
        return { applied: false, reason: 'guard', read: store.read(n, s) };
      const rows = table.get(key(n, s)) ?? [];
      if (base) base.status = 'retired';
      const row: Param = {
        name: n, scope: { ...s }, family: d.family, value_or_hyperparams: next.value, prior: d.prior, version: latest(n, s) + 1,
        fitted_on_ids_hash: null, n_eff: (base?.n_eff ?? 0) * keep + next.weight, metric: d.metric ?? null, held_out_score: base?.held_out_score ?? null,
        guard_lo: lo ?? null, guard_hi: hi ?? null, status: 'champion', frozen: false, promoted_at: at,
      };
      table.set(key(n, s), [...rows, row]);
      return { applied: true, reason: 'updated', read: store.read(n, s) };
    },
  };
  return store;
}

// The 60 s read cache in front of any store (§6). A write path calls invalidate().
export function cached(store: ParamStore, now: () => number, ttlMs: number) {
  const hit = new Map<string, { at: number; r: Read }>();
  return {
    read(n: string, s: Scope): Read {
      const k = `${n}#${scopeKey(s)}`;
      const h = hit.get(k);
      if (h && now() - h.at < ttlMs) return h.r;
      const r = store.read(n, s);
      hit.set(k, { at: now(), r });
      return r;
    },
    invalidate() { hit.clear(); },
  };
}
