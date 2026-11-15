// The stress case (personas.md: a reseller never shapes a design, it only has to hold): 64 things across all five sites,
// six labels to print, offers on several items, and 40 first posts waiting after a folder of photos was dropped in.
import { decision, item, offerIn, sale, standing, valuation } from '../build.ts';
import { inDays, inHours, inMinutes, usd, when } from '../format.ts';
import { PRODUCTS, RETAIL, SEARCH_DUNKS } from '../market.ts';
import type { PhotoKey } from '../photo-keys.ts';
import type { Decision, Item, KindFamily, Order, Site } from '../types.ts';
import type { World } from '../world.ts';

type Stock = { key: PhotoKey; category: KindFamily; titles: string[]; price: number };
const STOCK: Stock[] = [
  { key: 'carhartt-jacket', category: 'apparel', price: 9500, titles: ['Carhartt Detroit Jacket J97, brown duck, L', 'Carhartt Active Jacket J130, brown, XL', 'Carhartt chore coat C001, brown, M', 'Carhartt Santa Fe jacket, blanket lined, L'] },
  { key: 'levis-501', category: 'apparel', price: 4200, titles: ['Levi’s 501, 32x30, light wash', 'Levi’s 505, 34x32, medium wash', 'Levi’s 550 relaxed, 36x30', 'Levi’s 501 shrink to fit, 30x32'] },
  { key: 'nike-dunks', category: 'shoes', price: 8200, titles: ['Nike Dunk Low Grey Fog, men’s 10', 'Nike Dunk Low Panda, men’s 9.5', 'Nike Dunk Low Grey Fog, women’s 8'] },
  { key: 'patagonia-fleece', category: 'apparel', price: 10500, titles: ['Patagonia Retro-X fleece, cream, M', 'Patagonia Synchilla snap-T, oatmeal, L', 'Patagonia Better Sweater, grey, S'] },
  { key: 'switch-oled', category: 'electronics', price: 23500, titles: ['Nintendo Switch OLED, white, with dock', 'Nintendo Switch OLED, neon, no box'] },
  { key: 'kindle', category: 'electronics', price: 7200, titles: ['Kindle Paperwhite 11th gen, 16 GB', 'Kindle Oasis 10th gen, 8 GB', 'Kindle Basic 2022, 16 GB'] },
  { key: 'brass-lamp', category: 'lighting_home', price: 4500, titles: ['Brass desk lamp with cream shade', 'Brass banker’s lamp, green shade'] },
  { key: 'ikea-chair', category: 'furniture', price: 3500, titles: ['IKEA Stefan chair, light wood', 'IKEA Ingolf chair, white'] },
  { key: 'carhartt-pants', category: 'apparel', price: 4200, titles: ['Carhartt canvas work pants, faded black, 38x36', 'Carhartt double knee pants, brown, 34x32'] },
  { key: 'chico-hoodie', category: 'apparel', price: 3800, titles: ['Russell Athletic Chico State hoodie, crimson, XXL', 'Champion reverse weave hoodie, grey, L'] },
  { key: 'marquette-tee', category: 'apparel', price: 3800, titles: ['Marquette 74 Final Four tee, gold, XL', '1990s Chicago Bulls tee, black, L'] },
];
const SITES: Site[] = ['ebay', 'depop', 'mercari', 'poshmark', 'facebook'];
const pick = <T,>(xs: T[], n: number) => xs[n % xs.length];

// The n-th thing in stock: same photo pool, varied title, price and age, so 64 tiles never repeat a title twice in a row.
function stockItem(n: number, state: Item['state'], over: Partial<Parameters<typeof item>[0]> = {}): Item {
  const s = pick(STOCK, n), title = pick(s.titles, Math.floor(n / STOCK.length));
  const price = s.price + ((n * 137) % 9) * 100 - 400;
  const sites = [pick(SITES, n), pick(SITES, n + 2)];
  return item({
    id: `it_f${String(n).padStart(3, '0')}`, title, key: s.key, state, category: s.category, days: 2 + (n * 7) % 40, where: `Bin ${1 + (n % 9)}`,
    floor: Math.round(price * 0.75), cost: Math.round(price * 0.25), value: valuation(Math.round(price * 0.85), Math.round(price * 1.2), 10 + (n * 3) % 60, sites, `ci_f${n}`),
    sell: state === 'review' ? [] : sites.map((site, i) => ({ site, price: price + i * 300, days: 2 + (n * 5) % 30, views: (n * 17) % 220, likes: (n * 7) % 40, standing: n % 6 === 0 ? standing('hot', 'Ahead of similar ones.') : n % 5 === 0 ? standing('slow', 'Fewer views than similar ones this week.') : standing('on_pace', 'Inside the usual time.') })),
    ...over,
  });
}

