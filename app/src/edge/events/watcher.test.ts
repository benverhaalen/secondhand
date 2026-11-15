import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from './file-store.ts';
import { createWatcher, type WatcherDeps } from './watcher.ts';
import { decide, type OfferState } from '../../engines/negotiation/choose.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { memoryStore as paramStore } from '../../engines/param/param.ts';
import { orderBook } from '../orders/orders.ts';
import { memoryStore, memoryParams, memoryLeases, type Store, type JobRow } from './ports.ts';
import { createPipeline } from './pipeline.ts';
import { markRelinked } from './stale.ts';
import { ingest } from './intake.ts';
import { createHarness, fakeManifest, fail, type Adapter, type Verb, type CallArgs } from '../harness/protocol.ts';
import type { Snapshot, Site } from './event.ts';
import { createLog, memorySink } from '../../../../log/index.js';
import { week, hazardWeek, atMinute, start, pAccept } from './fixtures/week.ts';
const requiresPAccept: undefined extends WatcherDeps['pAccept'] ? false : true = true;

const counts = (r: Awaited<ReturnType<typeof week>>) => ({ events: r.store.events().length, jobs: r.store.jobs().length,
    decisions: r.store.decisions().map(d => `${d.kind}:${d.state}`).sort(),
    sweeps: Object.fromEntries(['depop', 'poshmark', 'ebay'].map(site => [site, r.calls.filter(c => c.site === site && c.verb === 'read_offers').length])),
    calls: Object.fromEntries([...new Set(r.calls.map(c => `${c.site}:${c.verb}`))].sort().map(k => [k, r.calls.filter(c => `${c.site}:${c.verb}` === k).length])) });

test('seven days: limits, drafts, stale sessions, confirmed sale, quiet cadence and deterministic dedupe', async t => {
  const began = performance.now();
  const a = await week();
  assert.equal(a.calls.filter(c => c.site === 'facebook').length, 0);
  for (const call of a.calls.filter(c => writeVerbs.has(c.verb) && c.verb !== 'end')) {
    assert.equal(call.args.decided_by, 'negotiation'); assert.equal(call.args.negotiation_ask, false);
    assert.ok(Number(call.args.price_cents) >= Number(call.args.floor_cents));
    assert.ok(Number(call.args.price_cents) <= Number(call.args.ask_cents));
  }
  const answers = a.calls.filter(c => c.verb === 'answer_offer');
  assert.equal(answers.length, 1, 'only the 5900 rule answer reaches a site');
  assert.equal(answers[0].site, 'depop'); assert.equal(answers[0].dry, true);
  assert.equal(a.store.jobs({ kind: 'send_message' }).length, 1); assert.equal(a.calls.filter(c => c.verb === 'send_message').length, 0);
  assert.deepEqual(a.store.decisions({ state: 'open' }).map(d => d.kind).sort(), ['accept_offer', 'counter_offer', 'delist_after_sale', 'delist_after_sale', 'price_below_floor', 'reply_other']);
  assert.equal(a.store.events().filter(e => e.action === 'offer.received').length, 3, 'identical reads emit no duplicate offers');
  assert.equal(a.calls.filter(c => c.site === 'ebay' && c.minute > atMinute('ebay', 'auth_expired') && c.minute < atMinute('ebay', 'relinked')).length, 0, 'no calls during stale interval');
  const delists = a.store.jobs({ kind: 'delist' }).filter(j => j.item_id === 'it_walk');
  assert.deepEqual(delists.map(j => j.site).sort(), ['ebay', 'poshmark']);
  const ends = a.calls.filter(c => c.verb === 'end' && c.args.item_id === 'it_walk');
  assert.deepEqual(ends.map(c => c.site).sort(), ['ebay', 'poshmark']);
  for (const job of delists) {
    assert.equal(job.stages[0].state, 'planned');
    assert.equal(a.snapshots.get(job.account_id!)?.listings?.[0].state, 'live');
  }
  assert.equal(a.store.events().filter(e => e.action === 'listing.ended').length, 0, 'dry ends must not fabricate ended observations');
  const confirmations = a.store.jobs({ kind: 'poll_orders' }).map(j => j.result as { order?: { id: string } });
  assert.equal(new Set(confirmations.map(r => r.order?.id).filter(Boolean)).size, 1, 'one order from listing and order observations');
  assert.equal(a.store.jobs({ state: 'failed' }).length, 0);
  for (const site of ['depop', 'poshmark', 'ebay']) {
    const times = a.calls.filter(c => c.site === site && c.verb === 'read_offers').map(c => c.minute);
    const quiet = times.filter(m => m >= 8640);
    const expected = site === 'depop' ? 24 : 96;
    assert.ok(Math.abs(quiet.length - expected) <= 1, `${site}: final-day sweeps reflect the observed listing state`);
    const sweeps = a.sweeps.filter(s => s.site === site);
    for (let i = 1; i < sweeps.length; i++) {
      if (site === 'ebay' && sweeps[i].minute === atMinute('ebay', 'relinked')) continue;
      const prior = sweeps[i - 1];
      const cadenceMinutes = { hot: 2, live: 15, quiet: 60 }[prior.tier];
      assert.equal(sweeps[i].minute - prior.minute, cadenceMinutes, `${site}: ${prior.tier} cadence at minute ${prior.minute}`);
    }
  }
  assert.deepEqual(counts(a).sweeps, { depop: 3124, poshmark: 2648, ebay: 576 });
  assert.equal(counts(a).events, 9); assert.equal(counts(a).jobs, 9);
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
  const payloads = offers.flatMap(e => e.payload ? [e.payload] : []);
  assert.equal(payloads.length, offers.length, 'every received offer has its payload');
  assert.ok(payloads.every(payload => payload.decision_kind === 'counter_offer' && payload.negotiation_ask === true));
});

