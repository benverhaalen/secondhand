// The intelligence API's one result shape, `answer`, and the question kinds (spec/product.md `answer`, `question kind`;
// spec/engines/intelligence-api.md §1). Streams 11 and 12 build against `Intel` and `fakeIntel`; the real engine is run.ts.

export const QUESTION_KINDS = [
  'price_now', 'sold_history', 'retail_price', 'identify', 'listings_matching', 'available_now', 'product_reviews',
  'seller_reviews', 'site_rules', 'trend', 'used_vs_official', 'listing_swarm', 'my_analytics', 'general',
] as const;
export type QuestionKind = typeof QUESTION_KINDS[number];

export const STAGES = ['first', 'late', 'settled', 'gathering'] as const;
export type Stage = typeof STAGES[number];

export const OUTCOMES = ['hit', 'empty', 'blocked', 'timeout', 'over_budget'] as const;
export type Outcome = typeof OUTCOMES[number];

export const HIDE_REASONS = ['too_few', 'too_wide', 'stale', 'mixed_types', 'source_gap', 'conflict', 'noise'] as const;
export type HideReason = typeof HIDE_REASONS[number];
// The reasons that start a gather_request instead of hiding at once (§3.5).
export const GATHER_REASONS: readonly HideReason[] = ['too_few', 'stale', 'source_gap', 'noise'];

export const ANSWER_EVENTS = ['answer.partial', 'answer.settled', 'answer.late', 'gather.update'] as const;
export type AnswerEvent = typeof ANSWER_EVENTS[number];

// `not_found` is the engine's "searched and found nothing" state (§1); it always carries the answer's searched[].
export type GuardState = 'shown' | 'hidden' | 'not_found';

export interface Evidence {
  source_url: string; read_at: string; snapshot_ref: string | null; fingerprint: string;
  extractor_version: string; rights: { may_share: boolean; [k: string]: unknown };
}

export interface Guarded {
  state: GuardState; basis_count: number; as_of: string | null; citation_id: string | null; hide_reason?: HideReason;
}

export interface Fact {
  name: string; value?: unknown; range?: { low: number; high: number }; unit?: string;
  guarded: Guarded; sources: Evidence[];
}

export interface Found {
  sources_searched: number; results_found: number; results_used: number;
  dropped_by_reason: Record<string, number>; sites: Record<string, number>;
}

export interface Searched { route_id: string; query: string; outcome: Outcome; ms: number }

export interface Answer {
  id: string; kind: QuestionKind; slots: Record<string, unknown>; protocol_version: number;
  facts: Fact[]; found: Found; searched: Searched[]; stage: Stage;
  ms: { first: number | null; settled: number | null; gathered?: number };
  gather?: { request_id: string; deadline: string; steps_done: number[] };
}

// A typed body names its kind; plain text or a link leaves it to the classifier (classify.ts).
export interface Question { kind?: QuestionKind; text?: string; url?: string; photo_id?: string; slots?: Record<string, unknown> }

export type OnAnswer = (event: AnswerEvent, answer: Answer) => void;

export interface Intel {
  // Resolves with the settled answer; every partial, the settlement, late arrivals and gather steps go to onEvent.
  ask(q: Question, onEvent?: OnAnswer): Promise<Answer>;
}

export const emptyFound = (): Found => ({ sources_searched: 0, results_found: 0, results_used: 0, dropped_by_reason: {}, sites: {} });

// Every rule an answer must hold before it leaves the engine. Returns the problems; an empty list is a valid answer.
export function checkAnswer(a: Answer): string[] {
  const p: string[] = [];
  if (!QUESTION_KINDS.includes(a.kind)) p.push(`kind ${a.kind} is not a question kind`);
  if (!STAGES.includes(a.stage)) p.push(`stage ${a.stage} is not a stage`);
  for (const s of a.searched) if (!OUTCOMES.includes(s.outcome)) p.push(`searched ${s.route_id} outcome ${s.outcome}`);
  for (const f of a.facts) {
    const g = f.guarded;
    if (g.state === 'hidden' && !g.hide_reason) p.push(`${f.name} hidden without hide_reason`);
    if (g.hide_reason && !HIDE_REASONS.includes(g.hide_reason)) p.push(`${f.name} hide_reason ${g.hide_reason}`);
    if (g.state === 'not_found' && a.searched.length === 0) p.push(`${f.name} not_found with nothing searched`);
    if (g.state === 'shown' && f.value === undefined && !f.range) p.push(`${f.name} shown with no value`);
    if (g.state === 'shown' && f.sources.length === 0) p.push(`${f.name} shown with no source`);
    if (f.range && !(f.range.low <= f.range.high)) p.push(`${f.name} range low above high`);
  }
  if (a.found.results_used > a.found.results_found) p.push('results_used above results_found');
  return p;
}

// A fake engine for callers' tests: answers from the given facts per kind, emitting answer.partial then answer.settled.
export function fakeIntel(facts: Partial<Record<QuestionKind, Fact[]>>): Intel {
  let n = 0;
  return {
    async ask(q, onEvent) {
      const kind = q.kind ?? 'general';
      const list = facts[kind] ?? [];
      const searched: Searched[] = [{ route_id: 'fake', query: q.text ?? kind, outcome: list.length ? 'hit' : 'empty', ms: 1 }];
      const base: Answer = {
        id: `ans_fake_${++n}`, kind, slots: q.slots ?? {}, protocol_version: 1, facts: [], found: emptyFound(),
        searched, stage: 'first', ms: { first: 1, settled: null },
      };
      const out = list.length ? list : [{ name: 'result', guarded: { state: 'not_found' as const, basis_count: 0, as_of: null, citation_id: null }, sources: [] }];
      onEvent?.('answer.partial', { ...base, facts: out.slice(0, 1) });
      const settled: Answer = { ...base, facts: out, stage: 'settled', ms: { first: 1, settled: 2 },
        found: { ...emptyFound(), sources_searched: 1, results_found: list.length, results_used: list.length } };
      onEvent?.('answer.settled', settled);
      return settled;
    },
  };
}
