import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route } from './http.ts';
import { EXAMPLES, type Example } from './examples.ts';
import { handlers, manifest, replyPorts, seedConversations } from './conversations.ts';
import { memoryStore } from '../events/ports.ts';

const prefixes = ["conversations"];
const examples = EXAMPLES.filter(e => prefixes.includes(e.endpoint.split(' ')[1].split('/')[2]));
beforeEach(() => {
  replyPorts.store = memoryStore(); seedConversations(replyPorts.store);
  deps.verify = async token => token === 'good' ? 'usr_8f2k' : token === 'other' ? 'usr_other' : null;
  deps.log = createLog({ src: 'test', build: 'test', sink: memorySink() });
  deps.idem.clear(); deps.visits.clear(); deps.now = () => Date.now();
});
const call = (e: Example, options: { body?: unknown; raw?: string; path?: string; token?: string | null; headers?: Record<string, string> } = {}) => {
  const token = options.token === undefined ? (e.auth === 'visitor' ? null : 'good') : options.token;
  const entry = manifest.find(m => m.endpoint === e.endpoint)!;
  return route(e.endpoint, handlers[e.endpoint], { auth: entry.auth })(new Request('http://edge.test' + (options.path ?? e.path), {
    method: e.endpoint.split(' ')[0],
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...e.request?.headers, ...options.headers },
    body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : e.request?.body === undefined ? undefined : JSON.stringify(e.request.body)),
  }));
};
test('conversations: every specified endpoint is registered and declares its answer source', () => {
  assert.deepEqual(Object.keys(handlers).sort(), [...new Set(examples.filter(e => e.status < 400).map(e => e.endpoint))].sort());
  assert.deepEqual(manifest.map(m => m.endpoint).sort(), Object.keys(handlers).sort());
  for (const m of manifest) assert.ok(['example', 'engine'].includes(m.source));
});
for (const e of examples.filter(e => e.status < 400)) test(e.name + ': response equals its contract example', async () => {
  const r = await call(e);
  assert.equal(r.status, e.status);
  assert.ok(r.headers.get('X-Request-Id'));
  for (const [key, value] of Object.entries(e.headers ?? {})) assert.equal(r.headers.get(key), value);
  if (e.response === null) assert.equal(await r.text(), '');
  else { const body = await r.json(); if (e.name === 'conversations.reply') { assert.ok(replyPorts.store.getJob(body.id)); body.id = (e.response as { id: string }).id; } assert.deepEqual(body, e.response); }
});
for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor' && e.name !== 'conversations.reply')) test(e.name + ': wrong user cannot read or act on example data', async () => {
  const r = await call(e, { token: 'other' });
  if (['items.list', 'conversations.list', 'orders.list'].includes(e.name)) { // a list: a person who owns nothing gets an empty list, never the example rows
    assert.equal(r.status, 200);
    for (const value of Object.values(await r.json() as Record<string, unknown>)) if (Array.isArray(value)) assert.deepEqual(value, [], `${e.name} shows another person's rows`);
    return;
  }
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});
for (const e of examples.filter(e => e.status < 400 && e.endpoint.includes(':id'))) test(e.name + ': unknown resource is 404', async () => {
  const pattern = e.endpoint.split(' ')[1].split('/'), parts = e.path.split('?')[0].split('/');
  parts[pattern.indexOf(':id')] = 'not_mine';
  const r = await call(e, { path: parts.join('/') });
  assert.equal(r.status, 404); assert.equal((await r.json()).code, 'not_found');
});
for (const e of examples.filter(e => e.status < 400 && ['POST', 'PATCH', 'PUT'].includes(e.endpoint.split(' ')[0]))) test(e.name + ': malformed body is 400 with code', async () => {
  for (const raw of ['{', '[]', 'null']) {
    const r = await call(e, { raw }); assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
  if (e.request?.body && Object.keys(e.request.body).length) {
    const r = await call(e, { body: {} }); assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
  }
});
for (const e of examples.filter(e => e.status < 400 && e.endpoint.startsWith('POST '))) test(e.name + ': reconnect replays same action and rejects changed body', async () => {
  const headers = { 'Idempotency-Key': 'test_reconnect', ...(e.auth === 'visitor' ? { 'X-Visitor-Id': 'vis_worker01' } : {}) };
  const first = await call(e, { headers }), again = await call(e, { headers });
  assert.equal(again.status, first.status); assert.equal(await again.text(), await first.text());
  assert.equal(again.headers.get('Idempotent-Replayed'), 'true');
  const changed = await call(e, { headers, body: { ...((e.request?.body ?? {}) as object), changed: true } });
  assert.equal(changed.status, 409); assert.equal((await changed.json()).code, 'idempotency_mismatch');
});

for (const e of examples.filter(e => e.status < 400 && e.auth !== 'visitor')) test(e.name + ': no bearer is 401', async () => {
  assert.equal((await call(e, { token: null })).status, 401);
});
for (const e of examples.filter(e => e.status < 400 && e.request?.body && typeof e.request.body === 'object' && 'version' in e.request.body)) test(e.name + ': stale version cannot act', async () => {
  const body = e.request!.body as Record<string, unknown>;
  const r = await call(e, { body: { ...body, version: Number(body.version) + 100 } });
  assert.equal(r.status, 409); const error = await r.json(); assert.equal(error.code, 'stale'); assert.equal(error.current.version, body.version);
});
test('conversations: limit over 100 is refused', async () => {
  const e = examples.find(e => e.status < 400)!;
  const r = await call(e, { path: e.path + (e.path.includes('?') ? '&' : '?') + 'limit=101' });
  assert.equal(r.status, 400); assert.equal((await r.json()).code, 'invalid');
});

test('conversations: malformed field values name the validation failure', async () => {
  const cases: [string, unknown][] = [["conversations.reply",{"text":10}],["conversations.reply",{"text":"   "}]];
  for (const [name, body] of cases) {
    const e = examples.find(e => e.name === name)!;
    const r = await call(e, { body }); assert.equal(r.status, 400, name);
    const error = await r.json(); assert.equal(error.code, 'invalid'); assert.equal(error.failed_step, 'validate');
  }
});

test('conversations: owned Expo files bind auth and export the contract method', async () => {
  const { readFileSync } = await import('node:fs');
  for (const entry of manifest) {
    const [method, pattern] = entry.endpoint.split(' '), parts = pattern.split('/').slice(2);
    if (parts[0] !== 'conversations') continue;
    const relative = parts.map(p => p.startsWith(':') ? '[' + p.slice(1) + ']' : p).join('/') + (parts.length === 1 || parts.at(-1)!.startsWith(':') ? '/index+api.ts' : '+api.ts');
    const source = readFileSync(new URL('../../app/v1/' + relative, import.meta.url), 'utf8');
    assert.ok(source.includes("import '@/edge/auth'"), relative);
    assert.ok(source.includes("export const " + method + " = route('" + entry.endpoint + "'"), relative);
    if (entry.auth === 'visitor') assert.ok(source.includes("auth: 'visitor'"), relative);
  }
});

test('conversation reads validate stored incoming messages before returning history', async () => {
  const row = replyPorts.store.get('conversation', 'usr_8f2k', 'cv_6t1')!;
  const messages = (EXAMPLES.find(e => e.name === 'conversations.messages')!.response as { data: Record<string, unknown>[] }).data;
  replyPorts.store.put('conversation', { ...row, messages: messages.map(message => ({ ...message, sent_at: 'not-a-date' })) });
  const response = await call(examples.find(e => e.name === 'conversations.messages')!);
  assert.equal(response.status, 503);
});

test('a message without an offer raises no offer decision; a parsed offer raises one with its amount', async () => {
  const { ports } = await import('./conversations.ts');
  const { handleMessages, memoryMessageStore } = await import('../messages/messages.ts');
  const account = { user_id: 'usr_8f2k', account_id: 'acc_depop', site: 'depop', linked: true, health: 'ok', auto_reply: 'off', ask_every_time: true, site_approved: false, promoted: new Set<string>() } as const;
  const rows = await ports.read_messages(account);
  const views = (EXAMPLES.find(e => e.name === 'conversations.messages')!.response as { data: { id: string; offer?: { amount_cents: number } }[] }).data;
  for (const hasOffer of [false, true]) {
    const row = rows.find(row => Boolean(views.find(view => view.id === row.id)?.offer) === hasOffer)!;
    assert.ok(row, 'fixture must cover messages with and without offers');
    const context = await ports.context(account, row);
    assert.equal(Boolean(context.offer), hasOffer, 'no parsed offer must produce no offer context');
    const result = await handleMessages(account, { ...ports, read_messages: async () => [row] }, memoryMessageStore(), deps.log);
    const decisions = result.filter(row => row.kind === 'decision');
    assert.equal(decisions.length, hasOffer ? 1 : 0, 'a message without an offer must raise no decision');
    if (hasOffer) assert.equal(decisions[0].amount_cents, views.find(view => view.id === row.id)!.offer!.amount_cents);
  }
});

test('reply: unsupported claim writes no event; a repeated acknowledgment writes one approved event', async () => {
  const store = replyPorts.store;
  const e = examples.find(e => e.name === 'conversations.reply')!;
  const before = store.events().length;
  const held = await call(e, { body: { text: 'This is brand new and never worn.' }, headers: { 'Idempotency-Key': 'held' } });
  assert.equal(held.status, 422, 'unbacked claim must be held');
  assert.equal((await held.json()).failed_step, 'claim_check');
  assert.equal(store.events().length, before);
  const options = { body: { text: 'Thanks!' }, headers: { 'Idempotency-Key': 'approved-reply' } };
  const sent = await call(e, options); await call(e, options);
  assert.equal(sent.status, 202);
  const events = store.events().slice(before);
  assert.equal(events.length, 1); assert.equal(events[0].actor, 'user'); assert.equal(events[0].why, 'your reply');
  assert.equal(store.getJob((await sent.json()).id)?.event_id, events[0].id);
});

test('reply: durable dedupe survives HTTP cache loss, retains text by reference, and logs no text', async () => {
  const sink = memorySink(); deps.log = createLog({ src: 'test', build: 'test', sink });
  const e = examples.find(e => e.name === 'conversations.reply')!;
  const opts = { body: { text: 'Thanks!' }, headers: { 'Idempotency-Key': 'durable-reply' } };
  const first = await (await call(e, opts)).json(); deps.idem.clear();
  const second = await (await call(e, opts)).json();
  assert.deepEqual(second, first);
  const st = replyPorts.store;
  assert.equal(st.events().length, 1); assert.equal(st.jobs().length, 1);
  const job = st.getJob(first.id)!;
  const row = st.get('conversation', 'usr_8f2k', 'cv_6t1')!;
  assert.deepEqual(row.outgoing, [{ id: job.args.text_ref, text: 'Thanks!' }]);
  assert.equal(JSON.stringify(st.events()).includes('Thanks!'), false);
  assert.equal(sink.text().includes('Thanks!'), false);
});

test('reply: confirmed stored attributes back a claim; missing support refuses it', async () => {
  replyPorts.store.put('item', { id: 'it_7c2m', user_id: 'usr_8f2k', attributes: [{ id: 'att_lining', name: 'lining', value: 'blanket lined', confirmed: true }] });
  const e = examples.find(e => e.name === 'conversations.reply')!;
  assert.equal((await call(e, { body: { text: 'Blanket lined.' }, headers: { 'Idempotency-Key': 'backed' } })).status, 202);
  assert.equal((await call(e, { body: { text: 'Ships tomorrow.' }, headers: { 'Idempotency-Key': 'unsupported' } })).status, 422);
  assert.equal(replyPorts.store.events().length, 1);
});

test('reply: backing one fact cannot authorize an extra claim in the same sentence', async () => {
  replyPorts.store.put('item', { id: 'it_7c2m', user_id: 'usr_8f2k', attributes: [{ id: 'att_lining', name: 'lining', value: 'blanket lined', confirmed: true }] });
  const response = await call(examples.find(e => e.name === 'conversations.reply')!, { body: { text: 'Blanket lined and never worn' } });
  assert.equal(response.status, 422);
  assert.equal(replyPorts.store.events().length, 0);
});

test('reply: original unsupported fixture answers the claim_check error contract', async () => {
  const e = examples.find(e => e.name === 'conversations.reply.unbacked')!;
  const response = await call(e);
  assert.equal(response.status, e.status); assert.deepEqual(await response.json(), e.response);
});

test('reply: changed durable key is refused after HTTP cache loss', async () => {
  const e = examples.find(e => e.name === 'conversations.reply')!;
  await call(e); deps.idem.clear();
  const response = await call(e, { body: { text: 'Thank you!' } });
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'idempotency_mismatch');
});

