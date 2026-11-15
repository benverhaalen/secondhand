import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWatcher, type WatchedListing, type WatcherDeps } from '../watcher.ts';
import type { PipelineLog } from '../pipeline.ts';
import { memoryStore, memoryParams, memoryLeases, type Store } from '../ports.ts';
import { ingest } from '../intake.ts';
import { memoryAccounts, memoryVault } from '../../browser/auth.ts';
import { createHarness, fakeManifest, fail, type Adapter, type Harness, type Verb, type CallArgs, type Envelope } from '../../harness/protocol.ts';
import { depopAdapters, PATHS, type Client } from '../../harness/sites/depop/adapter.ts';
import type { Site, Snapshot } from '../event.ts';
import { createLog, memorySink } from '../../../../../log/index.js';

export type WeekCall = { minute: number; site: Site; verb: Verb; args: CallArgs; dry: boolean; reply: Envelope };

const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
type Step = { minute: number; site: Site; kind: string; amount_cents?: number; id?: string };
const script = json<Step[]>('./days/script.json');
export const start = Date.parse('2026-11-16T00:00:00Z');
export const atMinute = (site: Site, kind: string) => {
  const step = script.find(s => s.site === site && s.kind === kind);
  if (!step) throw new Error(`day script missing ${site} ${kind}`);
  return step.minute;
};
export const pAccept = () => 0.5;

