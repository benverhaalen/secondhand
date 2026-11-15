// Rests-on: spec/product.md §3 item/observation, §6 proof; spec/plans/finalization.md SV6, EN6.
import { ApiError, deps, type Ctx, type Handler, type Reply } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, oneOf, url, invalid, reference, pagination, object } from './captures.ts';
import { valuate, type ValuationItem, type ObservationPort } from '../../engines/valuation/valuate.ts';
import { memoryStore } from '../../engines/param/param.ts';
import type { FamilyBand } from '../../engines/valuation/fast.ts';
import { DEFAULTS, type Comp } from '../../engines/valuation/comps.ts';
import type { Attribute } from '../card/card.ts';
import type { Rights } from '../../engines/proof/proof.ts';
import { soldSources, type SoldSite } from '../../engines/valuation/sold.ts';
import { soldSearch } from './valuation-sold.ts';
import { example } from './examples.ts';
import { jobs, type ApiJobRow } from './jobs.ts';
import { store } from './store.ts';
import { runtime, EXAMPLE_USER } from './runtime.ts';
import type { Row } from '../events/ports.ts';

// shortcut: runtime.params is the events policy store, not a ParamStore; use one registry until the durable registry lands.
const params = memoryStore();
const soldSites: SoldSite[] = ['mercari', 'poshmark'];
type Item = Row & { title: string; product_id?: string; kind?: string; condition?: string; attributes?: Attribute[]; category?: string; size?: string; family_id?: string; floor_cents?: number };
// shortcut: structural SV7 contract until events/observations.ts lands; replace these types with its exports then.
export type ObservationInput = {
  kind: 'price'; site: string; product_id?: string; subject_ref: string; observed_at: string;
  payload: Record<string, unknown>; data: `live:${string}`; rights: Rights; source_route: string;
  source_url: string; extractor_version: string; retention_class: string; rights_mode: string;
  may_store: boolean; may_model: boolean; use_scope: string; keep_until: string | null; channel: 'secondhand';
};
type ObservationRow = { payload: unknown; product_id?: string; keep_until?: string | null; may_model?: boolean;
  rights?: Rights; evidence?: { rights: Rights } };
