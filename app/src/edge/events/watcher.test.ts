import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWatcher, type WatcherDeps } from './watcher.ts';
import { decide, type OfferState } from '../../engines/negotiation/choose.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { orderBook } from '../orders/orders.ts';
import { memoryStore, memoryParams, memoryLeases } from './ports.ts';
import { ingest } from './intake.ts';
import { createHarness, fakeManifest, fail, type Adapter, type Verb } from '../harness/protocol.ts';
import type { Snapshot } from './event.ts';
import { createLog, memorySink } from '../../../../log/index.js';
import { week, atMinute, start, pAccept } from './fixtures/week.ts';
const requiresPAccept: undefined extends WatcherDeps['pAccept'] ? false : true = true;

test('seven days: limits, drafts, stale sessions, confirmed sale, quiet cadence and deterministic dedupe', async t => {
  const began = performance.now();
  const a = await week();
  const counts = (r: Awaited<ReturnType<typeof week>>) => ({ events: r.store.events().length, jobs: r.store.jobs().length,
    decisions: r.store.decisions().map(d => `${d.kind}:${d.state}`).sort(),
    sweeps: Object.fromEntries(['depop', 'poshmark', 'ebay'].map(site => [site, r.calls.filter(c => c.site === site && c.verb === 'read_offers').length])),
    calls: Object.fromEntries([...new Set(r.calls.map(c => `${c.site}:${c.verb}`))].sort().map(k => [k, r.calls.filter(c => `${c.site}:${c.verb}` === k).length])) });
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

function smallRig(run: Adapter['run'], overrides: Partial<Pick<WatcherDeps, 'pAccept' | 'orders'>> = {}) {
  let time = start;
  const now = () => time;
  const store = memoryStore(), log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  const account = { account_id: 'acc_depop', person_id: 'usr_walk', site: 'depop' as const, token_ref: 'fixture' };
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
