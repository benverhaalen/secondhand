// Signed-in background life: spec/product.md §6 and protocol-and-adapters.md §3.6.
// Baselines commit only after every supported section succeeds; partial reads never erase history.
import type { Accounts } from '../browser/auth.ts';
import { hasVerb } from '../harness/platform.ts';
import { isWrite, type Harness, type Verb } from '../harness/protocol.ts';
import { toWatchSnapshot } from '../harness/sites/depop/adapter.ts';
import { decide, type PAccept } from '../../engines/negotiation/choose.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { orderBook, ORDER_STATES, type OrderRead } from '../orders/orders.ts';
import { confirmedOrder } from '../delist/delist.ts';
import { confirm } from '../sold/sold.ts';
import { diffSweep, toEvent } from './differ.ts';
import type { Snapshot, Site } from './event.ts';
import { ingest } from './intake.ts';
import { createPipeline, type PipelineLog } from './pipeline.ts';
import type { HarnessError, HarnessLike, Leases, Params, Store } from './ports.ts';
import { createScheduler, type Account, type CadenceOf, type Tier, type SchedulePatch, type ScheduleState } from './schedule.ts';
import { memoryStore as paramStore, type Declared, type ParamStore } from '../../engines/param/param.ts';
import type { Citation } from '../../engines/proof/proof.ts';
import { markStale, markRelinked } from './stale.ts';

export interface WatchedListing {
  price_cents?: number; kind?: string; views?: number; likes?: number; offers?: Snapshot['offers'];
  listing_id: string; item_id: string; site: Site; account_id: string; external_id: string; state: string;
}
export interface WatcherDeps {
  store: Store; harness: Harness; accounts: Accounts; leases: Leases; params: Params; log: PipelineLog; now: () => number;
  listings: {
    byExternal(user_id: string, site: Site, external_id: string): WatchedListing | undefined;
    ofItem(user_id: string, item_id: string): WatchedListing[];
  };
  limits: { of(user_id: string, item_id: string, listing?: WatchedListing): { ask_cents: number; floor_cents: number; always_accept_cents: number } | undefined };
  snapshots: Map<string, Snapshot>;
  pAccept: PAccept;
  cadenceOf?: CadenceOf;
  hazard?: (listing: WatchedListing, now: number) => { listing_id: string; per_hour: number; basis: 'd10' | 'views'; citation_id: Citation['id'] };
  cadenceParams?: ParamStore;
  orders?: ReturnType<typeof orderBook>;
  // Accounts currently exposes no marketplace shop identity. Inject it without deriving it from our account id.
  readArgs?: (account: Account) => Record<string, unknown>;
}

export const WATCH_PARAMS = [
  { name: 'watch_interval_min_s', family: 'scalar', prior: 90 },
  { name: 'watch_interval_max_s', family: 'scalar', prior: 86400 },
  // Prior: 2000 sweeps ≈ $0.31/person/month; inferred $0.45/2880 ≈ $0.00016/read (product/roi.md).
  { name: 'sweeps_per_person_month', family: 'scalar', prior: 2000 },
] as const satisfies readonly Declared[];

