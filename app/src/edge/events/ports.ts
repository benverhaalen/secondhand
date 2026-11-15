// The ports stream 2 builds against, each with an in-memory fake. They stand in for db-1 (Lakebase tables),
// hp-1/hp-2 (harness.call, session lease) and pr-1 (params) until those land; then each fake is swapped
// for the real one behind the same shape. Design: app/src/edge/events/README.md.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { EventKind, EventRow, Site } from './event.ts';

// ---- names (product.md §4 job kinds, §5 decision kinds; NEW ones are asked of the orchestrator) ----
export type JobKind =
  | 'post' | 'delist' | 'send_message' | 'poll_inbox' | 'poll_orders' | 'reconcile' | 'score' | 'check_due'
  | 'answer_offer' | 'make_offer' | 'sweep' | 'relink' // these four NEW
  | 'identify' | 'valuate' | 'search' | 'delete_user' | 'export_user';
export type JobState = 'queued' | 'running' | 'done' | 'failed';
export type Mode = 'auto' | 'ask' | 'locked';

export interface Stage { name: string; state: 'started' | 'running' | 'arrived' | 'planned' | 'failed'; result?: unknown; started_at?: string; ended_at?: string | null; found?: object }
export interface JobRow {
  id: string;
  kind: JobKind;
  user_id: string;
  event_id: string;
  idempotency_key: string; // = the event's dedupe_key: one event, one job
  site?: Site;
  account_id?: string;
  item_id?: string;
  listing_id?: string;
  args: Record<string, unknown>;
  state: JobState;
  paused?: 'account_stale' | 'workspace_port_not_configured';
  reason?: string;
  stages: Stage[]; // the durable checkpoints: a stage with state arrived is never run again
  attempts: number;
  result?: unknown;
  error?: { code: string; message: string };
  trace_id: string;
  created_at: string;
}

export interface DecisionRow {
  id: string;
  version?: number;
  data?: 'synthetic' | 'example' | `dataset:${string}` | `live:${string}` | 'captured';
  user_id: string;
  kind: string; // product.md §5 decision kinds
  subject: string; // what it is about (item, account, listing); one open decision per (kind, subject)
  item_id?: string;
  job_id?: string;
  why: string;
  options: { id: string; label: string }[];
  suggested?: string;
  deadline?: string;
  state: 'open' | 'acting' | 'answered' | 'failed' | 'expired' | 'superseded';
}

// ---- the event → job routing table: each row starts exactly one job of this kind ----
export const JOB_FOR: Record<EventKind, JobKind> = {
  'offer.received': 'answer_offer',
  'message.received': 'send_message',
  'listing.sold': 'poll_orders', // the signed-in read confirms before anything acts (§3.6)
  'listing.ended': 'reconcile',
  'like.added': 'answer_offer', // offer to likers/watchers
  'price.changed': 'reconcile',
  'order.updated': 'poll_orders',
  value_moved: 'score',
  demand_rose: 'score',
  account_stale: 'relink',
  account_relinked: 'relink',
  'app.list': 'post',
  'app.relist': 'post',
  'app.reprice': 'post',
  'app.delist': 'delist',
  'app.delete': 'delist',
  'app.offer': 'answer_offer',
  'app.message': 'send_message',
  'app.confirm': 'answer_offer',
};

// ---- the store: db-1's event, job, outbox and decision tables ----
export const TABLES = ['item', 'listing', 'account', 'limits', 'rule', 'want', 'match', 'order', 'conversation', 'offer', 'operation'] as const;
export type Table = (typeof TABLES)[number];
export type Row = { id: string; user_id: string; version?: number } & Record<string, unknown>;
export interface StoreState {
  events: EventRow[];
  jobs: JobRow[];
  decisions: DecisionRow[];
  rows: Partial<Record<Table, Row[]>>;
}

