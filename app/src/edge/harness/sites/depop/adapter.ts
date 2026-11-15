// The Depop harness (spec/product.md#the-harness-protocol; README.md beside this file for the per-verb operating design).
// Server only. Every verb is an `Adapter` over an injected `Client`: live.ts gives a cloud page and in-page fetch, the
// tests give the reduced recordings in fixtures/. Public reads are proved live; signed-in verbs are built on fixtures.
import { createHash } from 'node:crypto';

import { offerExpiresAt, sellerOffer, fact } from '../../../../../../spec/sites.mjs';
import type { Snapshot, SnapListing, SnapMessage, SnapOffer, SnapOrder } from '../../../events/event.ts';
import { classifyRead, fail, isWrite, type Adapter, type AdapterResult, type CallArgs, type Field, type FieldType, type Manifest, type Verb } from '../../protocol.ts';

export type Page = { status: number; html: string; challenge?: boolean };
export type Reply = { status: number; body: unknown };
// signed_in: the client carries the linked account's stored sign-in. json paths are on https://webapi.depop.com.
export type Client = { signed_in: boolean; doc(url: string, signal: AbortSignal): Promise<Page>; json(path: string, signal: AbortSignal): Promise<Reply> };

export const WWW = 'https://www.depop.com';
export const API = 'https://webapi.depop.com';
const P = '/presentation/api/v1';
// Observed 2026-11-15 (anonymous cloud browser). The signed-in paths are unobserved guesses until recon runs with a linked account.
export const PATHS = {
  bySlug: (slug: string) => `${P}/products/by-slug/${slug}/`,
  extended: (slug: string) => `${P}/products/by-slug/${slug}/extended/`,
  feedback: (user: number | string, offset = 0) => `${P}/users/${user}/feedback/?role=seller&offset=${offset}&limit=20`,
  products: (shop: number | string) => `${P}/shops/${shop}/products/?limit=24`,
  sold: (shop: number | string) => `${P}/shops/${shop}/products/by-status/sold/?lang=en&limit=24`,
  aggregates: (shop: number | string) => `${P}/shops/${shop}/aggregates/?what=&currency=USD`,
  inbox: '/api/v1/conversations/?limit=20',            // unobserved
  offers: '/api/v1/offers/?role=seller&limit=20',      // unobserved
  orders: '/api/v1/receipts/?role=seller&limit=20',    // unobserved
  stats: '/api/v1/shop/insights/?limit=20',            // unobserved
} as const;

// --- parsing the site's own structure ---

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const at = (o: unknown, ...ks: string[]): unknown => ks.reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
// "64.05" -> 6405; anything that is not a plain decimal amount is undefined, so classifyRead names it.
export const cents = (v: unknown) => (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : undefined);
export const refHash = (v: string) => 'h' + createHash('sha256').update(v).digest('hex').slice(0, 8);
const objects = (body: unknown) => (Array.isArray(at(body, 'objects')) ? (at(body, 'objects') as unknown[]).filter(isObj) : undefined);
const listingUrl = (slug: string) => `${WWW}/products/${slug}/`;

// The page is a Next.js app: its data rides in `self.__next_f.push([1,"..."])` parts, joined in order.
export function flight(html: string): string {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map(m => JSON.parse(m[1]) as string).join('');
}
// The JSON value that starts at i, found by a string-aware bracket count.
function balanced(s: string, i: number): string | undefined {
  let d = 0, q = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === '\\') j++; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === '{' || c === '[') d++; else if ((c === '}' || c === ']') && --d === 0) return s.slice(i, j + 1);
  }
}
// Every object in the flight that starts with marker and passes ok; the first is the one the page renders.
export function extract(html: string, marker: string, ok: (o: Obj) => boolean): Obj | undefined {
  const s = flight(html);
  for (let i = s.indexOf(marker); i >= 0; i = s.indexOf(marker, i + 1)) {
    const raw = balanced(s, i);
    try { const o: unknown = raw && JSON.parse(raw); if (isObj(o) && ok(o)) return o; }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; /* not this candidate */ }
  }
}

