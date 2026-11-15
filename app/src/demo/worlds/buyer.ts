// Rarely sells, mostly hunting: three wants, matches arriving, one offer waiting on their tap, one site still linking.
// Nothing on the buy side commits them without a tap (product.md §5).
import { decision, item, sale, valuation } from '../build.ts';
import { inDays, inHours, inMinutes } from '../format.ts';
import { PRODUCTS, RETAIL, SEARCH_DUNKS, SEARCH_EMPTY } from '../market.ts';
import type { Match } from '../types.ts';
import type { World } from '../world.ts';

const kindle = item({
  id: 'it_bkin', title: 'Kindle Paperwhite 10th gen, 8 GB', key: 'kindle', state: 'done', category: 'electronics', days: 70, where: 'Sold',
  floor: 4000, value: valuation(4500, 6000, 52, ['ebay'], 'ci_bk'), sell: [{ site: 'ebay', price: 5500, state: 'delisted', days: 68 }],
});
const fleece = item({
  id: 'it_bfl', title: 'Patagonia Retro-X fleece, cream, M', key: 'patagonia-fleece', state: 'owned', category: 'apparel', days: 40, where: 'Bedroom', origin: 'purchase',
  value: valuation(9500, 13000, 27, ['depop', 'poshmark'], 'ci_fl'), cost: 7800,
});

const fromSearch = (id: string, over: Partial<Match>): Match => ({ ...SEARCH_DUNKS.rows.find(r => r.id === id)!, want_id: 'want_dunk', source: 'want', ...over });
const matches: Match[] = [
  fromSearch('mt_d1', { state: 'alerted', seen_at: inMinutes(-12) }),
  fromSearch('mt_d2', { state: 'saved', seen_at: inHours(-5) }),
  fromSearch('mt_d3', { state: 'alerted', seen_at: inMinutes(-40) }),
  fromSearch('mt_d4', { state: 'gone', seen_at: inDays(-2) }),
  { id: 'mt_k1', state: 'found', want_id: 'want_kin', source: 'want', label: 'likely_same_model', site: 'mercari', title: 'Kindle Paperwhite, 16 GB, signature edition', key: 'kindle', url: 'https://example.invalid/mercari/mt_k1', price_cents: 8900, delivered_cents: 9650, condition: 'Used, like new', seller: 'a person', verdict: 'high', seen_at: inDays(-3), product_id: null },
];