for (const [label, response] of [['wrong type', 7], ['missing', undefined]] as const) test(`a watcher job with a ${label} response never reaches the marketplace adapter`, async () => {
  const rig = smallRig(async () => ({ ok: true, data: [] }));
  const stamp = new Date(start).toISOString();
  ingest(rig.store, rig.log, { user_id: 'usr_walk', source: 'watcher_signed_in', site: 'depop', account_id: 'acc_depop',
    action: 'offer.received', item_id: 'it_walk', listing_id: 'listing_depop', actor: 'auto', dedupe_key: `bad-response-${label}`, trace_id: 'guard',
    observed_at: stamp, effective_at: stamp, payload: { ...decidedFixture(), ...(response !== undefined && { response }), external_id: 'ext' } });
  await rig.watcher.tick();
  assert.equal(rig.calls.includes('answer_offer'), false, 'response shape is checked before adapter execution');
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
  const accounts = { async linked() { return [account]; }, async byId(id: string, person_id?: string) { return id === account.account_id && person_id === account.person_id ? account : undefined; } };
  const calls: Verb[] = [];
  const adapters: Adapter[] = (['read_listings', 'read_offers', 'read_inbox', 'read_orders', 'post', 'revise', 'end', 'relist', 'send_message', 'answer_offer', 'make_offer', 'save'] as Verb[]).map(verb => ({
    route_id: `test.${verb}`, manifest: fakeManifest('depop', verb), run: (args, signal) => run({ ...args, verb }, signal),
  }));
  const snapshots = new Map<string, Snapshot>();
  const adapterHarness = createHarness({ adapters, accounts });
  const harness: WatcherDeps['harness'] = { async call<T>(site: Site, verb: Verb, args: CallArgs = {}) {
    calls.push(verb); return adapterHarness.call<T>(site, verb, args);
  } };
  const deps = { store, log, accounts, harness, now, snapshots, leases: memoryLeases(now),
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
  assert.equal(rig.store.rows('order', { user_id: 'usr_walk' })[0]?.id, recorded[0].id, 'caller and durable order share their identity');
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
  ingest(rig.store, rig.log, { user_id: 'usr_walk', source: 'app', site: 'depop', account_id: 'acc_depop', action: 'app.delist', item_id: 'it_walk',
    actor: 'auto', dedupe_key: 'retry', trace_id: 'retry', observed_at: new Date(start).toISOString(), effective_at: new Date(start).toISOString(), payload: { ...decidedFixture(), slug: 'seller-item-slug' } });
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
    effective_at: new Date(start).toISOString(), payload: { ...decidedFixture(), external_id: 'ext' } });
  await rig.watcher.tick();
  assert.equal(rig.calls.filter(v => v === 'end').length, 1);
  assert.equal(rig.store.jobs({ kind: 'delist' })[0].state, 'done');
  assert.equal(endedSlug, 'seller-item-slug', 'Depop end requires its slug rather than product id');
});

test('a zero-delay retry cannot drain repeatedly within one clock tick', async () => {
  let attempts = 0;
  const rig = smallRig(async a => a.verb === 'end' && ++attempts < 3
    ? fail('rate_limited', 'immediate retry hint', { do: 'retry_after', after_s: 0 }) : { ok: true, data: [] });
  ingest(rig.store, rig.log, { user_id: 'usr_walk', source: 'app', site: 'depop', account_id: 'acc_depop', action: 'app.delist', item_id: 'it_walk', actor: 'auto',
    dedupe_key: 'zero-retry', trace_id: 'zero-retry', observed_at: new Date(start).toISOString(), effective_at: new Date(start).toISOString(), payload: { ...decidedFixture(), slug: 'known-slug' } });
  await rig.watcher.tick();
  assert.equal(attempts, 1, 'one attempt per clock tick even with an immediate retry hint');
});

const writeVerbs = new Set<Verb>(['post', 'revise', 'end', 'relist', 'send_message', 'answer_offer', 'make_offer', 'save']);

