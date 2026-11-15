// pl-1: the event-to-job pipeline. One claimed job at a time per account session, the §5 policy check in code before
// every write verb, durable stages, and the harness error envelope turned into job states (spec/product.md §4 to §6;
// protocol-and-adapters.md §3.6). Design: app/src/edge/events/README.md.
//
// How a job runs: claim (skip locked) -> take the account lease (busy: give the claim back, stay queued) -> run its
// handler -> settle. A handler's steps are named stages on the job row (`job.stages`). A stage that arrived is never run
// again. A write stage left `started` with no `arrived` (the worker died mid-call) is never replayed: it is settled by a
// read-back with the same operation_id (`${job.id}:${verb}`); if the read cannot confirm it landed the job fails
// `outcome_unknown` and a decision is raised. That is what DBOS gives for free; here the Store carries it.
//
// Error envelope -> state: auth_expired pauses the job (kept, resumes on relink); rate_limited requeues after
// hint.after_s; blocked fails and raises site_warning; policy_refused raises the hinted decision; a `reconcile`
// hint starts a reconcile job; anything else fails with the code.
//
// JOIN: with DBOS (workflow = handler, step = stage, recovery replaces the `started` rule), db-1 (Store tables;
// `next_run_at` on job is added there, here it rides as an extra field), hp-1 (the real Harness replaces HarnessLike;
// the read-back `data.landed === true` shape is assumed and settles with hp-1). Never log message text or tokens:
// this file logs ids, kinds, codes and counts only.
import { confirmedOrder } from '../delist/delist.ts';
import { check } from './policy.ts';
import type { PolicyInput, PolicyResult } from './policy.ts';
import type { EventRow } from './event.ts';
import type { Envelope, HarnessError, HarnessLike, JobRow, Leases, Params, Stage, Store } from './ports.ts';

export interface PipelineLog {
  job(job: string, kind: string, state: string, fields?: Record<string, unknown>): unknown;
  stage(job: string, stage: string, fields?: Record<string, unknown>): unknown;
  ask(decision: string, kind: string, tier: string, fields?: Record<string, unknown>): unknown;
  error(where: string, e: unknown, fields?: Record<string, unknown>): unknown;
  event(name: string, fields?: Record<string, unknown>, level?: string): unknown;
}
export type EngineSettlement =
  | { settle: 'pause'; err: { code: string; message: string } }
  | { settle: 'later'; after_s: number; err?: { code: string; message: string } }
  | { settle: 'fail'; err: { code: string; message: string } };

function engineSettlement(value: unknown): value is EngineSettlement {
  return !!value && typeof value === 'object' && 'settle' in value && ['pause', 'later', 'fail'].includes(String(value.settle));
}

export type Engine = (job: JobRow) => unknown | Promise<unknown>;
export interface PipelineDeps {
  store: Store; harness: HarnessLike; leases: Leases; params: Params; log: PipelineLog;
  engines: Record<string, Engine>; now: () => number; worker: string;
  policy?: (i: PolicyInput) => PolicyResult;
  promoted?: (user_id: string) => Set<string>;
  onStale?: (job: JobRow, error: { code: string; message: string }) => void;
}

// product.md §6 verbs that change a site; each is policy-checked and stage-guarded.
export const WRITE_VERBS = new Set(['post', 'revise', 'relist', 'end', 'save', 'send_message', 'answer_offer', 'make_offer']);

type Err = { code: string; message: string };
type Outcome =
  | { k: 'refused'; kind?: string }
  | { k: 'pause'; err: Err }
  | { k: 'later'; after_s: number }
  | { k: 'fail'; err: Err; decision?: string; subject?: string; reconcile?: string };
class Stop { o: Outcome; constructor(o: Outcome) { this.o = o; } }

interface Ctx {
  act(job: JobRow, verb: string, decision_kind: string, extra?: Record<string, unknown>): Promise<unknown>;
  read(job: JobRow, verb: string, extra?: Record<string, unknown>): Promise<unknown>;
  raise(job: JobRow, kind: string, subject?: string): string;
  store: Store; engines: Record<string, Engine>; eventOf(job: JobRow): EventRow | undefined;
}
export type Handler = (c: Ctx, job: JobRow) => Promise<unknown>;

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const kindArg = (j: JobRow, d: string) => str(j.args.decision_kind) ?? d;

