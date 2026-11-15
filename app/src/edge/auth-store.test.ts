import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as authModule from './auth.ts';
import { ApiError } from './api/http.ts';
import { createLog, memorySink } from '../../../log/index.js';

const { createAuth, memoryStore, sha } = authModule;
const email = 'store@example.com';
function service(store: authModule.AuthStore) {
  let at = Date.now();
  let code = '';
  const log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  const auth = createAuth({ store, now: () => at, log: () => log,
    verifyApple: async () => null, verifyGoogle: async () => null,
    sendCode: (_email, value) => { code = value; },
  });
  return { auth, code: () => code, tick: (ms: number) => { at += ms; } };
}
async function signIn(w: ReturnType<typeof service>, address = email) {
  await w.auth.startEmail({ email: address });
  return w.auth.verifyEmail({ email: address, code: w.code() });
}
const unauthenticated = (p: Promise<unknown>) => assert.rejects(p, e => e instanceof ApiError && e.status === 401);

function file(t: { after(fn: () => void): void }) {
  const dir = mkdtempSync(join(tmpdir(), 'secondhand-auth-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'auth.db');
}

test('separate SQLite route bundles share sessions, users, identities and pending codes', async t => {
  const path = file(t), a = new DatabaseSync(path), b = new DatabaseSync(path);
  t.after(() => { a.close(); b.close(); });
  const storeA = authModule.sqliteAuthStore(a), storeB = authModule.sqliteAuthStore(b);
  const first = service(storeA), second = service(storeB);
  await first.auth.startEmail({ email });
  assert.equal((await storeB.tryCode(await sha(`email:${email}`)))?.attempts, 1);
  const issued = await second.auth.verifyEmail({ email, code: first.code() });
  assert.equal(await first.auth.verifyAccess(issued.access_token), issued.user_id);
  const throughA = await signIn(first);
  assert.equal(throughA.user_id, issued.user_id);
  assert.equal(throughA.created, false);
  assert.equal(await second.auth.verifyAccess(throughA.access_token), issued.user_id);
  assert.equal((await storeB.getUser(issued.user_id))?.id, issued.user_id);
});

test('SQLite reopen after restart preserves sign-in, pending codes and refresh rotation', async t => {
  const path = file(t), a = new DatabaseSync(path);
  const first = service(authModule.sqliteAuthStore(a)), issued = await signIn(first);
  await first.auth.startEmail({ email: 'pending@example.com' });
  const pendingCode = first.code();
  a.close();
  const b = new DatabaseSync(path); t.after(() => b.close());
  const second = service(authModule.sqliteAuthStore(b));
  assert.equal(await second.auth.verifyAccess(issued.access_token), issued.user_id);
  assert.equal((await second.auth.verifyEmail({ email: 'pending@example.com', code: pendingCode })).created, true);
  const rotated = await second.auth.refresh({ refresh_token: issued.refresh_token });
  assert.equal(await second.auth.verifyAccess(rotated.access_token), issued.user_id);
  await unauthenticated(second.auth.refresh({ refresh_token: issued.refresh_token }));
  await unauthenticated(second.auth.refresh({ refresh_token: rotated.refresh_token }));
  assert.equal(await second.auth.verifyAccess(rotated.access_token), null);
});

for (const kind of ['memory', 'sqlite'] as const) {
  function setup(t: { after(fn: () => void): void }) {
    if (kind === 'memory') return memoryStore();
    const db = new DatabaseSync(':memory:'); t.after(() => db.close());
    return authModule.sqliteAuthStore(db);
  }
  test(`${kind}: refresh replay revokes its whole family and preserves another family`, async t => {
    const store = setup(t), w = service(store), issued = await signIn(w);
    const independent = await signIn(w);
    const rotated = await w.auth.refresh({ refresh_token: issued.refresh_token });
    const oldHash = await sha(issued.refresh_token);
    assert.ok(await store.getSession(oldHash), 'used row must stay for replay detection');
    await unauthenticated(w.auth.refresh({ refresh_token: issued.refresh_token }));
    await unauthenticated(w.auth.refresh({ refresh_token: rotated.refresh_token }));
    assert.equal(await w.auth.verifyAccess(issued.access_token), null);
    assert.equal(await w.auth.verifyAccess(rotated.access_token), null);
    assert.equal(await w.auth.verifyAccess(independent.access_token), issued.user_id);
  });
  test(`${kind}: two simultaneous refreshes cannot both rotate the same token`, async t => {
    const w = service(setup(t)), issued = await signIn(w);
    const results = await Promise.allSettled([w.auth.refresh({ refresh_token: issued.refresh_token }), w.auth.refresh({ refresh_token: issued.refresh_token })]);
    assert.deepEqual(results.map(r => r.status).sort(), ['fulfilled', 'rejected']);
    const winner = results.find(r => r.status === 'fulfilled');
    assert.ok(winner?.status === 'fulfilled');
    assert.equal(await w.auth.verifyAccess(winner.value.access_token), null, 'concurrent replay must revoke replacement access written during rotation');
    await unauthenticated(w.auth.refresh({ refresh_token: winner.value.refresh_token }));
  });
  test(`${kind}: taking an access session never consumes it`, async t => {
    const store = setup(t), w = service(store), issued = await signIn(w);
    assert.equal(await store.takeSession(await sha(issued.access_token)), null);
    assert.equal(await w.auth.verifyAccess(issued.access_token), issued.user_id);
  });
  test(`${kind}: dropUserSessions in the deleteUser path removes only that user's sessions and codes`, async t => {
    const store = setup(t), w = service(store), issued = await signIn(w);
    const other = await signIn(w, 'other@example.com');
    await w.auth.refresh({ refresh_token: issued.refresh_token });
    await w.auth.startEmail({ email });
    await w.auth.startEmail({ email: 'other@example.com' });
    const otherCode = w.code();
    await store.dropUserSessions(issued.user_id);
    assert.equal(await store.peekCode(await sha(`email:${email}`)), null);
    assert.ok(await store.peekCode(await sha('email:other@example.com')));
    assert.equal(await w.auth.verifyAccess(issued.access_token), null);
    await unauthenticated(w.auth.refresh({ refresh_token: issued.refresh_token }));
    assert.equal(await w.auth.verifyAccess(other.access_token), other.user_id);
    assert.equal((await w.auth.verifyEmail({ email: 'other@example.com', code: otherCode })).user_id, other.user_id);
  });
  test(`${kind}: reads are detached and stale user or style writes lose compare-and-set`, async t => {
    const store = setup(t), w = service(store), issued = await signIn(w);
    const u = (await store.getUser(issued.user_id))!;
    u.locale = 'fr';
    assert.equal((await store.getUser(u.id))?.locale, 'en-US');
    assert.equal(await store.putUser({ ...u, version: 2 }, 1), true);
    assert.equal(await store.putUser({ ...u, locale: 'de', version: 2 }, 1), false);
    const style = await store.getStyle(u.id);
    style.facets.length = 0;
    assert.ok((await store.getStyle(u.id)).facets.length > 0);
    assert.equal(await store.putStyle(u.id, { ...style, version: 2 }, 1), true);
    assert.equal(await store.putStyle(u.id, { ...style, version: 3 }, 1), false);
    const identity = (await store.identitiesOf(u.id))[0];
    identity.user_id = 'usr_changed';
    assert.equal((await store.findIdentity(identity.provider, identity.subject_hash))?.user_id, u.id);
    const h = await sha(`email:${email}`);
    await store.putCode(h, { hash: 'hash', expires_at: Date.now() + 600000, sent_at: Date.now(), attempts: 0 });
    const peek = (await store.peekCode(h))!; peek.attempts = 99;
    const attempts = await Promise.all(Array.from({ length: 6 }, () => store.tryCode(h)));
    assert.deepEqual(attempts.map(c => c?.attempts), [1, 2, 3, 4, 5, 6]);
  });
}


test('replay during rotation in another SQLite bundle cannot resurrect the revoked family', async t => {
  const path = file(t), a = new DatabaseSync(path), b = new DatabaseSync(path);
  t.after(() => { a.close(); b.close(); });
  const first = service(authModule.sqliteAuthStore(a)), second = service(authModule.sqliteAuthStore(b));
  const issued = await signIn(first);
  const results = await Promise.allSettled([first.auth.refresh({ refresh_token: issued.refresh_token }), second.auth.refresh({ refresh_token: issued.refresh_token })]);
  assert.deepEqual(results.map(r => r.status).sort(), ['fulfilled', 'rejected']);
  const winner = results.find(r => r.status === 'fulfilled');
  assert.ok(winner?.status === 'fulfilled');
  assert.equal(await second.auth.verifyAccess(winner.value.access_token), null);
  await unauthenticated(first.auth.refresh({ refresh_token: winner.value.refresh_token }));
});