export const stateOf = (status: unknown): SnapListing['state'] | undefined =>
  status === 'STATUS_ONSALE' ? 'live' : status === 'STATUS_MARKED_AS_SOLD' || status === 'STATUS_PURCHASED' ? 'sold'
    : typeof status === 'string' && status.startsWith('STATUS_') ? 'ended' : undefined;

// The answer to a status of 400 or more. 410 is a retired webapi version path (code 9001, observed): the route moved.
export function statusFail(status: number, where: string): Extract<AdapterResult, { ok: false }> | undefined {
  if (status < 400) return;
  if (status === 401) return fail('auth_expired', `${where} answered 401`, { do: 'relink', site: 'depop' });
  if (status === 404) return fail('not_found', `${where} answered 404`, { do: 'reconcile', searched: [where] });
  if (status === 410) return fail('page_changed', `${where} answered 410, the path was retired`, { do: 'author', missing: [where] });
  if (status === 429) return fail('rate_limited', `${where} answered 429`, { do: 'retry_after', after_s: 60 });
  return fail('blocked', `${where} answered ${status}`, { do: 'pause_session', site: 'depop' });
}
const changed = (what: string) => fail('page_changed', `${what} is not where the page kept it`, { do: 'author', missing: [what] });
const relink = () => fail('auth_expired', 'this verb needs the linked account signed in', { do: 'relink', site: 'depop' });
const refuse = (kind: string, message: string) => fail('policy_refused', message, { do: 'raise_decision', kind });

// --- manifests ---

const F = (name: string, type: FieldType, o: { s?: boolean; opt?: boolean } = {}): Field => ({ name, type, needs_session: !!o.s, required: !o.opt });
const RECORDED = '2026-11-15';
function manifest(verb: Verb, o: { session: Manifest['session']; route_kind: Manifest['route_kind']; version: string; fields: Field[];
  input: Manifest['input_schema']; fixture_ref: string; controls?: string[]; per_minute?: number }): Manifest {
  return {
    site: 'depop', verb, version: o.version, input_schema: o.input, fields: o.fields,
    output_schema: Object.fromEntries(o.fields.map(f => [f.name, f.type])),
    session: o.session, route_kind: o.route_kind, pace: { per_minute: o.per_minute ?? 20, step_ms: [2000, 5000] },
    expect: { status: 200, has: o.fields.filter(f => f.required).map(f => f.name) },
    ...(isWrite(verb) ? { read_back: { verb: verb === 'send_message' ? 'read_inbox' : verb.endsWith('offer') ? 'read_offers' : 'read_listings', match: ['external_id'] } as const } : {}),
    controls: o.controls ?? [], fixture_ref: `app/src/edge/harness/sites/depop/fixtures/${o.fixture_ref}`, recorded_at: RECORDED,
  };
}
const LISTING = [F('external_id', 'string'), F('slug', 'string'), F('url', 'url'), F('state', 'string'), F('price_cents', 'cents'), F('currency', 'string'),
  F('brand', 'string', { opt: true }), F('likes', 'number', { opt: true }), F('sku', 'string', { opt: true })];
const PLAN = [F('dry', 'boolean'), F('url', 'url'), F('steps', 'string[]'), F('request', 'object')];

// --- the public reads ---