type ObservationFunctions = {
  read(user_id: string, q: { kind: 'price'; product_id: string; purpose: 'show' }): ObservationRow[] | Promise<ObservationRow[]>;
  write(user_id: string, rows: ObservationInput[]): unknown | Promise<unknown>;
};
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
function isComp(value: unknown): value is Comp {
  if (!object(value)) return false;
  return ['comp_id', 'condition', 'citation'].every(k => typeof value[k] === 'string' && value[k].trim().length > 0) &&
    ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'].includes(String(value.site)) && date(value.sold_at) &&
    (value.observed_at === undefined || date(value.observed_at)) &&
    Object.hasOwn(DEFAULTS.condition_ratios, String(value.condition)) &&
    (value.extraction_source === undefined || Object.hasOwn(DEFAULTS.w_extract, String(value.extraction_source))) &&
    (value.works === undefined || Object.hasOwn(DEFAULTS.works_ratios, String(value.works))) &&
    typeof value.price_cents === 'number' && Number.isSafeInteger(value.price_cents) && value.price_cents > 0 &&
    ['sold', 'best_offer', 'own_order'].includes(String(value.kind)) && ['variant', 'product', 'family', 'category'].includes(String(value.level)) &&
    typeof value.w_match === 'number' && Number.isFinite(value.w_match) && value.w_match >= 0 &&
    typeof value.w_extract === 'number' && Number.isFinite(value.w_extract) && value.w_extract >= 0 && typeof value.may_model === 'boolean' &&
    ['product_id', 'family_id', 'cluster_id', 'size', 'works', 'extraction_source'].every(k => value[k] === undefined || typeof value[k] === 'string') &&
    (value.completeness === undefined || Array.isArray(value.completeness) && value.completeness.every(v => typeof v === 'string' && Object.hasOwn(DEFAULTS.completeness_ratios, v)));
}
export function observationPort(functions: ObservationFunctions, user_id: string, log: Ctx['log']): ObservationPort {
  return {
    async read(q) {
      const rows = await functions.read(user_id, { kind: 'price', product_id: q.product_id, purpose: 'show' });
      return rows.flatMap(row => {
        const rights = row.evidence?.rights ?? row.rights;
        if (rights?.may_show === false || row.keep_until != null && (!date(row.keep_until) || Date.parse(row.keep_until) <= Date.parse(q.as_of))) return [];
        if (!isComp(row.payload)) { log.error('valuation.observations.invalid', new Error('Observation payload is not a valid Comp')); return []; }
        return [{ ...row.payload, may_model: row.payload.may_model && row.may_model !== false && rights?.may_model !== false }];
      });
    },
    async write(rows) {
      await functions.write(user_id, rows.map(comp => ({ kind: 'price', site: comp.site, product_id: comp.product_id,
        subject_ref: comp.comp_id, observed_at: comp.sold_at, payload: { ...comp }, data: `live:${comp.site}`,
        rights: { may_store: true, may_model: comp.may_model, may_show: true, may_share: false, ttl: null },
        source_route: 'valuation.sold', source_url: comp.citation, extractor_version: 'valuation.sold',
        retention_class: 'history', rights_mode: 'public', may_store: true, may_model: comp.may_model,
        use_scope: 'show', keep_until: null, channel: 'secondhand' })));
    },
  };
}
const uncomposed: ObservationPort = {
  read: async () => [],
  async write(rows) { deps.log.note('valuation.observations.not_composed', { rows: rows.length }); },
};
export const ports: { sources: typeof soldSources; observations: ObservationPort; valuate: typeof valuate } = {
  sources: soldSources, observations: uncomposed, valuate,
};

