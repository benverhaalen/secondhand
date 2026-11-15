// The SQL-backed param store (spec/product.md §6 "Real-time weights"; table db/migrations/0004_param.sql).
// It never opens or commits a transaction: the caller hands it the tx that writes the outcome event, so observe() and the event commit or roll back together.
// Row security does the person isolation: the caller's tx has app.user_id set, and user_id is set exactly when scope.person is.
import { FORGET_DAYS, lineage, scopeKey, Unknown, VersionConflict } from './param.ts';
import type { Declared, Param, ParamStore, Read, Scope } from './param.ts';

export type Tx = { query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> };

// ParamStore with Promise returns; declare stays synchronous (priors live in memory).
type Async<T> = { [K in keyof T]: T[K] extends (...a: infer A) => infer R ? (K extends 'declare' ? T[K] : (...a: A) => Promise<R>) : T[K] };
export type AsyncParamStore = Async<ParamStore>;

const json = (s: Scope) => JSON.stringify(s); // undefined keys drop out
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const iso = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : String(v));
const toParam = (r: any): Param => ({
  name: r.name, scope: r.scope, family: r.family, value_or_hyperparams: r.value_or_hyperparams, prior: r.prior, version: Number(r.version),
  fitted_on_ids_hash: r.fitted_on_ids_hash, n_eff: Number(r.n_eff), metric: r.metric, held_out_score: num(r.held_out_score),
  guard_lo: num(r.guard_lo), guard_hi: num(r.guard_hi), status: r.status, frozen: r.frozen, promoted_at: iso(r.promoted_at),
});

export function sqlStore(tx: Tx): AsyncParamStore {
  const declared = new Map<string, Declared>();
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

  const store: AsyncParamStore = {
    declare(d) { declared.set(d.name, d); },
    rows: (n, s) => rowsOf(n, s),
    async read(n, s) {
      const d = decl(n);
      const line = lineage(s);
      // One query over the whole lineage; the most specific champion wins.
      const { rows } = await tx.query(
        "select * from param where name = $1 and status = 'champion' and scope in (select jsonb_array_elements($2::jsonb))", [n, JSON.stringify(line)]);
      const byKey = new Map(rows.map(toParam).map((p) => [scopeKey(p.scope), p]));
      for (let i = 0; i < line.length; i++) {
        const c = byKey.get(scopeKey(line[i]));
        if (c) return { value: c.value_or_hyperparams, version: c.version, n_eff: c.n_eff, from: i === 0 ? 'row' : 'parent', scope: line[i] };
      }
      return { value: d.prior, version: 0, n_eff: 0, from: 'prior', scope: {} };
    },
    async propose(p, expectVersion) {
      decl(p.name);
      if (p.held_out_score === null || p.held_out_score === undefined || Number.isNaN(p.held_out_score))
        throw new Error(`a fit wrote ${p.name} without its held-out score`);
      const v = await latest(p.name, p.scope);
      if (v !== expectVersion) throw new VersionConflict(`${p.name} is at v${v}, fit expected v${expectVersion}`);
      try {
        const { rows } = await tx.query(
          `insert into param (user_id, name, scope, family, value_or_hyperparams, prior, version, fitted_on_ids_hash, n_eff, metric, held_out_score, guard_lo, guard_hi, status)
           values ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, 'challenger') returning *`,
          [p.scope.person ?? null, p.name, json(p.scope), p.family, JSON.stringify(p.value_or_hyperparams), JSON.stringify(p.prior ?? null), v + 1,
            p.fitted_on_ids_hash, p.n_eff, p.metric, p.held_out_score, p.guard_lo, p.guard_hi]);
        return toParam(rows[0]);
      } catch (e) {
        // A racing fit committed the same version first (unique name, scope, version).
        if ((e as { code?: string }).code === '23505') throw new VersionConflict(`${p.name} version ${v + 1} was taken by a racing fit`);
        throw e;
      }
    },
    async promote(n, s, version, noise, at) {
      const rows = await rowsOf(n, s, true);
      const ch = rows.find((p) => p.version === version && p.status === 'challenger');
      if (!ch) return { promoted: false, reason: 'no such challenger' };
      const cur = rows.find((p) => p.status === 'champion');
      if (cur?.frozen) return { promoted: false, reason: 'frozen' };
      if (cur && cur.held_out_score !== null && (ch.held_out_score ?? -Infinity) - cur.held_out_score <= noise)
        return { promoted: false, reason: 'lost held-out' };
      if (cur) await setStatus(n, s, cur.version, 'retired', null); // retire first: one champion per (name, scope)
      await setStatus(n, s, ch.version, 'champion', at);
      return { promoted: true, reason: cur ? `beat v${cur.version}` : 'first champion' };
    },
    async rollback(n, s, at) {
      const rows = await rowsOf(n, s, true);
      const cur = rows.find((p) => p.status === 'champion');
      if (!cur) throw new Error(`${n} has no champion to roll back`);
      const prev = rows.filter((p) => p.version < cur.version && p.promoted_at !== null).sort((a, b) => b.version - a.version)[0];
      if (!prev) throw new Error(`${n} has no earlier promoted version`);
      await setStatus(n, s, cur.version, 'retired', null);
      await setStatus(n, s, prev.version, 'champion', at);
      return { ...prev, status: 'champion', promoted_at: new Date(at).toISOString() };
    },
    async freeze(n, s, on) {
      await tx.query('update param set frozen = $3, updated_at = now() where name = $1 and scope = $2::jsonb', [n, json(s), on]);
    },
    async observe(n, s, o, at) {
      const d = decl(n);
      if (d.family !== 'beta') throw new Error(`observe supports beta params; ${n} is ${d.family}`);
      const base = (await rowsOf(n, s, true)).find((p) => p.status === 'champion');
      if (base?.frozen) return { applied: false, reason: 'frozen', read: await store.read(n, s) };
      const start = (base?.value_or_hyperparams ?? (await store.read(n, s)).value) as { alpha: number; beta: number };
      const keep = Math.exp(-(o.days_since_last ?? 0) / FORGET_DAYS);
      const next = { alpha: start.alpha * keep + o.weight * o.success, beta: start.beta * keep + o.weight * (1 - o.success) };
      const mean = next.alpha / (next.alpha + next.beta);
      const lo = base?.guard_lo ?? d.guard_lo ?? null, hi = base?.guard_hi ?? d.guard_hi ?? null;
      if ((lo !== null && mean < lo) || (hi !== null && mean > hi)) return { applied: false, reason: 'guard', read: await store.read(n, s) };
      const version = await latest(n, s) + 1;
      if (base) await setStatus(n, s, base.version, 'retired', null);
      await tx.query(
        `insert into param (user_id, name, scope, family, value_or_hyperparams, prior, version, n_eff, metric, held_out_score, guard_lo, guard_hi, status, promoted_at)
         values ($1, $2, $3::jsonb, 'beta', $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, 'champion', $12::timestamptz)`,
        [s.person ?? null, n, json(s), JSON.stringify(next), JSON.stringify(d.prior), version, (base?.n_eff ?? 0) * keep + o.weight, d.metric ?? null,
          base?.held_out_score ?? null, lo, hi, at]);
      return { applied: true, reason: 'updated', read: await store.read(n, s) };
    },
  };
  return store;
}

type Status = Param['status'];
export type { Read };