test('seven days: Depop likes 3 -> 4 open one offer_to_likers decision and never call a write verb', async () => {
  let likes = 3;
  const rig = smallRig(async a => ({ ok: true, data: a.verb === 'read_listings' ? [{ ...live, likes }] : [] }));
  for (let minute = 0; minute < 10080; minute++) {
    if (minute === 15) likes = 4;
    await rig.watcher.tick(); rig.advance(60000);
  }
  assert.deepEqual(rig.calls.filter(v => writeVerbs.has(v)), [], 'a like has no negotiation result authorizing any write');
  assert.equal(rig.store.events().filter(e => e.action === 'like.added').length, 1);
  assert.equal(rig.store.decisions({ kind: 'offer_to_likers', state: 'open' }).length, 1);
});

function queueRead(rig: ReturnType<typeof smallRig>, user_id = 'usr_walk', account_id = 'acc_depop', kind: 'reconcile' | 'poll_orders' = 'reconcile') {
  return rig.store.insertJob({ kind, user_id, account_id, site: 'depop', item_id: 'it_walk', listing_id: 'listing_depop',
    args: {}, event_id: 'fixture', idempotency_key: `${kind}:${user_id}:${account_id}`, state: 'queued', stages: [], attempts: 0,
    trace_id: 'fixture', created_at: new Date(start).toISOString() }).row;
}

test('another person carrying a linked account_id is policy_refused before any job adapter runs', async () => {
  const rig = smallRig(async () => ({ ok: true, data: [] }));
  await rig.watcher.tick(); const before = rig.calls.length;
  const job = queueRead(rig, 'usr_other'); await rig.watcher.tick();
  assert.equal(rig.calls.length, before);
  assert.equal(rig.store.getJob(job.id)?.state, 'done');
  assert.ok((rig.store.getJob(job.id)?.result as { refused?: string }).refused);
});

test('an unlinked confirmation job pauses with a relink decision for its own person and account', async () => {
  const rig = smallRig(async () => ({ ok: true, data: [] }));
  const job = queueRead(rig, 'usr_missing', 'acc_missing', 'poll_orders'); await rig.watcher.tick();
  assert.equal(rig.store.getJob(job.id)?.paused, 'account_stale');
  assert.equal(rig.store.decisions({ user_id: 'usr_missing', subject: 'acc_missing', kind: 'relink', state: 'open' }).length, 1);
});

for (const after_s of [undefined, NaN, Infinity]) test(`confirmation retry_after ${after_s} defaults to 60 seconds`, async () => {
  let throttle = true;
  const rig = smallRig(async a => a.verb === 'read_orders' && throttle
    ? fail('rate_limited', 'fixture throttle', { do: 'retry_after', after_s: after_s as number }) : { ok: true, data: [] });
  const job = queueRead(rig, 'usr_walk', 'acc_depop', 'poll_orders');
  await rig.watcher.tick();
  const saved = rig.store.getJob(job.id) as typeof job & { next_run_at?: string };
  assert.equal(saved.state, 'queued'); assert.equal(saved.next_run_at, new Date(start + 60000).toISOString());
  throttle = false; rig.advance(59999); await rig.watcher.tick(); assert.equal(rig.store.getJob(job.id)?.attempts, 1);
  rig.advance(1); await rig.watcher.tick(); assert.equal(rig.store.getJob(job.id)?.state, 'done');
});

test('engine pause settles atomically, survives fileStore reconstruction, and cannot undo a later relink', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'watcher-settle-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.json'), writes: Partial<JobRow>[] = [];
  const disk = fileStore(path), store: Store = { ...disk, updateJob(id, patch) { writes.push(patch); return disk.updateJob(id, patch); } };
  const rig = smallRig(async () => ({ ok: true, data: [] }), {}, { store });
  const job = queueRead(rig, 'usr_walk', 'acc_depop', 'poll_orders');
  const pipeline = createPipeline({ ...rig, worker: 'test', engines: { poll_orders: () => ({ settle: 'pause', err: { code: 'auth_expired', message: 'expired' } }) } });
  await pipeline.runOnce(1);
  assert.equal(store.getJob(job.id)?.state, 'queued', 'runOnce itself must persist the pause');
  assert.equal(store.getJob(job.id)?.paused, 'account_stale');
  assert.ok(writes.some(p => p.state === 'queued' && p.paused === 'account_stale'), 'one write carries both state and pause');
  assert.ok(!writes.some(p => p.state === 'done'), 'no crash window may expose a completed confirmation');
  const recovered = fileStore(path); let runs = 0;
  const restarted = createPipeline({ ...rig, store: recovered, worker: 'restart', engines: { poll_orders: () => { runs++; return { outcome: 'not_sold' }; } } });
  await restarted.runOnce(1); assert.equal(runs, 0); assert.equal(recovered.getJob(job.id)?.paused, 'account_stale');
  markRelinked(recovered, rig.log, { user_id: job.user_id, account_id: job.account_id! });
  await restarted.runOnce(1); assert.equal(runs, 1); assert.equal(recovered.getJob(job.id)?.state, 'done');
  assert.equal(recovered.getJob(job.id)?.paused, undefined);
});