function itemFor(row: Item): ValuationItem & { title: string; fast?: FamilyBand } {
  const sample = row.id === 'it_7c2m' && row.user_id === EXAMPLE_USER
    ? example('items.get').response as { valuation: { range: { low: { amount_cents: number }; high: { amount_cents: number }; basis_count: number; as_of: string } } } : null;
  const range = sample?.valuation.range;
  const confirmed = (name: string) => {
    const value = row.attributes?.find(attribute => attribute.name === name && attribute.confirmed)?.value;
    return typeof value === 'string' ? value : undefined;
  };
  // shortcut: no grade until capture confirms one, upgrade when capture writes condition
  const condition = confirmed('condition') ?? row.condition ?? 'good';
  // Capture's grade names (jobs/capture/process.json) mapped to the valuation registry's D2 names.
  const grades: Record<string, string> = { like_new: 'excellent', poor: 'for_parts' };
  return { item_id: row.id, product_id: row.product_id ?? row.id, title: row.title, kind: row.kind ?? row.category, condition: grades[condition] ?? condition,
    size: confirmed('size') ?? row.size, family_id: row.family_id, floor_cents: row.floor_cents ?? 0, objective: 'balanced', sites: soldSites.map(site => ({ site })),
    ...(range ? { fast: { low: range.low.amount_cents, high: range.high.amount_cents, n: range.basis_count, as_of: range.as_of, basis: 'family', state: 'rough' } } : {}) };
}
async function run(ctx: Ctx, seed: Exclude<Reply, Response>, row?: Item) {
  const item = ctx.body.url ? null : itemFor(row ?? store.get<Item>('item', EXAMPLE_USER, 'it_7c2m')!);
  const body = seed.body as { id: string; kind: 'valuate'; state: 'running' | 'queued'; stages: ApiJobRow['stages']; item_id?: string };
  const ownBody = row ? { ...body, item_id: row.id } : body;
  const job = ctx.user_id === EXAMPLE_USER ? jobs.start({ ...ownBody, args: { ...ctx.body } }, ctx.user_id)
    : jobs.put({ ...ownBody, id: undefined, args: { ...ctx.body } }, ctx.user_id!);
  if (item) {
    try {
      const as_of = new Date(deps.now()).toISOString();
      const sources = ports.sources(soldSearch({ person_id: ctx.user_id!, accounts: runtime.accounts, harness: runtime.harness,
        live_sites: (process.env.SECONDHAND_LIVE_SITES ?? '').split(/[ ,]+/), log: ctx.log }), soldSites,
      { query: item.title, condition: item.condition, error: (where, error) => ctx.log.error(where, error) });
      let portFailed = false;
      // SV7 composition: replace uncomposed here with observationPort({ read: (user, q) => readObservations(store, user, q), write: (user, rows) => writeObservations(store, user, rows) }, ctx.user_id!, ctx.log).
      const observation = ports.observations;
      const observations: ObservationPort = {
        async read(q) {
          try { return await observation.read(q); }
          catch (error) { portFailed = true; throw error; }
        },
        async write(rows, meta) {
          if (observation === uncomposed) { ctx.log.note('valuation.observations.not_composed', { rows: rows.length }); return; }
          try { await observation.write(rows.map(comp => ({ ...comp, product_id: comp.product_id ?? item.product_id })), meta); }
          catch (error) { portFailed = true; throw error; }
        },
      };
      const result = await ports.valuate(item, { params, sources, observations, as_of, person: ctx.user_id!, request_id: job.id,
        log: { timed: (name, fn) => ctx.log.timed(name, fn), error: (where, error) => ctx.log.error(where, error) } });
      if (portFailed || !result.persisted) throw new Error('Valuation observation port failed');
      jobs.finish(job.id, { ...result.valuation, ...(result.gather ? { gather: result.gather } : {}), range_state: result.valuation.range.state });
    } catch (error) {
      ctx.log.error('valuation.run', error);
      const failure = new ApiError('unavailable', 'The valuation could not be finished.', 'valuate');
      jobs.update(job.id, { state: 'failed', error: { code: failure.code, message: failure.message } });
      jobs.append(job.id, 'job.state', { job_id: job.id, state: 'failed' });
      ctx.log.event('state.change', { entity: 'job', id: job.id, to: 'failed' });
      throw failure;
    }
  }
  ctx.log.event('state.change', { entity: 'job', id: job.id, to: item ? 'done' : 'queued' });
  return { ...seed, body: { ...ownBody, id: job.id } };
}
function validate(ctx: Ctx) {
  fields(ctx.body, {}, { item_id: text, capture_id: text, url, purpose: oneOf('sell', 'appraise', 'find') });
  if (['item_id', 'capture_id', 'url'].filter(k => ctx.body[k] !== undefined).length !== 1) throw invalid('one of item_id, capture_id or url is required');
  if (ctx.body.capture_id) reference(ctx.body.capture_id, ['cap_3n9q']);
}
const legacy = exampleHandler('POST /v1/valuations', validate, c => c.body.url ? 'valuations.appraise_url' : 'valuations.create', run);
export const handlers: Record<string, Handler> = {
  'POST /v1/valuations': fromEngine(async (ctx, req) => {
    if (ctx.body.item_id === undefined) return legacy(ctx, req);
    pagination(ctx);
    ctx.log.input('api', 'POST /v1/valuations', { fields: Object.keys(ctx.body), query_fields: [...ctx.query.keys()] });
    validate(ctx);
    const row = store.get<Item>('item', ctx.user_id!, String(ctx.body.item_id));
    if (!row || row.deleted || row.user_id !== ctx.user_id || row.id === 'it_7c2m' && ctx.user_id !== EXAMPLE_USER) throw new ApiError('not_found', 'item not found', 'read');
    const seed = example('valuations.create');
    return ctx.log.call('tool', 'api.engine', { endpoint: 'POST /v1/valuations' }, () => run(ctx, { status: seed.status, body: structuredClone(seed.response), headers: seed.headers }, row), () => ({ result: { source: 'engine' } }));
  }),
};
export const manifest = manifestFor(handlers);