type Row = Record<string, unknown>;
type WatcherJobArgs = Record<string, unknown> & {
  account_id?: string;
  operation_id?: string;
  user_id?: string;
  slug?: string;
  response?: 'accept' | 'decline' | 'counter';
  price_cents?: number;
  floor_cents?: number;
  ask_cents?: number;
  negotiation_ask?: boolean;
  external_id?: string;
  decision_kind?: string;
  decided_by?: 'negotiation';
};
function watcherJobArgs(value: unknown): WatcherJobArgs | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const args = value as Record<string, unknown>;
  if (args.account_id !== undefined && typeof args.account_id !== 'string'
    || args.operation_id !== undefined && typeof args.operation_id !== 'string'
    || args.user_id !== undefined && typeof args.user_id !== 'string'
    || args.slug !== undefined && typeof args.slug !== 'string'
    || args.response !== undefined && args.response !== 'accept' && args.response !== 'decline' && args.response !== 'counter'
    || args.price_cents !== undefined && typeof args.price_cents !== 'number'
    || args.floor_cents !== undefined && typeof args.floor_cents !== 'number'
    || args.ask_cents !== undefined && typeof args.ask_cents !== 'number'
    || args.negotiation_ask !== undefined && typeof args.negotiation_ask !== 'boolean'
    || args.external_id !== undefined && typeof args.external_id !== 'string'
    || args.decision_kind !== undefined && typeof args.decision_kind !== 'string'
    || args.decided_by !== undefined && args.decided_by !== 'negotiation') return undefined;
  return args as WatcherJobArgs;
}
function rows(data: unknown, section: string): Row[] {
  const value = Array.isArray(data) ? data : data && typeof data === 'object' ? (data as Row)[section] : undefined;
  if (!Array.isArray(value) || !value.every(r => r !== null && typeof r === 'object' && !Array.isArray(r)))
    throw new Error(`watcher ${section}: expected rows`);
  return value as Row[];
}
const sections = [['read_listings', 'listings'], ['read_offers', 'offers'], ['read_inbox', 'messages'], ['read_orders', 'orders']] as const;

