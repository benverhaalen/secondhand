import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, type Account } from './schedule.ts';
import { memoryLeases, memoryParams } from './ports.ts';

const PRIORS = { 'watch_cadence_s': 900 };
const params = () => memoryParams(PRIORS, { 'watch_cadence_s@depop/hot': 90, 'watch_cadence_s@depop/live': 900, 'watch_cadence_s@depop/quiet': 3600 });
const acct = (id: string, site: Account['site'] = 'depop'): Account => ({ account_id: id, site, user_id: 'u1' });

function clock(start = 0) { let t = start; return { now: () => t, add: (s: number) => { t += s * 1000; } }; }

type Paused = 'auth_expired' | 'blocked';
function savedState(due: Record<string, number> = {}, paused: Record<string, Paused> = {}) {
  let loads = 0;
  const changes: { account_id: string; due?: number; paused?: Paused | null }[] = [];
  return {
    due, paused, changes, loads: () => loads,
    load() { loads++; return { due: { ...due }, paused: { ...paused } }; },
    save(account_id: string, patch: { due?: number; paused?: Paused | null }) {
      changes.push({ account_id, ...patch });
      if (patch.due !== undefined) due[account_id] = patch.due;
      if (patch.paused === null) delete paused[account_id];
      else if (patch.paused !== undefined) paused[account_id] = patch.paused;
    },
  };
}

// Cadence tests start with accounts already due; startup spreading is exercised separately.
function readyScheduler(o: Parameters<typeof createScheduler>[0]) {
  return createScheduler({ ...o, state: savedState(Object.fromEntries(o.accounts().map(a => [a.account_id, o.now()]))) });
}

test('cadence by state comes from params: hot 90 s, live 15 min, quiet hourly', async () => {
  const c = clock(), runs: string[] = [];
  const states: Record<string, 'hot' | 'live' | 'quiet'> = { a: 'hot', b: 'live', q: 'quiet' };
  const s = readyScheduler({ params: params(), leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a'), acct('b'), acct('q')],
    stateOf: a => states[a.account_id], runSweep: async a => { runs.push(a.account_id); return { ok: true }; }, onStale: () => {} });
  await s.tick(); assert.deepEqual(runs.sort(), ['a', 'b', 'q']);
  assert.deepEqual(s.nextDue(), { a: 90_000, b: 900_000, q: 3_600_000 });
  c.add(90); runs.length = 0; await s.tick(); assert.deepEqual(runs, ['a']); // only the hot one is due
});

test('cadence param changed: applied next tick', async () => {
  const c = clock(), p = params();
  const s = readyScheduler({ params: p, leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a')],
    stateOf: () => 'live', runSweep: async () => ({ ok: true }), onStale: () => {} });
  await s.tick(); assert.equal(s.nextDue().a, 900_000);
  p.set('watch_cadence_s@depop/live', 600);
  c.add(900); await s.tick(); assert.equal(s.nextDue().a, 900_000 + 600_000);
});

test('a session expiring mid-sweep: account_stale, sweep paused, resumed on relink', async () => {
  const c = clock(), stale: string[] = []; let expired = true, runs = 0;
  const s = readyScheduler({ params: params(), leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a')], stateOf: () => 'hot',
    runSweep: async () => { runs++; return expired ? { ok: false, error: { code: 'auth_expired', message: 'login wall', hint: { do: 'relink' } } } : { ok: true }; },
    onStale: a => { stale.push(a.account_id); } });
  await s.tick(); assert.deepEqual(stale, ['a']); assert.deepEqual(s.paused(), ['a']);
  c.add(3600); await s.tick(); assert.equal(runs, 1); // paused: no sweep, no second stale decision
  expired = false; s.resume('a'); await s.tick(); assert.equal(runs, 2); assert.deepEqual(s.paused(), []);
});

