// The Mercari harness (spec/product.md#the-harness-protocol; README.md beside this file for the per-verb operating design).
// Server only. Every verb is an `Adapter` over an injected `Client`: live.ts gives a cloud page that keeps the answers the
// page's own web client got from /v1/api, the tests give the reduced recordings in fixtures/. Public reads are proved live;
// signed-in verbs are built on synthetic fixtures (no account is linked).
// Mercari's /v1/api answers a direct anonymous call with 401 (observed 2026-11-15), so every route drives the page and reads
// the calls the page made itself, selected by GraphQL operation name. No token is replayed.
import { createHash } from 'node:crypto';

import { offerExpiresAt, sellerOffer } from '../../../../../../spec/sites.mjs';
import type { Snapshot, SnapListing, SnapMessage, SnapOffer, SnapOrder } from '../../../events/event.ts';
import { classifyRead, fail, isWrite, type Adapter, type AdapterResult, type CallArgs, type Field, type FieldType, type Manifest, type Verb } from '../../protocol.ts';

// api: the JSON bodies the page's client received from /v1/api, in order, each with its operationName.
export type Page = { status: number; html: string; challenge?: boolean; api: { op?: string; body: unknown }[] };
// signed_in: the client carries the linked account's stored sign-in.
export type Client = { signed_in: boolean; page(url: string, signal: AbortSignal): Promise<Page> };
type Fail = Extract<AdapterResult, { ok: false }>;

export const WWW = 'https://www.mercari.com';
// sortBy values on the search page's sort control, labels in the order the control lists them (observed 2026-11-15).
// shortcut: which value carries which label is not confirmed (the menu was read as text), a sorted search per value settles it.
// No sortBy in the url is Best match, the default.
export const SORT = { values: [1, 2, 4, 3, 6], labels: ['Best match', 'Newest first', 'Highest price first', 'Lowest price first', 'Recently sold'], default: 'Best match' } as const;
// Observed 2026-11-15 (anonymous cloud browser) unless marked. Op names are the page's own operationName values.
export const ROUTES = {
  search: (q: string, sold: boolean, sortBy?: number) => `${WWW}/search/?keyword=${encodeURIComponent(q)}&itemStatuses=${sold ? 2 : 1}${sortBy ? `&sortBy=${sortBy}` : ''}`,
  item: (id: string) => `${WWW}/us/item/${id}/`,
  profile: (user: string) => `${WWW}/u/${user}/`,
  reviews: (username: string) => `${WWW}/u/${username}/reviews/`,
  inbox: `${WWW}/mypage/messages/`,          // unobserved
  offers: `${WWW}/mypage/offers/`,           // unobserved
  orders: `${WWW}/mypage/listings/sold/`,    // unobserved
  stats: `${WWW}/mypage/listings/active/`,   // unobserved
  sell: `${WWW}/sell/`,                      // unobserved
  edit: (id: string) => `${WWW}/sell/edit/${id}/`, // unobserved
} as const;

// --- parsing the site's own structure ---

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const at = (o: unknown, ...ks: string[]): unknown => ks.reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
// Mercari prices are integer cents already (2200 is $22.00, observed against the page).
const cents = (v: unknown) => (Number.isInteger(v) ? (v as number) : undefined);
// Mercari times are unix seconds.
const iso = (v: unknown) => (num(v) !== undefined ? new Date((v as number) * 1000).toISOString() : undefined);
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : undefined);
export const refHash = (v: string) => 'h' + createHash('sha256').update(v).digest('hex').slice(0, 8);

export const stateOf = (status: unknown): SnapListing['state'] | undefined =>
  status === 'on_sale' ? 'live' : status === 'trading' || status === 'sold_out' ? 'sold' : status === 'inactive' || status === 'cancel' ? 'ended' : undefined;