test('seven days: live-offer hazard beats stale cadence, spends less than fixed tiers, and cold listings use kind/site d10 then views', async () => {
  const adaptive = await hazardWeek(true), fixed = await hazardWeek(false);
  const count = (id: string) => adaptive.calls.filter(c => c.account_id === id).length;
  assert.ok(count('z_hot') > count('a_stale'), 'higher hazard must receive more reads');
  assert.ok(adaptive.calls.length < fixed.calls.length, 'hazard cadence must save sweeps');
  assert.ok(adaptive.calls.length <= Math.ceil(adaptive.budget * 7 / 30), 'week cannot borrow the rest of the monthly budget');
  const cold = adaptive.bases.filter(b => b.listing_id === 'listing_new');
  assert.ok(cold.some(b => b.minute < 1440 && b.basis === 'd10' && b.citation_id === 'd10:jacket:depop'), 'zero views must use the parent kind/site curve immediately');
  assert.ok(cold.some(b => b.minute >= 1440 && b.basis === 'views'), 'one view can inform cadence; no evidence-count gate');
});

test('monthly hazard budget survives daily watcher restarts and slows the lowest-hazard account first', async () => {
  const r = await hazardWeek(true, { days: 31, restart: true, budget: 90 });
  for (const month of ['2026-11', '2026-12']) {
    const calls = r.calls.filter(c => new Date(start + c.minute * 60000).toISOString().startsWith(month));
    assert.ok(calls.length <= r.budget, `${month} exceeded its budget`);
  }
  assert.ok(r.calls.filter(c => c.account_id === 'z_hot').length > r.calls.filter(c => c.account_id === 'a_stale').length);
});

test("Nate's Mercari rule: wants, follows and matches never sweep; only the person's own linked account is read", async () => {
  for (const linked of [false, true]) {
    const rig = smallRig(async () => ({ ok: true, data: [] }));
    rig.store.put('want', { id: 'want_mercari', user_id: 'usr_walk', site: 'mercari', query: 'fixture jacket' });
    rig.store.put('match', { id: 'match_mercari', user_id: 'usr_walk', site: 'mercari', want_id: 'want_mercari' });
    const mercari = { account_id: 'acc_mercari', person_id: 'usr_walk', site: 'mercari' as const, token_ref: 'fixture' };
    const calls: { site: string; verb: string; account_id: unknown }[] = [];
    const watcher = createWatcher({ ...rig,
      accounts: { async linked() { return linked ? [mercari] : []; }, async byId(id) { return linked && id === mercari.account_id ? mercari : undefined; } },
      harness: { async call<T>(site: Site, verb: Verb, args: CallArgs = {}) {
        calls.push({ site, verb, account_id: args.account_id });
        return { ok: true, data: [] as T, meta: { route_id: 'fake.mercari', adapter_version: 'fixture', ms: 0, fell_back: false, observation_ids: [] } };
      } },
    });
    for (let minute = 0; minute < 1440; minute++) { await watcher.tick(); rig.advance(60000); }
    if (!linked) assert.equal(calls.length, 0, 'a buy-side want cannot create a Mercari account sweep');
    else {
      assert.ok(calls.length > 0);
      assert.ok(calls.every(c => c.site === 'mercari' && c.account_id === mercari.account_id && c.verb.startsWith('read_')));
    }
  }
});


// Durable jobs in the adapter/retry tests already carry the watcher's negotiation result.
function decidedFixture() {
  const limits = { ask_cents: 6000, floor_cents: 4500, always_accept_cents: 5800 };
  const result = decide({ ...limits, site: 'depop', offer_cents: 5900, keep: price => keep('depop', price).keep_cents,
    v_wait_cents: null, trust_block: false }, pAccept);
  return { ...limits, decided_by: 'negotiation', price_cents: result.amount_cents, negotiation_ask: result.ask };
}

for (const kind of ['post', 'delist', 'answer_offer', 'send_message', 'make_offer'] as const) {
  test(`${kind} cannot write without a watcher negotiation result even with an approved policy`, async () => {
    const rig = smallRig(async () => ({ ok: true, data: [] }));
    const stamp = new Date(start).toISOString();
    const event = rig.store.insertEvent({ user_id: 'usr_walk', source: 'app', action: 'app.list', actor: 'user', site: 'depop',
      account_id: 'acc_depop', dedupe_key: kind, trace_id: 'guard', observed_at: stamp, effective_at: stamp, payload: {} }).row;
    rig.store.insertJob({ kind, user_id: 'usr_walk', account_id: 'acc_depop', site: 'depop', args: { slug: 'fixture' },
      event_id: event.id, idempotency_key: kind, state: 'queued', stages: [], attempts: 0, trace_id: 'guard', created_at: stamp });
    await rig.watcher.tick(); assert.deepEqual(rig.calls.filter(v => writeVerbs.has(v)), []);
    assert.equal(rig.store.decisions({ kind: 'offer_to_likers', state: 'open' }).length, 1);
  });
}

test('watcher passes cadenceOf the current snapshot instead of using a fixed tier', async () => {
  const rig = smallRig(async a => ({ ok: true, data: a.verb === 'read_listings' ? [live] : [] }));
  const watcher = createWatcher({ ...rig, cadenceOf: (account, snapshot) => {
    assert.equal(account.account_id, 'acc_depop'); assert.equal(snapshot, rig.snapshots.get('acc_depop')); return 17;
  } });
  await watcher.tick(); rig.advance(16999); await watcher.tick(); assert.equal(rig.calls.filter(v => v === 'read_listings').length, 1);
  rig.advance(1); await watcher.tick(); assert.equal(rig.calls.filter(v => v === 'read_listings').length, 2);
});

