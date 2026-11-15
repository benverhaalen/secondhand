// Rests-on: spec/features/messages.md; product.md buyer-message-to-auto-reply-or-decision,
// evidence-gate-on-an-outgoing-message; decision 2026-11-15-replies-to-buyers-start-as-drafts-the-person-approves.
import type { Log } from '../../../../log/index.js';
import type { Site } from '../events/event.ts';
import type { Attribute } from '../card/card.ts';
import { gate } from '../gate/gate.ts';
import { evaluateHard } from '../../engines/trust/hard.ts';
import { assertLimits, type Decision as OfferDecision, type OfferState } from '../../engines/negotiation/choose.ts';

export interface Account {
  user_id: string; account_id: string; site: Site; linked: boolean; health: 'ok' | 'broken' | 'paused' | 'expiring';
  auto_reply: 'on' | 'drafts' | 'off'; ask_every_time: boolean; site_approved: boolean; promoted: Set<string>;
}
export interface Incoming {
  id: string; conversation_id: string; item_id: string; site_message_id: string; text_ref: string; text: string; sent_at: string;
}
export interface Classification {
  intent: string; kind: 'answer_fact' | 'counter_offer' | 'reply_other' | 'book_pickup' | 'share_address' | 'move_off_site' | 'dispute';
  facets: string[]; signals: string[]; attribute_names: string[];
}
export interface MessageContext {
  user_id: string; item_id: string; role: 'sell' | 'buy'; checkout: boolean; orderPaid: boolean; local: boolean;
  attributes: (Attribute & { id: string })[]; offer?: OfferState;
}
export interface Draft { text: string; claims: { text: string; kind: string }[] }
export interface MessagePorts {
  // Adapter maps read_messages to the signed-in read_inbox/read_messages thread reads.
  read_messages(account: Account): Promise<Incoming[]>;
  context(account: Account, message: Incoming): Promise<MessageContext>;
  classify(message: Incoming): Promise<Classification>; // Jev beside Decisions API, buyer text is data.
  trust(account: Account, message: Incoming, context: MessageContext): Promise<{ action: 'none' | 'warn' | 'ask' | 'block' }>;
  negotiate(state: OfferState): Promise<OfferDecision>;
  draft(message: Incoming, facts: { attribute_id: string; name: string; value: string }[]): Promise<Draft>;
  save_draft(account: Account, message_id: string, text: string): Promise<string>; // encrypted text_ref
  // Both write ports hold the account lease, recheck current limits, use operation_id and read back.
  send_message(account: Account, request: { conversation_id: string; operation_id: string; text: string }): Promise<{ site_message_id: string; text: string }>;
  answer_offer(account: Account, request: { conversation_id: string; operation_id: string; kind: 'accept_offer' | 'counter_offer' | 'decline_offer'; amount_cents: number | null }): Promise<{ kind: string; amount_cents: number | null }>;
}
export interface MessageResult { kind: 'decision' | 'dry' | 'sent' | 'off'; message_id: string; decision_kind?: string; amount_cents?: number | null; draft_ref?: string }
type StoredMessage = Omit<Incoming, 'text'> & { user_id: string; account_id: string; actor: 'counterpart'; intent: string; facets: string[] };
export interface MessageStore {
  save(row: StoredMessage): void;
  raise(key: string, decision: MessageResult): MessageResult;
  check(key: string, verdict: 'pass' | 'hold' | 'abstain', attribute_ids: string[]): void;
  once(key: string, fn: () => Promise<MessageResult>): Promise<MessageResult>;
}
export function memoryMessageStore(): MessageStore & { messages(): StoredMessage[] } {
  const rows = new Map<string, StoredMessage>(), decisions = new Map<string, MessageResult>();
  const checks = new Map<string, { verdict: string; attribute_ids: string[] }>();
  const operations = new Map<string, Promise<MessageResult>>();
  return {
    save(row) { rows.set(JSON.stringify([row.user_id, row.account_id, row.site_message_id]), structuredClone(row)); },
    messages: () => [...rows.values()].map(r => structuredClone(r)),
    raise(key, decision) { if (!decisions.has(key)) decisions.set(key, structuredClone(decision)); return structuredClone(decisions.get(key)!); },
    check: (key, verdict, attribute_ids) => { checks.set(key, { verdict, attribute_ids }); },
    once(key, fn) { const old = operations.get(key); if (old) return old; const result = Promise.resolve().then(fn); operations.set(key, result); return result; },
  };
}
const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const forbidden = /authentic|function|battery|smell|works|location|address|floor|cost|pickup_windows|saved_spot|always_accept|seller_sku/;

