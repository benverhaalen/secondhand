// The SQL-backed param store (spec/product.md §6 "Real-time weights"; table db/migrations/0004_param.sql).
// It never opens or commits a transaction: the caller hands it the tx that writes the outcome event, so observe() and the event commit or roll back together.
// Row security does the person isolation: the caller's tx has app.user_id set, and user_id is set exactly when scope.person is.
import { elapsed, forget, evidence, withPrior, rollbackRow, rowRead, lineage, observationStep, pool, POOL_KAPPA, scopeKey, summary, Unknown, VersionConflict } from './param.ts';
import type { Declared, Param, ParamStore, Read, Scope } from './param.ts';

export type Tx = { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };

// ParamStore with Promise returns; declare stays synchronous (priors live in memory).
type Async<T> = { [K in keyof T]: T[K] extends (...a: infer A) => infer R ? (K extends 'declare' ? T[K] : (...a: A) => Promise<R>) : T[K] };
export type AsyncParamStore = Async<ParamStore>;

const json = scopeKey;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const iso = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : String(v));
const toParam = (row: Record<string, unknown>): Param => {
  if (typeof row.name !== 'string' || !row.scope || typeof row.scope !== 'object' || Array.isArray(row.scope) || !['scalar', 'beta', 'normal', 'gamma', 'model_ref'].includes(String(row.family)) || !['champion', 'challenger', 'retired'].includes(String(row.status)) || typeof row.frozen !== 'boolean' || !['fit', 'event'].includes(String(row.origin))) throw new Error('invalid param row');
  const r = row;
  return {
  name: r.name as string, scope: r.scope as Scope, family: r.family as Param['family'], value_or_hyperparams: r.value_or_hyperparams, prior: r.prior, version: Number(r.version),
  fitted_on_ids_hash: typeof r.fitted_on_ids_hash === 'string' ? r.fitted_on_ids_hash : null, n_eff: Number(r.n_eff), metric: typeof r.metric === 'string' ? r.metric : null, held_out_score: num(r.held_out_score),
  guard_lo: num(r.guard_lo), guard_hi: num(r.guard_hi), origin: r.origin as Param['origin'], previous_version: num(r.previous_version), keep: num(r.keep), status: r.status as Param['status'], frozen: r.frozen as boolean, promoted_at: iso(r.promoted_at),
  };
};