test('reply: concurrent valid replies retain both text references and events', async () => {
  const e = examples.find(e => e.name === 'conversations.reply')!;
  const responses = await Promise.all(['one', 'two'].map(key => call(e, { headers: { 'Idempotency-Key': key } })));
  assert.deepEqual(responses.map(r => r.status), [202, 202]);
  assert.equal(replyPorts.store.events().length, 2);
  assert.equal((replyPorts.store.get('conversation', 'usr_8f2k', 'cv_6t1')!.outgoing as unknown[]).length, 2);
});

test('reply: concurrent changed bodies on one key return one job and a 409', async () => {
  const e = examples.find(e => e.name === 'conversations.reply')!;
  const responses = await Promise.all(['Thanks!', 'Hello!'].map(text => call(e, { body: { text }, headers: { 'Idempotency-Key': 'racing-key' } })));
  assert.deepEqual(responses.map(r => r.status).sort(), [202, 409]);
  assert.equal(replyPorts.store.events().length, 1); assert.equal(replyPorts.store.jobs().length, 1);
});

test('reply: a new person can reply in their own conversation while foreign conversations are 404', async () => {
  const st = replyPorts.store;
  st.put('conversation', { id: 'cv_new', user_id: 'usr_other', site: 'depop', account_id: 'acc_other' });
  const e = examples.find(e => e.name === 'conversations.reply')!;
  for (const options of [{ token: 'other' }, { path: '/v1/conversations/cv_new/messages' }]) {
    const response = await call(e, options);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'not_found');
  }
  assert.equal(st.events().length, 0, 'foreign replies must write no event');
  const response = await call(e, { token: 'other', path: '/v1/conversations/cv_new/messages', body: { text: 'Thanks!' } });
  assert.equal(response.status, 202, 'reply permission comes from conversation ownership');
  const job = st.getJob((await response.json()).id)!;
  assert.equal(st.events({ user_id: 'usr_other' }).length, 1);
  assert.equal(st.events({ user_id: 'usr_8f2k' }).length, 0);
  assert.deepEqual(st.get('conversation', 'usr_other', 'cv_new')?.outgoing, [{ id: job.args.text_ref, text: 'Thanks!' }]);
});


