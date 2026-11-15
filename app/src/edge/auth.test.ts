import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from './api/http.ts';
import { appleVerifier, createAuth, googleVerifier, memoryStore, type Claims } from './auth.ts';

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array | string) => Buffer.from(typeof b === 'string' ? enc.encode(b) : new Uint8Array(b)).toString('base64url');
const sha = async (s: string) => Buffer.from(await crypto.subtle.digest('SHA-256', enc.encode(s))).toString('hex');
const rsa = () => crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwkOf = async (k: CryptoKeyPair, kid: string) => ({ ...(await crypto.subtle.exportKey('jwk', k.publicKey)), kid, alg: 'RS256', use: 'sig' });
const sign = async (k: CryptoKeyPair, claims: object, kid = 'k1', alg = 'RS256') => {
  const head = `${b64u(JSON.stringify({ alg, kid }))}.${b64u(JSON.stringify(claims))}`;
  return `${head}.${b64u(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', k.privateKey, enc.encode(head)))}`;
};

const NOW = Date.parse('2026-11-15T03:10:00Z');
const AUD = 'com.example.secondhand';
const good = (extra: object = {}) => ({ iss: 'https://appleid.apple.com', aud: AUD, exp: NOW / 1000 + 600, sub: 'apple-sub-1', ...extra });

async function jwksWorld() {
  const key = await rsa(), keys = [await jwkOf(key, 'k1')];
  let hits = 0, clock = NOW;
  const fetch = (async () => { hits++; return Response.json({ keys }); }) as typeof globalThis.fetch;
  const apple = appleVerifier({ fetch, now: () => clock, audiences: () => [AUD] });
  return { key, keys, apple, hits: () => hits, tick: (ms: number) => { clock += ms; } };
}

test('an Apple token with the right signature, aud, exp and nonce verifies', async () => {
  const w = await jwksWorld();
  const c = await w.apple(await sign(w.key, good({ nonce: await sha('raw-1') })), 'raw-1');
  assert.equal(c?.subject, 'apple-sub-1');
});

test('a JWT with a bad signature, the wrong aud, an expired exp, the wrong nonce, the wrong iss or alg none is rejected', async () => {
  const w = await jwksWorld(), other = await rsa();
  const n = await sha('raw-1');
  const cases: [string, string][] = [
    ['bad signature', await sign(other, good({ nonce: n }))],
    ['wrong aud', await sign(w.key, good({ nonce: n, aud: 'com.evil.app' }))],
    ['expired', await sign(w.key, good({ nonce: n, exp: NOW / 1000 - 1 }))],
    ['wrong nonce', await sign(w.key, good({ nonce: await sha('other') }))],
    ['no nonce claim', await sign(w.key, good())],
    ['wrong iss', await sign(w.key, good({ nonce: n, iss: 'https://evil.example' }))],
    ['alg none', await sign(w.key, good({ nonce: n }), 'k1', 'none')],
    ['not a jwt', 'abc'],
  ];
  for (const [name, token] of cases) assert.equal(await w.apple(token, 'raw-1'), null, name);
});

test('no configured client ids means every audience fails closed, and env APPLE_CLIENT_IDS is read', async () => {
  const key = await rsa(), keys = [await jwkOf(key, 'k1')];
  const fetch = (async () => Response.json({ keys })) as typeof globalThis.fetch;
  const tok = await sign(key, good({ nonce: await sha('r') }));
  delete process.env.APPLE_CLIENT_IDS;
  assert.equal(await appleVerifier({ fetch, now: () => NOW })(tok, 'r'), null);
  process.env.APPLE_CLIENT_IDS = `x.y, ${AUD}`;
  assert.equal((await appleVerifier({ fetch, now: () => NOW })(tok, 'r'))?.subject, 'apple-sub-1');
  delete process.env.APPLE_CLIENT_IDS;
});

test('the JWKS is cached for an hour, then fetched again', async () => {
  const w = await jwksWorld();
  const tok = async () => sign(w.key, good({ nonce: await sha('r'), exp: NOW / 1000 + 99999 }));
  await w.apple(await tok(), 'r'); await w.apple(await tok(), 'r');
  assert.equal(w.hits(), 1);
  w.tick(3600_000 + 1); await w.apple(await tok(), 'r');
  assert.equal(w.hits(), 2);
});

