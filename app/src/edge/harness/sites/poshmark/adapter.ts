// The Poshmark harness (spec/product.md#the-harness-protocol; README.md beside this file for the per-verb operating design).
// Server only. Every verb is an `Adapter` over an injected `Client`: live.ts gives a cloud page, the tests give the reduced
// recordings in fixtures/. Public reads are proved live; signed-in verbs are built on fixtures. Only the public site and the
// person's own signed-in web session are used: the page's embedded state and its own calls, never the mobile-app API.
import { createHash } from 'node:crypto';

import { offerExpiresAt, fact } from '../../../../../../spec/sites.mjs';
import type { Snapshot, SnapListing, SnapMessage, SnapOffer, SnapOrder } from '../../../events/event.ts';
import { classifyRead, fail, isWrite, type Adapter, type AdapterResult, type CallArgs, type Field, type FieldType, type Manifest, type Verb } from '../../protocol.ts';

export type Page = { status: number; html: string; challenge?: boolean };
export type Reply = { status: number; body: unknown };
// signed_in: the client carries the linked account's stored sign-in. json paths are on https://poshmark.com.
export type Client = { signed_in: boolean; doc(url: string, signal: AbortSignal): Promise<Page>; json(path: string, signal: AbortSignal): Promise<Reply> };

export const WWW = 'https://poshmark.com';
// The public reads are pages (observed 2026-11-15, anonymous cloud browser): the data rides in window.__INITIAL_STATE__.
export const URLS = {
  search: (q: string, sold: boolean, sort?: string) => `${WWW}/search?query=${encodeURIComponent(q)}${sold ? '&availability=sold_out' : ''}${sort ? `&sort_by=${sort}` : ''}`,
  listing: (id: string) => `${WWW}/listing/${id}`, // answers 301 to the slug url
  closet: (u: string, sold = false) => `${WWW}/closet/${encodeURIComponent(u)}${sold ? '?availability=sold_out' : ''}`,
} as const;
// The signed-in calls the web client makes once a person is signed in. unobserved: guesses until recon runs with a linked account.
export const PATHS = {
  inbox: '/vm-rest/users/self/news?limit=20',            // unobserved
  offers: '/vm-rest/users/self/offers?role=seller',      // unobserved
  orders: '/vm-rest/users/self/orders/sales?limit=20',   // unobserved
  stats: '/vm-rest/users/self/posts/stats?limit=20',     // unobserved
} as const;
// The sort_by values of the search page's own sort menu (observed 2026-11-15). A query defaults to relevance_v2.
export const SORTS = { relevance_v2: 'Relevance', best_match: 'Just Shared', added_desc: 'Just In', price_desc: 'Price: High to Low',
  price_asc: 'Price: Low to High', price_drop: 'Recently Price Dropped', like_count: 'Most Liked' } as const;
// The least listing price. asserted, unverified: no public page states it; confirm on the signed-in listing form.
export const MIN_PRICE_CENTS = 300;

// --- parsing the site's own structure ---

type Obj = Record<string, unknown>;
type Failed = Extract<AdapterResult, { ok: false }>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const at = (o: unknown, ...ks: string[]): unknown => ks.reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
// "34.0" -> 3400; anything that is not a plain decimal amount is undefined, so classifyRead names it.
export const cents = (v: unknown) => (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : undefined);
export const refHash = (v: string) => 'h' + createHash('sha256').update(v).digest('hex').slice(0, 8);
const hashOf = (v: unknown) => (typeof v === 'string' ? refHash(v) : undefined);
const list = (v: unknown) => (Array.isArray(v) ? v.filter(isObj) : undefined);

const MARK = 'window.__INITIAL_STATE__=';
// The page's state object: from the marker to the `};(function` that follows it.
export function state(html: string): Obj | undefined {
  const i = html.indexOf(MARK), j = i < 0 ? -1 : html.indexOf('};(function', i);
  if (j < 0) return;
  try { const o: unknown = JSON.parse(html.slice(i + MARK.length, j + 1)); return isObj(o) ? o : undefined; }
  catch (error) { if (error instanceof SyntaxError) return undefined; throw error; }
}

