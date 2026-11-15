// Signed-in background life: spec/product.md §6 and protocol-and-adapters.md §3.6.
// Baselines commit only after every supported section succeeds; partial reads never erase history.
import type { Accounts } from '../browser/auth.ts';
import { hasVerb } from '../harness/platform.ts';
import { isWrite, type Harness, type Verb } from '../harness/protocol.ts';
import { toWatchSnapshot } from '../harness/sites/depop/adapter.ts';
import { decide, type PAccept } from '../../engines/negotiation/choose.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { orderBook, ORDER_STATES, type OrderRead } from '../orders/orders.ts';
import { confirm } from '../sold/sold.ts';
import { diffSweep, toEvent } from './differ.ts';
import type { Snapshot, Site } from './event.ts';
import { ingest } from './intake.ts';
import { createPipeline, type PipelineLog } from './pipeline.ts';
import type { HarnessError, HarnessLike, JobRow, Leases, Params, Store } from './ports.ts';
import { createScheduler, type Account, type Tier } from './schedule.ts';
import { markStale, markRelinked } from './stale.ts';

export interface WatchedListing {
  listing_id: string; item_id: string; site: Site; account_id: string; external_id: string; state: string;
}
export interface WatcherDeps {
  store: Store; harness: Harness; accounts: Accounts; leases: Leases; params: Params; log: PipelineLog; now: () => number;
  listings: {
    byExternal(user_id: string, site: Site, external_id: string): WatchedListing | undefined;
    ofItem(user_id: string, item_id: string): WatchedListing[];
  };
  limits: { of(user_id: string, item_id: string): { ask_cents: number; floor_cents: number; always_accept_cents: number } | undefined };
  snapshots: Map<string, Snapshot>;
  pAccept: PAccept;
  orders?: ReturnType<typeof orderBook>;
  // Accounts currently exposes no marketplace shop identity. Inject it without deriving it from our account id.
  readArgs?: (account: Account) => Record<string, unknown>;
}

