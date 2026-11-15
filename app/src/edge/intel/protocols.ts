// One `question_protocol` row per question kind (spec/engines/intelligence-api.md §1: the kinds table and the row shape).
// price_now, listing_swarm and available_now are written out exactly as the doc gives them. The other eleven take their slots,
// targets, first/settled budgets and layers from the kinds table; the per-target deadlines, cents and freshness the table does
// not state are *agent proposal* starting values, tuned later as params (§4) and changed only by review.
import type { QuestionKind } from './answer.ts';

export interface Target {
  target_id: string;
  route_need: { layer: string; verb: string };
  query_template: string;
  extractor_id: string;
  deadline_ms: number;
  budget: { calls: number; cents: number };
  feeds: string[];
}

export interface QuestionProtocol {
  kind: QuestionKind;
  version: number;
  // `required` is a list of any-of groups: each group needs at least one slot, and the first name in a group is the one a 400 names.
  slots_schema: { required: string[][]; optional: string[] };
  facts_schema: string[];
  targets: Target[];
  budget: { first_ms: number; settled_ms: number; cents: number };
  stop_rule: string;
  calculation_id: string;
  freshness: Record<string, number>;
  gather: { deadline_s: number; steps: number[] };
}

const MIN = 60, H = 3600, D = 86400;
const t = (target_id: string, layer: string, verb: string, extractor_id: string, deadline_ms: number, feeds: string[],
  calls = 1, cents = 0, query_template = '{text}'): Target => ({ target_id, route_need: { layer, verb }, query_template, extractor_id, deadline_ms, budget: { calls, cents }, feeds });
const stop = (s: number) => `every target ended, or ${s} s`;
const row = (p: Omit<QuestionProtocol, 'version' | 'stop_rule'> & { version?: number }): QuestionProtocol =>
  ({ version: 1, stop_rule: stop(p.budget.settled_ms / 1000), ...p });
const prod = ['text', 'product_id'];
const noGather = { deadline_s: 0, steps: [] as number[] };
const gather = (...steps: number[]) => ({ deadline_s: 120, steps });