export function statusFail(status: number, where: string): Fail | undefined {
  if (status < 400) return;
  if (status === 401) return fail('auth_expired', `${where} answered 401`, { do: 'relink', site: 'mercari' });
  if (status === 404) return fail('not_found', `${where} answered 404`, { do: 'reconcile', searched: [where] });
  if (status === 429) return fail('rate_limited', `${where} answered 429`, { do: 'retry_after', after_s: 60 });
  return fail('blocked', `${where} answered ${status}`, { do: 'pause_session', site: 'mercari' });
}
const changed = (what: string) => fail('page_changed', `${what} is not where the page kept it`, { do: 'author', missing: [what] });
const relink = () => fail('auth_expired', 'this verb needs the linked account signed in', { do: 'relink', site: 'mercari' });
const refuse = (kind: string, message: string) => fail('policy_refused', message, { do: 'raise_decision', kind });

async function load(c: Client, url: string, s: AbortSignal): Promise<{ ok: true; p: Page } | Fail> {
  const p = await c.page(url, s);
  if (p.challenge) return fail('blocked', 'the site showed a check the person must pass', { do: 'pause_session', site: 'mercari' });
  return statusFail(p.status, url) ?? { ok: true, p };
}
// The data of the last answer to the named call. A GraphQL error carries its own HTTP status (401 when signed out, observed).
function op(p: Page, name: string): { ok: true; data: Obj } | Fail {
  const hit = p.api.filter(x => x.op === name).at(-1);
  if (!hit) return changed(`the ${name} call`);
  const errs = at(hit.body, 'errors');
  if (Array.isArray(errs) && errs.length) { const st = num(at(errs[0], 'status')); return (st && statusFail(st, name)) || changed(`${name} answered an error`); }
  const data = at(hit.body, 'data');
  return isObj(data) ? { ok: true, data } : changed(`${name} data`);
}
// The page's Next.js state: props.pageProps in the __NEXT_DATA__ script.
export function nextData(html: string): Obj | undefined {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  try { const pp = m && at(JSON.parse(m[1]), 'props', 'pageProps'); return isObj(pp) ? pp : undefined; }
  catch (error) { if (error instanceof SyntaxError) return undefined; throw error; }
}

// --- manifests ---

const F = (name: string, type: FieldType, o: { s?: boolean; opt?: boolean } = {}): Field => ({ name, type, needs_session: !!o.s, required: !o.opt });
const RECORDED = '2026-11-15';
function manifest(verb: Verb, o: { session: Manifest['session']; route_kind: Manifest['route_kind']; version: string; fields: Field[];
  input: Manifest['input_schema']; fixture_ref: string; controls?: string[]; per_minute?: number }): Manifest {
  return {
    site: 'mercari', verb, version: o.version, input_schema: o.input, fields: o.fields,
    output_schema: Object.fromEntries(o.fields.map(f => [f.name, f.type])),
    session: o.session, route_kind: o.route_kind, pace: { per_minute: o.per_minute ?? 20, step_ms: [2000, 5000] },
    expect: { status: 200, has: o.fields.filter(f => f.required).map(f => f.name) },
    ...(isWrite(verb) ? { read_back: { verb: verb === 'send_message' ? 'read_inbox' : verb.endsWith('offer') ? 'read_offers' : 'read_listings', match: ['external_id'] } as const } : {}),
    controls: o.controls ?? [], fixture_ref: `app/src/edge/harness/sites/mercari/fixtures/${o.fixture_ref}`, recorded_at: RECORDED,
  };
}
const LISTING = [F('external_id', 'string'), F('url', 'url'), F('state', 'string'), F('price_cents', 'cents'), F('currency', 'string'),
  F('condition', 'string', { opt: true }), F('size', 'string', { opt: true }), F('title', 'string', { opt: true }), F('brand', 'string', { opt: true }), F('likes', 'number', { opt: true }), F('listed_at', 'datetime', { opt: true })];
const PLAN = [F('dry', 'boolean'), F('url', 'url'), F('steps', 'string[]'), F('request', 'object')];

const itemRow = (o: Obj) => {
  const id = str(o.id);
  return { external_id: id, url: id && ROUTES.item(id), state: stateOf(o.status), price_cents: cents(o.price), currency: 'USD', title: str(o.name),
    condition: str(at(o, 'itemCondition', 'name')), size: str(at(o, 'itemSize', 'name')), brand: str(at(o, 'brand', 'name')), likes: num(o.numLikes), listed_at: iso(o.created) };
};