const live = Array.from({ length: 16 }, (_, n) => stockItem(n, n % 5 === 0 ? 'stale' : 'live'));
const sold = Array.from({ length: 8 }, (_, n) => stockItem(16 + n, 'sold'));
const folder = Array.from({ length: 40 }, (_, n) => stockItem(24 + n, 'review', { origin: 'folder', group: 'grp_drop', days: 0, where: 'Folder: Nov haul' }));

const orders: Order[] = sold.map((it, n) => sale({
  id: `ord_f${n}`, item: it, site: it.listings[0].site, price: it.listings[0].price_cents, state: n < 6 ? 'to_ship' : 'released',
  hoursAgo: n < 6 ? 2 + n * 3 : 200 + n * 30, buyer: `buyer_${n + 1}`, shipBy: n < 6 ? 20 + n * 6 : undefined, label: n < 6 ? undefined : 640, releaseIn: n < 6 ? undefined : -100,
}));

const labels: Decision[] = orders.slice(0, 6).map((o, n) => decision({
  id: `dec_fl${n}`, kind: 'buy_label', item_id: o.item_id, site: o.site, feed: n < 2 ? 'now' : 'when_you_can', group_form: 'batch', group_key: 'buy_label', group_rank: n + 1,
  deadline: o.clocks.ship_by!, order_id: o.id, why: `Sold. Ship by ${when(o.clocks.ship_by!)}.`, money: { label_cents: 540 + n * 35, price_cents: o.price_cents },
  options: [{ id: 'buy', label: `Buy label ${usd(540 + n * 35)}`, does: 'Buys the cheapest tracked label for the measured box.' }, { id: 'own', label: 'I’ll ship it myself', does: 'You add the tracking number later.' }], suggested: 'buy',
}));
const posts: Decision[] = folder.map((it, n) => decision({
  id: `dec_fp${n}`, kind: 'first_post', item_id: it.id, site: null, feed: 'when_you_can', group_form: 'queue', group_key: 'first_post', group_rank: n + 1, deadline: null,
  why: `Ready to post at ${usd(it.valuation!.range.low + 500)} on 3 sites.`, money: { price_cents: it.valuation!.range.low + 500 },
  options: [{ id: 'post', label: 'Post to 3 sites', does: 'Posts it now. You can end it any time.' }, { id: 'edit', label: 'Edit first', does: 'Opens the listing.' }, { id: 'later', label: 'Not now', does: 'Keeps it as a draft.' }], suggested: 'post', created_at: inMinutes(-30),
}));
const offers = [0, 3, 7].map((n, i) => offerIn(`of_f${i}`, `cv_f${i}`, live[n].listings[0], Math.round(live[n].listings[0].price_cents * 0.85 / 100) * 100, 2 + i, 6 + i * 5));
const offerCards: Decision[] = offers.map((o, i) => decision({
  id: `dec_fo${i}`, kind: 'accept_offer', item_id: live[[0, 3, 7][i]].id, site: o.site, feed: 'now', group_form: 'single', deadline: o.expires_at, offer_ids: [o.id], conversation_id: o.conversation_id,
  why: `Offer of ${usd(o.amount_cents)}. Your lowest is ${usd(live[[0, 3, 7][i]].limits!.floor_cents)}.`, money: { offer_cents: o.amount_cents, you_keep_cents: o.you_keep_cents },
  options: [{ id: 'acc', label: `Accept ${usd(o.amount_cents)}`, does: `You get ${usd(o.you_keep_cents)}.` }, { id: 'dec', label: 'Decline', does: 'The listing stays up.' }], suggested: 'acc', allow_other: true,
}));

