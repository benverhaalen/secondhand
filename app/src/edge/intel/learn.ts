import { isDeepStrictEqual } from 'node:util';
import type { Param, ParamStore } from '../../engines/param/param.ts';
import type { QuestionKind, Stage } from './answer.ts';

// spec/product.md real-time weights and source router; intelligence-api.md §4.
export function declareLearning(store: ParamStore): void {
  store.declare({ name: 'intel_contribution', family: 'beta', prior: { alpha: 1, beta: 1 }, guard_lo: 0.25, guard_hi: 0.75, metric: 'contribution' });
  store.declare({ name: 'intel_exploration_share', family: 'scalar', prior: 0.05, guard_lo: 0, guard_hi: 1 });
}

export interface SettledContribution {
  person?: string; outcome_id?: string;
  kind: QuestionKind;
  stage: Stage;
  called: readonly string[];
  used: readonly string[];
}

const learned = new WeakMap<ParamStore, Set<string>>();

// The caller commits these observations in the same transaction as answer.settled.
export function updateContribution(store: ParamStore, answer: SettledContribution, at: string): void {
  if (answer.stage !== 'settled') throw new Error('contribution requires a settled answer');
  const key = answer.outcome_id ? JSON.stringify([answer.person, answer.kind, answer.outcome_id]) : null;
  const seen = learned.get(store) ?? new Set<string>();
  if (key && seen.has(key)) return;
  const called = new Set(answer.called);
  const used = new Set(answer.used);
  if ([...used].some(id => !called.has(id))) throw new Error('a used target must have been called');
  for (const target_id of called) {
    const scope = { kind: answer.kind, segment: target_id, ...(answer.person ? { person: answer.person } : {}) };
    const previous = store.rows('intel_contribution', scope).find(p => p.status === 'champion');
    const days_since_last = previous?.promoted_at ? Math.max(0, (Date.parse(at) - Date.parse(previous.promoted_at)) / 86_400_000) : 0;
    store.observe('intel_contribution', scope, { success: used.has(target_id) ? 1 : 0, weight: 1, days_since_last }, at);
  }
  if (key) { seen.add(key); learned.set(store, seen); }
}

export function contributionMean(store: ParamStore, kind: QuestionKind, target_id: string, person?: string): number {
  const value = store.read('intel_contribution', { kind, segment: target_id, ...(person ? { person } : {}) }).value;
  if (typeof value !== 'object' || value === null || !('alpha' in value) || !('beta' in value)) throw new Error('invalid contribution Beta');
  const { alpha, beta } = value;
  if (typeof alpha !== 'number' || typeof beta !== 'number' || !Number.isFinite(alpha) || !Number.isFinite(beta) || alpha <= 0 || beta <= 0) throw new Error('invalid contribution Beta');
  return alpha / (alpha + beta);
}

export interface ContributionTarget { target_id: string; p95_ms: number; cents: number }

function nonnegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and nonnegative`);
}

// Only used when the kind's cents ceiling binds. Free targets save no cents by being cut.
export function cutOrder<T extends ContributionTarget>(store: ParamStore, kind: QuestionKind, targets: readonly T[], person?: string): T[] {
  return targets.map(target => {
    nonnegative(target.p95_ms, 'p95_ms');
    if (target.p95_ms === 0) throw new Error('p95_ms must be positive');
    nonnegative(target.cents, 'cents');
    const ratio = target.cents === 0 ? Infinity : contributionMean(store, kind, target.target_id, person) / (target.p95_ms * target.cents);
    return { target, ratio };
  }).sort((a, b) => a.ratio - b.ratio).map(({ target }) => target);
}

export interface ContributingArrival { ms: number; used: boolean }

// Returns a fit for the param writer; prior always holds the declared starting deadline.
// Agent proposal: nearest-rank p90; no contributing arrivals leaves the row unchanged.
export function fitDeadline(declared: Param, arrivals: readonly ContributingArrival[]): Param {
  if (declared.family !== 'scalar' || typeof declared.prior !== 'number' || !Number.isFinite(declared.prior) || declared.prior <= 0) throw new Error('deadline_ms requires a positive scalar prior');
  if (declared.frozen) return { ...declared };
  const times = arrivals.filter(a => a.used).map(a => {
    nonnegative(a.ms, 'arrival ms');
    return a.ms;
  }).sort((a, b) => a - b);
  const guard_lo = Math.max(declared.prior * 0.5, declared.guard_lo ?? -Infinity);
  const guard_hi = Math.min(declared.prior * 1.5, declared.guard_hi ?? Infinity);
  if (guard_lo > guard_hi) throw new Error('deadline_ms guards do not overlap');
  if (times.length === 0) return { ...declared, guard_lo, guard_hi };
  const deadline_ms = Math.max(guard_lo, Math.min(guard_hi, times[Math.ceil(times.length * 0.9) - 1]));
  return { ...declared, value_or_hyperparams: deadline_ms, n_eff: times.length, guard_lo, guard_hi };
}

export interface ExplorationDaily { reads: number; tries: number; cents: number }
export interface ExplorationCap { share: number; cents: number }

// Agent proposal: reserve one cut-target try at a time against the day's share and cents.
// reads includes the current read; callers supply today's ledger and persist the returned one atomically.
// draw is injected in [0, 1) so every affordable cut target can still be tried without random I/O.
export function exploreCutTargets<T extends ContributionTarget>(
  cut: readonly T[], daily: ExplorationDaily, cap: ExplorationCap, remaining_cents: number, draw: number,
): { targets: T[]; daily: ExplorationDaily } {
  nonnegative(cap.share, 'share');
  if (cap.share > 1) throw new Error('share must be at most 1');
  nonnegative(cap.cents, 'daily cents cap');
  nonnegative(remaining_cents, 'remaining cents');
  nonnegative(daily.cents, 'daily cents');
  if (!Number.isSafeInteger(daily.reads) || daily.reads < 0 || !Number.isSafeInteger(daily.tries) || daily.tries < 0 || daily.tries > daily.reads) throw new Error('invalid daily reads or tries');
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('draw must be in [0, 1)');
  const eligible = cut.filter(t => {
    nonnegative(t.cents, 'target cents');
    return t.cents <= remaining_cents && t.cents <= cap.cents - daily.cents;
  });
  if (eligible.length === 0 || daily.tries + 1 > Math.floor(daily.reads * cap.share)) return { targets: [], daily: { ...daily } };
  const target = eligible[Math.floor(draw * eligible.length)];
  return { targets: [target], daily: { ...daily, tries: daily.tries + 1, cents: daily.cents + target.cents } };
}

export interface RouteTruth {
  page_id: string;
  held_out: boolean;
  truth: unknown;
  champion: unknown;
  challenger: unknown;
}

// Pure scoring over the same held-out route_truth pages. The writer persists both returned param rows.
export function extractorChallenger(champion: Param, challenger: Param, route_truth: readonly RouteTruth[], at: string): {
  champion: Param; challenger: Param; promoted: boolean;
} {
  if (champion.status !== 'champion' || challenger.status !== 'challenger' || champion.name !== challenger.name || !isDeepStrictEqual(champion.scope, challenger.scope) || champion.family !== 'model_ref' || challenger.family !== 'model_ref') throw new Error('extractor rows must be a matching champion and challenger');
  const pages = route_truth.filter(p => p.held_out);
  const ids = new Set<string>();
  let champion_right = 0, challenger_right = 0;
  for (const page of pages) {
    if (ids.has(page.page_id)) throw new Error('duplicate route_truth page');
    ids.add(page.page_id);
    if (isDeepStrictEqual(page.champion, page.truth)) champion_right++;
    if (isDeepStrictEqual(page.challenger, page.truth)) challenger_right++;
  }
  const n_eff = pages.length;
  // Integer comparison preserves the exact two-percentage-point boundary.
  const promoted = !champion.frozen && !challenger.frozen && n_eff >= 200 && (challenger_right - champion_right) * 100 >= 2 * n_eff;
  return {
    promoted,
    champion: { ...champion, n_eff, held_out_score: n_eff ? champion_right / n_eff : null, status: promoted ? 'retired' : 'champion' },
    challenger: { ...challenger, n_eff, held_out_score: n_eff ? challenger_right / n_eff : null, status: promoted ? 'champion' : 'challenger', promoted_at: promoted ? at : challenger.promoted_at },
  };
}
