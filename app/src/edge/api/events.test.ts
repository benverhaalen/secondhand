import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { list, undo } from './events.ts';
import { store } from './store.ts';

const LIST = route('GET /v1/events', list);
const UNDO = route('POST /v1/events/:id/undo', undo);
beforeEach(() => {
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.verify = async (t) => ({ a: 'usr_ea', b: 'usr_eb' } as Record<string, string>)[t] ?? null;
});
const req = (path: string, token: string, post = false) =>
  new Request(`http://edge.test${path}`, { method: post ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() } });
const put = (user_id: string, item_id: string, at: string, undoable = false) => store.insertEvent({
  user_id, source: 'app', action: 'app.list', item_id, dedupe_key: crypto.randomUUID(), actor: 'auto', why: 'posted', observed_at: at, effective_at: at,
  trace_id: 't', undo: { allowed: undoable, until: undoable ? new Date(Date.now() + 3600_000).toISOString() : undefined },
}).row;

test('an item\'s timeline is the caller\'s events, newest first, in the contract row; another person\'s item is 404', async () => {
  const a = put('usr_ea', 'it_e1', '2026-11-15T04:00:00Z'), b = put('usr_ea', 'it_e1', '2026-11-15T05:00:00Z');
  put('usr_eb', 'it_e2', '2026-11-15T05:00:00Z');
  const body = await (await LIST(req('/v1/events?item_id=it_e1', 'a'))).json();
  assert.deepEqual(body.data.map((e: { event_id: string }) => e.event_id), [b.id, a.id]);
  assert.deepEqual(Object.keys(body.data[0]).sort(), ['action', 'actor', 'at', 'event_id', 'item_id', 'trace_id', 'undo', 'why']);
  assert.equal((await LIST(req('/v1/events?item_id=it_e2', 'a'))).status, 404);
});

test('pages with a cursor', async () => {
  for (let i = 0; i < 3; i++) put('usr_ea', 'it_e3', `2026-11-15T0${i}:00:00Z`);
  const p1 = await (await LIST(req('/v1/events?item_id=it_e3&limit=2', 'a'))).json();
  assert.equal(p1.data.length, 2); assert.ok(p1.next_cursor);
  const p2 = await (await LIST(req(`/v1/events?item_id=it_e3&limit=2&cursor=${p1.next_cursor}`, 'a'))).json();
  assert.equal(p2.data.length, 1); assert.equal(p2.next_cursor, null);
});

test('undo: own undoable event works once; twice or not undoable is 409 site_no_undo; foreign is 404', async () => {
  const e = put('usr_ea', 'it_e4', new Date().toISOString(), true);
  const ok = await UNDO(req(`/v1/events/${e.id}/undo`, 'a', true));
  assert.equal(ok.status, 200); assert.equal((await ok.json()).undo_of, e.id);
  const twice = await UNDO(req(`/v1/events/${e.id}/undo`, 'a', true));
  assert.equal(twice.status, 409); assert.equal((await twice.json()).code, 'site_no_undo');
  const theirs = put('usr_eb', 'it_e5', new Date().toISOString(), true);
  assert.equal((await UNDO(req(`/v1/events/${theirs.id}/undo`, 'a', true))).status, 404);
});

test('events: real people see no example events; undo replays one event and refuses a changed body', async () => {
  const owner = 'usr_' + crypto.randomUUID(), other = 'usr_' + crypto.randomUUID();
  deps.verify = async token => token === 'good' ? owner : token === 'other' ? other : null;
  const empty = await LIST(req('/v1/events', 'good'));
  assert.deepEqual((await empty.json()).data, []);
  const e = put(owner, 'it_' + crypto.randomUUID(), new Date().toISOString(), true);
  const headers = { Authorization: 'Bearer good', 'Idempotency-Key': crypto.randomUUID() };
  const request = (body: unknown, token = 'good') => new Request(`http://edge.test/v1/events/${e.id}/undo`, {
    method: 'POST', headers: { ...headers, Authorization: 'Bearer ' + token }, body: JSON.stringify(body),
  });
  const foreign = await UNDO(request({}, 'other'));
  assert.equal(foreign.status, 404); assert.equal((await foreign.json()).code, 'not_found');
  const first = await UNDO(request({})); assert.equal(first.status, 200);
  const answer = await first.json();
  const replay = await UNDO(request({})); assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), answer);
  const changed = await UNDO(request({ changed: true }));
  assert.equal(changed.status, 409); assert.equal((await changed.json()).code, 'idempotency_mismatch');
  assert.equal(store.events({ user_id: owner }).filter(row => row.undo_of === e.id).length, 1);
  assert.deepEqual((await (await LIST(req('/v1/events', 'other'))).json()).data, []);
});