for (const patch of [{ price_cents: 4400 }, { price_cents: 6001 }, { floor_cents: NaN }, { ask_cents: NaN }, { negotiation_ask: true }]) {
  test(`a marked negotiation write still refuses invalid limits: ${Object.keys(patch).join()}:${Object.values(patch).join()}`, async () => {
    const rig = smallRig(async () => ({ ok: true, data: [] }));
    const at = new Date(start).toISOString();
    ingest(rig.store, rig.log, { user_id: 'usr_walk', source: 'app', site: 'depop', account_id: 'acc_depop', action: 'app.delist', item_id: 'it_walk', actor: 'auto',
      dedupe_key: 'bad-limits', trace_id: 'guard', observed_at: at, effective_at: at, payload: { ...decidedFixture(), ...patch, slug: 'fixture' } });
    await rig.watcher.tick(); assert.deepEqual(rig.calls.filter(v => writeVerbs.has(v)), []);
  });
}

for (const outcome of [
  { settle: 'later' as const, after_s: 60 },
  { settle: 'fail' as const, err: { code: 'page_changed', message: 'fixture parser change' } },
]) test(`pipeline settles the engine's ${outcome.settle} outcome instead of done`, async () => {
  const rig = smallRig(async () => ({ ok: true, data: [] })); const job = queueRead(rig, 'usr_walk', 'acc_depop', 'poll_orders');
  const pipeline = createPipeline({ ...rig, worker: 'test', engines: { poll_orders: () => outcome } });
  await pipeline.runOnce(1);
  assert.equal(rig.store.getJob(job.id)?.state, outcome.settle === 'later' ? 'queued' : 'failed');
  if (outcome.settle === 'fail') assert.equal(rig.store.getJob(job.id)?.error?.code, 'page_changed');
  else assert.equal((rig.store.getJob(job.id) as JobRow & { next_run_at: string }).next_run_at, new Date(start + 60000).toISOString());
});


test('a scarce monthly slot goes to the highest hazard even when both intervals clamp to the maximum', async () => {
  const r = await hazardWeek(true, { days: 1, budget: 1 });
  assert.deepEqual(r.calls.map(c => c.account_id), ['z_hot']);
});

test('a queued offer reply rechecks the current floor after a rate-limited first attempt', async () => {
  let offered = false;
  const rig = smallRig(async a => a.verb === 'answer_offer' ? fail('rate_limited', 'retry', { do: 'retry_after', after_s: 60 })
    : { ok: true, data: a.verb === 'read_listings' ? [live] : a.verb === 'read_offers' && offered
      ? [{ external_id: 'fresh-limit', listing_external_id: 'ext', amount_cents: 5900, state: 'open' }] : [] });
  await rig.watcher.tick(); offered = true; rig.advance(900000); await rig.watcher.tick();
  assert.equal(rig.calls.filter(v => v === 'answer_offer').length, 1);
  rig.limits.of = () => ({ ask_cents: 6500, floor_cents: 6000, always_accept_cents: 6200 });
  rig.advance(60000); await rig.watcher.tick();
  assert.equal(rig.calls.filter(v => v === 'answer_offer').length, 1, 'captured limits cannot override the current floor');
  assert.equal(rig.store.decisions({ kind: 'price_below_floor', state: 'open' }).length, 1);
});


function saleRig(storage: Store = memoryStore(), price_cents = 5900, noLimits = false) {
  let sold = false;
  const rig = smallRig(async () => ({ ok: true, data: [] }), {}, { store: storage });
  const listings = ['sold', 'live', 'posting', 'delistFailed'].map((state, i) => ({
    listing_id: i === 0 ? 'listing_depop' : `listing_${state}`, item_id: 'it_walk', site: 'depop' as const,
    account_id: 'acc_depop', external_id: i === 0 ? 'ext' : state, state: i === 0 ? 'live' : state,
  }));
  const ended: unknown[] = [];
  const deps: WatcherDeps = { ...rig,
    limits: { of: () => noLimits ? undefined : rig.limits.of() },
    listings: { byExternal: (_u, _s, ext) => listings.find(l => l.external_id === ext), ofItem: () => listings },
    harness: { async call<T>(_site: Site, verb: Verb, args: CallArgs = {}) {
      if (verb === 'end') ended.push(args.listing_id);
      const data = verb === 'read_listings' ? listings.map((l, i) => ({ external_id: l.external_id,
        state: i === 0 && sold ? 'sold' : l.state, price_cents: 6000, slug: `slug-${l.external_id}` }))
        : verb === 'read_orders' && sold ? [{ external_order_id: 'confirmed_order', listing_external_id: 'ext', state: 'paid', price_cents }] : [];
      return { ok: true, data: data as T, meta: { route_id: 'fake.sale', adapter_version: 'fixture', ms: 0, fell_back: false, observation_ids: [] } };
    } },
  };
  return { ...rig, deps, ended, sell: () => { sold = true; }, watcher: createWatcher(deps) };
}

