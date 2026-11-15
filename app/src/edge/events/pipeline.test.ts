import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryStore, fakeHarness, memoryLeases, memoryParams } from './ports.ts';
import type { HarnessLike, JobRow } from './ports.ts';
import type { Actor, EventKind, Site } from './event.ts';
import { createPipeline, HANDLERS, WRITE_VERBS } from './pipeline.ts';
import { poshmarkAdapters } from '../harness/sites/poshmark/adapter.ts';
import { depopAdapters } from '../harness/sites/depop/adapter.ts';

const meta = { route_id: 'fake', ms: 0, fell_back: false };
const ok = (data: unknown = {}) => ({ ok: true as const, data, meta });
const err = (code: string, hint: Record<string, unknown> & { do: string }, message = code) => ({ ok: false as const, error: { code, message, hint }, meta });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

let seq = 0;
function rig(o: { scripts?: Parameters<typeof fakeHarness>[0]; delay?: number; harness?: HarnessLike; engines?: Record<string, (j: JobRow) => unknown>; promoted?: Set<string>; onStale?: (j: JobRow, e: unknown) => void } = {}) {
  const store = memoryStore();
  const sink = memorySink();
  const log = createLog({ src: 'test', build: 't', sink });
  const fh = fakeHarness(o.scripts, o.delay);
  const t = { now: 1_000_000 };
  const leases = memoryLeases(() => t.now);
  const params = memoryParams({ job_lease_ttl_ms: 60_000 });
  const mk = () => createPipeline({
    store, harness: o.harness ?? fh, leases, params, log, engines: (o.engines ?? {}) as never, now: () => t.now, worker: 'w1',
    promoted: () => o.promoted ?? new Set(), onStale: o.onStale,
  });
  const job = (kind: string, action: EventKind, actor: Actor, args: Record<string, unknown> = {}, extra: Partial<JobRow> & { site?: Site } = {}) => {
    const n = ++seq;
    const ev = store.insertEvent({ user_id: 'u1', source: 'app', site: 'ebay', account_id: 'a1', action, item_id: 'i1', dedupe_key: `d${n}`, actor, observed_at: 'x', effective_at: 'x', trace_id: 't' }).row;
    return store.insertJob({ kind: kind as never, user_id: 'u1', event_id: ev.id, idempotency_key: `d${n}`, site: 'ebay', account_id: 'a1', item_id: 'i1', args, state: 'queued', stages: [], attempts: 0, trace_id: 't', created_at: 'x', ...extra }).row;
  };
  return { store, sink, fh, t, leases, pipe: mk(), mk, job };
}
const posts = (fh: { calls: { verb: string }[] }) => fh.calls.filter(c => c.verb === 'post');

test('policy: system-started post with no promotion is refused, the decision raised, nothing sent', async () => {
  const r = rig();
  const j = r.job('post', 'app.list', 'auto');
  await r.pipe.runOnce(5);
  const d = r.store.decisions({ user_id: 'u1' });
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, 'first_post');
  assert.equal(d[0].subject, 'i1');
  assert.equal(r.fh.calls.length, 0);
  const done = r.store.getJob(j.id)!;
  assert.equal(done.state, 'done');
  assert.deepEqual(done.result, { refused: d[0].id });
  assert.match(r.sink.text(), /decision\.open/);
});

test('policy: the person tap acts, with operation_id = job:stage', async () => {
  const r = rig();
  const j = r.job('post', 'app.list', 'user');
  await r.pipe.runOnce(5);
  assert.equal(posts(r.fh).length, 1);
  assert.equal(r.fh.calls[0].args.operation_id, `${j.id}:post`);
  assert.equal(r.store.getJob(j.id)!.state, 'done');
});

test('policy: a promoted kind acts, a price below the floor still asks', async () => {
  const r = rig({ promoted: new Set(['first_post', 'markdown', 'price_below_floor']) });
  r.job('post', 'app.list', 'auto');
  r.job('post', 'app.reprice', 'auto', { price_cents: 4000, floor_cents: 5000 }, { item_id: 'i2', account_id: 'a2' });
  await r.pipe.runOnce(5);
  assert.deepEqual(r.fh.calls.map(c => c.verb), ['post']);
  assert.equal(r.store.decisions()[0].kind, 'price_below_floor');
});

