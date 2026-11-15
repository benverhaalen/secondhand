// A world is everything one person's app holds at NOW. Pages read a world and the derived views below;
// a number on a screen is computed here from the rows, never typed into a page.
import type { Pill, SellItem } from '../sell/grid.ts';
import { NOW, day, ms } from './format.ts';
import type {
  Appointment, Cents, Connection, ConnectionState, Conversation, Decision, Feed, Goal, Item, Limits, LogEvent, Match, Message, Notice,
  OnboardingStep, Offer, Order, Product, RetailOffer, Rule, SearchResult, Site, StyleFacet, User, Want,
} from './types.ts';

export type WorldName = 'new' | 'clearing' | 'flipper' | 'buyer';
export type World = {
  name: WorldName | string; now: string; user: User; connections: Connection[]; items: Item[]; offers: Offer[]; orders: Order[];
  appointments: Appointment[]; conversations: Conversation[]; messages: Message[]; decisions: Decision[]; notices: Notice[];
  events: LogEvent[]; rules: Rule[]; limits: Limits; goal: Goal | null; style: StyleFacet[];
  wants: Want[]; matches: Match[]; products: Product[]; searches: SearchResult[]; retail: RetailOffer[];
};

export const connectionState = (c: Connection): ConnectionState =>
  c.linking ? 'loading' : c.error || c.account?.health === 'broken' ? 'error' : c.account ? 'connected' : 'not_connected';

const openDecisions = (w: World, itemId: string) => w.decisions.filter(d => d.item_id === itemId && d.state === 'open');

// The one pill a Sell tile shows (product.md §4 Item): Failed beats everything, then what needs the person, then the stage.
export function pill(w: World, it: Item): Pill {
  if (it.state === 'failed' || it.listings.some(l => l.state === 'postFailed' || l.state === 'delistFailed')) return 'Failed';
  if (openDecisions(w, it.id).some(d => d.kind === 'accept_offer' || d.kind === 'price_below_floor')) return 'Offer';
  if (w.orders.some(o => o.item_id === it.id && o.kind === 'sale' && (o.state === 'to_ship' || o.state === 'paid' || o.state === 'pickup_booked'))) return 'Ship by';
  if (['sold', 'handed_over', 'done'].includes(it.state)) return 'Sold';
  if (it.state === 'stale') return 'Slow';
  if (it.state === 'live') return 'Live';
  if (it.state === 'researching' || it.state === 'capturing') return 'Researching';
  return 'Review';
}

export function sellItem(w: World, it: Item): SellItem {
  const live = it.listings.filter(l => l.state === 'live' || l.state === 'postFailed');
  const first = live.map(l => l.posted_at).filter((t): t is string => !!t).sort()[0];
  return { id: it.id, pill: pill(w, it), sites: it.listings.filter(l => l.state !== 'none').map(l => l.site), price_cents: live.length ? Math.min(...live.map(l => l.price_cents)) : null, listed_at: first ?? it.created_at };
}

// The Sell tab's shelves, in the decided order (pages.md §6.10). Unsold and Kept fold at the bottom.
export function shelves(w: World): { id: string; title: string; items: Item[] }[] {
  const selling = w.items.filter(i => i.state !== 'owned');
  const needs = selling.filter(i => openDecisions(w, i.id).length);
  const rest = selling.filter(i => !needs.includes(i));
  return [
    { id: 'needs_you', title: 'Needs you', items: needs },
    { id: 'in_progress', title: 'In progress', items: rest.filter(i => ['capturing', 'researching', 'review', 'failed'].includes(i.state)) },
    { id: 'live', title: 'Live', items: rest.filter(i => i.state === 'live' || i.state === 'stale') },
    { id: 'sold', title: 'Sold', items: rest.filter(i => ['sold', 'handed_over', 'done', 'returned', 'disputed'].includes(i.state)) },
    { id: 'unsold', title: 'Unsold', items: rest.filter(i => i.state === 'unsold') },
    { id: 'kept', title: 'Kept', items: rest.filter(i => i.state === 'kept') },
  ];
}