// --- the public reads ---

async function search(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const q = str(a.q);
  if (!q) return refuse('missing_input', 'search needs q');
  if (a.sort_by !== undefined && !(SORT.values as readonly unknown[]).includes(a.sort_by)) return refuse('missing_input', `sort_by is one of ${SORT.values.join(', ')}`);
  const r = await load(c, ROUTES.search(q, a.status === 'sold', a.sort_by as number | undefined), s); if (!r.ok) return r;
  const d = op(r.p, 'searchFacetQuery'); if (!d.ok) return d;
  const items = list(at(d.data, 'search', 'itemsList')); if (!items) return changed('search.itemsList');
  const rows = items.map(o => ({ ...itemRow(o), seller_ref_hash: str(at(o, 'seller', 'id')) && refHash(str(at(o, 'seller', 'id'))!) }));
  return classifyRead({ challenge: false, rows }, M.search);
}

// A seller's listings, from their public profile page (the linked account's own seller_id for the kernel verb).
async function readListings(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const user = str(a.seller_id);
  if (!user) return refuse('missing_input', 'read_listings needs the linked seller_id');
  // shortcut: the first page the profile loads only (30 observed per call), scroll for more when a seller has more.
  const r = await load(c, ROUTES.profile(user), s); if (!r.ok) return r;
  const d = op(r.p, 'publicProfileSearchQuery'); if (!d.ok) return d;
  const items = list(at(d.data, 'search', 'itemsList')); if (!items) return changed('publicProfileSearchQuery itemsList');
  const want = a.status === 'sold' ? 'sold' : a.status === 'active' ? 'live' : undefined;
  return classifyRead({ challenge: false, rows: items.map(itemRow).filter(x => !want || x.state === want) }, M.read_listings);
}