const own: Record<string, Handler> = {
  post: (c, j) => {
    const a = c.eventOf(j)?.action;
    if (a === 'app.relist') return c.act(j, 'relist', 'relist');
    if (a === 'app.reprice') return c.act(j, 'revise', 'markdown');
    return c.act(j, 'post', 'first_post');
  },
  delist: (c, j) => c.act(j, 'end', 'delist_after_sale', c.eventOf(j)?.action === 'app.delete' ? { remove: true } : {}),
  send_message: (c, j) => c.act(j, 'send_message', kindArg(j, 'reply_other')),
  answer_offer: (c, j) => c.eventOf(j)?.action === 'app.confirm'
    ? c.act(j, 'answer_offer', 'confirm_trade', { response: 'accept' }) : c.act(j, 'answer_offer', kindArg(j, 'counter_offer')),
  make_offer: (c, j) => c.act(j, 'make_offer', 'buy_offer'),
  // sold's confirm (sd-1) registers here: the signed-in read, the order, then the delist fan-out
  poll_orders: (c, j) => (c.engines.poll_orders ? Promise.resolve(c.engines.poll_orders(j)) : c.read(j, 'read_orders')),
  poll_inbox: (c, j) => c.read(j, 'read_inbox'),
  reconcile: (c, j) => c.read(j, 'read_listings'),
  async relink(c, j) {
    const acc = j.account_id ?? j.id;
    if (c.eventOf(j)?.action !== 'account_relinked') return { decision: c.raise(j, 'relink', acc) };
    let resumed = 0;
    for (const p of c.store.jobs({ account_id: j.account_id })) if (p.paused) { c.store.updateJob(p.id, { paused: undefined }); resumed++; }
    for (const d of c.store.decisions({ kind: 'relink', subject: acc, state: 'open' })) c.store.updateDecision(d.id, { state: 'answered' });
    return { resumed };
  },
};
// Every other job kind belongs to another stream's engine, handed in through `engines`.
const ENGINE_KINDS = ['capture_judge', 'defect_propose', 'folder_group', 'measure', 'identify', 'studio', 'valuate', 'draft', 'share',
  'promote_spend', 'end_unsold', 'label', 'watch_run', 'search', 'assist', 'poll_stats', 'route_probe', 'adapter_author', 'param_fold',
  'import', 'unlink', 'check_due', 'observe_rank', 'fit_ranker', 'score', 'run_experiment', 'market_refresh', 'notify_follow',
  'export_user', 'delete_user', 'sweep'];
export const HANDLERS: Record<string, Handler> = { ...own };
for (const k of ENGINE_KINDS) {
  HANDLERS[k] = async (c, j) => {
    const e = c.engines[k];
    if (!e) throw new Stop({ k: 'fail', err: { code: 'no_engine', message: `no_engine: ${k}` } });
    return e(j);
  };
}

const FAILED_KIND = (verb: string) => (verb === 'end' ? 'failed_delist' : ['post', 'revise', 'relist', 'save'].includes(verb) ? 'failed_post' : 'site_warning');
const READ_BACK = (verb: string) => (['send_message', 'answer_offer', 'make_offer'].includes(verb) ? 'read_inbox' : 'read_listings');
const WITH_LEASE = new Set([...Object.keys(own)].filter(k => k !== 'relink'));

function stopOf(job: JobRow, verb: string, e: HarnessError): Stop {
  const h = e.hint ?? { do: '' };
  const err = { code: e.code, message: e.message };
  if (e.code === 'auth_expired') return new Stop({ k: 'pause', err });
  if (e.code === 'rate_limited' || h.do === 'retry_after') return new Stop({ k: 'later', after_s: typeof h.after_s === 'number' ? h.after_s : 60 });
  if (e.code === 'policy_refused') return new Stop({ k: 'refused', kind: h.do === 'raise_decision' ? str(h.kind) : undefined });
  if (e.code === 'blocked') return new Stop({ k: 'fail', err, decision: 'site_warning', subject: job.account_id });
  if (h.do === 'reconcile') return new Stop({ k: 'fail', err, reconcile: str(h.operation_id) ?? `${job.id}:${verb}` });
  return new Stop({ k: 'fail', err });
}