for (const [label, price, noLimits] of [['below floor', 1000, false], ['above ask', 7000, false], ['no limits', 5900, true]] as const) {
  test(`a confirmed sale with ${label} ends every other buyable listing without negotiation`, async () => {
    const r = saleRig(undefined, price, noLimits);
    await r.watcher.tick(); r.sell(); r.advance(900000); await r.watcher.tick();
    assert.deepEqual(r.ended.sort(), ['listing_delistFailed', 'listing_live', 'listing_posting']);
    const [order] = r.store.rows('order', { user_id: 'usr_walk' });
    assert.ok(order, 'confirmation must persist the order');
    assert.equal(order.fees_cents, null, 'missing fees remain unknown');
    for (const job of r.store.jobs({ kind: 'delist' })) {
      assert.equal(job.args.order_id, order.id, 'delist is authorized by the recorded order');
      assert.equal(job.args.sold_listing_id, 'listing_depop');
      assert.equal(job.args.decided_by, undefined, 'ending a sold item never asks negotiation');
    }
  });
}

test('confirmed orders survive fileStore reload with pending delists and a fresh watcher', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'watcher-orders-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'store.json'), r = saleRig(fileStore(path));
  await r.watcher.tick();
  r.store.put('account', { ...r.store.get('account', 'usr_walk', 'acc_depop')!, next_check_at: new Date(start + 900000).toISOString() });
  r.sell(); r.advance(900000); await r.watcher.tick();
  const recorded = r.store.rows('order', { user_id: 'usr_walk' });
  assert.equal(recorded.length, 1);
  const store = fileStore(path);
  for (const j of store.jobs({ kind: 'delist' })) store.updateJob(j.id, { state: 'queued', stages: [] });
  r.ended.length = 0;
  // Slugs normally come from the target account sweep; these jobs retain the read slug on restart.
  for (const j of store.jobs({ kind: 'delist' })) store.updateJob(j.id, { args: { ...j.args, slug: `slug-${j.args.external_id}` } });
  await createWatcher({ ...r.deps, store }).tick();
  assert.deepEqual(store.rows('order', { user_id: 'usr_walk' }), recorded);
  assert.equal(r.ended.length, 3, 'durable order authorizes the pending ends after restart');
});

test('a failed delist fan-out rolls back the confirmed order as well', async () => {
  const memory = memoryStore();
  const store: Store = { ...memory, tx: fn => memory.tx(t => fn({ ...t, insertJob(job) {
    if (job.kind === 'delist') throw new Error('delist insert failed');
    return t.insertJob(job);
  } })) };
  const r = saleRig(store);
  await r.watcher.tick(); r.sell(); r.advance(900000); await r.watcher.tick();
  assert.equal(store.jobs({ kind: 'poll_orders' }).some(j => j.error?.code === 'internal'), true, 'transaction failure must surface');
  assert.equal(store.rows('order', { user_id: 'usr_walk' }).length, 0, 'no order commits without its delist fan-out');
  assert.equal(store.jobs({ kind: 'delist' }).length, 0);
});

test('hot listings receive at least five times the stale reads over a day within the monthly budget', async () => {
  const r = await hazardWeek(true, { days: 1 });
  const hot = r.calls.filter(c => c.account_id === 'z_hot').length;
  const stale = r.calls.filter(c => c.account_id === 'a_stale').length;
  assert.ok(hot >= 5 * Math.max(1, stale), `hot ${hot}, stale ${stale}: budget must not serialize their sweeps`);
  assert.ok(r.calls.length <= r.budget);
});


async function twoListingDay(budget: number, ticks: number) {
  const r = smallRig(async () => ({ ok: true, data: [] }));
  const accounts = ['hot', 'stale'].map(id => ({ account_id: id, person_id: 'usr_walk', site: 'depop' as const, token_ref: 'fixture' }));
  const registry = paramStore();
  const calls: string[] = [];
  for (const a of accounts) {
    r.store.put('account', { id: a.account_id, user_id: a.person_id, site: a.site, next_check_at: new Date(start).toISOString() });
    r.snapshots.set(a.account_id, { site: a.site, account_id: a.account_id, user_id: a.person_id, route: 'signed_in', taken_at: new Date(start).toISOString(),
      listings: [{ external_id: a.account_id, state: 'live', price_cents: 6000 }], offers: a.account_id === 'hot'
        ? [{ external_id: 'offer', listing_external_id: 'hot', amount_cents: 5900, state: 'open' }] : [] });
  }
  const watcher = createWatcher({ ...r,
    cadenceParams: { ...registry, read(name, scope) { const value = registry.read(name, scope); return name === 'sweeps_per_person_month' ? { ...value, value: budget } : value; } },
    accounts: { async linked() { return accounts; }, async byId(id) { return accounts.find(a => a.account_id === id); } },
    listings: { byExternal: (_u, _s, id) => ({ listing_id: id, external_id: id, item_id: `it_${id}`, account_id: id, site: 'depop', state: 'live' }), ofItem: () => [] },
    limits: { of: () => undefined },
    hazard: l => ({ listing_id: l.listing_id, per_hour: l.offers?.some(o => o.state === 'open') ? 0.6 : 0.001, basis: 'd10', citation_id: 'd10:jacket:depop' }),
    harness: { async call<T>(_s: Site, verb: Verb, args: CallArgs = {}) {
      const id = String(args.account_id);
      if (verb === 'read_listings') calls.push(id);
      const snapshot = r.snapshots.get(id)!;
      const data = verb === 'read_listings' ? snapshot.listings : verb === 'read_offers' ? snapshot.offers : [];
      return { ok: true, data: data as T, meta: { route_id: 'fake.budget', adapter_version: 'fixture', ms: 0, fell_back: false, observation_ids: [] } };
    } },
  });
  for (let i = 0; i < ticks; i++) { await watcher.tick(); r.advance(60000); }
  return { calls, store: r.store };
}

