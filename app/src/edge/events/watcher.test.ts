import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from './file-store.ts';
import { createWatcher, type WatchedListing, type WatcherDeps } from './watcher.ts';
import { decide, type OfferState } from '../../engines/negotiation/choose.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { orderBook } from '../orders/orders.ts';
import { memoryStore, memoryParams, memoryLeases, type Store } from './ports.ts';
import { ingest } from './intake.ts';
import { memoryAccounts, memoryVault } from '../browser/auth.ts';
import { createHarness, fakeManifest, fail, type Adapter, type Harness, type Verb, type CallArgs } from '../harness/protocol.ts';
import { depopAdapters, PATHS, type Client } from '../harness/sites/depop/adapter.ts';
import type { Site, Snapshot } from './event.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
type Step = { minute: number; site: Site; kind: string; amount_cents?: number; id?: string };
const script = json<Step[]>('./fixtures/days/script.json');
const start = Date.parse('2026-11-16T00:00:00Z');
const atMinute = (site: Site, kind: string) => {
  const step = script.find(s => s.site === site && s.kind === kind);
  if (!step) throw new Error(`day script missing ${site} ${kind}`);
  return step.minute;
};
const pAccept = () => 0.5;
const requiresPAccept: undefined extends WatcherDeps['pAccept'] ? false : true = true;