export const flipper: World = {
  name: 'flipper', now: inHours(0),
  user: {
    id: 'usr_flip', name: 'Dana', locale: 'en-US', currency: 'USD', timezone: 'America/Chicago', last_open_at: inHours(-9),
    auth_methods: [{ provider: 'email', linked_at: inDays(-200) }],
    onboarding: { done_steps: ['signed_in', 'sites_picked', 'sites_linked', 'imported', 'email', 'pickups', 'notifications'], finished_at: inDays(-200) },
    notification_pref: [{ event_kind: 'offer', channel: 'push' }, { event_kind: 'sale', channel: 'push' }, { event_kind: 'message', channel: 'batch' }],
    experiments_consent: true,
  },
  connections: SITES.map((site, n) => ({
    site, linking: null, error: null,
    account: { id: `acc_f${site}`, site, route: 'harness', health: site === 'mercari' ? 'expiring' : 'ok', linked_at: inDays(-200 + n), checked_at: inMinutes(-(n + 1) * 3), capabilities: ['post', 'delist', 'read_messages', 'send_message'] },
  })),
  items: [...live, ...sold, ...folder], offers, orders,
  appointments: orders.slice(0, 6).map(o => ({ id: `ap_${o.id}`, order_id: o.id, kind: 'ship_by' as const, window: { start: o.created_at, end: o.clocks.ship_by! }, place: null, state: 'booked' as const })),
  conversations: offers.map((o, i) => ({ id: o.conversation_id, site: o.site, item_id: live[[0, 3, 7][i]].id, listing_id: o.listing_id, role: 'sell' as const, buyer: `buyer_${20 + i}`, intent_last: 'offer', state: 'open' as const, last_read_at: inHours(-3), unread: 1 })),
  messages: offers.map((o, i) => ({ id: `msg_fo${i}`, conversation_id: o.conversation_id, actor: 'counterpart' as const, sent_at: o.sent_at, intent: 'offer', facets: [], text: `Would you do ${usd(o.amount_cents)}?`, offer_id: o.id })),
  decisions: [...offerCards, ...labels, ...posts,
    decision({ id: 'dec_fapp', kind: 'approve_groups', item_id: null, site: null, feed: 'when_you_can', group_form: 'queue', group_key: 'approve_groups', group_rank: 1, deadline: null, why: '212 photos made 41 items. One group looks like two things.', options: [{ id: 'ok', label: 'Approve 40', does: 'Makes 40 drafts.' }, { id: 'fix', label: 'Fix the odd one', does: 'Opens the group to split it.' }], suggested: 'fix' }),
  ],
  notices: [{ id: 'nt_f', kind: 'ranker_changed', item_id: live[1].id, text: 'Search order on one site changed this week. Visibility numbers are hidden there until it settles.', citation_id: 'ci_rk', at: inHours(-20) }],
  events: live.slice(0, 8).map((it, n) => ({ event_id: `ev_f${n}`, item_id: it.id, action: n % 2 ? 'offer_to_watchers' : 'counter_offer', actor: 'auto' as const, site: it.listings[0].site, at: inHours(-(n + 1)), why: n % 2 ? 'Sent 10% off to people watching it' : 'Countered on the price path, above your lowest', undo: { allowed: false, until: null } })),
  rules: [
    { id: 'ru_fco', kind: 'counter_offer', scope: 'all', state: 'auto', unedited_approvals: 31, last_used_at: inHours(-1), when: 'an offer comes in', if: 'it is at or above your lowest', then: 'counter on the price path' },
    { id: 'ru_fwt', kind: 'offer_to_watchers', scope: 'all', state: 'auto', unedited_approvals: 12, last_used_at: inHours(-2), when: 'a listing has watchers', if: 'it is 5 days old', then: 'send them 10% off' },
    { id: 'ru_flb', kind: 'buy_label', scope: 'all', state: 'eligible', unedited_approvals: 3, last_used_at: inDays(-1), when: 'a sale needs a label', if: 'the box is measured', then: 'buy the cheapest tracked label' },
  ],
  limits: { handover: ['ship'], pickup_windows: [], saved_spot: null, ask_every_time: true },
  goal: { month: '2026-11', target_cents: 400000, target_sales: 60 },
  style: [], wants: [], matches: [], products: PRODUCTS, searches: [SEARCH_DUNKS], retail: RETAIL,
  // A morning of sourcing: what was priced at the bins and passed on, and one thing found out. More than three, so See all shows.
  lookups: [
    { capture_id: 'cap_lk_f1', kind: 'worth', product_id: 'pr_kindle', short_name: 'Kindle', at: inMinutes(-25) },
    { capture_id: 'cap_lk_f2', kind: 'worth', product_id: 'pr_dunk', short_name: 'Nike Dunk Low', at: inHours(-3) },
    { capture_id: 'cap_lk_f3', kind: 'find', product_id: 'pr_switch', short_name: 'Nintendo console', at: inDays(-1) },
    { capture_id: 'cap_lk_f4', kind: 'worth', product_id: 'pr_j97', short_name: 'Carhartt jacket', at: inDays(-3) },
    { capture_id: 'cap_lk_f5', kind: 'find', product_id: 'pr_dunk', short_name: 'Grey sneakers', at: inDays(-120) },
  ],
};