test('a thrown auth error mid-sweep pauses the same way and gives the lease back', async () => {
  const c = clock(), leases = memoryLeases(c.now), stale: string[] = [];
  const s = readyScheduler({ params: params(), leases, now: c.now, accounts: () => [acct('a')], stateOf: () => 'hot',
    runSweep: async () => { throw Object.assign(new Error('expired'), { code: 'auth_expired' }); }, onStale: a => { stale.push(a.account_id); } });
  await s.tick(); assert.deepEqual(stale, ['a']);
  assert.deepEqual(leases.take('a', 'other', 1000), { ok: true });
});

test('sweeps for different accounts run in parallel; a busy lease skips this tick and stays due', async () => {
  const c = clock(), leases = memoryLeases(c.now);
  leases.take('busy', 'post-job', 60_000);
  let live = 0, peak = 0;
  const s = readyScheduler({ params: params(), leases, now: c.now, accounts: () => ['a', 'b', 'c', 'busy'].map(id => acct(id)), stateOf: () => 'hot',
    runSweep: async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 20)); live--; return { ok: true }; }, onStale: () => {} });
  const r = await s.tick();
  assert.equal(peak, 3);
  assert.deepEqual(r.skipped, ['busy']);
  assert.equal(s.nextDue().busy, 0); // still due on the next tick
});

test('through the night: no quiet-hour stop in the scheduler', async () => {
  const c = clock(Date.UTC(2026, 10, 15, 8)); // 03:00 Central
  let runs = 0;
  const s = readyScheduler({ params: params(), leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a')], stateOf: () => 'quiet',
    runSweep: async () => { runs++; return { ok: true }; }, onStale: () => {} });
  await s.tick(); assert.equal(runs, 1);
});

test('restart loads once: first minute sweeps only due accounts and preserves pause reasons', async () => {
  const c = clock(1_000_000), runs: string[] = [];
  const state = savedState({ due: c.now(), later: c.now() + 600_000, check: 0, login: 0 }, { check: 'blocked', login: 'auth_expired' });
  const s = createScheduler({ params: params(), leases: memoryLeases(c.now), now: c.now, state,
    accounts: () => ['due', 'later', 'check', 'login'].map(id => acct(id)), stateOf: () => 'live',
    runSweep: async a => { runs.push(a.account_id); return { ok: true }; }, onStale: () => {} });
  for (let i = 0; i < 60; i++) { await s.tick(); c.add(1); }
  assert.deepEqual(runs, ['due'], 'future and paused accounts must not sweep after restart');
  assert.equal(state.loads(), 1, 'state loads once per scheduler');
  assert.equal(state.due.due, 1_900_000, 'successful sweep saves its next due');
  assert.deepEqual(s.paused().sort(), ['check', 'login']);
});

test('no saved state spreads first sweeps deterministically across one cadence and saves them', async () => {
  const c = clock(1_000_000), accounts = Array.from({ length: 100 }, (_, i) => acct(`acc_${i}`));
  const first = new Map<string, number>(), state = savedState();
  const make = (state?: ReturnType<typeof savedState>) => createScheduler({ state, params: params(), leases: memoryLeases(c.now), now: c.now,
    accounts: () => accounts, stateOf: () => 'live', runSweep: async a => { if (!first.has(a.account_id)) first.set(a.account_id, c.now()); return { ok: true }; }, onStale: () => {} });
  const s = make(state); await s.tick();
  assert.equal(first.size, 0, 'missing due times must not trigger a startup sweep');
  const due = s.nextDue();
  assert.equal(Object.keys(state.due).length, 100, 'initial due times must be persisted');
  assert.ok(Object.values(due).every(t => t > c.now() && t <= c.now() + 900_000));
  const buckets = new Set(Object.values(due).map(t => Math.floor((t - c.now()) / 150_000)));
  assert.ok(buckets.size >= 5, 'account hashes must spread over the cadence, not cluster near startup');
  const unpersisted = make(); await unpersisted.tick(); assert.deepEqual(unpersisted.nextDue(), due, 'jitter also works without a state port');
  const restarted = make(state); await restarted.tick(); assert.deepEqual(restarted.nextDue(), due, 'restart preserves initial due times');
  for (let i = 0; i < 15; i++) { c.add(60); await restarted.tick(); }
  assert.equal(first.size, 100, 'every account gets its first sweep within one cadence');
  assert.ok(new Set(first.values()).size >= 10, 'first sweeps occur across the cadence');
});