// shortcut: only available and sold_out are observed; any other inventory status reads as ended until recon sees one.
export const stateOf = (status: unknown): SnapListing['state'] | undefined =>
  status === 'available' ? 'live' : status === 'sold_out' ? 'sold' : typeof status === 'string' ? 'ended' : undefined;

export function statusFail(status: number, where: string): Failed | undefined {
  if (status < 400) return;
  if (status === 401) return fail('auth_expired', `${where} answered 401`, { do: 'relink', site: 'poshmark' });
  if (status === 404) return fail('not_found', `${where} answered 404`, { do: 'reconcile', searched: [where] });
  if (status === 410) return fail('page_changed', `${where} answered 410, the path was retired`, { do: 'author', missing: [where] });
  if (status === 429) return fail('rate_limited', `${where} answered 429`, { do: 'retry_after', after_s: 60 });
  return fail('blocked', `${where} answered ${status}`, { do: 'pause_session', site: 'poshmark' });
}
const changed = (what: string) => fail('page_changed', `${what} is not where the page kept it`, { do: 'author', missing: [what] });
const relink = () => fail('auth_expired', 'this verb needs the linked account signed in', { do: 'relink', site: 'poshmark' });
const refuse = (kind: string, message: string) => fail('policy_refused', message, { do: 'raise_decision', kind });
const blocked = () => fail('blocked', 'the site showed a check the person must pass', { do: 'pause_session', site: 'poshmark' });

// One page's state, or the answer to a challenge, a bad status or a page without its state.
async function page(c: Client, url: string, s: AbortSignal): Promise<{ ok: true; st: Obj } | Failed> {
  const p = await c.doc(url, s);
  if (p.challenge) return blocked(); // a challenge or login wall pauses the job; it is never solved or routed around
  const bad = statusFail(p.status, url); if (bad) return bad;
  const st = state(p.html);
  return st ? { ok: true, st } : changed('window.__INITIAL_STATE__');
}

// --- manifests ---

const F = (name: string, type: FieldType, o: { s?: boolean; opt?: boolean } = {}): Field => ({ name, type, needs_session: !!o.s, required: !o.opt });
const RECORDED = '2026-11-15';
function manifest(verb: Verb, o: { session: Manifest['session']; route_kind: Manifest['route_kind']; version: string; fields: Field[];
  input: Manifest['input_schema']; fixture_ref: string; controls?: string[]; per_minute?: number }): Manifest {
  return {
    site: 'poshmark', verb, version: o.version, input_schema: o.input, fields: o.fields,
    output_schema: Object.fromEntries(o.fields.map(f => [f.name, f.type])),
    session: o.session, route_kind: o.route_kind, pace: { per_minute: o.per_minute ?? 20, step_ms: [2000, 5000] },
    expect: { status: 200, has: o.fields.filter(f => f.required).map(f => f.name) },
    ...(isWrite(verb) ? { read_back: { verb: verb === 'send_message' ? 'read_inbox' : verb.endsWith('offer') ? 'read_offers' : 'read_listings', match: ['external_id'] } as const } : {}),
    controls: o.controls ?? [], fixture_ref: `app/src/edge/harness/sites/poshmark/fixtures/${o.fixture_ref}`, recorded_at: RECORDED,
  };
}
const LISTING = [F('external_id', 'string'), F('url', 'url'), F('state', 'string'), F('price_cents', 'cents'), F('currency', 'string'),
  F('condition', 'string', { opt: true }), F('size', 'string', { opt: true }), F('title', 'string', { opt: true }), F('brand', 'string', { opt: true }), F('likes', 'number', { opt: true }), F('comments', 'number', { opt: true }),
  F('shares', 'number', { opt: true })];
const PLAN = [F('dry', 'boolean'), F('url', 'url'), F('steps', 'string[]'), F('request', 'object')];

// A search, closet or listing row: the same keys in all three.
export const listingRow = (o: Obj) => {
  const id = str(o.id);
  return { external_id: id, url: id && URLS.listing(id), state: stateOf(at(o, 'inventory', 'status')), price_cents: cents(at(o, 'price_amount', 'val')),
    condition: str(o.condition), size: str(o.size), currency: str(at(o, 'price_amount', 'currency_code')), title: str(o.title), brand: str(o.brand), likes: num(o.like_count),
    comments: num(o.comment_count), shares: num(o.share_count), listed_at: str(o.first_published_at) };
};

