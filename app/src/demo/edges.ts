// Content for the break pass (break-ui): the longest real titles, huge and zero amounts, one item, a failed site,
// an expired offer, and a card in each state. `edge` is the clearing world with all of it added, so one render shows every break.
import { decision, item, listings, offerIn, standing, valuation, youKeep } from './build.ts';
import { draft } from './capture.ts';
import { inHours, inMinutes, usd } from './format.ts';
import type { Decision, Item, Message } from './types.ts';
import { clearing } from './worlds/clearing.ts';
import type { World } from './world.ts';

// Real titles at each site's limit and past it: eBay stops at 80 characters; Depop and Facebook take a description as the title.
export const TITLES = {
  ebay80: 'Carhartt Detroit Jacket J97 Brown Duck Blanket Lined Mens Large Vintage 90s USA',
  long: 'Carhartt Men’s Detroit Jacket J97 Brown Duck Blanket Lined Canvas Work Coat, Size Large Regular, Vintage 1990s, Made in USA, Union Made, Light Fraying on Cuff',
  oneWord: 'Lamp',
  unbroken: 'NintendoSwitchOLEDWhiteJoyConsDockHDMICableCaseScreenProtectorBundle',
};
// Amounts in cents. `huge` is what 1950s Levi’s sell for; `absurd` is the widest a row must still hold.
export const AMOUNTS = { zero: 0, cents: 5, under_a_dollar: 99, typical: 8500, odd: 4237, huge: 1249999, absurd: 99999999 } as const;
export const NAMES = { longBuyer: 'vintage_workwear_collector_and_reseller_since_2009', shortBuyer: 'K' };

const longItem = item({
  id: 'it_long', title: TITLES.long, key: 'carhartt-jacket', state: 'live', category: 'apparel', days: 2,
  floor: 7000, value: valuation(8500, 11500, 41, ['ebay', 'depop'], 'ci_long'),
  sell: [{ site: 'ebay', price: 9800, days: 2, views: 4, standing: standing('still_learning', 'Waiting on more sales of this one.') }],
});
const hugeItem = item({
  id: 'it_huge', title: 'Levi’s 501XX, 1950s, big E, selvedge, 33x32', key: 'levis-501', state: 'live', category: 'apparel', days: 5,
  floor: 1100000, value: valuation(1150000, 1350000, 22, ['ebay'], 'ci_huge'), plan: 'reserve',
  sell: [{ site: 'ebay', price: AMOUNTS.huge, days: 5, views: 2210, watchers: 87, standing: standing('waiting_for_price', 'Waiting for your price. 3 sold near it this month.') }],
});
const freeItem = item({
  id: 'it_free', title: 'Free: IKEA Stefan chair, pick up today', key: 'ikea-chair', state: 'live', category: 'furniture', days: 1, floor: 0,
  value: valuation(0, 2000, 6, ['facebook'], 'ci_free'), sell: [{ site: 'facebook', price: AMOUNTS.zero, days: 1, views: 61 }],
});
const failedItem: Item = {
  ...item({ id: 'it_fail', title: 'Patagonia Better Sweater, grey, S', key: 'patagonia-fleece', state: 'live', category: 'apparel', days: 1, floor: 5000, value: valuation(5500, 8000, 19, ['depop', 'mercari'], 'ci_fail') }),
  listings: listings('it_fail', [{ site: 'depop', price: 6800, days: 1, likes: 2 }, { site: 'mercari', price: 7000, state: 'postFailed', error: 'The site asked for a size before it would post' }]),
};

const expired = offerIn('of_exp', 'cv_jd', clearing.items[0].listings[1], 7600, 30, -6, 'expired');
const deadSoon = offerIn('of_soon', 'cv_long', longItem.listings[0], 9000, 1, 0.1);

