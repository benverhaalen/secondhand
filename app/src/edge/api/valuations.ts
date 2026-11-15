// Rests-on: spec/product.md §3 item/observation, §6 proof; spec/plans/finalization.md SV6, EN6.
import { ApiError, deps, type Ctx, type Handler, type Reply } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text, oneOf, url, invalid, reference, pagination, object } from './captures.ts';
import { valuate, type ValuationItem, type ObservationPort, type ValuateCtx } from '../../engines/valuation/valuate.ts';
import { memoryStore } from '../../engines/param/param.ts';
import type { FamilyBand } from '../../engines/valuation/fast.ts';
import { DEFAULTS, canonical, comparables, parameters, type Comp, type WeightedComp } from '../../engines/valuation/comps.ts';
import type { Attribute } from '../card/card.ts';
import { answer, basisHash, type Citation } from '../../engines/proof/proof.ts';
import { readObservations, writeObservations, type ObservationInput, type ObservationRow } from '../events/observations.ts';
import { gather, protocolSteps, searchStep, type GatherResult } from '../intel/gather.ts';
import { declareLearning, updateContribution } from '../intel/learn.ts';
import { emptyFound, type Answer, type Fact } from '../intel/answer.ts';
import type { Plan } from '../intel/run.ts';
import { handlers as searchHandlers, ports as searchPorts } from './search.ts';
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
type Item = Row & { title?: string; product_id?: string; brand?: string; model?: string; kind?: string; condition?: string; attributes?: Attribute[]; category?: string; size?: string; family_id?: string; floor_cents?: number };
export type { ObservationInput } from '../events/observations.ts';
type ObservationFunctions = {
  read(user_id: string, q: Parameters<typeof readObservations>[2]): ObservationRow[] | Promise<ObservationRow[]>;
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
function provenance(comp: Comp): ObservationInput['data'] {
  if (!('data' in comp)) return `live:${comp.site}`;
  const data = comp.data;
  if (data === 'synthetic' || data === 'example' || data === `live:${comp.site}` || typeof data === 'string' && /^dataset:\S.*$/.test(data)) return data as ObservationInput['data'];
  throw new Error('Comp data must name its provenance');
}
export function observationPort(functions: ObservationFunctions, user_id: string, log: Ctx['log']): ObservationPort {
  return {
    async read(q) {
      const rows = await functions.read(user_id, { kind: 'price', product_id: q.product_id, purpose: 'show' });
      const dropped = { expired: 0, bad_keep_until: 0, not_showable: 0 };
      const comps = rows.flatMap(row => {
        const rights = row.evidence.rights;
        if (rights.may_show !== true) { dropped.not_showable++; return []; }
        if (row.keep_until != null) {
          if (!date(row.keep_until)) { dropped.bad_keep_until++; return []; }
          if (Date.parse(row.keep_until) <= Date.parse(q.as_of)) { dropped.expired++; return []; }
        }
        if (!isComp(row.payload)) { log.error('valuation.observations.invalid', new Error('Observation payload is not a valid Comp')); return []; }
        return [{ ...row.payload, may_model: row.payload.may_model && row.may_model === true && rights.may_model === true }];
      });
      if (Object.values(dropped).some(count => count > 0)) log.note('valuation.observations.dropped', dropped);
      return comps;
    },
    async write(rows) {
      await functions.write(user_id, rows.filter(comp => !('may_store' in comp) || comp.may_store === true).map(comp => ({ kind: 'price', site: comp.site, product_id: comp.product_id,
        subject_ref: comp.comp_id, observed_at: comp.sold_at, payload: { ...comp }, data: provenance(comp),
        rights: { may_store: true, may_model: comp.may_model, may_show: true, may_share: false, ttl: null },
        source_route: 'valuation.sold', source_url: comp.citation, extractor_version: 'valuation.sold',
        may_store: true, may_model: comp.may_model,
        use_scope: 'hackathon_demo', keep_until: null, channel: 'secondhand', retention_class: 'source_ttl', rights_mode: 'own_scope' })));
    },
  };
}
declareLearning(params);
export const pendingValuations = new Map<string, Promise<void>>();
export const ports: { sources: typeof soldSources; soldSearch: typeof soldSearch; observations: ObservationPort | null; valuate: typeof valuate; params: typeof params } = {
  sources: soldSources, soldSearch, observations: null, valuate, params,
};

function storedCitations(valuation: Awaited<ReturnType<typeof valuate>>['valuation'], user: string, item: ValuationItem, registry: typeof params) {
  const rows = readObservations(store, user, { kind: 'price', product_id: valuation.product_id, purpose: 'show' });
  const cite = (citation: Citation | null | undefined, comps: readonly (Comp | WeightedComp)[]) => {
    if (!citation) return citation;
    const basis = citation.basis_ids.map(id => {
      const comp = comps.find(c => c.comp_id === id);
      const observed = rows.find(row => row.subject_ref === id && row.payload.price_cents === comp?.price_cents && row.payload.sold_at === comp?.sold_at && row.payload.citation === comp?.citation);
      return comp && observed ? { id: observed.id, source: comp.citation, at: comp.sold_at, weight: 'w' in comp ? comp.w as number : 1, price_cents: 'adjusted_cents' in comp ? comp.adjusted_cents as number : comp.price_cents } : null;
    });
    if (basis.some(row => row === null)) return citation;
    const proof = answer(null, basis.filter(row => row !== null), citation, valuation.as_of);
    if (!proof.ok) throw new Error('Stored valuation citation has no basis');
    return proof.citation;
  };
  valuation.citation = cite(valuation.citation, valuation.comps) ?? null;
  const resolved = parameters(registry, { person: user, ...(item.kind ? { kind: item.kind } : {}) });
  for (const site of valuation.per_site) {
    const local = comparables({ ...item, site: site.site }, valuation.observation_snapshot, valuation.as_of, resolved);
    site.citation = cite(site.citation, local.comps) ?? null;
  }
  if (valuation.last_sale) valuation.last_sale.citation = cite(valuation.last_sale.citation, valuation.observation_snapshot)!;
}

function itemFor(row: Item, log: Ctx['log']): ValuationItem & { title: string; fast?: FamilyBand } {
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
  const grades: Record<string, string> = { new_with_tags: 'new_with_tags', new_without_tags: 'new_without_tags',
    like_new: 'excellent', excellent: 'excellent', good: 'good', fair: 'fair', poor: 'for_parts', for_parts: 'for_parts' };
  const known = Object.hasOwn(grades, condition);
  if (!known) log.note('valuation.condition_unknown', { grade: condition });
  return { item_id: row.id, product_id: row.product_id, title: row.title?.trim() ?? '',
    brand: confirmed('brand') ?? row.brand, model: confirmed('model') ?? row.model,
    kind: confirmed('kind') ?? row.kind ?? row.category ?? confirmed('type'), condition: known ? grades[condition] : 'good',
    size: confirmed('size') ?? row.size, family_id: row.family_id, floor_cents: row.floor_cents ?? 0, objective: 'balanced', sites: soldSites.map(site => ({ site })),
    ...(range ? { fast: { low: range.low.amount_cents, high: range.high.amount_cents, n: range.basis_count, as_of: range.as_of, basis: 'family', state: 'rough' } } : {}) };
}
async function run(ctx: Ctx, seed: Exclude<Reply, Response>, row?: Item) {
  const body = seed.body as { id: string; kind: 'valuate'; state: 'running' | 'queued'; stages: ApiJobRow['stages']; item_id?: string };
  const ownBody = row ? { ...body, item_id: row.id } : body;
  const job = ctx.user_id === EXAMPLE_USER ? jobs.start({ ...ownBody, args: { ...ctx.body } }, ctx.user_id)
    : jobs.put({ ...ownBody, id: undefined, args: { ...ctx.body } }, ctx.user_id!);
  const fail = (error: unknown) => {
    ctx.log.error('valuation.run', error);
    const failure = new ApiError('unavailable', 'The valuation could not be finished.', 'valuate');
    jobs.update(job.id, { state: 'failed', error: { code: failure.code, message: failure.message } });
    jobs.append(job.id, 'job.state', { job_id: job.id, state: 'failed' });
    ctx.log.event('state.change', { entity: 'job', id: job.id, to: 'failed' });
    return failure;
  };
  if (!ctx.body.url) {
    try {
      const stored = row ?? store.get<Item>('item', EXAMPLE_USER, 'it_7c2m');
      if (!stored) throw new Error('Example valuation item is missing');
      const item = itemFor(stored, ctx.log);
      const product_id = item.product_id ?? item.item_id;
      const query = item.title || [item.brand, item.model, item.kind].filter(value => value?.trim()).join(' ') || item.product_id || '';
      const as_of = new Date(deps.now()).toISOString();
      const sourceRows: Comp[] = [];
      const titles = new Map<string, string>();
      const search = ports.soldSearch({ person_id: ctx.user_id!, accounts: runtime.accounts, harness: runtime.harness,
        live_sites: (process.env.SECONDHAND_LIVE_SITES ?? '').split(/[ ,]+/), log: ctx.log });
      const sources = ports.sources(async (site, query, signal) => {
        const result = await search(site, query, signal);
        for (const row of result.rows) if (typeof row.external_id === 'string' && typeof row.title === 'string') titles.set(`${site}:${row.external_id}`, row.title);
        return result;
      }, soldSites, { query, condition: item.condition, error: (where, error) => ctx.log.error(where, error) }).map(source => async (signal: AbortSignal) => {
        const rows = (await source(signal)).map(comp => titles.has(comp.comp_id) ? { ...comp, title: titles.get(comp.comp_id)! } : comp);
        if (!signal.aborted) sourceRows.push(...rows); return rows;
      });
      let portFailed = false;
      const observation = ports.observations ?? observationPort({
        read: (user, q) => readObservations(store, user, q),
        write: (user, rows) => writeObservations(store, user, rows),
      }, ctx.user_id!, ctx.log);
      const written = new Set<string>();
      const observations: ObservationPort = {
        async read(q) {
          try { return await observation.read(q); }
          catch (error) { portFailed = true; throw error; }
        },
        async write(rows, meta) {
          try {
            const fresh = rows.filter(comp => !written.has(comp.comp_id));
            if (fresh.length) await observation.write(fresh.map(comp => ({ ...comp, product_id: comp.product_id ?? product_id })), meta);
            for (const comp of fresh) written.add(comp.comp_id);
          }
          catch (error) { portFailed = true; throw error; }
        },
      };
      const valuationCtx: ValuateCtx = { params: ports.params, sources, observations, as_of, person: ctx.user_id!, request_id: job.id,
        log: { timed: (name, fn) => ctx.log.timed(name, fn), error: (where: string, error: unknown) => ctx.log.error(where, error) } };
      let result = await ports.valuate(item, valuationCtx);
      if (portFailed || !result.persisted) throw new Error('Valuation observation port failed');
      const finish = async () => {
        if (result.valuation.range.state === 'needs_identity') {
          ctx.log.note('valuation.needs_identity', { item_id: item.item_id, needs: result.valuation.needs });
          jobs.finish(job.id, { ...result.valuation, range_state: 'needs_identity' });
          ctx.log.event('state.change', { entity: 'job', id: job.id, to: 'done' });
          return;
        }
        let gathered: GatherResult | undefined;
        if (result.gather) {
          const range = result.valuation.range;
          const shown = range.q10 !== null && range.q90 !== null;
          const guarded = { state: shown ? 'shown' as const : 'hidden' as const, notes: [result.gather.reason],
            ...(!shown ? { hide_reason: result.gather.reason } : {}),
            basis_count: result.valuation.comps.length, as_of, citation_id: result.valuation.citation?.id ?? null };
          const fact: Fact = { name: 'sold_range', guarded,
            ...(shown ? { range: { low: range.q10!, high: range.q90! }, unit: 'cents' } : {}),
            sources: readObservations(store, ctx.user_id!, { kind: 'price', product_id, purpose: 'show' }).map(row => row.evidence) };
          const plan: Plan = { kind: 'price_now', slots: { product_id }, protocol_version: 1,
            targets: [], first_ms: 0, settled_ms: 0, calculate: () => ({ facts: [fact] }) };
          const initial: Answer = { id: job.id, kind: plan.kind, slots: plan.slots, protocol_version: plan.protocol_version,
            facts: [fact], found: emptyFound(), searched: [], stage: 'settled', ms: { first: 0, settled: 0 } };
          const steps = searchPorts.sources.filter(source => source.on).map(source => searchStep({
            handler: searchHandlers['POST /v1/search'], jobs, ctx, text: query.toLowerCase(), source: source.id,
          }));
          gathered = await gather({ answer: initial, plan, product: product_id, arrivals: [{ target_id: 'sold', route_id: 'valuation.sold', rows: result.valuation.comps, ms: 0 }],
            now: deps.now, steps: [...steps, ...protocolSteps('price_now', {})], learning: ports.params, person: ctx.user_id!,
            onError: (where, error) => ctx.log.error(where, error),
            onEvent: (event, update) => {
              ctx.log.event(event, { job: job.id, answer: update, n: update.gather?.steps_done.at(-1) ?? 0 });
              jobs.append(job.id, event, { job_id: job.id, answer: update });
            } });
          const found = gathered.arrivals.filter(arrival => arrival.target_id !== 'sold').flatMap(arrival => arrival.rows).filter(isComp);
          result = await ports.valuate(item, { ...valuationCtx, sources: [async () => [...sourceRows, ...found]] });
        }
        if (ports.observations === null) storedCitations(result.valuation, ctx.user_id!, item, valuationCtx.params);
        // *agent proposal*: no API route records sales; until the watcher calls learning, source agreement on model-permitted observations is the minimum signal.
        if (portFailed || !result.persisted) throw new Error('Valuation observation port failed');
        const modelRows = ports.observations === null ? readObservations(store, ctx.user_id!, { kind: 'price', product_id, purpose: 'model' }) : [];
        const permitted = modelRows.map(row => row.payload).filter(isComp).filter(comp => comp.may_model && comp.site !== 'ebay');
        const modelParams = parameters(ports.params, { person: ctx.user_id!, ...(item.kind ? { kind: item.kind } : {}) });
        const eligible = canonical(permitted, as_of, modelParams);
        const agreement = comparables(item, eligible, as_of, modelParams);
        const called = [...new Set(eligible.map(comp => `public.${comp.site}`))];
        const used = called.filter(target => agreement.comps.some(comp => `public.${comp.site}` === target &&
          agreement.range.q10 !== null && agreement.range.q90 !== null &&
          comp.adjusted_cents >= agreement.range.q10 && comp.adjusted_cents <= agreement.range.q90));
        if (called.length) {
          updateContribution(ports.params, { kind: 'price_now', stage: 'settled', called, used,
            person: ctx.user_id!, outcome_id: basisHash(eligible.map(comp => ({ id: comp.comp_id, source: comp.citation, at: comp.sold_at, price_cents: comp.price_cents }))) }, as_of);
          for (const target of called) ctx.log.event('state.change', { entity: 'param', id: 'intel_contribution', to: 'observed agreement',
            target, version: ports.params.read('intel_contribution', { kind: 'price_now', segment: target, person: ctx.user_id! }).version });
        }
        jobs.finish(job.id, { ...result.valuation, ...(result.gather || gathered ? { gather: { ...result.gather, ...(gathered ? { request: gathered.request, stop: gathered.stop, records: gathered.records, searched: gathered.answer.searched } : {}) } } : {}), range_state: result.valuation.range.state });
        ctx.log.event('state.change', { entity: 'job', id: job.id, to: 'done' });
      };
      if (result.gather) {
        if (ports.observations === null) storedCitations(result.valuation, ctx.user_id!, item, valuationCtx.params);
        jobs.update(job.id, { result: { ...result.valuation, gather: result.gather, range_state: result.valuation.range.state } });
        const task = Promise.resolve().then(finish).catch(error => { fail(error); }).finally(() => pendingValuations.delete(job.id));
        pendingValuations.set(job.id, task);
      } else await finish();
    } catch (error) { throw fail(error); }
  }
  ctx.log.event('state.change', { entity: 'job', id: job.id, to: ctx.body.url ? 'queued' : jobs.get(job.id, ctx.user_id!)?.state ?? 'running' });
  return { ...seed, body: { ...ownBody, id: job.id } };
}
function validate(ctx: Ctx) {
  fields(ctx.body, {}, { item_id: text, capture_id: text, url, purpose: oneOf('sell', 'appraise', 'find') });
  if (['item_id', 'capture_id', 'url'].filter(k => ctx.body[k] !== undefined).length !== 1) throw invalid('one of item_id, capture_id or url is required');
  if (ctx.body.capture_id) reference(ctx.body.capture_id, ['cap_3n9q']);
}
const legacy = exampleHandler('POST /v1/valuations', validate, c => c.body.url ? 'valuations.appraise_url' : 'valuations.create', run);
/** Starts the engine valuation of a stored item the caller owns; POST /v1/valuations and an appraise capture's finish share it. */
export function startValuation(ctx: Ctx, row: Item) {
  const seed = example('valuations.create');
  return ctx.log.call('tool', 'api.engine', { endpoint: 'POST /v1/valuations' }, () => run(ctx, { status: seed.status, body: structuredClone(seed.response), headers: seed.headers }, row), () => ({ result: { source: 'engine' } }));
}
export const handlers: Record<string, Handler> = {
  'POST /v1/valuations': fromEngine(async (ctx, req) => {
    if (ctx.body.item_id === undefined) return legacy(ctx, req);
    pagination(ctx);
    ctx.log.input('api', 'POST /v1/valuations', { fields: Object.keys(ctx.body), query_fields: [...ctx.query.keys()] });
    validate(ctx);
    const row = store.get<Item>('item', ctx.user_id!, String(ctx.body.item_id));
    if (!row || row.deleted || row.user_id !== ctx.user_id || row.id === 'it_7c2m' && ctx.user_id !== EXAMPLE_USER) throw new ApiError('not_found', 'item not found', 'read');
    return startValuation(ctx, row);
  }),
};
export const manifest = manifestFor(handlers);