async function readStorefront(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const user = str(a.user_id);
  if (!user) return refuse('missing_input', 'read_storefront needs the linked user_id');
  const r = await load(c, ROUTES.profile(user), s); if (!r.ok) return r;
  const u = op(r.p, 'publicProfileUserQuery'); if (!u.ok) return u;
  const n = op(r.p, 'publicProfileSearchQueryCount'); if (!n.ok) return n;
  const x = at(u.data, 'user');
  const row = { followers: num(at(x, 'followerCount')), following: num(at(x, 'followingCount')), rating: num(at(x, 'ratings', 'average')),
    review_count: num(at(x, 'ratings', 'count')), sold_count: num(at(x, 'numSales')), active_count: num(at(n.data, 'search', 'count')), user_id: str(at(x, 'id')) };
  const out = classifyRead({ challenge: false, rows: [row] }, M.read_storefront);
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// --- reads that are not kernel verbs: one listing, still up, reviews ---

type Item = { ok: true; item?: Obj; seller?: Obj; code: unknown } | Fail;
async function itemState(c: Client, id: string, s: AbortSignal): Promise<Item> {
  const url = ROUTES.item(id);
  const p = await c.page(url, s);
  if (p.challenge) return fail('blocked', 'the site showed a check the person must pass', { do: 'pause_session', site: 'mercari' });
  if (p.status === 404) return { ok: true, code: 404 };
  const bad = statusFail(p.status, url); if (bad) return bad;
  const pp = nextData(p.html); if (!pp) return changed('__NEXT_DATA__ pageProps');
  const st = at(pp, 'serverState');
  const item = at(st, `ItemDetail:${id}`);
  const ref = str(at(item, 'seller', '__ref'));
  return { ok: true, item: isObj(item) ? item : undefined, seller: ref && isObj(at(st, ref)) ? at(st, ref) as Obj : undefined, code: pp.statusCode };
}

export async function readListing(c: Client, id: string, s: AbortSignal): Promise<AdapterResult> {
  const r = await itemState(c, id, s); if (!r.ok) return r;
  if (r.code === 404) return fail('not_found', `item ${id} is gone`, { do: 'reconcile', searched: [ROUTES.item(id)] });
  if (!r.item) return changed(`serverState ItemDetail:${id}`);
  const row = { ...itemRow(r.item), offerable: typeof r.item.isOfferable === 'boolean' ? r.item.isOfferable : undefined,
    seller_ref_hash: str(at(r.seller, 'id')) && refHash(str(at(r.seller, 'id'))!), seller_sales: num(at(r.seller, 'numSales')), seller_rating: num(at(r.seller, 'ratings', 'average')) };
  const out = classifyRead({ challenge: false, rows: [row] }, { site: 'mercari', fields: [...LISTING, F('seller_ref_hash', 'string')] });
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// live (on_sale), sold (trading or sold_out), ended, or gone (a 404 page or pageProps.statusCode 404).
// shortcut: a deleted item was not observed; a recon on one confirms it answers 404 rather than 200 without ItemDetail.
export async function stillUp(c: Client, id: string, s: AbortSignal): Promise<AdapterResult<{ state: 'live' | 'sold' | 'ended' | 'gone' }>> {
  const r = await itemState(c, id, s); if (!r.ok) return r;
  if (r.code === 404) return { ok: true, data: { state: 'gone' } };
  const st = stateOf(at(r.item, 'status'));
  if (!st || st === 'draft') return changed('ItemDetail.status');
  return { ok: true, data: { state: st === 'live' && r.item?.isWebVisible === false ? 'ended' : st } };
}

// A seller's reviews. The page resolves the username to the numeric id (resolveUsername), then asks initReviewsQuery for the user's reviews.
export async function readReviews(c: Client, username: string, s: AbortSignal): Promise<AdapterResult> {
  const r = await load(c, ROUTES.reviews(username), s); if (!r.ok) return r;
  const d = op(r.p, 'initReviewsQuery'); if (!d.ok) return d;
  const items = list(at(d.data, 'user', 'reviewsWithStats', 'reviewsList')); if (!items) return changed('reviewsWithStats.reviewsList');
  // fame is good, normal or poor (Mercari's three review faces); subject is who left it about whom (buyer or seller).
  const rows = items.map(o => ({ at: iso(o.created), rating: str(o.fame), subject: str(o.subject), tags: list(o.feedback)?.map(f => str(f.message)).filter(Boolean),
    author_ref_hash: str(at(o, 'user', 'id')) && refHash(str(at(o, 'user', 'id'))!) }));
  return classifyRead({ challenge: false, rows }, { site: 'mercari', fields: [F('at', 'datetime'), F('rating', 'string'), F('author_ref_hash', 'string')] });
}

// --- the signed-in reads (built on synthetic fixtures; urls and op names are unobserved guesses) ---

const OFFER_STATE: Record<string, SnapOffer['state']> = { pending: 'open', countered: 'countered', accepted: 'accepted', declined: 'declined', expired: 'expired', withdrawn: 'withdrawn' };
const SIGNED: Record<'read_inbox' | 'read_offers' | 'read_orders' | 'read_stats', { url: string; op: string; list: string[]; row: (o: Obj) => Obj }> = {
  read_inbox: { url: ROUTES.inbox, op: 'conversationsQuery', list: ['conversations', 'conversationsList'], row: o => ({ external_id: str(at(o, 'lastMessage', 'id')), thread_ref: str(o.id),
    listing_external_id: str(o.itemId), at: iso(at(o, 'lastMessage', 'created')), from: typeof at(o, 'lastMessage', 'isMine') === 'boolean' ? (at(o, 'lastMessage', 'isMine') ? 'us' : 'buyer') : undefined }) },
  read_offers: { url: ROUTES.offers, op: 'offersQuery', list: ['offers', 'offersList'], row: o => {
    const created = iso(o.created);
    return { external_id: str(o.id), listing_external_id: str(o.itemId), amount_cents: cents(o.price), state: OFFER_STATE[str(o.status) ?? ''],
      buyer_ref_hash: str(at(o, 'buyer', 'id')) && refHash(str(at(o, 'buyer', 'id'))!), created_at: created,
      expires_at: created && (offerExpiresAt('mercari', 'buyer', new Date(created)) as Date | null)?.toISOString() };
  } },
  read_orders: { url: ROUTES.orders, op: 'sellerOrdersQuery', list: ['orders', 'ordersList'], row: o => ({ external_order_id: str(o.id), listing_external_id: str(o.itemId),
    state: str(o.status), price_cents: cents(o.price), at: iso(o.created) }) },
  // Mercari's listing "views" count how often the item was shown, not visits (asserted, unconfirmed: see README), so they are
  // reported as impressions and never as views, which on other sites mean page visits.
  read_stats: { url: ROUTES.stats, op: 'sellerItemsQuery', list: ['search', 'itemsList'], row: o => ({ external_id: str(o.id), impressions: num(o.numViews), likes: num(o.numLikes) }) },
};
const signedRead = (verb: keyof typeof SIGNED) => async (c: Client, _a: CallArgs, s: AbortSignal): Promise<AdapterResult> => {
  if (!c.signed_in) return relink();
  const r = await load(c, SIGNED[verb].url, s); if (!r.ok) return r;
  const d = op(r.p, SIGNED[verb].op); if (!d.ok) return d;
  const items = list(at(d.data, ...SIGNED[verb].list)); if (!items) return changed(`${verb} ${SIGNED[verb].list.join('.')}`);
  return classifyRead({ challenge: false, rows: items.map(SIGNED[verb].row) }, M[verb]);
};

// --- the writes: dry by default, they return the page steps and the request and stop before the final submit ---
// Never part of any plan: payment, address, purchase and account controls.

type Plan = { dry: true; url: string; steps: string[]; request: Obj };
const CONDITIONS = ['New', 'Like new', 'Good', 'Fair', 'Poor'];
const MIN_CENTS = 100;            // $1, the lowest price and the lowest offer (help article 347, observed)
const MAX_CENTS = 200_000;        // $2,000 without Authenticate (research/list/ben/platforms/mercari.md, observed)
const PROMOTE_PCT = 5;            // a Promote drop is at least 5% (help article 347, observed)

// The listing fields of research/list/ben/platforms/mercari.md (the Mercari listing form).
export function listingProblems(l: Obj, partial = false): string[] {
  const out: string[] = [];
  if (!partial) for (const k of ['title', 'description', 'photos', 'category', 'condition', 'price_cents']) if (l[k] === undefined) out.push(`${k} is required`);
  if (l.title !== undefined && (typeof l.title !== 'string' || !l.title.trim() || l.title.length > 80)) out.push('title is text of at most 80 characters');
  if (l.description !== undefined && (typeof l.description !== 'string' || l.description.length > 1000)) out.push('description is text of at most 1000 characters');
  if (l.photos !== undefined && (!Array.isArray(l.photos) || l.photos.length < 1 || l.photos.length > 12)) out.push('photos are 1 to 12');
  if (l.condition !== undefined && !CONDITIONS.includes(String(l.condition))) out.push(`condition is one of ${CONDITIONS.join(', ')}`);
  if (l.price_cents !== undefined && !(Number.isInteger(l.price_cents) && (l.price_cents as number) >= MIN_CENTS && (l.price_cents as number) <= MAX_CENTS)) out.push('price_cents is 100 to 200000');
  if (l.hashtags !== undefined && (!Array.isArray(l.hashtags) || l.hashtags.length > 3)) out.push('hashtags take at most 3');
  return out;
}
// No write sets a price under the item's floor. floor_cents comes with every write that names a price.
const underFloor = (a: CallArgs, price: number) => a.floor_cents === undefined ? 'a write that names a price needs floor_cents'
  : price < Number(a.floor_cents) ? `${price} is under the floor of ${Number(a.floor_cents)}` : undefined;

const id = (a: CallArgs, k: string) => str(a[k]);
const WRITES: Record<'post' | 'revise' | 'end' | 'relist' | 'send_message' | 'answer_offer' | 'make_offer' | 'save', (a: CallArgs) => Plan | Fail> = {
  post: a => {
    const l = isObj(a.listing) ? a.listing : {};
    const bad = listingProblems(l); if (bad.length) return refuse('invalid_listing', bad.join('; '));
    const floor = underFloor(a, l.price_cents as number); if (floor) return refuse('under_floor', floor);
    return { dry: true, url: ROUTES.sell, request: l, steps: ['add the photos', 'fill title and description', 'choose category', 'choose condition', 'fill brand',
      'add hashtags', 'set shipping', 'fill price', 'stop before List'] };
  },
  // A price change. promote: true makes it a Promote, a drop of at least 5% that Mercari pushes to likers (help article 347).
  revise: a => {
    const item = id(a, 'item_id'); if (!item) return refuse('missing_input', 'revise needs item_id');
    const changes = isObj(a.changes) ? a.changes : {};
    const bad = listingProblems(changes, true); if (bad.length) return refuse('invalid_listing', bad.join('; '));
    if (changes.price_cents !== undefined) {
      const p = changes.price_cents as number;
      const floor = underFloor(a, p); if (floor) return refuse('under_floor', floor);
      if (a.promote === true) {
        const cur = Number(a.current_cents), low = Number(a.lowest_cents ?? a.current_cents);
        const cap = Math.floor(Math.min(cur, low) * (100 - PROMOTE_PCT) / 100);
        if (!(p <= cap)) return refuse('promote', `a Promote is at least ${PROMOTE_PCT}% under the current and the lowest price: ${cap} or less`);
      }
    } else if (a.promote === true) return refuse('promote', 'a Promote needs changes.price_cents');
    return { dry: true, url: ROUTES.edit(item), request: { ...changes, ...(a.promote === true ? { promote: true } : {}) },
      steps: ['open the edit page', ...Object.keys(changes).map(k => `set ${k}`), a.promote === true ? 'stop before Promote' : 'stop before Update'] };
  },
  end: a => {
    const item = id(a, 'item_id'); if (!item) return refuse('missing_input', 'end needs item_id');
    // Deactivate, not Delete: it can be undone, and relisting as a new item is penalized (help article 2514).
    return { dry: true, url: ROUTES.edit(item), request: { item_id: item }, steps: ['open the edit page', 'tap Deactivate', 'stop before the confirm'] };
  },
  relist: a => {
    const item = id(a, 'item_id'); if (!item) return refuse('missing_input', 'relist needs item_id');
    return { dry: true, url: ROUTES.edit(item), request: { item_id: item }, steps: ['open the inactive listing', 'tap Activate', 'stop before the confirm'] };
  },
  send_message: a => {
    const thread = id(a, 'thread_ref'), text = str(a.text);
    if (!thread || !text?.trim()) return refuse('missing_input', 'send_message needs thread_ref and text');
    return { dry: true, url: `${ROUTES.inbox}${thread}/`, request: { thread_ref: thread, text }, steps: ['open the thread', 'type the message', 'stop before Send'] };
  },
  // Accepting charges the buyer at once (help article 330), so accept and counter both check the floor.
  answer_offer: a => {
    const offer = id(a, 'offer_id'), action = str(a.action), sent = str(a.received_at);
    if (!offer || !sent || !['accept', 'decline', 'counter'].includes(action ?? '')) return refuse('missing_input', 'answer_offer needs offer_id, received_at and accept, decline or counter');
    const ends = offerExpiresAt('mercari', 'buyer', new Date(sent)) as Date | null;
    const now = a.now ? new Date(String(a.now)) : new Date();
    if (ends && now >= ends) return refuse('offer_expired', `the offer ended at ${ends.toISOString()}`);
    if (action !== 'decline') {
      const amount = Number(a.amount_cents);
      if (!(Number.isInteger(amount) && amount >= MIN_CENTS)) return refuse('missing_input', `${action} needs amount_cents of at least ${MIN_CENTS}`);
      const floor = underFloor(a, amount); if (floor) return refuse('under_floor', floor);
    }
    return { dry: true, url: ROUTES.offers, request: { offer_id: offer, action, ...(action !== 'decline' ? { amount_cents: a.amount_cents } : {}), expires_at: ends?.toISOString() },
      steps: ['open the offer', `tap ${action === 'accept' ? 'Accept' : action === 'decline' ? 'Decline' : 'Counter'}`, ...(action === 'counter' ? ['fill the amount'] : []), 'stop before the confirm'] };
  },
  // Offer to likers: at least 10% under the price and the lowest price so far, no sooner than the site's repeat wait, binding (spec/sites.mjs `offer.seller.*`, article 347).
  make_offer: a => {
    const item = id(a, 'listing_external_id'); if (!item) return refuse('missing_input', 'make_offer needs listing_external_id');
    const offer = Number(a.offer_cents);
    if (!(Number.isInteger(offer) && offer >= MIN_CENTS)) return refuse('seller_offer', `offer_cents is at least ${MIN_CENTS}`);
    const floor = underFloor(a, offer); if (floor) return refuse('under_floor', floor);
    // spec/sites.mjs defaults last_sent_at to null, which tsc reads as the only allowed type
    const r = sellerOffer('mercari', { list_cents: Number(a.list_cents), offer_cents: offer, lowest_cents: a.lowest_cents === undefined ? undefined : Number(a.lowest_cents),
      last_sent_at: a.last_sent_at ? new Date(String(a.last_sent_at)) : null, now: a.now ? new Date(String(a.now)) : new Date(), promised_elsewhere: a.promised_elsewhere === true });
    if (!r.ok) return refuse('seller_offer', r.why ?? 'refused');
    return { dry: true, url: ROUTES.item(item), request: { listing_external_id: item, amount_cents: offer },
      steps: ['open the listing', 'tap Offer to likers', 'fill the amount', 'stop before Send offer'] };
  },
  save: a => {
    const item = id(a, 'item_id'); if (!item) return refuse('missing_input', 'save needs item_id');
    return { dry: true, url: ROUTES.item(item), request: { item_id: item }, steps: ['open the listing', 'stop before tapping Like'] };
  },
};
const write = (verb: keyof typeof WRITES) => async (c: Client, a: CallArgs): Promise<AdapterResult> => {
  const plan = WRITES[verb](a);
  if ('ok' in plan) return plan;
  if (a.dry !== false) return { ok: true, data: plan };
  if (!c.signed_in) return relink();
  // No submit has been observed with a linked account, and writes stay dry until Nate says go for Mercari.
  return fail('no_route', `${verb} has no proved submit yet`, { do: 'handoff', url: plan.url });
};

// --- the manifests and the adapters ---

const PAGE_CONTROLS = { post: ['photos', 'title', 'description', 'category', 'condition', 'brand', 'hashtags', 'shipping', 'price'],
  revise: ['edit form fields', 'price', 'Promote'], end: ['Deactivate'], relist: ['Activate'], send_message: ['message box'],
  answer_offer: ['Accept', 'Decline', 'Counter', 'amount'], make_offer: ['Offer to likers', 'amount'], save: ['Like'] };
export const M = {
  search: manifest('search', { session: 'public', route_kind: 'page', version: '1.0.0', fields: [...LISTING, F('seller_ref_hash', 'string')],
    input: { q: 'string', status: 'string', sort_by: 'number' }, fixture_ref: 'search.json' }),
  read_listings: manifest('read_listings', { session: 'public', route_kind: 'page', version: '1.0.0', input: { seller_id: 'string', status: 'string' }, fixture_ref: 'profile.json',
    fields: [...LISTING, F('impressions', 'number', { s: true, opt: true })] }),
  read_storefront: manifest('read_storefront', { session: 'public', route_kind: 'page', version: '1.0.0', input: { user_id: 'string' }, fixture_ref: 'profile.json',
    fields: [F('followers', 'number'), F('following', 'number'), F('rating', 'number', { opt: true }), F('review_count', 'number'), F('sold_count', 'number'),
      F('active_count', 'number'), F('impressions', 'number', { s: true, opt: true }), F('gross_cents', 'cents', { s: true, opt: true })] }),
  read_inbox: manifest('read_inbox', { session: 'signed_in', route_kind: 'page', version: '0.1.0', input: {}, fixture_ref: 'inbox.json',
    fields: [F('external_id', 'string', { s: true }), F('thread_ref', 'string', { s: true }), F('listing_external_id', 'string', { s: true, opt: true }), F('at', 'datetime', { s: true }), F('from', 'string', { s: true })] }),
  read_offers: manifest('read_offers', { session: 'signed_in', route_kind: 'page', version: '0.1.0', input: {}, fixture_ref: 'offers.json',
    fields: [F('external_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('amount_cents', 'cents', { s: true }), F('state', 'string', { s: true }),
      F('buyer_ref_hash', 'string', { s: true, opt: true }), F('expires_at', 'datetime', { s: true, opt: true })] }),
  read_orders: manifest('read_orders', { session: 'signed_in', route_kind: 'page', version: '0.1.0', input: {}, fixture_ref: 'orders.json',
    fields: [F('external_order_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('state', 'string', { s: true }), F('price_cents', 'cents', { s: true })] }),
  read_stats: manifest('read_stats', { session: 'signed_in', route_kind: 'page', version: '0.1.0', input: {}, fixture_ref: 'stats.json',
    fields: [F('external_id', 'string', { s: true }), F('impressions', 'number', { s: true }), F('likes', 'number', { s: true, opt: true })] }),
  ...Object.fromEntries(Object.entries(PAGE_CONTROLS).map(([verb, controls]) => [verb, manifest(verb as Verb, { session: 'signed_in', route_kind: 'page', version: '0.1.0',
    fields: PLAN, input: {}, fixture_ref: '(none: dry plan, no submit observed)', controls, per_minute: 6 })])) as Record<keyof typeof WRITES, Manifest>,
} satisfies Record<Verb, Manifest>;

const RUN: Record<Verb, (c: Client, a: CallArgs, s: AbortSignal) => Promise<AdapterResult>> = {
  search, read_listings: readListings, read_storefront: readStorefront,
  read_inbox: signedRead('read_inbox'), read_offers: signedRead('read_offers'), read_orders: signedRead('read_orders'), read_stats: signedRead('read_stats'),
  post: write('post'), revise: write('revise'), end: write('end'), relist: write('relist'), send_message: write('send_message'),
  answer_offer: write('answer_offer'), make_offer: write('make_offer'), save: write('save'),
};

export function mercariAdapters(client: Client): Adapter[] {
  return (Object.keys(RUN) as Verb[]).map(verb => ({ route_id: `mercari.${verb}.${M[verb].route_kind}`, manifest: M[verb], run: (a, s) => RUN[verb](client, a, s) }));
}

// --- the watch snapshot (app/src/edge/events/event.ts): a section that was not read stays undefined ---
// Mercari impressions are not views, so a listing's views stay undefined here.

export function toWatchSnapshot(o: { account_id: string; user_id: string; taken_at: string; listings?: Obj[]; offers?: Obj[]; messages?: Obj[]; orders?: Obj[] }): Snapshot {
  const listings = o.listings?.flatMap((r): SnapListing[] => typeof r.external_id === 'string' && typeof r.price_cents === 'number' && r.state
    ? [{ external_id: r.external_id, state: r.state as SnapListing['state'], price_cents: r.price_cents, ...(num(r.likes) !== undefined ? { likes: num(r.likes) } : {}) }] : []);
  const signed = !!(o.offers || o.messages || o.orders);
  return { site: 'mercari', account_id: o.account_id, user_id: o.user_id, taken_at: o.taken_at, route: signed ? 'signed_in' : 'public',
    ...(listings ? { listings } : {}),
    ...(o.offers ? { offers: o.offers.map(r => ({ external_id: String(r.external_id), listing_external_id: String(r.listing_external_id), amount_cents: Number(r.amount_cents),
      state: r.state as SnapOffer['state'], ...(r.buyer_ref_hash ? { buyer_ref_hash: String(r.buyer_ref_hash) } : {}) })) } : {}),
    ...(o.messages ? { messages: o.messages.map((r): SnapMessage => ({ external_id: String(r.external_id), thread_ref: String(r.thread_ref), at: String(r.at),
      from: r.from === 'us' ? 'us' : 'buyer', ...(r.listing_external_id ? { listing_external_id: String(r.listing_external_id) } : {}) })) } : {}),
    ...(o.orders ? { orders: o.orders.map((r): SnapOrder => ({ external_order_id: String(r.external_order_id), listing_external_id: String(r.listing_external_id),
      state: String(r.state), price_cents: Number(r.price_cents) })) } : {}),
  };
}
