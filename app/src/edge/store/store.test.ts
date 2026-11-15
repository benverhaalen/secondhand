import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { manageListing, memoryOperations, type StoreInput, type StorePort } from './store.ts';
const at = '2026-11-15T12:00:00Z';
const sink = memorySink();
const log = createLog({ src: 'test.store', build: 'test', sink });
const input = (): StoreInput => ({ user_id: 'usr_1', item_id: 'it_1', listing_id: 'li_1', version: 1, site: 'depop', account_health: 'ok', state: 'live', ask_every_time: false, rules: { markdown: 'auto', relist: 'ask' }, site_approved: false, stale: { site: 'depop', age_days: 10, m_days: 10, price_cents: 6000, p50_cents: 5000, interest: 1, interest_median: 5, next_rung_cents: 5500, floor_cents: 4000, on_sites: ['depop'], best_sites: ['depop'], has_watchers_verb: false } });
function rig() {
  const calls: { operation_id: string; kind: string }[] = [];
  const port: StorePort = { apply: async (request) => { calls.push(request); return { external_id: request.kind === 'relist' ? 'new_id' : 'old_id', item_id: request.item_id, price_cents: request.price_cents, state: 'live' }; } };
  return { calls, port, operations: memoryOperations() };
}
test('D15 step: a stale price above p50 follows the next rung, dry by default', async () => {
  const r = rig(); const result = await manageListing(input(), r.port, r.operations, log);
  assert.equal(result.kind, 'dry'); assert.equal(result.step.kind, 'markdown');
  if (result.step.kind === 'markdown') assert.equal(result.step.price_cents, 5500);
  assert.deepEqual(r.calls, []);
});
test('floor: a rung below the floor asks and never calls a site', async () => {
  const r = rig(), x = input(); x.stale.next_rung_cents = 3500;
  const result = await manageListing(x, r.port, r.operations, log, { live: true });
  assert.equal(result.kind, 'decision'); assert.equal(result.step.kind, 'price_below_floor');
  assert.deepEqual(r.calls, []);
});
test('no duplicate: relist retries and concurrent workers share one operation and the item id', async () => {
  const r = rig(), x = input(); x.stale.price_cents = 5000; x.rules.relist = 'auto'; x.site_approved = true;
  const [a, b] = await Promise.all([manageListing(x, r.port, r.operations, log, { live: true }), manageListing(x, r.port, r.operations, log, { live: true })]);
  assert.equal(r.calls.length, 1); assert.equal(a.kind, 'applied'); assert.deepEqual(a, b);
  if (a.kind === 'applied') { assert.equal(a.result.item_id, 'it_1'); assert.equal(a.result.external_id, 'new_id'); }
});
test('live requires the site go and ask rules need explicit approval; Poshmark never auto-relists', async () => {
  const r = rig(), x = input();
  assert.equal((await manageListing(x, r.port, r.operations, log, { live: true })).kind, 'dry');
  x.site_approved = true; x.ask_every_time = true;
  assert.equal((await manageListing(x, r.port, r.operations, log, { live: true })).kind, 'decision');
  x.site = 'poshmark'; x.stale.site = 'poshmark'; x.stale.price_cents = 5000;
  assert.equal((await manageListing(x, r.port, r.operations, log, { live: true, approved: true })).kind, 'decision');
  assert.deepEqual(r.calls, []);
});
test('read-back mismatch is an error and a failed operation is not blindly repeated', async () => {
  const r = rig(), x = input(); x.site_approved = true;
  let count = 0;
  const bad: StorePort = { apply: async () => { count++; return { external_id: 'old_id', item_id: 'it_1', price_cents: 1, state: 'live' }; } };
  await assert.rejects(manageListing(x, bad, r.operations, log, { live: true }), /read.back/);
  await assert.rejects(manageListing(x, bad, r.operations, log, { live: true }), /read.back/);
  assert.equal(count, 1);
});
test('reserve, sold and unhealthy accounts never mutate; invalid age is rejected', async () => {
  const r = rig(), x = input(); x.stale.plan_choice = 'reserve';
  assert.equal((await manageListing(x, r.port, r.operations, log)).step.kind, 'none');
  x.stale.plan_choice = 'sell'; x.state = 'sold';
  assert.equal((await manageListing(x, r.port, r.operations, log)).step.kind, 'none');
  x.state = 'live'; x.stale.m_days = NaN;
  await assert.rejects(manageListing(x, r.port, r.operations, log), /m_days/);
});

after(() => { assert.deepEqual(checkLog([['store', sink.text()]]).problems, []); });