test('policy: a handoff-only kind (move_off_site) is refused with no decision and no call', async () => {
  const r = rig();
  const j = r.job('send_message', 'app.message', 'auto', { decision_kind: 'move_off_site' });
  await r.pipe.runOnce(5);
  assert.equal(r.fh.calls.length, 0);
  assert.equal(r.store.decisions().length, 0);
  assert.equal((r.store.getJob(j.id)!.result as { refused: string }).refused, 'never');
});

test('durable: a worker that died mid-write is never replayed; reconcile settles it', async () => {
  let n = 0;
  const r = rig({ scripts: {
    'ebay:post': () => (++n === 1 ? new Promise(() => {}) as never : ok()),
    'ebay:read_listings': () => ok({ landed: true }),
  } });
  const j = r.job('post', 'app.list', 'user');
  void r.pipe.runOnce(1); // the worker that will die
  await sleep(10);
  assert.equal(r.store.getJob(j.id)!.stages.find(s => s.name === 'post')!.state, 'started');
  r.store.release(j.id); r.store.updateJob(j.id, { state: 'queued' }); // the claim expired
  await r.mk().runOnce(1);
  assert.equal(posts(r.fh).length, 1);
  assert.equal(r.store.getJob(j.id)!.state, 'done');
  assert.equal(r.store.getJob(j.id)!.stages.find(s => s.name === 'post')!.state, 'arrived');
  const rb = r.fh.calls.find(c => c.verb === 'read_listings')!;
  assert.equal(rb.args.operation_id, `${j.id}:post`);
});

test('durable: reconcile that cannot confirm fails the job outcome_unknown, still one post, decision raised', async () => {
  let n = 0;
  const r = rig({ scripts: { 'ebay:post': () => (++n === 1 ? new Promise(() => {}) as never : ok()), 'ebay:read_listings': () => ok({ landed: false }) } });
  const j = r.job('post', 'app.list', 'user');
  void r.pipe.runOnce(1);
  await sleep(10);
  r.store.release(j.id); r.store.updateJob(j.id, { state: 'queued' });
  await r.mk().runOnce(1);
  assert.equal(posts(r.fh).length, 1);
  const f = r.store.getJob(j.id)!;
  assert.equal(f.state, 'failed');
  assert.equal(f.error!.code, 'outcome_unknown');
  assert.equal(r.store.decisions()[0].kind, 'failed_post');
});

test('durable: an arrived stage is never run again on resume', async () => {
  const r = rig();
  const j = r.job('post', 'app.list', 'user');
  r.store.updateJob(j.id, { stages: [{ name: 'post', state: 'arrived', result: { id: 'x' } }] });
  await r.pipe.runOnce(1);
  assert.equal(r.fh.calls.length, 0);
  assert.equal(r.store.getJob(j.id)!.state, 'done');
});

test('errors: auth_expired pauses the job (not failed) and calls onStale; next run leaves it', async () => {
  const stale: string[] = [];
  const r = rig({ scripts: { 'ebay:read_inbox': () => err('auth_expired', { do: 'relink' }) }, onStale: (j, e) => { stale.push(`${j.id}:${(e as { code: string }).code}`); } });
  const j = r.job('poll_inbox', 'message.received', 'site');
  await r.pipe.runOnce(5);
  const p = r.store.getJob(j.id)!;
  assert.equal(p.paused, 'account_stale');
  assert.equal(p.state, 'queued');
  assert.deepEqual(stale, [`${j.id}:auth_expired`]);
  await r.pipe.runOnce(5);
  assert.equal(r.fh.calls.length, 1);
});

test('errors: rate_limited requeues with next_run_at after_s and waits', async () => {
  let limited = true;
  const r = rig({ scripts: { 'ebay:read_orders': () => (limited ? err('rate_limited', { do: 'retry_after', after_s: 30 }) : ok()) } });
  const j = r.job('poll_orders', 'order.updated', 'site');
  await r.pipe.runOnce(5);
  const q = r.store.getJob(j.id) as JobRow & { next_run_at?: string };
  assert.equal(q.state, 'queued');
  assert.equal(q.next_run_at, new Date(r.t.now + 30_000).toISOString());
  await r.pipe.runOnce(5); // too early
  assert.equal(r.fh.calls.length, 1);
  limited = false; r.t.now += 31_000;
  await r.pipe.runOnce(5);
  assert.equal(r.store.getJob(j.id)!.state, 'done');
});