test('owned conversation reads return only stored rows and history, never the example thread', async () => {
  const messages = [{ id: 'msg_own', actor: 'counterpart', text: 'Hello', sent_at: '2026-11-15T12:00:00Z', intent: 'greeting', facets: [] }];
  replyPorts.store.put('conversation', { id: 'cv_own', user_id: 'usr_other', site: 'depop', messages });
  const response = await call(examples.find(e => e.name === 'conversations.list')!, { token: 'other' });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.map((row: { id: string }) => row.id), ['cv_own']);
  const history = await call(examples.find(e => e.name === 'conversations.messages')!, { token: 'other', path: '/v1/conversations/cv_own/messages' });
  assert.equal(history.status, 200);
  assert.deepEqual(await history.json(), { data: messages, next_cursor: null });
});

test('conversation example seeding and existing rows obey the examples switch', async t => {
  const previous = process.env.SECONDHAND_EXAMPLES;
  t.after(() => { if (previous === undefined) delete process.env.SECONDHAND_EXAMPLES; else process.env.SECONDHAND_EXAMPLES = previous; });
  process.env.SECONDHAND_EXAMPLES = '0';
  const empty = memoryStore(); seedConversations(empty);
  assert.deepEqual(empty.rows('conversation', { user_id: 'usr_8f2k' }), []);
  const history = await call(examples.find(e => e.name === 'conversations.messages')!);
  assert.equal(history.status, 404, 'previously seeded example history stays hidden');
});