const kept = (o: Order) => o.price_cents - o.fees_cents - o.shipping_cents;
const sales = (w: World) => w.orders.filter(o => o.kind === 'sale' && o.state !== 'cancelled' && o.state !== 'refunded');

export const SETUP: { step: OnboardingStep; label: string }[] = [
  { step: 'signed_in', label: 'Sign in' }, { step: 'sites_picked', label: 'Pick your sites' }, { step: 'sites_linked', label: 'Link your sites' },
  { step: 'imported', label: 'Bring in your listings' }, { step: 'email', label: 'Connect email for sales' }, { step: 'pickups', label: 'Set pickup times' },
  { step: 'notifications', label: 'Turn on alerts' },
];
export const setupSteps = (w: World) => SETUP.map(s => ({ ...s, done: w.user.onboarding.done_steps.includes(s.step) }));

// The top of Today (decided, pages.md §4): money kept since the last open, or the next setup step, or nothing. Never $0.
export type Headline = { kind: 'kept_since_last_open'; value: Cents; label: string; sub: string; path: '/you' } | { kind: 'next_setup_step'; value: null; label: string; sub: string; path: string; site?: Site };
export function headline(w: World): Headline | null {
  const since = w.user.last_open_at;
  const fresh = since ? sales(w).filter(o => ms(o.created_at) > ms(since)) : [];
  const total = fresh.reduce((a, o) => a + kept(o), 0);
  if (fresh.length && total > 0) {
    const when = day(since!, w.now);
    return { kind: 'kept_since_last_open', value: total, label: when === 'Today' ? 'Since this morning' : `Since ${when === 'Yesterday' ? 'yesterday' : when}`, sub: `${fresh.length} sold, after fees`, path: '/you' };
  }
  if (!w.user.onboarding.finished_at) {
    const unlinked = w.connections.find(c => connectionState(c) === 'not_connected');
    if (unlinked) return { kind: 'next_setup_step', value: null, label: 'Link a site', sub: 'Then we can bring in what you already list', path: '/onboarding/sites', site: unlinked.site };
    const next = setupSteps(w).find(s => !s.done);
    if (next) return { kind: 'next_setup_step', value: null, label: next.label, sub: '', path: `/onboarding/${next.step}` };
  }
  return null;
}

const FEED_ORDER: Feed[] = ['now', 'when_you_can', 'good_to_know'];
const stake = (d: Decision) => d.money?.you_keep_cents ?? d.money?.price_cents ?? d.money?.offer_cents ?? 0;
// Today's feed (pages.md §5): by tier, then soonest deadline, then money at stake, then age.
export function feed(w: World): Decision[] {
  return w.decisions.filter(d => d.state === 'open' || d.state === 'acting' || d.state === 'failed').sort((a, b) =>
    FEED_ORDER.indexOf(a.feed) - FEED_ORDER.indexOf(b.feed)
    || (a.deadline ? ms(a.deadline) : Infinity) - (b.deadline ? ms(b.deadline) : Infinity)
    || stake(b) - stake(a) || ms(a.created_at) - ms(b.created_at) || (a.group_rank ?? 0) - (b.group_rank ?? 0));
}
// Several open cards of one batch or queue kind draw as one group ("Print 3 labels", "1 of 40").
export function groups(w: World): { key: string; form: Decision['group_form']; cards: Decision[] }[] {
  const out: { key: string; form: Decision['group_form']; cards: Decision[] }[] = [];
  const ONE_DAY = 864e5;
  for (const d of feed(w)) {
    const dueSoon = d.deadline !== null && ms(d.deadline) - ms(w.now) < ONE_DAY; // anything due within a day never stacks (pages.md §5)
    const g = d.group_key && !dueSoon && out.find(x => x.key === d.group_key);
    if (g) g.cards.push(d); else out.push({ key: dueSoon ? d.id : d.group_key ?? d.id, form: dueSoon ? 'single' : d.group_form, cards: [d] });
  }
  return out;
}