export function createWatcher(d: WatcherDeps) {
  const { store, log, now } = d;
  const iso = () => new Date(now()).toISOString();
  let linked: Account[] = [];
  const stale = new Set<string>();
  const posted = new Map<string, number>();
  const slugs = new Map<string, string>();
  const orders = d.orders ?? orderBook(iso);
  if (!d.orders) for (const row of store.systemRows('order')) {
    const { version: _version, ...saved } = row;
    Object.assign(orders.apply(saved as unknown as OrderRead).order, saved);
  }
  const registry = d.cadenceParams ?? paramStore();
  for (const entry of WATCH_PARAMS) registry.declare(entry);
  let scheduler: ReturnType<typeof createScheduler> | undefined;

  function saveSchedule(a: Account, patch: SchedulePatch) {
    const decisions = store.tx(t => {
      const row = t.get('account', a.user_id, a.account_id) ?? { id: a.account_id, user_id: a.user_id, site: a.site };
      t.put('account', { ...row,
        ...(patch.due !== undefined && { next_check_at: new Date(patch.due).toISOString() }),
        ...(patch.paused !== undefined && { paused: patch.paused }),
      });
      if (patch.paused === 'auth_expired') markStale(t, log, a);
      const opened = patch.paused === 'blocked' ? t.raiseDecision({ user_id: a.user_id, kind: 'site_warning', subject: a.account_id,
        why: `${a.site} needs you to pass a check`, options: [{ id: 'cleared', label: 'Resume checks' }], suggested: 'cleared' }) : undefined;
      const closed = patch.paused === null && row.paused === 'blocked'
        ? t.decisions({ user_id: a.user_id, kind: 'site_warning', subject: a.account_id, state: 'open' }) : [];
      for (const decision of closed) t.updateDecision(decision.id, { state: 'answered' });
      return { opened, closed };
    });
    log.event('note', { msg: 'watcher schedule saved', account_id: a.account_id,
      ...(patch.due !== undefined && { next_check_at: new Date(patch.due).toISOString() }),
      ...(patch.paused !== undefined && { paused: patch.paused }),
    });
    if (decisions.opened && !decisions.opened.duplicate) log.event('decision.open', { decision: decisions.opened.row.id, kind: 'site_warning', tier: 'ask' });
    for (const decision of decisions.closed) log.event('decision.close', { decision: decision.id, reason: 'cleared' });
  }
  function resumeAccount(a: Account) {
    if (!linked.some(link => link.account_id === a.account_id)) linked.push(a);
    if (scheduler) scheduler.resume(a.account_id);
    else saveSchedule(a, { due: now(), paused: null });
  }
  const state: ScheduleState = {
    load() {
      const saved: ReturnType<ScheduleState['load']> = { due: {}, paused: {} };
      for (const a of linked) {
        const row = store.get('account', a.user_id, a.account_id);
        if (!row) continue;
        if (row.next_check_at !== undefined && row.next_check_at !== null) {
          if (typeof row.next_check_at !== 'string' || !Number.isFinite(Date.parse(row.next_check_at))) throw new Error(`invalid next_check_at for ${a.account_id}`);
          saved.due[a.account_id] = Date.parse(row.next_check_at);
        }
        if (row.paused === undefined || row.paused === null) continue;
        if (row.paused !== 'auth_expired' && row.paused !== 'blocked') throw new Error(`invalid paused reason for ${a.account_id}`);
        saved.paused[a.account_id] = row.paused;
        if (row.paused === 'auth_expired') stale.add(a.account_id);
      }
      return saved;
    },
    save(account_id, patch) {
      const a = linked.find(a => a.account_id === account_id);
      if (!a) throw new Error(`cannot save schedule for unlinked account ${account_id}`);
      saveSchedule(a, patch);
    },
  };
  const staleAccount = (a: Account) => {
    if (store.get('account', a.user_id, a.account_id)?.paused !== 'auth_expired') saveSchedule(a, { paused: 'auth_expired' });
    else markStale(store, log, a);
    stale.add(a.account_id);
  };

  function stateOf(a: Account): Tier {
    const s = d.snapshots.get(a.account_id);
    const live = s?.listings?.some(l => l.state === 'live');
    if (s?.offers?.some(o => o.state === 'open') || (s && awaitingReply(s)) || now() - (posted.get(a.account_id) ?? -Infinity) < 3600000) return 'hot';
    return live ? 'live' : 'quiet';
  }

  function watchParam(name: typeof WATCH_PARAMS[number]['name'], a: Account): number {
    const read = registry.read(name, name === 'sweeps_per_person_month' ? { person: a.user_id } : { site: a.site, person: a.user_id });
    if (typeof read.value !== 'number' || !Number.isFinite(read.value) || read.value <= 0) throw new RangeError(`${name} must be finite and positive`);
    return read.value;
  }
  function month() {
    const date = new Date(now()), year = date.getUTCFullYear(), m = date.getUTCMonth();
    const start = Date.UTC(year, m, 1), end = Date.UTC(year, m + 1, 1);
    return { start, end, seconds: (end - start) / 1000 };
  }
  function hazards(a: Account, snapshot = d.snapshots.get(a.account_id)) {
    return (snapshot?.listings ?? []).filter(l => l.state === 'live').flatMap(row => {
      const listing = d.listings.byExternal(a.user_id, a.site, row.external_id);
      if (!listing || listing.account_id !== a.account_id) return [];
      const result = d.hazard!({ ...listing, ...row, offers: snapshot?.offers?.filter(o => o.listing_external_id === row.external_id) }, now());
      if (result.listing_id !== listing.listing_id || !Number.isFinite(result.per_hour) || result.per_hour < 0 || result.per_hour > 1
        || !['d10', 'views'].includes(result.basis) || !result.citation_id) throw new Error('invalid listing hazard or missing citation');
      return [result];
    });
  }
  const risk = (a: Account) => Math.max(0, ...hazards(a).map(h => h.per_hour));
  const cadenceOf: CadenceOf | undefined = d.cadenceOf ?? (d.hazard ? (a, snapshot) => {
    const window = month(), budget = Math.floor(watchParam('sweeps_per_person_month', a));
    const used = store.rows('account', { user_id: a.user_id }).filter(row => row.watch_month === window.start)
      .reduce((sum, row) => sum + Number(row.watch_sweeps ?? 0), 0);
    const secondsLeft = (window.end - now()) / 1000;
    const rate = Math.min(budget / window.seconds, Math.max(0, budget - used) / secondsLeft);
    const accounts = linked.filter(other => other.user_id === a.user_id && !stale.has(other.account_id)
      && !store.get('account', other.user_id, other.account_id)?.paused).map(other => {
      const per_hour = other.account_id === a.account_id ? Math.max(0, ...hazards(a, snapshot).map(h => h.per_hour)) : risk(other);
      const lo = watchParam('watch_interval_min_s', other), hi = watchParam('watch_interval_max_s', other);
      if (lo > hi) throw new RangeError('watch interval minimum exceeds maximum');
      return { account_id: other.account_id, per_hour, rate: 1 / Math.max(lo, Math.min(hi, per_hour ? lo / per_hour : hi)) };
    });
    accounts.sort((a, b) => a.per_hour - b.per_hour || a.account_id.localeCompare(b.account_id));
    const highest = accounts.at(-1);
    const constrained = highest && highest.rate > rate;
    const total = accounts.reduce((sum, other) => sum + other.per_hour, 0);
    let excess = accounts.reduce((sum, other) => sum + other.rate, 0) - rate;
    for (const other of accounts) {
      if (excess <= 0) break;
      const share = constrained ? (total ? rate * other.per_hour / total : rate / accounts.length) : 0;
      const reduction = Math.min(excess, Math.max(0, other.rate - share));
      other.rate -= reduction;
      excess -= reduction;
    }
    const allocated = accounts.find(other => other.account_id === a.account_id)?.rate ?? 0;
    return allocated > 0 ? Math.min(secondsLeft, 1 / allocated) : secondsLeft;
  } : undefined);

  // Reserve before the read: a crash may spend a slot, but cannot replay it and overspend.
  function permitSweep(a: Account): boolean {
    const window = month(), budget = Math.floor(watchParam('sweeps_per_person_month', a));
    const reserved = store.tx(t => {
      const rows = t.rows('account', { user_id: a.user_id }).filter(row => row.watch_month === window.start);
      const used = rows.reduce((sum, row) => sum + Number(row.watch_sweeps ?? 0), 0);
      if (used >= budget) return false;
      const row = t.get('account', a.user_id, a.account_id)!;
      t.put('account', { ...row, watch_month: window.start, watch_sweeps: (row.watch_month === window.start ? Number(row.watch_sweeps ?? 0) : 0) + 1 });
      return true;
    });
    if (reserved) log.event('note', { msg: 'watcher sweep budget reserved', account_id: a.account_id, month: window.start, budget });
    return reserved;
  }

  async function runSweep(a: Account) {
    const data: Partial<Record<'listings' | 'offers' | 'messages' | 'orders', Row[]>> = {};
    for (const [verb, section] of sections) {
      if (hasVerb(a.site, verb) !== true) continue;
      const env = await d.harness.call(a.site, verb, { ...d.readArgs?.(a), account_id: a.account_id, person_id: a.user_id });
      log.event('note', { msg: 'watcher read', account_id: a.account_id, site: a.site, verb, ok: env.ok, ...(!env.ok && { code: env.error.code }) });
      if (!env.ok) return env;
      data[section] = rows(env.data, section);
    }
    const at = iso();
    // Depop's normalizer also strips the signed-in rows down to the privacy-safe snapshot seam.
    const next = { ...toWatchSnapshot({ ...data, account_id: a.account_id, user_id: a.user_id, taken_at: at }), site: a.site };
    const prev = d.snapshots.get(a.account_id) ?? null;
    for (const row of data.listings ?? []) {
      if (typeof row.external_id === 'string' && typeof row.slug === 'string') slugs.set(`${a.account_id}:${row.external_id}`, row.slug);
      if (typeof row.listed_at === 'string') {
        const t = Date.parse(row.listed_at);
        if (Number.isFinite(t)) posted.set(a.account_id, Math.max(posted.get(a.account_id) ?? -Infinity, t));
      }
    }
    for (const change of diffSweep(prev, next)) {
      if (!change.listing_external_id) continue;
      const listing = d.listings.byExternal(a.user_id, a.site, change.listing_external_id);
      if (!listing || listing.account_id !== a.account_id) continue;
      const event = toEvent(change, { user_id: a.user_id, source: 'watcher_signed_in', observed_at: at, trace_id: `watch:${a.account_id}:${at}` });
      event.listing_id = listing.listing_id;
      event.item_id = listing.item_id;
      event.payload = { ...event.payload, external_id: listing.external_id };
      if (change.action === 'offer.received') {
        const offer = next.offers?.find(o => o.external_id === change.ref);
        if (!offer || offer.state !== 'open') continue;
        const limits = limitsOf(a.user_id, listing.item_id, listing, next);
        const raw = data.offers?.find(o => o.external_id === offer.external_id);
        const received = typeof raw?.created_at === 'string' ? raw.created_at : at;
        const outcome = limits ? decide({ ...limits, site: a.site, offer_cents: offer.amount_cents,
          keep: price => keep(a.site, price).keep_cents, v_wait_cents: null, trust_block: false }, d.pAccept) : undefined;
        const response = outcome?.kind === 'accept_offer' ? 'accept' : outcome?.kind === 'decline_offer' ? 'decline' : 'counter';
        event.payload = { ...event.payload, ...limits, decision_kind: outcome?.kind ?? 'counter_offer',
          price_cents: outcome?.amount_cents ?? offer.amount_cents, response, offer_id: offer.external_id, received_at: received,
          ...(outcome && { decided_by: 'negotiation' }), negotiation_ask: !limits || !!outcome?.ask };
      }
      const result = ingest(store, log, event, iso);
      if ('refused' in result) throw new Error(`watcher event refused: ${result.refused.join(',')}`);
    }
    d.snapshots.set(a.account_id, next);
    if (d.hazard) for (const h of hazards(a, next)) log.event('note', { msg: 'watcher listing hazard', account_id: a.account_id, ...h });
    log.event('note', { msg: 'watcher snapshot', account_id: a.account_id, site: a.site, tier: stateOf(a), baseline: prev === null });
    return { ok: true as const };
  }

  function limitsOf(user_id: string, item_id: string, listing?: WatchedListing, snapshot = listing && d.snapshots.get(listing.account_id)) {
    const price_cents = snapshot?.listings?.find(l => l.external_id === listing?.external_id)?.price_cents ?? listing?.price_cents;
    const context = listing && { ...listing, ...(price_cents !== undefined && { price_cents }) };
    const limits = d.limits.of(user_id, item_id, context);
    return limits && price_cents !== undefined ? { ...limits, ask_cents: price_cents } : limits;
  }

  const scheduling = () => scheduler ??= createScheduler({ accounts: () => linked.filter(a => !stale.has(a.account_id)), stateOf,
    runSweep: a => runSweep(a).catch(error => { log.error('watcher.sweep', error, { account_id: a.account_id }); throw error; }),
    onStale: a => { stale.add(a.account_id); }, state, cadenceOf, snapshotOf: a => d.snapshots.get(a.account_id),
    ...(d.hazard && { permitSweep, priorityOf: risk }), params: d.params, leases: d.leases, now,
    leaseTtlMs: d.params.get('job_lease_ttl_ms') });

  // The pipeline's policy checks price and kind, but has no negotiation.ask input. Preserve that
  // stricter engine decision at the harness boundary before any adapter can run.
  const harness: HarnessLike = { async call<T>(site: Site, verb: string, args = {}) {
    const jobArgs = watcherJobArgs(args);
    const account_id = jobArgs?.account_id ?? '';
    const operation = jobArgs?.operation_id ?? '';
    const job = store.getJob(operation.slice(0, operation.lastIndexOf(':')));
    const user_id = job?.user_id ?? jobArgs?.user_id;
    const account = linked.find(a => a.account_id === account_id && a.site === site);
    const meta = { route_id: 'watcher', ms: 0, fell_back: false };
    if (account && account.user_id !== user_id) return { ok: false, error: {
      code: 'policy_refused', message: 'account belongs to another person', hint: { do: 'raise_decision', kind: 'site_warning' },
    }, meta };
    if (!account && typeof user_id === 'string') markStale(store, log, { user_id, account_id, site });
    if (!account || stale.has(account_id)) return { ok: false, error: { code: 'auth_expired', message: 'linked account unavailable', hint: { do: 'relink' } }, meta };
    if (store.get('account', account.user_id, account_id)?.paused === 'blocked') return { ok: false, error: {
      code: 'blocked', message: 'account check pending', hint: { do: 'pause_session', site },
    }, meta };
    const saleDelist = verb === 'end' && job?.args.decision_kind === 'delist_after_sale';
    if (saleDelist && !confirmedOrder(store, job!)) return { ok: false, error: {
      code: 'policy_refused', message: 'delist requires a confirmed order', hint: { do: 'raise_decision', kind: 'failed_delist' },
    }, meta };
    if (isWrite(verb as Verb) && !saleDelist && (!jobArgs || !jobArgs.account_id || jobArgs.decided_by !== 'negotiation' || jobArgs.negotiation_ask !== false
      || typeof jobArgs.price_cents !== 'number' || !Number.isSafeInteger(jobArgs.price_cents)
      || typeof jobArgs.floor_cents !== 'number' || !Number.isSafeInteger(jobArgs.floor_cents) || jobArgs.floor_cents < 0 || jobArgs.price_cents < jobArgs.floor_cents
      || typeof jobArgs.ask_cents !== 'number' || !Number.isSafeInteger(jobArgs.ask_cents) || jobArgs.price_cents > jobArgs.ask_cents
      || verb === 'answer_offer' && !jobArgs.response)) return { ok: false, error: {
      code: 'policy_refused', message: 'negotiation requires approval', hint: { do: 'raise_decision', kind: jobArgs?.decision_kind ?? 'offer_to_likers' },
    }, meta };
    if (isWrite(verb as Verb) && !saleDelist) {
      const listing = job?.item_id ? d.listings.ofItem(job.user_id, job.item_id).find(l => l.listing_id === job.listing_id && l.account_id === account_id && l.site === site) : undefined;
      const limits = job?.item_id ? limitsOf(job.user_id, job.item_id, listing) : undefined;
      const price = jobArgs!.price_cents!;
      if (!limits || price < limits.floor_cents || price > limits.ask_cents
        || jobArgs!.decision_kind === 'accept_offer' && price < limits.always_accept_cents) return { ok: false, error: {
        code: 'policy_refused', message: 'negotiation no longer meets current limits', hint: { do: 'raise_decision',
          kind: limits && price < limits.floor_cents ? 'price_below_floor' : String(jobArgs!.decision_kind ?? 'counter_offer') },
      }, meta };
    }
    const slug = slugs.get(`${account_id}:${jobArgs?.external_id}`) ?? jobArgs?.slug;
    if (site === 'depop' && verb === 'end' && typeof slug !== 'string') return { ok: false, error: {
      code: 'policy_refused', message: 'Depop listing slug has not been read', hint: { do: 'raise_decision', kind: 'failed_delist' },
    }, meta };
    const env = await d.harness.call<unknown>(site, verb as Verb, { ...d.readArgs?.(account), ...args, person_id: account.user_id,
      ...(site === 'depop' && verb === 'end' && { slug }),
      ...(verb === 'answer_offer' && { action: jobArgs?.response, amount_cents: jobArgs?.price_cents, now: iso() }),
    });
    log.event('note', { msg: 'watcher job call', account_id, site, verb, ok: env.ok, ...(!env.ok && { code: env.error.code }) });
    if (!env.ok) {
      if (env.error.code === 'auth_expired') staleAccount(account);
      if (env.error.code === 'rate_limited' || 'after_s' in env.error.hint) return { ...env, error: { ...env.error,
        hint: { ...env.error.hint, do: 'retry_after', after_s: retryAfter('after_s' in env.error.hint ? env.error.hint.after_s : undefined) },
      } };
      return env;
    }
    if (verb !== 'read_orders') return { ...env, data: env.data as T };
    const normalized = rows(env.data, 'orders').map(row => {
      if (typeof row.listing_external_id !== 'string' || typeof row.external_order_id !== 'string' || typeof row.price_cents !== 'number' || !ORDER_STATES.includes(row.state as OrderRead['state']))
        throw new Error('watcher orders: missing order identity, price or state');
      const listing = d.listings.byExternal(account.user_id, site, row.listing_external_id);
      return { ...row, listing_id: listing?.listing_id, fees_cents: row.fees_cents ?? null, shipping_cents: row.shipping_cents ?? 0 };
    });
    return { ...env, data: { orders: normalized } as T };
  } };

  const pipeline = createPipeline({ ...d, harness, worker: 'watcher', engines: { async poll_orders(job) {
    if (!job.site || !job.account_id || !job.listing_id || !job.item_id) throw new Error('poll_orders requires account, listing and item');
    let failure: HarnessError | undefined;
    const saleHarness: HarnessLike = { async call<T>(site: Site, verb: string, args = {}) {
      const env = await harness.call<T>(site, verb, { ...args, user_id: job.user_id });
      if (!env.ok) failure = env.error;
      return env;
    } };
    const result = await confirm({ store, log, harness: saleHarness, orders, listingsOf: item => d.listings.ofItem(job.user_id, item)
      .filter(l => linked.some(a => a.user_id === job.user_id && a.account_id === l.account_id && a.site === l.site)) },
    { ...job, site: job.site, account_id: job.account_id, listing_id: job.listing_id, item_id: job.item_id });
    if (result.outcome === 'paused') return { settle: 'pause', err: failure ?? { code: 'auth_expired', message: 'confirmation paused' } };
    if (result.outcome === 'error') {
      if (!failure) throw new Error('confirmation failed without a harness error');
      const err = { code: failure.code, message: failure.message };
      return failure.code === 'rate_limited' || failure.hint.do === 'retry_after'
        ? { settle: 'later', after_s: retryAfter(failure.hint.after_s), err } : { settle: 'fail', err };
    }
    return result;
  } }, onStale: job => { const a = linked.find(a => a.account_id === job.account_id && a.user_id === job.user_id);
    if (a) staleAccount(a);
    else if (job.account_id) markStale(store, log, { user_id: job.user_id, account_id: job.account_id, site: job.site }); } });

  return {
    async tick() {
      const next = (await d.accounts.linked()).map(a => ({ account_id: a.account_id, site: a.site as Site, user_id: a.person_id }));
      if (next.some(a => !linked.some(previous => previous.account_id === a.account_id))) scheduler = undefined;
      linked = next;
      const swept = await scheduling().tick();
      // runOnce also counts jobs it cannot lease or whose retry time is in the future. Stop when
      // the durable rows no longer change, leaving those jobs for the next clock tick.
      let before: string;
      do {
        before = JSON.stringify(store.jobs());
        if (!await pipeline.runOnce(Math.max(1, store.jobs().length))) break;
      } while (JSON.stringify(store.jobs()) !== before);
      return swept;
    },
    async relinked(account_id: string) {
      const owner = (await d.accounts.linked()).find(a => a.account_id === account_id);
      const a = owner ? await d.accounts.byId(account_id, owner.person_id) : undefined;
      if (!a) throw new Error(`cannot resume unlinked account ${account_id}`);
      markRelinked(store, log, { user_id: a.person_id, account_id });
      stale.delete(account_id);
      resumeAccount({ account_id, user_id: a.person_id, site: a.site as Site });
    },
    async cleared(account_id: string) {
      const owner = (await d.accounts.linked()).find(a => a.account_id === account_id);
      const a = owner ? await d.accounts.byId(account_id, owner.person_id) : undefined;
      if (!a) throw new Error(`cannot resume unlinked account ${account_id}`);
      resumeAccount({ account_id, user_id: a.person_id, site: a.site as Site });
      log.event('note', { msg: 'watcher account cleared', account_id });
    },
  };
}

function awaitingReply(s: Snapshot): boolean {
  const last = new Map<string, NonNullable<Snapshot['messages']>[number]>();
  for (const message of s.messages ?? []) {
    const old = last.get(message.thread_ref);
    if (!old || message.at > old.at) last.set(message.thread_ref, message);
  }
  return [...last.values()].some(m => m.from === 'buyer');
}

function retryAfter(after_s: unknown): number {
  return typeof after_s === 'number' && Number.isFinite(after_s) ? Math.max(1, after_s) : 60;
}