// --- the public reads ---

async function search(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const q = str(a.q);
  if (!q) return refuse('missing_input', 'search needs q');
  const sort = str(a.sort);
  if (sort !== undefined && !(sort in SORTS)) return refuse('missing_input', `sort is one of ${Object.keys(SORTS).join(', ')}`);
  const r = await page(c, URLS.search(q, a.status === 'sold', sort), s); if (!r.ok) return r;
  const grid = at(r.st, '$_search', 'gridData'), rows = list(at(grid, 'data')), total = num(at(grid, 'more', 'total'));
  if (!rows || total === undefined) return changed('$_search.gridData');
  // A search with no match still shows suggested rows; total 0 is the site saying there were none.
  if (total === 0) return { ok: true, data: [] };
  return classifyRead({ challenge: false, rows: rows.map(o => ({ ...listingRow(o), seller_ref_hash: hashOf(o.creator_username) })) }, M.search);
}

// Own listings, from the linked person's public closet; views and watchers need the session.
async function readListings(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const u = str(a.username);
  if (!u) return refuse('missing_input', 'read_listings needs the linked username');
  // shortcut: the first page of each closet view only, follow more.next_max_id when a closet has more.
  const which = a.status === 'sold' ? [true] : a.status === 'active' ? [false] : [false, true];
  const rows = [];
  for (const sold of which) {
    const r = await page(c, URLS.closet(u, sold), s); if (!r.ok) return r;
    const objs = list(at(r.st, '$_closet', 'listingsPostData', 'data')); if (!objs) return changed('$_closet.listingsPostData');
    rows.push(...objs.map(listingRow));
  }
  return classifyRead({ challenge: false, rows }, M.read_listings);
}

