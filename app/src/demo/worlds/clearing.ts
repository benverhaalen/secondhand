// The person we build for: clearing out their own things, a dozen of them over five weeks, on three sites,
// with one site signed out and one never linked. Two sales landed since they last looked.
import { decision, item, offerIn, sale, standing, valuation, youKeep } from '../build.ts';
import { inDays, inHours, inMinutes, usd, when } from '../format.ts';
import { PRODUCTS, RETAIL, SEARCH_DUNKS } from '../market.ts';
import type { Conversation, Message } from '../types.ts';
import type { World } from '../world.ts';

const jacket = item({
  id: 'it_jacket', title: 'Carhartt Detroit Jacket J97, brown duck, L', key: 'carhartt-jacket', state: 'live', category: 'apparel', days: 9,
  attrs: [['brand', 'Carhartt'], ['size', 'L'], ['color', 'Brown'], ['chest_width', 610, 'measured'], ['flaw.1', 'Fraying on the left cuff', 'inferred']],
  floor: 7000, value: valuation(8500, 11500, 41, ['ebay', 'depop'], 'ci_j97'), cost: 1200, note: 'Bought at a church sale, worn twice',
  sell: [
    { site: 'ebay', price: 9800, days: 8, views: 63, watchers: 4, standing: standing('on_pace', 'Third cheapest of 14 like it. Should sell this week.', { place: { rank: 3, of: 14, basis: 'price' }, outlook: { days_lo: 4, days_hi: 9 } }) },
    { site: 'depop', price: 9500, days: 8, likes: 11, standing: standing('hot', '2 offers in 2 days. Similar ones take 9.', { place: { rank: 1, of: 9, basis: 'price' }, outlook: { days_lo: 1, days_hi: 4 } }) },
  ],
});
const lamp = item({
  id: 'it_lamp', title: 'Brass desk lamp with cream shade', key: 'brass-lamp', state: 'stale', category: 'lighting_home', days: 22, where: 'Spare room',
  attrs: [['material', 'Brass'], ['height', 457, 'measured'], ['works', 'Yes', 'you_said']], floor: 3000, value: valuation(3200, 5200, 9, ['facebook', 'ebay'], 'ci_lamp'),
  sell: [
    { site: 'facebook', price: 4500, days: 19, views: 88, standing: standing('slow', 'No messages in 9 days.', { fix: { change: 'Lower to $38', consequence: 'Sells about 6 days sooner' } }) },
    { site: 'ebay', price: 4800, days: 19, views: 41, watchers: 1, standing: standing('slow', 'Priced above 7 of 9 like it.') },
  ],
});
const chair = item({
  id: 'it_chair', title: 'IKEA Stefan chair, light wood', key: 'ikea-chair', state: 'sold', category: 'furniture', days: 12, where: 'Garage',
  floor: 2500, value: valuation(2500, 4000, 6, ['facebook'], 'ci_chair'), sell: [{ site: 'facebook', price: 3500, days: 10, views: 140 }],
});
const kindle = item({
  id: 'it_kindle', title: 'Kindle Paperwhite 11th gen, 16 GB, black', key: 'kindle', state: 'sold', category: 'electronics', days: 15, where: 'Desk drawer',
  attrs: [['storage', '16 GB'], ['battery', 'Holds a charge for weeks', 'you_said']], floor: 6000, value: valuation(6500, 8500, 64, ['ebay', 'facebook'], 'ci_kin'),
  sell: [{ site: 'ebay', price: 7200, days: 13, views: 201, watchers: 9 }, { site: 'facebook', price: 7000, state: 'delisted', days: 13 }],
});
const tee = item({
  id: 'it_tee', title: 'Marquette 74 Final Four tee, gold, XL', key: 'marquette-tee', state: 'sold', category: 'apparel', days: 18, where: 'Bin 1',
  attrs: [['brand', 'Fruit of the Loom'], ['size', 'XL'], ['pit_to_pit', 584, 'measured']], floor: 2800, value: valuation(3000, 4500, 7, ['depop', 'ebay'], 'ci_tee'),
  sell: [{ site: 'depop', price: 3800, days: 16, likes: 23 }, { site: 'ebay', price: 4000, state: 'delisted', days: 16 }],
});
const fleece = item({
  id: 'it_fleece', title: 'Patagonia Retro-X fleece, cream, M', key: 'patagonia-fleece', state: 'live', category: 'apparel', days: 4, where: 'Hall closet',
  attrs: [['brand', 'Patagonia'], ['size', 'M'], ['color', 'Natural']], floor: 8500, value: valuation(9500, 13000, 27, ['depop', 'poshmark'], 'ci_fl'),
  sell: [
    { site: 'depop', price: 11000, days: 3, likes: 31, standing: standing('hot', '31 likes in 3 days. Similar ones get 8.') },
    { site: 'poshmark', price: 11800, days: 3, likes: 6, standing: standing('still_learning', 'Waiting on more sales of this one.') },
  ],
});
const sw = item({
  id: 'it_switch', title: 'Nintendo Switch OLED, white, with dock', key: 'switch-oled', state: 'review', category: 'electronics', days: 1, where: 'TV stand',
  attrs: [['model', 'HEG-001', 'label'], ['storage', '64 GB', 'spec'], ['joy_con_drift', null], ['box', 'No', 'you_said']],
  floor: 20000, value: valuation(21000, 26000, 112, ['ebay', 'facebook'], 'ci_sw'), sell: [{ site: 'ebay', price: 23500, state: 'none' }, { site: 'facebook', price: 22500, state: 'none' }],
});
const hoodie = item({ id: 'it_hoodie', title: 'Russell Athletic Chico State hoodie, crimson, XXL', key: 'chico-hoodie', state: 'researching', category: 'apparel', days: 0, where: 'Bin 1' });
const levis = item({
  id: 'it_levis', title: 'Levi’s 501, 32x30, light wash', key: 'levis-501', state: 'done', category: 'apparel', days: 34, where: 'Bin 2',
  floor: 3000, value: valuation(3500, 5000, 38, ['ebay', 'depop'], 'ci_lv'), sell: [{ site: 'ebay', price: 4400, state: 'delisted', days: 30 }, { site: 'depop', price: 4200, state: 'delisted', days: 30 }],
});
const pants = item({
  id: 'it_pants', title: 'Carhartt canvas work pants, faded black, 38x36', key: 'carhartt-pants', state: 'live', category: 'apparel', days: 6, where: 'Bin 2',
  attrs: [['waist', 38, 'label'], ['inseam', 36, 'label'], ['inseam_measured', 889, 'measured']], floor: 2800, value: valuation(3200, 4800, 16, ['ebay', 'depop'], 'ci_pt'),
  sell: [{ site: 'ebay', price: 4200, days: 5, views: 37, watchers: 2, standing: standing('on_pace', 'Inside the usual time for these.') }, { site: 'depop', price: 4000, days: 5, likes: 8 }],
});
const dunks = item({
  id: 'it_dunks', title: 'Nike Dunk Low, Grey Fog, men’s 10', key: 'nike-dunks', state: 'kept', category: 'shoes', days: 27, where: 'Bedroom',
  value: valuation(7000, 9500, 58, ['ebay', 'depop', 'mercari'], 'ci_dunk'), kept: 'Still wear them',
});

