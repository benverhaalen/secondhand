import type { Account, Conversation, Decision, Item, Listing, LogEvent, Match, Order, Photo, Site, User, Want, World } from '../demo';

export type Row = Record<string, unknown>;
export const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
export const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
export const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
export const money = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : typeof object(value).amount_cents === 'number' ? number(object(value).amount_cents) : null;
export const SITES: Site[] = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
export const site = (value: unknown): Site | null => SITES.includes(value as Site) ? value as Site : null;
const url = (value: unknown) => typeof value === 'string' && /^https?:\/\//.test(value) ? value : '';
const pick = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;

export function emptyWorld(): World {
  return {
    name: 'live', now: new Date().toISOString(),
    user: { id: '', name: '', locale: 'en-US', currency: 'USD', timezone: '', last_open_at: null, auth_methods: [], onboarding: { done_steps: [], finished_at: null }, notification_pref: [], experiments_consent: false },
    connections: SITES.map(site => ({ site, account: null, linking: null, error: null })),
    items: [], offers: [], orders: [], appointments: [], conversations: [], messages: [], decisions: [], notices: [], events: [], rules: [],
    limits: { handover: [], pickup_windows: [], saved_spot: null, ask_every_time: true },
    goal: null, style: [], wants: [], matches: [], products: [], searches: [], retail: [], lookups: [],
  };
}

export function userView(raw: unknown): User {
  const row = object(raw), onboarding = object(row.onboarding);
  return { ...emptyWorld().user, id: text(row.id), name: text(row.name), timezone: text(row.timezone), last_open_at: text(row.last_open_at) || null,
    auth_methods: (Array.isArray(row.auth_methods) ? row.auth_methods : []).flatMap(value => {
      const method = typeof value === 'string' ? value : object(value).provider;
      return method === 'email' || method === 'google' || method === 'apple' ? [{ provider: method, linked_at: text(object(value).linked_at) }] : [];
    }),
    onboarding: { done_steps: (Array.isArray(onboarding.done_steps) ? onboarding.done_steps : []).filter((v): v is User['onboarding']['done_steps'][number] => ['signed_in', 'sites_picked', 'sites_linked', 'imported', 'email', 'pickups', 'notifications'].includes(String(v))), finished_at: text(onboarding.finished_at) || null },
    experiments_consent: row.experiments_consent === true,
  };
}

export function accountsView(raw: Row[]): World['connections'] {
  return SITES.map(s => {
    const row = raw.find(row => row.site === s && !row.deleted);
    const linked = row && (row.state === 'linked' || row.health !== 'paused' && !!row.linked_at);
    const account: Account | null = linked ? { id: text(row.id), site: s, route: row.route === 'search_only' ? 'search_only' : 'harness', health: pick(row.health, ['ok', 'expiring', 'broken', 'paused'], row.state === 'linked' ? 'ok' : 'paused'), linked_at: text(row.linked_at), checked_at: text(row.checked_at), capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter((x): x is string => typeof x === 'string') : [] } : null;
    return { site: s, account, linking: null, error: row?.health === 'broken' ? 'Sign in again' : null };
  });
}

function listingView(row: Row, item: string): Listing | null {
  const s = site(row.site), price = money(row.price_cents);
  if (!s || price === null) return null;
  return { id: text(row.id), item_id: item, site: s, state: pick(row.state, ['none', 'posting', 'live', 'postFailed', 'delisting', 'delisted', 'delistFailed'], 'none'), price_cents: price, url: url(row.url), interest: object(row.interest), posted_at: text(row.posted_at) || null };
}

export function itemView(row: Row): Item {
  const id = text(row.id);
  const photos: Photo[] = rows(row.photos).flatMap((p, index) => {
    const source = url(p.url ?? p.photo_url ?? p.uri);
    return source ? [{ id: text(p.id, `${id}:${index}`), role: pick(p.role, ['front', 'back', 'tag', 'detail', 'flaw', 'studio'], 'front'), use: p.use === 'improved' ? 'improved' : 'real', ai_marked: p.ai_marked === true, key: source as Photo['key'] }] : [];
  });
  return { id, title: text(row.title), state: pick(row.state, ['capturing', 'researching', 'review', 'live', 'stale', 'sold', 'handed_over', 'done', 'unsold', 'kept', 'returned', 'disputed', 'failed', 'owned'], 'review'), category: pick(row.category, ['apparel', 'shoes', 'bags', 'jewellery_watches', 'furniture', 'lighting_home', 'electronics', 'appliances_tools', 'media', 'cards_collectibles', 'toys_lego', 'bikes_sports', 'baby_gear', 'other'], 'other'), origin: pick(row.origin, ['capture', 'purchase', 'import', 'folder'], 'capture'), location: { label: text(object(row.location).label) }, quantity: number(row.quantity, 1), photos,
    attributes: rows(row.attributes).map(a => ({ id: text(a.id, text(a.name)), name: text(a.name ?? a.field), value: typeof a.value === 'number' || typeof a.value === 'string' ? a.value : null, source: pick(a.source, ['measured', 'label', 'inferred', 'spec', 'you_said', 'marketplace'], 'inferred'), confirmed: a.confirmed === true })),
    listings: rows(row.listings).flatMap(l => { const value = listingView(l, id); return value ? [value] : []; }),
    created_at: text(row.created_at), updated_at: text(row.updated_at ?? row.created_at),
  };
}