type Row = Record<string, unknown>;
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
  const confirmations = new Map<string, Partial<JobRow> & { next_run_at?: string }>();
  const staleAccount = (a: Account) => { stale.add(a.account_id); markStale(store, log, a); };

  function stateOf(a: Account): Tier {
    const s = d.snapshots.get(a.account_id);
    const live = s?.listings?.some(l => l.state === 'live');
    if (s?.offers?.some(o => o.state === 'open') || (s && awaitingReply(s)) || now() - (posted.get(a.account_id) ?? -Infinity) < 3600000) return 'hot';
    return live ? 'live' : 'quiet';
  }

  async function runSweep(a: Account) {
    const data: Partial<Record<'listings' | 'offers' | 'messages' | 'orders', Row[]>> = {};
    for (const [verb, section] of sections) {
      if (hasVerb(a.site, verb) !== true) continue;
      const env = await d.harness.call(a.site, verb, { ...d.readArgs?.(a), account_id: a.account_id });
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
        const limits = d.limits.of(a.user_id, listing.item_id);
        const raw = data.offers?.find(o => o.external_id === offer.external_id);
        const received = typeof raw?.created_at === 'string' ? raw.created_at : at;
        const outcome = limits ? decide({ ...limits, site: a.site, offer_cents: offer.amount_cents,
          keep: price => keep(a.site, price).keep_cents, v_wait_cents: null, trust_block: false }, d.pAccept) : undefined;
        const response = outcome?.kind === 'accept_offer' ? 'accept' : outcome?.kind === 'decline_offer' ? 'decline' : 'counter';
        event.payload = { ...event.payload, ...limits, decision_kind: outcome?.kind ?? 'counter_offer',
          price_cents: outcome?.amount_cents ?? offer.amount_cents, response, offer_id: offer.external_id, received_at: received,
          negotiation_ask: !limits || !!outcome?.ask };
      }
      const result = ingest(store, log, event, iso);
      if ('refused' in result) throw new Error(`watcher event refused: ${result.refused.join(',')}`);
    }
    d.snapshots.set(a.account_id, next);
    log.event('note', { msg: 'watcher snapshot', account_id: a.account_id, site: a.site, tier: stateOf(a), baseline: prev === null });
    return { ok: true as const };
  }

  const scheduler = createScheduler({ accounts: () => linked.filter(a => !stale.has(a.account_id)), stateOf,
    runSweep: a => runSweep(a).catch(error => { log.error('watcher.sweep', error, { account_id: a.account_id }); throw error; }),
    onStale: staleAccount, params: d.params, leases: d.leases, now,
    leaseTtlMs: d.params.get('job_lease_ttl_ms') });

  // The pipeline's policy checks price and kind, but has no negotiation.ask input. Preserve that
  // stricter engine decision at the harness boundary before any adapter can run.
  const harness: HarnessLike = { async call<T>(site: Site, verb: string, args = {}) {
    const account_id = typeof args.account_id === 'string' ? args.account_id : '';
    const account = linked.find(a => a.account_id === account_id && a.site === site);
    const meta = { route_id: 'watcher', ms: 0, fell_back: false };
    if (!account || stale.has(account_id)) return { ok: false, error: { code: 'auth_expired', message: 'linked account unavailable', hint: { do: 'relink' } }, meta };
    if (isWrite(verb as Verb) && args.negotiation_ask === true) return { ok: false, error: {
      code: 'policy_refused', message: 'negotiation requires approval', hint: { do: 'raise_decision', kind: String(args.decision_kind) },
    }, meta };
    const slug = slugs.get(`${account_id}:${args.external_id}`) ?? args.slug;
    if (site === 'depop' && verb === 'end' && typeof slug !== 'string') return { ok: false, error: {
      code: 'policy_refused', message: 'Depop listing slug has not been read', hint: { do: 'raise_decision', kind: 'failed_delist' },
    }, meta };
    const env = await d.harness.call<unknown>(site, verb as Verb, { ...d.readArgs?.(account), ...args,
      ...(site === 'depop' && verb === 'end' && { slug }),
      ...(verb === 'answer_offer' && { action: args.response, amount_cents: args.price_cents, now: iso() }),
    });
    log.event('note', { msg: 'watcher job call', account_id, site, verb, ok: env.ok, ...(!env.ok && { code: env.error.code }) });
    if (!env.ok) {
      if (env.error.code === 'auth_expired') staleAccount(account);
      if (env.error.hint.do === 'retry_after') return { ...env, error: { ...env.error,
        hint: { ...env.error.hint, after_s: Math.max(1, env.error.hint.after_s) },
      } };
      return env;
    }
    if (verb !== 'read_orders') return { ...env, data: env.data as T };
    const normalized = rows(env.data, 'orders').map(row => {
      if (typeof row.listing_external_id !== 'string' || typeof row.external_order_id !== 'string' || typeof row.price_cents !== 'number' || !ORDER_STATES.includes(row.state as OrderRead['state']))
        throw new Error('watcher orders: missing order identity, price or state');
      const listing = d.listings.byExternal(account.user_id, site, row.listing_external_id);
      return { ...row, listing_id: listing?.listing_id, fees_cents: row.fees_cents ?? 0, shipping_cents: row.shipping_cents ?? 0 };
    });
    return { ...env, data: { orders: normalized } as T };
  } };

  const pipeline = createPipeline({ ...d, harness, worker: 'watcher', engines: { async poll_orders(job) {
    if (!job.site || !job.account_id || !job.listing_id || !job.item_id) throw new Error('poll_orders requires account, listing and item');
    let failure: HarnessError | undefined;
    const saleHarness: HarnessLike = { async call<T>(site: Site, verb: string, args = {}) {
      const env = await harness.call<T>(site, verb, args);
      if (!env.ok) failure = env.error;
      return env;
    } };
    // confirm/fanOut has no clock port; stamp its transactional writes with this tick's clock.
    const saleStore: Store = { ...store, tx: fn => store.tx(t => fn({ ...t,
      insertEvent: event => t.insertEvent({ ...event, observed_at: iso(), effective_at: iso() }),
      insertJob: next => t.insertJob({ ...next, created_at: iso() }),
    })) };
    const result = await confirm({ store: saleStore, log, harness: saleHarness, orders, listingsOf: item => d.listings.ofItem(job.user_id, item)
      .filter(l => linked.some(a => a.user_id === job.user_id && a.account_id === l.account_id && a.site === l.site)) },
    { ...job, site: job.site, account_id: job.account_id, listing_id: job.listing_id, item_id: job.item_id });
    if (result.outcome === 'paused') confirmations.set(job.id, { state: 'queued', paused: 'account_stale' });
    if (result.outcome === 'error') {
      if (!failure) throw new Error('confirmation failed without a harness error');
      const retry = failure.code === 'rate_limited' || failure.hint.do === 'retry_after';
      confirmations.set(job.id, { state: retry ? 'queued' : 'failed', error: { code: failure.code, message: failure.message },
        ...(retry && { next_run_at: new Date(now() + (typeof failure.hint.after_s === 'number' ? failure.hint.after_s : 60) * 1000).toISOString() }),
      });
    }
    return result;
  } }, onStale: job => { const a = linked.find(a => a.account_id === job.account_id); if (a) staleAccount(a); } });

  return {
    async tick() {
      linked = (await d.accounts.linked()).map(a => ({ account_id: a.account_id, site: a.site as Site, user_id: a.person_id }));
      const swept = await scheduler.tick();
      // runOnce also counts jobs it cannot lease or whose retry time is in the future. Stop when
      // the durable rows no longer change, leaving those jobs for the next clock tick.
      let before: string;
      do {
        before = JSON.stringify(store.jobs());
        if (!await pipeline.runOnce(Math.max(1, store.jobs().length))) break;
        for (const [id, patch] of confirmations) {
          const job = store.updateJob(id, patch);
          log.job(id, job.kind, job.paused ? 'paused' : job.state, { code: job.error?.code });
        }
        confirmations.clear();
      } while (JSON.stringify(store.jobs()) !== before);
      return swept;
    },
    async relinked(account_id: string) {
      const a = await d.accounts.byId(account_id);
      if (!a) throw new Error(`cannot resume unlinked account ${account_id}`);
      markRelinked(store, log, { user_id: a.person_id, account_id });
      stale.delete(account_id); scheduler.resume(account_id);
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