const cards: Decision[] = [
  decision({
    id: 'dec_fail', kind: 'failed_post', item_id: failedItem.id, site: 'mercari', feed: 'now', group_form: 'single', deadline: null, error: 'The site asked for a size before it would post',
    why: 'Couldn’t post here: the site wants a size.', options: [{ id: 'retry', label: 'Add size S and retry', does: 'Posts again with size S from the tag.' }, { id: 'self', label: 'Do it myself', does: 'Opens the site.' }, { id: 'skip', label: 'Skip this site', does: 'Keeps the other listing up.' }], suggested: 'retry',
  }),
  decision({
    id: 'dec_soon', kind: 'accept_offer', item_id: longItem.id, site: 'ebay', feed: 'now', group_form: 'single', deadline: deadSoon.expires_at, offer_ids: [deadSoon.id],
    why: `${NAMES.longBuyer} offered ${usd(9000)}. Your lowest is ${usd(7000)}.`, money: { offer_cents: 9000, you_keep_cents: deadSoon.you_keep_cents },
    options: [{ id: 'acc', label: `Accept ${usd(9000)}`, does: `You get ${usd(deadSoon.you_keep_cents)}.` }, { id: 'dec', label: 'Decline', does: 'The listing stays up.' }], suggested: 'acc',
  }),
  decision({
    id: 'dec_exp', kind: 'accept_offer', item_id: clearing.items[0].id, site: 'depop', feed: 'now', group_form: 'single', state: 'expired', deadline: expired.expires_at, offer_ids: [expired.id],
    why: 'This offer ran out before you answered. The listing is still up.', money: { offer_cents: 7600, you_keep_cents: expired.you_keep_cents }, options: [], suggested: null,
  }),
  decision({
    id: 'dec_huge', kind: 'price_below_floor', item_id: hugeItem.id, site: 'ebay', feed: 'now', group_form: 'single', deadline: inHours(20),
    why: `Offer of ${usd(AMOUNTS.huge - 150000)} is below your lowest, ${usd(1100000)}.`, money: { offer_cents: AMOUNTS.huge - 150000, you_keep_cents: youKeep('ebay', AMOUNTS.huge - 150000), floor_cents: 1100000 },
    options: [{ id: 'acc', label: `Accept ${usd(AMOUNTS.huge - 150000)}`, does: 'Sells below your lowest. Only you can do this.' }, { id: 'ctr', label: `Counter ${usd(1100000)}`, does: 'Counters at your lowest.' }, { id: 'dec', label: 'Decline', does: 'The listing stays up.' }], suggested: 'ctr',
  }),
  decision({ id: 'dec_acting', kind: 'buy_label', item_id: clearing.items[3].id, site: 'ebay', feed: 'when_you_can', group_form: 'single', state: 'acting', deadline: inHours(54), why: 'Buying the label', options: [{ id: 'buy', label: 'Buy label $6.40', does: 'Buying now.' }], suggested: 'buy' }),
  decision({ id: 'dec_failed', kind: 'relist', item_id: clearing.items[1].id, site: 'ebay', feed: 'when_you_can', group_form: 'single', state: 'failed', deadline: null, error: 'The site timed out', why: 'Couldn’t relist: the site timed out.', options: [{ id: 'retry', label: 'Retry', does: 'Tries again now.' }], suggested: 'retry' }),
];

const longMessage: Message = {
  id: 'msg_long', conversation_id: 'cv_jd', actor: 'counterpart', sent_at: inMinutes(-2), intent: 'question', facets: [],
  text: 'Hi, I’m interested in this jacket for my dad’s birthday next weekend. Could you tell me the exact measurements pit to pit and the sleeve length from the shoulder seam, whether the blanket lining has any holes or stains, whether the zipper runs smoothly all the way, and if you’d be able to ship it by Tuesday so it arrives in time? Also would you take 80 if I buy today? Thank you so much.',
};

export const edge: World = {
  ...clearing, name: 'edge',
  // The camera's draft, waiting on review (capture.ts, draft).
  items: [longItem, hugeItem, freeItem, failedItem, draft(), ...clearing.items],
  offers: [...clearing.offers, expired, deadSoon],
  messages: [...clearing.messages, longMessage],
  conversations: clearing.conversations.map(c => c.id === 'cv_jd' ? { ...c, buyer: NAMES.longBuyer, unread: 128 } : c),
  decisions: [...cards, ...clearing.decisions],
};

// One thing for sale, nothing else: the smallest world that is not empty.
export const one: World = {
  ...clearing, name: 'one', items: [clearing.items[0]], offers: [], orders: [], appointments: [], conversations: [], messages: [],
  decisions: [], notices: [], events: [], user: { ...clearing.user, last_open_at: inHours(-2) },
};