test('errors: blocked fails the job and raises site_warning', async () => {
  const r = rig({ scripts: { 'ebay:read_inbox': () => err('blocked', { do: 'pause_session' }) } });
  const j = r.job('poll_inbox', 'message.received', 'site');
  await r.pipe.runOnce(5);
  assert.equal(r.store.getJob(j.id)!.state, 'failed');
  assert.equal(r.store.getJob(j.id)!.error!.code, 'blocked');
  assert.equal(r.store.decisions()[0].kind, 'site_warning');
});

test('errors: policy_refused from the harness raises the hinted decision', async () => {
  const r = rig({ scripts: { 'ebay:post': () => err('policy_refused', { do: 'raise_decision', kind: 'agent_revision' }) } });
  const j = r.job('post', 'app.list', 'user');
  await r.pipe.runOnce(5);
  const d = r.store.decisions()[0];
  assert.equal(d.kind, 'agent_revision');
  assert.deepEqual(r.store.getJob(j.id)!.result, { refused: d.id });
});

test('errors: not_found starts a reconcile job and fails this one with the code', async () => {
  const r = rig({ scripts: { 'ebay:end': () => err('not_found', { do: 'reconcile' }) } });
  const j = r.job('delist', 'app.delist', 'user');
  await r.pipe.runOnce(5);
  assert.equal(r.store.getJob(j.id)!.error!.code, 'not_found');
  assert.equal(r.store.jobs({ kind: 'reconcile' }).length, 1);
  await r.pipe.runOnce(5); // the reconcile job runs once; a repeat does not make a second
  assert.equal(r.store.jobs({ kind: 'reconcile' }).length, 1);
});

test('errors: page_changed on a read fails with the code', async () => {
  const r = rig({ scripts: { 'ebay:read_listings': () => err('page_changed', { do: 'author' }) } });
  const j = r.job('reconcile', 'listing.ended', 'site');
  await r.pipe.runOnce(5);
  assert.equal(r.store.getJob(j.id)!.state, 'failed');
  assert.equal(r.store.getJob(j.id)!.error!.code, 'page_changed');
});

test('engines: a missing engine fails no_engine and logs it; a present one runs', async () => {
  const r = rig({ engines: { valuate: j => ({ valued: j.id }) } });
  const a = r.job('measure', 'value_moved', 'auto', {}, { account_id: undefined });
  const b = r.job('valuate', 'value_moved', 'auto', {}, { account_id: undefined });
  await r.pipe.runOnce(5);
  assert.equal(r.store.getJob(a.id)!.state, 'failed');
  assert.equal(r.store.getJob(a.id)!.error!.code, 'no_engine');
  assert.match(r.sink.text(), /no_engine/);
  assert.deepEqual(r.store.getJob(b.id)!.result, { valued: b.id });
});

test('handlers: every product.md §4 job kind and the four NEW ones has a handler', () => {
  const kinds = ['capture_judge', 'defect_propose', 'folder_group', 'measure', 'identify', 'studio', 'valuate', 'draft', 'post', 'delist', 'share',
    'promote_spend', 'end_unsold', 'send_message', 'poll_inbox', 'label', 'poll_orders', 'watch_run', 'search', 'assist', 'poll_stats',
    'route_probe', 'adapter_author', 'param_fold', 'import', 'unlink', 'reconcile', 'check_due', 'observe_rank', 'fit_ranker', 'score',
    'run_experiment', 'market_refresh', 'notify_follow', 'export_user', 'delete_user', 'answer_offer', 'make_offer', 'sweep', 'relink'];
  for (const k of kinds) assert.equal(typeof HANDLERS[k], 'function', k);
  assert.deepEqual([...WRITE_VERBS].sort(), ['answer_offer', 'end', 'make_offer', 'post', 'relist', 'revise', 'save', 'send_message']);
});