export const unread = (w: World) => w.conversations.reduce((a, c) => a + c.unread, 0);
export const thread = (w: World, conversationId: string) => w.messages.filter(m => m.conversation_id === conversationId).sort((a, b) => ms(a.sent_at) - ms(b.sent_at));
export const itemById = (w: World, id: string | null) => w.items.find(i => i.id === id) ?? null;
// The automatic actions since the last open: the log behind Today's handled line.
export const handled = (w: World) => w.events.filter(e => e.actor === 'auto' && (!w.user.last_open_at || ms(e.at) > ms(w.user.last_open_at)));

// You: the numbers. Money kept is after fees and label costs.
export function insights(w: World) {
  const s = sales(w);
  const bySite = (['ebay', 'facebook', 'depop', 'poshmark', 'mercari'] as Site[]).map(site => {
    const here = s.filter(o => o.site === site);
    const days = here.map(o => { const l = w.items.find(i => i.id === o.item_id)?.listings.find(x => x.id === o.listing_id); return l?.posted_at ? (ms(o.created_at) - ms(l.posted_at)) / 864e5 : null; }).filter((d): d is number => d !== null);
    return { site, sold: here.length, earned_cents: here.reduce((a, o) => a + o.price_cents, 0), kept_cents: here.reduce((a, o) => a + kept(o), 0), days_to_sell: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null };
  }).filter(r => r.sold || w.connections.some(c => c.site === r.site && c.account));
  const live = w.items.filter(i => i.state === 'live' || i.state === 'stale');
  const month = w.now.slice(0, 7), thisMonth = s.filter(o => o.created_at.startsWith(month));
  return {
    sold: s.length,
    earned_cents: s.reduce((a, o) => a + o.price_cents, 0),
    fees_cents: s.reduce((a, o) => a + o.fees_cents + o.shipping_cents, 0),
    kept_cents: s.reduce((a, o) => a + kept(o), 0),
    on_its_way_cents: s.filter(o => o.state !== 'released').reduce((a, o) => a + kept(o), 0),
    could_earn: live.length ? { low: live.reduce((a, i) => a + (i.valuation?.range.low ?? 0), 0), high: live.reduce((a, i) => a + (i.valuation?.range.high ?? 0), 0) } : null,
    kept_worth: w.items.filter(i => i.state === 'kept' || i.state === 'owned').map(i => ({ item_id: i.id, range: i.valuation?.range ?? null })),
    by_site: bySite,
    goal: w.goal ? { ...w.goal, progress_cents: thisMonth.reduce((a, o) => a + kept(o), 0), sales: thisMonth.length } : null,
  };
}

// Money that has landed or is due, newest first.
export const payouts = (w: World) => sales(w).filter(o => o.clocks.release_at || o.payout_cents !== null)
  .map(o => ({ order_id: o.id, item_id: o.item_id, site: o.site, amount_cents: o.payout_cents ?? kept(o), at: o.clocks.release_at ?? o.created_at, landed: o.state === 'released' }))
  .sort((a, b) => ms(b.at) - ms(a.at));

// Records and tax: the year's sales, one row each.
export const records = (w: World) => sales(w).filter(o => o.created_at.startsWith(w.now.slice(0, 4))).map(o => {
  const it = w.items.find(i => i.id === o.item_id);
  return { order_id: o.id, date: o.created_at.slice(0, 10), title: it?.title ?? '', site: o.site, price_cents: o.price_cents, fees_cents: o.fees_cents, shipping_cents: o.shipping_cents, cost_cents: it?.cost?.amount_cents ?? null, kept_cents: kept(o) };
});

export const defaultNow = NOW;