// The closet's public figures. review_count is the 5-star count, the one count the closet shows; sold_count is orders shipped.
async function readStorefront(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const u = str(a.username);
  if (!u) return refuse('missing_input', 'read_storefront needs the linked username');
  const r = await page(c, URLS.closet(u), s); if (!r.ok) return r;
  const g = at(r.st, '$_closet', 'closetUserInfo', 'data', 'aggregates'); if (!isObj(g)) return changed('$_closet.closetUserInfo.aggregates');
  const row = { followers: num(g.followers), following: num(g.following), review_count: num(g.seller_5_star_rating_comment_count),
    sold_count: num(g.seller_orders_shipped), active_count: num(at(r.st, '$_closet', 'listingsPostData', 'more', 'total')),
    sold_display: str(g.items_sold_display), vacation: typeof g.vacation_hold_enabled === 'boolean' ? g.vacation_hold_enabled : undefined,
    last_active_at: str(g.last_active_date) };
  const out = classifyRead({ challenge: false, rows: [row] }, M.read_storefront);
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// --- reads that are not kernel verbs: one listing, still up, comments, reviews ---

async function details(c: Client, id: string, s: AbortSignal): Promise<{ ok: true; d: Obj } | Failed> {
  const r = await page(c, URLS.listing(id), s); if (!r.ok) return r;
  const d = at(r.st, '$_listing_details', 'listingDetails');
  return isObj(d) ? { ok: true, d } : changed('$_listing_details.listingDetails');
}

export async function readListing(c: Client, id: string, s: AbortSignal): Promise<AdapterResult> {
  const r = await details(c, id, s); if (!r.ok) return r;
  const out = classifyRead({ challenge: false, rows: [{ ...listingRow(r.d), seller_ref_hash: hashOf(r.d.creator_username) }] },
    { site: 'poshmark', fields: [...LISTING, F('seller_ref_hash', 'string')] });
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// live, sold, ended, or gone (a 404). shortcut: unverified that a deleted listing 404s, recon on a deleted id settles it.
export async function stillUp(c: Client, id: string, s: AbortSignal): Promise<AdapterResult<{ state: 'live' | 'sold' | 'ended' | 'gone' }>> {
  const p = await c.doc(URLS.listing(id), s);
  if (p.challenge) return blocked();
  if (p.status === 404) return { ok: true, data: { state: 'gone' } };
  const bad = statusFail(p.status, URLS.listing(id)); if (bad) return bad;
  const st = stateOf(at(state(p.html), '$_listing_details', 'listingDetails', 'inventory', 'status'));
  return !st || st === 'draft' ? changed('listingDetails.inventory.status') : { ok: true, data: { state: st } };
}

// The public comments on a listing; the author is kept as a hash only.
export async function readComments(c: Client, id: string, s: AbortSignal): Promise<AdapterResult> {
  const r = await details(c, id, s); if (!r.ok) return r;
  const objs = list(r.d.comments); if (!objs) return changed('listingDetails.comments');
  const rows = objs.map(o => ({ external_id: str(o.id), at: str(o.created_at), author_ref_hash: hashOf(o.creator_username), text: str(o.comment) }));
  return classifyRead({ challenge: false, rows }, { site: 'poshmark', fields: [F('external_id', 'string'), F('at', 'datetime'), F('author_ref_hash', 'string'), F('text', 'string')] });
}

// Love notes are not public: the closet state holds an empty loveNotes and /closet/<u>/love_notes answers 404 (observed 2026-11-15).
export async function readReviews(_c: Client, username: string): Promise<AdapterResult> {
  return fail('no_route', 'love notes are not public on Poshmark', { do: 'handoff', url: URLS.closet(username) });
}

// --- the signed-in reads (built on synthetic fixtures; no account is linked to prove them) ---

const OFFER_STATE: Record<string, SnapOffer['state']> = { pending: 'open', countered: 'countered', accepted: 'accepted', declined: 'declined', expired: 'expired', cancelled: 'withdrawn' };
const SIGNED: Record<'read_inbox' | 'read_offers' | 'read_orders' | 'read_stats', { path: string; row: (o: Obj) => Obj }> = {
  // A comment thread is the listing; an order message thread is the order.
  read_inbox: { path: PATHS.inbox, row: o => ({ external_id: str(o.id), thread_ref: str(o.order_id) ?? str(o.post_id), listing_external_id: str(o.post_id),
    at: str(o.created_at), from: typeof o.from_me === 'boolean' ? (o.from_me ? 'us' : 'buyer') : undefined, kind: str(o.type) }) },
  read_offers: { path: PATHS.offers, row: o => {
    const created = str(o.created_at);
    return { external_id: str(o.id), listing_external_id: str(o.post_id), amount_cents: cents(at(o, 'offer_amount', 'val')),
      state: OFFER_STATE[str(o.status) ?? ''], buyer_ref_hash: hashOf(o.buyer_username),
      created_at: created, expires_at: created && offerExpiresAt('poshmark', 'buyer', new Date(created))?.toISOString() };
  } },
  read_orders: { path: PATHS.orders, row: o => ({ external_order_id: str(o.id), listing_external_id: str(o.post_id), state: str(o.status),
    price_cents: cents(at(o, 'total_amount', 'val')), at: str(o.created_at) }) },
  read_stats: { path: PATHS.stats, row: o => ({ external_id: str(o.post_id), views: num(o.views), likes: num(o.likes), shares: num(o.shares) }) },
};
const signedRead = (verb: keyof typeof SIGNED) => async (c: Client, _a: CallArgs, s: AbortSignal): Promise<AdapterResult> => {
  if (!c.signed_in) return relink();
  const r = await c.json(SIGNED[verb].path, s);
  const bad = statusFail(r.status, SIGNED[verb].path); if (bad) return bad;
  const objs = list(at(r.body, 'data')); if (!objs) return changed(`${verb} data`);
  return classifyRead({ challenge: false, rows: objs.map(SIGNED[verb].row) }, M[verb]);
};

// --- the writes: opted-in intents, dry by default; they return the page steps and the request and stop before the final submit ---

type Plan = { dry: true; url: string; steps: string[]; request: Obj };
const id = (a: CallArgs, k: string) => str(a[k]);
const int = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);
const dollars = (c: number) => (c / 100).toFixed(2);
// No price we set goes under the item's floor; a write that sets a price without one is refused.
function underFloor(a: CallArgs, price: number | undefined, what: string): Failed | undefined {
  const floor = int(a.floor_cents);
  if (price === undefined) return refuse('missing_input', `${what} needs a whole number of cents`);
  if (floor === undefined) return refuse('missing_input', `${what} needs floor_cents`);
  if (price < floor) return refuse('under_floor', `${what} ${dollars(price)} is under the floor ${dollars(floor)}`);
}
const POST_REQUIRED = ['title', 'description', 'pictures', 'category', 'size', 'price_cents'] as const;

export function listingProblems(l: Obj, partial = false): string[] {
  const out: string[] = [];
  if (!partial) for (const k of POST_REQUIRED) if (l[k] === undefined) out.push(`${k} is required`);
  if (l.title !== undefined && (typeof l.title !== 'string' || !l.title.trim() || l.title.length > 80)) out.push('title is text of at most 80 characters');
  if (l.description !== undefined && (typeof l.description !== 'string' || !l.description.trim() || l.description.length > 1500)) out.push('description is text of at most 1500 characters');
  if (l.pictures !== undefined && (!Array.isArray(l.pictures) || l.pictures.length < 1 || l.pictures.length > 16)) out.push('pictures are 1 to 16');
  if (l.price_cents !== undefined && !(int(l.price_cents) && (l.price_cents as number) >= MIN_PRICE_CENTS)) out.push(`price_cents is at least ${MIN_PRICE_CENTS}`);
  return out;
}

// Offer to Likers: at least min_off_pct under the price and under the lowest price so far, a shipping discount, never under
// the floor, and never while the item is promised elsewhere (an accepted offer here is a binding sale). spec/sites.mjs's
// sellerOffer cannot be used: it reads offer.seller.repeat_h, which is unknown for Poshmark and throws.
export function likersOffer(a: CallArgs): { ok: true; request: Obj } | { ok: false; why: string } {
  const list_cents = int(a.list_cents), offer_cents = int(a.offer_cents), lowest = int(a.lowest_cents) ?? list_cents;
  if (!list_cents || !offer_cents || !lowest) return { ok: false, why: 'make_offer needs list_cents and offer_cents' };
  const min = fact('offer.seller.min_off_pct', 'poshmark') as number;
  const cap = (c: number) => Math.floor(c * (100 - min) / 100);
  if (a.promised_elsewhere === true && fact('offer.seller.binds', 'poshmark')) return { ok: false, why: 'the item is promised on another site, and an accepted offer here would be a second sale' };
  if (offer_cents > cap(list_cents)) return { ok: false, why: `must be at least ${min}% under the listing price` };
  if (fact('offer.seller.under_lowest', 'poshmark') && lowest < list_cents && offer_cents > cap(lowest)) return { ok: false, why: `must be at least ${min}% under the lowest price so far` };
  // The help centre says an offer must include a shipping discount (article 759242802); another article reportedly drops it. Kept until the form says.
  if (!['reduced', 'free'].includes(String(a.shipping_discount))) return { ok: false, why: 'an Offer to Likers needs a shipping discount: reduced or free' };
  return { ok: true, request: { amount: dollars(offer_cents), shipping_discount: a.shipping_discount } };
}

const WRITES: Record<'post' | 'revise' | 'end' | 'relist' | 'send_message' | 'answer_offer' | 'make_offer' | 'save' | 'share', (a: CallArgs) => Plan | Failed> = {
  post: a => {
    const l = isObj(a.listing) ? a.listing : {};
    const bad = listingProblems(l); if (bad.length) return refuse('invalid_listing', bad.join('; '));
    const floor = underFloor(a, int(l.price_cents), 'the price'); if (floor) return floor;
    return { dry: true, url: `${WWW}/create-listing`, request: l, steps: ['add the photos', 'fill title and description', 'choose category', 'choose size',
      'fill brand and condition', 'fill listing price', 'stop before List'] };
  },
  revise: a => {
    const lid = id(a, 'listing_external_id'); if (!lid) return refuse('missing_input', 'revise needs listing_external_id');
    const changes = isObj(a.changes) ? a.changes : {};
    const bad = listingProblems(changes, true); if (bad.length) return refuse('invalid_listing', bad.join('; '));
    if (changes.price_cents !== undefined) { const floor = underFloor(a, int(changes.price_cents), 'the new price'); if (floor) return floor; }
    return { dry: true, url: `${WWW}/edit-listing/${lid}`, request: changes, steps: ['open the edit page', ...Object.keys(changes).map(k => `set ${k}`), 'stop before Update'] };
  },
  end: a => {
    const lid = id(a, 'listing_external_id'); if (!lid) return refuse('missing_input', 'end needs listing_external_id');
    return { dry: true, url: `${WWW}/edit-listing/${lid}`, request: { listing_external_id: lid }, steps: ['open the edit page', 'tap Delete Listing', 'stop before the confirm'] };
  },
  // Poshmark has no relist control; relisting is deleting and posting again, which the Seller Policy prohibits when excessive.
  // It is never a fallback for a stale listing: only a person's own ask for this one item gets a plan.
  relist: a => {
    if (fact('relist.penalized', 'poshmark') && a.person_asked !== true) return refuse('relist_penalized', 'Poshmark prohibits excessive removal and reposting; share the listing or lower the price instead');
    const lid = id(a, 'listing_external_id'); if (!lid) return refuse('missing_input', 'relist needs listing_external_id');
    return { dry: true, url: `${WWW}/create-listing`, request: { copy_of: lid }, steps: ['copy the listing', 'delete the old listing', 'post the copy', 'stop before List'] };
  },
  // Before a sale the only way to reach a buyer is a public comment on the listing (an @username tag notifies them);
  // private messages exist only on an order.
  send_message: a => {
    const text = str(a.text), order = id(a, 'order_id'), lid = id(a, 'listing_external_id');
    if (!text?.trim() || (!order && !lid)) return refuse('missing_input', 'send_message needs text and an order_id or a listing_external_id');
    if (order) return { dry: true, url: `${WWW}/order/sales/${order}`, request: { order_id: order, text }, steps: ['open the order', 'open Message', 'type the message', 'stop before Send'] };
    return { dry: true, url: URLS.listing(lid!), request: { listing_external_id: lid, text, public: true }, steps: ['open the listing', 'open Comments', 'type the comment', 'stop before Post'] };
  },
  answer_offer: a => {
    const offer = id(a, 'offer_id'), action = str(a.action), sent = str(a.received_at);
    if (!offer || !sent || !['accept', 'decline', 'counter'].includes(action ?? '')) return refuse('missing_input', 'answer_offer needs offer_id, received_at and accept, decline or counter');
    const ends = offerExpiresAt('poshmark', 'buyer', new Date(sent)) as Date | null;
    const now = a.now ? new Date(String(a.now)) : new Date();
    if (ends && now >= ends) return refuse('offer_expired', `the offer ended at ${ends.toISOString()}`);
    // Accepting is a binding sale that charges the buyer, so the accepted amount is held to the floor as well.
    if (action !== 'decline') { const floor = underFloor(a, int(a.amount_cents), action === 'accept' ? 'the offer' : 'the counter'); if (floor) return floor; }
    return { dry: true, url: `${WWW}/offers/${offer}`, request: { offer_id: offer, action, ...(action === 'counter' ? { amount: dollars(a.amount_cents as number) } : {}), expires_at: ends?.toISOString() },
      steps: ['open the offer', `tap ${action === 'accept' ? 'Accept' : action === 'decline' ? 'Decline' : 'Counter'}`, ...(action === 'counter' ? ['fill the amount'] : []), 'stop before the confirm'] };
  },
  make_offer: a => {
    const lid = id(a, 'listing_external_id'); if (!lid) return refuse('missing_input', 'make_offer needs listing_external_id');
    const r = likersOffer(a); if (!r.ok) return refuse('seller_offer', r.why);
    const floor = underFloor(a, int(a.offer_cents), 'the offer'); if (floor) return floor;
    return { dry: true, url: URLS.listing(lid), request: { listing_external_id: lid, ...r.request },
      steps: ['open the listing', 'tap Offer to Likers', 'fill the offer price', 'choose the shipping discount', 'stop before Submit'] };
  },
  save: a => {
    const lid = id(a, 'listing_external_id'); if (!lid) return refuse('missing_input', 'save needs listing_external_id');
    return { dry: true, url: URLS.listing(lid), request: { listing_external_id: lid }, steps: ['open the listing', 'stop before tapping the heart'] };
  },
  // Share to Followers: Poshmark's main visibility lever, not a kernel verb (see the README). Paced like every write.
  share: a => {
    const lid = id(a, 'listing_external_id'); if (!lid) return refuse('missing_input', 'share needs listing_external_id');
    return { dry: true, url: URLS.listing(lid), request: { listing_external_id: lid, to: 'followers' }, steps: ['open the listing', 'tap Share', 'stop before To My Followers'] };
  },
};
const PERSON_DONE: ReadonlySet<keyof typeof WRITES> = new Set(['share', 'save', 'relist']);
const write = (verb: keyof typeof WRITES) => async (c: Client, a: CallArgs): Promise<AdapterResult> => {
  const plan = WRITES[verb](a);
  if ('ok' in plan) return plan;
  if (a.dry !== false) return { ok: true, data: plan };
  // Poshmark's guidelines name automated sharing, liking and reposting, so the system never submits these three: the app
  // suggests them and opens the page in its own browser for the person to tap (Nate, product/words.md 2026-11-15).
  if (PERSON_DONE.has(verb)) return fail('no_route', `${verb} is done by the person on Poshmark`, { do: 'handoff', url: plan.url });
  if (!c.signed_in) return relink();
  // No submit has been observed with a linked account yet, so a real write hands the person the page.
  return fail('no_route', `${verb} has no proved submit yet`, { do: 'handoff', url: plan.url });
};
// share is not a kernel Verb, so it runs through this export rather than an Adapter.
export const share = (c: Client, a: CallArgs) => write('share')(c, a);

// --- the manifests and the adapters ---

const PAGE_CONTROLS = { post: ['photos', 'title', 'description', 'category', 'size', 'brand', 'condition', 'listing price'],
  revise: ['edit form fields'], end: ['Delete Listing'], relist: ['Copy Listing', 'Delete Listing', 'List'], send_message: ['comment box', 'order message box'],
  answer_offer: ['Accept', 'Decline', 'Counter', 'amount'], make_offer: ['Offer to Likers', 'offer price', 'shipping discount'], save: ['like heart'] };
export const M = {
  search: manifest('search', { session: 'public', route_kind: 'page', version: '1.0.0', fields: [...LISTING, F('seller_ref_hash', 'string')],
    input: { q: 'string', status: 'string', sort: 'string' }, fixture_ref: 'search.html' }),
  read_listings: manifest('read_listings', { session: 'public', route_kind: 'page', version: '1.0.0', input: { username: 'string', status: 'string' }, fixture_ref: 'closet.html',
    fields: [...LISTING, F('listed_at', 'datetime', { opt: true }), F('views', 'number', { s: true, opt: true }), F('watchers', 'number', { s: true, opt: true })] }),
  read_storefront: manifest('read_storefront', { session: 'public', route_kind: 'page', version: '1.0.0', input: { username: 'string' }, fixture_ref: 'closet.html',
    fields: [F('followers', 'number'), F('following', 'number'), F('review_count', 'number'), F('sold_count', 'number'), F('active_count', 'number'),
      F('sold_display', 'string', { opt: true }), F('vacation', 'boolean', { opt: true }), F('last_active_at', 'datetime', { opt: true }),
      F('views', 'number', { s: true, opt: true }), F('saves', 'number', { s: true, opt: true }), F('gross_cents', 'cents', { s: true, opt: true })] }),
  read_inbox: manifest('read_inbox', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'inbox.json',
    fields: [F('external_id', 'string', { s: true }), F('thread_ref', 'string', { s: true }), F('listing_external_id', 'string', { s: true, opt: true }), F('at', 'datetime', { s: true }), F('from', 'string', { s: true })] }),
  read_offers: manifest('read_offers', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'offers.json',
    fields: [F('external_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('amount_cents', 'cents', { s: true }), F('state', 'string', { s: true }),
      F('buyer_ref_hash', 'string', { s: true, opt: true }), F('expires_at', 'datetime', { s: true, opt: true })] }),
  read_orders: manifest('read_orders', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'orders.json',
    fields: [F('external_order_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('state', 'string', { s: true }), F('price_cents', 'cents', { s: true })] }),
  read_stats: manifest('read_stats', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'stats.json',
    fields: [F('external_id', 'string', { s: true }), F('views', 'number', { s: true }), F('likes', 'number', { s: true, opt: true }), F('shares', 'number', { s: true, opt: true })] }),
  ...Object.fromEntries(Object.entries(PAGE_CONTROLS).map(([verb, controls]) => [verb, manifest(verb as Verb, { session: 'signed_in', route_kind: 'page', version: '0.1.0',
    fields: PLAN, input: {}, fixture_ref: '(none: dry plan, no submit observed)', controls, per_minute: 6 })])) as Record<Exclude<keyof typeof WRITES, 'share'>, Manifest>,
} satisfies Record<Verb, Manifest>;

const RUN: Record<Verb, (c: Client, a: CallArgs, s: AbortSignal) => Promise<AdapterResult>> = {
  search, read_listings: readListings, read_storefront: readStorefront,
  read_inbox: signedRead('read_inbox'), read_offers: signedRead('read_offers'), read_orders: signedRead('read_orders'), read_stats: signedRead('read_stats'),
  post: write('post'), revise: write('revise'), end: write('end'), relist: write('relist'), send_message: write('send_message'),
  answer_offer: write('answer_offer'), make_offer: write('make_offer'), save: write('save'),
};

export function poshmarkAdapters(client: Client): Adapter[] {
  return (Object.keys(RUN) as Verb[]).map(verb => ({ route_id: `poshmark.${verb}.${M[verb].route_kind}`, manifest: M[verb], run: (a, s) => RUN[verb](client, a, s) }));
}

// --- the watch snapshot (app/src/edge/events/event.ts): a section that was not read stays undefined ---

export function toWatchSnapshot(o: { account_id: string; user_id: string; taken_at: string; listings?: Obj[]; offers?: Obj[]; messages?: Obj[]; orders?: Obj[] }): Snapshot {
  const listings = o.listings?.flatMap((r): SnapListing[] => typeof r.external_id === 'string' && typeof r.price_cents === 'number' && r.state
    ? [{ external_id: r.external_id, state: r.state as SnapListing['state'], price_cents: r.price_cents, ...(num(r.likes) !== undefined ? { likes: num(r.likes) } : {}),
      ...(num(r.views) !== undefined ? { views: num(r.views) } : {}), ...(num(r.watchers) !== undefined ? { watchers: num(r.watchers) } : {}) }] : []);
  const signed = !!(o.offers || o.messages || o.orders);
  return { site: 'poshmark', account_id: o.account_id, user_id: o.user_id, taken_at: o.taken_at, route: signed ? 'signed_in' : 'public',
    ...(listings ? { listings } : {}),
    ...(o.offers ? { offers: o.offers.map(r => ({ external_id: String(r.external_id), listing_external_id: String(r.listing_external_id), amount_cents: Number(r.amount_cents),
      state: r.state as SnapOffer['state'], ...(r.buyer_ref_hash ? { buyer_ref_hash: String(r.buyer_ref_hash) } : {}) })) } : {}),
    ...(o.messages ? { messages: o.messages.map((r): SnapMessage => ({ external_id: String(r.external_id), thread_ref: String(r.thread_ref), at: String(r.at),
      from: r.from === 'us' ? 'us' : 'buyer', ...(r.listing_external_id ? { listing_external_id: String(r.listing_external_id) } : {}) })) } : {}),
    ...(o.orders ? { orders: o.orders.map((r): SnapOrder => ({ external_order_id: String(r.external_order_id), listing_external_id: String(r.listing_external_id),
      state: String(r.state), price_cents: Number(r.price_cents) })) } : {}),
  };
}