test('verbs: each own job kind runs its product.md §6 harness verb', async () => {
  const rows: [string, EventKind, Record<string, unknown>, string][] = [
    ['post', 'app.list', {}, 'post'], ['post', 'app.reprice', { price_cents: 6000, floor_cents: 5000 }, 'revise'], ['post', 'app.relist', {}, 'relist'],
    ['delist', 'app.delist', {}, 'end'], ['send_message', 'app.message', {}, 'send_message'], ['answer_offer', 'app.offer', {}, 'answer_offer'],
    ['make_offer', 'app.offer', {}, 'make_offer'], ['poll_orders', 'order.updated', {}, 'read_orders'], ['poll_inbox', 'message.received', {}, 'read_inbox'],
    ['reconcile', 'listing.ended', {}, 'read_listings'],
  ];
  for (const [kind, action, args, verb] of rows) {
    const r = rig();
    const j = r.job(kind, action, 'user', args);
    await r.pipe.runOnce(1);
    assert.equal(r.fh.calls[0]?.verb, verb, `${kind}/${action}`);
    assert.equal(r.store.getJob(j.id)!.state, 'done', kind);
  }
});

test('relink: stale raises one relink decision; relinked resumes the paused jobs', async () => {
  const r = rig();
  const paused = r.job('poll_inbox', 'message.received', 'site');
  r.store.updateJob(paused.id, { paused: 'account_stale' });
  r.job('relink', 'account_stale', 'site');
  await r.pipe.runOnce(5);
  assert.equal(r.store.decisions()[0].kind, 'relink');
  assert.equal(r.store.getJob(paused.id)!.paused, 'account_stale');
  r.job('relink', 'account_relinked', 'user');
  await r.pipe.runOnce(5);
  assert.equal(r.store.getJob(paused.id)!.paused, undefined);
  assert.equal(r.store.decisions()[0].state, 'answered');
});

test('lease: 20 jobs over 5 accounts run in parallel across accounts, never two at once in one account', async () => {
  const D = 40;
  const inner = fakeHarness({}, D);
  const inflight: Record<string, number> = {}; let maxPer = 0, maxAll = 0, all = 0;
  const harness: HarnessLike = { async call(s, v, a) {
    const acc = String(a?.account_id); all++; inflight[acc] = (inflight[acc] ?? 0) + 1;
    maxPer = Math.max(maxPer, inflight[acc]); maxAll = Math.max(maxAll, all);
    try { return await inner.call(s, v, a); } finally { inflight[acc]--; all--; }
  } };
  const r = rig({ harness });
  for (let i = 0; i < 20; i++) r.job('poll_inbox', 'message.received', 'site', {}, { account_id: `acc${i % 5}`, item_id: undefined });
  const t0 = Date.now();
  await r.pipe.runOnce(20);
  const first = Date.now() - t0;
  assert.equal(r.store.jobs({ state: 'done' }).length, 5); // one per account; the busy rest stay queued
  assert.ok(first < D * 3, `first round took ${first}ms`);
  while (r.store.jobs({ state: 'queued' }).length) await r.pipe.runOnce(20);
  const total = Date.now() - t0;
  assert.equal(r.store.jobs({ state: 'done' }).length, 20);
  assert.equal(maxPer, 1);
  assert.equal(maxAll, 5);
  assert.ok(total < D * 20 * 0.5, `drain took ${total}ms, serial would be ${D * 20}ms`);
});


for (const broken of ['missing', 'purchase', 'person', 'item', 'listing', 'cancelled'] as const) {
  test(`delist_after_sale refuses ${broken} confirmed order evidence`, async () => {
    const r = rig();
    if (broken !== 'missing') r.store.put('order', { id: 'ord_confirmed', user_id: broken === 'person' ? 'u2' : 'u1',
      kind: broken === 'purchase' ? 'purchase' : 'sale', item_id: broken === 'item' ? 'i2' : 'i1',
      listing_id: broken === 'listing' ? 'other' : 'sold', state: broken === 'cancelled' ? 'cancelled' : 'paid' });
    r.job('delist', 'app.delist', 'auto', { decision_kind: 'delist_after_sale', order_id: 'ord_confirmed', sold_listing_id: 'sold' }, { listing_id: 'target' });
    await r.pipe.runOnce(1);
    assert.equal(r.fh.calls.length, 0, 'a marker alone must never authorize an end');
  });
}

test('a confirmed sale authorizes an end independently of a negotiation price', async () => {
  const r = rig();
  r.store.put('order', { id: 'ord_confirmed', user_id: 'u1', kind: 'sale', item_id: 'i1', listing_id: 'sold', state: 'paid' });
  r.job('delist', 'app.delist', 'auto', { decision_kind: 'delist_after_sale', order_id: 'ord_confirmed', sold_listing_id: 'sold',
    price_cents: 1000, floor_cents: 4500 }, { listing_id: 'target' });
  await r.pipe.runOnce(1);
  assert.deepEqual(r.fh.calls.map(c => c.verb), ['end']);
});

