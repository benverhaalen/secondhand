import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPoster, memoryOperations, type Target } from './post.ts';
import { createHarness, fakeAdapter, fail } from '../harness/protocol.ts';
import { createSessions, memoryLeaseStore } from '../harness/session.ts';
import { memoryAccounts, memoryVault } from '../browser/auth.ts';

const sessions = createSessions({ store: memoryLeaseStore(), now: () => 0 });
const target = (site: Target['site'] = 'depop'): Target => ({ site, account_id: `acc_${site}`, listing_id: `lst_${site}`,
  operation_id: `post:${site}:1`, listing: { site, title: 'Jacket', fields: {}, photo_ids: [], price_cents: 2500, missing: [], ready: true, decision: { kind: 'first_post', ask: true } },
  claim_check: { subject: `lst_${site}`, claims: [], verdict: 'pass', checker_version: 'test' } });
async function setup() {
  const vault = memoryVault();
  for (const site of ['depop', 'ebay'] as const) await vault.put(site, { cookies: [], origins: [] });
  const accounts = memoryAccounts(['depop', 'ebay'].map(site => ({ account_id: `acc_${site}`, person_id: 'usr_1', site: site as Target['site'], token_ref: site })), vault);
  const calls: string[] = [];
  const adapters = ['depop', 'ebay'].flatMap(site => {
    const a = fakeAdapter(site as Target['site'], 'post');
    return [{ ...a, async run() { calls.push(site); return { ok: true as const, data: { id: site } }; } },
      { ...fakeAdapter(site as Target['site'], 'read_listings'), async run() { return { ok: true as const, data: [{ id: site, operation_id: `post:${site}:1` }] }; } }];
  });
  return { accounts, calls, adapters };
}
test('dry by default: exact harness plan, no site calls even with first_post approval', async () => {
  const s = await setup(), post = createPoster({ sessions, ...s, harness: createHarness({ adapters: s.adapters }), operations: memoryOperations() });
  const [r] = await post({ person_id: 'usr_1', targets: [target()], approved: ['lst_depop'] });
  assert.equal(r.state, 'dry'); assert.deepEqual(s.calls, []);
  assert.equal(r.steps[0].verb, 'post');
  assert.equal(r.steps[0].args.operation_id, target().operation_id);
  assert.deepEqual(r.steps[0].args.listing, target().listing);
  assert.equal(r.steps[1].verb, 'read_listings');
});
test('one call posts every approved site; repeated operation never duplicates', async () => {
  const s = await setup(), post = createPoster({ sessions, ...s, harness: createHarness({ adapters: s.adapters }), operations: memoryOperations() });
  const input = { person_id: 'usr_1', targets: [target(), target('ebay')], approved: ['lst_depop', 'lst_ebay'], go: ['depop', 'ebay'] as const };
  assert.deepEqual((await post(input)).map(r => r.state), ['live', 'live']);
  await post(input); assert.deepEqual(s.calls.sort(), ['depop', 'ebay']);
});
test('first_post, readiness, proof and linked owner all gate a live post', async () => {
  const s = await setup(), post = createPoster({ sessions, ...s, harness: createHarness({ adapters: s.adapters }), operations: memoryOperations() });
  const base = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  for (const input of [ { ...base, approved: [] }, { ...base, person_id: 'other' },
    { ...base, targets: [{ ...target(), listing: { ...target().listing, ready: false } }] },
    { ...base, targets: [{ ...target(), claim_check: { ...target().claim_check, verdict: 'hold' as const } }] } ]) {
    assert.equal((await post(input))[0].state, 'postFailed');
  }
  assert.deepEqual(s.calls, []);
});
test('unknown outcome reconciles by operation_id once, including after a worker restart', async () => {
  const s = await setup(); let writes = 0, reads = 0;
  const write = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('outcome_unknown', 'interrupted', { do: 'reconcile', operation_id: target().operation_id }); } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { reads++; return { ok: true as const, data: [{ id: 'external_1', operation_id: target().operation_id }] }; } };
  const operations = memoryOperations(), harness = createHarness({ adapters: [write, read] });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await createPoster({ sessions, accounts: s.accounts, operations, harness })(input))[0].state, 'live');
  await createPoster({ sessions, accounts: s.accounts, operations, harness })(input);
  assert.equal(writes, 1); assert.equal(reads, 1);
});
test('unknown and absent stays posting, never automatically retries the write', async () => {
  const s = await setup(); let writes = 0;
  const a = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('outcome_unknown', 'interrupted', { do: 'reconcile', operation_id: target().operation_id }); } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return { ok: true as const, data: [] }; } };
  const post = createPoster({ sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [a, read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'posting'); await post(input); assert.equal(writes, 1);
});
test('operation storage is scoped to site and account even when caller reuses the operation id', async () => {
  const s = await setup(), post = createPoster({ sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: s.adapters }) });
  await post({ person_id: 'usr_1', targets: [target(), { ...target('ebay'), operation_id: target().operation_id }], approved: ['lst_depop', 'lst_ebay'], go: ['depop', 'ebay'] });
  assert.deepEqual(s.calls.sort(), ['depop', 'ebay']);
});
test('a pending post is read again when delayed site state arrives; write is never repeated', async () => {
  const s = await setup(); let visible = false, writes = 0;
  const write = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('outcome_unknown', 'pending', { do: 'reconcile', operation_id: target().operation_id }); } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return { ok: true as const, data: visible ? [{ id: 'new', operation_id: target().operation_id }] : [] }; } };
  const post = createPoster({ sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [write, read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'posting'); visible = true;
  assert.equal((await post(input))[0].state, 'live'); assert.equal(writes, 1);
});