test('a budget with room for both due accounts never serializes their first sweep', async () => {
  assert.deepEqual((await twoListingDay(1000000, 1)).calls.sort(), ['hot', 'stale']);
});

test('two listings: a live offer gets five times the stale reads over a day under 2000 per month', async () => {
  const { calls } = await twoListingDay(2000, 1440);
  const hot = calls.filter(id => id === 'hot').length, stale = calls.filter(id => id === 'stale').length;
  assert.ok(stale > 0, 'stale listing is still checked');
  assert.ok(hot >= stale * 5, `hot ${hot}, stale ${stale}`);
  assert.ok(calls.length <= 2000, 'day stays within the monthly budget');
});


test('delists carry the order just confirmed even when an older cancelled order names the same listing', async () => {
  const r = saleRig();
  r.store.put('order', { id: 'ord_old', user_id: 'usr_walk', kind: 'sale', item_id: 'it_walk', listing_id: 'listing_depop',
    site: 'depop', external_order_id: 'old', state: 'cancelled', price_cents: 1000, fees_cents: null, shipping_cents: 0, history: [] });
  await r.watcher.tick(); r.sell(); r.advance(900000); await r.watcher.tick();
  assert.equal(r.ended.length, 3, 'an older cancelled order must not shadow the confirmed paid order');
  for (const j of r.store.jobs({ kind: 'delist' })) assert.equal(j.args.order_id, 'ord_depop_confirmed_order');
});


test('repeated confirmations after restart keep persisting one order without a stale version', async () => {
  const r = saleRig();
  await r.watcher.tick(); r.sell(); r.advance(900000); await r.watcher.tick();
  const watcher = createWatcher(r.deps);
  const job = queueRead(r, 'usr_walk', 'acc_depop', 'poll_orders');
  await watcher.tick();
  assert.equal(r.store.getJob(job.id)?.state, 'done');
  r.store.updateJob(job.id, { state: 'queued', stages: [] });
  await watcher.tick();
  assert.equal(r.store.getJob(job.id)?.state, 'done', 'a cached Store version must not poison the next confirmation');
  assert.equal(r.store.rows('order', { user_id: 'usr_walk' }).length, 1);
});


test('projected overspend slows the lowest hazard before changing the hot interval', async () => {
  const { store } = await twoListingDay(17300, 1);
  const due = (id: string) => Date.parse(String(store.get('account', 'usr_walk', id)?.next_check_at)) - start;
  assert.equal(due('hot'), 150000, 'highest hazard keeps its own interval while lower hazards can absorb the overspend');
  assert.ok(due('stale') > 86400000, 'the lowest hazard absorbs the overspend first');
});

test('budget-slowed accounts become due again by the next month', async () => {
  const { store } = await twoListingDay(3, 1);
  const due = Date.parse(String(store.get('account', 'usr_walk', 'stale')?.next_check_at));
  assert.ok(due <= Date.UTC(2026, 11, 1), 'a new monthly budget must not inherit months of delay');
});


test('a fresh caller order book cannot overwrite a different durable order after restart', async () => {
  const r = saleRig();
  r.store.put('order', { id: 'ord_1', user_id: 'usr_walk', kind: 'sale', item_id: 'it_old', listing_id: 'listing_old',
    site: 'depop', external_order_id: 'old', state: 'paid', price_cents: 1000, fees_cents: null, shipping_cents: 0, history: [] });
  const orders = orderBook();
  const watcher = createWatcher({ ...r.deps, orders });
  await watcher.tick(); r.sell(); r.advance(900000); await watcher.tick();
  const rows = r.store.rows('order', { user_id: 'usr_walk' });
  assert.equal(rows.length, 2, 'ordinal ids from a fresh caller book must not replace an older order');
  assert.equal(r.store.get('order', 'usr_walk', 'ord_1')?.external_order_id, 'old');
  assert.equal(rows.find(o => o.external_order_id === 'confirmed_order')?.id, orders.all()[0]?.id);
});


