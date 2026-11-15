import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandoff } from './handoff.ts';
import { memoryAccounts, memoryVault } from '../../browser/auth.ts';
import { memoryLeases, memoryStore } from '../../events/ports.ts';
import { createLog } from '../../../../../log/index.js';

async function setup() {
  const vault = memoryVault(); await vault.put('ref', { cookies: [], origins: [] });
  const accounts = memoryAccounts([{ account_id: 'acc_1', person_id: 'usr_1', site: 'depop', token_ref: 'ref' }], vault);
  const store = memoryStore(), leases = memoryLeases(() => 0), lines: unknown[] = [];
  const log = createLog({ src: 'test', build: 'test', sink: line => { lines.push(line); } });
  let launches = 0, closes = 0, loads = 0, phoneReads = 0, refreshed = 0;
  let time = 0, expireProbe = false;
  let status: 'ok' | 'blocked' | 'auth_expired' = 'ok';
  const ctx = { live_url: 'https://example.invalid/private-view', newPage: async () => ({ close: async () => {}, goto: async () => {} }), onClose() {},
    close: async () => { closes++; }, loadState: async () => { loads++; }, exportState: async () => ({ cookies: [], origins: [] }) };
  const handoff = createHandoff({ accounts, vault, store, leases, log, now: () => time, profileRoot: '/tmp/test-profiles', leaseTtlMs: 1000,
    invalidatePool: async () => { refreshed++; },
    launcher: { persistent: async () => { launches++; return ctx; }, anonymous: async () => { throw new Error('wrong route'); } },
    readPhone: async () => { phoneReads++; return { cookies: [], origins: [] }; }, probe: async () => { if (expireProbe) time = 1001; return status; } });
  const input = { person_id: 'usr_1', account_id: 'acc_1', handoff_id: 'ho_1', go: ['depop'] as const };
  return { handoff, input, store, vault, leases, lines, expireDuringProbe: () => { expireProbe = true; }, refreshed: () => refreshed, status: (s: typeof status) => { status = s; }, counts: () => ({ launches, closes, loads, phoneReads }) };
}
test('dry by default and unlinked owner never opens or reads a session', async () => {
  const s = await setup();
  assert.equal((await s.handoff.start({ ...s.input, go: [] })).state, 'dry');
  assert.equal((await s.handoff.start({ ...s.input, person_id: 'other' })).state, 'not_linked');
  assert.deepEqual(s.counts(), { launches: 0, closes: 0, loads: 0, phoneReads: 0 });
});
test('session moves through Launcher and vault, releases lease, repeated handoff does not relaunch', async () => {
  const s = await setup();
  assert.equal((await s.handoff.start(s.input)).state, 'ok');
  assert.equal((await s.handoff.start(s.input)).state, 'ok');
  assert.deepEqual(s.counts(), { launches: 1, closes: 1, loads: 1, phoneReads: 1 });
  assert.equal(s.leases.take('acc_1', 'next', 1000).ok, true);
});
test('one prompt: two site challenges wait on one decision; only the person clears the check', async () => {
  const s = await setup(); s.status('blocked');
  const first = await s.handoff.start(s.input);
  assert.equal(first.state, 'paused');
  assert.equal((await s.handoff.start(s.input)).state, 'paused');
  s.store.tx(t => t.updateDecision(first.decision_id!, { state: 'answered' }));
  assert.equal((await s.handoff.resume(s.input)).state, 'paused');
  assert.equal(s.store.tx(t => t.decisions({ user_id: 'usr_1' })).length, 1);
  assert.equal(s.counts().closes, 0);
  assert.equal(await s.handoff.liveView('other', first.session_id!), undefined);
  assert.equal(await s.handoff.liveView('usr_1', first.session_id!), 'https://example.invalid/private-view');
  s.status('ok'); assert.equal((await s.handoff.resume(s.input)).state, 'ok');
  assert.equal(s.counts().closes, 1); assert.equal(s.refreshed(), 1);
  assert.equal(JSON.stringify(s.lines).includes('private-view'), false);
});
test('failure marks account_stale, retains phone state and jobs, and releases resources', async () => {
  const s = await setup(); s.status('auth_expired');
  const job = s.store.insertJob({ kind: 'post', user_id: 'usr_1', account_id: 'acc_1', event_id: 'evt_1', idempotency_key: 'post:1', args: {}, state: 'running', stages: [{ name: 'post', state: 'arrived' }], attempts: 2, trace_id: 'tr_1', created_at: '2026-11-15T00:00:00Z' }).row;
  assert.equal((await s.handoff.start(s.input)).state, 'account_stale');
  assert.ok(await s.vault.get('ref'));
  const kept = s.store.getJob(job.id)!;
  assert.equal(kept.paused, 'account_stale'); assert.equal(kept.attempts, 2); assert.equal(kept.stages.length, 1); assert.equal(kept.state, 'queued');
  assert.equal(s.counts().closes, 1);
  assert.equal(s.store.tx(t => t.decisions({ user_id: 'usr_1', kind: 'relink' })).length, 1);
  assert.equal(s.leases.take('acc_1', 'next', 1000).ok, true);
});

test('probe crossing the lease deadline cannot publish storage or refresh the pool', async () => {
  const s = await setup(); s.expireDuringProbe();
  assert.equal((await s.handoff.start(s.input)).state, 'account_stale');
  assert.equal(s.refreshed(), 0); assert.equal(s.counts().closes, 1);
});
