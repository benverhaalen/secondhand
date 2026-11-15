import { test } from 'node:test';
import assert from 'node:assert/strict';

function memoryStorage() {
  const rows = new Map<string, string>();
  return { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } };
}
const sessionModule = () => import(`./browser-session.ts?test=${crypto.randomUUID()}`) as Promise<typeof import('./browser-session.ts')>;
const tokens = (userId?: string) => Response.json({ access_token: 'access-fixture', expires_at: new Date(Date.now() + 3600000).toISOString(), ...(userId ? { user: { id: userId } } : {}) });

test('profile survives a reload only for its authenticated owner and clears on signout', async t => {
  const sessionStorage = memoryStorage(), localStorage = memoryStorage();
  const originalSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
  t.after(() => {
    if (originalSession) Object.defineProperty(globalThis, 'sessionStorage', originalSession);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  let owner = 'person_one';
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
    requests.push(path);
    if (path === '/v1/me') {
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer access-fixture');
      return Response.json({ id: owner });
    }
    if (path === '/v1/auth/signout') return new Response(null, { status: 204 });
    assert.equal(path, '/v1/auth/refresh');
    assert.deepEqual(JSON.parse(String(init.body)), { refresh_token: '__cookie__' });
    return tokens();
  });
  const profile = { name: 'Fixture Seller', photo: 'https://lh3.googleusercontent.com/fixture' };
  const initial = await sessionModule();
  await initial.rememberSession(tokens(owner), profile);
  assert.deepEqual(JSON.parse(sessionStorage.getItem('secondhand-profile')!), { userId: owner, profile });
  assert.ok(!sessionStorage.getItem('secondhand-profile')!.includes('access-fixture'));
  const reloaded = await sessionModule();
  assert.deepEqual((await reloaded.getSession())?.profile, profile);
  assert.deepEqual(requests, ['/v1/auth/refresh', '/v1/me']);
  owner = 'person_two';
  assert.deepEqual((await reloaded.getSession(true))?.profile, {});
  assert.equal(JSON.parse(sessionStorage.getItem('secondhand-profile')!).userId, owner);
  await reloaded.signOutSession();
  assert.equal(reloaded.sessionSnapshot(), null);
  assert.equal(sessionStorage.getItem('secondhand-profile'), null);
});

test('parallel session reads share refresh and an API rejection retries with renewed authorization', async t => {
  const session = await sessionModule();
  let refreshes = 0, requests = 0;
  t.mock.method(globalThis, 'fetch', async (path: string) => {
    if (path === '/v1/auth/refresh') { refreshes++; return tokens(); }
    requests++;
    return new Response(null, { status: requests === 1 ? 401 : 200 });
  });
  await Promise.all([session.getSession(), session.getSession()]);
  assert.equal(refreshes, 1);
  assert.equal((await session.requestAsUser('/v1/items')).status, 200);
  assert.equal(refreshes, 2);
  assert.equal(requests, 2);
});

test('expired refresh clears authentication and protected calls do not reach user data', async t => {
  const session = await sessionModule();
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (path: string) => {
    requests++;
    assert.equal(path, '/v1/auth/refresh');
    return new Response(null, { status: 401 });
  });
  assert.equal(await session.getSession(), null);
  assert.equal((await session.requestAsUser('/v1/items')).status, 401);
  assert.equal(requests, 1);
});

test('a Google sign-in waits for an earlier refresh before changing the account', async t => {
  const session = await sessionModule();
  let finishRefresh!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finishRefresh = resolve; });
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (path: string) => {
    requests.push(path);
    return path === '/v1/auth/refresh' ? pending : tokens('new_owner');
  });
  const refresh = session.getSession();
  const verification = session.authRequest('google', { id_token: 'fixture-token' });
  assert.deepEqual(requests, ['/v1/auth/refresh']);
  finishRefresh(tokens());
  await refresh;
  await session.rememberSession(await verification, { name: 'New account' });
  assert.deepEqual(requests, ['/v1/auth/refresh', '/v1/auth/google']);
  assert.equal(session.sessionSnapshot()?.profile.name, 'New account');
});