const offlineClient = { signed_in: true,
  async doc(): Promise<never> { throw new Error('dry write must not fetch a page'); },
  async json(): Promise<never> { throw new Error('dry write must not fetch JSON'); },
};
for (const [site, kind, action, verb, decision_kind, args] of [
  ['poshmark', 'delist', 'app.delist', 'end', 'delist_after_sale', { listing_external_id: 'fixture-listing', sold_listing_id: 'sold', order_id: 'ord_confirmed' }],
  ['depop', 'post', 'app.list', 'post', 'first_post', { listing: { description: 'Fixture jacket', pictures: ['fixture-photo'], department: 'menswear', product_type: 'tops', condition: 'used_good', brand_name: 'Acme', price_amount: 60, quantity: 1 } }],
  ['depop', 'send_message', 'app.message', 'send_message', 'reply_other', { thread_ref: 'fixture-thread', text: 'Fixture reply' }],
  ['depop', 'answer_offer', 'app.offer', 'answer_offer', 'accept_offer', { offer_id: 'fixture-offer', action: 'accept', received_at: '2026-11-15T00:00:00Z', now: '2026-11-15T00:01:00Z' }],
] as const) test(`real ${site} ${verb} dry plan never arrives or changes the listing and asks once per subject`, async () => {
  const adapter = (site === 'poshmark' ? poshmarkAdapters(offlineClient) : depopAdapters(offlineClient)).find(a => a.manifest.verb === verb)!;
  let calls = 0;
  const r = rig({ scripts: { [`${site}:${verb}`]: async a => {
    calls++;
    const result = await adapter.run(a, new AbortController().signal);
    assert.ok(result.ok, JSON.stringify(result));
    return { ...result, meta };
  } } });
  r.store.put('order', { id: 'ord_confirmed', user_id: 'u1', kind: 'sale', item_id: 'i1', listing_id: 'sold', state: 'paid' });
  r.store.put('listing', { id: 'target', user_id: 'u1', state: kind === 'post' ? 'draft' : 'live' });
  const before = r.store.get('listing', 'u1', 'target');
  const j = r.job(kind, action, kind === 'delist' ? 'auto' : 'user', { ...args, decision_kind }, { site, listing_id: 'target' });
  const events = r.store.events().length;
  await r.pipe.runOnce(1);
  const done = r.store.getJob(j.id)!;
  assert.equal(done.state, 'done');
  assert.equal(done.stages[0].state, 'planned', 'a dry write was reported as arrived');
  assert.deepEqual(done.result, { planned: true, plan: done.stages[0].result });
  assert.equal((done.stages[0].result as { dry: boolean }).dry, true);
  assert.deepEqual(r.store.get('listing', 'u1', 'target'), before);
  assert.equal(r.store.events().length, events, 'a plan must not emit a landed event');
  assert.equal(r.store.rows('order', { user_id: 'u1' }).length, 1, 'a plan must not create an order');
  const decisions = r.store.decisions({ state: 'open' });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].kind, decision_kind);
  assert.equal(decisions[0].subject, 'target');
  if (verb === 'end') assert.deepEqual(decisions[0].options.map(o => o.label), ['End it on the site', 'Not now']);
  r.store.updateJob(j.id, { state: 'queued', result: undefined });
  await r.mk().runOnce(1);
  assert.equal(calls, 1, 'resuming a planned stage must not replay its write');
  assert.deepEqual(r.store.getJob(j.id)!.result, done.result);
  r.job(kind, action, 'user', { ...args, decision_kind }, { site, listing_id: 'target' });
  await r.pipe.runOnce(1);
  assert.equal(r.store.decisions({ state: 'open' }).length, 1, 'repeat plans share one open decision');
});

test('a non-dry successful write still arrives without a handoff decision', async () => {
  const result = { dry: false, landed: true };
  const r = rig({ scripts: { 'ebay:post': () => ok(result) } });
  const j = r.job('post', 'app.list', 'user');
  await r.pipe.runOnce(1);
  assert.equal(r.store.getJob(j.id)!.stages[0].state, 'arrived');
  assert.deepEqual(r.store.getJob(j.id)!.result, result);
  assert.equal(r.store.decisions().length, 0);
});
