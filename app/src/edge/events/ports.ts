// The ports stream 2 builds against, each with an in-memory fake. They stand in for db-1 (Lakebase tables),
// hp-1/hp-2 (harness.call, session lease) and pr-1 (params) until those land; then each fake is swapped
// for the real one behind the same shape. Design: app/src/edge/events/README.md.
import type { EventKind, EventRow, Site } from './event.ts';

// ---- names (product.md §4 job kinds, §5 decision kinds; NEW ones are asked of the orchestrator) ----
export type JobKind =
  | 'post' | 'delist' | 'send_message' | 'poll_inbox' | 'poll_orders' | 'reconcile' | 'score' | 'check_due'
  | 'answer_offer' | 'make_offer' | 'sweep' | 'relink'; // last four NEW
export type JobState = 'queued' | 'running' | 'done' | 'failed';
export type Mode = 'auto' | 'ask' | 'locked';

export interface Stage { name: string; state: 'started' | 'running' | 'arrived' | 'failed'; result?: unknown; started_at?: string; ended_at?: string }
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
  paused?: 'account_stale'; // NEW: a paused job is kept, never dropped, and resumes on relink
  stages: Stage[]; // the durable checkpoints: a stage with state arrived is never run again
  attempts: number;
  result?: unknown;
  error?: { code: string; message: string };
  trace_id: string;
  created_at: string;
}

export interface DecisionRow {
  id: string;
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
export interface Store {
  // unique (user_id, dedupe_key); a repeat returns the first row with duplicate true
  insertEvent(e: Omit<EventRow, 'id'>): { row: EventRow; duplicate: boolean };
  // unique (user_id, idempotency_key)
  insertJob(j: Omit<JobRow, 'id'>): { row: JobRow; duplicate: boolean };
  getJob(id: string): JobRow | undefined;
  updateJob(id: string, patch: Partial<JobRow>): JobRow;
  // FOR UPDATE SKIP LOCKED: queued, not paused, not claimed; claimed rows are invisible to other claimers
  claimJobs(limit: number, worker: string): JobRow[];
  release(id: string): void; // a worker died or gave up its claim
  jobs(filter?: Partial<Pick<JobRow, 'state' | 'account_id' | 'kind' | 'user_id' | 'item_id'>>): JobRow[];
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

export function memoryStore(): Store & { claims: Map<string, string> } {
  let events: EventRow[] = [], jobs: JobRow[] = [], decisions: DecisionRow[] = [];
  const claims = new Map<string, string>();
  const match = <T extends object>(f: Partial<T> | undefined) => (r: T) =>
    !f || Object.entries(f).every(([k, v]) => v === undefined || (r as Record<string, unknown>)[k] === v);
  const s: Store & { claims: Map<string, string> } = {
    claims,
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
      const row: DecisionRow = { ...d, id: uid('dc'), state: 'open' }; decisions.push(row); return { row, duplicate: false };
    },
    decisions: f => decisions.filter(match(f)),
    updateDecision(id, patch) {
      const i = decisions.findIndex(d => d.id === id); if (i < 0) throw new Error(`no decision ${id}`);
      decisions[i] = { ...decisions[i], ...patch }; return decisions[i];
    },
    tx(fn) {
      const saved = [structuredClone(events), structuredClone(jobs), structuredClone(decisions)] as const;
      try { return fn(s); } catch (e) { [events, jobs, decisions] = saved.map(x => structuredClone(x)) as [EventRow[], JobRow[], DecisionRow[]]; throw e; }
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
export interface Leases {
  take(account_id: string, job_id: string, ttl_ms: number): { ok: true } | { ok: false; status: 409; held_by: string };
  give(account_id: string, job_id: string): void;
}
export function memoryLeases(now: () => number = Date.now): Leases {
  const held = new Map<string, { job_id: string; until: number }>();
  return {
    take(a, j, ttl) {
      const h = held.get(a);
      if (h && h.job_id !== j && h.until > now()) return { ok: false, status: 409, held_by: h.job_id };
      held.set(a, { job_id: j, until: now() + ttl }); return { ok: true };
    },
    give(a, j) { if (held.get(a)?.job_id === j) held.delete(a); },
  };
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
