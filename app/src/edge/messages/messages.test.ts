import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { decide } from '../../engines/negotiation/choose.ts';
import { handleMessages, memoryMessageStore, type MessagePorts, type MessageContext, type Account, type Classification } from './messages.ts';
const at = '2026-11-15T12:00:00Z';
function rig() {
  const sink = memorySink(), log = createLog({ src: 'test.messages', build: 'test', sink });
  const store = memoryMessageStore();
  const account: Account = { user_id: 'usr_1', account_id: 'ac_1', site: 'depop', linked: true, health: 'ok', auto_reply: 'drafts', ask_every_time: false, site_approved: false, promoted: new Set() };
  const cls: Classification = { intent: 'size', kind: 'answer_fact', facets: [], signals: [], attribute_names: ['size'] };
  const context: MessageContext = { user_id: 'usr_1', item_id: 'it_1', role: 'sell', checkout: true, orderPaid: false, local: false,
    attributes: [{ id: 'at_size', name: 'size', value: 'M', source: 'you_said', confirmed: true, confidence: 1, method: 'typed', at, evidence: [{ kind: 'owner', ref: 'ev_size', captured_at: at, extractor_version: 'test' }] }],
    offer: { site: 'depop', offer_cents: 1000, ask_cents: 6000, floor_cents: 4000, always_accept_cents: 5000, keep: n => n, v_wait_cents: 4000, trust_block: false } };
  const calls: string[] = [];
  const ports: MessagePorts = {
    read_messages: async () => [{ id: 'msg_1', conversation_id: 'cv_1', item_id: 'it_1', site_message_id: 'remote_1', text_ref: 'encrypted/message_1', text: 'What size?', sent_at: at }],
    context: async () => context, classify: async () => cls,
    trust: async () => ({ action: 'none' }),
    negotiate: async state => { calls.push('negotiate'); return decide(state, () => 0.5); },
    draft: async () => ({ text: 'Smoke-free.', claims: [{ text: 'Smoke-free.', kind: 'smell' }] }),
    save_draft: async () => 'encrypted/draft_1',
    send_message: async (_account, request) => { calls.push('send'); return { site_message_id: 'sent_1', text: request.text }; },
    answer_offer: async (_account, request) => { calls.push('offer'); return { amount_cents: request.amount_cents, kind: request.kind }; },
  };
  return { store, ports, calls, account, cls, context, sink, run: (live = false) => handleMessages(account, ports, store, log, { live }) };
}
test('trust gate: a scam script blocks before drafting, negotiation or send', async () => {
  const r = rig(); r.cls.signals = ['asks_code'];
  const [result] = await r.run();
  assert.equal(result.kind, 'decision'); assert.equal(result.decision_kind, 'scam_warning');
  assert.deepEqual(r.calls, []);
});
test('ng-5 counter: lowball is routed to the policy, whose floor decision holds the counter', async () => {
  const r = rig(); r.cls.kind = 'counter_offer';
  const [result] = await r.run();
  assert.equal(result.decision_kind, 'price_below_floor');
  assert.equal(result.amount_cents, 4500);
  assert.deepEqual(r.calls, ['negotiate']);
});
test('replies start as drafts even with backed facts', async () => {
  const r = rig(); const [result] = await r.run();
  assert.equal(result.decision_kind, 'answer_fact'); assert.equal(result.kind, 'decision');
  assert.deepEqual(r.calls, []);
});
test('promoted backed answer is dry by default and only sends after a site go', async () => {
  const r = rig(); r.account.auto_reply = 'on'; r.account.promoted.add('answer_fact:size');
  assert.equal((await r.run())[0].kind, 'dry');
  assert.deepEqual(r.calls, []);
  r.account.site_approved = true;
  const [result] = await r.run(true);
  assert.equal(result.kind, 'sent'); assert.deepEqual(r.calls, ['send']);
});
test('an unsupported draft is held even on an auto rule; empty claim extraction is held too', async () => {
  const r = rig(); r.cls.kind = 'reply_other'; r.account.auto_reply = 'on'; r.account.promoted.add('reply_other');
  assert.equal((await r.run())[0].decision_kind, 'unbacked_claim');
  assert.deepEqual(r.calls, []);
  const r2 = rig(); r2.cls.kind = 'reply_other'; r2.ports.draft = async () => ({ text: 'Smoke-free.', claims: [] });
  assert.equal((await r2.run())[0].decision_kind, 'unbacked_claim');
});
test('an unconfirmed or unmeasured size never becomes an automatic fact', async () => {
  const r = rig(); r.context.attributes[0].confirmed = false;
  assert.equal((await r.run())[0].decision_kind, 'unbacked_claim');
});
test('once: duplicate reads and concurrent polls produce one send and store only encrypted text refs', async () => {
  const r = rig(); r.account.auto_reply = 'on'; r.account.promoted.add('answer_fact:size'); r.account.site_approved = true;
  await Promise.all([r.run(true), r.run(true)]);
  assert.deepEqual(r.calls, ['send']);
  assert.equal(r.store.messages().length, 1);
  assert.equal('text' in r.store.messages()[0], false);
  assert.equal(r.sink.text().includes('What size?'), false);
});
test('buy offers and address requests ask every time', async () => {
  const r = rig(); r.context.role = 'buy'; r.cls.kind = 'counter_offer';
  assert.equal((await r.run())[0].decision_kind, 'buy_offer');
  const a = rig(); a.cls.signals = ['asks_address_phone'];
  assert.equal((await a.run())[0].decision_kind, 'share_address');
  assert.deepEqual(a.calls, []);
});
test('unlinked accounts do not read and a send read-back mismatch is reported', async () => {
  const r = rig(); r.account.linked = false;
  r.ports.read_messages = async () => { throw new Error('must not read'); };
  assert.deepEqual(await r.run(), []);
  const b = rig(); b.account.auto_reply = 'on'; b.account.promoted.add('answer_fact:size'); b.account.site_approved = true;
  b.ports.send_message = async () => ({ site_message_id: 'sent_1', text: 'wrong' });
  await assert.rejects(b.run(true), /read.back/);
});
test('private location, cost and floor facts never reach a draft or a fact reply', async () => {
  const r = rig(); r.cls.kind = 'reply_other';
  for (const name of ['location', 'home_address', 'floor_cents', 'cost']) r.context.attributes.push({ ...r.context.attributes[0], id: `at_${name}`, name, value: 'private_test_value' });
  r.ports.draft = async (_message, facts) => { assert.deepEqual(facts.map(f => f.name), ['size']); return { text: '', claims: [] }; };
  await r.run();
  const r2 = rig(); r2.context.attributes[0].name = 'floor_cents'; r2.cls.attribute_names = ['floor_cents'];
  assert.equal((await r2.run())[0].decision_kind, 'unbacked_claim');
});
test('promotion applies per kind of question, never to all fact answers', async () => {
  const r = rig(); r.account.auto_reply = 'on'; r.account.site_approved = true; r.account.promoted.add('answer_fact');
  assert.equal((await r.run(true))[0].kind, 'decision');
  assert.deepEqual(r.calls, []);
});
test('the worker trace follows the shared log contract', async () => {
  const r = rig(); await r.run();
  assert.deepEqual(checkLog([['messages', r.sink.text()]]).problems, []);
});
