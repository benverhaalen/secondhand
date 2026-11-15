// Contract tests for /v1/auth/*: each response key set equals its spec/examples entry; each failure is the contract error.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, memoryStore } from '../auth.ts';
import { deps, route } from './http.ts';
import { example } from './examples.ts';
import { makeAuthHandlers } from './auth.ts';

const keys = (o: unknown): unknown => Array.isArray(o) ? (typeof o[0] === 'object' ? keys(o[0]) : 'array') : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, keys((o as Record<string, unknown>)[k])])) : typeof o;
const shape = (name: string) => keys((example(name) as { response: unknown }).response);

function world() {
  let t = Date.parse('2026-11-15T03:00:00Z'); const sent: string[] = [];
  const store = memoryStore();
  const auth = createAuth({
    store, now: () => t,
    verifyApple: async (tok) => (tok.startsWith('apple:') ? { subject: tok.slice(6) } : null),
    verifyGoogle: async (tok) => (tok.startsWith('google:') ? { subject: tok.slice(7), email: 'sam@example.com', email_verified: true } : null),
    sendCode: (_e, c) => { sent.push(c); },
  });
  deps.verify = auth.verifyAccess; deps.idem.clear(); deps.now = () => t;
  const h = makeAuthHandlers(auth, store);
  const routes = {
    apple: route('POST /v1/auth/apple', h.apple, { auth: 'none' }), google: route('POST /v1/auth/google', h.google, { auth: 'none' }),
    start: route('POST /v1/auth/email/start', h.emailStart, { auth: 'none' }), verify: route('POST /v1/auth/email/verify', h.emailVerify, { auth: 'none' }),
    refresh: route('POST /v1/auth/refresh', h.refresh, { auth: 'none' }), signout: route('POST /v1/auth/signout', h.signout, { auth: 'none' }),
    linkApple: route('POST /v1/auth/link/apple', h.linkApple), linkGoogle: route('POST /v1/auth/link/google', h.linkGoogle), linkEmail: route('POST /v1/auth/link/email', h.linkEmail),
  };
  const post = (r: (q: Request) => Promise<Response>, path: string, body: unknown, bearer?: string, extra: Record<string, string> = {}) =>
    r(new Request(`http://x${path}`, { method: 'POST', body: JSON.stringify(body), headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...extra } }));
  return { routes, post, sent };
}
const apple = (w: ReturnType<typeof world>, sub: string, extra = {}) => w.post(w.routes.apple, '/v1/auth/apple', { identity_token: `apple:${sub}`, nonce: 'n', ...extra });

