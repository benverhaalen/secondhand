// Rests-on: spec/product.md §7 Jobs and the event stream, §8 search budget; int-search-1 brief.
import { ApiError, type Ctx, type Handler } from './http.ts';
import { manifestFor, fromEngine, fields, text, bool, strings, money, object, url, invalid, pagination } from './captures.ts';
import { searchSource, sourceUnavailable, type SearchOpts, type SiteSearched, type SearchRow } from '../intel/public/search.ts';
import { BASE, searchUrl } from '../intel/public/readers.ts';
import { fetchPage } from '../intel/fetch.ts';
import { SOURCES, sourcesFor, routeId, type Caller, type Source, type SourceSite } from '../intel/public/sources.ts';
import { runPlan, normalize, searchParams } from '../intel/run.ts';
import { PROTOCOLS } from '../intel/protocols.ts';
import { emptyFound, type Answer, type Found } from '../intel/answer.ts';
import { sameProduct, type Judged, type Result } from '../intel/reconcile.ts';
import { jevAsk } from '../intel/jev.ts';
import { searchAll as rankOffers, type BuyOffer, type BuyRow } from '../buy/buy.ts';
import { jobs, type ApiJobRow } from './jobs.ts';

const protocol = PROTOCOLS.listings_matching;
export const ports: Pick<SearchOpts, 'accounts' | 'harness' | 'dupe' | 'apify'> & { fetchPage: typeof fetchPage; ask: typeof jevAsk; deadline_ms: number; sources: readonly Source[]; routed: NonNullable<SearchOpts['routed']> } = {
  fetchPage, ask: jevAsk, deadline_ms: protocol.budget.settled_ms, sources: SOURCES, accounts: undefined, harness: undefined, apify: undefined, routed: () => !!ports.harness,
};
// The shared job store owns the promises as well as their rows; nothing is detached without a rejection handler.
export const searchJobs = Object.assign(jobs, { pendingSearches: new Map<string, Promise<void>>() });
type ActiveRead = { rows?: JudgedRow[]; searched?: SiteSearched };
const reading = new Map<string, ActiveRead>();

type SearchAnswer = Omit<Answer, 'searched'> & { searched: (Omit<Answer['searched'][number], 'outcome'> & Pick<SiteSearched, 'outcome' | 'error_code' | 'reason' | 'pace' | 'dropped' | 'fallback' | 'cost_usd_est'>)[] };
type SearchStage = { name: string; state: 'running' | 'arrived' | 'late' | 'failed'; started_at: string; ended_at: string | null; found: Found; error?: { code: string; message: string } };
type JudgedRow = { row: SearchRow; judged: Judged };
type PublicOffer = BuyOffer & Pick<SearchRow, 'via' | 'actor' | 'may_model' | 'use_scope'> & { converted?: boolean; host?: string; match: Judged['match']; currency?: string; image_url?: string; external_id: string; data: `live:${SourceSite}`; commercial_link?: true; attribution?: 'Dupe.com'; source_site?: string; secondhand?: boolean; keep_until?: string };
type Batch = { searched: SiteSearched; rows: JudgedRow[]; offers: PublicOffer[]; ranked: BuyRow[]; found: Found; cached?: boolean };

const matchOrder: Record<Judged['match'], number> = { exact: 0, likely_same_model: 1, same_family_other_variant: 2, comparable: 3, unresolved: 4 };

const planOutcome = (outcome: SiteSearched['outcome']): Answer['searched'][number]['outcome'] =>
  outcome === 'unknown' || outcome === 'page_changed' || outcome === 'failed' || outcome === 'needs_account' ? 'blocked' : outcome;

