// Classify a question into a kind (spec/engines/intelligence-api.md §1, §3.1 steps 1-2): a typed body names its kind; rules
// decide next (a link, a barcode, words); else one Jev request; a failure or an invalid answer is `general`, never a kind
// with no protocol. Slots are filled by code, never by a model.
import { randomUUID } from 'node:crypto';
import { QUESTION_KINDS, type Question, type QuestionKind } from './answer.ts';
import { SITES } from '../harness/protocol.ts';
import { jevAsk, validateChoice, type JevQuestions, type JevResult } from './jev.ts';
import { PROTOCOLS } from './protocols.ts';

export interface ProtocolCandidate { text: string; top_kinds: QuestionKind[]; answer_id: string }
export interface Classified {
  kind: QuestionKind; slots: Record<string, unknown>; by: 'typed' | 'rule' | 'jev' | 'fallback';
  missing?: string[]; protocol_candidate?: ProtocolCandidate;
}
export interface ClassifyDeps { jev?: (state: object, questions: JevQuestions) => Promise<JevResult> }

export const ACCEPT_TOP = 0.85; // top probability the kind head must reach
export const ACCEPT_LEAD = 0.5; // and its lead over the runner-up

// Order matters: the more specific words come first.
const RULES: [QuestionKind, RegExp][] = [
  ['listing_swarm', /\b(write|create|draft|make)\b.*\blisting\b|\bcross-?post|\blist (this|it|these)\b/],
  ['my_analytics', /\bmy (sales|views|profit|revenue|analytics|orders|stats|watchers|sell-through)\b|\bhow are my\b/],
  ['used_vs_official', /\bused (vs\.?|versus|or) (new|retail)|\bused or new|\bnew or used|\bvs\.? new\b|\bbuy(ing)? used\b.*\b(new|retail)\b/],
  ['seller_reviews', /\bseller\b.*\b(reviews?|feedback|reputation|legit|trust|rating)\b|\b(reviews?|feedback|legit|trust)\b.*\bseller\b|@\w+.*\b(legit|feedback|reviews?)\b/],
  ['product_reviews', /\breviews?\b|\breliable\b|\bhow good is\b/],
  ['site_rules', /\b(fees?|rules?|allowed to sell|prohibited|restricted|polic(y|ies)|banned)\b/],
  ['sold_history', /\bsold\b|\bsell(s|ing)? for\b|\bprice history\b|\blast sold\b/],
  ['retail_price', /\bretail\b|\bmsrp\b|\bcosts? new\b|\boriginal price\b|\bnew price\b|\blist price\b/],
  ['trend', /\btrend(ing|s)?\b|\bdemand\b|\bpopular\b|\bwhat is hot\b|\bhot (right now|this)\b/],
  ['available_now', /\bin stock\b|\bwhere (can i|to) buy\b|\bavailable\b|\bfor sale\b|\bcheapest\b/],
  ['listings_matching', /\blistings\b|\bshow me\b|\bfind me\b|\bsearch for\b/],
  ['price_now', /\bworth\b|\bvalue\b|\bhow much\b|\bprice\b|\bgo for\b/],
  ['identify', /\bidentify\b|\bwhat (is|are) this( item)?\b/],
];

const CONDITIONS = ['new', 'like_new', 'used', 'refurbished'] as const;
function condition(low: string): string | undefined {
  if (/\blike new\b|\bexcellent condition\b/.test(low)) return 'like_new';
  if (/\brefurb(ished)?\b/.test(low)) return 'refurbished';
  if (/\bused\b|\bpre-?owned\b|\bworn\b/.test(low)) return 'used';
  if (/\bnwt\b|\bbrand new\b|\bnew with tags\b|\bnew\b/.test(low)) return 'new';
  return undefined;
}

function codeSlots(q: Question): Record<string, unknown> {
  const text = q.text?.trim() ?? '';
  const low = `${text} ${q.url ?? ''}`.toLowerCase();
  const s: Record<string, unknown> = {};
  if (text) s.text = text;
  const url = q.url ?? /https?:\/\/\S+/.exec(text)?.[0]; if (url) s.url = url;
  if (q.photo_id) s.photo_id = q.photo_id;
  const barcode = /\b\d{8,14}\b/.exec(text)?.[0]; if (barcode) s.barcode = barcode;
  const c = condition(low); if (c) s.condition = c;
  const site = SITES.find(x => low.includes(x)); if (site) s.site = site;
  const seller = /@([\w.-]{2,})/.exec(text)?.[1]; if (seller) s.seller = seller;
  const metric = /\b(sales|views|profit|revenue|orders|offers|watchers|sell-through)\b/.exec(low)?.[1]; if (metric) s.metric = metric;
  return { ...s, ...q.slots };
}

