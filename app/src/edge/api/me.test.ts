// Contract tests for /v1/me*: key sets equal spec/examples, one user never reads another, stale writes are 409.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, memoryStore } from '../auth.ts';
import { deps, route } from './http.ts';
import { example } from './examples.ts';
import { makeAuthHandlers } from './auth.ts';
import { makeMeHandlers } from './me.ts';

const keys = (o: unknown): unknown => Array.isArray(o) ? (typeof o[0] === 'object' ? keys(o[0]) : 'array') : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, keys((o as Record<string, unknown>)[k])])) : typeof o;
const shape = (name: string) => keys((example(name) as { response: unknown }).response);

async function world() {
  let t = Date.parse('2026-11-15T03:00:00Z'); const store = memoryStore();
  const auth = createAuth({ store, now: () => t, verifyApple: async (k) => ({ subject: k }), verifyGoogle: async () => null, sendCode: () => {} });
  deps.verify = auth.verifyAccess; deps.idem.clear(); deps.now = () => t;
  const a = makeAuthHandlers(auth, store), m = makeMeHandlers({ store, auth, now: () => t });
  const r = {
    apple: route('POST /v1/auth/apple', a.apple, { auth: 'none' }), get: route('GET /v1/me', m.get), patch: route('PATCH /v1/me', m.patch), del: route('DELETE /v1/me', m.delete),
    exp: route('POST /v1/me/export', m.export), sget: route('GET /v1/me/style', m.styleGet), spatch: route('PATCH /v1/me/style', m.stylePatch),
  };
  const call = (f: (q: Request) => Promise<Response>, method: string, path: string, bearer: string, body?: unknown) =>
    f(new Request(`http://x${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { Authorization: `Bearer ${bearer}` } }));
  const user = async (sub: string) => (await (await r.apple(new Request('http://x/v1/auth/apple', { method: 'POST', body: JSON.stringify({ identity_token: sub, nonce: 'n' }) }))).json()) as { access_token: string; user: { id: string } };
  return { r, call, user, tick: (ms: number) => { t += ms; } };
}

test('GET /v1/me key set equals the example and next_step is the first undone step', async () => {
  const w = await world(); const u = await w.user('a'); const res = await w.call(w.r.get, 'GET', '/v1/me', u.access_token);
  assert.equal(res.status, 200); const b = await res.json();
  assert.deepEqual(keys(b), shape('me.get')); assert.equal(b.id, u.user.id); assert.equal(b.onboarding.next_step, 'signed_in');
});
test('a token for user A can never read B: /v1/me always answers the token owner', async () => {
  const w = await world(); const a = await w.user('a'), b = await w.user('b');
  assert.equal((await (await w.call(w.r.get, 'GET', `/v1/me?user_id=${b.user.id}`, a.access_token)).json()).id, a.user.id);
  assert.equal((await (await w.call(w.r.get, 'GET', '/v1/me', b.access_token)).json()).id, b.user.id);
});
test('no token and an expired token are 401', async () => {
  const w = await world(); const a = await w.user('a');
  assert.equal((await w.call(w.r.get, 'GET', '/v1/me', 'nope')).status, 401);
  w.tick(3600_001); assert.equal((await w.call(w.r.get, 'GET', '/v1/me', a.access_token)).status, 401);
});
test('PATCH onboarding_step key set equals the example, bumps the version, and walks to finished_at at 7 steps', async () => {
  const w = await world(); const a = await w.user('a'); let v = 1, last: Record<string, any> = {};
  for (const s of ['signed_in', 'sites_picked', 'sites_linked', 'imported', 'email', 'pickups', 'notifications']) {
    last = await (await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: v, onboarding_step: s })).json(); v = last.version;
    if (s === 'signed_in') assert.deepEqual(keys(last), shape('me.patch.onboarding'));
  }
  assert.equal(v, 8); assert.equal(last.onboarding.next_step, null); assert.match(last.onboarding.finished_at, /^2026-11-15T/);
  assert.equal(last.onboarding.done_steps.length, 7);
});
test('PATCH notifications with a push token: push_registered, example key set, and the token is never echoed', async () => {
  const w = await world(); const a = await w.user('a');
  const res = await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, onboarding_step: 'notifications', push_token: 'ExponentPushToken[x]', notification_pref: [{ event_kind: 'sale', channel: 'push', on: true }] });
  const b = await res.json(); assert.equal(res.status, 200); assert.equal(b.push_registered, true);
  assert.deepEqual(keys(b), { ...(shape('me.patch.notifications') as object), onboarding: keys(b.onboarding) }); assert.ok(!JSON.stringify(b).includes('ExponentPushToken'));
  assert.equal((await (await w.call(w.r.get, 'GET', '/v1/me', a.access_token)).json()).notification_pref.length, 1);
});
test('PATCH tutorial_seen matches its example key set', async () => {
  const w = await world(); const a = await w.user('a');
  assert.deepEqual(keys(await (await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, tutorial_seen: true })).json()), shape('me.patch.tutorial_seen'));
});
test('a stale version is 409 with current, and writes nothing; two parallel patches on one version: one wins', async () => {
  const w = await world(); const a = await w.user('a');
  await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, tutorial_seen: true });
  const res = await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, tutorial_seen: false });
  assert.equal(res.status, 409); const b = await res.json(); assert.deepEqual(keys(b), shape('me.patch.stale')); assert.equal(b.current.tutorial_seen, true); assert.equal(b.current.version, 2);
  const race = await Promise.all([1, 2].map(() => w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 2, experiments_consent: true })));
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
});
test('bad patches are 400: no version, unknown step, wrong type', async () => {
  const w = await world(); const a = await w.user('a');
  for (const body of [{ tutorial_seen: true }, { version: 1, onboarding_step: 'bogus' }, { version: 1, tutorial_seen: 'yes' }, { version: 'x', tutorial_seen: true }])
    assert.equal((await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, body)).status, 400, JSON.stringify(body));
});
test('a client-sent user_id in a patch is ignored: it writes the token owner only', async () => {
  const w = await world(); const a = await w.user('a'), b = await w.user('b');
  await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, tutorial_seen: true, user_id: b.user.id });
  assert.equal((await (await w.call(w.r.get, 'GET', '/v1/me', b.access_token)).json()).tutorial_seen, false);
});
test('export and delete are 202 job shapes with the example key sets', async () => {
  const w = await world(); const a = await w.user('a');
  const e = await w.call(w.r.exp, 'POST', '/v1/me/export', a.access_token, {}); assert.equal(e.status, 202); assert.deepEqual(keys(await e.json()), shape('me.export'));
  const d = await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token); assert.equal(d.status, 202); assert.deepEqual(keys(await d.json()), shape('me.delete'));
});
test('delete ends the sessions: the token is 401 afterwards', async () => {
  const w = await world(); const a = await w.user('a'); await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token);
  assert.equal((await w.call(w.r.get, 'GET', '/v1/me', a.access_token)).status, 401);
});
test('style get matches the example key set; patch edits, removes, bumps the version, and is 409 when stale', async () => {
  const w = await world(); const a = await w.user('a');
  const g = await (await w.call(w.r.sget, 'GET', '/v1/me/style', a.access_token)).json(); assert.deepEqual(keys(g), shape('me.style.get'));
  const body = { version: g.version, facets: [{ name: 'size', value: 'L', weight: 0.9, pinned: true }, { name: 'era', value: '1990s', remove: true }] };
  const p = await w.call(w.r.spatch, 'PATCH', '/v1/me/style', a.access_token, body); assert.equal(p.status, 200);
  const b = await p.json(); assert.deepEqual(keys(b), shape('me.style.patch')); assert.equal(b.version, g.version + 1);
  assert.equal(b.facets.find((f: any) => f.name === 'size').from, 'edited'); assert.ok(b.facets.find((f: any) => f.name === 'era').removed_at);
  assert.equal((await w.call(w.r.spatch, 'PATCH', '/v1/me/style', a.access_token, body)).status, 409);
});
