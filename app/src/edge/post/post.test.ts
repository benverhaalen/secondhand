import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPoster, memoryOperations, type Target } from './post.ts';
import { createHarness, fakeAdapter, fail } from '../harness/protocol.ts';
import { createSessions, memoryLeaseStore } from '../harness/session.ts';
import { memoryStore, memoryLeases } from '../events/ports.ts';
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
      { ...fakeAdapter(site as Target['site'], 'read_listings'), async run() { return { ok: true as const, data: [{ id: site, title: 'Jacket', price_cents: 2500, posted_at: new Date(1000).toISOString() }] }; } }];
  });
  return { accounts, calls, adapters };
}
test('dry by default: exact harness plan, no site calls even with first_post approval', async () => {
  const s = await setup(), post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, ...s, harness: createHarness({ adapters: s.adapters }), operations: memoryOperations() });
  const [r] = await post({ person_id: 'usr_1', targets: [target()], approved: ['lst_depop'] });
  assert.equal(r.state, 'dry'); assert.deepEqual(s.calls, []);
  assert.equal(r.steps[0].verb, 'post');
  assert.equal(r.steps[0].args.operation_id, target().operation_id);
  assert.deepEqual(r.steps[0].args.listing, target().listing);
  assert.equal(r.steps[1].verb, 'read_listings');
});
test('posting refuses another person’s account id and finds the owner’s account', async () => {
  const s = await setup();
  const post = createPoster({ leases: memoryLeases(), store: memoryStore(), now: () => 1000, sessions,
    accounts: s.accounts, harness: createHarness({ adapters: s.adapters }), operations: memoryOperations() });
  const input = { targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  const [refused] = await post({ ...input, person_id: 'usr_2' });
  assert.equal(refused.state, 'postFailed');
  assert.equal(refused.reason, 'not_linked');
  assert.deepEqual(s.calls, [], 'another person’s account must never post');
  assert.equal((await post({ ...input, person_id: 'usr_1' }))[0].state, 'live', 'the owner’s account must be found');
  assert.deepEqual(s.calls, ['depop']);
});
test('one call posts every approved site; repeated operation never duplicates', async () => {
  const s = await setup(), post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, ...s, harness: createHarness({ adapters: s.adapters }), operations: memoryOperations() });
  const input = { person_id: 'usr_1', targets: [target(), target('ebay')], approved: ['lst_depop', 'lst_ebay'], go: ['depop', 'ebay'] as const };
  assert.deepEqual((await post(input)).map(r => r.state), ['live', 'live']);
  await post(input); assert.deepEqual(s.calls.sort(), ['depop', 'ebay']);
});
test('first_post, readiness, proof and linked owner all gate a live post', async () => {
  const s = await setup(), post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, ...s, harness: createHarness({ adapters: s.adapters }), operations: memoryOperations() });
  const base = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  for (const input of [ { ...base, approved: [] }, { ...base, person_id: 'other' },
    { ...base, targets: [{ ...target(), listing: { ...target().listing, ready: false } }] },
    { ...base, targets: [{ ...target(), claim_check: { ...target().claim_check, verdict: 'hold' as const } }] } ]) {
    assert.equal((await post(input))[0].state, 'postFailed');
  }
  assert.deepEqual(s.calls, []);
});
test('unknown outcome reconciles by listing fields once, including after a worker restart', async () => {
  const s = await setup(); let writes = 0, reads = 0;
  const write = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('outcome_unknown', 'interrupted', { do: 'reconcile', operation_id: target().operation_id }); } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { reads++; return { ok: true as const, data: [{ id: 'external_1', title: 'Jacket', price_cents: 2500, posted_at: new Date(1000).toISOString() }] }; } };
  const operations = memoryOperations(), harness = createHarness({ adapters: [write, read] });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, accounts: s.accounts, operations, harness })(input))[0].state, 'live');
  await createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, accounts: s.accounts, operations, harness })(input);
  assert.equal(writes, 1); assert.equal(reads, 1);
});
test('unknown and absent raises one decision, never automatically retries the write', async () => {
  const s = await setup(); let writes = 0; const store = memoryStore();
  const a = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('outcome_unknown', 'interrupted', { do: 'reconcile', operation_id: target().operation_id }); } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return { ok: true as const, data: [] }; } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, store, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [a, read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'paused'); await post(input); assert.equal(writes, 1);
  assert.equal(store.decisions({ state: 'open' }).length, 1);
});
test('operation storage is scoped to site and account even when caller reuses the operation id', async () => {
  const s = await setup(), post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: s.adapters }) });
  await post({ person_id: 'usr_1', targets: [target(), { ...target('ebay'), operation_id: target().operation_id }], approved: ['lst_depop', 'lst_ebay'], go: ['depop', 'ebay'] });
  assert.deepEqual(s.calls.sort(), ['depop', 'ebay']);
});
test('a pending post is read again when delayed site state arrives; write is never repeated', async () => {
  const s = await setup(); let visible = false, writes = 0;
  const write = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('outcome_unknown', 'pending', { do: 'reconcile', operation_id: target().operation_id }); } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return { ok: true as const, data: visible ? [{ id: 'new', title: 'Jacket', price_cents: 2500, posted_at: new Date(1000).toISOString() }] : [] }; } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [write, read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'paused'); visible = true;
  assert.equal((await post(input))[0].state, 'live'); assert.equal(writes, 1);
});