export interface Store {
  deleteUser(user_id: string): { events: number; jobs: number; decisions: number; rows: Record<Table, number> };
  exportUser(user_id: string): StoreState;
  put<T extends Row>(table: Table, row: T): T & { version: number };
  get<T extends Row>(table: Table, user_id: string, id: string): T | undefined;
  rows<T extends Row>(table: Table, filter: { user_id: string } & Record<string, unknown>): T[];
  // Cross-tenant read for system work; never called from a route handler.
  systemRows<T extends Row>(table: Table, filter?: Record<string, unknown>): T[];
  beginOperation(op: { id: string; user_id: string; site: string; verb: string; sku_hash?: string; data: 'synthetic' | 'example' | `dataset:${string}` | `live:${string}`; at: string }): { row: Row; duplicate: boolean };
  settleOperation(user_id: string, id: string, patch: { state: 'done' | 'unknown'; envelope?: unknown; attempts?: number; at: string }): Row;
  // unique (user_id, dedupe_key); a repeat returns the first row with duplicate true
  insertEvent(e: Omit<EventRow, 'id'>): { row: EventRow; duplicate: boolean };
  // unique (user_id, idempotency_key)
  insertJob(j: Omit<JobRow, 'id'>): { row: JobRow; duplicate: boolean };
  getJob(id: string): JobRow | undefined;
  updateJob(id: string, patch: Partial<JobRow>): JobRow;
  // FOR UPDATE SKIP LOCKED: queued, not paused, not claimed; claimed rows are invisible to other claimers
  claimJobs(limit: number, worker: string): JobRow[];
  release(id: string): void; // a worker died or gave up its claim
  jobs(filter?: Partial<Pick<JobRow, 'state' | 'account_id' | 'kind' | 'user_id' | 'item_id' | 'site'>>): JobRow[];
  events(filter?: Partial<Pick<EventRow, 'user_id' | 'item_id' | 'account_id'>>): EventRow[];
  // one open decision per (user_id, kind, subject); a repeat returns the open one with duplicate true
  raiseDecision(d: Omit<DecisionRow, 'id' | 'state'>): { row: DecisionRow; duplicate: boolean };
  decisions(filter?: Partial<Pick<DecisionRow, 'user_id' | 'kind' | 'state' | 'subject'>>): DecisionRow[];
  updateDecision(id: string, patch: Partial<DecisionRow>): DecisionRow;
  // one transaction: every write in fn and its events commit together or not at all (the outbox, ob-1)
  tx<T>(fn: (t: Store) => T): T;
}