export function sqlStore(tx: Tx): AsyncParamStore {
  const declared = new Map<string, Declared>([[POOL_KAPPA.name, POOL_KAPPA]]);
  const decl = (n: string) => {
    const d = declared.get(n);
    if (!d) throw new Unknown(`param ${n} is not declared`);
    return d;
  };
  const rowsOf = async (n: string, s: Scope, lock = false) =>
    (await tx.query(`select * from param where name = $1 and scope = $2::jsonb order by version${lock ? ' for update' : ''}`, [n, json(s)])).rows.map(toParam);
  const latest = async (n: string, s: Scope) =>
    Number((await tx.query('select coalesce(max(version), 0) v from param where name = $1 and scope = $2::jsonb', [n, json(s)])).rows[0].v);
  const setStatus = (n: string, s: Scope, version: number, status: Status, at: string | null) =>
    tx.query('update param set status = $4, promoted_at = coalesce($5::timestamptz, promoted_at), updated_at = now() where name = $1 and scope = $2::jsonb and version = $3', [n, json(s), version, status, at]);

  const insertEvent = (p: Param) => tx.query(
    `insert into param (user_id, name, scope, family, value_or_hyperparams, prior, version, fitted_on_ids_hash, n_eff, metric, held_out_score, guard_lo, guard_hi, origin, status, promoted_at, previous_version, keep)
     values ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, 'event', 'champion', $14::timestamptz, $15, $16)`,
    [p.scope.person ?? null, p.name, json(p.scope), p.family, JSON.stringify(p.value_or_hyperparams), JSON.stringify(p.prior), p.version,
      p.fitted_on_ids_hash, p.n_eff, p.metric, p.held_out_score, p.guard_lo, p.guard_hi, p.promoted_at, p.previous_version, p.keep]);

  const store: AsyncParamStore = {
    declare(d) { declared.set(d.name, d); },
    rows: (n, s) => rowsOf(n, s),
    async read(n, s, as_of) {
      const d = decl(n);
      const line = lineage(s);
      // One query over the whole lineage; the most specific champion wins.
      const { rows } = await tx.query(
        "select * from param where name = $1 and status = 'champion' and scope in (select jsonb_array_elements($2::jsonb))", [n, JSON.stringify(line)]);
      const byKey = new Map(rows.map(toParam).map((p) => [scopeKey(p.scope), p]));
      for (let i = 0; i < line.length; i++) {
        const c = byKey.get(scopeKey(line[i]));
        if (c) return rowRead(c, i === 0 ? 'row' : 'parent', line[i], as_of);
      }
      return { value: d.prior, version: 0, n_eff: 0, from: 'prior', scope: {} };
    },
    async readPooled(n, s, as_of) {
      const d = decl(n);
      if (d.family !== 'beta' && d.family !== 'gamma') return store.read(n, s, as_of);
      const line = lineage(s);
      const { rows } = await tx.query(
        "select * from param where name = $1 and status = 'champion' and scope in (select jsonb_array_elements($2::jsonb))", [n, JSON.stringify(line)]);
      const byKey = new Map(rows.map(toParam).map((p) => [scopeKey(p.scope), p]));
      return pool(d, line.map((scope) => byKey.get(scopeKey(scope))), (await store.read(POOL_KAPPA.name, {}, as_of)).value as number, as_of);
    },
    async propose(p, expectVersion) {
      decl(p.name);
      if (p.held_out_score === null || p.held_out_score === undefined || Number.isNaN(p.held_out_score))
        throw new Error(`a fit wrote ${p.name} without its held-out score`);
      const v = await latest(p.name, p.scope);
      if (v !== expectVersion) throw new VersionConflict(`${p.name} is at v${v}, fit expected v${expectVersion}`);
      try {
        const { rows } = await tx.query(
          `insert into param (user_id, name, scope, family, value_or_hyperparams, prior, version, fitted_on_ids_hash, n_eff, metric, held_out_score, guard_lo, guard_hi, origin, status)
           values ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, 'fit', 'challenger') returning *`,
          [p.scope.person ?? null, p.name, json(p.scope), p.family, JSON.stringify(p.value_or_hyperparams), JSON.stringify(p.prior ?? null), v + 1,
            p.fitted_on_ids_hash, p.n_eff, p.metric, p.held_out_score, p.guard_lo, p.guard_hi]);
        return toParam(rows[0]);
      } catch (e) {
        // A racing fit committed the same version first (unique name, scope, version).
        if ((e as { code?: string }).code === '23505') throw new VersionConflict(`${p.name} version ${v + 1} was taken by a racing fit`);
        throw e;
      }
    },
    async promote(n, s, version, noise, at, champion_score) {
      const rows = await rowsOf(n, s, true);
      const ch = rows.find((p) => p.version === version && p.status === 'challenger');
      if (!ch) return { promoted: false, reason: 'no such challenger' };
      const cur = rows.find((p) => p.status === 'champion');
      if (cur?.frozen) return { promoted: false, reason: 'frozen' };
      const score = champion_score ?? cur?.held_out_score;
      if (cur && score !== null && score !== undefined && (ch.held_out_score ?? -Infinity) - score <= noise)
        return { promoted: false, reason: 'lost held-out' };
      if (cur) {
        await setStatus(n, s, cur.version, 'retired', null); // retire first: one champion per (name, scope)
        if (champion_score !== undefined) await tx.query(
          'update param set held_out_score = $4, updated_at = now() where name = $1 and scope = $2::jsonb and version = $3',
          [n, json(s), cur.version, champion_score]);
      }
      await tx.query('update param set previous_version = $4 where name = $1 and scope = $2::jsonb and version = $3', [n, json(s), ch.version, cur?.version ?? null]);
      await setStatus(n, s, ch.version, 'champion', at);
      return { promoted: true, reason: cur ? `beat v${cur.version}` : 'first champion' };
    },
    async rollback(n, s, at, keep_evidence) {
      const rows = await rowsOf(n, s, true);
      const cur = rows.find((p) => p.status === 'champion');
      if (!cur) throw new Error(`${n} has no champion to roll back`);
      const restored = rollbackRow(rows, cur, at, keep_evidence);
      await setStatus(n, s, cur.version, 'retired', null);
      if (keep_evidence) await insertEvent(restored);
      else await setStatus(n, s, restored.version, 'champion', at);
      return { ...restored, promoted_at: new Date(at).toISOString() };
    },
    async freeze(n, s, on) {
      await tx.query('update param set frozen = $3, updated_at = now() where name = $1 and scope = $2::jsonb', [n, json(s), on]);
    },
    async observe(n, s, o, at) {
      return store.apply(n, s, observationStep(decl(n), o), at, o.days_since_last);
    },
    async apply(n, s, step, at, days) {
      const d = decl(n);
      const base = (await rowsOf(n, s, true)).find((p) => p.status === 'champion');
      if (base?.frozen) return { applied: false, reason: 'frozen', read: await store.read(n, s) };
      const inherited = await store.read(n, s);
      const source = !base && inherited.from !== 'prior' ? (await rowsOf(n, inherited.scope)).find((r) => r.status === 'champion') : undefined;
      const start = base?.value_or_hyperparams ?? source?.value_or_hyperparams ?? d.prior;
      const prior = base?.prior ?? start;
      const keep = forget(elapsed(base, at, days));
      // Explicit caller forgetting wins for this update: restoring full prior mass would pin recovery.
      const next = step(structuredClone(days === undefined ? evidence(d.family, start, prior) : start), keep);
      if (days === undefined) next.value = withPrior(d.family, next.value, prior);
      const mean = summary(d.family, next.value);
      const lo = base?.guard_lo ?? d.guard_lo ?? null, hi = base?.guard_hi ?? d.guard_hi ?? null;
      const anomaly = mean !== undefined && ((lo !== null && mean < lo) || (hi !== null && mean > hi));
      const version = await latest(n, s) + 1;
      if (base) await setStatus(n, s, base.version, 'retired', null);
      await insertEvent({ name: n, scope: s, family: d.family, value_or_hyperparams: next.value, prior, version,
        fitted_on_ids_hash: null, n_eff: (base?.n_eff ?? 0) * keep + next.weight, metric: d.metric ?? null,
        held_out_score: base?.held_out_score ?? null, guard_lo: lo, guard_hi: hi, origin: 'event', previous_version: base?.version ?? null, keep, status: 'champion', frozen: false, promoted_at: at });
      return { applied: true, reason: anomaly ? 'clamped' : 'updated', ...(anomaly ? { anomaly: true } : {}), read: await store.read(n, s) };
    },
  };
  return store;
}

type Status = Param['status'];
export type { Read };