const jd = jacket.listings[1], je = jacket.listings[0];
const offers = [
  offerIn('of_j1', 'cv_jd', jd, 8500, 3, 21),
  offerIn('of_j2', 'cv_je', je, 8000, 5, 19),
  offerIn('of_l1', 'cv_lf', lamp.listings[0], 2000, 30, null, 'declined'),
];
const orders = [
  sale({ id: 'ord_kin', item: kindle, site: 'ebay', price: 7200, state: 'to_ship', hoursAgo: 6, buyer: 'mreader_22', shipBy: 54 }),
  sale({ id: 'ord_tee', item: tee, site: 'depop', price: 3800, state: 'to_ship', hoursAgo: 10, buyer: 'goldenvintage', shipBy: 62 }),
  sale({ id: 'ord_chr', item: chair, site: 'facebook', price: 3500, state: 'pickup_booked', hoursAgo: 40, buyer: 'Jordan', local: true }),
  sale({ id: 'ord_lv', item: levis, site: 'ebay', price: 4400, state: 'released', hoursAgo: 21 * 24, buyer: 'denimdad', label: 590, releaseIn: -14 * 24 }),
];

const conversations: Conversation[] = [
  { id: 'cv_jd', site: 'depop', item_id: jacket.id, listing_id: jd.id, role: 'sell', buyer: 'thriftqueen', intent_last: 'offer', state: 'open', last_read_at: inHours(-4), unread: 1 },
  { id: 'cv_je', site: 'ebay', item_id: jacket.id, listing_id: je.id, role: 'sell', buyer: 'workwear_co', intent_last: 'offer', state: 'open', last_read_at: inHours(-5), unread: 0 },
  { id: 'cv_cf', site: 'facebook', item_id: chair.id, listing_id: chair.listings[0].id, role: 'sell', buyer: 'Jordan', intent_last: 'pickup', state: 'open', last_read_at: inHours(-1), unread: 1 },
  { id: 'cv_pd', site: 'depop', item_id: pants.id, listing_id: pants.listings[1].id, role: 'sell', buyer: 'canvasfan', intent_last: 'question', state: 'open', last_read_at: inHours(-9), unread: 1 },
  { id: 'cv_lf', site: 'facebook', item_id: lamp.id, listing_id: lamp.listings[0].id, role: 'sell', buyer: 'Alex', intent_last: 'move_off_site', state: 'open', last_read_at: inHours(-30), unread: 1 },
];
const m = (id: string, conversation_id: string, actor: Message['actor'], minutesAgo: number, intent: string, text: string, extra: Partial<Message> = {}): Message =>
  ({ id, conversation_id, actor, sent_at: inMinutes(-minutesAgo), intent, facets: [], text, ...extra });
