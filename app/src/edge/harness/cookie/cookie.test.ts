import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, fakeManifest } from '../protocol.ts';
import { createSessions, memoryLeaseStore } from '../session.ts';
import { createLog, memorySink } from '../../../../../log/index.js';
import { cookieRunner, type CookieJar, type Reply } from './cookie.ts';

const SECRET = 'sessid=ZXCV-very-secret-cookie-value-123';
const jar: CookieJar = { async header(account_id, site) { return account_id === 'a1' && site === 'depop' ? SECRET : null; } };
const ok = (body: unknown): Reply => ({ status: 200, location: null, json: async () => body });

function setup(replies: Reply[]) {
  let t = 0; const waits: number[] = [], seen: { url: string; cookie: string | undefined }[] = [];
  const s = createSessions({ store: memoryLeaseStore(), now: () => t, rand: () => 0.5 });
  const sink = memorySink();
  const manifest = fakeManifest('depop', 'read_listings', { session: 'signed_in' });
  const adapter = cookieRunner({
    account_id: 'a1', manifest, jar, bucket: s.bucket('a1', 'depop', manifest.pace), sessions: s,
    wait: async ms => { waits.push(ms); },
    request: () => ({ url: 'https://www.depop.com/api/me/listings' }),
    parse: j => j,
    log: createLog({ src: 'cookie', build: 'test', sink }),
    fetch: async (url, init) => { seen.push({ url, cookie: init.headers.cookie }); return replies.shift() ?? ok([]); },
  });
  return { adapter, s, sink, seen, waits, harness: createHarness({ adapters: [adapter] }) };
}

test('cookie.test.ts: expiry', async () => {
  const x = setup([{ status: 401, location: null, json: async () => ({}) }]);
  const e = await x.harness.call('depop', 'read_listings', {});
  assert.equal(e.ok, false);
  if (!e.ok) { assert.equal(e.error.code, 'auth_expired'); assert.deepEqual(e.error.hint, { do: 'relink', site: 'depop' }); }
  assert.equal(x.s.state('a1'), 'account_stale');
  // a redirect to a login page is the same answer
  const y = setup([{ status: 302, location: 'https://www.depop.com/login/?next=/', json: async () => ({}) }]);
  const e2 = await y.harness.call('depop', 'read_listings', {});
  assert.equal(!e2.ok && e2.error.code, 'auth_expired');
  assert.equal(y.s.state('a1'), 'account_stale');
  // no cookie held: the same, nothing is requested
  const z = setup([]);
  const none = cookieRunner({ account_id: 'a2', manifest: fakeManifest('depop', 'read_listings'), jar, bucket: z.s.bucket('a2', 'depop', { per_minute: 30, step_ms: [2000, 5000] }),
    sessions: z.s, request: () => ({ url: 'u' }), parse: j => j, fetch: async () => { throw new Error('must not fetch'); } });
  const r = await none.run({}, new AbortController().signal);
  assert.equal(!r.ok && r.error.code, 'auth_expired');
});

test('cookie.test.ts: masked', async () => {
  const x = setup([ok([{ id: 'L1', title: 't', price_cents: 1 }]), { status: 401, location: null, json: async () => ({}) }]);
  const a = await x.harness.call('depop', 'read_listings', {});
  await x.harness.call('depop', 'read_listings', {});
  assert.equal(a.ok, true);
  assert.equal(x.seen[0]?.cookie, SECRET);                        // the request carried it, in memory only
  assert.ok(x.sink.lines.length > 0);
  for (const line of x.sink.lines) assert.ok(!line.includes('ZXCV') && !line.includes(SECRET), 'cookie value reached the log');
  assert.ok(!JSON.stringify(a).includes('ZXCV'));                 // nor the envelope
});

test('cookie.test.ts: paced', async () => {
  const x = setup([]);
  for (let i = 0; i < 7; i++) await x.harness.call('depop', 'read_listings', {});
  assert.equal(x.waits.length, 7);                                // every request asked the bucket first
  assert.ok(x.waits.some(w => w > 0));                            // 30/min has a burst of 5, then waits
});
