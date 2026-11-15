// Plan and run (spec/engines/intelligence-api.md §3.1 steps 3–7): index first, every target at once, a hedged waterfall
// inside each target, single flight and a cache, and the answer streamed as each target arrives.
// From the expert session (agent proposal, research/cross-cutting/nate/intelligence-api-expert-session.md): the hedge trigger
// (route p95) and the give-up bound (target deadline) are two values; a hedge never sends a second call to the same host;
// the single-flight key carries the freshness class; a failed shared call is never cached; a block is not an empty result.
import { memoryStore } from '../../engines/param/param.ts';
import { emptyFound, type Answer, type AnswerEvent, type Fact, type OnAnswer, type Outcome, type QuestionKind, type Searched } from './answer.ts';

export type Priority = 'person' | 'gather' | 'refresh';
export interface Pace { per_minute: number; min_gap_ms: number }
export type PacedSearched = Searched & { pace?: Pace; detail?: unknown };
export type RunAnswer = Omit<Answer, 'searched'> & { searched: PacedSearched[] };
export interface RouteOut { outcome: Outcome; rows: unknown[]; site?: string; detail?: unknown }
export interface Route {
  route_id: string; host: string; p95_ms: number; cache?: boolean;
  site?: string; lane?: string; pace?: Pace;
  run(query: string, ctx: { signal: AbortSignal; priority: Priority; readEnded: () => void }): Promise<RouteOut>;
}
export interface PlanTarget { target_id: string; query: string; deadline_ms: number; routes: Route[]; freshness_s: number }
export interface Arrival { target_id: string; route_id: string; rows: unknown[]; site?: string; ms: number }
export interface Plan {
  kind: QuestionKind; slots: Record<string, unknown>; protocol_version: number;
  signal?: AbortSignal; targets: PlanTarget[]; first_ms: number; settled_ms: number; priority?: Priority;
  index?: Fact[]; // facts the standing index already answers fresh (step 3); their targets are left out of the plan by the caller
  calculate(arrivals: Arrival[]): { facts: Fact[]; found?: Partial<Answer['found']> };
}

export const normalize = (q: string) => q.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

// int-search-1 priors; tunable through the shared param registry.
export const searchParams = memoryStore();
searchParams.declare({ name: 'search_cache_max', family: 'scalar', prior: 500, guard_lo: 0 });
searchParams.declare({ name: 'search_frame_ttl_s', family: 'scalar', prior: 3600, guard_lo: 0 });
searchParams.declare({ name: 'job_fill_grace_s', family: 'scalar', prior: 60, guard_lo: 0 });

// A cloud launch includes CDP's 30 s connection bound (browser/cdp.ts); this prior is tunable.
searchParams.declare({ name: 'search_browser_start_ms', family: 'scalar', prior: 30000, guard_lo: 0 });
// Signed-out searches a UTC day that may use the paid same-product model; past it they are judged by codes alone.
searchParams.declare({ name: 'search_visitor_judged_per_day', family: 'scalar', prior: 500, guard_lo: 0 });

// --- single flight and cache ---
interface SharedCall { result: Promise<RouteOut>; started: Promise<void>; controller: AbortController; callers: number; ended: boolean }
const inflight = new Map<string, SharedCall>();
const cache = new Map<string, { at: number; out: RouteOut }>();
const lanes = new Map<string, { tail: Promise<void>; last?: number }>();
export const _reset = () => { inflight.clear(); cache.clear(); lanes.clear(); outsideCalls = 0; };
let outsideCalls = 0;
export const outsideCallCount = () => outsideCalls;

function until<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