async function search(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const q = str(a.q);
  if (!q) return refuse('missing_input', 'search needs q');
  // Sold search is not public on Depop (no sold filter answers anonymously, observed 2026-11-15).
  if (a.status === 'sold') return fail('no_route', 'sold search is not public on Depop', { do: 'handoff', url: `${WWW}/search/?q=${encodeURIComponent(q)}` });
  const url = `${WWW}/search/?q=${encodeURIComponent(q)}`;
  const p = await c.doc(url, s);
  if (p.challenge) return classifyRead({ challenge: true, rows: [] }, M.search);
  const bad = statusFail(p.status, url); if (bad) return bad;
  const data = extract(p.html, '{"meta":{"total_count"', o => Array.isArray(o.objects));
  if (!data) return changed('search meta.total_count');
  const rows = (objects(data) ?? []).map(o => {
    const slug = str(o.slug);
    return { external_id: str(o.id), slug, url: slug && listingUrl(slug), state: stateOf(o.status), price_cents: cents(at(o, 'pricing', 'current_price', 'price_breakdown', 'price', 'amount')),
      currency: str(at(o, 'pricing', 'currency')), brand: str(o.brand_name), likes: num(o.like_count),
      sku: typeof o.sku === 'string' ? o.sku : undefined, // unobserved
      seller_ref_hash: slug && refHash(slug.split('-')[0]) };
  });
  return classifyRead({ challenge: false, rows }, M.search);
}

async function getJson(c: Client, path: string, s: AbortSignal): Promise<{ ok: true; body: unknown } | Extract<AdapterResult, { ok: false }>> {
  const r = await c.json(path, s);
  return statusFail(r.status, path) ?? { ok: true, body: r.body };
}
const listingRow = (o: Obj) => {
  const slug = str(o.slug);
  return { external_id: str(o.id), slug, url: slug && listingUrl(slug), state: stateOf(o.status), currency: str(at(o, 'pricing', 'currency')),
    price_cents: cents(at(o, 'pricing', 'current_price', 'price_breakdown', 'price', 'amount')), brand: str(o.brand_name), likes: num(o.like_count),
    listed_at: str(o.created_at), sku: typeof o.sku === 'string' ? o.sku : undefined }; // unobserved
};

// Own listings, from the public shop endpoints of the linked shop; views and watchers need the session.
async function readListings(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const shop = str(a.shop_id);
  if (!shop) return refuse('missing_input', 'read_listings needs the linked shop_id');
  // shortcut: the first page of 24 per status only, follow page_info.last as offset when a shop has more.
  const which = a.status === 'sold' ? ['sold'] : a.status === 'active' ? ['products'] : ['products', 'sold'];
  const rows = [];
  for (const w of which) {
    const r = await getJson(c, w === 'sold' ? PATHS.sold(shop) : PATHS.products(shop), s); if (!r.ok) return r;
    const objs = objects(r.body); if (!objs) return changed(`${w} objects`);
    rows.push(...objs.map(listingRow));
  }
  return classifyRead({ challenge: false, rows }, M.read_listings);
}

async function shopSeller(c: Client, username: string, s: AbortSignal): Promise<{ ok: true; seller: Obj } | Extract<AdapterResult, { ok: false }>> {
  const url = `${WWW}/${encodeURIComponent(username)}/`;
  const p = await c.doc(url, s);
  if (p.challenge) return fail('blocked', 'the site showed a check the person must pass', { do: 'pause_session', site: 'depop' });
  const bad = statusFail(p.status, url); if (bad) return bad;
  const o = extract(p.html, '{"seller":{', o => typeof at(o, 'seller', 'followers') === 'number');
  return o ? { ok: true, seller: o.seller as Obj } : changed('shop seller');
}