const messages: Message[] = [
  m('msg_jd1', 'cv_jd', 'counterpart', 200, 'question', 'Is it blanket lined?'),
  m('msg_jd2', 'cv_jd', 'auto', 198, 'answer', 'Yes, blanket lined. There’s light fraying on the left cuff, shown in photo 4.'),
  m('msg_jd3', 'cv_jd', 'counterpart', 180, 'offer', 'Would you take 85?', { offer_id: 'of_j1' }),
  m('msg_je1', 'cv_je', 'counterpart', 300, 'offer', 'Offered $80', { offer_id: 'of_j2' }),
  m('msg_cf1', 'cv_cf', 'counterpart', 2400, 'question', 'Is the chair still available?'),
  m('msg_cf2', 'cv_cf', 'auto', 2398, 'answer', 'It is. I can do pickup today 3 to 3:30 at the library parking lot on Main.'),
  m('msg_cf3', 'cv_cf', 'counterpart', 2390, 'pickup', 'Perfect, see you then'),
  m('msg_cf4', 'cv_cf', 'counterpart', 50, 'address', 'Actually could I come to your place instead? Easier for me'),
  m('msg_pd1', 'cv_pd', 'counterpart', 540, 'question', 'Is the inseam really 36 or more like 34?'),
  m('msg_lf1', 'cv_lf', 'counterpart', 1820, 'offer', 'I’ll give you 20 for it', { offer_id: 'of_l1' }),
  m('msg_lf2', 'cv_lf', 'auto', 1818, 'counter', 'Thanks, the lowest I can do is $38.'),
  m('msg_lf3', 'cv_lf', 'counterpart', 600, 'move_off_site', 'Can you text me? I’ll pay by Zelle and send a driver', { facets: ['possible_scam'] }),
];

