// Plan and run (spec/engines/intelligence-api.md §3.1 steps 3–7): index first, every target at once, a hedged waterfall
// inside each target, single flight and a cache, and the answer streamed as each target arrives.
// From the expert session (agent proposal, research/cross-cutting/nate/intelligence-api-expert-session.md): the hedge trigger
// (route p95) and the give-up bound (target deadline) are two values; a hedge never sends a second call to the same host;
// the single-flight key carries the freshness class; a failed shared call is never cached; a block is not an empty result.
import { memoryStore } from '../../engines/param/param.ts';
import { emptyFound, type Answer, type AnswerEvent, type Fact, type OnAnswer, type Outcome, type QuestionKind, type Searched } from './answer.ts';

export type Priority = 'person' | 'gather' | 'refresh';
export interface RouteOut { outcome: Outcome; rows: unknown[]; site?: string }
export interface Route {
  route_id: string; host: string; p95_ms: number; cache?: boolean;
  run(query: string, ctx: { signal: AbortSignal; priority: Priority }): Promise<RouteOut>;
}
export interface PlanTarget { target_id: string; query: string; deadline_ms: number; routes: Route[]; freshness_s: number }
export interface Arrival { target_id: string; route_id: string; rows: unknown[]; site?: string; ms: number }
export interface Plan {
  kind: QuestionKind; slots: Record<string, unknown>; protocol_version: number;
  targets: PlanTarget[]; first_ms: number; settled_ms: number; priority?: Priority;
  index?: Fact[]; // facts the standing index already answers fresh (step 3); their targets are left out of the plan by the caller
  calculate(arrivals: Arrival[]): { facts: Fact[]; found?: Partial<Answer['found']> };
}

export const normalize = (q: string) => q.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

// int-search-1 priors; tunable through the shared param registry.
export const searchParams = memoryStore();
searchParams.declare({ name: 'search_cache_max', family: 'scalar', prior: 500, guard_lo: 0 });
searchParams.declare({ name: 'search_frame_ttl_s', family: 'scalar', prior: 3600, guard_lo: 0 });

// A cloud launch includes CDP's 30 s connection bound (browser/cdp.ts); this prior is tunable.
searchParams.declare({ name: 'search_browser_start_ms', family: 'scalar', prior: 30000, guard_lo: 0 });

// --- single flight and cache ---
const inflight = new Map<string, Promise<RouteOut>>();
const cache = new Map<string, { at: number; out: RouteOut }>();
export const _reset = () => { inflight.clear(); cache.clear(); outsideCalls = 0; };
let outsideCalls = 0;
export const outsideCallCount = () => outsideCalls;

const freshClass = (s: number) => (s <= 900 ? 'fast' : s <= 86400 ? 'day' : 'slow');

function callRoute(r: Route, t: PlanTarget, signal: AbortSignal, priority: Priority, now: () => number): Promise<RouteOut> {
  const key = `${r.route_id}|${normalize(t.query)}|${freshClass(t.freshness_s)}`;
  const hit = cache.get(key);
  if (r.cache !== false && hit && now() - hit.at < t.freshness_s * 1000) return Promise.resolve(hit.out);
  const joined = inflight.get(key);
  if (joined) return joined;
  outsideCalls++;
  // The shared call is not tied to one caller's abort: a joined question must not lose the result when the first gives up.
  const shared = new AbortController();
  const p = (async () => r.run(t.query, { signal: shared.signal, priority }))().then(out => {
    if (r.cache !== false && (out.outcome === 'hit' || out.outcome === 'empty')) {
      cache.delete(key);
      cache.set(key, { at: now(), out });
      const max = searchParams.read('search_cache_max', {}).value as number;
      while (cache.size > max) cache.delete(cache.keys().next().value!);
    }
    return out;
  }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// Hedged waterfall (Firecrawl scrapeURL): when the running route passes its p95, the next route on another host starts
// in parallel; the first hit wins. Returns every route's searched[] row.
async function runTarget(t: PlanTarget, priority: Priority, t0: number, now: () => number): Promise<{ win: Arrival | null; searched: Searched[] }> {
  const searched: Searched[] = [];
  const ac = new AbortController();
  return new Promise(resolve => {
    let settled = false, running = 0, next = 0;
    const done = (win: Arrival | null) => { if (settled) return; settled = true; clearTimeout(giveUp); clearTimeout(hedge); ac.abort(); resolve({ win, searched }); };
    const giveUp = setTimeout(() => {
      for (let i = next - running; i < next; i++) searched.push({ route_id: t.routes[i]!.route_id, query: t.query, outcome: 'timeout', ms: now() - t0 });
      done(null);
    }, t.deadline_ms);
    let hedge: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (settled || next >= t.routes.length) { if (running === 0) done(null); return; }
      const r = t.routes[next++]!, at = now();
      running++;
      const host = r.host;
      clearTimeout(hedge);
      hedge = setTimeout(() => { const n = t.routes[next]; if (n && n.host !== host) start(); }, r.p95_ms);
      callRoute(r, t, ac.signal, priority, now).then(out => {
        running--;
        if (settled) return;
        searched.push({ route_id: r.route_id, query: t.query, outcome: out.outcome, ms: now() - at });
        if (out.outcome === 'hit') return done({ target_id: t.target_id, route_id: r.route_id, rows: out.rows, site: out.site, ms: now() - t0 });
        if (running === 0 || next < t.routes.length) start();
      }, () => {
        running--;
        if (settled) return;
        searched.push({ route_id: r.route_id, query: t.query, outcome: 'blocked', ms: now() - at });
        start();
      });
    };
    if (!t.routes.length) return done(null);
    start();
  });
}

let seq = 0;
export async function runPlan(plan: Plan, onEvent?: OnAnswer, now: () => number = Date.now): Promise<Answer> {
  const t0 = now(), arrivals: Arrival[] = [], searched: Searched[] = [];
  const id = `ans_${t0.toString(36)}_${(++seq).toString(36)}`;
  let stage: Answer['stage'] = 'first', first: number | null = null, settledAt: number | null = null;
  const build = (): Answer => {
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
  const settleTimer = setTimeout(() => settle(), plan.settled_ms);
  const all = Promise.all(plan.targets.map(t => runTarget(t, plan.priority ?? 'person', t0, now).then(({ win, searched: s }) => {
    searched.push(...s);
    if (win) arrivals.push(win);
    if (stage === 'settled') return emit('answer.late');
    if (win) { first ??= now() - t0; emit('answer.partial'); }
  }))).then(() => settle());
  await settledP;
  clearTimeout(settleTimer);
  stage = 'settled'; settledAt = now() - t0;
  const answer = build();
  onEvent?.('answer.settled', answer);
  ended = all;
  return answer;
}
// Resolves when every target of the last runPlan has ended, late ones included (tests, background gathering).
let ended: Promise<unknown> = Promise.resolve();
export const allEnded = () => ended;
