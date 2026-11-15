// Contract tests for /v1/me*: key sets equal spec/examples, one user never reads another, stale writes are 409.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, memoryStore } from '../auth.ts';
import { ApiError, deps, resetRequestState, route, type Ctx } from './http.ts';
import { example } from './examples.ts';
import { makeAuthHandlers } from './auth.ts';
import { makeMeHandlers } from './me.ts';
import { createRuntime } from './runtime.ts';
import { memoryVault } from '../browser/auth.ts';
import { getJob, jobsOn } from './jobs.ts';
import { memoryStore as eventStore, TABLES, type Store, type StoreState } from '../events/ports.ts';
import type { Db, Vault } from '../data/data.ts';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';

const keys = (o: unknown): unknown => Array.isArray(o) ? (typeof o[0] === 'object' ? keys(o[0]) : 'array') : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, keys((o as Record<string, unknown>)[k])])) : typeof o;
const shape = (name: string) => keys((example(name) as { response: unknown }).response);

async function world(workspace?: { db: Db; vault: Vault }) {
  let t = Date.parse('2026-11-15T03:00:00Z'); const store = memoryStore();
  const sink = memorySink(), log = createLog({ src: 'edge.me.test', build: 'test', sink });
  const runtime = createRuntime(eventStore(), log, { now: () => t, vault: memoryVault() });
  const auth = createAuth({ store, now: () => t, verifyApple: async (k) => ({ subject: k }), verifyGoogle: async () => null, sendCode: () => {} });
  deps.verify = auth.verifyAccess; resetRequestState(); deps.now = () => t; deps.log = log;
  const a = makeAuthHandlers(auth, store), m = makeMeHandlers({ store, auth, now: () => t, runtime, workspace });
  const r = {
    apple: route('POST /v1/auth/apple', a.apple, { auth: 'none' }), get: route('GET /v1/me', m.get), patch: route('PATCH /v1/me', m.patch), del: route('DELETE /v1/me', m.delete),
    exp: route('POST /v1/me/export', m.export), sget: route('GET /v1/me/style', m.styleGet), spatch: route('PATCH /v1/me/style', m.stylePatch),
    job: route('GET /v1/jobs/:id', getJob(jobsOn(runtime.store))),
  };
  const call = (f: (q: Request) => Promise<Response>, method: string, path: string, bearer: string, body?: unknown) =>
    f(new Request(`http://x${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { Authorization: `Bearer ${bearer}` } }));
  const user = async (sub: string) => (await (await r.apple(new Request('http://x/v1/auth/apple', { method: 'POST', body: JSON.stringify({ identity_token: sub, nonce: 'n' }) }))).json()) as { access_token: string; user: { id: string } };
  return { r, call, user, runtime, store, sink, m, tick: (ms: number) => { t += ms; } };
}

function seedPerson(st: Store, user_id: string) {
  for (const table of TABLES) st.put(table, { id: 'shared', user_id, data: 'synthetic', ...(table === 'account' ? { site: 'ebay', token_ref: `vault/${user_id}` } : {}) });
  st.insertEvent({ user_id, source: 'app', action: 'app.list', dedupe_key: 'shared', actor: 'user', observed_at: 'x', effective_at: 'x', trace_id: 't' });
  st.insertJob({ kind: 'post', user_id, event_id: 'e', idempotency_key: 'shared', args: {}, state: 'queued', stages: [], attempts: 0, trace_id: 't', created_at: 'x' });
  st.raiseDecision({ user_id, kind: 'first_post', subject: 'shared', why: 'approval', options: [] });
}

test('DELETE removes all owned Store data and vault sign-ins, preserves the other person, and refuses a second DELETE', async () => {
  const w = await world(), a = await w.user('a'), b = await w.user('b'), st = w.runtime.store;
  seedPerson(st, a.user.id); seedPerson(st, b.user.id);
  const state = { cookies: [], origins: [] };
  await w.runtime.vault.put(`vault/${a.user.id}`, state); await w.runtime.vault.put(`vault/${b.user.id}`, state);
  // A stale/unlinked account still owns a vault entry that must go.
  st.put('account', { id: 'stale', user_id: a.user.id, token_ref: `stale/${a.user.id}` });
  await w.runtime.vault.put(`stale/${a.user.id}`, state);
  const before = st.exportUser(b.user.id);
  const res = await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token);
  assert.equal(res.status, 202);
  const purge = await res.json() as { id: string; kind: string; state: string };
  assert.equal(purge.kind, 'delete_user'); assert.equal(purge.state, 'queued');
  assert.deepEqual(st.exportUser(b.user.id), before, 'every other-person row and count is unchanged');
  assert.equal(await w.runtime.vault.get(`vault/${a.user.id}`), undefined);
  assert.equal(await w.runtime.vault.get(`stale/${a.user.id}`), undefined);
  assert.deepEqual(await w.runtime.vault.get(`vault/${b.user.id}`), state);
  for (const table of TABLES) assert.deepEqual(st.rows(table, { user_id: a.user.id }), [], table);
  assert.deepEqual(st.events({ user_id: a.user.id }), []); assert.deepEqual(st.decisions({ user_id: a.user.id }), []);
  assert.deepEqual(st.jobs({ user_id: a.user.id }).map(row => row.id), [purge.id], 'only the new purge job remains');
  assert.deepEqual(st.getJob(purge.id)?.args, { user_id: a.user.id });
  assert.equal((await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token)).status, 401, 'repeat DELETE is unauthorized, never 500');
  assert.equal((await w.call(w.r.get, 'GET', '/v1/me', b.access_token)).status, 200);
  assert.ok(!w.sink.text().includes(`vault/${a.user.id}`), 'logs cannot carry vault references');
});

test('workspace purge stays queued with a visible reason when no Db port is configured', async () => {
  const w = await world(), a = await w.user('a');
  const response = await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token), job = await response.json() as { id: string };
  assert.equal(await w.runtime.pipeline.runOnce(100), 0, 'unconfigured purge must not be run by the generic worker');
  const stored = w.runtime.store.getJob(job.id)!;
  assert.equal(stored.state, 'queued'); assert.equal(stored.reason, 'workspace port not configured');
  // The deleted session is gone; inspect the same GET handler with the owner's context.
  const get = route('GET /v1/jobs/:id', getJob(jobsOn(w.runtime.store)));
  deps.verify = async () => a.user.id;
  const res = await w.call(get, 'GET', `/v1/jobs/${job.id}`, 'owner-context');
  const visible = await res.json() as { state: string; reason: string };
  assert.equal(res.status, 200); assert.equal(visible.state, 'queued'); assert.equal(visible.reason, 'workspace port not configured');
});

test('configured workspace purge uses data.ts to delete and scan only the deleted person', async () => {
  let rows: { user_id: string; token_ref?: string }[] = [];
  const secrets = new Set<string>();
  const db: Db = { async query(sql, params = []) {
    if (sql.includes('from pg_class')) return { rows: [{ relname: 'account' }] };
    if (sql.startsWith('select distinct token_ref')) return { rows: rows.filter(row => row.user_id === params[0]) };
    if (sql.includes('from pg_constraint')) return { rows: [] };
    if (sql.startsWith('delete from "account"')) {
      const deleted = rows.filter(row => row.user_id === params[0]); rows = rows.filter(row => row.user_id !== params[0]); return { rows: deleted };
    }
    if (sql.startsWith('select count(*)')) return { rows: [{ n: rows.filter(row => row.user_id === params[0]).length }] };
    throw new Error('unexpected workspace query');
  } };
  const vault: Vault = { async delete(key) { secrets.delete(key); }, async list(prefix) { return [...secrets].filter(key => key.startsWith(prefix)); } };
  const w = await world({ db, vault }), a = await w.user('a'), b = await w.user('b');
  rows = [{ user_id: a.user.id, token_ref: `workspace/${a.user.id}` }, { user_id: b.user.id, token_ref: `workspace/${b.user.id}` }];
  rows.forEach(row => secrets.add(row.token_ref!));
  const other = structuredClone(rows[1]);
  const res = await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token);
  assert.equal(res.status, 202); const job = await res.json() as { id: string; state: string };
  assert.equal(job.state, 'done'); assert.deepEqual(rows, [other]);
  assert.deepEqual([...secrets], [other.token_ref]);
  assert.deepEqual(w.runtime.store.getJob(job.id)?.result, { counts: { account: 1 }, scan: { account: 0 } });
  assert.ok(!w.sink.text().includes(`workspace/${a.user.id}`));
});

test('configured workspace failure is a failed job with no private error text in its response or logs', async () => {
  const privateDetail = `private-${crypto.randomUUID()}`;
  const db: Db = { async query() { throw new Error(privateDetail); } };
  const vault: Vault = { async delete() {}, async list() { return []; } };
  const w = await world({ db, vault }), a = await w.user('a');
  const res = await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token);
  assert.equal(res.status, 202); const job = await res.json() as { id: string; state: string };
  assert.equal(job.state, 'failed'); assert.equal(w.runtime.store.getJob(job.id)?.state, 'failed');
  assert.ok(!w.sink.text().includes(privateDetail)); assert.ok(!JSON.stringify(job).includes(privateDetail));
  assert.equal((await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token)).status, 401);
});

test('a vault failure still attempts every sign-in, revokes sessions, tracks the purge and exposes no private error', async () => {
  const w = await world(), a = await w.user('a'), b = await w.user('b'), st = w.runtime.store;
  const refs = [`vault/${a.user.id}/first`, `vault/${a.user.id}/second`], other = `vault/${b.user.id}`;
  for (const [i, token_ref] of refs.entries()) st.put('account', { id: `acc_${i}`, user_id: a.user.id, token_ref });
  for (const ref of [...refs, other]) await w.runtime.vault.put(ref, { cookies: [], origins: [] });
  const remove = w.runtime.vault.delete, attempted: string[] = [], privateDetail = crypto.randomUUID();
  w.runtime.vault.delete = async ref => {
    attempted.push(ref);
    if (ref === refs[0]) throw new Error(privateDetail);
    await remove(ref);
  };
  const res = await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token);
  assert.equal(res.status, 503, 'failed vault cleanup must never be acknowledged as complete');
  const error = await res.json() as { job_id: string };
  assert.deepEqual(attempted, [...refs, `push/${a.user.id}`], 'one failure cannot skip the remaining sign-ins or push registration');
  assert.equal(await w.runtime.vault.get(refs[1]), undefined); assert.ok(await w.runtime.vault.get(other));
  assert.equal(st.getJob(error.job_id)?.kind, 'delete_user'); assert.equal(st.getJob(error.job_id)?.state, 'queued');
  assert.equal(st.getJob(error.job_id)?.error?.code, 'vault_delete_failed');
  assert.equal((await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token)).status, 401);
  assert.ok(!w.sink.text().includes(privateDetail)); assert.ok(!JSON.stringify(error).includes(privateDetail));
});

test('me export and deletion logs follow the event contract and contain only ids and counts', async () => {
  const db: Db = { async query() { return { rows: [] }; } };
  const vault: Vault = { async delete() {}, async list() { return []; } };
  const w = await world({ db, vault }), a = await w.user('a');
  const ref = `vault/${a.user.id}`;
  w.runtime.store.put('account', { id: 'acc_1', user_id: a.user.id, token_ref: ref });
  await w.runtime.vault.put(ref, { cookies: [], origins: [] });
  const sink = memorySink(), log = createLog({ src: 'edge.me', build: 'test', sink });
  const ctx = { user_id: a.user.id, visitor_id: null, request_id: 'rq_me', params: {}, query: new URLSearchParams(), body: {}, headers: new Headers(), log };
  await w.m.export(ctx); await w.m.delete(ctx); log.end();
  assert.deepEqual(checkLog(sink.text()).problems, [], 'handler logs obey spec/events.json');
  assert.ok(!sink.text().includes(ref));
});

test('export job returns only the owner snapshot, redacts nested token_ref values, and is hidden from other people', async () => {
  const w = await world(), a = await w.user('a'), b = await w.user('b'), st = w.runtime.store;
  seedPerson(st, a.user.id); seedPerson(st, b.user.id);
  st.put('item', { id: 'nested', user_id: a.user.id, nested: [{ token_ref: `nested/${a.user.id}` }], push_token_ref: `push/${a.user.id}` });
  const snapshot = st.exportUser(a.user.id);
  const res = await w.call(w.r.exp, 'POST', '/v1/me/export', a.access_token, {});
  assert.equal(res.status, 202); const job = await res.json() as { id: string };
  const read = await w.call(w.r.job, 'GET', `/v1/jobs/${job.id}`, a.access_token);
  assert.equal(read.status, 200); const exported = await read.json() as { state: string; result: StoreState };
  assert.equal(exported.state, 'done');
  const expected = structuredClone(snapshot);
  expected.rows.account![0].token_ref = '[held in the vault]';
  const nested = expected.rows.item!.find(row => row.id === 'nested')!;
  nested.nested = [{ token_ref: '[held in the vault]' }]; nested.push_token_ref = '[held in the vault]';
  assert.deepEqual(exported.result, expected);
  assert.ok(!JSON.stringify(exported).includes(`vault/${a.user.id}`));
  assert.ok(!JSON.stringify(exported).includes(`nested/${a.user.id}`));
  assert.ok(!JSON.stringify(exported).includes(`push/${a.user.id}`));
  assert.equal((await w.call(w.r.job, 'GET', `/v1/jobs/${job.id}`, b.access_token)).status, 404);
  assert.deepEqual(st.rows('account', { user_id: a.user.id }), snapshot.rows.account, 'export redaction never mutates the Store');
});

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
  const w = await world(); const a = await w.user('a'); let v = 1;
  let last: { version: number; onboarding: { next_step: string | null; finished_at: string; done_steps: string[] } };
  for (const s of ['signed_in', 'sites_picked', 'sites_linked', 'imported', 'email', 'pickups', 'notifications']) {
    last = await (await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: v, onboarding_step: s })).json(); v = last.version;
    if (s === 'signed_in') assert.deepEqual(keys(last), shape('me.patch.onboarding'));
  }
  assert.equal(v, 8); assert.equal(last!.onboarding.next_step, null); assert.match(last!.onboarding.finished_at, /^2026-11-15T/);
  assert.equal(last!.onboarding.done_steps.length, 7);
});
test('PATCH notifications with a push token: push_registered, example key set, and the token is never echoed', async () => {
  const w = await world(); const a = await w.user('a');
  const res = await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, onboarding_step: 'notifications', push_token: 'ExponentPushToken[x]', notification_pref: [{ event_kind: 'sale', channel: 'push', on: true }] });
  const b = await res.json(); assert.equal(res.status, 200); assert.equal(b.push_registered, true);
  assert.deepEqual(keys(b), { ...(shape('me.patch.notifications') as object), onboarding: keys(b.onboarding) }); assert.ok(!JSON.stringify(b).includes('ExponentPushToken'));
  assert.equal((await (await w.call(w.r.get, 'GET', '/v1/me', a.access_token)).json()).notification_pref.length, 1);
});
test('push token belongs in the vault behind a user ref, stays out of GET and export, and DELETE removes it', async () => {
  const w = await world(), a = await w.user('push-owner'), token = crypto.randomUUID(), ref = `push/${a.user.id}`;
  const res = await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, push_token: token });
  assert.equal(res.status, 200);
  const user = await w.store.getUser(a.user.id);
  assert.equal(user?.push_token_ref, ref);
  assert.ok(!JSON.stringify(user).includes(token));
  assert.deepEqual(await w.runtime.vault.get(ref), { cookies: [], origins: [], push_token: token });
  const visible = await (await w.call(w.r.get, 'GET', '/v1/me', a.access_token)).text();
  assert.ok(!visible.includes(token)); assert.ok(!visible.includes(ref));
  const exp = await (await w.call(w.r.exp, 'POST', '/v1/me/export', a.access_token)).json() as { id: string };
  const exported = await (await w.call(w.r.job, 'GET', `/v1/jobs/${exp.id}`, a.access_token)).text();
  assert.ok(!exported.includes(token)); assert.ok(!exported.includes(ref));
  assert.equal((await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token)).status, 202);
  assert.equal(await w.runtime.vault.get(ref), undefined);
  assert.ok(!w.sink.text().includes(token));
});

test('stale push token patch writes nothing and concurrent patches store only the winning token', async () => {
  const w = await world(), a = await w.user('push-race'), ref = `push/${a.user.id}`;
  const tokens = [crypto.randomUUID(), crypto.randomUUID()];
  const results = await Promise.all(tokens.map(push_token => w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, push_token })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const winner = results.findIndex(r => r.status === 200);
  assert.deepEqual(await w.runtime.vault.get(ref), { cookies: [], origins: [], push_token: tokens[winner] });
  const before = await w.runtime.vault.snapshot(ref);
  assert.equal((await w.call(w.r.patch, 'PATCH', '/v1/me', a.access_token, { version: 1, push_token: crypto.randomUUID() })).status, 409);
  assert.deepEqual(await w.runtime.vault.snapshot(ref), before);
});

test('DELETE racing the first push token PATCH removes the token even when its user snapshot has no ref', async () => {
  const w = await world(), a = await w.user('push-delete-race'), token = crypto.randomUUID();
  const ctx: Ctx = { user_id: a.user.id, visitor_id: null, request_id: 'push-delete-race', body: { version: 1, push_token: token }, log: deps.log,
    params: {}, query: new URLSearchParams(), headers: new Headers() };
  const [patch, deleted] = await Promise.all([
    w.m.patch(ctx).catch((error: unknown) => {
      assert.ok(error instanceof ApiError); assert.equal(error.code, 'stale'); return { status: 409 };
    }),
    w.m.delete(ctx),
  ]);
  assert.ok([200, 409].includes(patch.status)); assert.equal(deleted.status, 202);
  assert.equal(await w.runtime.vault.get(`push/${a.user.id}`), undefined);
});

test('a push PATCH admitted before DELETE cannot recreate its token after vault cleanup', async () => {
  const w = await world(), a = await w.user('push-admitted-before-delete');
  const ctx: Ctx = { user_id: a.user.id, visitor_id: null, request_id: 'admitted-before-delete', body: { version: 1, push_token: crypto.randomUUID() }, log: deps.log,
    params: {}, query: new URLSearchParams(), headers: new Headers() };
  assert.equal((await w.m.delete(ctx)).status, 202);
  await assert.rejects(w.m.patch(ctx), (error: unknown) => {
    assert.ok(error instanceof ApiError); assert.equal(error.code, 'stale'); return true;
  });
  assert.equal(await w.runtime.vault.get(`push/${a.user.id}`), undefined);
});

test('a fresh sign-in after DELETE can register push again using the current user version', async () => {
  const w = await world(), a = await w.user('push-returning');
  assert.equal((await w.call(w.r.del, 'DELETE', '/v1/me', a.access_token)).status, 202);
  const returning = await w.user('push-returning');
  const current = await (await w.call(w.r.get, 'GET', '/v1/me', returning.access_token)).json() as { version: number };
  const token = crypto.randomUUID();
  const res = await w.call(w.r.patch, 'PATCH', '/v1/me', returning.access_token, { version: current.version, push_token: token });
  assert.equal(res.status, 200);
  assert.deepEqual(await w.runtime.vault.get(`push/${returning.user.id}`), { cookies: [], origins: [], push_token: token });
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
  const g = await (await w.call(w.r.sget, 'GET', '/v1/me/style', a.access_token)).json();
  assert.deepEqual(Object.keys(g).sort(), Object.keys(shape('me.style.get') as Record<string, unknown>).sort());
  assert.deepEqual(g.facets, [], 'a new person starts with no taste facets, never the example ones');
  const added = await (await w.call(w.r.spatch, 'PATCH', '/v1/me/style', a.access_token, { version: g.version, facets: [{ name: 'size', value: 'L' }, { name: 'era', value: '1990s' }] })).json();
  assert.equal(added.version, g.version + 1); assert.deepEqual(keys(added), shape('me.style.patch'));
  const body = { version: added.version, facets: [{ name: 'size', value: 'L', weight: 0.9, pinned: true }, { name: 'era', value: '1990s', remove: true }] };
  const p = await w.call(w.r.spatch, 'PATCH', '/v1/me/style', a.access_token, body); assert.equal(p.status, 200);
  const b = await p.json(); assert.deepEqual(keys(b), shape('me.style.patch')); assert.equal(b.version, added.version + 1);
  assert.equal(b.facets.find((f: { name: string }) => f.name === 'size').from, 'edited'); assert.ok(b.facets.find((f: { name: string }) => f.name === 'era').removed_at);
  assert.equal((await w.call(w.r.spatch, 'PATCH', '/v1/me/style', a.access_token, body)).status, 409);
});
