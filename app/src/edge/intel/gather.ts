// Gathering more (spec/engines/intelligence-api.md §3.5, §9; spec/product.md `gather_request`).
// How it runs: the settled answer's facts that would hide for too_few/stale/source_gap/noise become one gather_request.
// conflict and mixed_types go through the injected `reconcile` first. Then the protocol's steps run one at a time
// (each widens the arrivals, reruns plan.calculate, emits gather.update with the whole answer) until the first stop:
// basis, saturation, a last step that gained under 0.1 of n_eff, every source tried, the deadline, or the cents ceiling.
// Steps are injected (the real ones sit on public/ and fetch.ts); step 6, a signed-in read, is never run here.
import { GATHER_REASONS, type Answer, type Fact, type OnAnswer, type Searched } from './answer.ts';
import { nEff, weigh, canonical, DEFAULTS, type Comp as ValuationComp } from '../../engines/valuation/comps.ts';
import { basisOf } from '../../engines/valuation/valuate.ts';
import { PROTOCOLS } from './protocols.ts';
import type { ParamStore } from '../../engines/param/param.ts';
import { contributionMean, cutOrder } from './learn.ts';
import type { Ctx, Handler } from '../api/http.ts';
import type { jobs as apiJobs } from '../api/jobs.ts';
import { object } from '../api/captures.ts';
import type { Arrival, Plan } from './run.ts';

export type StopReason = 'basis' | 'saturation' | 'low_gain' | 'exhausted' | 'deadline' | 'ceiling' | 'nothing_to_gather';
export interface GatherRequest { request_id: string; product: string; claim: string; deadline: string }
export interface StepOut { arrivals: Arrival[]; searched: Searched[]; cents: number }
export interface GatherStep {
  n: number; est_cents: number; target_id?: string; p95_ms?: number;
  run(ctx: { signal: AbortSignal; request: GatherRequest }): Promise<StepOut>;
}
export interface Measure { n_eff: number; sold_90d: number; median: number | null; saturated: boolean }
export interface StepRecord { n: number; n_eff: number; ms: number; added: number; outcome: 'ran' | 'skipped' | 'blocked'; target_id?: string; error?: string }
export interface GatherParams {
  deadline_ms: number; basis_n_eff: number; basis_sold_90d: number; half_life_d: number; cut_d: number;
  sat_k: number; sat_share: number; min_gain: number;
}
// Start values (agent proposal, tuned as params): half-life 90 d (30 d in fast categories), cut 365 d from §3.5 step 3.
export const GATHER_PARAMS: GatherParams = { deadline_ms: 120_000, basis_n_eff: 6, basis_sold_90d: 2, half_life_d: 90, cut_d: 365, sat_k: 3, sat_share: 0.02, min_gain: 0.1 };

const DAY = 86_400_000;
type Comp = Partial<ValuationComp> & { price_cents: number; w?: number };
const valuationComp = (c: Comp): c is ValuationComp =>
  typeof c.comp_id === 'string' && typeof c.sold_at === 'string' && typeof c.condition === 'string' &&
  typeof c.site === 'string' && typeof c.kind === 'string' && typeof c.level === 'string' &&
  typeof c.w_match === 'number' && typeof c.w_extract === 'number';
const comps = (arrivals: Arrival[]): Comp[] => arrivals.flatMap(a => a.rows).filter((r): r is Comp =>
  typeof r === 'object' && r !== null && typeof (r as Comp).price_cents === 'number' && Number.isFinite((r as Comp).price_cents));

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };

// Kish n_eff uses final valuation weights when supplied; price-only rows use age weights.
// Saturation (price form, not crawl4ai's new-term rate): the median moved under sat_share across the last sat_k added comps.
// Blocked and timed-out steps add no rows, so they never reduce or raise any of this.
export function measure(arrivals: Arrival[], now: number, p: GatherParams = GATHER_PARAMS): Measure {
  const kept = comps(arrivals).filter(c => !c.sold_at || (now - Date.parse(c.sold_at)) / DAY <= p.cut_d);
  const params = { ...DEFAULTS, max_age_days: p.cut_d, half_life_days: { default: p.half_life_d, fast: p.half_life_d } };
  const as_of = new Date(now).toISOString();
  const complete = canonical(kept.filter(valuationComp), as_of, params);
  const partial = kept.filter(c => !valuationComp(c));
  const weights = new Map(weigh(complete, as_of, params).map(c => [c.comp_id, c.w]));
  const w = (c: Comp) => c.w ?? (valuationComp(c) ? weights.get(c.comp_id) ?? 0 : c.sold_at ? 0.5 ** (Math.max(0, now - Date.parse(c.sold_at)) / DAY / p.half_life_d) : 1);
  const measured = [...complete, ...partial].filter(c => w(c) > 0);
  const sold_90d = measured.filter(c => c.sold_at && (now - Date.parse(c.sold_at)) / DAY <= 90).length;
  const prices = kept.map(c => c.price_cents);
  let saturated = false;
  if (prices.length > p.sat_k) {
    const before = median(prices.slice(0, prices.length - p.sat_k)), after = median(prices);
    saturated = before > 0 && Math.abs(after - before) / before < p.sat_share;
  }
  const basis = partial.length === 0 ? basisOf(complete, as_of, params) : null;
  return { n_eff: basis?.n_eff ?? nEff(measured.map(w)), sold_90d: basis?.sold_90d ?? sold_90d, median: prices.length ? median(prices) : null, saturated };
}