async function week(noLimits = false, path?: string) {
  let minute = 0;
  const now = () => start + minute * 60_000;
  let store: Store = path ? fileStore(path) : memoryStore();
  const sink = memorySink();
  const log = createLog({ src: 'test', build: 'test', seed: 1, sink, now: () => new Date(now()) });
  const vault = memoryVault();
  const sites = ['depop', 'poshmark', 'ebay'] as const;
  const rows = sites.map(site => ({ account_id: `acc_${site}`, person_id: 'usr_walk', site, token_ref: `test_${site}` }));
  for (const row of rows) await vault.put(row.token_ref, { cookies: [], origins: [] });
  const accounts = memoryAccounts(rows, vault);
  for (const row of rows) store.put('account', { id: row.account_id, user_id: row.person_id, site: row.site, next_check_at: new Date(start).toISOString() });
  const listings: WatchedListing[] = [...sites, 'facebook' as const].map(site => ({ listing_id: `listing_${site}`, item_id: 'it_walk', site,
    account_id: `acc_${site}`, external_id: site === 'depop' ? '999002396' : `ext_${site}`, state: 'live' }));
  const active = (site: Site, kind: string) => script.filter(s => s.site === site && s.kind === kind && s.minute <= minute);
  const expired = () => minute >= atMinute('ebay', 'auth_expired') && minute < atMinute('ebay', 'relinked');
  const ended = new Set<Site>();
  const client: Client = { signed_in: true, async doc() { throw new Error('week must use fixture JSON, never the network'); }, async json(path) {
    const fixtures = '../harness/sites/depop/fixtures/';
    if (path === PATHS.products('shop_walk') || path === PATHS.sold('shop_walk')) {
      const source = json<{ objects: Record<string, unknown>[] }>(fixtures + 'products.json');
      const sold = active('depop', 'sale').length > 0;
      const listing = structuredClone(source.objects[0]);
      listing.status = sold ? 'STATUS_PURCHASED' : 'STATUS_ONSALE';
      listing.pricing = { currency: 'USD', current_price: { price_breakdown: { price: { amount: '60.00' } } } };
      const wantsSold = path === PATHS.sold('shop_walk');
      return { status: 200, body: { objects: sold === wantsSold ? [listing] : [] } };
    }
    const replies = json<Record<string, { objects: Record<string, unknown>[] }>>('./fixtures/days/replies.json');
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
  for (const site of ['poshmark', 'ebay'] as const) for (const verb of verbs) adapters.push({ route_id: `${site}.${verb}.week`, manifest: fakeManifest(site, verb), async run(args) {
    if (site === 'ebay' && expired()) return fail('auth_expired', 'simulated expiry', { do: 'relink', site });
    if (verb === 'end') { if (args.item_id === 'it_walk') { assert.equal(args.external_id, `ext_${site}`, 'delist carries target site id'); ended.add(site); } return { ok: true, data: { dry: true } }; }
    if (verb === 'read_listings') return { ok: true, data: [{ external_id: `ext_${site}`, state: ended.has(site) ? 'ended' : 'live', price_cents: 6000 }] };
    if (verb === 'read_offers') return { ok: true, data: active(site, 'quiet').length ? [] : active(site, 'offer').map(s => ({ external_id: s.id, listing_external_id: `ext_${site}`, amount_cents: s.amount_cents, state: 'open' })) };
    return { ok: true, data: [] };
  } });
  const real = createHarness({ adapters, accounts, now });
  const calls: { minute: number; site: Site; verb: Verb; args: CallArgs; dry?: boolean }[] = [];
  const harness: Harness = { async call<T>(site: Site, verb: Verb, args: CallArgs = {}) {
    assert.ok(rows.some(r => r.site === site && r.account_id === args.account_id), 'every harness call carries its linked account');
    const call = { minute, site, verb, args, dry: false }; calls.push(call);
    const result = await real.call<T>(site, verb, args);
    call.dry = result.ok && !!(result.data as { dry?: boolean }).dry;
    return result;
  } };
  const snapshots = new Map<string, Snapshot>();
  const makeWatcher = () => createWatcher({ store, harness, accounts, leases: memoryLeases(now), params: memoryParams({ watch_cadence_s: 900, job_lease_ttl_ms: 120000, delist_max_attempts: 3 },
    Object.fromEntries(sites.flatMap(site => Object.entries({ hot: 90, live: 900, quiet: 3600 }).map(([tier, cadence]) => [`watch_cadence_s@${site}/${tier}`, cadence])))), log, now,
    snapshots, listings: { byExternal: (_u, site, external) => listings.find(l => l.site === site && l.external_id === external), ofItem: () => listings },
    limits: { of: () => noLimits ? undefined : { ask_cents: 6000, floor_cents: 4500, always_accept_cents: 5800 } }, pAccept,
    readArgs: a => a.site === 'depop' ? { shop_id: 'shop_walk' } : {},
  });
  let watcher = makeWatcher();
  const sweeps: { site: Site; minute: number; tier: 'hot' | 'live' | 'quiet' }[] = [];
  for (; minute < 10080; minute++) {
    if (path && minute === 4320) {
      store = fileStore(path);
      assert.equal(store.get('account', 'usr_walk', 'acc_ebay')?.paused, 'auth_expired', 'day 4 reload preserves the stale account');
      watcher = makeWatcher();
    }
    if (minute === atMinute('ebay', 'auth_expired')) ingest(store, log, { user_id: 'usr_walk', account_id: 'acc_ebay', site: 'ebay', source: 'watcher_signed_in', action: 'price.changed',
      item_id: 'it_pause', listing_id: 'pause_ebay', actor: 'auto', dedupe_key: 'pause_probe', trace_id: 'week', observed_at: new Date(now()).toISOString(), effective_at: new Date(now()).toISOString(), payload: { external_id: 'pause_probe' } });
    if (minute === atMinute('ebay', 'relinked')) {
      assert.equal(store.decisions({ kind: 'relink', state: 'open' }).length, 1, 'one relink decision during expiry');
      assert.equal(store.jobs().find(j => j.idempotency_key === 'pause_probe')?.paused, 'account_stale', 'stale jobs are paused, never failed');
      await watcher.relinked('acc_ebay');
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
  }
  return { store, calls, snapshots, sweeps };
}

const counts = (r: Awaited<ReturnType<typeof week>>) => ({ events: r.store.events().length, jobs: r.store.jobs().length,
    decisions: r.store.decisions().map(d => `${d.kind}:${d.state}`).sort(),
    sweeps: Object.fromEntries(['depop', 'poshmark', 'ebay'].map(site => [site, r.calls.filter(c => c.site === site && c.verb === 'read_offers').length])),
    calls: Object.fromEntries([...new Set(r.calls.map(c => `${c.site}:${c.verb}`))].sort().map(k => [k, r.calls.filter(c => `${c.site}:${c.verb}` === k).length])) });

test('seven days: limits, drafts, stale sessions, confirmed sale, quiet cadence and deterministic dedupe', async t => {
  const began = performance.now();
  const a = await week();
  assert.equal(a.calls.filter(c => c.site === 'facebook').length, 0);
  const answers = a.calls.filter(c => c.verb === 'answer_offer');
  assert.equal(answers.length, 1, 'only the 5900 rule answer reaches a site');
  assert.equal(answers[0].site, 'depop'); assert.equal(answers[0].dry, true);
  assert.equal(a.store.jobs({ kind: 'send_message' }).length, 1); assert.equal(a.calls.filter(c => c.verb === 'send_message').length, 0);
  assert.deepEqual(a.store.decisions({ state: 'open' }).map(d => d.kind).sort(), ['counter_offer', 'price_below_floor', 'reply_other']);
  assert.equal(a.store.events().filter(e => e.action === 'offer.received').length, 3, 'identical reads emit no duplicate offers');
  assert.equal(a.calls.filter(c => c.site === 'ebay' && c.minute > atMinute('ebay', 'auth_expired') && c.minute < atMinute('ebay', 'relinked')).length, 0, 'no calls during stale interval');
  const delists = a.store.jobs({ kind: 'delist' }).filter(j => j.item_id === 'it_walk');
  assert.deepEqual(delists.map(j => j.site).sort(), ['ebay', 'poshmark']);
  const ends = a.calls.filter(c => c.verb === 'end' && c.args.item_id === 'it_walk');
  assert.deepEqual(ends.map(c => c.site).sort(), ['ebay', 'poshmark']);
  const confirmations = a.store.jobs({ kind: 'poll_orders' }).map(j => j.result as { order?: { id: string } });
  assert.equal(new Set(confirmations.map(r => r.order?.id).filter(Boolean)).size, 1, 'one order from listing and order observations');
  assert.equal(a.store.jobs({ state: 'failed' }).length, 0);
  for (const site of ['depop', 'poshmark', 'ebay']) {
    const times = a.calls.filter(c => c.site === site && c.verb === 'read_offers').map(c => c.minute);
    const quiet = times.filter(m => m >= 8640);
    assert.ok(quiet.length >= 23 && quiet.length <= 25, `${site}: final day hourly quiet sweeps`);
    const sweeps = a.sweeps.filter(s => s.site === site);
    for (let i = 1; i < sweeps.length; i++) {
      if (site === 'ebay' && sweeps[i].minute === atMinute('ebay', 'relinked')) continue;
      const prior = sweeps[i - 1];
      const cadenceMinutes = { hot: 2, live: 15, quiet: 60 }[prior.tier];
      assert.equal(sweeps[i].minute - prior.minute, cadenceMinutes, `${site}: ${prior.tier} cadence at minute ${prior.minute}`);
    }
  }
  assert.deepEqual(counts(a).sweeps, { depop: 3124, poshmark: 2475, ebay: 403 });
  assert.equal(counts(a).events, 11); assert.equal(counts(a).jobs, 11);
  const b = await week(); assert.deepEqual(counts(a), counts(b), 'same week has identical counts');
  t.diagnostic(JSON.stringify(counts(a)));
  assert.ok(performance.now() - began < 20000, 'two simulated weeks finish under 20 seconds');
});

test('an offer without item limits raises a decision and never writes an answer', async () => {
  const r = await week(true);
  assert.equal(r.calls.filter(c => c.verb === 'answer_offer').length, 0);
  assert.equal(r.store.decisions({ kind: 'counter_offer', state: 'open' }).length, 1, 'one open decision per item and kind');
  assert.equal(r.store.decisions({ kind: 'accept_offer', state: 'open' }).length, 0);
  const offers = r.store.events().filter(e => e.action === 'offer.received');
  assert.equal(offers.length, 3);
  assert.ok(offers.every(e => e.payload.decision_kind === 'counter_offer' && e.payload.negotiation_ask === true));
});

test('seven days on fileStore with a day 4 restart has the same final counts as memoryStore', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'watcher-week-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const memory = await week();
  const reloaded = await week(false, join(dir, 'store.json'));
  assert.deepEqual(counts(reloaded), counts(memory), 'saved due times and pauses preserve every weekly count');
});

function smallRig(run: Adapter['run'], overrides: Partial<Pick<WatcherDeps, 'pAccept' | 'orders'>> = {}, storage: { store?: Store; due?: boolean } = {}) {
  let time = start;
  const now = () => time;
  const store = storage.store ?? memoryStore(), log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  const account = { account_id: 'acc_depop', person_id: 'usr_walk', site: 'depop' as const, token_ref: 'fixture' };
  if (storage.due !== false) store.put('account', { id: account.account_id, user_id: account.person_id, site: account.site, next_check_at: new Date(start).toISOString() });
  const accounts = { async linked() { return [account]; }, async byId(id: string) { return id === account.account_id ? account : undefined; } };
  const calls: Verb[] = [];
  const adapters: Adapter[] = (['read_listings', 'read_offers', 'read_inbox', 'read_orders', 'end', 'answer_offer'] as Verb[]).map(verb => ({
    route_id: `test.${verb}`, manifest: fakeManifest('depop', verb), run: (args, signal) => { calls.push(verb); return run({ ...args, verb }, signal); },
  }));
  const snapshots = new Map<string, Snapshot>();
  const deps = { store, log, accounts, harness: createHarness({ adapters, accounts }), now, snapshots, leases: memoryLeases(now),
    params: memoryParams({ watch_cadence_s: 900, job_lease_ttl_ms: 120000, delist_max_attempts: 3 }, {
      'watch_cadence_s@depop/hot': 90, 'watch_cadence_s@depop/live': 900, 'watch_cadence_s@depop/quiet': 3600 }),
    listings: { byExternal: () => ({ listing_id: 'listing_depop', item_id: 'it_walk', site: 'depop' as const, account_id: 'acc_depop', external_id: 'ext', state: 'live' }), ofItem: () => [] },
    limits: { of: () => ({ ask_cents: 6000, floor_cents: 4500, always_accept_cents: 5800 }) }, pAccept, ...overrides };
  return { ...deps, watcher: createWatcher(deps), calls, advance: (ms: number) => { time += ms; } };
}
const live = { external_id: 'ext', state: 'live', price_cents: 6000 };

test('watcher creates missing account rows with spread due times and preserves existing account fields', async () => {
  const rig = smallRig(async () => ({ ok: true, data: [] }), {}, { due: false });
  await rig.watcher.tick();
  assert.equal(rig.calls.length, 0, 'new account must wait for its jittered first sweep');
  const row = rig.store.get('account', 'usr_walk', 'acc_depop');
  assert.ok(row, 'scheduler creates its account row');
  const due = Date.parse(String(row.next_check_at));
  assert.ok(due > start && due <= start + 3600000, 'quiet account starts within one cadence');
  rig.store.put('account', { ...row, marker: 'keep' });
  const restarted = createWatcher(rig);
  await restarted.tick(); assert.equal(rig.calls.length, 0, 'restart keeps the first due time');
  rig.advance(due - start); await restarted.tick();
  assert.equal(rig.calls.filter(v => v === 'read_listings').length, 1);
  assert.equal(rig.store.get('account', 'usr_walk', 'acc_depop')?.marker, 'keep', 'schedule writes preserve the rest of the row');
});

test('watcher blocked pause and one site_warning survive a day and fileStore reload until cleared', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'watcher-blocked-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'store.json');
  let blocked = true;
  const rig = smallRig(async () => blocked ? fail('blocked', 'fixture check', { do: 'pause_session', site: 'depop' }) : { ok: true, data: [] }, {}, { store: fileStore(path) });
  // A prior detection already opened this decision; another sweep must join it.
  const decision = rig.store.raiseDecision({ user_id: 'usr_walk', kind: 'site_warning', subject: 'acc_depop', why: 'fixture check', options: [] }).row;
  await rig.watcher.tick();
  assert.equal(rig.store.get('account', 'usr_walk', 'acc_depop')?.paused, 'blocked');
  assert.equal(rig.store.decisions({ kind: 'site_warning' }).length, 1, 'blocked sweeps dedupe while open');
  const store = fileStore(path), restarted = createWatcher({ ...rig, store });
  for (let i = 0; i < 1440; i++) { rig.advance(60000); await restarted.tick(); }
  assert.equal(rig.calls.length, 1, 'no read or job calls while blocked, including after restart');
  assert.equal(store.decisions({ kind: 'site_warning', subject: 'acc_depop', state: 'open' }).length, 1);
  blocked = false; await restarted.cleared('acc_depop');
  assert.equal(store.decisions().find(d => d.id === decision.id)?.state, 'answered', 'cleared closes the account warning');
  assert.equal(store.get('account', 'usr_walk', 'acc_depop')?.paused, null, 'cleared persists the pause removal');
  const cleared = createWatcher({ ...rig, store: fileStore(path) });
  await cleared.tick(); assert.equal(rig.calls.filter(v => v === 'read_listings').length, 2, 'saved clear resumes immediately');
});

test('watcher opens one warning for a new block and opens another only after clearing it', async () => {
  const rig = smallRig(async () => fail('blocked', 'fixture check', { do: 'pause_session', site: 'depop' }));
  await rig.watcher.tick();
  assert.equal(rig.store.decisions({ kind: 'site_warning', subject: 'acc_depop', state: 'open' }).length, 1);
  rig.advance(86400000); await rig.watcher.tick(); assert.equal(rig.calls.length, 1);
  await rig.watcher.cleared('acc_depop'); await rig.watcher.tick();
  assert.equal(rig.store.decisions({ kind: 'site_warning', state: 'answered' }).length, 1);
  assert.equal(rig.store.decisions({ kind: 'site_warning', state: 'open' }).length, 1);
});

test('a failed site_warning write cannot persist a blocked account without its decision', async () => {
  const memory = memoryStore(); let failDecision = true;
  const store: Store = { ...memory, tx: fn => memory.tx(t => fn({ ...t, raiseDecision(decision) {
    if (failDecision) { failDecision = false; throw new Error('decision write failed'); }
    return t.raiseDecision(decision);
  } })) };
  const rig = smallRig(async () => fail('blocked', 'fixture check', { do: 'pause_session', site: 'depop' }), {}, { store });
  await assert.rejects(rig.watcher.tick(), /decision write failed/);
  assert.equal(store.get('account', 'usr_walk', 'acc_depop')?.paused, undefined, 'pause and warning must commit together');
  await rig.watcher.tick();
  assert.equal(store.get('account', 'usr_walk', 'acc_depop')?.paused, 'blocked');
  assert.equal(store.decisions({ kind: 'site_warning', state: 'open' }).length, 1);
});

test('a failed resume write keeps both the account pause and its warning open', async () => {
  const memory = memoryStore(); let failResume = true;
  const store: Store = { ...memory, tx: fn => memory.tx(t => fn({ ...t, put(table, row) {
    if (table === 'account' && row.paused === null && failResume) { failResume = false; throw new Error('resume write failed'); }
    return t.put(table, row);
  } })) };
  const rig = smallRig(async () => fail('blocked', 'fixture check', { do: 'pause_session', site: 'depop' }), {}, { store });
  await rig.watcher.tick();
  await assert.rejects(rig.watcher.cleared('acc_depop'), /resume write failed/);
  assert.equal(store.get('account', 'usr_walk', 'acc_depop')?.paused, 'blocked');
  assert.equal(store.decisions({ kind: 'site_warning', state: 'open' }).length, 1, 'warning closes only when the resume is saved');
  await rig.watcher.cleared('acc_depop');
  assert.equal(store.get('account', 'usr_walk', 'acc_depop')?.paused, null);
  assert.equal(store.decisions({ kind: 'site_warning', state: 'open' }).length, 0);
});

test('a failed relink decision cannot leave a durable auth_expired pause without its prompt', async () => {
  const memory = memoryStore(); let failRelink = true;
  const store: Store = { ...memory, tx: fn => memory.tx(() => fn(store)), raiseDecision(decision) {
    if (decision.kind === 'relink' && failRelink) { failRelink = false; throw new Error('relink decision failed'); }
    return memory.raiseDecision(decision);
  } };
  const rig = smallRig(async () => fail('auth_expired', 'fixture expiry', { do: 'relink', site: 'depop' }), {}, { store });
  await assert.rejects(rig.watcher.tick(), /relink decision failed/);
  assert.equal(store.get('account', 'usr_walk', 'acc_depop')?.paused, undefined, 'auth pause and relink prompt must commit together');
  await createWatcher(rig).tick();
  assert.equal(store.get('account', 'usr_walk', 'acc_depop')?.paused, 'auth_expired');
  assert.equal(store.decisions({ kind: 'relink', state: 'open' }).length, 1);
});

test('watcher saves retry_after in account.next_check_at and respects it after restart', async () => {
  const rig = smallRig(async () => fail('rate_limited', 'fixture wait', { do: 'retry_after', after_s: 7200 }));
  await rig.watcher.tick();
  assert.equal(rig.store.get('account', 'usr_walk', 'acc_depop')?.next_check_at, new Date(start + 7200000).toISOString());
  const restarted = createWatcher(rig);
  rig.advance(7199999); await restarted.tick(); assert.equal(rig.calls.length, 1, 'restart must not retry early');
  rig.advance(1); await restarted.tick(); assert.equal(rig.calls.length, 2);
});

for (const paused of ['blocked', 'auth_expired', null] as const) {
  test(`an account linked after the first tick keeps its saved deadline and pause ${paused}`, async () => {
    const rig = smallRig(async () => ({ ok: true, data: [] }));
    const row = rig.store.get('account', 'usr_walk', 'acc_depop')!;
    rig.store.put('account', { ...row, paused, next_check_at: new Date(start + 7200000).toISOString() });
    const linked = rig.accounts.linked;
    rig.accounts.linked = async () => [];
    await rig.watcher.tick();
    rig.accounts.linked = linked;
    await rig.watcher.tick();
    assert.equal(rig.store.get('account', 'usr_walk', 'acc_depop')?.next_check_at, new Date(start + 7200000).toISOString(), 'late linking cannot overwrite a saved due time');
    rig.advance(7199999); await rig.watcher.tick(); assert.equal(rig.calls.length, 0);
    rig.advance(1); await rig.watcher.tick();
    assert.equal(rig.calls.length, paused ? 0 : 4, 'late linking must honor the saved pause');
  });
}

for (const action of ['cleared', 'relinked'] as const) {
  test(`${action} can resume a newly linked account before its first linked tick`, async () => {
    const rig = smallRig(async () => ({ ok: true, data: [] }));
    const linked = rig.accounts.linked;
    rig.accounts.linked = async () => [];
    await rig.watcher.tick();
    rig.accounts.linked = linked;
    await rig.watcher[action]('acc_depop');
    await rig.watcher.tick();
    assert.equal(rig.calls.filter(v => v === 'read_listings').length, 1, 'resume uses the account resolved by byId');
  });
}

test('counter candidates use site fees and the caller supplies the acceptance model', async () => {
  let offered = false;
  let state: OfferState | undefined;
  const rig = smallRig(async a => ({ ok: true, data: a.verb === 'read_listings' ? [live]
    : a.verb === 'read_offers' && offered ? [{ external_id: 'counter', listing_external_id: 'ext', amount_cents: 5000, state: 'open' }] : [] }),
  { pAccept: (_amount, s) => { state = s; return pAccept(); } });
  await rig.watcher.tick(); offered = true; rig.advance(900000); await rig.watcher.tick();
  assert.equal(requiresPAccept, true);
  assert.ok(state, 'watcher must call the supplied acceptance model for a counter');
  const outcome = decide(state, pAccept);
  assert.equal(outcome.kind, 'counter_offer');
  const offer_cents = state.offer_cents;
  const counters = outcome.candidates.filter(c => c.amount_cents > offer_cents);
  assert.ok(counters.length > 0, 'counter decision must expose candidate amounts');
  for (const candidate of counters) {
    assert.ok(candidate.keep < candidate.amount_cents, 'Depop fees must reduce candidate keep');
    assert.equal(candidate.keep, keep('depop', candidate.amount_cents).keep_cents);
    assert.equal(candidate.p_accept, 0.5);
  }
});

test('a confirmed sale is recorded in the caller order book once', async () => {
  let sold = false;
  const orders = orderBook(() => new Date(start).toISOString());
  const rig = smallRig(async a => ({ ok: true, data: a.verb === 'read_listings' ? [{ ...live, state: sold ? 'sold' : 'live' }]
    : a.verb === 'read_orders' && sold ? [{ external_order_id: 'caller_order', listing_external_id: 'ext', state: 'paid', price_cents: 5900 }] : [] }), { orders });
  await rig.watcher.tick(); sold = true; rig.advance(900000); await rig.watcher.tick();
  const recorded = orders.all();
  assert.equal(recorded.length, 1, 'confirmed sale must land in the caller order book');
  assert.equal(recorded[0].external_order_id, 'caller_order');
  assert.equal(recorded[0].kind, 'sale');
  assert.equal(recorded[0].user_id, 'usr_walk');
  assert.equal(recorded[0].item_id, 'it_walk');
  assert.equal(recorded[0].listing_id, 'listing_depop');
  assert.equal(recorded[0].state, 'paid');
  rig.advance(900000); await rig.watcher.tick();
  assert.deepEqual(orders.all(), recorded, 'repeated order reads must not duplicate the sale');
});

test('a partial sweep cannot commit a baseline or erase a previously read section', async () => {
  let broken = true, offered = false;
  const rig = smallRig(async a => {
    if (a.verb === 'read_orders' && broken) return fail('rate_limited', 'fixture throttle', { do: 'retry_after', after_s: 60 });
    return { ok: true, data: a.verb === 'read_listings' ? [live] : a.verb === 'read_offers' && offered
      ? [{ external_id: 'new', listing_external_id: 'ext', amount_cents: 5900, state: 'open' }] : [] };
  });
  await rig.watcher.tick(); assert.equal(rig.snapshots.size, 0, 'failed first sweep leaves no baseline');
  broken = false; rig.advance(3600000); await rig.watcher.tick();
  const baseline = rig.snapshots.get('acc_depop');
  broken = true; offered = true; rig.advance(900000); await rig.watcher.tick();
  assert.equal(rig.snapshots.get('acc_depop'), baseline, 'partial failure preserves previous snapshot');
  assert.equal(rig.store.events().length, 0);
  broken = false; rig.advance(900000); await rig.watcher.tick();
  assert.equal(rig.store.events().filter(e => e.action === 'offer.received').length, 1, 'next successful read still sees the offer');
});

test('baseline offers are silent; recent posts use hot cadence for one hour', async () => {
  const rig = smallRig(async a => ({ ok: true, data: a.verb === 'read_listings' ? [{ ...live, listed_at: new Date(start).toISOString() }]
    : a.verb === 'read_offers' ? [{ external_id: 'old', listing_external_id: 'ext', amount_cents: 5900, state: 'expired' }] : [] }));
  await rig.watcher.tick(); rig.advance(89000); await rig.watcher.tick();
  assert.equal(rig.calls.filter(v => v === 'read_listings').length, 1);
  rig.advance(1000); await rig.watcher.tick(); assert.equal(rig.calls.filter(v => v === 'read_listings').length, 2);
  rig.advance(3600000); await rig.watcher.tick();
  rig.advance(90000); await rig.watcher.tick(); assert.equal(rig.calls.filter(v => v === 'read_listings').length, 3, 'post is no longer hot');
  assert.equal(rig.store.events().length, 0, 'first read never answers a pre-existing offer');
});

test('a conversation becomes live cadence after our reply even if rows arrive out of order', async () => {
  const rig = smallRig(async a => ({ ok: true, data: a.verb === 'read_listings' ? [live] : a.verb === 'read_inbox' ? [
    { external_id: 'us', thread_ref: 'thread', at: '2026-11-16T00:02:00Z', from: 'us' },
    { external_id: 'buyer', thread_ref: 'thread', at: '2026-11-16T00:01:00Z', from: 'buyer' },
  ] : [] }));
  await rig.watcher.tick(); rig.advance(90000); await rig.watcher.tick();
  assert.equal(rig.calls.filter(v => v === 'read_listings').length, 1, 'answered thread does not stay hot');
});

test('confirmation auth expiry keeps poll_orders paused and resumes the same job after relink', async () => {
  let sold = false, orderReads = 0, expired = false;
  const rig = smallRig(async a => {
    if (a.verb === 'read_orders') {
      orderReads++;
      if (expired || sold && orderReads === 3) { expired = true; return fail('auth_expired', 'fixture expiry during confirmation', { do: 'relink', site: 'depop' }); }
    }
    return { ok: true, data: a.verb === 'read_listings' ? [{ ...live, state: sold ? 'sold' : 'live' }] : [] };
  });
  await rig.watcher.tick(); sold = true; rig.advance(900000); await rig.watcher.tick();
  const job = rig.store.jobs({ kind: 'poll_orders' })[0];
  assert.equal(job.state, 'queued'); assert.equal(job.paused, 'account_stale');
  const count = rig.calls.length; rig.advance(3600000); await rig.watcher.tick(); assert.equal(rig.calls.length, count);
  expired = false; await rig.watcher.relinked('acc_depop'); await rig.watcher.tick();
  assert.equal(rig.store.getJob(job.id)?.state, 'done'); assert.equal(rig.store.getJob(job.id)?.paused, undefined);
  assert.equal(rig.store.decisions({ kind: 'relink', state: 'open' }).length, 0);
});

test('draining stops at a future retry rather than repeatedly calling the site', async () => {
  const rig = smallRig(async a => a.verb === 'end' ? fail('rate_limited', 'fixture throttle', { do: 'retry_after', after_s: 60 }) : { ok: true, data: [] });
  ingest(rig.store, rig.log, { user_id: 'usr_walk', source: 'app', site: 'depop', account_id: 'acc_depop', action: 'app.delist',
    actor: 'auto', dedupe_key: 'retry', trace_id: 'retry', observed_at: new Date(start).toISOString(), effective_at: new Date(start).toISOString(), payload: { slug: 'seller-item-slug' } });
  await rig.watcher.tick(); await rig.watcher.tick();
  assert.equal(rig.calls.filter(v => v === 'end').length, 1);
  rig.advance(60000); await rig.watcher.tick(); assert.equal(rig.calls.filter(v => v === 'end').length, 2);
});

test('confirmation throttling preserves the site error and retries after its hint', async () => {
  let sold = false, reads = 0;
  const rig = smallRig(async a => {
    if (a.verb === 'read_orders' && ++reads === 3) return fail('rate_limited', 'confirmation throttle', { do: 'retry_after', after_s: 60 });
    return { ok: true, data: a.verb === 'read_listings' ? [{ ...live, state: sold ? 'sold' : 'live' }] : [] };
  });
  await rig.watcher.tick(); sold = true; rig.advance(900000); await rig.watcher.tick();
  const job = rig.store.jobs({ kind: 'poll_orders' })[0];
  assert.equal(job.state, 'queued', 'confirmation throttle is retryable');
  assert.equal(job.error?.code, 'rate_limited');
  assert.equal(reads, 3, 'drain respects the retry time');
  rig.advance(60000); await rig.watcher.tick();
  assert.equal(rig.store.getJob(job.id)?.state, 'done'); assert.equal(reads, 4);
});

test('a Depop delist translates the product id to the listing slug read from Depop', async () => {
  let endedSlug: unknown;
  const rig = smallRig(async a => {
    if (a.verb === 'end') endedSlug = a.slug;
    return { ok: true, data: a.verb === 'read_listings' ? [{ ...live, slug: 'seller-item-slug' }] : [] };
  });
  await rig.watcher.tick();
  ingest(rig.store, rig.log, { user_id: 'usr_walk', source: 'app', site: 'depop', account_id: 'acc_depop', action: 'app.delist',
    item_id: 'it_walk', listing_id: 'listing_depop', actor: 'auto', dedupe_key: 'slug', trace_id: 'slug', observed_at: new Date(start).toISOString(),
    effective_at: new Date(start).toISOString(), payload: { external_id: 'ext' } });
  await rig.watcher.tick();
  assert.equal(rig.calls.filter(v => v === 'end').length, 1);
  assert.equal(rig.store.jobs({ kind: 'delist' })[0].state, 'done');
  assert.equal(endedSlug, 'seller-item-slug', 'Depop end requires its slug rather than product id');
});

test('a zero-delay retry cannot drain repeatedly within one clock tick', async () => {
  let attempts = 0;
  const rig = smallRig(async a => a.verb === 'end' && ++attempts < 3
    ? fail('rate_limited', 'immediate retry hint', { do: 'retry_after', after_s: 0 }) : { ok: true, data: [] });
  ingest(rig.store, rig.log, { user_id: 'usr_walk', source: 'app', site: 'depop', account_id: 'acc_depop', action: 'app.delist', actor: 'auto',
    dedupe_key: 'zero-retry', trace_id: 'zero-retry', observed_at: new Date(start).toISOString(), effective_at: new Date(start).toISOString(), payload: { slug: 'known-slug' } });
  await rig.watcher.tick();
  assert.equal(attempts, 1, 'one attempt per clock tick even with an immediate retry hint');
});