test('confirm owns order persistence: each poll_orders job saves its order once', async () => {
  const r = saleRig(memoryStore());
  await r.watcher.tick(); r.sell(); r.advance(900000); await r.watcher.tick();
  const confirmations = r.store.jobs({ kind: 'poll_orders', state: 'done' });
  assert.ok(confirmations.length > 0);
  const rows = r.store.rows('order', { user_id: 'usr_walk' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].version, confirmations.length, "watcher must not persist confirm's order a second time");
});

for (const contextualPort of [true, false]) test(`two sites negotiate against newly observed listing prices (listing-aware port: ${contextualPort}), including the write-time check`, async () => {
  const r = smallRig(async () => ({ ok: true, data: [] }));
  const accounts = ['depop', 'poshmark'].map(site => ({ account_id: `acc_${site}`, person_id: 'usr_walk', site: site as Site, token_ref: 'fixture' }));
  const listings = accounts.map((a, i) => ({ listing_id: `listing_${a.site}`, item_id: 'it_walk', site: a.site,
    account_id: a.account_id, external_id: `ext_${a.site}`, state: 'live', price_cents: i === 0 ? 6000 : 8000 }));
  for (const a of accounts) r.store.put('account', { id: a.account_id, user_id: a.person_id, site: a.site, next_check_at: new Date(start).toISOString() });
  const contexts: string[] = [], writes: string[] = [];
  let offered = false;
  const watcher = createWatcher({ ...r,
    accounts: { async linked() { return accounts; }, async byId(id) { return accounts.find(a => a.account_id === id); } },
    listings: { byExternal: (_u, site, id) => listings.map(l => ({ ...l, price_cents: l.price_cents - 1000 })).find(l => l.site === site && l.external_id === id),
      ofItem: () => listings.map(l => ({ ...l, price_cents: l.price_cents - 1000 })) },
    limits: { of(_user, _item, listing) {
      if (listing) contexts.push(listing.listing_id);
      return { ask_cents: contextualPort ? listing?.price_cents ?? 5000 : 5000, floor_cents: 4500, always_accept_cents: 5800 };
    } },
    harness: { async call<T>(site: Site, verb: Verb) {
      const listing = listings.find(l => l.site === site)!;
      if (verb === 'answer_offer') writes.push(site);
      const data = verb === 'read_listings' ? [{ external_id: listing.external_id, price_cents: listing.price_cents, state: 'live' }]
        : verb === 'read_offers' && offered ? [{ external_id: `offer_${site}`, listing_external_id: listing.external_id, amount_cents: listing.price_cents - 100, state: 'open' }] : [];
      return { ok: true, data: data as T, meta: { route_id: 'fixture', adapter_version: 'fixture', ms: 0, fell_back: false, observation_ids: [] } };
    } },
  });
  await watcher.tick();
  offered = true; r.advance(900000); await watcher.tick();
  const offers = r.store.events().filter(e => e.action === 'offer.received');
  assert.equal(offers.length, 2);
  for (const listing of listings) {
    const event = offers.find(e => e.listing_id === listing.listing_id)!;
    assert.equal(event.payload?.ask_cents, listing.price_cents, 'negotiation used the item price instead of the site listing price');
    assert.equal(contexts.filter(id => id === listing.listing_id).length, 2, 'listing context must reach both decision and write-time limits');
  }
  assert.deepEqual(writes.sort(), ['depop', 'poshmark'], 'both offers are inside their own listing limits');
});


test('watcher resume resolves a linked row with its owner before writing', async () => {
  const rig = smallRig(async () => ({ ok: true, data: [] }));
  const account = (await rig.accounts.linked())[0];
  const lookups: (string | undefined)[] = [];
  const watcher = createWatcher({ ...rig, accounts: { async linked() { return [account]; }, async byId(id, person_id) {
    lookups.push(person_id); return id === account.account_id && person_id === account.person_id ? account : undefined;
  } } });
  await watcher.relinked(account.account_id);
  await watcher.cleared(account.account_id);
  assert.deepEqual(lookups, [account.person_id, account.person_id]);
  assert.deepEqual(rig.calls, []);
});


test("watcher: one person's account id under another person is refused", async () => {
  const seen: CallArgs[] = [];
  const rig = smallRig(async args => { seen.push(args); return { ok: true, data: [] }; });
  await rig.watcher.tick();
  assert.equal(seen.length, 4, 'the owner still reads all four sweep sections');
  assert.ok(seen.every(args => args.person_id === 'usr_walk'), 'sweeps carry the scheduled account owner');
  const before = seen.length;
  const wrong = queueRead(rig, 'usr_other');
  await rig.watcher.tick();
  assert.equal(seen.length, before, 'another person never reaches the account adapter');
  assert.ok((rig.store.getJob(wrong.id)?.result as { refused?: string }).refused);
  const own = queueRead(rig);
  await rig.watcher.tick();
  assert.equal(seen.length, before + 1, 'the owner still runs the queued read');
  assert.equal(seen.at(-1)?.person_id, 'usr_walk', 'jobs carry their own user_id');
  assert.equal(rig.store.getJob(own.id)?.state, 'done');
});