export function createPipeline(d: PipelineDeps) {
  const { store, harness, leases, params, log, engines, now, worker } = d;
  const policy = d.policy ?? check;
  const iso = () => new Date(now()).toISOString();
  const stageOf = (id: string, name: string) => store.getJob(id)?.stages.find(s => s.name === name);
  const put = (id: string, name: string, patch: Partial<Stage>) => {
    const cur = store.getJob(id)!;
    const old = cur.stages.find(s => s.name === name);
    const next = { ...old, name, ...patch } as Stage;
    store.updateJob(id, { stages: old ? cur.stages.map(s => (s === old ? next : s)) : [...cur.stages, next] });
    log.stage(id, name, { state: next.state });
  };
  const eventOf = (j: JobRow) => store.events({ user_id: j.user_id }).find(e => e.id === j.event_id);

  const raise = (j: JobRow, kind: string, subject?: string) => {
    const r = store.raiseDecision({
      user_id: j.user_id, kind, subject: subject ?? j.item_id ?? j.account_id ?? j.id, item_id: j.item_id, job_id: j.id,
      why: `${kind.replace(/_/g, ' ')} needs your say.`, options: [{ id: 'yes', label: 'Do it' }, { id: 'no', label: 'Not now' }], suggested: 'yes',
    });
    if (!r.duplicate) log.ask(r.row.id, kind, 'ask', { job: j.id });
    return r.row.id;
  };

  async function call(j: JobRow, verb: string, args: Record<string, unknown>, stage?: string): Promise<unknown> {
    const env: Envelope = await harness.call(j.site!, verb, args);
    if (env.ok) return env.data;
    if (stage) put(j.id, stage, { state: 'failed', ended_at: iso() });
    throw stopOf(j, verb, env.error);
  }
  const baseArgs = (j: JobRow, verb: string) => ({
    ...j.args, account_id: j.account_id, operation_id: `${j.id}:${verb}`,
    ...(j.item_id && { item_id: j.item_id }), ...(j.listing_id && { listing_id: j.listing_id }),
  });

  const ctx: Ctx = {
    store, engines, eventOf, raise,
    async read(j, verb, extra = {}) {
      const st = stageOf(j.id, verb);
      if (st?.state === 'arrived') return st.result;
      put(j.id, verb, { state: 'running', started_at: iso() });
      const data = await call(j, verb, { ...baseArgs(j, verb), ...extra }, verb);
      put(j.id, verb, { state: 'arrived', result: data, ended_at: iso() });
      return data;
    },
    async act(j, verb, decision_kind, extra = {}) {
      const saleDelist = verb === 'end' && j.args.decision_kind === 'delist_after_sale';
      if (saleDelist && !confirmedOrder(store, j)) throw new Stop({ k: 'refused', kind: 'failed_delist' });
      const st = stageOf(j.id, verb);
      if (st?.state === 'arrived') return st.result;
      const op = `${j.id}:${verb}`;
      if (st?.state === 'started') { // died mid-write: never replay, read back with the same operation_id
        const back = await call(j, READ_BACK(verb), { account_id: j.account_id, operation_id: op });
        if ((back as { landed?: boolean } | undefined)?.landed === true) { put(j.id, verb, { state: 'arrived', result: back, ended_at: iso() }); return back; }
        put(j.id, verb, { state: 'failed', ended_at: iso() });
        throw new Stop({ k: 'fail', err: { code: 'outcome_unknown', message: `${verb} may not have landed` }, decision: FAILED_KIND(verb) });
      }
      const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
      const r = policy({
        action: verb, decision_kind, actor: eventOf(j)?.actor ?? 'auto', price_cents: saleDelist ? undefined : num(j.args.price_cents), floor_cents: saleDelist ? undefined : num(j.args.floor_cents),
        always_accept_cents: num(j.args.always_accept_cents), promoted: (d.promoted ?? (() => new Set<string>()))(j.user_id), site: j.site ?? '',
      });
      if (!r.allow) {
        log.event('note', { msg: `policy refused ${r.decision_kind}`, job: j.id, mode: r.mode });
        throw new Stop({ k: 'refused', kind: r.mode === 'never' ? undefined : r.decision_kind });
      }
      put(j.id, verb, { state: 'started', started_at: iso() });
      const data = await call(j, verb, { ...baseArgs(j, verb), ...extra }, verb);
      put(j.id, verb, { state: 'arrived', result: data, ended_at: iso() });
      return data;
    },
  };

  function settle(j: JobRow, o: Outcome) {
    if (o.k === 'pause') {
      store.updateJob(j.id, { paused: 'account_stale', state: 'queued', error: o.err });
      raise(j, 'relink', j.account_id ?? j.id);
      log.job(j.id, j.kind, 'paused', { code: o.err.code });
      d.onStale?.(j, o.err);
    } else if (o.k === 'later') {
      store.updateJob(j.id, { state: 'queued', next_run_at: new Date(now() + o.after_s * 1000).toISOString() } as Partial<JobRow>);
      log.job(j.id, j.kind, 'queued', { after_s: o.after_s });
    } else if (o.k === 'refused') {
      store.updateJob(j.id, { state: 'done', result: { refused: o.kind ? raise(j, o.kind) : 'never' } });
      log.job(j.id, j.kind, 'done', { refused: o.kind ?? 'never' });
    } else {
      if (o.decision) raise(j, o.decision, o.subject);
      if (o.reconcile) {
        store.insertJob({ kind: 'reconcile', user_id: j.user_id, event_id: j.event_id, idempotency_key: `reconcile:${j.id}`, site: j.site,
          account_id: j.account_id, item_id: j.item_id, listing_id: j.listing_id, args: { operation_id: o.reconcile }, state: 'queued',
          stages: [], attempts: 0, trace_id: j.trace_id, created_at: iso() });
      }
      store.updateJob(j.id, { state: 'failed', error: o.err });
      log.job(j.id, j.kind, 'failed', { code: o.err.code });
    }
  }

  async function runJob(j: JobRow) {
    const wait = (j as JobRow & { next_run_at?: string }).next_run_at;
    if (wait && Date.parse(wait) > now()) { store.release(j.id); return; }
    const leased = !!j.account_id && WITH_LEASE.has(j.kind);
    if (leased && !leases.take(j.account_id!, j.id, params.get('job_lease_ttl_ms', { site: j.site })).ok) { store.release(j.id); return; }
    try {
      store.updateJob(j.id, { state: 'running', attempts: j.attempts + 1 });
      log.job(j.id, j.kind, 'running');
      const h = HANDLERS[j.kind];
      if (!h) throw new Stop({ k: 'fail', err: { code: 'no_handler', message: `no_handler: ${j.kind}` } });
      const result = await h(ctx, store.getJob(j.id)!);
      if (engineSettlement(result)) {
        if (result.settle === 'later' && result.err) store.updateJob(j.id, { error: result.err });
        if (result.settle === 'later') settle(store.getJob(j.id)!, { k: 'later', after_s: result.after_s });
        else settle(store.getJob(j.id)!, { k: result.settle, err: result.err });
        return;
      }
      store.updateJob(j.id, { state: 'done', result });
      log.job(j.id, j.kind, 'done');
    } catch (e) {
      if (e instanceof Stop) {
        if (e.o.k === 'fail' && e.o.err.code === 'no_engine') log.error('pipeline.engine', new Error(e.o.err.message), { job: j.id, kind: j.kind });
        settle(store.getJob(j.id)!, e.o);
      } else {
        log.error('pipeline.job', e, { job: j.id, kind: j.kind });
        settle(store.getJob(j.id)!, { k: 'fail', err: { code: 'internal', message: 'job crashed' } });
      }
    } finally {
      if (leased) leases.give(j.account_id!, j.id);
      store.release(j.id);
    }
  }

  return {
    // claim up to `limit` queued jobs and run them at once; returns how many were claimed
    async runOnce(limit: number) {
      const claimed = store.claimJobs(limit, worker);
      await Promise.all(claimed.map(runJob));
      return claimed.length;
    },
  };
}