export const buyer: World = {
  name: 'buyer', now: inHours(0),
  user: {
    id: 'usr_buy', name: 'Riley', locale: 'en-US', currency: 'USD', timezone: 'America/Chicago', last_open_at: inHours(-30),
    auth_methods: [{ provider: 'google', linked_at: inDays(-80) }, { provider: 'email', linked_at: inDays(-20) }],
    onboarding: { done_steps: ['signed_in', 'sites_picked', 'sites_linked', 'imported', 'pickups', 'notifications'], finished_at: inDays(-80) },
    notification_pref: [{ event_kind: 'match', channel: 'push' }, { event_kind: 'offer', channel: 'push' }, { event_kind: 'digest', channel: 'batch' }],
    experiments_consent: false,
  },
  connections: [
    { site: 'ebay', account: { id: 'acc_beb', site: 'ebay', route: 'harness', health: 'ok', linked_at: inDays(-80), checked_at: inMinutes(-3), capabilities: ['read_listings', 'save', 'make_offer'] }, linking: null, error: null },
    { site: 'mercari', account: null, linking: { stage: 'Waiting for you to finish signing in', started_at: inMinutes(-1) }, error: null },
    { site: 'depop', account: { id: 'acc_bdp', site: 'depop', route: 'harness', health: 'expiring', linked_at: inDays(-60), checked_at: inMinutes(-30), capabilities: ['read_listings', 'save'] }, linking: null, error: null },
    { site: 'facebook', account: null, linking: null, error: null },
    { site: 'poshmark', account: null, linking: null, error: null },
  ],
  items: [kindle, fleece], offers: [],
  orders: [
    sale({ id: 'ord_bk', item: kindle, site: 'ebay', price: 5500, state: 'released', hoursAgo: 60 * 24, buyer: 'pageturner', label: 590, releaseIn: -50 * 24 }),
    { id: 'ord_bfl', kind: 'purchase', item_id: fleece.id, listing_id: null, site: 'depop', state: 'released', price_cents: 7800, fees_cents: 0, shipping_cents: 650, payout_cents: null, buyer: 'you', label: null, clocks: {}, external_order_id: 'DE-8812', created_at: inDays(-40) },
  ],
  appointments: [],
  conversations: [{ id: 'cv_bd', site: 'ebay', item_id: null, listing_id: null, match_id: 'mt_d2', role: 'buy', buyer: 'solesupply', intent_last: 'question', state: 'open', last_read_at: inHours(-2), unread: 1 }],
  messages: [
    { id: 'msg_bd1', conversation_id: 'cv_bd', actor: 'user', sent_at: inHours(-4), intent: 'question', facets: [], text: 'Are there any creases on the toe box?' },
    { id: 'msg_bd2', conversation_id: 'cv_bd', actor: 'counterpart', sent_at: inHours(-1), intent: 'answer', facets: [], text: 'Light creasing on the left toe, soles are clean. Can send more photos.' },
  ],
  decisions: [
    decision({
      id: 'dec_bo', kind: 'buy_offer', item_id: null, site: 'ebay', match_id: 'mt_d2', feed: 'when_you_can', group_form: 'single', deadline: null,
      why: 'Grey Fog Dunks in your size, $76.50 delivered. Fair used is $65 to $95.', money: { offer_cents: 6500, price_cents: 7000 }, allow_other: true,
      options: [{ id: 'send', label: 'Offer $65', does: 'Sends $65 to the seller. If they accept, you pay on the site.' }, { id: 'change', label: 'Change amount', does: 'Pick another amount up to your most, $80.' }, { id: 'skip', label: 'Skip', does: 'Keeps watching.' }], suggested: 'send',
    }),
    decision({
      id: 'dec_ceil', kind: 'offer_over_ceiling', item_id: null, site: 'mercari', match_id: 'mt_k1', feed: 'when_you_can', group_form: 'single', deadline: null,
      why: 'A Kindle that fits, but $96.50 delivered is over your most of $70.', money: { price_cents: 8900 },
      options: [{ id: 'raise', label: 'Raise my most to $97', does: 'Lets this one through. You still tap to buy.' }, { id: 'walk', label: 'Walk away', does: 'Hides this listing.' }], suggested: 'walk',
    }),
    decision({
      id: 'dec_dyb', kind: 'did_you_buy', item_id: null, site: 'depop', match_id: 'mt_d4', feed: 'good_to_know', group_form: 'single', deadline: null,
      why: 'A pair you saved is gone. Did you buy it?', options: [{ id: 'yes', label: 'Yes, I bought it', does: 'Adds it to your things with what you paid.' }, { id: 'no', label: 'No', does: 'Keeps your search going.' }], suggested: null,
    }),
    decision({
      id: 'dec_relink_dp', kind: 'site_warning', item_id: null, site: 'depop', account_id: 'acc_bdp', feed: 'good_to_know', group_form: 'single', deadline: inDays(3),
      why: 'Your sign-in ends in 3 days. Saving listings stops after that.', options: [{ id: 'relink', label: 'Sign in again', does: 'Opens the site’s own sign-in.' }, { id: 'later', label: 'Later', does: 'Reminds you the day before.' }], suggested: 'relink',
    }),
  ],
  notices: [],
  events: [{ event_id: 'ev_b1', item_id: null, action: 'save_match', actor: 'auto', site: 'ebay', at: inHours(-5), why: 'Saved to your watch list on the site, as you set', undo: { allowed: true, until: inHours(19) } }],
  rules: [{ id: 'ru_save', kind: 'save_match', scope: 'all', state: 'auto', unedited_approvals: 3, last_used_at: inHours(-5), when: 'an exact match turns up', if: 'it is under your most', then: 'save it on the site' }],
  limits: { handover: ['ship'], pickup_windows: [], saved_spot: null, ask_every_time: true },
  goal: null,
  style: [
    { name: 'size', value: 'Men’s 10', weight: 0.9, from: 'edited', pinned: true, why: 'You set this' },
    { name: 'brand', value: 'Nike', weight: 0.6, from: 'saved', pinned: false, why: 'You saved 4 pairs' },
    { name: 'brand', value: 'Patagonia', weight: 0.45, from: 'bought', pinned: false, why: 'You bought a fleece in October' },
  ],
  wants: [
    { id: 'want_dunk', state: 'active', text: 'Nike Dunk Low Grey Fog, men’s 10, under $80', product_id: 'pr_dunk', fit: { size: '10', condition_floor: 'Used, good' }, max_total_cents: 8000, sites: ['ebay', 'mercari', 'depop', 'facebook'], checked: { ebay: inMinutes(-4), depop: inMinutes(-4), facebook: inMinutes(-9), mercari: inHours(-2) }, behind: ['mercari'], quiet_hours: { from: '22:00', to: '07:00' }, alert: 'under' },
    { id: 'want_kin', state: 'paused', text: 'Kindle Paperwhite under $70', product_id: null, fit: { condition_floor: 'Used, good' }, max_total_cents: 7000, sites: ['ebay', 'mercari'], checked: { ebay: inDays(-3), mercari: inDays(-3) }, behind: [], quiet_hours: null, alert: 'under' },
    { id: 'want_oven', state: 'active', text: 'Le Creuset dutch oven, 5.5 qt, any color', product_id: null, fit: { radius_mi: 25 }, max_total_cents: 15000, sites: ['facebook', 'ebay'], checked: { ebay: inMinutes(-6) }, behind: [], quiet_hours: null, alert: 'available' },
  ],
  matches, products: PRODUCTS, searches: [SEARCH_DUNKS, SEARCH_EMPTY], retail: RETAIL,
};