test('an unknown kid refetches once the cache is a minute old, never sooner', async () => {
  const w = await jwksWorld(), k2 = await rsa();
  const tok = await sign(k2, good({ nonce: await sha('r') }), 'k2');
  assert.equal(await w.apple(await sign(w.key, good({ nonce: await sha('r') })), 'r') !== null, true);
  assert.equal(await w.apple(tok, 'r'), null); assert.equal(w.hits(), 1); // too soon: no refetch, so a flood of junk kids cannot hammer Apple
  w.keys.push(await jwkOf(k2, 'k2')); w.tick(61_000);
  assert.equal((await w.apple(tok, 'r'))?.subject, 'apple-sub-1'); assert.equal(w.hits(), 2);
});

test('Google accepts either issuer form and reports email_verified', async () => {
  const key = await rsa(), keys = [await jwkOf(key, 'k1')];
  const g = googleVerifier({ fetch: (async () => Response.json({ keys })) as typeof globalThis.fetch, now: () => NOW, audiences: () => [AUD] });
  for (const iss of ['accounts.google.com', 'https://accounts.google.com']) {
    const c = await g(await sign(key, { iss, aud: AUD, exp: NOW / 1000 + 60, sub: 'g1', email: 'sam@example.com', email_verified: true }));
    assert.deepEqual([c?.subject, c?.email_verified], ['g1', true]);
  }
});

// A world with a clock, a code outbox and fake verifiers keyed by token text: "apple:<sub>", "google:<sub>:<email>".
function world() {
  let clock = NOW; const outbox: { email: string; code: string }[] = [];
  const claims = (t: string, p: string): Claims | null => {
    const [prov, sub, email] = t.split(':'); if (prov !== p || !sub) return null;
    return { subject: sub, email, email_verified: !!email };
  };
  const store = memoryStore();
  const auth = createAuth({
    store, now: () => clock,
    verifyApple: async (t) => claims(t, 'apple'), verifyGoogle: async (t) => claims(t, 'google'),
    sendCode: async (email, code) => { outbox.push({ email, code }); },
  });
  return { auth, store, outbox, tick: (ms: number) => { clock += ms; }, code: () => outbox[outbox.length - 1].code };
}
const rejects = (p: Promise<unknown>, code: string, status?: number) => assert.rejects(p, (e) => e instanceof ApiError && e.code === code && (status === undefined || e.status === status));

test('a token for user A can never read B', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' }), b = await w.auth.signInApple({ identity_token: 'apple:B', nonce: 'n' });
  assert.notEqual(a.user_id, b.user_id);
  assert.equal(await w.auth.verifyAccess(a.access_token), a.user_id);
  assert.equal(await w.auth.verifyAccess(b.access_token), b.user_id);
  assert.equal(await w.auth.verifyAccess(a.refresh_token), null, 'a refresh token is not an access token');
  assert.equal(await w.auth.verifyAccess('x'.repeat(43)), null);
});

test('sessions are stored under the hash of the token, never the token', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' });
  assert.equal(await w.store.getSession(a.access_token), null);
  assert.ok(await w.store.getSession(await sha(a.access_token)));
  assert.match(a.access_token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.access_token, a.refresh_token);
});

test('signing in again with the same Apple id is the same user, created false', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' }), b = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' });
  assert.deepEqual([a.created, b.created, a.user_id === b.user_id], [true, false, true]);
  assert.match(a.user_id, /^usr_/);
});

test('a bad Apple or Google proof is 401 unauthenticated', async () => {
  const w = world();
  await rejects(w.auth.signInApple({ identity_token: 'bad', nonce: 'n' }), 'unauthenticated', 401);
  await rejects(w.auth.signInGoogle({ id_token: 'bad' }), 'unauthenticated', 401);
});

test('an expired access token is 401 (null), exactly at one hour', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' });
  w.tick(3600_000 - 1); assert.equal(await w.auth.verifyAccess(a.access_token), a.user_id);
  w.tick(1); assert.equal(await w.auth.verifyAccess(a.access_token), null);
});

test('refresh rotates: the old refresh token dies, a refresh token used twice is 401 the second time', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' });
  const r = await w.auth.refresh({ refresh_token: a.refresh_token });
  assert.notEqual(r.refresh_token, a.refresh_token);
  assert.equal(await w.auth.verifyAccess(r.access_token), a.user_id);
  await rejects(w.auth.refresh({ refresh_token: a.refresh_token }), 'unauthenticated', 401);
  await rejects(w.auth.refresh({ refresh_token: a.access_token }), 'unauthenticated', 401);
  assert.ok(await w.auth.refresh({ refresh_token: r.refresh_token }));
});