test('apple sign-in key set equals the example, and the user is new', async () => {
  const w = world(); const r = await apple(w, 'a1', { name: 'Sam' });
  assert.equal(r.status, 200); const b = await r.json();
  assert.deepEqual(keys(b), shape('auth.apple')); assert.equal(b.created, true); assert.equal(b.user.auth_methods[0].provider, 'apple');
});
test('google sign-in key set equals the example', async () => {
  const w = world(); const b = await (await w.post(w.routes.google, '/v1/auth/google', { id_token: 'google:g1' })).json();
  assert.deepEqual(keys(b), shape('auth.google'));
});
test('email start is 202 with the example key set, and verify gives the example key set', async () => {
  const w = world(); const s = await w.post(w.routes.start, '/v1/auth/email/start', { email: 'sam@example.com' });
  assert.equal(s.status, 202); assert.deepEqual(keys(await s.json()), shape('auth.email.start'));
  const v = await w.post(w.routes.verify, '/v1/auth/email/verify', { email: 'sam@example.com', code: w.sent[0] });
  assert.equal(v.status, 200); assert.deepEqual(keys(await v.json()), shape('auth.email.verify'));
});
test('a wrong code is 401 with the example error key set; once locked the right code is 429', async () => {
  const w = world(); await w.post(w.routes.start, '/v1/auth/email/start', { email: 'sam@example.com' });
  const bad = await w.post(w.routes.verify, '/v1/auth/email/verify', { email: 'sam@example.com', code: '000000' });
  assert.equal(bad.status, 401); assert.deepEqual(keys(await bad.json()), shape('auth.email.verify.wrong_code'));
  for (let i = 0; i < 4; i++) await w.post(w.routes.verify, '/v1/auth/email/verify', { email: 'sam@example.com', code: '000000' });
  assert.equal((await w.post(w.routes.verify, '/v1/auth/email/verify', { email: 'sam@example.com', code: w.sent[0] })).status, 429);
});
test('missing fields are 400 invalid, a bad proof is 401', async () => {
  const w = world();
  assert.equal((await w.post(w.routes.apple, '/v1/auth/apple', { identity_token: 'apple:a1' })).status, 400);
  assert.equal((await w.post(w.routes.google, '/v1/auth/google', {})).status, 400);
  assert.equal((await w.post(w.routes.apple, '/v1/auth/apple', { identity_token: 'junk', nonce: 'n' })).status, 401);
  assert.equal((await w.post(w.routes.verify, '/v1/auth/email/verify', { email: 'sam@example.com' })).status, 400);
});
test('a client-sent user_id is ignored: sign-in returns the user the proof names', async () => {
  const w = world(); const a = await (await apple(w, 'a1')).json();
  const b = await (await apple(w, 'b1', { user_id: a.user.id })).json();
  assert.notEqual(a.user.id, b.user.id);
});
test('refresh matches the example key set; the second use is 401', async () => {
  const w = world(); const s = await (await apple(w, 'a1')).json();
  const r = await w.post(w.routes.refresh, '/v1/auth/refresh', { refresh_token: s.refresh_token });
  assert.equal(r.status, 200); assert.deepEqual(keys(await r.json()), shape('auth.refresh'));
  assert.equal((await w.post(w.routes.refresh, '/v1/auth/refresh', { refresh_token: s.refresh_token })).status, 401);
});
test('signout is 204 and the refresh token then fails', async () => {
  const w = world(); const s = await (await apple(w, 'a1')).json();
  const o = await w.post(w.routes.signout, '/v1/auth/signout', { refresh_token: s.refresh_token }, s.access_token);
  assert.equal(o.status, 204); assert.equal(await o.text(), '');
  assert.equal((await w.post(w.routes.refresh, '/v1/auth/refresh', { refresh_token: s.refresh_token })).status, 401);
});
test('link needs a signed-in user, returns the example key set, and 409s on another user identity', async () => {
  const w = world(); const a = await (await apple(w, 'a1')).json();
  assert.equal((await w.post(w.routes.linkGoogle, '/v1/auth/link/google', { id_token: 'google:g1' })).status, 401);
  const l = await w.post(w.routes.linkGoogle, '/v1/auth/link/google', { id_token: 'google:g1' }, a.access_token);
  assert.equal(l.status, 200); assert.deepEqual(keys(await l.json()), shape('auth.link.google'));
  const other = await (await apple(w, 'b1')).json();
  assert.equal((await w.post(w.routes.linkGoogle, '/v1/auth/link/google', { id_token: 'google:g1' }, other.access_token)).status, 409);
  await w.post(w.routes.start, '/v1/auth/email/start', { email: 'x@example.com' });
  const e = await w.post(w.routes.linkEmail, '/v1/auth/link/email', { email: 'x@example.com', code: w.sent[0] }, a.access_token);
  assert.deepEqual(keys(await e.json()), shape('auth.link.email'));
  assert.equal((await w.post(w.routes.linkApple, '/v1/auth/link/apple', { identity_token: 'apple:a1', nonce: 'n' }, a.access_token)).status, 200);
});
test('the same Idempotency-Key replays the sign-in response', async () => {
  const w = world(); const k = { 'Idempotency-Key': 'idk_1' };
  const go = () => w.post(w.routes.apple, '/v1/auth/apple', { identity_token: 'apple:a1', nonce: 'n' }, undefined, k);
  const a = await go(), b = await go();
  assert.equal(b.headers.get('Idempotent-Replayed'), 'true'); assert.equal((await a.json()).access_token, (await b.json()).access_token);
});