test('blocked persists across a day and restart until resume clears and saves the pause', async () => {
  const c = clock(), state = savedState({ a: 0 });
  let runs = 0, blocked = true, notices = 0;
  const make = () => createScheduler({ state, params: params(), leases: memoryLeases(c.now), now: c.now,
    accounts: () => [acct('a')], stateOf: () => 'hot',
    runSweep: async () => { runs++; return blocked ? { ok: false, error: { code: 'blocked', message: 'check', hint: { do: 'pause_session' } } } : { ok: true }; },
    onStale: () => assert.fail('blocked is not auth_expired'), onBlocked: () => { notices++; } });
  await make().tick(); assert.equal(runs, 1); assert.equal(notices, 1);
  assert.equal(state.paused.a, 'blocked', 'block reason must survive restart');
  const restarted = make();
  for (let i = 0; i < 1440; i++) { c.add(60); await restarted.tick(); }
  assert.equal(runs, 1, 'blocked account gets zero further sweeps for a day');
  blocked = false; restarted.resume('a'); await restarted.tick();
  assert.equal(runs, 2); assert.equal(state.paused.a, undefined);
  assert.ok(state.changes.some(p => p.account_id === 'a' && p.paused === null), 'resume saves clearing the pause');
});

test('auth_expired persists its pause and resumes immediately after restart', async () => {
  const c = clock(), state = savedState({ a: 0 }); let expired = true, runs = 0;
  const make = () => createScheduler({ state, params: params(), leases: memoryLeases(c.now), now: c.now,
    accounts: () => [acct('a')], stateOf: () => 'hot', onStale: () => {},
    runSweep: async () => { runs++; return expired ? { ok: false, error: { code: 'auth_expired', message: 'login' } } : { ok: true }; } });
  await make().tick(); assert.equal(state.paused.a, 'auth_expired');
  const s = make(); c.add(3600); await s.tick(); assert.equal(runs, 1);
  expired = false; s.resume('a');
  const restarted = make(); await restarted.tick(); assert.equal(runs, 2, 'saved resume is due immediately');
});

for (const [code, after_s] of [['rate_limited', 7200], ['page_changed', 7200], ['rate_limited', 30]] as const) {
  test(`${code} retry_after ${after_s}s waits for the longer of cadence and hint after restart`, async () => {
    const c = clock(), state = savedState({ a: 0 }); let runs = 0;
    const delay = Math.max(900, after_s);
    const make = () => createScheduler({ state, params: params(), leases: memoryLeases(c.now), now: c.now,
      accounts: () => [acct('a')], stateOf: () => 'live', onStale: () => {},
      runSweep: async () => { runs++; return { ok: false, error: { code, message: 'wait', hint: { do: 'retry_after', after_s } } }; } });
    await make().tick(); assert.equal(state.due.a, delay * 1000, 'retry deadline must be persisted');
    const s = make(); c.add(delay - 1); await s.tick(); assert.equal(runs, 1, 'no early retry');
    c.add(1); await s.tick(); assert.equal(runs, 2, 'retry is allowed at deadline');
  });
}

test('a thrown retry_after hint preserves its deadline instead of retrying at cadence', async () => {
  const c = clock(), state = savedState({ a: 0 });
  const s = createScheduler({ state, params: params(), leases: memoryLeases(c.now), now: c.now,
    accounts: () => [acct('a')], stateOf: () => 'live', onStale: () => {},
    runSweep: async () => { throw Object.assign(new Error('wait'), { code: 'rate_limited', hint: { do: 'retry_after', after_s: 7200 } }); } });
  await s.tick(); assert.equal(state.due.a, 7200000, 'thrown errors must keep their retry hint');
});