export const PROTOCOLS: Record<QuestionKind, QuestionProtocol> = {
  price_now: row({
    kind: 'price_now',
    slots_schema: { required: [prod], optional: ['condition', 'size', 'region'] },
    facts_schema: ['sold_range', 'ask_range', 'new_reference', 'accepted_offer_ratio'],
    targets: [
      t('t1', 'index', 'comps', 'none', 150, ['sold_range', 'ask_range']),
      t('t2', 'site_protocol', 'read', 'adapter', 2500, ['sold_range'], 5),
      t('t3', 'site_protocol', 'search', 'adapter', 2500, ['ask_range'], 5),
      t('t4', 'engine', 'fetch', 'schema', 4000, ['accepted_offer_ratio'], 1, 0.2),
      t('t5', 'engine', 'fetch', 'schema', 4000, ['sold_range'], 1, 0.2),
      t('t6', 'engine', 'search+fetch', 'ladder', 6000, ['new_reference'], 1, 0.5),
    ],
    budget: { first_ms: 1500, settled_ms: 10000, cents: 2 },
    calculation_id: 'valuation',
    freshness: { ask_range: 15 * MIN, sold_range: 24 * H, new_reference: 24 * H },
    gather: gather(1, 2, 3, 4, 5, 6),
  }),
  sold_history: row({
    kind: 'sold_history',
    slots_schema: { required: [prod], optional: ['window', 'condition', 'size'] },
    facts_schema: ['sold_range', 'sold_count', 'sold_series'],
    targets: [
      t('t1', 'index', 'comps', 'none', 150, ['sold_range', 'sold_count', 'sold_series']),
      t('t2', 'site_protocol', 'read', 'adapter', 2500, ['sold_range', 'sold_count', 'sold_series'], 5),
      t('t3', 'engine', 'fetch', 'schema', 4000, ['sold_range'], 1, 0.2),
      t('t4', 'engine', 'fetch', 'ladder', 6000, ['sold_series'], 1, 0.3),
    ],
    budget: { first_ms: 1500, settled_ms: 10000, cents: 2 },
    calculation_id: 'sold_summary',
    freshness: { sold_range: 24 * H, sold_count: 24 * H, sold_series: 24 * H },
    gather: gather(1, 2, 3, 4, 6),
  }),
  retail_price: row({
    kind: 'retail_price',
    slots_schema: { required: [prod], optional: [] },
    facts_schema: ['retail_price', 'retail_sources'],
    targets: [
      t('t1', 'engine', 'fetch', 'ladder', 5000, ['retail_price'], 1, 0.4),
      t('t2', 'engine', 'search+fetch', 'ladder', 10000, ['retail_price', 'retail_sources'], 3, 0.8),
      t('t3', 'engine', 'fetch', 'schema', 6000, ['retail_price'], 1, 0.2),
      t('t4', 'engine', 'fetch', 'schema', 6000, ['retail_price'], 1, 0.2),
    ],
    budget: { first_ms: 3000, settled_ms: 20000, cents: 3 },
    calculation_id: 'retail_reference',
    freshness: { retail_price: 24 * H, retail_sources: 24 * H },
    gather: gather(1, 4, 5),
  }),
  identify: row({
    kind: 'identify',
    slots_schema: { required: [['photo_id', 'url', 'barcode']], optional: ['text'] },
    facts_schema: ['identity', 'match_label'],
    targets: [
      t('t1', 'identity', 'resolve', 'none', 12000, ['identity', 'match_label'], 1, 1, '{photo_id|url|barcode}'),
      t('t2', 'engine', 'search+fetch', 'ladder', 8000, ['identity'], 2, 0.5),
    ],
    budget: { first_ms: 3000, settled_ms: 15000, cents: 2 },
    calculation_id: 'identity_match',
    freshness: { identity: 7 * D, match_label: 7 * D },
    gather: noGather,
  }),
  listings_matching: row({
    kind: 'listings_matching',
    slots_schema: { required: [prod], optional: ['filters', 'condition', 'size', 'site'] },
    facts_schema: ['listings', 'per_site_counts'],
    targets: [
      t('t1', 'index', 'offers', 'none', 150, ['listings']),
      t('t2', 'site_protocol', 'search', 'adapter', 3000, ['listings', 'per_site_counts'], 5),
      t('t3', 'engine', 'search+fetch', 'ladder', 5000, ['listings'], 1, 0.4),
    ],
    budget: { first_ms: 3000, settled_ms: 10000, cents: 2 },
    calculation_id: 'listing_filter',
    freshness: { listings: 15 * MIN, per_site_counts: 15 * MIN },
    gather: noGather,
  }),
  available_now: row({
    kind: 'available_now',
    slots_schema: { required: [prod], optional: ['size', 'condition_floor', 'ship_to'] },
    facts_schema: ['offers', 'best_by_relation'],
    targets: [
      t('t1', 'index', 'offers', 'none', 150, ['offers']),
      t('t2', 'site_protocol', 'search', 'adapter', 3000, ['offers'], 5),
      t('t3', 'engine', 'fetch', 'schema', 4000, ['offers'], 1, 0.2),
      t('t4', 'engine', 'search+fetch', 'ladder', 5000, ['offers'], 1, 0.4),
      t('t5', 'engine', 'fetch', 'schema', 4000, ['offers'], 1, 0.2),
      t('t6', 'jev', 'heads', 'none', 3000, ['best_by_relation'], 1, 0.1, 'variant check over size, colour and edition per offer'),
    ],
    budget: { first_ms: 3000, settled_ms: 10000, cents: 2 },
    calculation_id: 'delivered_price',
    freshness: { offers: 15 * MIN, best_by_relation: 15 * MIN, delivery: 24 * H },
    gather: noGather,
  }),
  product_reviews: row({
    kind: 'product_reviews',
    slots_schema: { required: [prod], optional: [] },
    facts_schema: ['rating', 'review_count', 'praise_themes', 'complaint_themes'],
    targets: [
      t('t1', 'engine', 'fetch', 'schema', 5000, ['rating', 'review_count'], 3, 0.3),
      t('t2', 'engine', 'fetch', 'schema', 5000, ['rating', 'review_count'], 1, 0.2),
      t('t3', 'engine', 'search+fetch', 'ladder', 10000, ['rating', 'praise_themes', 'complaint_themes'], 3, 0.6),
      t('t4', 'open_web', 'search+crawl', 'ladder', 15000, ['praise_themes', 'complaint_themes'], 3, 0.6),
    ],
    budget: { first_ms: 3000, settled_ms: 20000, cents: 3 },
    calculation_id: 'review_themes',
    freshness: { rating: 24 * H, review_count: 24 * H, praise_themes: 24 * H, complaint_themes: 24 * H },
    gather: gather(1, 4),
  }),
  seller_reviews: row({
    kind: 'seller_reviews',
    slots_schema: { required: [['site'], ['seller']], optional: [] },
    facts_schema: ['feedback_score', 'feedback_count', 'latest_comments'],
    targets: [t('t1', 'site_protocol', 'read', 'adapter', 4000, ['feedback_score', 'feedback_count', 'latest_comments'], 1, 0.1, '{site}/{seller}')],
    budget: { first_ms: 1500, settled_ms: 5000, cents: 1 },
    calculation_id: 'seller_feedback',
    freshness: { feedback_score: H, feedback_count: H, latest_comments: H },
    gather: noGather,
  }),
  site_rules: row({
    kind: 'site_rules',
    slots_schema: { required: [['site']], optional: ['kind_family'] },
    facts_schema: ['fee_lines', 'listing_limits', 'restricted_rules', 'rules_changed'],
    targets: [
      t('t1', 'reviewed_rules', 'read', 'none', 150, ['fee_lines', 'listing_limits', 'restricted_rules'], 1, 0, '{site}/{kind_family}'),
      t('t2', 'engine', 'fetch', 'schema', 4000, ['rules_changed'], 1, 0.2, '{site} rule pages'),
    ],
    budget: { first_ms: 1000, settled_ms: 5000, cents: 1 },
    calculation_id: 'reviewed_rules',
    freshness: { fee_lines: D, listing_limits: D, restricted_rules: D, rules_changed: D },
    gather: noGather,
  }),
  trend: row({
    kind: 'trend',
    slots_schema: { required: [prod], optional: ['family'] },
    facts_schema: ['demand', 'trend_direction', 'signals'],
    targets: [t('t1', 'demand_trend', 'signals', 'none', 15000, ['demand', 'trend_direction', 'signals'], 1, 0.3)],
    budget: { first_ms: 3000, settled_ms: 20000, cents: 2 },
    calculation_id: 'trend_signals',
    freshness: { demand: 6 * H, trend_direction: 6 * H, signals: 6 * H },
    gather: gather(1, 4),
  }),
  used_vs_official: row({
    kind: 'used_vs_official',
    slots_schema: { required: [prod], optional: ['condition', 'size'] },
    facts_schema: ['best_by_relation', 'used_discount', 'retail_price'],
    targets: [
      t('t1', 'plan', 'run', 'none', 10000, ['best_by_relation'], 1, 1.5, 'available_now'),
      t('t2', 'plan', 'run', 'none', 20000, ['retail_price'], 1, 2, 'retail_price'),
    ],
    budget: { first_ms: 3000, settled_ms: 20000, cents: 3.5 },
    calculation_id: 'used_vs_official',
    freshness: { best_by_relation: 15 * MIN, used_discount: 15 * MIN, retail_price: 24 * H },
    gather: noGather,
  }),
  listing_swarm: row({
    kind: 'listing_swarm',
    slots_schema: { required: [['item_id', 'product_id']], optional: ['sites'] },
    facts_schema: ['identity', 'comps', 'winners', 'terms', 'photo_rules', 'rules_fees', 'demand', 'risk', 'per_site'],
    targets: [
      t('t1', 'identity', 'resolve', 'none', 3000, ['identity'], 1, 0.3, '{item_id}'),
      t('t2', 'plan', 'run', 'none', 10000, ['comps'], 1, 2, 'price_now'),
      t('t3', 'index', 'winners', 'adapter', 10000, ['winners'], 5, 0.2),
      t('t4', 'engine', 'fetch', 'schema', 10000, ['terms'], 5, 0.3),
      t('t5', 'reviewed_rules', 'read', 'none', 1000, ['photo_rules'], 1, 0),
      t('t6', 'reviewed_rules', 'read', 'none', 1000, ['rules_fees'], 1, 0),
      t('t7', 'demand_trend', 'signals', 'none', 20000, ['demand'], 1, 0.3),
      t('t8', 'trust', 'risk', 'none', 5000, ['risk'], 1, 0.1),
    ],
    budget: { first_ms: 3000, settled_ms: 20000, cents: 5 },
    calculation_id: 'swarm_join',
    freshness: { identity: 7 * D, comps: 24 * H, winners: 15 * MIN, terms: D, photo_rules: D, rules_fees: D, demand: 6 * H, risk: D },
    gather: gather(1, 2, 3, 4, 5, 6),
  }),
  my_analytics: row({
    kind: 'my_analytics',
    slots_schema: { required: [['metric']], optional: ['window', 'storefronts'] },
    facts_schema: ['metric_value', 'series'],
    targets: [
      t('t1', 'own_tables', 'read', 'none', 1000, ['metric_value', 'series'], 1, 0, '{metric} {window}'),
      t('t2', 'session', 'sync', 'adapter', 4000, ['metric_value', 'series'], 1, 0.1, 'storefront sync when stale'),
    ],
    budget: { first_ms: 1000, settled_ms: 5000, cents: 1 },
    calculation_id: 'analytics_metric',
    freshness: { metric_value: 15 * MIN, series: 15 * MIN },
    gather: noGather,
  }),
  general: row({
    kind: 'general',
    slots_schema: { required: [['text']], optional: [] },
    facts_schema: ['answer_text', 'sources'],
    targets: [
      t('t1', 'open_web', 'search', 'none', 5000, ['sources'], 2, 0.3),
      t('t2', 'open_web', 'crawl', 'ladder', 15000, ['answer_text', 'sources'], 6, 1.2),
    ],
    budget: { first_ms: 3000, settled_ms: 20000, cents: 2 },
    calculation_id: 'open_web_answer',
    freshness: { answer_text: H, sources: H },
    gather: gather(1, 4),
  }),
};
