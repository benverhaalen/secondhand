// Rests-on: spec/product.md §7 Jobs and the event stream, §8 search budget; int-search-1 brief.
import { ApiError, type Ctx, type Handler } from './http.ts';
import { manifestFor, fromEngine, fields, text, bool, strings, money, object, url, invalid, pagination } from './captures.ts';
import { searchSource, sourceUnavailable, runtimePorts as searchRuntime, type SearchOpts, type SiteSearched, type SearchRow } from '../intel/public/search.ts';
import { BASE, searchUrl } from '../intel/public/readers.ts';
import { fetchPage } from '../intel/fetch.ts';
import { SOURCES, sourcesFor, routeId, type Caller, type Source, type SourceSite } from '../intel/public/sources.ts';
import { runPlan, searchParams } from '../intel/run.ts';
import { PROTOCOLS } from '../intel/protocols.ts';
import { emptyFound, type Answer, type Found } from '../intel/answer.ts';
import { sameProduct, type Judged, type Result } from '../intel/reconcile.ts';
import { jevAsk } from '../intel/jev.ts';
import { searchAll as rankOffers, type BuyOffer, type BuyRow } from '../buy/buy.ts';
import { jobs, type ApiJobRow } from './jobs.ts';

const protocol = PROTOCOLS.listings_matching;
// The Apify adapter keeps DEADLINE_MS private; search.test.ts checks this clock against that source.
const APIFY_READ_DEADLINE_MS = 75_000;
export const ports = Object.assign(searchRuntime, {
  fetchPage, ask: jevAsk, deadline_ms: protocol.budget.settled_ms, sources: SOURCES as readonly Source[],
});
// The shared job store owns the promises as well as their rows; nothing is detached without a rejection handler.
export const searchJobs = Object.assign(jobs, { pendingSearches: new Map<string, Promise<void>>() });

// Exported for the app's search screen (app/src/api), which imports these instead of copying them.
export type SearchAnswer = Omit<Answer, 'searched'> & { searched: (Pick<Source, 'group'> & Omit<Answer['searched'][number], 'outcome'> & Pick<SiteSearched, 'site' | 'outcome' | 'error_code' | 'reason' | 'pace' | 'dropped' | 'fallback' | 'cost_usd_est'>)[] };
export type SearchStage = { group: Source['group']; name: string; state: 'running' | 'arrived' | 'late' | 'failed'; started_at: string; ended_at: string | null; found: Found; error?: { code: string; message: string } };
type JudgedRow = { row: SearchRow; judged: Judged };
type PublicOffer = BuyOffer & Pick<SearchRow, 'via' | 'actor' | 'may_model' | 'use_scope'> & { converted?: boolean; host?: string; match: Judged['match']; currency?: string; image_url?: string; external_id: string; data: `live:${SourceSite}`; commercial_link?: true; attribution?: 'Dupe.com'; source_site?: string; secondhand?: boolean; keep_until?: string; may_store: boolean };
type Batch = { searched: SiteSearched; rows: JudgedRow[]; offers: PublicOffer[]; ranked: BuyRow[]; found: Found; cached?: boolean };

const matchOrder: Record<Judged['match'], number> = { exact: 0, likely_same_model: 1, same_family_other_variant: 2, comparable: 3, unresolved: 4 };

const planOutcome = (outcome: SiteSearched['outcome']): Answer['searched'][number]['outcome'] =>
  outcome === 'unknown' || outcome === 'page_changed' || outcome === 'failed' || outcome === 'needs_account' ? 'blocked' : outcome;

const inDollars = (offer: PublicOffer) => offer.currency === 'USD' && !offer.converted;
function listingKey(offer: Pick<PublicOffer, 'url' | 'site' | 'source_site'>): string {
  const url = new URL(offer.url);
  url.search = ''; url.hash = ''; url.pathname = url.pathname.replace(/\/+$/, '');
  return `${(offer.source_site ?? offer.site).toLowerCase()}:${url.host.toLowerCase()}${url.pathname}`;
}