const keepJ1 = youKeep('depop', 8500), keepLabel = 640;
const decisions = [
  decision({
    id: 'dec_jacket', kind: 'accept_offer', item_id: jacket.id, site: 'depop', feed: 'now', group_form: 'single', deadline: offers[1].expires_at, offer_ids: ['of_j1', 'of_j2'], conversation_id: 'cv_jd',
    why: 'Two offers. The best is $85 on this site; your lowest is $70.', money: { offer_cents: 8500, you_keep_cents: keepJ1, floor_cents: 7000 }, allow_other: true,
    options: [
      { id: 'acc', label: 'Accept $85', does: `Sells it now. You get ${usd(keepJ1)}, and the other listing comes down.` },
      { id: 'ctr', label: 'Counter $92', does: `Sends $92. You’d get ${usd(youKeep('depop', 9200))} if they take it.` },
      { id: 'dec', label: 'Decline', does: 'Tells both buyers no. The listings stay up.' },
    ], suggested: 'ctr',
  }),
  decision({
    id: 'dec_addr', kind: 'share_address', item_id: chair.id, site: 'facebook', feed: 'now', group_form: 'single', tier: 'locked', deadline: inHours(3), conversation_id: 'cv_cf', order_id: 'ord_chr',
    why: 'Jordan wants to pick up at your home instead of the library lot.',
    options: [{ id: 'spot', label: 'Keep the library lot', does: 'Replies that pickup stays at the library lot at 3 pm.' }, { id: 'share', label: 'Share my address', does: 'Sends your home address to Jordan. Only you can do this.' }], suggested: 'spot',
  }),
  decision({
    id: 'dec_scam', kind: 'scam_warning', item_id: lamp.id, site: 'facebook', feed: 'now', group_form: 'single', deadline: null, conversation_id: 'cv_lf',
    why: 'Alex wants to pay off the site and send a driver. That’s how most lamp and furniture scams start.',
    options: [{ id: 'block', label: 'Block Alex', does: 'Blocks them on the site. The listing stays up.' }, { id: 'safe', label: 'Reply with the safety line', does: 'Says you only take payment through the site or cash at pickup.' }, { id: 'ignore', label: 'Ignore', does: 'Leaves it unanswered.' }], suggested: 'block',
  }),
  decision({
    id: 'dec_relink', kind: 'relink', item_id: null, site: 'poshmark', feed: 'now', group_form: 'single', deadline: null, account_id: 'acc_po',
    why: 'Signed out yesterday. Your fleece there can’t take offers until you sign in.', options: [{ id: 'relink', label: 'Sign in again', does: 'Opens the site’s own sign-in. We never see your password.' }], suggested: 'relink',
  }),
  decision({
    id: 'dec_lbl1', kind: 'buy_label', item_id: kindle.id, site: 'ebay', feed: 'when_you_can', group_form: 'batch', group_key: 'buy_label', group_rank: 1, deadline: orders[0].clocks.ship_by!, order_id: 'ord_kin',
    why: `Sold. Ship by ${when(orders[0].clocks.ship_by!)}.`, money: { label_cents: keepLabel, price_cents: 7200 },
    options: [{ id: 'buy', label: `Buy label ${usd(keepLabel)}`, does: 'Buys a USPS Ground Advantage label for a 9 by 6 by 1 inch padded mailer.' }, { id: 'own', label: 'I’ll ship it myself', does: 'You add the tracking number later.' }], suggested: 'buy',
  }),
  decision({
    id: 'dec_lbl2', kind: 'buy_label', item_id: tee.id, site: 'depop', feed: 'when_you_can', group_form: 'batch', group_key: 'buy_label', group_rank: 2, deadline: orders[1].clocks.ship_by!, order_id: 'ord_tee',
    why: `Sold. Ship by ${when(orders[1].clocks.ship_by!)}.`, money: { label_cents: 0, price_cents: 3800 },
    options: [{ id: 'buy', label: 'Get the prepaid label', does: 'The buyer already paid shipping. Downloads the site’s label.' }, { id: 'own', label: 'I’ll ship it myself', does: 'You add the tracking number later.' }], suggested: 'buy',
  }),
  decision({
    id: 'dec_mark', kind: 'markdown', item_id: lamp.id, site: 'facebook', feed: 'when_you_can', group_form: 'batch', group_key: 'markdown', group_rank: 1, deadline: null,
    why: 'No messages in 9 days. Lower to $38: sells about 6 days sooner.', money: { price_cents: 3800, you_keep_cents: youKeep('facebook', 3800, true), floor_cents: 3000 },
    options: [{ id: 'lower', label: 'Lower to $38', does: 'Changes the price on both sites. Still above your lowest, $30.' }, { id: 'keep', label: 'Keep $45', does: 'Asks again in a week.' }], suggested: 'lower', allow_other: true,
  }),
  decision({
    id: 'dec_post', kind: 'first_post', item_id: sw.id, site: 'ebay', feed: 'when_you_can', group_form: 'queue', group_key: 'first_post', group_rank: 1, deadline: null,
    why: 'Ready to post on 2 sites at $235. Similar ones sell in about 4 days.', money: { price_cents: 23500, you_keep_cents: youKeep('ebay', 23500), floor_cents: 20000 },
    options: [{ id: 'post', label: 'Post to 2 sites', does: 'Posts at $235 on one and $225 on the other. You can end it any time.' }, { id: 'edit', label: 'Edit first', does: 'Opens the listing to change anything.' }, { id: 'later', label: 'Not now', does: 'Keeps it as a draft.' }], suggested: 'post',
  }),
  decision({
    id: 'dec_reply', kind: 'reply_other', item_id: pants.id, site: 'depop', feed: 'when_you_can', group_form: 'single', deadline: null, conversation_id: 'cv_pd',
    why: 'canvasfan asks if the inseam is really 36. The drafted reply uses the tape measurement.',
    options: [{ id: 'send', label: 'Send', does: 'Sends: “It’s 36. I measured 35 inches flat along the inside seam, photo 3.”' }, { id: 'edit', label: 'Edit', does: 'Opens the draft.' }, { id: 'later', label: 'Not now', does: 'Leaves it unanswered.' }], suggested: 'send',
  }),
  decision({
    id: 'dec_review', kind: 'leave_review', item_id: levis.id, site: 'ebay', feed: 'good_to_know', group_form: 'batch', group_key: 'leave_review', group_rank: 1, deadline: null,
    why: 'denimdad paid fast and left you 5 stars.', options: [{ id: 'leave', label: 'Leave 5 stars', does: 'Posts “Smooth sale, thanks.” on the site.' }, { id: 'skip', label: 'Skip', does: 'No review.' }], suggested: 'leave',
  }),
];

