// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { createHash } from 'node:crypto';
import { ApiError, type Handler } from './http.ts';
import { exampleHandler, manifestFor, fromEngine, fields, text } from './captures.ts';

import { handleMessages, memoryMessageStore, type Account, type MessagePorts } from '../messages/messages.ts';
import { offer } from '../../engines/negotiation/policy.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { example } from './examples.ts';
import type { Ctx } from './http.ts';
import { store as sharedStore } from './store.ts';
import { gate } from '../gate/gate.ts';
import { ingest } from '../events/intake.ts';
import type { Store } from '../events/ports.ts';
import { pagination } from './captures.ts';

type MessageView = { id: string; actor: string; text: string; sent_at: string; intent: string; facets: string[]; offer?: { amount_cents: number } };
const initial = (example('conversations.messages').response as { data: MessageView[] }).data;
const thread = (example('conversations.list').response as { data: { id: string; site: 'depop'; item_id: string; last_read_at: string }[] }).data[0];
export function seedConversations(st: Store) {
  if (!st.get('conversation', 'usr_8f2k', thread.id)) st.put('conversation', { ...thread, user_id: 'usr_8f2k', account_id: 'acc_depop' });
}
seedConversations(sharedStore);
export const replyPorts = {
  store: sharedStore,
  extract: (value: string) => value.split(/[.!?]+/).map(text => text.trim()).filter(text => text && !/^(thanks|thank you|hi|hello|ok|okay)$/i.test(text)).map(text => ({ text, kind: 'fact' })),
};
const reply: Handler = async ctx => {
  const st = replyPorts.store;
  const row = st.get('conversation', ctx.user_id!, ctx.params.id);
  if (!row) throw new ApiError('not_found', 'conversation not found', 'read');
  pagination(ctx);
  ctx.log.input('api', 'reply', { conversation_id: row.id, fields: Object.keys(ctx.body) });
  fields(ctx.body, { text });
  const messageText = ctx.body.text as string;
  const key = ctx.headers.get('Idempotency-Key') ?? ctx.request_id;
  const dedupe_key = 'app.message:' + row.id + ':' + key;
  const request_hash = createHash('sha256').update(JSON.stringify(ctx.body)).digest('hex');
  const prior = st.events({ user_id: ctx.user_id! }).find(event => event.dedupe_key === dedupe_key);
  if (prior && prior.payload?.request_hash !== request_hash) throw new ApiError('idempotency_mismatch', 'key was used with a different body', 'idempotency');
  const item = row.item_id ? st.get('item', ctx.user_id!, String(row.item_id)) : undefined;
  const attributes = (item?.attributes ?? []) as { id: string; name: string; value: unknown; confirmed?: boolean }[];
  const facts = attributes.filter(a => a.confirmed).map(a => ({ attribute_id: a.id, name: a.name, value: String(a.value) }));
  const checked = await gate({ subject: row.id, text: messageText }, facts, [], replyPorts.extract);
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const backed = checked.verdict === 'pass' && checked.claims.every(claim => facts.some(fact =>
    normalise(claim.text) === normalise(fact.value) || normalise(claim.text) === normalise(fact.name + ': ' + fact.value)));
  ctx.log.change('claim_check', row.id, backed ? 'pass' : 'hold', { claims_count: checked.claims.length });
  if (!backed) throw new ApiError('outside_limits', 'reply has unbacked claims', 'claim_check', { by: 'user' });
  const now = new Date().toISOString();
  const result = st.tx(t => {
    const text_ref = 'msg_' + crypto.randomUUID().replaceAll('-', '');
    const ingested = ingest(t, ctx.log, {
      user_id: ctx.user_id!, source: 'app', action: 'app.message', actor: 'user', why: 'your reply',
      site: row.site as Account['site'], account_id: String(row.account_id), item_id: row.item_id as string | undefined,
      listing_id: row.listing_id as string | undefined, dedupe_key,
      payload: { conversation_id: row.id, text_ref, decision_kind: 'reply_other', request_hash },
      observed_at: now, effective_at: now, trace_id: ctx.request_id,
    });
    if ('refused' in ingested) throw new Error('reply event refused: ' + ingested.refused.join(','));
    if (ingested.event.payload?.request_hash !== request_hash) throw new ApiError('idempotency_mismatch', 'key was used with a different body', 'idempotency');
    if (!ingested.duplicate) {
      const current = t.get('conversation', ctx.user_id!, row.id)!;
      const messages = (current.outgoing ?? []) as { id: string; text: string }[];
      t.put('conversation', { ...current, outgoing: [...messages, { id: text_ref, text: messageText }] });
    }
    return ingested;
  });
  return { status: 202, body: { id: result.job.id, kind: result.job.kind, state: result.job.state, stages: result.job.stages } };
};
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
  'POST /v1/conversations/:id/messages': fromEngine(reply),
};
export const manifest = manifestFor(handlers);
