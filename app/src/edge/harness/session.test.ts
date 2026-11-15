import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessions, memoryLeaseStore, pickRoute, CLEAN_MS, PROBE_EVERY_MS, type Decision } from './session.ts';
import { fakeManifest } from './protocol.ts';

function setup() {
  let t = 1_000_000;
  const decisions: Decision[] = [];
  const s = createSessions({ store: memoryLeaseStore(), now: () => t, rand: () => 0.5, decide: d => decisions.push(d) });
  return { s, decisions, tick: (ms: number) => { t += ms; } };
}

test('lease: two jobs on one account, one gets 409, steps never interleave; a TTL frees it', () => {
  const { s, tick } = setup();
  assert.equal(s.lease('a1', 'j1', 1000).ok, true);
  assert.deepEqual(s.lease('a1', 'j2', 1000), { ok: false, status: 409 });
  assert.equal(s.lease('a2', 'j2', 1000).ok, true);          // another account is independent
  tick(1001);
  assert.equal(s.lease('a1', 'j2', 1000).ok, true);          // expired row is free
});

test('lease: a write holds the lease through its read-back', async () => {
  const { s } = setup();
  let during: unknown;
  await s.withLease('a1', 'j1', 1000, async () => { /* the write */ during = s.lease('a1', 'j2', 1000); /* the read-back */ assert.deepEqual(s.lease('a1', 'j2', 1000), { ok: false, status: 409 }); });
  assert.deepEqual(during, { ok: false, status: 409 });
  assert.equal(s.lease('a1', 'j2', 1000).ok, true);          // released after
});

test('overnight lease never prompts: it proceeds, or answers account_stale at once', () => {
  const { s, decisions } = setup();
  assert.equal(s.lease('a1', 'night-1', 1000).ok, true);
  s.release('a1', 'night-1');
  s.expire('a1', 'depop');
  const r = s.lease('a1', 'night-2', 1000);                  // sync: nothing to wait on
  assert.deepEqual(r, { ok: false, status: 423, reason: 'account_stale' });
  assert.equal(decisions.length, 0);
});

test('expiry mid-sweep: account_stale, jobs paused, the hint relinks; resume returns the paused jobs', () => {
  const { s } = setup();
  s.lease('a1', 'sweep', 1000);
  const e = s.expire('a1', 'depop');
  assert.equal(e.error.code, 'auth_expired');
  assert.deepEqual(e.error.hint, { do: 'relink', site: 'depop' });
  assert.equal(s.state('a1'), 'account_stale');
  assert.deepEqual(s.paused('a1'), ['sweep']);
  assert.equal(s.lease('a1', 'other', 1000).ok, false);
  assert.deepEqual(s.resume('a1').sort(), ['other', 'sweep']);
  assert.equal(s.lease('a1', 'other', 1000).ok, true);
});

test('bot check: job paused, person asked, never solved or routed around', () => {
  const { s, decisions } = setup();
  s.lease('a1', 'j1', 1000);
  const e = s.botCheck('a1', 'j1', 'ebay');
  assert.equal(e.error.code, 'blocked');
  assert.deepEqual(e.error.hint, { do: 'pause_session', site: 'ebay' });
  assert.deepEqual(decisions, [{ account_id: 'a1', job_id: 'j1', kind: 'bot_check' }]);
  assert.deepEqual(s.lease('a1', 'j2', 1000), { ok: false, status: 423, reason: 'bot_check' }); // no other job slips past
  assert.deepEqual(s.paused('a1'), ['j1', 'j2']);
});

test('probe: two failures mean broken, a login wall means account_stale, success resets', async () => {
  const { s, tick } = setup();
  const bad = async () => ({ ok: false as const, error: { code: 'page_changed' as const, message: 'x', hint: { do: 'author' as const, missing: [] } } });
  const good = async () => ({ ok: true as const, data: [] });
  assert.equal(s.probeDue('a1'), true);
  assert.equal(await s.probe('a1', 'depop', bad), 'failed');
  assert.equal(await s.probe('a1', 'depop', good), 'ok');
  assert.equal(await s.probe('a1', 'depop', bad), 'failed');
  assert.equal(s.probeDue('a1'), false);
  tick(PROBE_EVERY_MS);
  assert.equal(s.probeDue('a1'), true);
  assert.equal(await s.probe('a1', 'depop', bad), 'broken');
  assert.equal(s.state('a1'), 'broken');
  const wall = async () => ({ ok: false as const, error: { code: 'auth_expired' as const, message: 'x', hint: { do: 'relink' as const, site: 'depop' as const } } });
  assert.equal(await s.probe('a2', 'depop', wall), 'account_stale');
  assert.equal(s.state('a2'), 'account_stale');
});