// The first name of every required group that no slot satisfies.
function missingSlots(kind: QuestionKind, slots: Record<string, unknown>): string[] {
  const has = (n: string) => slots[n] !== undefined && slots[n] !== null && slots[n] !== '';
  return PROTOCOLS[kind].slots_schema.required.filter(g => !g.some(has)).map(g => g[0]!);
}

const done = (kind: QuestionKind, slots: Record<string, unknown>, by: Classified['by'], extra: Partial<Classified> = {}): Classified => {
  const missing = missingSlots(kind, slots);
  return { kind, slots, by, ...(missing.length ? { missing } : {}), ...extra };
};

const KIND_HELP: Record<QuestionKind, string> = {
  price_now: 'what an item is worth right now', sold_history: 'what the item sold for before', retail_price: 'the new retail price',
  identify: 'what an item in a photo, link or barcode is', listings_matching: 'listings that match a description', available_now: 'who has it for sale now and the best offer',
  product_reviews: 'what buyers say about a product', seller_reviews: 'how a seller is rated', site_rules: 'a marketplace fees and rules',
  trend: 'whether demand for an item is rising or falling', used_vs_official: 'used compared with buying new', listing_swarm: 'write and post a listing across sites',
  my_analytics: "the seller's own sales and views", general: 'anything else',
};
const SITE_CHOICES = [...SITES, 'none'];
const COND_CHOICES = [...CONDITIONS, 'none'];
const heads = (): JevQuestions => ({
  kind: { type: 'choice', instructions: 'What is the person asking?', criteria: { ...KIND_HELP } },
  condition: { type: 'choice', instructions: 'The condition of the item named, if any.', criteria: Object.fromEntries(COND_CHOICES.map(c => [c, null])) },
  site: { type: 'choice', instructions: 'The marketplace named, if any.', criteria: Object.fromEntries(SITE_CHOICES.map(c => [c, null])) },
});

export async function classify(q: Question, deps: ClassifyDeps = {}): Promise<Classified> {
  const slots = codeSlots(q);
  if (q.kind && QUESTION_KINDS.includes(q.kind)) return done(q.kind, slots, 'typed');
  const low = (q.text ?? '').toLowerCase();
  const hit = RULES.find(([, re]) => re.test(low));
  if (hit) return done(hit[0], slots, 'rule');
  if (slots.url || q.photo_id || slots.barcode) return done('identify', slots, 'rule');
  const text = q.text?.trim();
  if (!text) return done('general', slots, 'fallback');

  const ask = deps.jev ?? ((state, questions) => jevAsk(state, questions));
  let r: JevResult;
  // The question goes to a third party: contact details are masked and the text clipped first (the machine client's reduce()).
  const outgoing = text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]').slice(0, 2000);
  try { r = await ask({ question: outgoing }, heads()); } catch { return done('general', slots, 'fallback'); }
  if (!r.ok) return done('general', slots, 'fallback');

  const kind = validateChoice(r.answers.kind, QUESTION_KINDS);
  if (!kind.ok) return done('general', slots, 'fallback');
  const p = kind.probabilities;
  const ranked = p ? (Object.entries(p).sort((a, b) => b[1] - a[1])) : [];
  const accepted = p !== undefined && ranked[0]![1] >= ACCEPT_TOP && ranked[0]![1] - (ranked[1]?.[1] ?? 0) >= ACCEPT_LEAD;
  if (!accepted) {
    const top_kinds = (ranked.length ? ranked.slice(0, 3).map(([k]) => k) : [kind.choice]) as QuestionKind[];
    return done('general', slots, 'fallback', { protocol_candidate: { text, top_kinds, answer_id: `cand_${randomUUID()}` } });
  }
  const filled = { ...slots };
  const cond = validateChoice(r.answers.condition, COND_CHOICES);
  if (cond.ok && cond.choice !== 'none' && filled.condition === undefined) filled.condition = cond.choice;
  const site = validateChoice(r.answers.site, SITE_CHOICES);
  if (site.ok && site.choice !== 'none' && filled.site === undefined) filled.site = site.choice;
  return done(kind.choice as QuestionKind, filled, 'jev');
}