export function wantView(row: Row): Want & { low_cents?: number; colours?: string[] } {
  const fit = object(row.fit);
  return { id: text(row.id), state: pick(row.state, ['active', 'paused', 'ended'], 'active'), text: text(row.text), product_id: text(row.product_id) || null,
    fit: { ...(typeof fit.size === 'string' ? { size: fit.size } : {}), ...(fit.cut === 'mens' || fit.cut === 'womens' || fit.cut === 'youth' ? { cut: fit.cut } : {}), ...(typeof fit.condition_floor === 'string' ? { condition_floor: fit.condition_floor } : {}) },
    max_total_cents: money(row.max_total_cents), ...(typeof fit.min_total_cents === 'number' ? { low_cents: fit.min_total_cents } : {}), ...(typeof fit.color === 'string' ? { colours: [fit.color] } : {}),
    sites: (Array.isArray(row.sites) ? row.sites : []).flatMap(s => site(s) ? [site(s)!] : []), checked: Object.fromEntries(Object.entries(object(row.checked)).filter(([, v]) => typeof v === 'string')), behind: (Array.isArray(row.behind) ? row.behind : []).flatMap(s => site(s) ? [site(s)!] : []), quiet_hours: null, alert: row.alert === 'available' ? 'available' : 'under' };
}

export function matchView(row: Row): Match | null {
  const s = site(row.site), price = money(row.price_cents), delivered = money(row.delivered_cents);
  if (!s || price === null || delivered === null) return null;
  return { id: text(row.id), state: pick(row.state, ['found', 'alerted', 'saved', 'asked', 'offered', 'bought', 'dismissed', 'gone'], 'found'), want_id: text(row.want_id) || null, source: pick(row.source, ['want', 'search', 'for_you'], 'want'), label: pick(row.label, ['exact', 'likely_same_model', 'same_family_other_variant', 'comparable', 'unresolved'], 'unresolved'), site: s, title: text(row.title), key: url(row.photo_url ?? row.image_url) as Match['key'], url: url(row.url), price_cents: price, delivered_cents: delivered, condition: text(row.condition), seller: text(row.seller), verdict: pick(row.verdict, ['good', 'fair', 'high'], 'fair'), seen_at: text(row.seen_at), product_id: text(row.product_id) || null, ...(typeof row.size === 'string' ? { size: row.size } : {}) };
}

export type LiveDecision = Omit<Decision, 'options'> & { version: number; options: (Decision['options'][number] & { signature: string })[] };
export function decisionView(row: Row): LiveDecision {
  return { ...row, id: text(row.id), kind: text(row.kind), item_id: text(row.item_id) || null, site: site(row.site), state: pick(row.state, ['open', 'acting', 'answered', 'failed', 'expired', 'superseded'], 'open'), tier: row.tier === 'never_alone' || row.tier === 'locked' ? 'locked' : 'ask', feed: pick(row.feed, ['now', 'when_you_can', 'good_to_know'], 'when_you_can'), group_form: 'single', group_key: null, group_rank: null, why: text(row.why), deadline: text(row.deadline) || null, options: rows(row.options).map(o => ({ id: text(o.id), label: text(o.label), does: text(o.does, text(o.label)), signature: text(o.signature) })), suggested: text(row.suggested) || null, allow_other: row.allow_other === true, created_at: text(row.created_at), version: number(row.version) };
}

export function orderView(row: Row): Order | null {
  const s = site(row.site), price = money(row.price_cents), fees = money(row.fees_cents), shipping = money(row.shipping_cents);
  if (!s || price === null || fees === null || shipping === null) return null;
  return { id: text(row.id), kind: row.kind === 'purchase' ? 'purchase' : 'sale', item_id: text(row.item_id), listing_id: text(row.listing_id) || null, site: s, state: pick(row.state, ['paid', 'pickup_booked', 'to_ship', 'shipped', 'delivered', 'handed_over', 'claim_window', 'released', 'cancelled', 'return_open', 'dispute_open', 'refunded'], 'paid'), price_cents: price, fees_cents: fees, shipping_cents: shipping, payout_cents: money(row.payout_cents), buyer: text(row.buyer), label: null, clocks: object(row.clocks), external_order_id: text(row.external_order_id), created_at: text(row.created_at) };
}

export function conversationView(row: Row): Conversation | null {
  const s = site(row.site);
  return s ? { id: text(row.id), site: s, item_id: text(row.item_id) || null, listing_id: text(row.listing_id) || null, role: row.role === 'buy' ? 'buy' : 'sell', buyer: text(row.buyer), intent_last: text(row.intent_last), state: pick(row.state, ['open', 'closed', 'blocked'], 'open'), last_read_at: text(row.last_read_at), unread: number(row.unread) } : null;
}

export function eventView(row: Row): LogEvent {
  const undo = object(row.undo);
  return { event_id: text(row.event_id), item_id: text(row.item_id) || null, action: text(row.action), actor: pick(row.actor, ['user', 'auto', 'site'], 'site'), site: site(row.site), at: text(row.at), why: text(row.why), undo: { allowed: undo.allowed === true, until: text(undo.until) || null } };
}