// Release after the page read, before judgement. MCP retains its existing start-to-start gap.
export async function atPace<T>(site: string, lane: string, pace: Pace | undefined, run: (readEnded: () => void) => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!pace) {
    signal?.throwIfAborted();
    return run(() => {});
  }
  const key = `${site}|${lane}`;
  let state = lanes.get(key);
  if (!state) { state = { tail: Promise.resolve() }; lanes.set(key, state); }
  const prior = state.tail;
  let release!: () => void;
  let released = false;
  state.tail = new Promise<void>(resolve => { release = () => { if (!released) { released = true; resolve(); } }; });
  try { await until(prior, signal); }
  catch (e) { void prior.then(release); throw e; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const readEnded = () => {
    if (released) return;
    if (lane !== 'mcp') state.last = Date.now();
    release();
  };
  try {
    const gap = Math.max(pace.min_gap_ms, pace.per_minute > 0 ? 60_000 / pace.per_minute : 0);
    const wait = state.last === undefined ? 0 : state.last + gap - Date.now();
    if (wait > 0) await until(new Promise<void>(resolve => { timer = setTimeout(resolve, wait); }), signal);
    signal?.throwIfAborted();
    if (lane === 'mcp') state.last = Date.now();
    signal?.addEventListener('abort', readEnded, { once: true });
    try { return await run(readEnded); } finally { readEnded(); }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', readEnded);
    release();
  }
}

const freshClass = (s: number) => (s <= 900 ? 'fast' : s <= 86400 ? 'day' : 'slow');

function callRoute(r: Route, t: PlanTarget, priority: Priority, now: () => number) {
  const key = `${r.route_id}|${normalize(t.query)}|${freshClass(t.freshness_s)}`;
  const hit = cache.get(key);
  if (r.cache !== false && hit && now() - hit.at < t.freshness_s * 1000)
    return { result: Promise.resolve(hit.out), started: Promise.resolve(), release() {} };
  let call = inflight.get(key);
  if (!call) {
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    const controller = new AbortController();
    const result = atPace(r.site ?? r.host, r.lane ?? r.route_id, r.pace, async readEnded => {
      outsideCalls++;
      start();
      return r.run(t.query, { signal: controller.signal, priority, readEnded });
    }, controller.signal).then(out => {
      if (!controller.signal.aborted && r.cache !== false && (out.outcome === 'hit' || out.outcome === 'empty')) {
        cache.delete(key);
        cache.set(key, { at: now(), out });
        const max = searchParams.read('search_cache_max', {}).value as number;
        while (cache.size > max) cache.delete(cache.keys().next().value!);
      }
      return out;
    }).finally(() => {
      created.ended = true;
      if (inflight.get(key) === created) inflight.delete(key);
    });
    const created: SharedCall = { result, started, controller, callers: 0, ended: false };
    call = created;
    inflight.set(key, call);
  }
  const shared = call;
  shared.callers++;
  let released = false;
  return { result: shared.result, started: shared.started, release() {
    if (released) return;
    released = true;
    if (--shared.callers === 0 && !shared.ended) {
      if (inflight.get(key) === shared) inflight.delete(key);
      shared.controller.abort();
    }
  } };
}