test('post challenge pauses the session and asks the person, with no automatic retry', async () => {
  const s = await setup(), decisions: string[] = [];
  const guard = createSessions({ store: memoryLeaseStore(), now: () => 0, decide: d => { decisions.push(d.account_id); } });
  const a = { ...fakeAdapter('depop', 'post'), async run() { return fail('blocked', 'check', { do: 'pause_session', site: 'depop' }); } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions: guard, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [a] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'paused');
  assert.equal(guard.state('acc_depop'), 'bot_check'); assert.deepEqual(decisions, ['acc_depop']);
});
test('a paused account rejects a new post operation until person resumes it', async () => {
  const s = await setup(); let writes = 0;
  const guard = createSessions({ store: memoryLeaseStore(), now: () => 0 });
  const a = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('blocked', 'check', { do: 'pause_session', site: 'depop' }); } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions: guard, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [a] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  await post(input); await post({ ...input, targets: [{ ...target(), operation_id: 'second' }] });
  assert.equal(writes, 1);
});
test('a challenge during read-back also pauses and asks the person', async () => {
  const s = await setup(), decisions: string[] = [];
  const guard = createSessions({ store: memoryLeaseStore(), now: () => 0, decide: d => { decisions.push(d.account_id); } });
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return fail('blocked', 'check', { do: 'pause_session', site: 'depop' }); } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions: guard, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [s.adapters[0], read] }) });
  assert.equal((await post({ person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] }))[0].state, 'paused');
  assert.deepEqual(decisions, ['acc_depop']);
});
test('auth expiry during read-back reconciles after relink without another post', async () => {
  const s = await setup(); let expired = true;
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() {
    return expired ? fail('auth_expired', 'sign in', { do: 'relink', site: 'depop' }) : { ok: true as const, data: [{ id: 'depop', title: 'Jacket', price_cents: 2500, posted_at: new Date(1000).toISOString() }] };
  } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [s.adapters[0], read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'paused'); expired = false;
  assert.equal((await post(input))[0].state, 'live'); assert.equal(s.calls.length, 1);
});

test('F3: returned site id wins over changed listing fields; another site id cannot confirm it', async () => {
  const s = await setup(); let id = 'unrelated';
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return { ok: true as const, data: [{ id, title: 'Changed', price_cents: 10 }] }; } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [s.adapters[0], read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  assert.equal((await post(input))[0].state, 'paused'); id = 'depop';
  assert.equal((await post(input))[0].state, 'live'); assert.equal(s.calls.length, 1);
});
test('F3: matching title and price outside the post time window cannot confirm a new post', async () => {
  const s = await setup();
  const write = { ...fakeAdapter('depop', 'post'), async run() { return { ok: true as const, data: {} }; } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return { ok: true as const, data: [{ id: 'old', title: 'Jacket', price_cents: 2500, posted_at: '2000-01-01T00:00:00Z' }] }; } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [write, read] }) });
  assert.equal((await post({ person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] }))[0].state, 'paused');
});
test('F4: write and read-back hold the shared account lease; same-account targets serialize, other accounts overlap', async () => {
  const s = await setup(), leases = memoryLeases();
  const active = new Set<string>(); let peak = 0;
  const adapters = ['depop', 'ebay'].flatMap(site => {
    const write = { ...fakeAdapter(site as Target['site'], 'post'), async run() {
      assert.ok(!active.has(site), 'same account writes overlap'); active.add(site); peak = Math.max(peak, active.size);
      assert.equal(leases.take(`acc_${site}`, 'signin', 1000).ok, false, 'write has no shared lease');
      await new Promise(r => setTimeout(r, 5)); return { ok: true as const, data: { id: site } };
    } };
    const read = { ...fakeAdapter(site as Target['site'], 'read_listings'), async run() {
      assert.equal(leases.take(`acc_${site}`, 'handoff', 1000).ok, false, 'read-back lost the shared lease');
      active.delete(site); return { ok: true as const, data: [{ id: site }] };
    } };
    return [write, read];
  });
  const second = { ...target(), listing_id: 'second', operation_id: 'second', claim_check: { ...target().claim_check, subject: 'second' } };
  const post = createPoster({ ...{ leases: memoryLeases(), store: memoryStore(), now: () => 1000 }, leases, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters }) });
  const results = await post({ person_id: 'usr_1', targets: [target(), second, target('ebay')], approved: ['lst_depop', 'second', 'lst_ebay'], go: ['depop', 'ebay'] });
  assert.deepEqual(results.map(r => r.state), ['live', 'live', 'live']); assert.equal(peak, 2);
  assert.equal(leases.take('acc_depop', 'next', 1000).ok, true);
});