export const clearing: World = {
  name: 'clearing', now: inHours(0),
  user: {
    id: 'usr_clear', name: 'Sam', locale: 'en-US', currency: 'USD', timezone: 'America/Chicago', last_open_at: inHours(-21),
    auth_methods: [{ provider: 'apple', linked_at: inDays(-36) }],
    onboarding: { done_steps: ['signed_in', 'sites_picked', 'sites_linked', 'imported', 'email', 'pickups', 'notifications'], finished_at: inDays(-36) },
    notification_pref: [{ event_kind: 'offer', channel: 'push' }, { event_kind: 'sale', channel: 'push' }, { event_kind: 'deadline', channel: 'push' }, { event_kind: 'message', channel: 'batch' }, { event_kind: 'digest', channel: 'off' }],
    experiments_consent: false,
  },
  connections: [
    { site: 'ebay', account: { id: 'acc_eb', site: 'ebay', route: 'harness', health: 'ok', linked_at: inDays(-36), checked_at: inMinutes(-8), capabilities: ['post', 'delist', 'read_messages', 'send_message', 'offer_to_watchers'] }, linking: null, error: null },
    { site: 'depop', account: { id: 'acc_dp', site: 'depop', route: 'harness', health: 'ok', linked_at: inDays(-36), checked_at: inMinutes(-5), capabilities: ['post', 'delist', 'read_messages', 'send_message'] }, linking: null, error: null },
    { site: 'facebook', account: { id: 'acc_fb', site: 'facebook', route: 'harness', health: 'ok', linked_at: inDays(-30), checked_at: inMinutes(-14), capabilities: ['post', 'delist', 'read_messages'] }, linking: null, error: null },
    { site: 'poshmark', account: { id: 'acc_po', site: 'poshmark', route: 'harness', health: 'broken', linked_at: inDays(-20), checked_at: inHours(-19), capabilities: ['post', 'delist'], decision_id: 'dec_relink' }, linking: null, error: 'Signed out yesterday at 9 pm' },
    { site: 'mercari', account: null, linking: null, error: null },
  ],
  items: [jacket, lamp, chair, kindle, tee, fleece, sw, hoodie, levis, pants, dunks],
  offers, orders,
  appointments: [
    { id: 'ap_chr', order_id: 'ord_chr', kind: 'pickup', window: { start: inHours(3), end: inHours(3.5) }, place: { label: 'Library parking lot, Main St' }, state: 'booked' },
    { id: 'ap_kin', order_id: 'ord_kin', kind: 'ship_by', window: { start: inHours(-6), end: orders[0].clocks.ship_by! }, place: null, state: 'booked' },
    { id: 'ap_tee', order_id: 'ord_tee', kind: 'ship_by', window: { start: inHours(-10), end: orders[1].clocks.ship_by! }, place: null, state: 'booked' },
  ],
  conversations, messages, decisions,
  notices: [
    { id: 'nt_sw', kind: 'value_moved', item_id: sw.id, text: 'Switch OLED prices rose 4% this week', citation_id: 'ci_sw', at: inHours(-8) },
    { id: 'nt_fl', kind: 'demand_rose', item_id: fleece.id, text: 'More people are searching for Retro-X fleeces', citation_id: 'ci_fl', at: inHours(-12) },
  ],
  events: [
    { event_id: 'ev_1', item_id: jacket.id, action: 'answer_fact', actor: 'auto', site: 'depop', at: inMinutes(-198), why: 'Answered “blanket lined” from the tag photo', undo: { allowed: false, until: null } },
    { event_id: 'ev_2', item_id: fleece.id, action: 'listing.posted', actor: 'auto', site: 'depop', at: inDays(-3), why: 'Posted at $110', undo: { allowed: true, until: inDays(1) } },
    { event_id: 'ev_3', item_id: kindle.id, action: 'delist_after_sale', actor: 'auto', site: 'facebook', at: inHours(-6), why: 'Took this listing down because it sold on the other site', undo: { allowed: false, until: null } },
    { event_id: 'ev_4', item_id: tee.id, action: 'delist_after_sale', actor: 'auto', site: 'ebay', at: inHours(-10), why: 'Took this listing down because it sold on the other site', undo: { allowed: false, until: null } },
    { event_id: 'ev_5', item_id: lamp.id, action: 'decline_offer', actor: 'auto', site: 'facebook', at: inMinutes(-1818), why: 'Below your lowest of $30, so it countered at $38', undo: { allowed: false, until: null } },
    { event_id: 'ev_6', item_id: chair.id, action: 'book_pickup', actor: 'auto', site: 'facebook', at: inMinutes(-2398), why: 'Inside your Sunday hours, at your saved spot', undo: { allowed: true, until: inHours(3) } },
  ],
  rules: [
    { id: 'ru_fact', kind: 'answer_fact', scope: 'all', state: 'auto', unedited_approvals: 6, last_used_at: inMinutes(-198), when: 'a buyer asks about a fact', if: 'you confirmed that fact', then: 'answer it from the listing' },
    { id: 'ru_pick', kind: 'book_pickup', scope: 'all', state: 'auto', unedited_approvals: 0, last_used_at: inMinutes(-2398), when: 'a buyer wants to pick up', if: 'it is inside your hours at your saved spot', then: 'book it' },
    { id: 'ru_dec', kind: 'decline_offer', scope: 'all', state: 'auto', unedited_approvals: 4, last_used_at: inMinutes(-1818), when: 'an offer comes in', if: 'it is below your lowest', then: 'counter at your lowest' },
    { id: 'ru_acc', kind: 'accept_offer', scope: jacket.id, state: 'ask', unedited_approvals: 2, last_used_at: inDays(-2), when: 'an offer comes in on the jacket', if: 'it is $90 or more', then: 'accept it' },
  ],
  limits: { handover: ['ship', 'pickup'], pickup_windows: [{ weekday: 'wed', from: '18:00', to: '20:00' }, { weekday: 'sat', from: '10:00', to: '13:00' }, { weekday: 'sun', from: '14:00', to: '17:00' }], saved_spot: { label: 'Library parking lot, Main St' }, ask_every_time: false },
  goal: { month: '2026-11', target_cents: 30000, target_sales: 6 },
  style: [
    { name: 'brand', value: 'Carhartt', weight: 0.82, from: 'sold', pinned: false, why: 'You sold two Carhartt pieces' },
    { name: 'size', value: 'L', weight: 0.74, from: 'kept', pinned: true, why: 'You set this' },
    { name: 'category', value: 'Workwear', weight: 0.4, from: 'saved', pinned: false, why: 'You saved 3 work jackets' },
  ],
  wants: [{ id: 'want_desk', state: 'active', text: 'Standing desk under $150 within 10 miles', product_id: null, fit: { radius_mi: 10, condition_floor: 'Used, good' }, max_total_cents: 15000, sites: ['facebook', 'ebay', 'mercari'], checked: { facebook: inMinutes(-20), ebay: inMinutes(-20), mercari: inMinutes(-55) }, behind: ['mercari'], quiet_hours: { from: '22:00', to: '08:00' }, alert: 'under' }],
  matches: [], products: PRODUCTS, searches: [SEARCH_DUNKS], retail: RETAIL,
};