test('post challenge pauses the session and asks the person, with no automatic retry', async () => {
  const s = await setup(), decisions: string[] = [];
  const guard = createSessions({ store: memoryLeaseStore(), now: () => 0, decide: d => { decisions.push(d.account_id); } });
  const a = { ...fakeAdapter('depop', 'post'), async run() { return fail('blocked', 'check', { do: 'pause_session', site: 'depop' }); } };
  const post = createPoster({ sessions: guard, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [a] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'paused');
  assert.equal(guard.state('acc_depop'), 'bot_check'); assert.deepEqual(decisions, ['acc_depop']);
});
test('a paused account rejects a new post operation until person resumes it', async () => {
  const s = await setup(); let writes = 0;
  const guard = createSessions({ store: memoryLeaseStore(), now: () => 0 });
  const a = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('blocked', 'check', { do: 'pause_session', site: 'depop' }); } };
  const post = createPoster({ sessions: guard, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [a] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  await post(input); await post({ ...input, targets: [{ ...target(), operation_id: 'second' }] });
  assert.equal(writes, 1);
});
test('a challenge during read-back also pauses and asks the person', async () => {
  const s = await setup(), decisions: string[] = [];
  const guard = createSessions({ store: memoryLeaseStore(), now: () => 0, decide: d => { decisions.push(d.account_id); } });
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return fail('blocked', 'check', { do: 'pause_session', site: 'depop' }); } };
  const post = createPoster({ sessions: guard, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [s.adapters[0], read] }) });
  assert.equal((await post({ person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] }))[0].state, 'paused');
  assert.deepEqual(decisions, ['acc_depop']);
});
test('auth expiry during read-back reconciles after relink without another post', async () => {
  const s = await setup(); let expired = true;
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() {
    return expired ? fail('auth_expired', 'sign in', { do: 'relink', site: 'depop' }) : { ok: true as const, data: [{ id: 'live', operation_id: target().operation_id }] };
  } };
  const post = createPoster({ sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [s.adapters[0], read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'posting'); expired = false;
  assert.equal((await post(input))[0].state, 'live'); assert.equal(s.calls.length, 1);
});