export const basisMet = (m: Measure, p: GatherParams = GATHER_PARAMS) => m.n_eff >= p.basis_n_eff && m.sold_90d >= p.basis_sold_90d;
const wantsGather = (f: Fact) => f.guarded.state === 'shown'
  ? 'notes' in f.guarded && Array.isArray(f.guarded.notes) && f.guarded.notes.some((note: unknown) => GATHER_REASONS.some(reason => reason === note))
  : !!f.guarded.hide_reason && GATHER_REASONS.includes(f.guarded.hide_reason);
const needsReconcile = (f: Fact) => f.guarded.state === 'hidden' && (f.guarded.hide_reason === 'conflict' || f.guarded.hide_reason === 'mixed_types');

export interface GatherOpts {
  answer: Answer; plan: Plan; arrivals: Arrival[]; steps: GatherStep[]; product: string;
  learning?: ParamStore; person?: string; onError?: (where: string, error: unknown) => void;
  onEvent?: OnAnswer; now?: () => number; params?: Partial<GatherParams>;
  ceilingCents?: number; spentCents?: number; // the protocol's cents ceiling; gathering never runs past it
  reconcile?: (arrivals: Arrival[], facts: Fact[]) => Promise<Arrival[]>; // conflict and mixed_types first (reconcile.ts)
}
export interface GatherResult { answer: Answer; stop: StopReason; request: GatherRequest | null; records: StepRecord[]; cents: number; arrivals: Arrival[] }

let seq = 0;
export async function gather(o: GatherOpts): Promise<GatherResult> {
  const now = o.now ?? Date.now, p = { ...GATHER_PARAMS, ...o.params }, t0 = now();
  let arrivals = [...o.arrivals], facts = o.answer.facts;
  const recalc = () => { const r = o.plan.calculate(arrivals); facts = [...(o.plan.index ?? []), ...r.facts]; return r.found; };
  if (o.reconcile && facts.some(needsReconcile)) { arrivals = await o.reconcile(arrivals, facts); recalc(); }
  const hidden = facts.filter(wantsGather);
  if (!hidden.length) return { answer: { ...o.answer, facts }, stop: 'nothing_to_gather', request: null, records: [], cents: 0, arrivals };

  const request: GatherRequest = { request_id: `gat_${t0.toString(36)}_${(++seq).toString(36)}`, product: o.product,
    claim: hidden.map(f => f.name).join(','), deadline: new Date(t0 + p.deadline_ms).toISOString() };
  const searched = [...o.answer.searched], steps_done: number[] = [], records: StepRecord[] = [];
  let cents = o.spentCents ?? 0, stop: StopReason = 'exhausted';
  const snapshot = (): Answer => {
    const found = recalc();
    return { ...o.answer, facts, searched: [...searched], stage: 'gathering', ms: { ...o.answer.ms, gathered: now() - t0 },
      found: { ...o.answer.found, results_found: arrivals.reduce((n, a) => n + a.rows.length, 0), ...found },
      gather: { request_id: request.request_id, deadline: request.deadline, steps_done: [...steps_done] } };
  };
  let m = measure(arrivals, now(), p);
  if (basisMet(m, p)) stop = 'basis';
  else for (const s of orderedSteps(o)) {
    if (s.n === 6) { records.push({ n: 6, n_eff: m.n_eff, ms: 0, added: 0, outcome: 'skipped' }); continue; } // signed-in read: needs Nate's go
    const left = t0 + p.deadline_ms - now();
    if (left <= 0) { stop = 'deadline'; break; }
    if (cents + s.est_cents > (o.ceilingCents ?? Infinity)) { stop = 'ceiling'; break; }
    const ac = new AbortController(), at = now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failure: string | undefined;
    const out = await Promise.race([
      s.run({ signal: ac.signal, request }).catch((error: unknown): StepOut => {
        failure = error instanceof Error ? error.message : String(error);
        o.onError?.(`gather.${s.n}`, error);
        return { arrivals: [], searched: [{ route_id: s.target_id ?? `gather.${s.n}`, query: request.product, outcome: 'blocked', ms: now() - at }], cents: 0 };
      }),
      new Promise<null>(r => { timer = setTimeout(() => r(null), left); }),
    ]);
    clearTimeout(timer);
    if (!out) { ac.abort(); searched.push({ route_id: `gather.${s.n}`, query: request.product, outcome: 'timeout', ms: now() - at }); stop = 'deadline'; break; }
    cents += out.cents; arrivals = [...arrivals, ...out.arrivals]; searched.push(...out.searched); steps_done.push(s.n);
    const prev = m; m = measure(arrivals, now(), p);
    const failed = out.searched.length > 0 && out.searched.every(x => x.outcome === 'blocked' || x.outcome === 'timeout' || x.outcome === 'over_budget');
    records.push({ n: s.n, n_eff: m.n_eff, ms: now() - at, added: out.arrivals.reduce((n, a) => n + a.rows.length, 0), outcome: failed ? 'blocked' : 'ran', ...(s.target_id ? { target_id: s.target_id } : {}), ...(failure ? { error: failure } : {}) });
    o.onEvent?.('gather.update', snapshot());
    if (cents > (o.ceilingCents ?? Infinity)) { stop = 'ceiling'; break; }
    if (basisMet(m, p)) { stop = 'basis'; break; }
    if (m.saturated) { stop = 'saturation'; break; }
    // A block is not an empty result: only a step that really read (and found little) counts as low gain.
    if (!failed && m.n_eff > 0 && m.n_eff - prev.n_eff < p.min_gain * m.n_eff) { stop = 'low_gain'; break; }
  }
  const answer = snapshot();
  o.onEvent?.('gather.update', answer); // the closing state, also when a deadline or the ceiling ended it before a step
  return { answer, stop, request, records, cents, arrivals };
}