const inDollars = (offer: PublicOffer) => offer.currency === 'USD' && !offer.converted;
function rankedOffers(offers: PublicOffer[]): BuyRow[] {
  const matches = new Map(offers.map(o => [o.id, o.match]));
  const dollars = rankOffers(offers.filter(inDollars), { medianShipping: 0 }).sort((a, b) =>
    matchOrder[matches.get(a.id)!] - matchOrder[matches.get(b.id)!] || a.delivered_cents - b.delivered_cents);
  const seen = new Set<string>();
  const regional = offers.filter(o => !inDollars(o) && !o.sold && o.stock !== 'out_of_stock').filter(o => {
    const key = `${o.site}:${o.listing_id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(o => { const { referral: _referral, ...row } = o; return { ...row, delivered_cents: o.price_cents, shipping_estimated: true, also_on: [] }; });
  return [...dollars, ...regional];
}

function identity(rows: JudgedRow[]): { by: 'model' | 'codes' | 'default'; model_ok: boolean } {
  if (!rows.length || rows.some(r => r.judged.by === 'default')) return { by: 'default', model_ok: false };
  const model_ok = rows.some(r => r.judged.by === 'jev');
  return { by: model_ok ? 'model' : 'codes', model_ok };
}

function candidates(source: Source, rows: SearchRow[], route_id = routeId(source)): Result[] {
  const site = source.site;
  // readPage's required-field gate has already validated these fields.
  return rows.map(row => ({ id: `ls_${site}_${row.id}`, listing_id: `ls_${site}_${row.id}`, site,
    title: row.title!, price_cents: row.price_cents!, url: row.url!, route_id }));
}

function rank(source: Source, rows: JudgedRow[], searched: SiteSearched, filters: Record<string, unknown>): Batch {
  const site = source.site;
  const found: Found = { ...emptyFound(), sources_searched: 1, results_found: rows.length, sites: { [site]: 0 } };
  const drop = (reason: string) => { found.dropped_by_reason[reason] = (found.dropped_by_reason[reason] ?? 0) + 1; };
  if (searched.dropped) found.dropped_by_reason.unreadable_card = searched.dropped;
  const offers: PublicOffer[] = [];
  for (const { row, judged } of rows) {
    if (judged.keep !== 'keep') { drop(judged.keep); continue; }
    const offer: PublicOffer = { ...candidates(source, [row], searched.route_id)[0], external_id: row.id!, currency: row.currency, ...(row.host ? { host: row.host } : {}), ...(row.converted ? { converted: true } : {}), data: `live:${site}`,
      ...(row.via ? { via: row.via, actor: row.actor, may_model: row.may_model, use_scope: row.use_scope } : {}),
      ...('commercial_link' in row ? { commercial_link: row.commercial_link, attribution: row.attribution, source_site: row.source_site, secondhand: row.secondhand, keep_until: row.keep_until } : {}),
      ...(row.image_url ? { image_url: row.image_url } : {}), condition: row.condition ?? 'unknown',
      match: judged.match, relation: judged.match === 'comparable' ? 'functional_equivalent' : 'same_product',
      shipping_cents: null, tax_rate: 0, source_kind: 'marketplace', sold: row.sold };
    if (Array.isArray(filters.condition) && !filters.condition.includes(offer.condition)) { drop('condition'); continue; }
    if (Array.isArray(filters.seller_kind) && !filters.seller_kind.includes(offer.seller_kind)) { drop('seller_kind'); continue; }
    if (text(filters.ships_from) && offer.ships_from !== filters.ships_from) { drop('ships_from'); continue; }
    if (text(filters.ships_to) && !offer.ships_to?.includes(filters.ships_to)) { drop('ships_to'); continue; }
    if (filters.in_stock_only === true && offer.stock !== 'in_stock') { drop('in_stock_only'); continue; }
    if (inDollars(offer) && object(filters.max_delivered_cents) && row.currency !== filters.max_delivered_cents.currency) { drop('currency'); continue; }
    offers.push(offer);
  }
  const live = rankedOffers(offers);
  if (offers.length > live.length) found.dropped_by_reason.unavailable_or_duplicate = offers.length - live.length;
  const ranked = live.filter(r => {
    if (inDollars(r as BuyRow & PublicOffer) && object(filters.max_delivered_cents) && r.delivered_cents > Number(filters.max_delivered_cents.amount_cents)) { drop('max_delivered_cents'); return false; }
    return true;
  });
  found.results_used = ranked.length; found.sites[site] = ranked.length;
  const kept = new Set(ranked.map(r => r.id));
  return { searched, rows, offers: offers.filter(o => kept.has(o.id)), ranked, found };
}

function offerView(row: BuyRow) {
  const offer = row as BuyRow & PublicOffer;
  const amount = (n: number) => offer.currency ? { amount_cents: n, currency: offer.currency } : null;
  return { id: offer.id, listing_id: offer.listing_id, external_id: offer.external_id, title: offer.title, url: offer.url,
    site: offer.site, route_id: offer.route_id, data: offer.data, condition: offer.condition, relation: offer.match,
    source_kind: offer.source_kind, price_cents: amount(offer.price_cents), shipping_cents: null,
    delivered_cents: inDollars(offer) ? amount(offer.delivered_cents) : null,
    ...(offer.host ? { host: offer.host } : {}), ...(offer.converted ? { converted: true } : {}), shipping_estimated: offer.shipping_estimated, also_on: offer.also_on,
    ...(offer.image_url ? { image_url: offer.image_url } : {}),
    ...(offer.via ? { via: offer.via, actor: offer.actor, may_model: offer.may_model, use_scope: offer.use_scope } : {}),
    ...(offer.commercial_link ? { commercial_link: offer.commercial_link, attribution: offer.attribution, source_site: offer.source_site, secondhand: offer.secondhand, keep_until: offer.keep_until } : {}) };
}

async function search(ctx: Ctx, job: ApiJobRow, stages: SearchStage[], opts: typeof ports, caller: Caller, sources: readonly Source[]) {
  const query = String(ctx.body.text ?? ctx.body.url ?? ''), filters = object(ctx.body.filters) ? ctx.body.filters : {};
  const t0 = performance.now(), pending = new Set(sources.map(s => s.id)), batches = new Map<string, Batch>();
  let first: number | null = null;
  const spent = new Map<string, number>();
  const saveStages = () => jobs.update(job.id, {
    // The brief adds `late` and found{}; the shared Stage type still names the older four states.
    stages: structuredClone(stages) as ApiJobRow['stages'],
  });
  const result = () => {
    const found = emptyFound();
    for (const batch of batches.values()) {
      for (const key of ['sources_searched', 'results_found', 'results_used'] as const) found[key] += batch.found[key];
      for (const [site, count] of Object.entries(batch.found.sites)) found.sites[site] = (found.sites[site] ?? 0) + count;
      for (const [reason, count] of Object.entries(batch.found.dropped_by_reason)) found.dropped_by_reason[reason] = (found.dropped_by_reason[reason] ?? 0) + count;
    }
    const ranked = rankedOffers([...batches.values()].flatMap(b => b.offers));
    const duplicates = found.results_used - ranked.length;
    if (duplicates) found.dropped_by_reason.unavailable_or_duplicate = (found.dropped_by_reason.unavailable_or_duplicate ?? 0) + duplicates;
    found.results_used = ranked.length;
    for (const site of Object.keys(found.sites)) found.sites[site] = 0;
    for (const row of ranked) found.sites[row.site] = (found.sites[row.site] ?? 0) + 1;
    return { product: null, results: ranked.map(offerView), identity: identity([...batches.values()].flatMap(b => b.rows)), official: [], sites_pending: [...pending], found,
      searched: [...batches.values()].map(b => ({ ...b.searched, ...(b.cached ? { cached: true } : {}) })) };
  };
  const answer = (settled: boolean): SearchAnswer => ({ id: job.id, kind: 'listings_matching', slots: { text: query },
    protocol_version: protocol.version, facts: [], found: result().found,
    searched: [...batches.entries()].map(([id, b]) => ({ route_id: b.searched.route_id ?? routeId(sources.find(s => s.id === id)!), query,
      outcome: b.searched.outcome, ms: b.searched.ms, ...(b.searched.pace ? { pace: b.searched.pace } : {}), ...(b.searched.dropped ? { dropped: b.searched.dropped } : {}), ...(b.searched.error_code ? { error_code: b.searched.error_code } : {}), ...(b.searched.reason ? { reason: b.searched.reason } : {}), ...(b.searched.fallback ? { fallback: b.searched.fallback } : {}), ...(b.searched.cost_usd_est !== undefined ? { cost_usd_est: b.searched.cost_usd_est } : {}) })),
    stage: settled ? 'settled' : 'first', ms: { first, settled: settled ? Math.round(performance.now() - t0) : null } });
  const emit = (event: 'answer.partial' | 'answer.settled', data: Record<string, unknown>) => {
    const a = answer(event === 'answer.settled');
    ctx.log.event(event, { job: job.id, answer: a });
    jobs.append(job.id, event, { job_id: job.id, ...data, answer: a });
  };
  const land = (source: Source, batch: Batch, refreshing: boolean) => {
    const site = source.site;
    if (jobs.st.getJob(job.id)?.state !== 'running') return;
    batches.set(source.id, batch);
    if (!refreshing) pending.delete(source.id);
    const stage = stages.find(s => s.name === `site:${source.id}`)!;
    stage.state = batch.searched.outcome === 'timeout' ? 'late' : batch.searched.error_code && batch.searched.outcome !== 'empty' ? 'failed' : 'arrived';
    if (stage.state === 'failed') stage.error = { code: batch.searched.error_code!, message: batch.searched.reason ?? 'source failed' };
    stage.ended_at = new Date().toISOString(); stage.found = batch.found;
    if (batch.rows.length) first ??= Math.round(performance.now() - t0);
    saveStages(); jobs.update(job.id, { result: result() });
    // events.json still has the old stage enum; state.change records the brief's late state without falsifying it.
    if (stage.state === 'late') ctx.log.event('state.change', { entity: 'job.stage', id: `${job.id}:${stage.name}`, to: 'late', job: job.id, stage: stage.name, found: stage.found });
    else ctx.log.stage(job.id, stage.name, { state: stage.state, found: stage.found, ...(stage.error ? { error: stage.error } : {}) });
    jobs.append(job.id, 'job.stage', { job_id: job.id, stage: stage.name, state: stage.state, at: stage.ended_at, found: stage.found, ...(stage.error ? { error: stage.error } : {}) });
    emit('answer.partial', { site, product: null, results: batch.ranked.map(offerView), identity: identity(batch.rows), official: [], sites_pending: [...pending] });
  };
  const sitePlan = async (source: Source, freshness_s: number) => {
    const site = source.site;
    const readOptions: SearchOpts = { paced: true, caller, person_id: ctx.user_id ?? undefined, visitor_id: ctx.visitor_id ?? undefined,
      accounts: opts.accounts, harness: opts.harness, routed: opts.routed, apify: opts.apify, dupe: opts.dupe, fetchPage: opts.fetchPage, log: ctx.log };
    const unavailable = await sourceUnavailable(source, 'search', readOptions);
    const fallback = unavailable?.searched.error_code === 'no_route' && site === 'ebay' && caller === 'person' && opts.apify;
    if (unavailable && !fallback) return { batch: rank(source, [], unavailable.searched, filters), cached: false, live: undefined };
    const scopedRoute = source.lane === 'harness' || source.lane === 'apify' ? `${routeId(source)}:${ctx.user_id ?? ctx.visitor_id}` : routeId(source);
    const key = `${scopedRoute}|${normalize(query)}`;
    let shared = reading.get(key), ran = false, rows: JudgedRow[] = [];
    // One allowance per search, charged against the same clock on the cached and live reads. The harness owns and reuses its browser.
    const startup = source.site === 'depop' && opts.harness ? searchParams.read('search_browser_start_ms', {}).value as number : 0;
    const remaining = Math.max(0, opts.deadline_ms + startup - (spent.get(source.id) ?? 0));
    // A one-target plan lets empty and blocked sites settle independently too; runPlan only emits partials for hits.
    const a = await runPlan({ kind: 'listings_matching', slots: { text: query }, protocol_version: protocol.version,
      first_ms: protocol.budget.first_ms, settled_ms: remaining,
      targets: [{ target_id: `site:${source.id}`, query, deadline_ms: remaining, freshness_s, routes: [{
        route_id: scopedRoute, site, lane: source.lane, pace: unavailable || source.lane === 'apify' ? undefined : source.pace, cache: source.lane !== 'mcp' && source.lane !== 'apify' && !(site === 'ebay' && opts.apify), host: site === 'dupe' ? 'mcp.dupe.com' : new URL(BASE[site]).host, p95_ms: protocol.budget.first_ms,
        async run(q, { signal, readEnded }) {
          const readAt = performance.now();
          ran = true; shared = {}; reading.set(key, shared);
          try {
            const page = await searchSource(source, q, 'search', { ...readOptions, signal, deadline_ms: remaining }).finally(readEnded);
            shared.searched = page.searched;
            const judged = await sameProduct({ title: q }, candidates(source, page.rows), (s, questions) => opts.ask(s, questions, { log: ctx.log }));
            shared.rows = page.rows.map((row, i) => ({ row, judged: judged[i] }));
            return { outcome: planOutcome(page.searched.outcome), rows: shared.rows, site, detail: page.searched };
          } catch (e) {
            ctx.log.error(`search.${source.id}`, e);
            const detail: SiteSearched = { site, kind: 'search', url: null, outcome: 'failed', count: 0,
              ms: Math.round(performance.now() - readAt), error_code: object(e) && text(e.code) ? e.code : 'site_failed',
              reason: e instanceof Error ? e.message : 'source failed', ...(source.pace ? { pace: source.pace } : {}) };
            return { outcome: 'blocked', rows: [], site, detail };
          }
          finally { spent.set(source.id, (spent.get(source.id) ?? 0) + performance.now() - readAt); reading.delete(key); }
        },
      }] }],
      calculate(arrivals) { rows = arrivals.flatMap(a => a.rows as JudgedRow[]); return { facts: [] }; },
    });
    const sameRead = shared?.rows && rows.length === shared.rows.length && rows.every((r, i) => r === shared!.rows![i]);
    const searched = sameRead ? shared!.searched : a.searched[0]?.detail as SiteSearched | undefined;
    const outcome = a.searched[0]?.outcome ?? 'timeout';
    const observed: SiteSearched = searched && outcome !== 'timeout' ? searched : {
      site, kind: 'search', url: source.lane === 'public_page' && site !== 'dupe' ? searchUrl(site, query, 'search') : null, outcome: outcome === 'over_budget' ? 'timeout' : outcome,
      count: rows.length, ms: a.searched[0]?.ms ?? Math.round(remaining), ...(source.pace ? { pace: source.pace } : {}),
    };
    const cached = !ran && !sameRead && (outcome === 'hit' || outcome === 'empty');
    return { batch: rank(source, rows, observed, filters), cached,
      live: cached && shared?.rows && shared.searched ? rank(source, shared.rows, shared.searched, filters) : undefined };
  };
  try {
    await Promise.all(sources.map(async source => {
      const initial = await sitePlan(source, protocol.freshness.listings);
      land(source, initial.batch, initial.cached);
      if (initial.cached && jobs.st.getJob(job.id)?.state === 'running') {
        const live = initial.live ?? (await sitePlan(source, 0)).batch;
        const batch = ['hit', 'empty'].includes(live.searched.outcome) ? live : { ...initial.batch, searched: live.searched, cached: true };
        land(source, batch, false);
      }
    }));
    if (jobs.st.getJob(job.id)?.state !== 'running') return;
    const final = result(); jobs.update(job.id, { result: final });
    emit('answer.settled', final);
    // finish() would overwrite late stages as arrived; retain each site's actual ending.
    ctx.log.job(job.id, 'search', 'done');
    jobs.append(job.id, 'job.state', { job_id: job.id, kind: 'search', state: 'done', at: new Date().toISOString(), result: final });
  } catch (e) {
    ctx.log.error('search', e);
    const error = e instanceof ApiError ? e.toJSON() : new ApiError('site_failed', 'search failed', 'search', { by: 'user' }).toJSON();
    for (const stage of stages) if (stage.state === 'running') { stage.state = 'failed'; stage.ended_at = new Date().toISOString(); }
    saveStages(); jobs.update(job.id, { error });
    ctx.log.job(job.id, 'search', 'failed', { error });
    jobs.append(job.id, 'job.state', { job_id: job.id, kind: 'search', state: 'failed', at: new Date().toISOString(), error });
  } finally { jobs.prune(Date.now()); }
}

export const handlers: Record<string, Handler> = {
  'POST /v1/search': fromEngine(ctx => {
    pagination(ctx);
    ctx.log.input('api', 'POST /v1/search', { fields: Object.keys(ctx.body), query_fields: [...ctx.query.keys()] });
    fields(ctx.body, {}, { text, photo_id: text, url, filters: object, like: text, assist_job_id: text, answers: v => Array.isArray(v) && v.every(a => object(a) && text(a.span_id) && text(a.option_id) && text(a.signature)) });
    if (!['text', 'photo_id', 'url', 'like', 'assist_job_id'].some(k => ctx.body[k] !== undefined)) throw invalid('a search input is required');
    if (object(ctx.body.filters)) fields(ctx.body.filters, {}, { condition: strings, seller_kind: strings, ships_to: text, ships_from: text, max_delivered_cents: money, in_stock_only: bool });
    // jobsOn exposes this fixture owner to every visitor; it cannot own a real search.
    if (ctx.visitor_id === 'vis_example01') throw invalid('use a new visitor session');
    const started_at = new Date().toISOString();
    const caller: Caller = 'person', sources = sourcesFor(caller, ports.sources);
    const stages: SearchStage[] = sources.map(source => ({ name: `site:${source.id}`, state: 'running', started_at, ended_at: null, found: emptyFound() }));
    const job = jobs.put({ kind: 'search', state: 'running', stages: structuredClone(stages) as ApiJobRow['stages'] }, ctx.user_id ?? ctx.visitor_id!);
    ctx.log.job(job.id, 'search', 'running');
    jobs.append(job.id, 'job.state', { job_id: job.id, kind: 'search', state: 'running', at: started_at });
    const opts = { ...ports };
    const task = Promise.resolve().then(() => search(ctx, job, stages, opts, caller, sources)).catch(e => { ctx.log.error('search.background', e); }).finally(() => searchJobs.pendingSearches.delete(job.id));
    searchJobs.pendingSearches.set(job.id, task);
    return { status: 202, body: { id: job.id, kind: job.kind, state: 'running', stages: structuredClone(stages), stream: `/v1/jobs/${job.id}/events` } };
  }),
};
export const manifest = manifestFor(handlers);
