// Rests-on: spec/product.md §7 Resources; spec/examples/.
import { createHash } from 'node:crypto';
import { ApiError, type Handler } from './http.ts';
import { manifestFor, fromEngine, fields, text } from './captures.ts';

import { type Account, type MessagePorts } from '../messages/messages.ts';
import { offer } from '../../engines/negotiation/policy.ts';
import { keep } from '../../engines/valuation/keep.ts';
import { example } from './examples.ts';
import { store as sharedStore } from './store.ts';
import { gate } from '../gate/gate.ts';
import { ingest } from '../events/intake.ts';
import type { Store } from '../events/ports.ts';
import { pagination } from './captures.ts';
import { engine, list } from './runtime.ts';

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
  ctx.log.event('state.change', { entity: 'claim_check', id: row.id, to: backed ? 'pass' : 'hold', claims_count: checked.claims.length });
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
const texts = new Map(initial.map(row => [row.id, structuredClone(row)]));
export const ports: MessagePorts = {
  async read_messages() { return initial.filter(row => row.actor === 'counterpart').map(row => ({ id: row.id, conversation_id: thread.id, item_id: thread.item_id, site_message_id: row.id, text_ref: row.id, text: row.text, sent_at: row.sent_at })); },
  async classify(message) {
    const row = texts.get(message.id);
    if (!row) throw new Error('message classification missing');
    return { intent: row.intent, facets: row.facets, signals: [], attribute_names: [], kind: row.offer ? 'counter_offer' : 'reply_other' };
  },
  async context(owner, message) {
    const parsed = texts.get(message.id)?.offer;
    return { user_id: owner.user_id, item_id: message.item_id, role: 'sell', checkout: false, orderPaid: false, local: false, attributes: [],
      ...(parsed ? { offer: { site: owner.site, offer_cents: parsed.amount_cents, ask_cents: 9500, floor_cents: 7000, always_accept_cents: 9500, keep: (p: number) => keep('depop', p).keep_cents, v_wait_cents: null, trust_block: false, ask_all: true } } : {}) };
  },
  trust: async () => ({ action: 'none' }),
  negotiate: async state => offer(state, () => 0, .5),
  draft: async () => { throw new Error('stored conversations have no draft writer'); },
  save_draft: async () => { throw new Error('stored conversations have no draft writer'); },
  send_message: async () => { throw new Error('no live message transport'); },
  answer_offer: async () => { throw new Error('no live offer transport'); },
};
export const handlers: Record<string, Handler> = {
  'GET /v1/conversations': engine(ctx => {
    const keys = ['id', 'site', 'item_id', 'listing_id', 'role', 'state', 'counterpart', 'unread', 'last_read_at', 'intent_last', 'last', 'handling', 'version'];
    const rows = replyPorts.store.rows('conversation', { user_id: ctx.user_id! }).filter(row => !row.deleted);
    const data = rows.map(row => Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]])));
    return { status: 200, body: list(ctx, data) };
  }),
  'GET /v1/conversations/:id/messages': engine(ctx => {
    const conversation = replyPorts.store.get('conversation', ctx.user_id!, ctx.params.id);
    if (!conversation || conversation.deleted) throw new ApiError('not_found', 'conversation not found', 'read');
    if (!Array.isArray(conversation.messages)) throw new ApiError('unavailable', 'Message history has not been imported for this conversation', 'read', { by: 'user' });
    const keys = ['id', 'actor', 'text', 'sent_at', 'intent', 'facets', 'offer'];
    const data = conversation.messages.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && typeof row.id === 'string')
      .map(row => Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]])))
      .sort((a, b) => String(b.sent_at ?? '').localeCompare(String(a.sent_at ?? '')));
    return { status: 200, body: list(ctx, data) };
  }),
  'POST /v1/conversations/:id/messages': fromEngine(reply),
};
export const manifest = manifestFor(handlers);
