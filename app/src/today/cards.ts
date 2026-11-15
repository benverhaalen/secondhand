// What Today shows, worked out from a world: the top slot, the cards in their tiers, the notices and the handled line.
// The screen (app/src/app/(tabs)/index.tsx) only draws what this returns, so the words and the order are tested in node
// (cards.test.ts) and every page that shows a decision can read the same card.
// Sources: spec/pages.md §4, §5, §6.2; spec/features/today.md (the cards); research/today/ben/today-feed-and-card-states.md §3
// (forms and states); .agents/ui-build/README.md (when the agent acts and when it hands off).
import { feed as order, groups, handled, headline, itemById, unread } from '../demo/world.ts';
import { clock, ms, usd } from '../demo/format.ts';
import type { Decision, Feed, Item, LogEvent, Notice, Site } from '../demo/types.ts';
import type { PhotoKey } from '../demo/photo-keys.ts';
import type { World } from '../demo/world.ts';

// The tag a card wears: its state's color, icon and word (app/src/ui/states.ts). `need` is marigold, `ship` mint, `live` sky.
export type Tag = 'need' | 'ship' | 'live' | 'paid' | 'sold' | 'stuck';

// What a press does. act: runs the decision's option (working, then done with Undo). open: goes to a page. queue: opens the
// queue one item at a time. amount: opens the sheet that changes the agent's amount. later: moves the card to a later time.
// split: shows a batch as one card each.
export type Act =
  | { do: 'act'; option: string; step: string; done: string }
  | { do: 'open'; to: string }
  | { do: 'queue' }
  | { do: 'amount'; option: string; name: string; cents: number; verb: string; done: string }
  | { do: 'later' }
  | { do: 'split' };
export type Action = { id: string; label: string } & Act;

export type Card = {
  key: string;
  // The decisions this card answers: one, or every one in a batch or queue, in order.
  ids: string[];
  tier: Feed;
  form: 'single' | 'batch' | 'queue';
  tag: Tag;
  word: string;
  title: string;
  photo: PhotoKey | null;
  site: Site | null;
  fact: { label: string; cents?: number };
  // The deadline in the world's time (ms), or null. The screen turns it into a live countdown.
  due: number | null;
  primary: Action;
  second?: Action;
  // Everything else, named in the card's More sheet: the other options, Later, and the way to its item or chat.
  more: Action[];
  // Where a tap on the card itself goes: its item, its chat, or the page that fixes it.
  open: string;
  // How many more wait under a queue's top card.
  waiting: number;
  // From the data: a card already acting or already failed (`failed` says what failed).
  status: 'open' | 'working' | 'failed';
  failed?: string;
};

