import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler, type Account } from './schedule.ts';
import { memoryLeases, memoryParams } from './ports.ts';

const PRIORS = { 'watch_cadence_s': 900 };
const params = () => memoryParams(PRIORS, { 'watch_cadence_s@depop/hot': 90, 'watch_cadence_s@depop/live': 900, 'watch_cadence_s@depop/quiet': 3600 });
const acct = (id: string, site: Account['site'] = 'depop'): Account => ({ account_id: id, site, user_id: 'u1' });

function clock(start = 0) { let t = start; return { now: () => t, add: (s: number) => { t += s * 1000; } }; }

test('cadence by state comes from params: hot 90 s, live 15 min, quiet hourly', async () => {
  const c = clock(), runs: string[] = [];
  const states: Record<string, 'hot' | 'live' | 'quiet'> = { a: 'hot', b: 'live', q: 'quiet' };
  const s = createScheduler({ params: params(), leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a'), acct('b'), acct('q')],
    stateOf: a => states[a.account_id], runSweep: async a => { runs.push(a.account_id); return { ok: true }; }, onStale: () => {} });
  await s.tick(); assert.deepEqual(runs.sort(), ['a', 'b', 'q']);
  assert.deepEqual(s.nextDue(), { a: 90_000, b: 900_000, q: 3_600_000 });
  c.add(90); runs.length = 0; await s.tick(); assert.deepEqual(runs, ['a']); // only the hot one is due
});

test('cadence param changed: applied next tick', async () => {
  const c = clock(), p = params();
  const s = createScheduler({ params: p, leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a')],
    stateOf: () => 'live', runSweep: async () => ({ ok: true }), onStale: () => {} });
  await s.tick(); assert.equal(s.nextDue().a, 900_000);
  p.set('watch_cadence_s@depop/live', 600);
  c.add(900); await s.tick(); assert.equal(s.nextDue().a, 900_000 + 600_000);
});

test('a session expiring mid-sweep: account_stale, sweep paused, resumed on relink', async () => {
  const c = clock(), stale: string[] = []; let expired = true, runs = 0;
  const s = createScheduler({ params: params(), leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a')], stateOf: () => 'hot',
    runSweep: async () => { runs++; return expired ? { ok: false, error: { code: 'auth_expired', message: 'login wall', hint: { do: 'relink' } } } : { ok: true }; },
    onStale: a => { stale.push(a.account_id); } });
  await s.tick(); assert.deepEqual(stale, ['a']); assert.deepEqual(s.paused(), ['a']);
  c.add(3600); await s.tick(); assert.equal(runs, 1); // paused: no sweep, no second stale decision
  expired = false; s.resume('a'); await s.tick(); assert.equal(runs, 2); assert.deepEqual(s.paused(), []);
});

test('a thrown auth error mid-sweep pauses the same way and gives the lease back', async () => {
  const c = clock(), leases = memoryLeases(c.now), stale: string[] = [];
  const s = createScheduler({ params: params(), leases, now: c.now, accounts: () => [acct('a')], stateOf: () => 'hot',
    runSweep: async () => { throw Object.assign(new Error('expired'), { code: 'auth_expired' }); }, onStale: a => { stale.push(a.account_id); } });
  await s.tick(); assert.deepEqual(stale, ['a']);
  assert.deepEqual(leases.take('a', 'other', 1000), { ok: true });
});

test('sweeps for different accounts run in parallel; a busy lease skips this tick and stays due', async () => {
  const c = clock(), leases = memoryLeases(c.now);
  leases.take('busy', 'post-job', 60_000);
  let live = 0, peak = 0;
  const s = createScheduler({ params: params(), leases, now: c.now, accounts: () => ['a', 'b', 'c', 'busy'].map(id => acct(id)), stateOf: () => 'hot',
    runSweep: async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 20)); live--; return { ok: true }; }, onStale: () => {} });
  const r = await s.tick();
  assert.equal(peak, 3);
  assert.deepEqual(r.skipped, ['busy']);
  assert.equal(s.nextDue().busy, undefined); // still due on the next tick
});

test('through the night: no quiet-hour stop in the scheduler', async () => {
  const c = clock(Date.UTC(2026, 10, 15, 8)); // 03:00 Central
  let runs = 0;
  const s = createScheduler({ params: params(), leases: memoryLeases(c.now), now: c.now, accounts: () => [acct('a')], stateOf: () => 'quiet',
    runSweep: async () => { runs++; return { ok: true }; }, onStale: () => {} });
  await s.tick(); assert.equal(runs, 1);
});