test('two refreshes at the same instant: exactly one wins', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' });
  const res = await Promise.allSettled([w.auth.refresh({ refresh_token: a.refresh_token }), w.auth.refresh({ refresh_token: a.refresh_token })]);
  assert.deepEqual(res.map((x) => x.status).sort(), ['fulfilled', 'rejected']);
});

test('a refresh token expires after 30 days', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' });
  w.tick(30 * 86400_000 + 1);
  await rejects(w.auth.refresh({ refresh_token: a.refresh_token }), 'unauthenticated', 401);
});

test('signout revokes the refresh token and the access token issued with it', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' });
  await w.auth.signOut({ refresh_token: a.refresh_token });
  await rejects(w.auth.refresh({ refresh_token: a.refresh_token }), 'unauthenticated', 401);
  assert.equal(await w.auth.verifyAccess(a.access_token), null);
  await w.auth.signOut({ refresh_token: a.refresh_token }); // idempotent
});

test('an email code is 6 digits, creates the user once, and works once', async () => {
  const w = world();
  const s = await w.auth.startEmail({ email: 'Sam@Example.com' });
  assert.equal(s.resend_after_s, 30); assert.equal(Date.parse(s.expires_at) - NOW, 600_000);
  assert.match(w.code(), /^\d{6}$/);
  const v = await w.auth.verifyEmail({ email: 'sam@example.com', code: w.code() });
  assert.equal(v.created, true);
  await rejects(w.auth.verifyEmail({ email: 'sam@example.com', code: w.code() }), 'unauthenticated', 401);
});

test('the code is stored hashed, and an email resend inside 30 s is 429', async () => {
  const w = world();
  await w.auth.startEmail({ email: 'sam@example.com' });
  assert.ok(!JSON.stringify(w.store.dump()).includes(w.code()));
  await rejects(w.auth.startEmail({ email: 'sam@example.com' }), 'rate_limited', 429);
  w.tick(30_000); await w.auth.startEmail({ email: 'sam@example.com' });
});

test('a code expires after 10 minutes', async () => {
  const w = world();
  await w.auth.startEmail({ email: 'sam@example.com' }); w.tick(600_001);
  await rejects(w.auth.verifyEmail({ email: 'sam@example.com', code: w.code() }), 'unauthenticated', 401);
});

test('a wrong code 5 times locks the code, even for the right code', async () => {
  const w = world();
  await w.auth.startEmail({ email: 'sam@example.com' });
  const wrong = w.code() === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await rejects(w.auth.verifyEmail({ email: 'sam@example.com', code: wrong }), 'unauthenticated', 401);
  await rejects(w.auth.verifyEmail({ email: 'sam@example.com', code: w.code() }), 'rate_limited', 429);
});

test('a code for one address does not open another', async () => {
  const w = world();
  await w.auth.startEmail({ email: 'a@example.com' });
  await rejects(w.auth.verifyEmail({ email: 'b@example.com', code: w.code() }), 'unauthenticated', 401);
});

test('Google and an email code with the same verified address are one account; Apple never merges', async () => {
  const w = world();
  const g = await w.auth.signInGoogle({ id_token: 'google:g1:sam@example.com' });
  await w.auth.startEmail({ email: 'sam@example.com' });
  const e = await w.auth.verifyEmail({ email: 'sam@example.com', code: w.code() });
  assert.deepEqual([e.user_id === g.user_id, e.created], [true, false]);
  const a = await w.auth.signInApple({ identity_token: 'apple:a1:sam@example.com', nonce: 'n' });
  assert.notEqual(a.user_id, g.user_id);
});

test('link adds a method, is idempotent, and refuses an identity that belongs to another user with 409 stale', async () => {
  const w = world();
  const a = await w.auth.signInApple({ identity_token: 'apple:A', nonce: 'n' }), b = await w.auth.signInGoogle({ id_token: 'google:B' });
  const m = await w.auth.link(a.user_id, 'google', { id_token: 'google:A2' });
  assert.deepEqual(m.map((x) => x.provider), ['apple', 'google']);
  assert.equal((await w.auth.link(a.user_id, 'google', { id_token: 'google:A2' })).length, 2);
  await assert.rejects(w.auth.link(a.user_id, 'google', { id_token: 'google:B' }), (e) => e instanceof ApiError && e.status === 409 && e.code === 'stale' && e.message === 'already linked to another account');
  assert.equal((await w.auth.methods(b.user_id)).length, 1);
});