let n = 0;
const uid = (p: string) => `${p}_${(++n).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function checkOperationEnvelope(value: unknown, seen = new Set<object>()): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (/cookie|token|authorization|password|set-cookie|buyer_name|address/i.test(key)) {
      throw new Error('operation envelope contains a forbidden key');
    }
    checkOperationEnvelope(nested, seen);
  }
}

export function memoryStore(initial?: StoreState): Store & { claims: Map<string, string>; dump(): StoreState } {
  let { events, jobs, decisions, rows } = structuredClone<StoreState>(initial ?? { events: [], jobs: [], decisions: [], rows: {} });
  const claims = new Map<string, string>();
  const match = <T extends object>(f: Partial<T> | undefined) => (r: T) =>
    !f || Object.entries(f).every(([k, v]) => v === undefined || (r as Record<string, unknown>)[k] === v);
  const s: Store & { claims: Map<string, string>; dump(): StoreState } = {
    claims,
    dump: () => structuredClone({ events, jobs, decisions, rows }),
    exportUser(user_id) {
      return structuredClone({
        events: events.filter(row => row.user_id === user_id),
        jobs: jobs.filter(row => row.user_id === user_id),
        decisions: decisions.filter(row => row.user_id === user_id),
        rows: Object.fromEntries(TABLES.map(table => [table, (rows[table] ?? []).filter(row => row.user_id === user_id)])),
      });
    },
    deleteUser(user_id) {
      return s.tx(() => {
        const counts = { events: 0, jobs: 0, decisions: 0, rows: {} as Record<Table, number> };
        const keep = <T extends { user_id: string }>(list: T[]) => list.filter(row => row.user_id !== user_id);
        counts.events = events.length; events = keep(events); counts.events -= events.length;
        counts.jobs = jobs.length;
        for (const job of jobs) if (job.user_id === user_id) claims.delete(job.id);
        jobs = keep(jobs); counts.jobs -= jobs.length;
        counts.decisions = decisions.length; decisions = keep(decisions); counts.decisions -= decisions.length;
        for (const table of TABLES) {
          const list = rows[table] ?? [];
          counts.rows[table] = list.length;
          if (rows[table]) rows[table] = keep(list);
          counts.rows[table] -= rows[table]?.length ?? 0;
        }
        return counts;
      });
    },
    put(table, row) {
      const tableRows = rows[table] ?? [];
      const i = tableRows.findIndex(r => r.id === row.id && r.user_id === row.user_id);
      const old = tableRows[i];
      if (row.version !== undefined && row.version !== old?.version) {
        throw Object.assign(new Error(`stale ${table} ${row.id}`), { code: 'stale' });
      }
      const stored = { ...row, version: (old?.version ?? 0) + 1 };
      if (i < 0) tableRows.push(stored); else tableRows[i] = stored;
      rows[table] = tableRows;
      return stored;
    },
    get: <T extends Row>(table: Table, user_id: string, id: string) =>
      rows[table]?.find(r => r.id === id && r.user_id === user_id) as T | undefined,
    rows: <T extends Row>(table: Table, filter: { user_id: string } & Record<string, unknown>) =>
      (rows[table] ?? []).filter(r => Object.entries(filter).every(([key, value]) => r[key] === value)) as T[],
    systemRows: <T extends Row>(table: Table, filter: Record<string, unknown> = {}) =>
      (rows[table] ?? []).filter(r => Object.entries(filter).every(([key, value]) => r[key] === value)) as T[],
    beginOperation(op) {
      const old = s.get('operation', op.user_id, op.id);
      if (old) return { row: old, duplicate: true };
      const row = { ...op, state: 'started', attempts: 1, version: 1 };
      (rows.operation ??= []).push(row);
      return { row, duplicate: false };
    },
    settleOperation(user_id, id, patch) {
      const tableRows = rows.operation ?? [];
      const i = tableRows.findIndex(row => row.user_id === user_id && row.id === id);
      if (i < 0) throw new Error(`no operation ${id}`);
      checkOperationEnvelope(patch.envelope);
      const old = tableRows[i];
      if (old.state === 'done') return old;
      const row = { ...old, ...patch, version: (old.version ?? 0) + 1 };
      tableRows[i] = row;
      return row;
    },
    insertEvent(e) {
      const old = events.find(x => x.user_id === e.user_id && x.dedupe_key === e.dedupe_key);
      if (old) return { row: old, duplicate: true };
      const row = { ...e, id: uid('ev') } as EventRow; events.push(row); return { row, duplicate: false };
    },
    insertJob(j) {
      const old = jobs.find(x => x.user_id === j.user_id && x.idempotency_key === j.idempotency_key);
      if (old) return { row: old, duplicate: true };
      const row = { ...j, id: uid('job') } as JobRow; jobs.push(row); return { row, duplicate: false };
    },
    getJob: id => jobs.find(j => j.id === id),
    updateJob(id, patch) {
      const i = jobs.findIndex(j => j.id === id); if (i < 0) throw new Error(`no job ${id}`);
      jobs[i] = { ...jobs[i], ...patch }; return jobs[i];
    },
    claimJobs(limit, worker) {
      const got = jobs.filter(j => j.state === 'queued' && !j.paused && !claims.has(j.id)).slice(0, limit);
      for (const j of got) claims.set(j.id, worker);
      return got;
    },
    release: id => { claims.delete(id); },
    jobs: f => jobs.filter(match(f)),
    events: f => events.filter(match(f)),
    raiseDecision(d) {
      const old = decisions.find(x => x.user_id === d.user_id && x.kind === d.kind && x.subject === d.subject && x.state === 'open');
      if (old) return { row: old, duplicate: true };
      const row: DecisionRow = { ...d, id: uid('dec'), state: 'open' }; decisions.push(row); return { row, duplicate: false };
    },
    decisions: f => decisions.filter(match(f)),
    updateDecision(id, patch) {
      const i = decisions.findIndex(d => d.id === id); if (i < 0) throw new Error(`no decision ${id}`);
      decisions[i] = { ...decisions[i], ...patch }; return decisions[i];
    },
    tx(fn) {
      const saved = s.dump(), savedClaims = new Map(claims);
      try { return fn(s); } catch (e) {
        ({ events, jobs, decisions, rows } = saved);
        claims.clear();
        for (const [id, worker] of savedClaims) claims.set(id, worker);
        throw e;
      }
    },
  };
  return s;
}

// ---- the harness: structurally hp-1's `Harness` (app/src/edge/harness/protocol.ts); account rides in args ----
export type HarnessError = { code: string; message: string; hint: { do: string; [k: string]: unknown } };
export type Envelope<T = unknown> =
  | { ok: true; data: T; meta: { route_id: string; ms: number; fell_back: boolean } }
  | { ok: false; error: HarnessError; meta: { route_id: string; ms: number; fell_back: boolean } };
export interface HarnessLike {
  call<T = unknown>(site: Site, verb: string, args?: Record<string, unknown> & { operation_id?: string; account_id?: string }): Promise<Envelope<T>>;
}
type Script = (args: Record<string, unknown>) => Envelope | Promise<Envelope>;
// A fake harness: a script per `${site}:${verb}`, default ok {}. `calls` records every call in order.
export function fakeHarness(scripts: Record<string, Script> = {}, delayMs = 0) {
  const calls: { site: Site; verb: string; args: Record<string, unknown> }[] = [];
  const meta = { route_id: 'fake', ms: 0, fell_back: false };
  const h: HarnessLike & { calls: typeof calls } = {
    calls,
    async call(site, verb, args = {}) {
      calls.push({ site, verb, args });
      if (delayMs) await new Promise(r => setTimeout(r, delayMs));
      const fn = scripts[`${site}:${verb}`];
      return (fn ? await fn(args) : { ok: true, data: {}, meta }) as never;
    },
  };
  return h;
}

// ---- the session lease: hp-2. One job drives an account's session at a time; busy answers 409. ----
export type Leased<T> = { ok: true; value: T } | { ok: false; status: 409; held_by: string };
export interface Leases {
  withLease<T>(account_id: string, job_id: string, ttl_ms: number, run: () => Promise<T>): Promise<Leased<T>>;
  take(account_id: string, job_id: string, ttl_ms: number): { ok: true } | { ok: false; status: 409; held_by: string };
  give(account_id: string, job_id: string): void;
}
export function memoryLeases(now: () => number = Date.now): Leases {
  const held = new Map<string, { job_id: string; until: number }>();
  const scope = new AsyncLocalStorage<ReadonlyMap<string, string>>();
  const leases: Leases = {
    take(a, j, ttl) {
      const h = held.get(a);
      if (h && h.job_id !== j && h.until > now()) return { ok: false, status: 409, held_by: h.job_id };
      held.set(a, { job_id: j, until: now() + ttl }); return { ok: true };
    },
    give(a, j) { if (held.get(a)?.job_id === j) held.delete(a); },
    async withLease(a, job, ttl, run) {
      const inherited = scope.getStore()?.get(a);
      if (inherited) {
        const current = held.get(a);
        if (current?.job_id !== inherited || current.until <= now()) return { ok: false, status: 409, held_by: current?.job_id ?? '' };
        const value = await run(), after = held.get(a);
        return after?.job_id === inherited && after.until > now()
          ? { ok: true, value } : { ok: false, status: 409, held_by: after?.job_id ?? '' };
      }
      const owner = `scope:${job}:${randomUUID()}`, taken = leases.take(a, owner, ttl);
      if (!taken.ok) return taken;
      let lost = false;
      const owns = () => { const current = held.get(a); return current?.job_id === owner && current.until > now(); };
      const renew = setInterval(() => {
        if (!owns()) { lost = true; clearInterval(renew); return; }
        if (!leases.take(a, owner, ttl).ok) lost = true;
      }, Math.max(1, Math.floor(ttl / 3)));
      renew.unref();
      const owners = new Map(scope.getStore()); owners.set(a, owner);
      try {
        const value = await scope.run(owners, run);
        return lost || !owns() ? { ok: false, status: 409, held_by: held.get(a)?.job_id ?? '' } : { ok: true, value };
      }
      finally { clearInterval(renew); leases.give(a, owner); }
    },
  };
  return leases;
}

// ---- params: pr-1. Every cadence, budget and threshold is read here with its scope, never a constant. ----
export interface Params { get(name: string, scope?: { site?: string; segment?: string; kind?: string; person?: string }): number }
export function memoryParams(priors: Record<string, number>, rows: Record<string, number> = {}): Params & { set(key: string, v: number): void } {
  // key form: `name` or `name@site` or `name@site/segment`; the most specific row wins, then the prior
  return {
    get(name, scope = {}) {
      const keys = [scope.site && scope.segment && `${name}@${scope.site}/${scope.segment}`, scope.site && `${name}@${scope.site}`, name].filter(Boolean) as string[];
      for (const k of keys) if (k in rows) return rows[k];
      if (name in priors) return priors[name];
      throw new Error(`param ${name} has no prior`);
    },
    set(k, v) { rows[k] = v; },
  };
}
