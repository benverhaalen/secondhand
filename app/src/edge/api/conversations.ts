// Rests-on: spec/product.md §7 Resources; spec/examples/.
import type { Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text } from './captures.ts';

import { handleMessages, memoryMessageStore, type Account, type MessagePorts } from '../messages/messages.ts';
import { offer } from '../../engines/negotiation/policy.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { example } from './examples.ts';
import type { Ctx } from './http.ts';

type MessageView = { id: string; actor: string; text: string; sent_at: string; intent: string; facets: string[]; offer?: { amount_cents: number } };
const initial = (example('conversations.messages').response as { data: MessageView[] }).data;
const thread = (example('conversations.list').response as { data: { id: string; site: 'depop'; item_id: string; last_read_at: string }[] }).data[0];
const account: Account = { user_id: 'usr_8f2k', account_id: 'acc_depop', site: thread.site, linked: true, health: 'ok', auto_reply: 'off', ask_every_time: true, site_approved: false, promoted: new Set() };
const store = memoryMessageStore();
const texts = new Map(initial.map(row => [row.id, structuredClone(row)]));
export const ports: MessagePorts = {
  async read_messages() { return initial.filter(row => row.actor === 'counterpart').map(row => ({ id: row.id, conversation_id: thread.id, item_id: thread.item_id, site_message_id: row.id, text_ref: row.id, text: row.text, sent_at: row.sent_at })); },
  async classify(message) {
    const row = texts.get(message.id);
    if (!row) throw new Error('message classification missing');
    return { intent: row.intent, facets: row.facets, signals: [], attribute_names: [], kind: row.offer ? 'counter_offer' : 'reply_other' };
  },
  async context(owner, message) { return { user_id: owner.user_id, item_id: message.item_id, role: 'sell', checkout: false, orderPaid: false, local: false, attributes: [],
    offer: { site: owner.site, offer_cents: texts.get(message.id)?.offer?.amount_cents ?? 0, ask_cents: 9500, floor_cents: 7000, always_accept_cents: 9500, keep: p => keep('depop', p).keep_cents, v_wait_cents: null, trust_block: false, ask_all: true } }; },
  trust: async () => ({ action: 'none' }),
  negotiate: async state => offer(state, () => 0, .5),
  draft: async () => { throw new Error('stored conversations have no draft writer'); },
  save_draft: async () => { throw new Error('stored conversations have no draft writer'); },
  send_message: async () => { throw new Error('no live message transport'); },
  answer_offer: async () => { throw new Error('no live offer transport'); },
};
async function read(ctx: Ctx) {
  await handleMessages({ ...account, user_id: ctx.user_id! }, ports, store, ctx.log);
  return store.messages().filter(row => row.user_id === ctx.user_id && row.conversation_id === thread.id).map(row => {
    const text = texts.get(row.text_ref);
    if (!text) throw new Error('message text missing');
    return { ...text, intent: row.intent, facets: row.facets, sent_at: row.sent_at };
  });
}
export const handlers: Record<string, Handler> = {
  'GET /v1/conversations': fromEngine(exampleHandler('GET /v1/conversations', undefined, undefined, async (ctx, seed) => {
    const messages = (await read(ctx)).sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    const body = seed.body as { data: Record<string, unknown>[]; next_cursor: null };
    const last = messages[0];
    return { ...seed, body: { ...body, data: body.data.map(row => ({ ...row, ...(last ? { intent_last: last.intent, last: { actor: last.actor, text: last.text, sent_at: last.sent_at } } : {}) })) } };
  })),
  'GET /v1/conversations/:id/messages': fromEngine(exampleHandler('GET /v1/conversations/:id/messages', undefined, undefined, async (ctx, seed) => {
    const incoming = await read(ctx);
    const body = seed.body as { data: MessageView[]; next_cursor: null };
    const data = [...body.data.filter(row => row.actor !== 'counterpart'), ...incoming].sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    return { ...seed, body: { ...body, data } };
  })),
  'POST /v1/conversations/:id/messages': exampleHandler('POST /v1/conversations/:id/messages', c => fields(c.body, { text })),
};
export const manifest = manifestFor(handlers);