test('pace: token bucket fills at the manifest pace; browser steps are 2 to 5 s apart', () => {
  const { s, tick } = setup();
  const pace = { per_minute: 60, step_ms: [2000, 5000] as [number, number] };
  const b = s.bucket('a1', 'depop', pace);
  assert.equal(s.bucket('a1', 'depop', pace), b);            // one bucket per (account, site)
  const waits = Array.from({ length: 12 }, () => b.take());
  assert.deepEqual(waits.slice(0, 10), Array(10).fill(0));   // burst of 10 s
  assert.equal(waits[10], 1000);                             // then one per second
  assert.equal(waits[11], 2000);
  tick(5000);
  assert.equal(b.take(), 0);                                 // 5 s refilled the debt
});

test('pace: steps spaced 2 to 5 s with jitter', () => {
  const { s, tick } = setup();
  const b = s.bucket('a1', 'ebay', { per_minute: 30, step_ms: [2000, 5000] });
  assert.equal(b.step(), 0);
  const w = b.step();
  assert.equal(w, 3500);                                     // rand 0.5 of [2000, 5000]
  tick(10_000);
  assert.equal(b.step(), 0);
});

test('pace: rate_limited or blocked slows at once; +10% only after 14 clean days, never past the cap', () => {
  const { s, tick } = setup();
  const b = s.bucket('a1', 'depop', { per_minute: 30, step_ms: [2000, 5000] });
  b.onOutcome('rate_limited');
  assert.equal(b.rate(), 15);
  b.onOutcome('blocked');
  assert.equal(b.rate(), 7.5);
  tick(CLEAN_MS - 1); b.onOutcome('ok');
  assert.equal(b.rate(), 7.5);                               // 13 days 23 h is not 14
  tick(1); b.onOutcome('ok');
  assert.ok(Math.abs(b.rate() - 8.25) < 1e-9);
  for (let i = 0; i < 60; i++) { tick(CLEAN_MS); b.onOutcome('ok'); }
  assert.equal(b.rate(), 30);                                // capped at the manifest
});

test('pickRoute: a public route is never ranked over a signed-in one for a field it cannot return', () => {
  const pub = { route_id: 'pub', ms: 100, manifest: fakeManifest('depop', 'read_listings', { session: 'public' }) };
  const signed = { route_id: 'signed', ms: 5000, manifest: fakeManifest('depop', 'read_listings', { session: 'signed_in' }) };
  assert.equal(pickRoute([pub, signed], ['id', 'title'])?.route_id, 'pub');           // both serve: fastest
  assert.equal(pickRoute([signed, pub], ['id', 'watchers'])?.route_id, 'signed');     // watchers needs a session
  assert.equal(pickRoute([pub], ['id', 'watchers']), undefined);                       // no signed-in route: none, not the public one
  assert.equal(pickRoute([pub, signed], ['id', 'nope']), undefined);                   // nobody lists it
});

test('review: a write that runs past its lease TTL keeps the lease through its read-back; a second job gets 409', async () => {
  const store = memoryLeaseStore();
  const s = createSessions({ store, now: () => Date.now() });
  let second: unknown;
  const out = await s.withLease('acct', 'write-1', 30, async () => {
    await new Promise(r => setTimeout(r, 80)); // the write and its read-back outlast the 30 ms TTL
    second = s.lease('acct', 'job-2', 30);
    return 'written';
  });
  assert.equal(out, 'written');
  assert.deepEqual(second, { ok: false, status: 409 });
  assert.ok(s.lease('acct', 'job-2', 30).ok, 'released once the write is done');
});

test('review: quiet hours hold every request until the window ends, across midnight too', async () => {
  const { quietLeft } = await import('./session.ts');
  const at = (iso: string) => Date.parse(iso);
  assert.equal(quietLeft(at('2026-11-15T23:00:00Z'), [22, 6]), 7 * 3_600_000);
  assert.equal(quietLeft(at('2026-11-15T05:30:00Z'), [22, 6]), 30 * 60_000);
  assert.equal(quietLeft(at('2026-11-15T12:00:00Z'), [22, 6]), 0);
  let t = at('2026-11-15T03:00:00Z');
  const s = createSessions({ store: memoryLeaseStore(), now: () => t });
  const b = s.bucket('acct', 'depop', { per_minute: 30, step_ms: [2000, 5000], quiet_hours: [2, 6] });
  assert.equal(b.take(), 3 * 3_600_000);
  t = at('2026-11-15T06:00:00Z');
  assert.equal(b.take(), 0);
});