export async function weekRig(noLimits = false, options: {
  store?: Store; log?: PipelineLog; pAccept?: WatcherDeps['pAccept'];
  onCall?: (call: WeekCall) => void;
  onRelink?: (phase: 'paused' | 'resumed', store: Store) => void;
} = {}) {
  let minute = 0;
  const now = () => start + minute * 60_000;
  const store = options.store ?? memoryStore(), sink = memorySink();
  const log = options.log ?? createLog({ src: 'test', build: 'test', seed: 1, sink, now: () => new Date(now()) });
  const vault = memoryVault();
  const sites = ['depop', 'poshmark', 'ebay'] as const;
  const rows = sites.map(site => ({ account_id: `acc_${site}`, person_id: 'usr_walk', site, token_ref: `test_${site}` }));
  for (const row of rows) await vault.put(row.token_ref, { cookies: [], origins: [] });
  const accounts = memoryAccounts(rows, vault);
  const listings: WatchedListing[] = [...sites, 'facebook' as const].map(site => ({ listing_id: `listing_${site}`, item_id: 'it_walk', site,
    account_id: `acc_${site}`, external_id: site === 'depop' ? '999002396' : `ext_${site}`, state: 'live' }));
  const active = (site: Site, kind: string) => script.filter(s => s.site === site && s.kind === kind && s.minute <= minute);
  const expired = () => minute >= atMinute('ebay', 'auth_expired') && minute < atMinute('ebay', 'relinked');
  const ended = new Set<Site>();
  const client: Client = { signed_in: true, async doc() { throw new Error('week must use fixture JSON, never the network'); }, async json(path) {
    const fixtures = '../../harness/sites/depop/fixtures/';
    if (path === PATHS.products('shop_walk') || path === PATHS.sold('shop_walk')) {
      const source = json<{ objects: Record<string, unknown>[] }>(fixtures + 'products.json');
      const sold = active('depop', 'sale').length > 0;
      const listing = structuredClone(source.objects[0]);
      listing.status = sold ? 'STATUS_PURCHASED' : 'STATUS_ONSALE';
      listing.pricing = { currency: 'USD', current_price: { price_breakdown: { price: { amount: '60.00' } } } };
      const wantsSold = path === PATHS.sold('shop_walk');
      return { status: 200, body: { objects: sold === wantsSold ? [listing] : [] } };
    }
    const replies = json<Record<string, { objects: Record<string, unknown>[] }>>('./days/replies.json');
    if (path === PATHS.offers) {
      const row = json<{ objects: Record<string, unknown>[] }>(fixtures + 'offers.json').objects[0];
      return { status: 200, body: { objects: active('depop', 'offer').map(s => ({ ...row, id: s.id, product_id: 999002396,
        amount: { amount: ((s.amount_cents ?? 0) / 100).toFixed(2) }, created_at: new Date(start + s.minute * 60_000).toISOString(),
        status: minute < atMinute('depop', 'quiet') ? 'pending' : 'accepted' })) } };
    }
    if (path === PATHS.inbox) return { status: 200, body: minute >= atMinute('depop', 'quiet') ? { objects: [] } : active('depop', 'message').length ? replies.inbox : { objects: [] } };
    if (path === PATHS.orders) return { status: 200, body: active('depop', 'sale').length ? replies.orders : { objects: [] } };
    throw new Error(`unexpected Depop path ${path}`);
  } };
  const adapters: Adapter[] = depopAdapters(client);
  const verbs: Verb[] = ['read_listings', 'read_offers', 'read_inbox', 'read_orders', 'answer_offer', 'end'];
  for (const site of ['poshmark', 'ebay'] as const) for (const verb of verbs) adapters.push({ route_id: `fake.${site}.${verb}.week`, manifest: fakeManifest(site, verb), async run(args) {
    if (site === 'ebay' && expired()) return fail('auth_expired', 'simulated expiry', { do: 'relink', site });
    if (verb === 'end') { if (args.item_id === 'it_walk') { assert.equal(args.external_id, `ext_${site}`, 'delist carries target site id'); ended.add(site); } return { ok: true, data: { dry: true } }; }
    if (verb === 'read_listings') return { ok: true, data: [{ external_id: `ext_${site}`, state: ended.has(site) ? 'ended' : 'live', price_cents: 6000 }] };
    if (verb === 'read_offers') return { ok: true, data: active(site, 'quiet').length ? [] : active(site, 'offer').map(s => ({ external_id: s.id, listing_external_id: `ext_${site}`, amount_cents: s.amount_cents, state: 'open' })) };
    return { ok: true, data: [] };
  } });
  const real = createHarness({ adapters, accounts, now });
  const calls: WeekCall[] = [];
  const harness: Harness = { async call<T>(site: Site, verb: Verb, args: CallArgs = {}) {
    assert.ok(rows.some(r => r.site === site && r.account_id === args.account_id), 'every harness call carries its linked account');
    const result = await real.call<T>(site, verb, args);
    const call = { minute, site, verb, args, dry: result.ok && !!(result.data as { dry?: boolean }).dry, reply: result };
    calls.push(call); options.onCall?.(call);
    return result;
  } };
  const snapshots = new Map<string, Snapshot>();
  const watcher = createWatcher({ store, harness, accounts, leases: memoryLeases(now), params: memoryParams({ watch_cadence_s: 900, job_lease_ttl_ms: 120000, delist_max_attempts: 3 },
    Object.fromEntries(sites.flatMap(site => Object.entries({ hot: 90, live: 900, quiet: 3600 }).map(([tier, cadence]) => [`watch_cadence_s@${site}/${tier}`, cadence])))), log, now,
    snapshots, listings: { byExternal: (_u, site, external) => listings.find(l => l.site === site && l.external_id === external), ofItem: () => listings },
    limits: { of: () => noLimits ? undefined : { ask_cents: 6000, floor_cents: 4500, always_accept_cents: 5800 } }, pAccept: options.pAccept ?? pAccept,
    readArgs: a => a.site === 'depop' ? { shop_id: 'shop_walk' } : {},
  });
  const sweeps: { site: Site; minute: number; tier: 'hot' | 'live' | 'quiet' }[] = [];
  const tick = async (nextMinute: number) => {
    minute = nextMinute;
    if (minute === atMinute('ebay', 'auth_expired')) ingest(store, log, { user_id: 'usr_walk', account_id: 'acc_ebay', site: 'ebay', source: 'watcher_signed_in', action: 'price.changed',
      item_id: 'it_walk', listing_id: 'listing_ebay', actor: 'auto', dedupe_key: 'pause_probe', trace_id: 'week', observed_at: new Date(now()).toISOString(), effective_at: new Date(now()).toISOString(), payload: { external_id: 'pause_probe' } });
    if (minute === atMinute('ebay', 'relinked')) {
      assert.equal(store.decisions({ kind: 'relink', state: 'open' }).length, 1, 'one relink decision during expiry');
      assert.equal(store.jobs().find(j => j.idempotency_key === 'pause_probe')?.paused, 'account_stale', 'stale jobs are paused, never failed');
      options.onRelink?.('paused', store);
      await watcher.relinked('acc_ebay');
      options.onRelink?.('resumed', store);
      assert.equal(store.decisions({ kind: 'relink', state: 'open' }).length, 0, 'relink closes decision');
    }
    const result = await watcher.tick();
    for (const id of result.ran) {
      const site = rows.find(a => a.account_id === id)!.site;
      const snapshot = snapshots.get(id)!;
      const tier = site === 'depop' && minute >= atMinute('depop', 'offer') && minute < atMinute('depop', 'quiet') || site === 'poshmark' && minute >= atMinute('poshmark', 'offer') && minute < atMinute('poshmark', 'quiet')
        ? 'hot' : snapshot.listings?.some(l => l.state === 'live') ? 'live' : 'quiet';
      sweeps.push({ site, minute, tier });
    }
  };
  return { store, calls, snapshots, sweeps, tick, harness, now, listings, accounts, log };
}

export async function week(noLimits = false) {
  const rig = await weekRig(noLimits);
  for (let minute = 0; minute < 10080; minute++) await rig.tick(minute);
  return rig;
}