test('F4: a challenge on the first queued listing stops the next listing before its write', async () => {
  const s = await setup(); let writes = 0;
  const guard = createSessions({ store: memoryLeaseStore(), now: () => 0 });
  const write = { ...fakeAdapter('depop', 'post'), async run() { writes++; return fail('blocked', 'check', { do: 'pause_session', site: 'depop' }); } };
  const post = createPoster({ leases: memoryLeases(), store: memoryStore(), sessions: guard, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [write] }) });
  const second = { ...target(), operation_id: 'second' };
  const r = await post({ person_id: 'usr_1', targets: [target(), second], approved: ['lst_depop'], go: ['depop'] });
  assert.equal(writes, 1, 'queued listing wrote after its account was paused');
  assert.deepEqual(r.map(x => x.state), ['paused', 'paused']);
});

test('F2/F4: posting through a pool adapter shares the outer lease through read-back', async () => {
  const { createPool } = await import('../browser/pool.ts');
  const s = await setup(), leases = memoryLeases(); let pages = 0;
  const context = { newPage: async () => { pages++; return { close: async () => {} }; }, close: async () => {}, onClose() {} };
  const pool = createPool({ leases, accounts: s.accounts, profileRoot: '/profiles', launcher: { persistent: async () => context, anonymous: async () => context } });
  const adapters = (['post', 'read_listings'] as const).map(verb => ({ ...fakeAdapter('depop', verb), async run() {
    const r = await pool.dispatch({ user_id: 'usr_1', account_id: 'acc_depop', job_id: 'adapter', run: async () => verb === 'post' ? { id: 'site-1' } : [{ id: 'site-1' }] });
    return r.ok ? { ok: true as const, data: r.value } : fail('policy_refused', 'pool rejected parent lease', { do: 'raise_decision', kind: 'busy' });
  } }));
  const post = createPoster({ leases, store: memoryStore(), sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters }) });
  assert.equal((await post({ person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] }))[0].state, 'live');
  assert.equal(pages, 2); await pool.close();
});

test('F3: retries match the original claimed listing and keep its first read-back window', async () => {
  const s = await setup(); let time = 1000, visible = false;
  let row = { id: 'different', title: 'Coat', price_cents: 3000, posted_at: new Date(1000).toISOString() };
  const write = { ...fakeAdapter('depop', 'post'), async run() { return fail('outcome_unknown', 'pending', { do: 'reconcile', operation_id: target().operation_id }); } };
  const read = { ...fakeAdapter('depop', 'read_listings'), async run() { return { ok: true as const, data: visible ? [row] : [] }; } };
  const post = createPoster({ leases: memoryLeases(), store: memoryStore(), now: () => time, sessions, accounts: s.accounts, operations: memoryOperations(), harness: createHarness({ adapters: [write, read] }) });
  const input = { person_id: 'usr_1', targets: [target()], approved: ['lst_depop'], go: ['depop'] as const };
  await post(input); visible = true;
  const changed = { ...target(), listing: { ...target().listing, title: 'Coat', price_cents: 3000 } };
  assert.equal((await post({ ...input, targets: [changed] }))[0].state, 'paused', 'retry fields confirmed an unrelated listing');
  time = 5000; row = { id: 'later', title: 'Jacket', price_cents: 2500, posted_at: new Date(5000).toISOString() };
  assert.equal((await post(input))[0].state, 'paused', 'retry expanded the original post window');
});