// The protocol's step list for a kind: the steps the caller has a runner for, plus step 6 (always recorded as skipped).
export const protocolSteps = (kind: Answer['kind'], impl: Partial<Record<number, GatherStep>>): GatherStep[] =>
  PROTOCOLS[kind].gather.steps.flatMap(n => (n === 6 ? [{ n, est_cents: 0, run: async () => ({ arrivals: [], searched: [], cents: 0 }) }] : impl[n] ? [impl[n]!] : []));


function orderedSteps(o: GatherOpts): GatherStep[] {
  if (!o.learning) return o.steps;
  const params = o.learning;
  const targets = o.steps.map((step, index) => ({ ...step, target_id: step.target_id ?? `gather.${step.n}`,
    p95_ms: step.p95_ms ?? 1, cents: step.est_cents, index }));
  const cuts = cutOrder(params, o.answer.kind, targets, o.person);
  return targets.sort((a, b) => a.n - b.n ||
    contributionMean(params, o.answer.kind, b.target_id, o.person) - contributionMean(params, o.answer.kind, a.target_id, o.person) ||
    (a.cents > 0 && b.cents > 0 ? cuts.indexOf(b) - cuts.indexOf(a) : a.index - b.index));
}

// Consume the product's settled job frame, including rows that may only live in memory.
export function searchStep(o: { handler: Handler; jobs: Pick<typeof apiJobs, 'listen' | 'framesAfter'>;
  ctx: Ctx; text: string; source: string }): GatherStep {
  return { n: 1, est_cents: 0, target_id: `public.${o.source}`,
    async run({ signal }) {
      signal.throwIfAborted();
      const reply = await o.handler({ ...o.ctx, body: { text: o.text, sources: [o.source] } }, new Request('http://edge.internal/v1/search', { method: 'POST', signal }));
      if (reply instanceof Response || !object(reply.body) || typeof reply.body.id !== 'string') throw new Error('gather search did not return a job');
      const id = reply.body.id;
      return new Promise<StepOut>((resolve, reject) => {
        let off: (() => void) | undefined, closed = false;
        const close = () => { closed = true; off?.(); signal.removeEventListener('abort', abort); };
        const abort = () => { close(); reject(signal.reason); };
        const pump = () => {
          if (closed) return;
          try {
            for (const frame of o.jobs.framesAfter(id, 0)) {
              if (frame.event === 'answer.settled') {
                const answer = object(frame.data.answer) ? frame.data.answer : null;
                const searched = Array.isArray(answer?.searched) ? answer.searched.flatMap(row => {
                  if (!object(row) || typeof row.route_id !== 'string') return [];
                  const outcome = ['hit', 'empty', 'timeout', 'over_budget'].includes(String(row.outcome)) ? row.outcome as Searched['outcome'] : 'blocked';
                  return [{ route_id: row.route_id, query: o.text, outcome, ms: typeof row.ms === 'number' ? row.ms : 0 }];
                }) : [];
                const rows = Array.isArray(frame.data.results) ? frame.data.results : [];
                close(); resolve({ arrivals: [{ target_id: `public.${o.source}`, route_id: searched[0]?.route_id ?? `public.${o.source}`, rows, ms: 0 }], searched, cents: 0 }); return;
              }
              if (frame.event === 'job.state' && ['failed', 'cancelled'].includes(String(frame.data.state))) {
                close(); reject(new Error(`gather search job ${frame.data.state}`)); return;
              }
            }
          } catch (error) { close(); reject(error); }
        };
        signal.addEventListener('abort', abort, { once: true });
        off = o.jobs.listen(id, pump);
        if (closed) off(); else if (signal.aborted) abort(); else pump();
      });
    },
  };
}
