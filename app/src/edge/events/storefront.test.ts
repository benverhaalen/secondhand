import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from './schedule.ts';
import { memoryLeases, memoryParams } from './ports.ts';
import { memoryAccounts, memoryVault, type LinkedAccount } from '../browser/auth.ts';
import { createHarness, fakeAdapter, fail } from '../harness/protocol.ts';
import type { StorefrontSnapshot } from '../harness/storefront.ts';

async function setup() {
  let time = 0; const vault = memoryVault(); await vault.put('ref', { cookies: [], origins: [] });
  const linked: LinkedAccount = { account_id: 'acc_1', person_id: 'usr_1', site: 'depop', token_ref: 'ref' };
  const accounts = memoryAccounts([linked], vault), snapshots: StorefrontSnapshot[] = [], sweeps: string[] = [], calls: string[] = [], stale: string[] = [];
  const leases = memoryLeases(() => time); let expired = false;
  const adapter = { ...fakeAdapter('depop', 'read_storefront'), async run() {
    calls.push('acc_1'); assert.equal(leases.take('acc_1', 'interleave', 100).ok, false);
    return expired ? fail('auth_expired', 'expired', { do: 'relink', site: 'depop' }) : { ok: true as const,
      data: { active_count: 2, sold_count: 1, orders: 1, gross_cents: 2000 } };
  } };
  const scheduler = createScheduler({ params: memoryParams({ watch_cadence_s: 900 }), leases, now: () => time,
    accounts: () => [ { account_id: 'acc_1', user_id: 'usr_1', site: 'depop' }, { account_id: 'unlinked', user_id: 'usr_1', site: 'depop' } ],
    stateOf: () => 'live', runSweep: async a => { sweeps.push(a.account_id); return { ok: true }; }, onStale: a => { stale.push(a.account_id); },
    storefront: { accounts, harness: createHarness({ adapters: [adapter], accounts }), store: { put: async row => { snapshots.push(row); } } } });
  return { scheduler, snapshots, sweeps, calls, stale, vault, advance: () => { time += 900_000; }, expire: () => { expired = true; } };
}
test('watcher tick reads and stores storefront only for due linked accounts, under the same lease', async () => {
  const s = await setup(); await s.scheduler.tick();
  assert.deepEqual(s.sweeps, ['acc_1']); assert.deepEqual(s.calls, ['acc_1']);
  assert.equal(s.snapshots[0].shop.active_count, 2);
  await s.scheduler.tick(); assert.equal(s.calls.length, 1);
  s.advance(); await s.scheduler.tick(); assert.equal(s.calls.length, 2);
});
test('unlink before next tick stops both watcher and storefront calls', async () => {
  const s = await setup(); await s.scheduler.tick(); await s.vault.delete('ref'); s.advance(); await s.scheduler.tick();
  assert.deepEqual(s.sweeps, ['acc_1']); assert.equal(s.calls.length, 1);
});
test('storefront auth expiry pauses account and raises stale once, with no further reads', async () => {
  const s = await setup(); s.expire(); await s.scheduler.tick(); s.advance(); await s.scheduler.tick();
  assert.deepEqual(s.stale, ['acc_1']); assert.deepEqual(s.scheduler.paused(), ['acc_1']); assert.equal(s.calls.length, 1);
});