// The target deadline includes admission and queue time from the plan's entry.
function runTarget(t: PlanTarget, priority: Priority, t0: number, now: () => number, settledSignal: AbortSignal): Promise<{ win: Arrival | null; searched: PacedSearched[] }> {
  const searched: PacedSearched[] = [];
  return new Promise(resolve => {
    let settled = false, running = 0, next = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const active = new Map<number, { release: () => void; timeout: () => void }>();
    const release = () => { for (const call of active.values()) call.release(); };
    settledSignal.addEventListener('abort', release, { once: true });
    let deadline: ReturnType<typeof setTimeout>;
    const done = (win: Arrival | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      for (const timer of timers) clearTimeout(timer);
      release();
      settledSignal.removeEventListener('abort', release);
      resolve({ win, searched });
    };
    deadline = setTimeout(() => { for (const call of active.values()) call.timeout(); done(null); }, Math.max(0, t.deadline_ms - (now() - t0)));
    const start = () => {
      if (settled || next >= t.routes.length) { if (running === 0) done(null); return; }
      const index = next++, r = t.routes[index]!;
      const at = now();
      let ended = false;
      running++;
      const record = (outcome: Outcome, detail?: unknown) => {
        searched.push({ route_id: r.route_id, query: t.query, outcome, ms: now() - at, ...(detail === undefined ? {} : { detail }), ...(r.pace ? { pace: r.pace } : {}) });
      };
      if (now() - t0 >= t.deadline_ms || settledSignal.aborted) { record('timeout'); return done(null); }
      const call = callRoute(r, t, priority, now);
      active.set(index, { release: call.release, timeout: () => record('timeout') });
      void call.started.then(() => {
        if (settled || ended) return;
        timers.add(setTimeout(() => { const n = t.routes[next]; if (!settled && !ended && n && n.host !== r.host) start(); }, r.p95_ms));
      });
      call.result.then(out => {
        if (settled || ended) return;
        ended = true; running--; active.delete(index); call.release();
        record(out.outcome, out.detail);
        if (out.outcome === 'hit') return done({ target_id: t.target_id, route_id: r.route_id, rows: out.rows, site: out.site, ms: now() - t0 });
        start();
      }, () => {
        if (settled || ended) return;
        ended = true; running--; active.delete(index); call.release(); record('blocked'); start();
      });
    };
    start();
  });
}

let seq = 0;
export async function runPlan(plan: Plan, onEvent?: OnAnswer, now: () => number = Date.now): Promise<RunAnswer> {
  const t0 = now(), arrivals: Arrival[] = [], searched: PacedSearched[] = [];
  const id = `ans_${t0.toString(36)}_${(++seq).toString(36)}`;
  let stage: Answer['stage'] = 'first', first: number | null = null, settledAt: number | null = null;
  const build = (): RunAnswer => {
    const { facts, found } = plan.calculate(arrivals);
    const sites: Record<string, number> = {};
    for (const a of arrivals) if (a.site) sites[a.site] = (sites[a.site] ?? 0) + a.rows.length;
    const results_found = arrivals.reduce((n, a) => n + a.rows.length, 0);
    return { id, kind: plan.kind, slots: plan.slots, protocol_version: plan.protocol_version,
      facts: [...(plan.index ?? []), ...facts], searched: [...searched], stage,
      found: { ...emptyFound(), sources_searched: searched.length, results_found, results_used: results_found, sites, ...found },
      ms: { first, settled: settledAt } };
  };
  const emit = (e: AnswerEvent) => onEvent?.(e, build());
  if (plan.index?.length) { first = now() - t0; emit('answer.partial'); }
  let settle!: () => void;
  const settledP = new Promise<void>(r => (settle = r));
  const settledController = new AbortController();
  const stop = () => { settledController.abort(); settle(); };
  plan.signal?.addEventListener('abort', stop, { once: true });
  if (plan.signal?.aborted) stop();
  const all = Promise.all(plan.targets.map(t => runTarget(t, plan.priority ?? 'person', t0, now, settledController.signal).then(({ win, searched: s }) => {
    searched.push(...s);
    first ??= now() - t0;
    if (win) arrivals.push(win);
    if (stage === 'settled') return emit('answer.late');
    if (win) emit('answer.partial');
  }))).then(() => settle());
  const settleTimer = setTimeout(settle, Math.max(0, plan.settled_ms - (now() - t0)));
  await settledP;
  plan.signal?.removeEventListener('abort', stop);
  clearTimeout(settleTimer);
  settledController.abort();
  stage = 'settled'; settledAt = now() - t0; first ??= settledAt;
  const answer = build();
  onEvent?.('answer.settled', answer);
  ended = all;
  return answer;
}
// Resolves when every target of the last runPlan has ended, late ones included (tests, background gathering).
let ended: Promise<unknown> = Promise.resolve();
export const allEnded = () => ended;
