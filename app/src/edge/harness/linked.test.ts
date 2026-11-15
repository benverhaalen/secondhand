// Linked accounts only, end to end (spec/product.md "Added for the kernel"; Nate, product/words.md 2026-11-14):
// a planted unlinked site gets zero launches, zero sweeps, zero scheduled jobs and zero adapter runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryAccounts, memoryVault } from '../browser/auth.ts';
import { linkedList } from './linked.ts';
import { createPool, type Launcher } from '../browser/pool.ts';
import { createScheduler } from '../events/schedule.ts';
import { memoryLeases, memoryParams } from '../events/ports.ts';
import { SITES as EVENT_SITES } from '../events/event.ts';
import { sweepStorefronts } from './storefront.ts';
import { createHarness, fakeAdapter, type Site } from './protocol.ts';

async function world() {
  const vault = memoryVault();
  await vault.put('ref-depop', { cookies: [], origins: [] });
  const accounts = memoryAccounts([
    { account_id: 'a-depop', person_id: 'p1', site: 'depop', token_ref: 'ref-depop' },
    { account_id: 'a-mercari', person_id: 'p1', site: 'mercari' },  // planted: a row with no stored sign-in
  ], vault);
  const runs: string[] = [];
  const adapters = (['depop', 'mercari'] as Site[]).flatMap(site => (['read_storefront', 'read_listings', 'post'] as const).map(verb => {
    const a = fakeAdapter(site, verb);
    return { ...a, run: (x: Record<string, unknown>, s: AbortSignal) => { runs.push(`${site}.${verb}`); return a.run(x, s); } };
  }));
  return { vault, accounts, runs, harness: createHarness({ adapters, accounts }) };
}

test('harness: a call on an unlinked account runs no adapter', async () => {
  const { harness, runs } = await world();
  const e = await harness.call('mercari', 'read_listings', { account_id: 'a-mercari' });
  assert.ok(!e.ok && e.error.code === 'policy_refused' && e.error.hint.do === 'raise_decision' && e.error.hint.kind === 'link_account');
  const wrongSite = await harness.call('mercari', 'read_listings', { account_id: 'a-depop' });
  assert.ok(!wrongSite.ok, 'a linked account cannot be used on another site');
  assert.deepEqual(runs, []);
  assert.ok((await harness.call('depop', 'read_listings', { account_id: 'a-depop' })).ok);
  const none = await harness.call('depop', 'post', { operation_id: 'op-1' });
  assert.ok(!none.ok && none.error.code === 'policy_refused', 'a signed-in verb with no account is refused too');
  assert.deepEqual(runs, ['depop.read_listings']);
});

test('pool, sweep and scheduler: the planted site gets zero launches, zero sweeps, zero jobs', async () => {
  const { accounts, vault, harness, runs } = await world();
  const launched: string[] = [];
  const launcher: Launcher = {
    async persistent(dir) { launched.push(dir); return { newPage: async () => ({ close: async () => {} }), close: async () => {}, onClose() {} }; },
    async anonymous() { launched.push('anon'); return { newPage: async () => ({ close: async () => {} }), close: async () => {}, onClose() {} }; },
  };
  const pool = createPool({ leases: memoryLeases(), launcher, profileRoot: '/profiles', accounts, vault });
  await pool.warmLinked('p1', 0);
  assert.equal(launched.length, 1);
  assert.ok(launched[0].endsWith('a-depop'));

  await sweepStorefronts({ accounts, harness, store: { put: async () => {} }, person_id: 'p1' });
  assert.deepEqual(runs, ['depop.read_storefront']);

  const list = linkedList(accounts, EVENT_SITES, 'p1');
  await list.refresh();
  const swept: string[] = [];
  let now = 0;
  const scheduler = createScheduler({ params: memoryParams({ watch_cadence_s: 60 }), leases: memoryLeases(() => now), now: () => now,
    accounts: list.list, stateOf: () => 'live', runSweep: async a => { swept.push(a.site); return { ok: true }; }, onStale: () => {} });
  // New accounts start spread across the first cadence (9d1d4719): the first tick places the account, the clock then reaches its turn.
  await scheduler.tick(); now = scheduler.nextDue()['a-depop'];
  const tick = await scheduler.tick();
  assert.deepEqual(swept, ['depop']);
  assert.deepEqual(tick.ran, ['a-depop']);
});