// The public figures for read_storefront: the shop page's seller block plus the active count from aggregates.
async function readStorefront(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const username = str(a.username);
  if (!username) return refuse('missing_input', 'read_storefront needs the linked username');
  const r = await shopSeller(c, username, s); if (!r.ok) return r;
  const id = str(r.seller.id); if (!id) return changed('seller.id');
  const g = await getJson(c, PATHS.aggregates(id), s); if (!g.ok) return g;
  const row = { followers: num(r.seller.followers), following: num(r.seller.following), rating: num(r.seller.reviews_rating),
    review_count: num(r.seller.reviews_total), sold_count: num(r.seller.items_sold), active_count: num(at(g.body, 'total')), shop_id: id };
  const out = classifyRead({ challenge: false, rows: [row] }, M.read_storefront);
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// --- reads that are not kernel verbs: one listing, still up, reviews ---

export async function readListing(c: Client, slug: string, s: AbortSignal): Promise<AdapterResult> {
  const b = await getJson(c, PATHS.bySlug(slug), s); if (!b.ok) return b;
  const e = await getJson(c, PATHS.extended(slug), s); if (!e.ok) return e;
  const p = isObj(b.body) ? b.body : {};
  const row = { ...listingRow({ ...p, pricing: at(e.body, 'pricing') }), likes: num(at(e.body, 'like_count')),
    shipping_cents: cents(at(e.body, 'pricing', 'current_price', 'price_breakdown', 'shipping', 'amount')),
    quantity: num(p.listed_quantity), seller_ref_hash: str(at(p, 'seller', 'username')) && refHash(str(at(p, 'seller', 'username'))!) };
  const out = classifyRead({ challenge: false, rows: [row] }, { site: 'depop', fields: [...LISTING, F('seller_ref_hash', 'string')] });
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// live, sold, or gone (a 404 on by-slug; shortcut: unverified that a deleted listing 404s rather than 200s with a status, recon on a deleted slug settles it).
export async function stillUp(c: Client, slug: string, s: AbortSignal): Promise<AdapterResult<{ state: 'live' | 'sold' | 'ended' | 'gone' }>> {
  const r = await c.json(PATHS.bySlug(slug), s);
  if (r.status === 404) return { ok: true, data: { state: 'gone' } };
  const bad = statusFail(r.status, PATHS.bySlug(slug)); if (bad) return bad;
  const st = stateOf(at(r.body, 'status'));
  if (!st || st === 'draft') return changed('product.status');
  return { ok: true, data: { state: at(r.body, 'active_status') === 'active' || st !== 'live' ? st : 'ended' } };
}

export async function readReviews(c: Client, user_id: string, s: AbortSignal): Promise<AdapterResult> {
  const r = await getJson(c, PATHS.feedback(user_id), s); if (!r.ok) return r;
  const objs = objects(r.body); if (!objs) return changed('feedback objects');
  const rows = objs.map(o => ({ at: str(o.date), rating: num(o.rating), listing_external_id: str(at(o, 'product', 'id')),
    author_ref_hash: str(at(o, 'author', 'username')) && refHash(str(at(o, 'author', 'username'))!) }));
  return classifyRead({ challenge: false, rows }, { site: 'depop', fields: [F('at', 'datetime'), F('rating', 'number'), F('author_ref_hash', 'string')] });
}

// --- the signed-in reads (built on synthetic fixtures; no account is linked to prove them) ---

const OFFER_STATE: Record<string, SnapOffer['state']> = { pending: 'open', countered: 'countered', accepted: 'accepted', declined: 'declined', expired: 'expired', withdrawn: 'withdrawn' };
const SIGNED: Record<'read_inbox' | 'read_offers' | 'read_orders' | 'read_stats', { path: string; row: (o: Obj) => Obj }> = {
  read_inbox: { path: PATHS.inbox, row: o => ({ external_id: str(o.id), thread_ref: str(o.conversation_id), listing_external_id: str(o.product_id),
    at: str(o.sent_at), from: typeof o.from_me === 'boolean' ? (o.from_me ? 'us' : 'buyer') : undefined }) },
  read_offers: { path: PATHS.offers, row: o => {
    const created = str(o.created_at);
    return { external_id: str(o.id), listing_external_id: str(o.product_id), amount_cents: cents(at(o, 'amount', 'amount')),
      state: OFFER_STATE[str(o.status) ?? ''], buyer_ref_hash: str(at(o, 'buyer', 'username')) && refHash(str(at(o, 'buyer', 'username'))!),
      created_at: created, expires_at: created && offerExpiresAt('depop', 'buyer', new Date(created))?.toISOString() };
  } },
  read_orders: { path: PATHS.orders, row: o => ({ external_order_id: str(o.id), listing_external_id: str(o.product_id), state: str(o.status),
    price_cents: cents(at(o, 'total', 'amount')), at: str(o.created_at) }) },
  read_stats: { path: PATHS.stats, row: o => ({ external_id: str(o.product_id), views: num(o.views), likes: num(o.likes), saves: num(o.bag_adds) }) },
};
const signedRead = (verb: keyof typeof SIGNED) => async (c: Client, _a: CallArgs, s: AbortSignal): Promise<AdapterResult> => {
  if (!c.signed_in) return relink();
  const r = await getJson(c, SIGNED[verb].path, s); if (!r.ok) return r;
  const objs = objects(r.body); if (!objs) return changed(`${verb} objects`);
  return classifyRead({ challenge: false, rows: objs.map(SIGNED[verb].row) }, M[verb]);
};

// --- the writes: dry by default, they return the page steps and the request and stop before the final submit ---

type Plan = { dry: true; url: string; steps: string[]; request: Obj };
const POST_REQUIRED = ['description', 'pictures', 'department', 'product_type', 'condition', 'brand_name', 'price_amount', 'quantity'] as const;
const DEPARTMENTS = ['womenswear', 'menswear', 'kidswear', 'everything-else'];
const CONDITIONS = ['brand_new', 'used_like_new', 'used_excellent', 'used_good', 'used_fair'];
const MAX: Record<string, number> = { colour: 2, style: 3, age: 1, source: 2 };

// The listing fields of research/list/ben/platforms/depop.md (the Depop listing form).
export function listingProblems(l: Obj, partial = false): string[] {
  const out: string[] = [];
  if (!partial) for (const k of POST_REQUIRED) if (l[k] === undefined) out.push(`${k} is required`);
  if (l.description !== undefined && (typeof l.description !== 'string' || l.description.length > 1000)) out.push('description is text of at most 1000 characters');
  if (l.pictures !== undefined && (!Array.isArray(l.pictures) || l.pictures.length < 1 || l.pictures.length > 8)) out.push('pictures are 1 to 8');
  if (l.department !== undefined && !DEPARTMENTS.includes(String(l.department))) out.push(`department is one of ${DEPARTMENTS.join(', ')}`);
  if (l.condition !== undefined && !CONDITIONS.includes(String(l.condition))) out.push(`condition is one of ${CONDITIONS.join(', ')}`);
  if (l.price_amount !== undefined && !(typeof l.price_amount === 'number' && l.price_amount >= 1)) out.push('price_amount is at least 1.00');
  if (l.quantity !== undefined && !(Number.isInteger(l.quantity) && (l.quantity as number) >= 1)) out.push('quantity is at least 1');
  if ((l.size_id === undefined) !== (l.size_set_id === undefined)) out.push('size_id and size_set_id go together');
  for (const [k, n] of Object.entries(MAX)) if (l[k] !== undefined && (!Array.isArray(l[k]) || (l[k] as unknown[]).length > n)) out.push(`${k} takes at most ${n}`);
  if (typeof l.sku === 'string' && l.sku.length > 50) out.push('sku is at most 50 characters');
  if (l.national_shipping_cost !== undefined && l.depop_shipping !== undefined) out.push('national_shipping_cost or depop_shipping, never both');
  return out;
}

// Auto-respond on Depop sets one line: "Always accept $X or more" (product/decisions.md). X is never below the item's floor,
// and Depop wants it at least min_off_pct under the price, so the line becomes auto_negotiate_offer_price and nothing else.
export function autoRespond(price_cents: number, floor_cents: number, always_accept_cents: number): { ok: true; request: Obj } | { ok: false; why: string } {
  const min = fact('offer.seller.min_off_pct', 'depop') as number;
  if (always_accept_cents < floor_cents) return { ok: false, why: 'the always-accept line is below the floor; a price below the floor always asks' };
  if (always_accept_cents > Math.floor(price_cents * (100 - min) / 100)) return { ok: false, why: `Depop wants the line at least ${min}% under the price` };
  return { ok: true, request: { auto_negotiate_offer_price: (always_accept_cents / 100).toFixed(2) } };
}

const id = (a: CallArgs, k: string) => str(a[k]);
const WRITES: Record<'post' | 'revise' | 'end' | 'relist' | 'send_message' | 'answer_offer' | 'make_offer' | 'save', (a: CallArgs) => Plan | Extract<AdapterResult, { ok: false }>> = {
  post: a => {
    const l = isObj(a.listing) ? a.listing : {};
    const request = { ...l, ...(!(typeof l.sku === 'string' && l.sku.length > 0) && typeof a.sku_hash === 'string' ? { sku: a.sku_hash } : {}) };
    const bad = listingProblems(request); if (bad.length) return refuse('invalid_listing', bad.join('; '));
    return { dry: true, url: `${WWW}/products/create/`, request, steps: ['add the photos', 'fill description', 'choose department and product_type', 'choose size',
      'choose condition', 'fill brand', 'fill price and quantity', 'set shipping', ...(request.sku ? ['fill sku'] : []), 'stop before Post'] };
  },
  revise: a => {
    const slug = id(a, 'slug'); if (!slug) return refuse('missing_input', 'revise needs slug');
    const changes = isObj(a.changes) ? a.changes : {};
    const bad = listingProblems(changes, true); if (bad.length) return refuse('invalid_listing', bad.join('; '));
    let request: Obj = { ...changes };
    if (a.always_accept_cents !== undefined) {
      const r = autoRespond(Number(a.price_cents), Number(a.floor_cents), Number(a.always_accept_cents));
      if (!r.ok) return refuse('auto_respond_line', r.why);
      request = { ...request, ...r.request };
    }
    return { dry: true, url: `${WWW}/products/edit/${slug}/`, request, steps: ['open the edit page', ...Object.keys(request).map(k => `set ${k}`), 'stop before Save changes'] };
  },
  end: a => {
    const slug = id(a, 'slug'); if (!slug) return refuse('missing_input', 'end needs slug');
    return { dry: true, url: `${WWW}/products/edit/${slug}/`, request: { slug }, steps: ['open the edit page', 'tap Delete listing', 'stop before the confirm'] };
  },
  relist: a => {
    const slug = id(a, 'slug'); if (!slug) return refuse('missing_input', 'relist needs slug');
    return { dry: true, url: `${WWW}/products/edit/${slug}/`, request: { slug, quantity: Number(a.quantity ?? 1) },
      steps: ['open the sold or deleted listing', 'tap Restock', 'set quantity', 'stop before Save changes'] };
  },
  send_message: a => {
    const thread = id(a, 'thread_ref'), text = str(a.text);
    if (!thread || !text?.trim()) return refuse('missing_input', 'send_message needs thread_ref and text');
    return { dry: true, url: `${WWW}/messages/${thread}/`, request: { thread_ref: thread, text }, steps: ['open the thread', 'type the message', 'stop before Send'] };
  },
  answer_offer: a => {
    const offer = id(a, 'offer_id'), action = str(a.action), sent = str(a.received_at);
    if (!offer || !sent || !['accept', 'decline', 'counter'].includes(action ?? '')) return refuse('missing_input', 'answer_offer needs offer_id, received_at and accept, decline or counter');
    const ends = offerExpiresAt('depop', 'buyer', new Date(sent)) as Date | null;
    const now = a.now ? new Date(String(a.now)) : new Date();
    if (ends && now >= ends) return refuse('offer_expired', `the offer ended at ${ends.toISOString()}`);
    if (action === 'counter' && !(Number.isInteger(a.amount_cents) && (a.amount_cents as number) > 0)) return refuse('missing_input', 'a counter needs amount_cents');
    return { dry: true, url: `${WWW}/messages/`, request: { offer_id: offer, action, ...(action === 'counter' ? { amount: ((a.amount_cents as number) / 100).toFixed(2) } : {}), expires_at: ends?.toISOString() },
      steps: ['open the offer', `tap ${action === 'accept' ? 'Accept' : action === 'decline' ? 'Decline' : 'Counter'}`, ...(action === 'counter' ? ['fill the amount'] : []), 'stop before the confirm'] };
  },
  make_offer: a => {
    const listing = id(a, 'listing_external_id'); if (!listing) return refuse('missing_input', 'make_offer needs listing_external_id');
    // spec/sites.mjs defaults last_sent_at to null, which tsc reads as the only allowed type
    const r = sellerOffer('depop', { list_cents: Number(a.list_cents), offer_cents: Number(a.offer_cents), lowest_cents: a.lowest_cents === undefined ? undefined : Number(a.lowest_cents),
      last_sent_at: a.last_sent_at ? new Date(String(a.last_sent_at)) : null, now: a.now ? new Date(String(a.now)) : new Date(), promised_elsewhere: a.promised_elsewhere === true });
    if (!r.ok) return refuse('seller_offer', r.why ?? 'refused');
    return { dry: true, url: `${WWW}/sellinghub/`, request: { listing_external_id: listing, amount: (Number(a.offer_cents) / 100).toFixed(2) },
      steps: ['open the listing in the selling hub', 'tap Send offer', 'fill the amount', 'stop before Send'] };
  },
  save: a => {
    const slug = id(a, 'slug'); if (!slug) return refuse('missing_input', 'save needs slug');
    return { dry: true, url: listingUrl(slug), request: { slug }, steps: ['open the listing', 'stop before tapping the heart'] };
  },
};
const write = (verb: keyof typeof WRITES) => async (c: Client, a: CallArgs): Promise<AdapterResult> => {
  const plan = WRITES[verb](a);
  if ('ok' in plan) return plan;
  if (a.dry !== false) return { ok: true, data: plan };
  if (!c.signed_in) return relink();
  // No submit has been observed with a linked account yet, so a real write hands the person the page.
  return fail('no_route', `${verb} has no proved submit yet`, { do: 'handoff', url: plan.url });
};

// --- the manifests and the adapters ---

const PAGE_CONTROLS = { post: ['photos', 'description', 'department', 'product_type', 'size', 'condition', 'brand', 'price', 'quantity', 'shipping'],
  revise: ['edit form fields', 'auto offer price'], end: ['Delete listing'], relist: ['Restock', 'quantity'], send_message: ['message box'],
  answer_offer: ['Accept', 'Decline', 'Counter', 'amount'], make_offer: ['Send offer', 'amount'], save: ['like heart'] };
export const M = {
  search: manifest('search', { session: 'public', route_kind: 'page', version: '1.0.0', fields: [...LISTING, F('seller_ref_hash', 'string')],
    input: { q: 'string', status: 'string' }, fixture_ref: 'search.html' }),
  read_listings: manifest('read_listings', { session: 'public', route_kind: 'endpoint', version: '1.0.0', input: { shop_id: 'string', status: 'string' }, fixture_ref: 'products.json',
    fields: [...LISTING, F('listed_at', 'datetime', { opt: true }), F('views', 'number', { s: true, opt: true }), F('watchers', 'number', { s: true, opt: true })] }),
  read_storefront: manifest('read_storefront', { session: 'public', route_kind: 'page', version: '1.0.0', input: { username: 'string' }, fixture_ref: 'shop.html',
    fields: [F('followers', 'number'), F('following', 'number'), F('rating', 'number', { opt: true }), F('review_count', 'number'), F('sold_count', 'number'),
      F('active_count', 'number'), F('views', 'number', { s: true, opt: true }), F('saves', 'number', { s: true, opt: true }), F('gross_cents', 'cents', { s: true, opt: true })] }),
  read_inbox: manifest('read_inbox', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'inbox.json',
    fields: [F('external_id', 'string', { s: true }), F('thread_ref', 'string', { s: true }), F('listing_external_id', 'string', { s: true, opt: true }), F('at', 'datetime', { s: true }), F('from', 'string', { s: true })] }),
  read_offers: manifest('read_offers', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'offers.json',
    fields: [F('external_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('amount_cents', 'cents', { s: true }), F('state', 'string', { s: true }),
      F('buyer_ref_hash', 'string', { s: true, opt: true }), F('expires_at', 'datetime', { s: true, opt: true })] }),
  read_orders: manifest('read_orders', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'orders.json',
    fields: [F('external_order_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('state', 'string', { s: true }), F('price_cents', 'cents', { s: true })] }),
  read_stats: manifest('read_stats', { session: 'signed_in', route_kind: 'endpoint', version: '0.1.0', input: {}, fixture_ref: 'stats.json',
    fields: [F('external_id', 'string', { s: true }), F('views', 'number', { s: true }), F('likes', 'number', { s: true, opt: true }), F('saves', 'number', { s: true, opt: true })] }),
  ...Object.fromEntries(Object.entries(PAGE_CONTROLS).map(([verb, controls]) => [verb, manifest(verb as Verb, { session: 'signed_in', route_kind: 'page', version: '0.1.0',
    fields: PLAN, input: {}, fixture_ref: '(none: dry plan, no submit observed)', controls, per_minute: 6 })])) as Record<keyof typeof WRITES, Manifest>,
} satisfies Record<Verb, Manifest>;

const RUN: Record<Verb, (c: Client, a: CallArgs, s: AbortSignal) => Promise<AdapterResult>> = {
  search, read_listings: readListings, read_storefront: readStorefront,
  read_inbox: signedRead('read_inbox'), read_offers: signedRead('read_offers'), read_orders: signedRead('read_orders'), read_stats: signedRead('read_stats'),
  post: write('post'), revise: write('revise'), end: write('end'), relist: write('relist'), send_message: write('send_message'),
  answer_offer: write('answer_offer'), make_offer: write('make_offer'), save: write('save'),
};

export function depopAdapters(client: Client): Adapter[] {
  return (Object.keys(RUN) as Verb[]).map(verb => ({ route_id: `depop.${verb}.${M[verb].route_kind}`, manifest: M[verb], run: (a, s) => RUN[verb](client, a, s) }));
}

// --- the watch snapshot (app/src/edge/events/event.ts): a section that was not read stays undefined ---

export function toWatchSnapshot(o: { account_id: string; user_id: string; taken_at: string; listings?: Obj[]; offers?: Obj[]; messages?: Obj[]; orders?: Obj[] }): Snapshot {
  const listings = o.listings?.flatMap((r): SnapListing[] => typeof r.external_id === 'string' && typeof r.price_cents === 'number' && r.state
    ? [{ external_id: r.external_id, state: r.state as SnapListing['state'], price_cents: r.price_cents, ...(num(r.likes) !== undefined ? { likes: num(r.likes) } : {}),
      ...(num(r.views) !== undefined ? { views: num(r.views) } : {}), ...(num(r.watchers) !== undefined ? { watchers: num(r.watchers) } : {}) }] : []);
  const signed = !!(o.offers || o.messages || o.orders);
  return { site: 'depop', account_id: o.account_id, user_id: o.user_id, taken_at: o.taken_at, route: signed ? 'signed_in' : 'public',
    ...(listings ? { listings } : {}),
    ...(o.offers ? { offers: o.offers.map(r => ({ external_id: String(r.external_id), listing_external_id: String(r.listing_external_id), amount_cents: Number(r.amount_cents),
      state: r.state as SnapOffer['state'], ...(r.buyer_ref_hash ? { buyer_ref_hash: String(r.buyer_ref_hash) } : {}) })) } : {}),
    ...(o.messages ? { messages: o.messages.map((r): SnapMessage => ({ external_id: String(r.external_id), thread_ref: String(r.thread_ref), at: String(r.at),
      from: r.from === 'us' ? 'us' : 'buyer', ...(r.listing_external_id ? { listing_external_id: String(r.listing_external_id) } : {}) })) } : {}),
    ...(o.orders ? { orders: o.orders.map((r): SnapOrder => ({ external_order_id: String(r.external_order_id), listing_external_id: String(r.listing_external_id),
      state: String(r.state), price_cents: Number(r.price_cents) })) } : {}),
  };
}