const first = (s: string) => s.split(/(?<=\.)\s/)[0];
// A fact is a label, never a sentence: no closing period (copy.md, Labels).
const asLabel = (s: string) => first(s).replace(/\.$/, '');
const itemPhoto = (it: Item | null): PhotoKey | null => it?.photos[0]?.key ?? null;
const opt = (d: Decision, id: string) => d.options.find(o => o.id === id);
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const count = (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
// What the person keeps on the sale behind a decision, or null when nothing says: a card never shows $0.
const kept = (w: World, d: Decision): number | null => {
  const o = w.orders.find(x => x.id === d.order_id);
  const c = o ? o.price_cents - o.fees_cents - o.shipping_cents : d.money?.you_keep_cents ?? null;
  return c && c > 0 ? c : null;
};
const keeps = (c: number | null | undefined, otherwise: string) => (c && c > 0 ? { label: 'You keep', cents: c } : { label: otherwise });
// Where the item lives, or where the decision is answered when it has no item.
const itemPath = (d: Decision) => (d.item_id ? `/item/${d.item_id}` : d.account_id ? '/you/accounts' : '/sell');
const chatPath = (d: Decision) => (d.conversation_id ? `/messages/${d.conversation_id}` : null);

// The words on the pill come from the option, cut to a verb and its object or amount (copy.md, Buttons). The data's own
// label is kept when it already is that.
const act = (d: Decision, option: string, label: string, step: string, done: string): Action =>
  ({ id: `${d.id}-${option}`, label, do: 'act', option, step, done });
const later = (key: string): Action => ({ id: `${key}-later`, label: 'Later', do: 'later' });
const open = (key: string, label: string, to: string): Action => ({ id: `${key}-go-${label === 'Open the chat' ? 'chat' : 'item'}`, label, do: 'open', to });

// One card for one decision. Every kind the demo worlds carry has its words here; any other kind falls back to its data.
export function single(w: World, d: Decision): Card {
  const it = itemById(w, d.item_id);
  const base = {
    key: d.id, ids: [d.id], tier: d.feed, form: 'single' as const, title: it?.title ?? first(d.why), photo: itemPhoto(it), site: d.site,
    due: d.deadline ? ms(d.deadline) : null, open: itemPath(d), waiting: 0,
    status: d.state === 'acting' ? ('working' as const) : d.state === 'failed' || d.error ? ('failed' as const) : ('open' as const),
    failed: d.error ? asLabel(d.why) : undefined,
  };
  const chat = chatPath(d);
  const ways = [chat ? open(d.id, 'Open the chat', chat) : null, d.item_id ? open(d.id, 'Open the item', itemPath(d)) : null].filter((a): a is Action => !!a);

  switch (d.kind) {
    case 'accept_offer':
    case 'price_below_floor': {
      // The money kept on the best offer leads; Accept is the black pill and the agent's counter is the second (pages §3: the
      // person clearing out looks at what they keep, then accepts). The counter's amount is a guess the person can change.
      const offer = d.money?.offer_cents ?? 0, counter = opt(d, 'ctr');
      const many = (d.offer_ids?.length ?? 1) > 1;
      // With no counter in the data, the agent's guess is halfway between the offer and the asking price, rounded to a dollar.
      const asking = it?.listings.find(l => l.id === w.offers.find(o => d.offer_ids?.includes(o.id))?.listing_id)?.price_cents ?? offer;
      const counterCents = counter ? Math.round(Number(counter.label.replace(/[^0-9.]/g, '')) * 100) : Math.round((offer + asking) / 200) * 100;
      return {
        ...base, tag: 'need', word: many ? count(d.offer_ids!.length, 'offer', 'offers') : 'Offer',
        fact: keeps(d.money?.you_keep_cents, 'Offer waiting'),
        primary: act(d, 'acc', `Accept ${usd(offer)}`, 'Accepting', `Accepted ${usd(offer)}`),
        second: counter
          ? { id: `${d.id}-ctr`, label: `Counter ${usd(counterCents)}`, do: 'act', option: 'ctr', step: 'Sending', done: `Countered at ${usd(counterCents)}` }
          : { id: `${d.id}-ctr`, label: 'Counter', do: 'amount', option: 'ctr', name: 'Counter', cents: counterCents, verb: 'Counter', done: 'Countered at' },
        more: [
          ...(counter ? [{ id: `${d.id}-amount`, label: 'Counter another amount', do: 'amount', option: 'ctr', name: 'Counter', cents: counterCents, verb: 'Counter', done: 'Countered at' } as Action] : []),
          ...(opt(d, 'dec') ? [act(d, 'dec', many ? 'Decline both' : 'Decline', 'Declining', many ? 'Declined both offers' : 'Declined')] : []),
          later(d.id), ...ways,
        ],
      };
    }
    case 'share_address': {
      // An address is shared only on the person's tap (decision 2026-11-14, locked). The safe choice is the black pill.
      const buyer = w.conversations.find(c => c.id === d.conversation_id)?.buyer ?? 'The buyer';
      const ap = w.appointments.find(a => a.order_id === d.order_id);
      return {
        ...base, tag: 'need', word: 'Pickup', fact: { label: `${buyer} wants your address` },
        due: ap ? ms(ap.window.start) : base.due,
        primary: act(d, 'spot', 'Keep the lot', 'Sending', 'Pickup stays at the lot'),
        second: act(d, 'share', 'Share address', 'Sending', `Address sent to ${buyer}`),
        more: [later(d.id), ...ways],
      };
    }
    case 'scam_warning': {
      const buyer = w.conversations.find(c => c.id === d.conversation_id)?.buyer ?? 'them';
      return {
        ...base, tag: 'need', word: 'Careful', fact: { label: 'Wants to pay off the site' },
        primary: act(d, 'block', `Block ${buyer}`, 'Blocking', `Blocked ${buyer}`),
        second: act(d, 'safe', 'Reply safely', 'Sending', 'Sent the safety line'),
        more: [act(d, 'ignore', 'Ignore', 'Closing', 'Left unanswered'), ...ways],
      };
    }
    case 'relink': {
      // No item: the card shows the thing that is stuck because of it, on that site, so the photo still leads.
      const stuck = w.items.find(i => i.listings.some(l => l.site === d.site && l.state === 'live'));
      return {
        ...base, title: 'Signed out', photo: itemPhoto(stuck ?? null), tag: 'need', word: 'Sign in',
        fact: { label: stuck ? 'Offers there wait for you' : 'Nothing posts there for now' },
        primary: { id: `${d.id}-relink`, label: 'Sign in again', do: 'open', to: '/you/accounts' },
        more: [later(d.id)], open: '/you/accounts',
      };
    }
    case 'buy_label': {
      const label = d.money?.label_cents ?? 0;
      return {
        ...base, tag: 'ship', word: 'Ship', fact: keeps(kept(w, d), asLabel(d.why)),
        primary: act(d, 'buy', label ? `Buy label ${usd(label)}` : 'Get the label', 'Buying', label ? 'Label bought' : 'Label ready'),
        second: act(d, 'own', 'Own label', 'Saving', 'You’ll add the tracking'),
        more: [later(d.id), ...ways], open: d.item_id ? `/item/${d.item_id}/ship` : base.open,
      };
    }
    case 'markdown': {
      const price = d.money?.price_cents ?? 0, fix = it?.listings.find(l => l.market_standing?.fix)?.market_standing?.fix;
      const now = it?.listings.find(l => l.state === 'live')?.price_cents;
      return {
        ...base, tag: 'live', word: 'Price', fact: fix ? { label: fix.consequence } : keeps(d.money?.you_keep_cents, asLabel(d.why)),
        primary: act(d, 'lower', `Lower to ${usd(price)}`, 'Changing', `Lowered to ${usd(price)}`),
        second: now ? act(d, 'keep', `Keep ${usd(now)}`, 'Saving', `Kept at ${usd(now)}`) : undefined,
        more: [{ id: `${d.id}-amount`, label: 'Another price', do: 'amount', option: 'lower', name: 'Price', cents: price, verb: 'Lower to', done: 'Lowered to' }, later(d.id), ...ways],
      };
    }
    case 'first_post': {
      const price = d.money?.price_cents ?? 0, sites = it?.listings.filter(l => l.state === 'none').length || it?.valuation?.per_site.length || 0;
      return {
        ...base, tag: 'live', word: 'Ready', fact: price > 0 ? { label: 'Lists at', cents: price } : { label: 'Price to set' },
        primary: act(d, 'post', sites ? `Post to ${count(sites, 'site', 'sites')}` : 'Post', 'Posting', 'Posted'),
        second: { id: `${d.id}-edit`, label: 'Edit first', do: 'open', to: itemPath(d) },
        more: [act(d, 'later', 'Keep as a draft', 'Saving', 'Kept as a draft'), ...ways],
      };
    }
    case 'reply_other': {
      const ask = w.messages.filter(m => m.conversation_id === d.conversation_id && m.actor === 'counterpart').at(-1);
      return {
        ...base, tag: 'need', word: 'Question', fact: { label: ask ? `“${ask.text}”` : asLabel(d.why) },
        primary: act(d, 'send', 'Send reply', 'Sending', 'Reply sent'),
        second: { id: `${d.id}-edit`, label: 'Edit', do: 'open', to: chat ?? itemPath(d) },
        more: [later(d.id), ...ways], open: chat ?? base.open,
      };
    }
    case 'leave_review':
      return {
        ...base, tag: 'paid', word: 'Review', fact: { label: /5 stars/.test(d.why) ? 'Paid fast, left you 5 stars' : asLabel(d.why) },
        primary: act(d, 'leave', 'Leave 5 stars', 'Posting', 'Review left'),
        second: act(d, 'skip', 'Skip', 'Closing', 'Skipped'),
        more: ways,
      };
    case 'failed_post':
    case 'relist':
      return {
        ...base, tag: 'live', word: d.kind === 'relist' ? 'Relist' : 'Post', fact: { label: asLabel(d.why) },
        primary: act(d, d.options[0]?.id ?? 'retry', 'Retry', 'Trying again', 'Done'),
        second: d.options[1] ? { id: `${d.id}-self`, label: 'Do it myself', do: 'open', to: itemPath(d) } : undefined,
        more: ways,
      };
    case 'approve_groups': {
      const drop = w.items.find(i => i.group_id);
      return {
        ...base, title: first(d.why).replace(/\.$/, ''), photo: itemPhoto(drop ?? null), tag: 'need', word: 'Photos',
        fact: { label: d.why.split('. ')[1]?.replace(/\.$/, '') ?? '' },
        primary: act(d, 'fix', 'Fix the odd one', 'Opening', 'Fixed'),
        second: act(d, 'ok', opt(d, 'ok')?.label ?? 'Approve', 'Making drafts', 'Drafts made'),
        more: [later(d.id)], open: '/sell',
      };
    }
    default: {
      const s = d.options.find(o => o.id === d.suggested) ?? d.options[0], other = d.options.find(o => o !== s);
      return {
        ...base, tag: 'need', word: 'Needs you', fact: { label: asLabel(d.why) },
        primary: s ? act(d, s.id, s.label, 'Working', 'Done') : { id: `${d.id}-open`, label: 'Open', do: 'open', to: itemPath(d) },
        second: other ? act(d, other.id, other.label, 'Working', 'Done') : undefined,
        more: [later(d.id), ...ways],
      };
    }
  }
}

// Several of one batch kind under one act: "Buy 3 labels". Progress counts them; each one fails on its own.
function batch(w: World, ds: Decision[]): Card {
  const one = single(w, ds[0]);
  if (ds[0].kind === 'buy_label') {
    const labels = sum(ds.map(d => d.money?.label_cents ?? 0)), n = ds.length;
    const sites = [...new Set(ds.map(d => d.site))];
    return {
      ...one, key: `batch-${ds[0].group_key}`, ids: ds.map(d => d.id), form: 'batch', word: `Ship ${n}`, title: `${n} to ship`,
      // What the one tap spends: the labels. What the sales keep is already the top slot's news, so it is not said twice.
      site: sites.length === 1 ? sites[0] : null, fact: labels ? { label: 'Labels cost', cents: labels } : keeps(sum(ds.map(d => kept(w, d) ?? 0)), 'Prepaid by the buyers'),
      due: Math.min(...ds.map(d => (d.deadline ? ms(d.deadline) : Infinity))),
      primary: { id: `batch-${ds[0].group_key}-all`, label: labels ? `Buy ${n} labels` : `Get ${n} labels`, do: 'act', option: 'buy', step: `1 of ${n}`, done: `${count(n, 'label', 'labels')} ready` },
      second: { id: `batch-${ds[0].group_key}-split`, label: 'One by one', do: 'split' },
      more: [{ id: `batch-${ds[0].group_key}-own`, label: 'Ship them myself', do: 'act', option: 'own', step: 'Saving', done: 'You’ll add the tracking' }, later(`batch-${ds[0].group_key}`)],
      open: one.open,
    };
  }
  // Any other batch kind: the first card speaks for the rest, and its act runs on each.
  return { ...one, key: `batch-${ds[0].group_key}`, ids: ds.map(d => d.id), form: 'batch', word: `${one.word} ${ds.length}` };
}

// Many of a kind that each need their own look, none due within a day: the top one, drawn as a stack (pages §5).
function queue(w: World, ds: Decision[]): Card {
  const one = single(w, ds[0]), key = `queue-${ds[0].group_key}`;
  return {
    ...one, key, ids: ds.map(d => d.id), form: 'queue', waiting: ds.length - 1,
    word: ds[0].kind === 'first_post' ? `${ds.length} to post` : `${ds.length} ${one.word.toLowerCase()}`,
    primary: { id: `${key}-review`, label: `Review ${ds.length}`, do: 'queue' },
    second: undefined,
    more: [{ id: `${key}-later`, label: 'Later', do: 'later' }],
    open: one.open,
  };
}

// The card for these decisions, in the form their kind takes: what is left of a batch after some went, or one of a batch shown one by one.
export function group(w: World, ids: string[], form: Card['form']): Card {
  const ds = ids.flatMap(id => w.decisions.filter(d => d.id === id));
  return fit(ds.length === 1 ? single(w, ds[0]) : form === 'queue' ? queue(w, ds) : form === 'batch' ? batch(w, ds) : single(w, ds[0]));
}

// A card's row holds two pills and More in 318: about 26 characters of label between the two pills (measured on the
// render; the edge world's "Accept $10,999.99" with "Counter $11,000" ran past the corner). Over that, the second pill
// gives up its amount (the amount sheet still has it), and if it is still too long it moves to the top of More.
export const ROW_CHARS = 26;
export function fit(c: Card): Card {
  if (!c.second || c.primary.label.length + c.second.label.length <= ROW_CHARS) return c;
  const bare = c.second.label.replace(/\s*\$[\d,.]+$/, '');
  if (bare !== c.second.label && c.primary.label.length + bare.length <= ROW_CHARS) {
    const amount = c.more.find(a => a.do === 'amount');
    return { ...c, second: amount ? { ...amount, label: bare } : { ...c.second, label: bare }, more: c.more.filter(a => a !== amount) };
  }
  return { ...c, second: undefined, more: [c.second, ...c.more] };
}

// Today's cards, in the feed's order: one per group. A group of one is a single card whatever its kind.
export function cards(w: World): Card[] {
  return groups(w).map(g => fit(g.cards.length === 1 ? single(w, g.cards[0]) : g.form === 'queue' ? queue(w, g.cards) : g.form === 'batch' ? batch(w, g.cards) : single(w, g.cards[0])));
}

// The three tiers. A label shows only where two tiers meet: the first tier on the screen goes unlabeled (pages §5).
export const TIER_LABEL: Record<Feed, string> = { now: 'Now', when_you_can: 'When you can', good_to_know: 'Good to know' };
export function tiers(list: Card[]): { tier: Feed; label: string | null; cards: Card[] }[] {
  const out: { tier: Feed; label: string | null; cards: Card[] }[] = [];
  for (const c of list) {
    const last = out.at(-1);
    if (last && last.tier === c.tier) last.cards.push(c);
    else out.push({ tier: c.tier, label: out.length ? TIER_LABEL[c.tier] : null, cards: [c] });
  }
  return out;
}

// The top slot (decided 2026-11-15): money kept since the last open, or the next setup step, or nothing. Never $0.
export function top(w: World) {
  const h = headline(w);
  if (!h) return null;
  if (h.kind === 'kept_since_last_open') return { kind: 'news' as const, since: h.label, cents: h.value, line: h.sub };
  return { kind: 'setup' as const, step: h.label, to: '/onboarding' };
}

// The notices that ask nothing: a row each, ending in a chevron, opening the item (today.md step 9).
const NOTICE_ICON: Record<Notice['kind'], 'money-03' | 'search-01' | 'hourglass' | 'information-circle'> = {
  value_moved: 'money-03', demand_rose: 'search-01', listing_stale: 'hourglass', ranker_changed: 'information-circle',
};
export const notices = (w: World) => w.notices.map(n => ({ id: n.id, icon: NOTICE_ICON[n.kind], text: n.text, to: `/item/${n.item_id}` }));

// The handled line: what the agent did on its own since the last open, named, never a bare count (ledger L13: "the 3 need
// you, 11 handled thing makes zero sense"). The most frequent kind leads.
const DID: Record<string, (n: number) => string> = {
  delist_after_sale: n => `took ${n === 1 ? 'a listing' : `${n} listings`} down`,
  answer_fact: n => `answered ${n === 1 ? 'a buyer' : `${n} buyers`}`,
  counter_offer: n => `countered ${n === 1 ? 'an offer' : `${n} offers`}`,
  offer_to_watchers: n => `sent ${n === 1 ? 'a deal' : `${n} deals`} to watchers`,
  decline_offer: n => `turned down ${n === 1 ? 'a lowball' : `${n} lowballs`}`,
  book_pickup: n => `booked ${n === 1 ? 'a pickup' : `${n} pickups`}`,
  'listing.posted': n => `posted ${n === 1 ? 'a listing' : `${n} listings`}`,
  push_my_edit: n => `pushed ${n === 1 ? 'an edit' : `${n} edits`}`,
};
export function handledLine(w: World): string | null {
  const done = handled(w);
  if (!done.length) return null;
  const by = new Map<string, number>();
  for (const e of done) by.set(e.action, (by.get(e.action) ?? 0) + 1);
  const parts = [...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => (DID[k] ?? (m => `did ${m === 1 ? 'a thing' : `${m} things`}`))(n));
  // One line holds about 34 characters: the most frequent kind, and how many other things, which the log names.
  const rest = done.length - [...by.values()].sort((a, b) => b - a)[0];
  const text = rest ? `${parts[0]}, and ${rest} more` : parts[0];
  return text[0].toUpperCase() + text.slice(1);
}

// The log behind the handled line: what it did since the last open, and anything older it can still undo, newest first.
export function log(w: World): (LogEvent & { photo: PhotoKey | null; can_undo: boolean })[] {
  const now = ms(w.now), since = new Set(handled(w).map(e => e.event_id));
  return w.events
    .filter(e => e.actor === 'auto' && (since.has(e.event_id) || (e.undo.allowed && e.undo.until && ms(e.undo.until) > now)))
    .sort((a, b) => ms(b.at) - ms(a.at))
    .map(e => ({ ...e, photo: itemPhoto(itemById(w, e.item_id)), can_undo: !!(e.undo.allowed && e.undo.until && ms(e.undo.until) > now) }));
}

// When a card put off with Later comes back: this evening, or an hour before its deadline when that is sooner (ways-out, Today).
export function backAt(w: World, due: number | null): string {
  const evening = new Date(ms(w.now)); evening.setUTCHours(24, 0, 0, 0); // 6 pm in Chicago (UTC-6)
  const at = due != null && due - 3600e3 < evening.getTime() ? due - 3600e3 : evening.getTime();
  return `Back at ${clock(new Date(Math.max(at, ms(w.now) + 15 * 60e3)).toISOString())}`;
}

export const inbox = (w: World) => unread(w);
// How long a demo job takes before it lands, so the working state is seen (spec today.md: the card shows the step running).
export const JOB_MS = 900;
export const ordered = order;

// One entry per decision in a queue, for the full-screen review: the item, the agent's price and the sites it would post to.
export function entries(w: World, card: Card) {
  return card.ids.map(id => {
    const d = w.decisions.find(x => x.id === id)!, it = itemById(w, d.item_id);
    const sites = (it?.valuation?.per_site.map(p => p.site) ?? (d.site ? [d.site] : [])).slice(0, 5) as Site[];
    return { id, item_id: d.item_id, title: it?.title ?? asLabel(d.why), photo: itemPhoto(it), cents: d.money?.price_cents ?? 0, sites };
  });
}
