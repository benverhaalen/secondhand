// Search frames are the only evidence for progress (spec/product.md §7; team packet 70).
import type { SseFrame } from '../edge/api/jobs.ts';
import type { OfferView, SearchAnswer, SearchStage } from '../edge/api/search.ts';
import type { Found } from '../edge/intel/answer.ts';
import { emptyFound } from '../edge/intel/answer.ts';
import type { SiteOutcome } from '../edge/intel/public/search.ts';
import type { Pace } from '../edge/intel/run.ts';

export interface SourceReach {
  id: string;
  state: SearchStage['state'];
  outcome: SiteOutcome | null;
  read: number; kept: number;
  dropped: { reason: string; count: number }[];
  ms: number | null; pace: Pace | null; cost_usd_est: number | null; fallback: 'apify' | null;
  cached: 'refreshing' | 'kept' | null;
  error: { code: string; reason: string } | null;
  at: string | null;
}

export interface Reach {
  state: 'running' | 'done' | 'failed';
  query: string | null;
  sources: SourceReach[];
  landed: string[];
  pending: string[];
  found: Found;
  ms: { first: number | null; settled: number | null };
  results: OfferView[];
  error: { code: string; message: string } | null;
  skipped: number;
}

type Searched = Omit<Pick<SearchAnswer['searched'][number], 'site' | 'outcome' | 'ms' | 'pace' | 'error_code' | 'reason' | 'fallback' | 'cost_usd_est'>, 'site'> & { site: string; cached?: boolean };
type Answer = Pick<SearchAnswer, 'slots' | 'found' | 'ms'> & { searched: Searched[] };
type Stage = Pick<SearchStage, 'state' | 'found' | 'error'> & { stage: string; at: string };
type Partial = { site: string; results: OfferView[]; sites_pending: string[]; answer: Answer };
type Settled = Omit<Partial, 'site'> & { found: Found; searched: Searched[] };
type Event = { event: 'job.stage'; data: Stage } | { event: 'answer.partial'; data: Partial }
  | { event: 'answer.settled'; data: Settled }
  | { event: 'job.state'; data: { state: Reach['state']; error?: NonNullable<Reach['error']> } };

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const count = (v: unknown): v is number => number(v) && Number.isSafeInteger(v);
const nullableNumber = (v: unknown): v is number | null => v === null || number(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && Array.from(v).every(s => typeof s === 'string');
const counts = (v: unknown): v is Record<string, number> => object(v) && Object.values(v).every(count);
const found = (v: unknown): v is Found => object(v) && count(v.sources_searched) && count(v.results_found) && count(v.results_used)
  && counts(v.dropped_by_reason) && counts(v.sites);
const pace = (v: unknown): v is Pace => object(v) && number(v.per_minute) && number(v.min_gap_ms);
const error = (v: unknown): v is NonNullable<Reach['error']> => object(v) && typeof v.code === 'string' && typeof v.message === 'string';
const outcomes: readonly SiteOutcome[] = ['hit', 'empty', 'blocked', 'timeout', 'page_changed', 'needs_account', 'failed', 'unknown'];
const states: readonly SearchStage['state'][] = ['running', 'arrived', 'late', 'failed'];

function searched(v: unknown): v is Searched {
  return object(v) && typeof v.site === 'string' && outcomes.some(outcome => outcome === v.outcome) && number(v.ms)
    && (v.pace === undefined || pace(v.pace)) && (v.cost_usd_est === undefined || number(v.cost_usd_est))
    && (v.fallback === undefined || v.fallback === 'apify') && (v.cached === undefined || typeof v.cached === 'boolean')
    && (v.reason === undefined || typeof v.reason === 'string')
    && (v.error_code === undefined || typeof v.error_code === 'string' && typeof v.reason === 'string');
}

function answer(v: unknown): v is Answer {
  return object(v) && object(v.slots) && (v.slots.text === undefined || typeof v.slots.text === 'string') && found(v.found)
    && object(v.ms) && nullableNumber(v.ms.first) && nullableNumber(v.ms.settled)
    && Array.isArray(v.searched) && Array.from(v.searched).every(searched);
}

const money = (v: unknown) => v === null || object(v) && count(v.amount_cents) && typeof v.currency === 'string';
function offer(v: unknown): v is OfferView {
  if (!object(v)) return false;
  const required = ['id', 'listing_id', 'external_id', 'title', 'url', 'site', 'route_id', 'condition'];
  const optional = ['host', 'image_url', 'source_site', 'keep_until'];
  return required.every(key => typeof v[key] === 'string') && v.data === `live:${v.site}`
    && ['exact', 'likely_same_model', 'same_family_other_variant', 'comparable', 'unresolved'].some(relation => relation === v.relation)
    && ['marketplace', 'brand_store', 'retailer', 'amazon', 'refurb', 'brand_resale'].some(kind => kind === v.source_kind)
    && money(v.price_cents) && v.shipping_cents === null && money(v.delivered_cents)
    && typeof v.shipping_estimated === 'boolean' && strings(v.also_on)
    && optional.every(key => v[key] === undefined || typeof v[key] === 'string')
    && (v.converted === undefined || v.converted === true) && (v.may_model === undefined || v.may_model === false)
    && (v.via === undefined || v.via === 'apify')
    && (v.actor === undefined || v.actor === 'automation-lab~ebay-scraper' || v.actor === 'apify~facebook-marketplace-scraper')
    && (v.use_scope === undefined || v.use_scope === 'hackathon_demo')
    && (v.commercial_link === undefined || v.commercial_link === true)
    && (v.attribution === undefined || v.attribution === 'Dupe.com')
    && (v.secondhand === undefined || typeof v.secondhand === 'boolean');
}

function parse(raw: unknown, asked: Set<string> | null): Event | null {
  if (!object(raw) || !count(raw.id) || typeof raw.event !== 'string' || !object(raw.data)) return null;
  const frame: SseFrame = { id: raw.id, event: raw.event, data: raw.data }, d = frame.data;
  const known = (id: string) => asked === null || asked.has(id);
  if (frame.event === 'job.stage') {
    if (typeof d.stage !== 'string' || !d.stage.startsWith('site:') || d.stage.length === 5 || !known(d.stage.slice(5))
      || !states.some(state => state === d.state) || typeof d.at !== 'string' || !found(d.found)
      || d.error !== undefined && !error(d.error)) return null;
    return { event: 'job.stage', data: d as Stage };
  }
  if (frame.event === 'job.state') {
    if (d.state !== 'running' && d.state !== 'done' && d.state !== 'failed') return null;
    if (d.state === 'failed' && !error(d.error)) return null;
    return { event: 'job.state', data: { state: d.state, ...(d.state === 'failed' ? { error: d.error as NonNullable<Reach['error']> } : {}) } };
  }
  if (frame.event !== 'answer.partial' && frame.event !== 'answer.settled') return null;
  if (!answer(d.answer) || !d.answer.searched.every(s => known(s.site))
    || !Array.isArray(d.results) || !Array.from(d.results).every(offer) || !strings(d.sites_pending) || !d.sites_pending.every(known)) return null;
  if (frame.event === 'answer.partial') {
    if (typeof d.site !== 'string' || !known(d.site)) return null;
    return { event: 'answer.partial', data: d as Partial };
  }
  // Cache retention is on result.searched, not answer.searched (search.ts result()/answer()).
  if (!found(d.found) || !Array.isArray(d.searched) || !Array.from(d.searched).every(searched) || !d.searched.every(s => known(s.site))) return null;
  return { event: 'answer.settled', data: d as Settled };
}

const source = (id: string): SourceReach => ({ id, state: 'running', outcome: null, read: 0, kept: 0, dropped: [],
  ms: null, pace: null, cost_usd_est: null, fallback: null, cached: null, error: null, at: null });
const copyOffers = (rows: OfferView[]): OfferView[] => rows.map(o => ({ ...o, also_on: [...o.also_on],
  price_cents: o.price_cents ? { amount_cents: o.price_cents.amount_cents, currency: o.price_cents.currency } : null,
  delivered_cents: o.delivered_cents ? { amount_cents: o.delivered_cents.amount_cents, currency: o.delivered_cents.currency } : null }));

export function reach(start: unknown, frames: unknown[]): Reach {
  const sources = new Map<string, SourceReach>(), stages = new Map<string, Found>();
  const stageErrors = new Map<string, SourceReach['error']>(), partials = new Map<string, OfferView[]>();
  const searchedErrors = new Map<string, SourceReach['error']>();
  const asked = object(start) && Array.isArray(start.stages) ? new Set<string>() : null;
  if (asked && object(start) && Array.isArray(start.stages)) {
    for (const s of start.stages) {
      if (!object(s) || typeof s.name !== 'string' || !s.name.startsWith('site:') || s.name.length === 5
        || s.state !== 'running' || !found(s.found)) continue;
      const id = s.name.slice(5);
      asked.add(id); sources.set(id, source(id));
    }
  }
  const out: Reach = { state: 'running', query: null, sources: [], landed: [], pending: [], found: emptyFound(),
    ms: { first: null, settled: null }, results: [], error: null, skipped: 0 };
  let pending: string[] | null = null, final: Settled | null = null;
  const get = (id: string) => {
    let s = sources.get(id);
    if (!s) { s = source(id); sources.set(id, s); }
    return s;
  };
  const land = (id: string) => { if (!out.landed.includes(id)) out.landed.push(id); };
  for (const raw of frames) {
    const frame = parse(raw, asked);
    if (!frame) { out.skipped++; continue; }
    if (frame.event === 'job.state') {
      out.state = frame.data.state;
      out.error = frame.data.error ?? null;
      continue;
    }
    if (frame.event === 'job.stage') {
      const d = frame.data, id = d.stage.slice(5), s = get(id);
      s.state = d.state; s.at = d.at; s.read = d.found.results_found; s.kept = d.found.results_used;
      s.dropped = Object.entries(d.found.dropped_by_reason).map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count || (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0));
      const e = d.error ? { code: d.error.code, reason: d.error.message } : null;
      stageErrors.set(id, e); s.error = e ?? searchedErrors.get(id) ?? null;
      stages.set(id, d.found);
      if (d.state !== 'running') land(id);
      continue;
    }
    const d = frame.data;
    out.query = typeof d.answer.slots.text === 'string' ? d.answer.slots.text : null;
    out.ms = { first: d.answer.ms.first, settled: d.answer.ms.settled };
    pending = [...d.sites_pending];
    for (const entry of d.answer.searched) {
      const s = get(entry.site);
      land(entry.site);
      s.outcome = entry.outcome; s.ms = entry.ms; s.pace = entry.pace ? { ...entry.pace } : null;
      s.cost_usd_est = entry.cost_usd_est ?? null; s.fallback = entry.fallback ?? null;
      const e = entry.error_code !== undefined && entry.reason !== undefined ? { code: entry.error_code, reason: entry.reason } : null;
      searchedErrors.set(s.id, e); s.error = stageErrors.get(s.id) ?? e;
    }
    if (frame.event === 'answer.partial') {
      const s = get(frame.data.site);
      land(s.id);
      partials.set(s.id, frame.data.results);
      s.cached = pending.includes(s.id) ? 'refreshing' : null;
    } else {
      final = frame.data;
      for (const s of sources.values()) s.cached = frame.data.searched.find(entry => entry.site === s.id)?.cached ? 'kept' : null;
    }
  }
  if (final) {
    out.found = { sources_searched: final.found.sources_searched, results_found: final.found.results_found,
      results_used: final.found.results_used, sites: { ...final.found.sites }, dropped_by_reason: { ...final.found.dropped_by_reason } };
    out.results = copyOffers(final.results);
  }
  else {
    for (const f of stages.values()) {
      for (const key of ['sources_searched', 'results_found', 'results_used'] as const) out.found[key] += f[key];
      for (const key of ['sites', 'dropped_by_reason'] as const) {
        for (const [name, count] of Object.entries(f[key])) out.found[key] = { ...out.found[key],
          [name]: (Object.hasOwn(out.found[key], name) ? out.found[key][name] : 0) + count };
      }
    }
    out.results = copyOffers(out.landed.flatMap(id => partials.get(id) ?? []));
  }
  out.sources = asked ? [...sources.values()] : [...out.landed.map(get), ...[...sources.values()].filter(s => !out.landed.includes(s.id))];
  out.pending = pending ?? out.sources.filter(s => !out.landed.includes(s.id)).map(s => s.id);
  return out;
}
