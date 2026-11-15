// The inbox: what Messages and a thread read besides the world's rows. Which conversations wait for the person and why,
// in the order an inbox is read, and the replies the agent drafted and holds for a tap, word by word, so a thread can mark
// what the model guessed (spec/features/assist.md, Guess: a dotted underline on each guessed word until the person changes it).
// A draft hangs off the open decision of its conversation; its words are the decision's own (`does` quotes them).
import { itemById, thread, type World } from './world.ts';
import type { Conversation, Decision } from './types.ts';

export type Span = { text: string; guess?: boolean };
// A fact the reply states and where it came from: an item attribute's source (label, measured, you said) or a row the person
// approved (the saved spot, the booked pickup). `confirmed` is false for anything the agent inferred.
export type Fact = { text: string; from: string; confirmed: boolean };
export type Draft = { conversation_id: string; decision_id: string; spans: Span[]; facts: Fact[] };

const g = (text: string): Span => ({ text, guess: true });
const t = (text: string): Span => ({ text });

const DRAFTS: Draft[] = [
  // reply_other, held because a size answer is sent only when every number is measured or said (messages.md, answer_fact).
  { conversation_id: 'cv_pd', decision_id: 'dec_reply', spans: [t('It’s '), g('36'), t('. I measured '), g('35 inches'), t(' flat along the inside seam, '), g('photo 3'), t('.')],
    facts: [{ text: '36 inseam', from: 'the label', confirmed: true }, { text: '35 in', from: 'your tape', confirmed: true }, { text: 'Photo 3', from: 'your photos', confirmed: true }] },
  // share_address, locked: the safer public spot goes first, and the address waits for its own tap (Pickup).
  { conversation_id: 'cv_cf', decision_id: 'dec_addr', spans: [t('Could we keep it at the '), g('library lot'), t(' at '), g('3 pm'), t('? That’s easier for me.')],
    facts: [{ text: 'Library lot', from: 'your saved spot', confirmed: true }, { text: '3 pm', from: 'the pickup you approved', confirmed: true }] },
  // scam_warning: the safety line, which states no fact about the item, so nothing in it is a guess.
  { conversation_id: 'cv_lf', decision_id: 'dec_scam', spans: [t('I only take payment through the app, or cash at pickup.')], facts: [] },
];

// Replies to send (ways-out §6.3, "Let me approve replies fast"): every held draft, oldest buyer message first, as a queue.
// A thread the agent handed over is not in it: a buyer asking to pay or meet off the site comes with its reason on top in
// the thread instead (scam_warning). Send all takes only replies whose every fact is confirmed.
const HANDED_OVER = new Set(['scam_warning', 'move_off_site']);
export function replyQueue(w: World) {
  return DRAFTS.map(d => ({ d, dec: w.decisions.find(x => x.id === d.decision_id), c: w.conversations.find(x => x.id === d.conversation_id) }))
    .filter(x => x.dec && x.dec.state === 'open' && x.c && x.c.state !== 'blocked' && !HANDED_OVER.has(x.dec.kind))
    .map(({ d, c }) => {
      const asked = thread(w, c!.id).filter(m => m.actor === 'counterpart').pop() ?? null;
      return { draft: d, c: c!, item: itemById(w, c!.item_id), asked, sure: d.facts.length > 0 && d.facts.every(f => f.confirmed) };
    })
    .sort((a, b) => Date.parse(a.asked?.sent_at ?? '') - Date.parse(b.asked?.sent_at ?? ''));
}

// The draft waiting in a conversation, when its decision is still open.
export function draftFor(w: World, conversationId: string): Draft | null {
  const d = DRAFTS.find(x => x.conversation_id === conversationId);
  if (!d) return null;
  const dec = w.decisions.find(x => x.id === d.decision_id);
  return dec && dec.state === 'open' ? d : null;
}
export const draftText = (d: Draft) => d.spans.map(s => s.text).join('');

// What waits for the person in a conversation, as the word its tag says (pages.md §5: a card names its kind first).
const NEED: Record<string, string> = {
  accept_offer: 'Offer', price_below_floor: 'Offer', reply_other: 'Reply', unbacked_claim: 'Reply', share_address: 'Pickup',
  book_pickup: 'Pickup', pickup_outside_hours: 'Pickup', scam_warning: 'Possible scam',
};
// The open decision a conversation is waiting on: its own, or the one that answers an open offer in it.
export function waitingOn(w: World, c: Conversation): Decision | null {
  if (c.state === 'blocked') return null;
  const offers = new Set(w.offers.filter(o => o.conversation_id === c.id && o.state === 'open').map(o => o.id));
  return w.decisions.find(x => x.state === 'open' && NEED[x.kind] && (x.conversation_id === c.id || x.offer_ids?.some(o => offers.has(o)))) ?? null;
}
export const needWord = (d: Decision) => NEED[d.kind];

// Every conversation, newest message first, as Mail and iMessage order an inbox.
export function inbox(w: World) {
  return w.conversations.map(c => {
    const msgs = thread(w, c.id), last = msgs[msgs.length - 1] ?? null;
    return { c, last, item: itemById(w, c.item_id), waiting: waitingOn(w, c), at: last ? Date.parse(last.sent_at) : 0 };
  }).sort((a, b) => b.at - a.at);
}