function rankedOffers(offers: PublicOffer[]): BuyRow[] {
  const byListing = new Map<string, PublicOffer>();
  for (const offer of offers) {
    const key = listingKey(offer), prior = byListing.get(key);
    if (!prior || offer.currency === prior.currency && offer.price_cents < prior.price_cents) byListing.set(key, offer);
  }
  const unique = [...byListing.values()];
  const matches = new Map(unique.map(o => [o.id, o.match]));
  const dollars = rankOffers(unique.filter(inDollars), { medianShipping: 0 }).sort((a, b) =>
    matchOrder[matches.get(a.id)!] - matchOrder[matches.get(b.id)!] || a.delivered_cents - b.delivered_cents);
  const regional = unique.filter(o => !inDollars(o)).sort((a, b) =>
    matchOrder[a.match] - matchOrder[b.match] || a.price_cents - b.price_cents
  ).map(o => { const { referral: _referral, ...row } = o; return { ...row, delivered_cents: o.price_cents, shipping_estimated: true, also_on: [] }; });
  return [...dollars, ...regional];
}

export function checkSearchCounts(found: Found): string[] {
  const dropped = Object.values(found.dropped_by_reason);
  const problems: string[] = [];
  if ([found.results_found, found.results_used, ...dropped].some(n => !Number.isInteger(n) || n < 0)) problems.push('counts must be nonnegative integers');
  if (found.results_found !== found.results_used + dropped.reduce((sum, count) => sum + count, 0))
    problems.push('results_found does not equal results_used plus drops');
  return problems;
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

const shownOnly = (source: Source, row: SearchRow): JudgedRow => ({ row, judged: {
  id: candidates(source, [row])[0].id, match: 'unresolved', keep: 'keep', in_basis: false, by: 'default',
} });

function rank(source: Source, rows: JudgedRow[], searched: SiteSearched, filters: Record<string, unknown>): Batch {
  const site = source.site;
  const failed = !rows.length && searched.outcome === 'failed' && searched.error_code === 'site_failed' ? searched.count : 0;
  const found: Found = { ...emptyFound(), sources_searched: 1, results_found: rows.length + failed + (searched.dropped ?? 0), sites: { [site]: 0 } };
  if (failed) found.dropped_by_reason.site_failed = failed;
  const drop = (reason: string) => { found.dropped_by_reason[reason] = (found.dropped_by_reason[reason] ?? 0) + 1; };
  if (searched.dropped) found.dropped_by_reason.unreadable_card = searched.dropped;
  const offers: PublicOffer[] = [];
  for (const { row, judged } of rows) {
    if (judged.keep !== 'keep') { drop(judged.keep); continue; }
    const offer: PublicOffer = { ...candidates(source, [row], searched.route_id)[0], external_id: row.id!, currency: row.currency, ...(row.host ? { host: row.host } : {}), ...(row.converted ? { converted: true } : {}), data: `live:${site}`, may_store: row.may_store === true, ...(row.keep_until ? { keep_until: row.keep_until } : {}),
      ...(row.via ? { via: row.via, actor: row.actor, may_model: row.may_model, use_scope: row.use_scope } : {}),
      ...('commercial_link' in row ? { commercial_link: row.commercial_link, attribution: row.attribution, source_site: row.source_site, secondhand: row.secondhand } : {}),
      ...(row.image_url ? { image_url: row.image_url } : {}), condition: row.condition ?? 'unknown',
      match: judged.match, relation: judged.match === 'comparable' ? 'functional_equivalent' : 'same_product',
      shipping_cents: null, tax_rate: 0, source_kind: 'marketplace', sold: row.sold, stock: row.stock };
    if (offer.sold) { drop('sold'); continue; }
    if (offer.stock === 'out_of_stock') { drop('out_of_stock'); continue; }
    if (Array.isArray(filters.condition) && !filters.condition.includes(offer.condition)) { drop('condition'); continue; }
    if (Array.isArray(filters.seller_kind) && !filters.seller_kind.includes(offer.seller_kind)) { drop('seller_kind'); continue; }
    if (text(filters.ships_from) && offer.ships_from !== filters.ships_from) { drop('ships_from'); continue; }
    if (text(filters.ships_to) && !offer.ships_to?.includes(filters.ships_to)) { drop('ships_to'); continue; }
    if (filters.in_stock_only === true && offer.stock !== 'in_stock') { drop('in_stock_only'); continue; }
    if (object(filters.max_delivered_cents) && row.currency !== filters.max_delivered_cents.currency) { drop('currency'); continue; }
    offers.push(offer);
  }
  const live = rankedOffers(offers);
  if (offers.length > live.length) found.dropped_by_reason.duplicate = (found.dropped_by_reason.duplicate ?? 0) + offers.length - live.length;
  const ranked = live.filter(r => {
    if (object(filters.max_delivered_cents) && r.delivered_cents > Number(filters.max_delivered_cents.amount_cents)) { drop('max_delivered_cents'); return false; }
    return true;
  });
  found.results_used = ranked.length; found.sites[site] = ranked.length;
  const kept = new Set(ranked.map(r => r.id));
  return { searched, rows, offers: offers.filter(o => kept.has(o.id)), ranked, found };
}

export type OfferView = ReturnType<typeof offerView>;
function offerView(row: BuyRow) {
  const offer = row as BuyRow & PublicOffer;
  const amount = (n: number) => offer.currency ? { amount_cents: n, currency: offer.currency } : null;
  return { id: offer.id, listing_id: offer.listing_id, external_id: offer.external_id, title: offer.title, url: offer.url,
    site: offer.site, route_id: offer.route_id, data: offer.data, condition: offer.condition, relation: offer.match,
    source_kind: offer.source_kind, may_store: offer.may_store, ...(offer.keep_until ? { keep_until: offer.keep_until } : {}), price_cents: amount(offer.price_cents), shipping_cents: null,
    delivered_cents: inDollars(offer) ? amount(offer.delivered_cents) : null,
    ...(offer.host ? { host: offer.host } : {}), ...(offer.converted ? { converted: true } : {}), shipping_estimated: offer.shipping_estimated, also_on: offer.also_on,
    ...(offer.image_url ? { image_url: offer.image_url } : {}),
    ...(offer.via ? { via: offer.via, actor: offer.actor, may_model: offer.may_model, use_scope: offer.use_scope } : {}),
    ...(offer.commercial_link ? { commercial_link: offer.commercial_link, attribution: offer.attribution, source_site: offer.source_site, secondhand: offer.secondhand } : {}) };
}

async function search(ctx: Ctx, job: ApiJobRow, stages: SearchStage[], opts: typeof ports, caller: Caller, sources: readonly Source[]) {
  const query = String(ctx.body.text || ctx.body.url), filters = object(ctx.body.filters) ? ctx.body.filters : {};
  const t0 = performance.now(), pending = new Set(sources.map(s => s.id)), batches = new Map<string, Batch>();
  let first: number | null = null, settledAt: number | null = null, settled = false;
  const sourceCounts = new Map<string, { count: number; dropped?: number }>();
  const controllers = new Map<string, AbortController>();
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
    if (duplicates) found.dropped_by_reason.duplicate = (found.dropped_by_reason.duplicate ?? 0) + duplicates;
    found.results_used = ranked.length;
    for (const site of Object.keys(found.sites)) found.sites[site] = 0;
    for (const row of ranked) found.sites[row.site] = (found.sites[row.site] ?? 0) + 1;
    return { product: null, results: ranked.map(offerView), identity: identity([...batches.values()].flatMap(b => b.rows)), official: [], sites_pending: [...pending], found,
      searched: [...batches.values()].map(b => ({ ...b.searched, ...(b.cached ? { cached: true } : {}) })) };
  };
  const answer = (settled: boolean): SearchAnswer => ({ id: job.id, kind: 'listings_matching', slots: { text: query },
    protocol_version: protocol.version, facts: [], found: result().found,
    searched: [...batches.entries()].map(([id, b]) => ({ site: b.searched.site, group: b.searched.group, route_id: b.searched.route_id ?? routeId(sources.find(s => s.id === id)!), query,
      outcome: b.searched.outcome, ms: b.searched.ms, ...(b.searched.pace ? { pace: b.searched.pace } : {}), ...(b.searched.dropped ? { dropped: b.searched.dropped } : {}), ...(b.searched.error_code ? { error_code: b.searched.error_code } : {}), ...(b.searched.reason ? { reason: b.searched.reason } : {}), ...(b.searched.fallback ? { fallback: b.searched.fallback } : {}), ...(b.searched.cost_usd_est !== undefined ? { cost_usd_est: b.searched.cost_usd_est } : {}) })),
    stage: settled ? 'settled' : 'first', ms: { first, settled: settled ? settledAt : null } });
  const auditCounts = (source: string, found: Found) => {
    const problems = checkSearchCounts(found);
    if (problems.length) ctx.log.error('search.counts', new Error(problems.join('; ')), { job: job.id, source });
  };
  const emit = (event: 'answer.partial' | 'answer.settled' | 'answer.late', data: Record<string, unknown>) => {
    const a = { ...answer(event !== 'answer.partial'), ...(event === 'answer.late' ? { stage: 'late' as const } : {}) };
    for (const [source, found] of [['answer', a.found], ...[...batches].map(([id, batch]) => [id, batch.found] as const)] as const) {
      auditCounts(source, found);
    }
    ctx.log.event(event, { job: job.id, answer: a });
    jobs.append(job.id, event, { job_id: job.id, ...data, answer: a });
  };
  const land = (source: Source, batch: Batch, late = false) => {
    const site = source.site;
    const state = jobs.st.getJob(job.id)?.state;
    if (state !== 'running' && !(late && settled && state === 'done')) {
      ctx.log.note('search arrival discarded', { job: job.id, source: source.id, state });
      return;
    }
    batches.set(source.id, batch);
    const direct = new Set([...batches.values()].filter(b => b.searched.site !== 'dupe').flatMap(b =>
      b.rows.map(({ row }) => listingKey({ site: b.searched.site, url: row.url! }))));
    const dupe = batches.get('dupe');
    if (dupe) {
      const added = dupe.offers.filter(offer => !direct.has(listingKey(offer)));
      const copies = dupe.offers.length - added.length;
      if (copies) {
        const dropped = new Set(dupe.offers.filter(offer => direct.has(listingKey(offer))).map(offer => offer.id));
        dupe.rows = dupe.rows.filter(({ judged }) => !dropped.has(judged.id));
        dupe.offers = added;
        const kept = new Set(added.map(offer => offer.id));
        dupe.ranked = dupe.ranked.filter(offer => kept.has(offer.id));
        dupe.found.results_used -= copies;
        dupe.found.sites.dupe -= copies;
        dupe.found.dropped_by_reason.read_directly = (dupe.found.dropped_by_reason.read_directly ?? 0) + copies;
      }
    }
    pending.delete(source.id);
    const stage = stages.find(s => s.name === `site:${source.id}`)!;
    stage.state = batch.searched.outcome === 'timeout' ? 'late' : batch.searched.error_code && batch.searched.outcome !== 'empty' ? 'failed' : 'arrived';
    if (stage.state === 'failed') stage.error = { code: batch.searched.error_code!, message: batch.searched.reason ?? 'source failed' };
    stage.ended_at = new Date().toISOString(); stage.found = batch.found;
    first ??= Math.round(performance.now() - t0);
    saveStages(); if (!late) jobs.update(job.id, { result: result() });
    // events.json still has the old stage enum; state.change records the brief's late state without falsifying it.
    if (stage.state === 'late') ctx.log.event('state.change', { entity: 'job.stage', id: `${job.id}:${stage.name}`, to: 'late', job: job.id, stage: stage.name, group: source.group, found: stage.found });
    else ctx.log.stage(job.id, stage.name, { group: source.group, state: stage.state, found: stage.found, ...(stage.error ? { error: stage.error } : {}) });
    jobs.append(job.id, 'job.stage', { job_id: job.id, stage: stage.name, group: source.group, state: stage.state, at: stage.ended_at, found: stage.found, ...(stage.error ? { error: stage.error } : {}) });
    emit(late ? 'answer.late' : 'answer.partial', { site, product: null, results: batch.ranked.map(offerView), identity: identity(batch.rows), official: [], sites_pending: [...pending] });
  };
  const timeout = (source: Source): Batch => ({ searched: { site: source.site, group: source.group, kind: 'search', url: null, outcome: 'timeout', count: 0,
    ms: Math.round(performance.now() - t0), pace: source.pace }, rows: [], offers: [], ranked: [], found: { ...emptyFound(), sources_searched: 1 } });
  const sitePlan = async (source: Source, freshness_s: number) => {
    const site = source.site;
    const readOptions: SearchOpts = { paced: true, caller, person_id: ctx.user_id ?? undefined, visitor_id: ctx.visitor_id ?? undefined,
      accounts: opts.accounts, harness: opts.harness, routed: opts.routed, dupe: opts.dupe, fetchPage: opts.fetchPage, log: ctx.log };
    const unavailable = await sourceUnavailable(source, 'search', readOptions);
    if (unavailable) return rank(source, [], unavailable.searched, filters);
    const account = source.lane === 'harness' && ctx.user_id && opts.accounts
      ? (await opts.accounts.linked(ctx.user_id)).find(a => a.site === site && a.person_id === ctx.user_id) : undefined;
    readOptions.account = account ?? null;
    const scopedRoute = account ? `${routeId(source)}:${ctx.user_id}` : routeId(source);
    let ran = false, rows: JudgedRow[] = [];
    // One browser-start allowance per search. The harness owns and reuses its browser.
    const startup = source.site === 'depop' && opts.harness ? searchParams.read('search_browser_start_ms', {}).value as number : 0;
    const remaining = Math.max(0, opts.deadline_ms + startup - (performance.now() - t0));
    if (!pending.has(source.id) || remaining === 0) return timeout(source);
    const controller = new AbortController(); controllers.set(source.id, controller);
    // A one-target plan lets empty and blocked sites settle independently too; runPlan only emits partials for hits.
    const a = await runPlan({ kind: 'listings_matching', slots: { text: query }, protocol_version: protocol.version,
      first_ms: protocol.budget.first_ms, settled_ms: remaining, signal: controller.signal,
      targets: [{ target_id: `site:${source.id}`, query, deadline_ms: remaining, freshness_s, routes: [{
        route_id: scopedRoute, site, lane: source.lane, pace: source.pace, cache: source.lane !== 'mcp', host: site === 'dupe' ? 'mcp.dupe.com' : new URL(BASE[site]).host, p95_ms: protocol.budget.first_ms,
        async run(q, { signal, readEnded }) {
          const readAt = performance.now();
          ran = true;
          let count = 0, dropped: number | undefined;
          try {
            const page = await searchSource(source, q, 'search', { ...readOptions, signal, deadline_ms: remaining }).finally(readEnded);
            count = page.rows.length; dropped = page.searched.dropped;
            const eligible = page.rows.filter(row => row.may_model !== false);
            const judged = await sameProduct({ title: q }, candidates(source, eligible), (s, questions) => opts.ask(s, questions, { log: ctx.log }));
            let index = 0;
            const rows = page.rows.map(row => row.may_model === false ? shownOnly(source, row) : { row, judged: judged[index++] });
            if (!pending.has(source.id)) land(source, rank(source, rows, page.searched, filters), true);
            return { outcome: planOutcome(page.searched.outcome), rows, site, detail: page.searched };
          } catch (e) {
            ctx.log.error(`search.${source.id}`, e);
            const detail: SiteSearched = { site, group: source.group, kind: 'search', url: null, outcome: 'failed', count, ...(dropped ? { dropped } : {}),
              ms: Math.round(performance.now() - readAt), error_code: 'site_failed',
              reason: e instanceof Error ? e.message : 'source failed', ...(source.pace ? { pace: source.pace } : {}) };
            if (!pending.has(source.id)) land(source, rank(source, [], detail, filters), true);
            return { outcome: 'blocked', rows: [], site, detail };
          }
        },
      }] }],
      calculate(arrivals) { rows = arrivals.flatMap(a => a.rows as JudgedRow[]); return { facts: [] }; },
    });
    const searched = a.searched[0]?.detail as SiteSearched | undefined;
    const outcome = a.searched[0]?.outcome ?? 'timeout';
    const observed: SiteSearched = searched && outcome !== 'timeout' ? searched : {
      site, group: source.group, kind: 'search', url: source.lane === 'public_page' && site !== 'dupe' ? searchUrl(site, query, 'search') : null, outcome: outcome === 'over_budget' ? 'timeout' : outcome,
      count: rows.length, ms: a.searched[0]?.ms ?? Math.round(remaining), ...(source.pace ? { pace: source.pace } : {}),
    };
    sourceCounts.set(source.id, { count: observed.count, dropped: observed.dropped });
    return { ...rank(source, rows, observed, filters), cached: !ran && (outcome === 'hit' || outcome === 'empty') };
  };
  try {
    const work = Promise.all(sources.map(async source => {
      try { const batch = await sitePlan(source, protocol.freshness.listings); if (pending.has(source.id)) land(source, batch); }
      catch (e) {
        ctx.log.error(`search.${source.id}`, e);
        const searched: SiteSearched = { site: source.site, group: source.group, kind: 'search', url: null, outcome: 'failed', count: sourceCounts.get(source.id)?.count ?? 0, dropped: sourceCounts.get(source.id)?.dropped,
          ms: Math.round(performance.now() - t0), error_code: 'site_failed', reason: e instanceof Error ? e.message : 'source failed', pace: source.pace };
        land(source, rank(source, [], searched, filters));
      }
    }));
    let cut: ReturnType<typeof setTimeout> | undefined;
    const allowance = sources.some(source => source.site === 'depop' && opts.harness) ? Number(searchParams.read('search_browser_start_ms', {}).value) : 0;
    try {
      await Promise.race([work, new Promise<void>(resolve => { cut = setTimeout(() => {
        for (const source of sources) if (pending.has(source.id)) land(source, timeout(source));
        for (const controller of controllers.values()) controller.abort();
        resolve();
      }, Math.max(0, opts.deadline_ms + allowance - (performance.now() - t0))); })]);
    } finally { clearTimeout(cut); }
    if (jobs.st.getJob(job.id)?.state !== 'running') return;
    const final = result(); jobs.update(job.id, { result: final });
    settledAt = Math.round(performance.now() - t0); first ??= settledAt;
    emit('answer.settled', final);
    settled = true;
    const facebook = opts.sources.find(source => source.on && source.site === 'facebook' && source.lane === 'apify');
    const fillStarted = Promise.withResolvers<void>();
    const fillController = new AbortController();
    const apify = opts.apify;
    const fill = ctx.user_id && apify && opts.apifyRuns && facebook
      ? searchSource(facebook, query, 'search', { caller: 'person', person_id: ctx.user_id, apifyRuns: opts.apifyRuns, log: ctx.log, signal: fillController.signal,
        apify: { search(...args) {
          fillController.signal.throwIfAborted();
          const patch: Partial<ApiJobRow> & { fill_until: string } = { fill_until: new Date(Date.now() + APIFY_READ_DEADLINE_MS).toISOString() };
          jobs.update(job.id, patch);
          ctx.log.note('Facebook fill started', { job: job.id, fill_until: patch.fill_until });
          fillStarted.resolve();
          return apify.search(...args);
        } },
      }).catch(e => { ctx.log.error('search.facebook.fill', e); return null; }) : undefined;
    if (fill) {
      let admissionCut: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([fillStarted.promise, fill, new Promise<void>(resolve => { admissionCut = setTimeout(() => {
          fillController.abort();
          ctx.log.note('Facebook fill admission expired', { job: job.id });
          resolve();
        }, Math.max(0, opts.deadline_ms + allowance - (performance.now() - t0))); })]);
      } finally { clearTimeout(admissionCut); }
    }
    // finish() would overwrite late stages as arrived; retain each site's actual ending.
    ctx.log.job(job.id, 'search', 'done');
    jobs.append(job.id, 'job.state', { job_id: job.id, kind: 'search', state: 'done', at: new Date().toISOString(), result: final });
    if (fill && facebook) {
      void fill
        .then(page => {
          if (!page) return;
          if (page.searched.outcome !== 'hit' && page.searched.outcome !== 'empty') {
            ctx.log.error('search.facebook.fill', new Error(page.searched.reason ?? page.searched.outcome));
            return;
          }
          const batch = rank(facebook, page.rows.map(row => shownOnly(facebook, row)), page.searched, filters);
          const late = { job_id: job.id, site: facebook.site, results: batch.ranked.map(offerView), identity: identity(batch.rows),
            found: batch.found, searched: [page.searched], answer: { ...answer(true), stage: 'late' as const, found: batch.found,
              searched: [{ site: facebook.site, group: facebook.group, route_id: routeId(facebook), query, outcome: page.searched.outcome, ms: page.searched.ms }] } };
          auditCounts(facebook.id, batch.found);
          ctx.log.event('answer.late', { job: job.id, ...late });
          jobs.append(job.id, 'answer.late', late);
        }).catch(e => { ctx.log.error('search.facebook.fill', e); });
    }
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
    const words = typeof ctx.body.text === 'string' ? ctx.body.text.trim() : '';
    const link = typeof ctx.body.url === 'string' ? ctx.body.url.trim() : '';
    if (!words && !link) throw invalid('a search needs words or a link; turn a photo, like or assist job into words first');
    if (typeof ctx.body.text === 'string') { if (words) ctx.body.text = words; else delete ctx.body.text; }
    if (typeof ctx.body.url === 'string') { if (link) ctx.body.url = link; else delete ctx.body.url; }
    fields(ctx.body, {}, { text, photo_id: text, url, filters: object, like: text, assist_job_id: text, sources: strings, answers: v => Array.isArray(v) && v.every(a => object(a) && text(a.span_id) && text(a.option_id) && text(a.signature)) });
    if (object(ctx.body.filters)) fields(ctx.body.filters, {}, { condition: strings, seller_kind: strings, ships_to: text, ships_from: text, max_delivered_cents: money, in_stock_only: bool });
    const selection = ctx.body.sources as string[] | undefined;
    for (const id of selection ?? []) if (id !== 'osint' && !ports.sources.some(source => source.id === id))
      throw invalid(`unknown source: ${id}`);
    // jobsOn exposes this fixture owner to every visitor; it cannot own a real search.
    if (ctx.visitor_id === 'vis_example01') throw invalid('use a new visitor session');
    const started_at = new Date().toISOString();
    const caller: Caller = ctx.user_id ? 'person' : 'background';
    const selected = sourcesFor(caller, ports.sources).filter(source => !selection || selection.includes(source.id) || source.group === 'osint' && selection.includes('osint'));
    const sources = selected.filter(source => source.lane !== 'apify');
    const stages: SearchStage[] = sources.map(source => ({ name: `site:${source.id}`, group: source.group, state: 'running', started_at, ended_at: null, found: emptyFound() }));
    const job = jobs.put({ kind: 'search', state: 'running', stages: structuredClone(stages) as ApiJobRow['stages'] }, ctx.user_id ?? ctx.visitor_id!);
    ctx.log.job(job.id, 'search', 'running');
    jobs.append(job.id, 'job.state', { job_id: job.id, kind: 'search', state: 'running', at: started_at });
    const opts = { ...ports, sources: selected };
    const task = Promise.resolve().then(() => search(ctx, job, stages, opts, caller, sources)).catch(e => { ctx.log.error('search.background', e); }).finally(() => searchJobs.pendingSearches.delete(job.id));
    searchJobs.pendingSearches.set(job.id, task);
    return { status: 202, body: { id: job.id, kind: job.kind, state: 'running', stages: structuredClone(stages), stream: `/v1/jobs/${job.id}/events` } };
  }),
};
export const manifest = manifestFor(handlers);