export async function handleMessages(account: Account, ports: MessagePorts, store: MessageStore, log: Log, options: { live?: boolean } = {}): Promise<MessageResult[]> {
  if (!account.linked || account.health !== 'ok') return [];
  try {
    const messages = await log.call('tool', 'messages.read_messages', { account_id: account.account_id, site: account.site }, () => ports.read_messages(account), rows => ({ messages_count: rows.length }));
    const results: MessageResult[] = [];
    for (const message of messages) {
      if (!message.id || !message.site_message_id || !message.text_ref || !Number.isFinite(Date.parse(message.sent_at))) throw new Error('invalid incoming message');
      const key = JSON.stringify([account.user_id, account.account_id, message.site_message_id]);
      const cls = await log.call('model', 'messages.jev.classify', { message_id: message.id }, () => ports.classify(message), c => ({ intent: c.intent, facets_count: c.facets.length }));
      const { text: _text, ...reference } = message;
      store.save({ ...reference, user_id: account.user_id, account_id: account.account_id, actor: 'counterpart', intent: cls.intent, facets: cls.facets });
      const context = await log.call('db', 'messages.context', { message_id: message.id, item_id: message.item_id }, () => ports.context(account, message), c => ({ item_id: c.item_id }));
      if (context.user_id !== account.user_id || context.item_id !== message.item_id) throw new Error('message tenant or item mismatch');
      const decision = (kind: string, extra: Partial<MessageResult> = {}): MessageResult => {
        log.event('decision.open', { decision: `${key}:${kind}`, kind, tier: 'ask' });
        return store.raise(`${key}:${kind}`, { ...extra, kind: 'decision', message_id: message.id, decision_kind: kind });
      };
      const hard = evaluateHard({ site: account.site, checkout: context.checkout, orderPaid: context.orderPaid, local: context.local, present: new Set(cls.signals) });
      const trust = await log.call('tool', 'messages.trust', { message_id: message.id }, () => ports.trust(account, message, context), t => ({ action: t.action }));
      if (hard.action !== 'none' || trust.action !== 'none' || cls.facets.includes('possible_scam')) { results.push(decision('scam_warning')); continue; }
      if (hard.locked.length) { results.push(decision(hard.locked[0])); continue; }
      if (cls.kind === 'counter_offer') {
        if (context.role === 'buy') { results.push(decision('buy_offer')); continue; }
        if (!context.offer || context.offer.site !== account.site) throw new Error('offer context missing or wrong site');
        const state = { ...context.offer, ask_all: context.offer.ask_all || account.ask_every_time };
        const policy = assertLimits(await log.call('tool', 'messages.negotiation', { message_id: message.id }, () => ports.negotiate(state), p => ({ kind: p.kind, amount_cents: p.amount_cents })), state);
        if (policy.ask || !['accept_offer', 'counter_offer', 'decline_offer'].includes(policy.kind)) { results.push(decision(policy.kind, { amount_cents: policy.amount_cents })); continue; }
        if (!options.live || !account.site_approved) { results.push({ kind: 'dry', message_id: message.id, decision_kind: policy.kind, amount_cents: policy.amount_cents }); continue; }
        const kind = policy.kind as 'accept_offer' | 'counter_offer' | 'decline_offer';
        results.push(await store.once(key, async () => {
          const result = await log.call('tool', 'messages.answer_offer', { message_id: message.id, operation_id: key }, () => ports.answer_offer(account, { conversation_id: message.conversation_id, operation_id: key, kind, amount_cents: policy.amount_cents }), r => ({ kind: r.kind, amount_cents: r.amount_cents }));
          if (result.kind !== kind || result.amount_cents !== policy.amount_cents) throw new Error('offer read-back mismatch');
          log.event('state.change', { entity: 'offer', id: message.id, to: kind === 'accept_offer' ? 'accepted' : kind === 'counter_offer' ? 'countered' : 'declined' });
          return { kind: 'sent', message_id: message.id, amount_cents: policy.amount_cents };
        }));
        continue;
      }
      if (cls.kind !== 'answer_fact' && cls.kind !== 'reply_other') { results.push(decision(cls.kind)); continue; }
      if (account.auto_reply === 'off') { results.push({ kind: 'off', message_id: message.id }); continue; }
      const facts = context.attributes.filter(a => a.confirmed && a.evidence.length && a.value != null &&
        !forbidden.test(a.name) && (a.name !== 'size' || a.source === 'measured' || a.source === 'you_said'))
        .map(a => ({ attribute_id: a.id, name: a.name, value: `${a.value}${a.unit ? ` ${a.unit}` : ''}` }));
      let draft: Draft;
      if (cls.kind === 'answer_fact') {
        const selected = facts.filter(f => cls.attribute_names.includes(f.name));
        if (!selected.length || selected.length !== new Set(cls.attribute_names).size) { results.push(decision('unbacked_claim')); continue; }
        draft = { text: selected.map(f => `${f.name}: ${f.value}`).join('\n'), claims: selected.map(f => ({ text: `${f.name}: ${f.value}`, kind: f.name })) };
      } else {
        draft = await log.call('model', 'messages.draft', { message_id: message.id }, () => ports.draft(message, facts), d => ({ claims_count: d.claims.length }));
      }
      const checked = await gate({ subject: key, text: draft.text }, facts, [], () => draft.claims, { log });
      // Shared eg-1 matches a value within a claim. Automatic replies additionally require the entire
      // claim to be exactly a named fact, and every word to be covered; free prose waits for entailment.
      const canonical = draft.claims.length > 0 && draft.claims.every(c => facts.some(f => c.kind === f.name && normalise(c.text) === normalise(`${f.name}: ${f.value}`))) &&
        normalise(draft.claims.reduce((remaining, c) => remaining.replace(c.text, ''), draft.text)) === '';
      const draftHard = evaluateHard({ site: account.site, checkout: context.checkout, orderPaid: context.orderPaid, local: context.local, present: new Set(), draft: draft.text });
      const pass = checked.verdict === 'pass' && canonical && !draftHard.draftBlocked;
      store.check(key, pass ? 'pass' : 'hold', checked.claims.flatMap(c => c.attribute_id ? [c.attribute_id] : []));
      log.event('state.change', { entity: 'claim_check', id: key, to: pass ? 'pass' : 'hold', claims_count: checked.claims.length });
      const promotion = cls.kind === 'answer_fact' ? `answer_fact:${[...new Set(cls.attribute_names)].sort().join(',')}` : cls.kind;
      if (!pass || account.auto_reply === 'drafts' || account.ask_every_time || !account.promoted.has(promotion)) {
        const draft_ref = await log.call('db', 'messages.save_draft', { message_id: message.id }, () => ports.save_draft(account, message.id, draft.text), () => ({ saved: true }));
        results.push(decision(pass ? cls.kind : 'unbacked_claim', { draft_ref })); continue;
      }
      if (!options.live || !account.site_approved) { results.push({ kind: 'dry', message_id: message.id }); continue; }
      results.push(await store.once(key, async () => {
        const sent = await log.call('tool', 'messages.send_message', { message_id: message.id, operation_id: key }, () => ports.send_message(account, { conversation_id: message.conversation_id, operation_id: key, text: draft.text }), r => ({ site_message_id: r.site_message_id }));
        if (!sent.site_message_id || sent.text !== draft.text) throw new Error('message read-back mismatch');
        log.event('state.change', { entity: 'message', id: message.id, to: 'sent' });
        return { kind: 'sent', message_id: message.id };
      }));
    }
    return results;
  } catch (e) { log.error('messages', e); throw e; }
}
