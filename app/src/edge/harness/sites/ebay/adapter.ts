// eBay site harness: eBay's documented developer APIs behind the kernel Adapter (spec/engines/protocol-and-adapters.md §1, §9).
// The API verbs are endpoint routes; search and read_storefront also have page routes for while no keyset exists. Reads parse untrusted replies at the boundary; writes are dry by default and a dry write
// returns the exact documented request with the token as a placeholder, sending nothing. Tokens live behind account.token_ref
// (connect/ebay.ts through the vault port) and never enter a row, a plan or a log. Sources and dates: README.md.
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { offerExpiresAt, sellerOffer, fact } from '../../../../../../spec/sites.mjs';
import type { Snapshot, SnapListing, SnapMessage, SnapOffer, SnapOrder } from '../../../events/event.ts';
import { classifyRead, fail, isWrite, type Adapter, type AdapterResult, type CallArgs, type Field, type FieldType, type Manifest, type Verb } from '../../protocol.ts';

export type Env = 'production' | 'sandbox';
export type Req = { method: 'GET' | 'POST' | 'PUT'; url: string; headers: Record<string, string>; body?: string };
export type Reply = { status: number; headers: Record<string, string | undefined>; body: unknown }; // body: parsed JSON, or the XML string
// app_token: client credentials (public reads). user_token: connect/ebay.ts accessToken(account_id), resolved through token_ref.
export type Client = {
  env: Env; insights?: boolean; now?: () => Date;
  app_token(s: AbortSignal, scope: string): Promise<string | undefined>;
  user_token(s: AbortSignal): Promise<{ ok: true; token: string } | { ok: false }>;
  send(req: Req, s: AbortSignal): Promise<Reply>;
};

export const HOSTS = {
  production: { api: 'https://api.ebay.com', apiz: 'https://apiz.ebay.com', auth: 'https://auth.ebay.com', www: 'https://www.ebay.com' },
  sandbox: { api: 'https://api.sandbox.ebay.com', apiz: 'https://apiz.sandbox.ebay.com', auth: 'https://auth.sandbox.ebay.com', www: 'https://sandbox.ebay.com' },
} as const;
const S = 'https://api.ebay.com/oauth/api_scope';
export const SCOPES = {
  public: S, insights: `${S}/buy.marketplace.insights`, inventory: `${S}/sell.inventory`, fulfillment: `${S}/sell.fulfillment.readonly`,
  analytics: `${S}/sell.analytics.readonly`, message: `${S}/commerce.message`, identity: `${S}/commerce.identity.readonly`, marketing: `${S}/sell.marketing`,
} as const;
// What the link asks for. sell.marketing is left out on purpose: promoted listings are proposed, never switched on.
export const USER_SCOPES = [SCOPES.public, SCOPES.inventory, SCOPES.fulfillment, SCOPES.analytics, SCOPES.message, SCOPES.identity];

// The consent page the person signs in on; redirect_uri is the RuName, not a URL. The code comes back to the RuName's accept URL.
export function consentUrl(app: { client_id: string; redirect_uri: string; scopes?: string[] }, state: string, env: Env = 'production'): string {
  const q = new URLSearchParams({ client_id: app.client_id, redirect_uri: app.redirect_uri, response_type: 'code', scope: (app.scopes ?? USER_SCOPES).join(' '), state });
  return `${HOSTS[env].auth}/oauth2/authorize?${q}`;
}

// Client-credentials token for public reads, cached in memory only, never logged or returned to a caller.
export function appTokenSource(o: { client_id: string; client_secret: string; env?: Env; fetchFn?: typeof fetch; now?: () => number }) {
  const fetchFn = o.fetchFn ?? fetch, now = o.now ?? Date.now, cache = new Map<string, { token: string; until: number }>();
  return async (s: AbortSignal, scope: string): Promise<string | undefined> => {
    const have = cache.get(scope);
    if (have && have.until > now()) return have.token;
    const res = await fetchFn(`${HOSTS[o.env ?? 'production'].api}/identity/v1/oauth2/token`, { method: 'POST', signal: s,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${o.client_id}:${o.client_secret}`).toString('base64')}` },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }).toString() });
    const b: unknown = await res.json().catch(() => undefined);
    const token = str(at(b, 'access_token')), ttl = num(at(b, 'expires_in'));
    if (!res.ok || !token || !ttl) return undefined;
    cache.set(scope, { token, until: now() + (ttl - 60) * 1000 });
    return token;
  };
}

// --- parsing helpers (untrusted replies) ---

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const at = (o: unknown, ...ks: string[]): unknown => ks.reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
export const cents = (v: unknown) => (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v) ? Math.round(Number(v) * 100) : undefined);
export const refHash = (v: string) => 'h' + createHash('sha256').update(v).digest('hex').slice(0, 8);
const money = (c: number) => ({ value: (c / 100).toFixed(2), currency: 'USD' });
// Trading replies are flat XML; a regex per tag is enough for the handful of tags read here.
const tag = (x: string, t: string) => x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([^<]*)</${t}>`))?.[1];
const tags = (x: string, t: string) => [...x.matchAll(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'g'))].map(m => m[1]!);
const esc = (v: string) => v.replace(/[<>&'"]/g, ch => `&#${ch.charCodeAt(0)};`);

// --- failures ---

const site = 'ebay' as const;
const relink = () => fail('auth_expired', 'the eBay link expired or was revoked', { do: 'relink', site });
const refuse = (kind: string, message: string) => fail('policy_refused', message, { do: 'raise_decision', kind });
const handoff = (url: string, message: string) => fail('no_route', message, { do: 'handoff', url });
type Failed = Extract<AdapterResult, { ok: false }>;

// eBay documents no Retry-After for its daily call limits, which reset at midnight Pacific; honour the header when it comes.
export function retryAfter(headers: Reply['headers'], now: Date): number {
  const h = Number(headers['retry-after']);
  if (Number.isFinite(h) && h > 0) return Math.ceil(h);
  const [hh, mm, ss] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .format(now).split(':').map(Number) as [number, number, number];
  return 86400 - (hh * 3600 + mm * 60 + ss);
}
const limited = (c: Client, headers: Reply['headers']) =>
  fail('rate_limited', 'eBay call limit reached', { do: 'retry_after', after_s: retryAfter(headers, c.now?.() ?? new Date()) });

// The documented REST error shape: { errors: [{ errorId, message, parameters: [{ name }] }] }. The first error becomes the hint.
function statusFail(c: Client, r: Reply): Failed | undefined {
  if (r.status < 400) return undefined;
  if (r.status === 401 || r.status === 403) return relink();
  if (r.status === 429) return limited(c, r.headers);
  if (r.status === 404) return fail('not_found', 'eBay has no such resource', { do: 'reconcile', searched: [new URL(String(at(r, 'url') ?? 'https://x/')).pathname] });
  const e = list(at(r.body, 'errors'))[0];
  if ((r.status === 400 || r.status === 409) && e) {
    const param = str(at(list(e.parameters)[0], 'name'));
    return refuse(`ebay_${str(e.errorId) ?? 'error'}${param ? `:${param}` : ''}`, str(e.message) ?? 'eBay refused the request');
  }
  return fail('blocked', `eBay answered ${r.status}`, { do: 'pause_session', site });
}
// Trading answers HTTP 200 with <Ack>Failure</Ack>; these codes are the documented auth and usage-limit errors.
function tradingFail(c: Client, r: Reply): Failed | undefined {
  const x = typeof r.body === 'string' ? r.body : '';
  const ack = tag(x, 'Ack');
  if (ack !== 'Failure') return ack ? undefined : fail('blocked', 'eBay Trading sent no Ack', { do: 'pause_session', site });
  const code = tag(x, 'ErrorCode') ?? 'error';
  if (['931', '932', '16110'].includes(code)) return relink();
  if (['518', '21919144'].includes(code)) return limited(c, r.headers);
  return refuse(`ebay_${code}`, tag(x, 'ShortMessage') ?? 'eBay Trading refused the call');
}

// --- transport ---

const H = (c: Client) => HOSTS[c.env];
const bearer = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Language': 'en-US', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' });
const TRADING_LEVEL = '1349';
const trading = (c: Client, call: string, token: string, inner: string): Req => ({ method: 'POST', url: `${H(c).api}/ws/api.dll`,
  headers: { 'X-EBAY-API-CALL-NAME': call, 'X-EBAY-API-SITEID': '0', 'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_LEVEL, 'X-EBAY-API-IAF-TOKEN': token, 'Content-Type': 'text/xml' },
  body: `<?xml version="1.0" encoding="utf-8"?><${call}Request xmlns="urn:ebay:apis:eBLBaseComponents">${inner}</${call}Request>` });

async function get(c: Client, url: string, token: string, s: AbortSignal): Promise<{ ok: true; body: unknown } | Failed> {
  const r = await c.send({ method: 'GET', url, headers: bearer(token) }, s);
  const f = statusFail(c, { ...r, url } as Reply);
  return f ?? { ok: true, body: r.body };
}
async function userGet(c: Client, url: string, s: AbortSignal) {
  const t = await c.user_token(s);
  return t.ok ? get(c, url, t.token, s) : relink();
}

// --- fields and manifests ---

const F = (name: string, type: FieldType, o: { s?: boolean; opt?: boolean } = {}): Field => ({ name, type, needs_session: !!o.s, required: !o.opt });
const RECORDED = '2026-11-15';
// Calls a day from eBay's API call limits page, spread evenly; 20 a minute is the harness ceiling.
const perMinute = (daily: number) => Math.max(1, Math.min(20, Math.floor(daily / 1440)));
function manifest(verb: Verb, o: { session: Manifest['session']; version: string; fields: Field[]; input: Record<string, FieldType>; fixture_ref: string; daily?: number; per_minute?: number }): Manifest {
  return { site, verb, version: o.version, input_schema: o.input, fields: o.fields, output_schema: Object.fromEntries(o.fields.map(f => [f.name, f.type])),
    session: o.session, route_kind: 'endpoint', pace: { per_minute: o.per_minute ?? perMinute(o.daily ?? 5000), step_ms: [2000, 5000] },
    expect: { status: 200, has: o.fields.filter(f => f.required).map(f => f.name) },
    ...(isWrite(verb) ? { read_back: { verb: verb === 'send_message' ? 'read_inbox' : verb.endsWith('offer') ? 'read_offers' : 'read_listings', match: ['external_id'] } as const } : {}),
    controls: [], fixture_ref: `app/src/edge/harness/sites/ebay/fixtures/${o.fixture_ref}`, recorded_at: RECORDED };
}
const ITEM = [F('external_id', 'string'), F('item_id', 'string'), F('title', 'string'), F('url', 'url'), F('state', 'string'), F('price_cents', 'cents'),
  F('currency', 'string'), F('seller_ref_hash', 'string', { opt: true }), F('watchers', 'number', { opt: true }), F('listed_at', 'datetime', { opt: true }),
  F('sold_at', 'datetime', { opt: true })];
const PLAN = [F('dry', 'boolean'), F('url', 'url'), F('steps', 'string[]'), F('request', 'object')];

// --- public reads: Browse (application token) and Marketplace Insights (restricted) ---

const itemRow = (o: Obj, state: string) => {
  const seller = str(at(o, 'seller', 'username'));
  return { external_id: str(o.legacyItemId) ?? str(o.itemId), item_id: str(o.itemId), title: str(o.title), url: str(o.itemWebUrl), state,
    price_cents: cents(at(o, state === 'sold' ? 'lastSoldPrice' : 'price', 'value')), currency: str(at(o, state === 'sold' ? 'lastSoldPrice' : 'price', 'currency')),
    seller_ref_hash: seller && refHash(seller), watchers: num(o.watchCount), listed_at: str(o.itemCreationDate), sold_at: str(o.lastSoldDate) };
};
const clean = <T extends Obj>(r: T) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as T;

async function search(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const q = str(a.q), cat = str(a.category_ids), sold = a.status === 'sold';
  if (!q && !cat) return refuse('missing_input', 'search needs q or category_ids');
  const www = `${H(c).www}/sch/i.html?${new URLSearchParams({ _nkw: q ?? '', ...(sold ? { LH_Sold: '1', LH_Complete: '1' } : {}) })}`;
  if (sold && !c.insights) return handoff(www, 'sold data needs Marketplace Insights, a Limited Release API this app is not approved for; the person reads it signed in');
  const token = await c.app_token(s, sold ? SCOPES.insights : SCOPES.public);
  if (!token) return handoff(www, 'no eBay application keyset is set');
  const p = new URLSearchParams({ ...(q ? { q } : {}), ...(cat ? { category_ids: cat } : {}), ...(str(a.filter) ? { filter: str(a.filter)! } : {}),
    limit: String(num(a.limit) ?? 50), offset: String(num(a.offset) ?? 0) });
  const r = await get(c, `${H(c).api}/buy/${sold ? 'marketplace_insights/v1_beta/item_sales' : 'browse/v1/item_summary'}/search?${p}`, token, s);
  if (!r.ok) return r;
  return classifyRead({ challenge: false, rows: list(at(r.body, sold ? 'itemSales' : 'itemSummaries')).map(o => clean(itemRow(o, sold ? 'sold' : 'live'))) }, M.search);
}

// Read one item: a legacy (all-digit) id goes through get_item_by_legacy_id. Not a kernel verb; search and the live check use it.
export async function readItem(c: Client, id: string, s: AbortSignal): Promise<AdapterResult> {
  const token = await c.app_token(s, SCOPES.public);
  if (!token) return handoff(`${H(c).www}/itm/${encodeURIComponent(id)}`, 'no eBay application keyset is set');
  const r = await get(c, /^\d+$/.test(id) ? `${H(c).api}/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${id}` : `${H(c).api}/buy/browse/v1/item/${encodeURIComponent(id)}`, token, s);
  if (!r.ok) return r;
  const out = classifyRead({ challenge: false, rows: [clean(itemRow(isObj(r.body) ? r.body : {}, 'live'))] }, M.search);
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// Browse search needs q or category_ids, so the storefront counts the seller's live items in one category.
// shortcut: active_count is one category (default 11450, Clothing, Shoes & Accessories), upgrade through the signed-in browser read.
// sold_count, joined_at and gross_cents have no API: served by the person's own signed-in browser session, designed and not built tonight.
async function readStorefront(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const user = str(a.username);
  if (!user || !/^[\w.\-]+$/.test(user)) return refuse('missing_input', 'read_storefront needs an eBay username');
  const token = await c.app_token(s, SCOPES.public);
  if (!token) return handoff(`${H(c).www}/str/${encodeURIComponent(user)}`, 'no eBay application keyset is set');
  const p = new URLSearchParams({ category_ids: str(a.category_ids) ?? '11450', filter: `sellers:{${user}}`, limit: '1' });
  const r = await get(c, `${H(c).api}/buy/browse/v1/item_summary/search?${p}`, token, s);
  if (!r.ok) return r;
  const first = list(at(r.body, 'itemSummaries'))[0];
  const out = classifyRead({ challenge: false, rows: [clean({ rating: num(at(first, 'seller', 'feedbackPercentage')), review_count: num(at(first, 'seller', 'feedbackScore')),
    active_count: num(at(r.body, 'total')) ?? 0 })] }, M.read_storefront);
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// --- public pages: the lane while no keyset exists (README.md, Terms) ---

// Matched on the title and the first 20k characters of a document; a match is blocked and the page is never parsed.
export const CHALLENGE = /just a moment|verify you are human|are you a robot|press (and|&) hold|unusual traffic|captcha|attention required|access denied|pardon our interruption|security measure/i;
const W = HOSTS.production.www;
// Search hosts in order: the next is tried only when one answers eBay's "Error Page" (runs/ebay-when-it-serves.md, regional sites).
// A regional host shows US items at a price converted into its own currency, so its rows carry that currency and converted: true.
export const PAGE_HOSTS = [
  { www: W, params: {}, converted: false },
  { www: 'https://www.ebay.co.uk', params: { _salic: '1', LH_LocatedIn: '1' }, converted: true }, // eBay's own filter: items located in the United States
] as const;
export const HOST_PAUSE_MS = 5000; // the one regional 403 came late in a run, so hosts are not tried back to back
// Owner observation, 2026-11-15: signed-out /sch/i.html?_nkw=<query>&_ipg=240 served 242 s-card cards (~4 MB); default ~60.
export const PAGE_SIZE = 240;
export const URLS = {
  search: (q: string, sold: boolean, host = 0) => `${PAGE_HOSTS[host]!.www}/sch/i.html?${new URLSearchParams({ _nkw: q, _ipg: String(PAGE_SIZE), ...PAGE_HOSTS[host]!.params, ...(sold ? { LH_Sold: '1', LH_Complete: '1' } : {}) })}`,
  item: (id: string) => `${W}/itm/${encodeURIComponent(id)}`,
  store: (user: string) => `${W}/usr/${encodeURIComponent(user)}`,
};

// One loaded document. challenge: the browser saw a bot check. Nothing on the page is intercepted (README.md, Public pages).
export type EbayPage = { status: number; html: string; challenge?: boolean };
// signed_in: the client carries the person's linked eBay sign-in; only sold search needs it.
export type PageClient = { signed_in: boolean; page(url: string, signal: AbortSignal): Promise<EbayPage> };
const changed = (what: string) => fail('page_changed', `${what} is not where the page kept it`, { do: 'author', missing: [what] });
const titleOf = (h: string) => h.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? '';
const text = (h: string, sep = '') => h.replace(/<[^>]*>/g, sep).replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').trim();
const SYMBOL: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR' };
// The shown low and high are preserved separately. An unsafe or fractional cent is not a price.
const pagePrice = (v: string | undefined) => {
  const matches = [...(v ?? '').replaceAll('&pound;', '£').replaceAll('&euro;', '€').matchAll(/([$£€])\s*([\d,]+(?:\.\d+)?)/g)];
  const amounts = matches.map(m => {
    const value = m[2]!.replaceAll(',', '');
    const [units, fraction = ''] = value.split('.');
    const c = /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(`${units}${fraction.padEnd(2, '0')}`) : NaN;
    return Number.isSafeInteger(c) ? c : undefined;
  });
  if (!matches.length || amounts.some(c => c === undefined)) return undefined;
  const currency = SYMBOL[matches[0]![1]!];
  if (matches.some(m => SYMBOL[m[1]!] !== currency)) return undefined;
  return { cents: amounts[0]!, currency, ...(amounts.length > 1 ? { high: amounts[1]! } : {}) };
};
const int = (v: string | undefined) => (v ? Number(v.replaceAll(',', '')) : undefined);
const isErrorPage = (p: EbayPage) => /^error page\b/i.test(titleOf(p.html));

async function loadPage(c: PageClient, url: string, s: AbortSignal): Promise<{ ok: true; html: string } | Failed> {
  return judge(await c.page(url, s), url);
}
function judge(p: EbayPage, url: string): { ok: true; html: string } | Failed {
  if (p.challenge || CHALLENGE.test(titleOf(p.html)) || CHALLENGE.test(p.html.slice(0, 20000))) return fail('blocked', 'eBay showed a check the person must pass', { do: 'pause_session', site });
  if (/^sign in or register\b/i.test(titleOf(p.html))) return relink(); // an anonymous visitor asking for sold listings gets this page
  if (p.status === 404) return fail('not_found', `the page answered 404`, { do: 'reconcile', searched: [url] });
  if (p.status === 429) return fail('rate_limited', 'the page answered 429', { do: 'retry_after', after_s: 60 });
  if (p.status >= 400 || isErrorPage(p)) return fail('blocked', `the page answered ${p.status}${isErrorPage(p) ? ', eBay\'s error page' : ''}`, { do: 'pause_session', site });
  return { ok: true, html: p.html };
}

// Result cards above the "Results matching fewer words" divider; the leading card without data-item-pos is eBay's placeholder.
// undefined: the results heading is gone, so the page changed.
type Yield = { rows: number; dropped: number; facts: number };
type PageRead = AdapterResult & { yield: Yield };
const pageYield = (rows: Obj[], dropped = 0): Yield => ({ rows: rows.length, dropped,
  facts: rows.reduce((n, row) => n + Object.values(row).filter(v => v !== undefined && v !== null && v !== '').length, 0) });

const cardAttr = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? text(match[1] ?? match[2] ?? '') : undefined;
};
// One pass through the card's tags. Nested carousel li nodes cannot end the outer card, and seller/footer text
// is never searched as a whole: facts come only from the named title, subtitle, attribute and footer rows.
function cardParts(card: string) {
  const parts = new Map<string, string[]>(), stack: { tag: string; classes: string[]; value: string }[] = [];
  let href: string | undefined, image: string | undefined, depth = 0;
  const wanted = new Set(['s-card__title', 's-card__subtitle', 's-card__attribute-row', 's-card__footer--row', 's-card__price']);
  for (const token of card.matchAll(/<[^>]*>|[^<]+/g)) {
    const raw = token[0];
    if (!raw.startsWith('<')) { for (const node of stack) if (node.classes.length) node.value += raw; continue; }
    const tag = raw.match(/^<\/?([\w-]+)/)?.[1]?.toLowerCase();
    if (!tag) continue;
    if (raw.startsWith('</')) {
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index >= 0) for (const node of stack.splice(index)) for (const cls of node.classes) {
        const value = cls === 's-card__title' ? text(node.value) : text(node.value, ' ').replace(/\s+/g, ' ').trim();
        parts.set(cls, [...(parts.get(cls) ?? []), value]);
      }
      if (tag === 'li' && --depth === 0) break;
      continue;
    }
    if (tag === 'li') depth++;
    const classes = (cardAttr(raw, 'class') ?? '').split(/\s+/);
    if (tag === 'a' && classes.includes('s-card__link') && href === undefined) href = cardAttr(raw, 'href');
    if (tag === 'img' && classes.includes('s-card__image') && image === undefined) image = cardAttr(raw, 'data-src') ?? cardAttr(raw, 'src');
    if (!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !raw.endsWith('/>'))
      stack.push({ tag, classes: classes.filter(cls => wanted.has(cls)), value: '' });
  }
  return { parts, href, image };
}

function searchRows(h: string, state: 'live' | 'sold', host: (typeof PAGE_HOSTS)[number]): { rows: Obj[]; dropped: number } | undefined {
  const cut = h.split('srp-river-answer--REWRITE_START')[0]!;
  const head = cut.match(/<h1[^>]*srp-results-heading[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  if (head === undefined) return undefined;
  if (/^0\s+results/.test(text(head)) || /No exact matches found/.test(cut)) return { rows: [], dropped: 0 };
  const li = [...cut.matchAll(/<li\b[^>]*class=["'][^"']*\bs-card\b[^"']*["'][^>]*>/g)];
  const rows: Obj[] = []; let dropped = 0, rank = 0;
  for (const [i, m] of li.entries()) {
    const { parts, href, image } = cardParts(cut.slice(m.index, li[i + 1]?.index));
    const title = parts.get('s-card__title')?.[0]?.replace(/Opens in a new window or tab/g, '').trim();
    if (title === 'Shop on eBay' && !cardAttr(m[0], 'data-item-pos')) continue;
    rank++;
    const id = cardAttr(m[0], 'data-listingid')?.match(/^\d+$/)?.[0] ?? href?.match(/\/itm\/(?:[^/?]+\/)?(\d+)/)?.[1];
    const price = pagePrice(parts.get('s-card__price')?.[0]);
    if (!id || price === undefined) { dropped++; continue; }
    const attr = parts.get('s-card__attribute-row') ?? [], footer = parts.get('s-card__footer--row') ?? [];
    const subtitles = parts.get('s-card__subtitle') ?? [];
    const facts = [...attr, ...footer, ...subtitles];
    const shipping = facts.find(t => /(?:shipping|delivery|postage)/i.test(t));
    const shippingPrice = pagePrice(shipping);
    const sizeBrand = subtitles.find(t => /^Size\s/.test(t))?.match(/^Size\s+(.+?)\s*·\s*(.+)$/);
    const count = (re: RegExp) => { const value = facts.map(t => t.match(re)?.[1]).find(v => v !== undefined); const n = int(value); return Number.isSafeInteger(n) ? n : undefined; };
    const date = (re: RegExp) => facts.map(t => t.match(re)?.[1]?.trim()).find(Boolean);
    const url = href && /^https?:\/\//.test(href) && URL.canParse(href) ? new URL(href) : undefined;
    const bids = count(/([\d,]+)\s+bids?\b/i);
    if (url) { url.search = ''; url.hash = ''; }
    rows.push(clean({ external_id: id, item_id: id, title, url: url?.href ?? URLS.item(id), state, price_cents: price.cents, currency: price.currency,
      price_high_cents: price.high, condition: subtitles.find(t => /^(?:Pre-Owned|New|Brand New|Used|Open box|For parts|Certified|Refurbished|Seller refurbished|Like New|Good|Very Good|Acceptable)/i.test(t)),
      size: sizeBrand?.[1], brand: sizeBrand?.[2], shipping_cents: shipping && /\bfree\b/i.test(shipping) ? 0 : shippingPrice?.cents,
      buying_format: bids !== undefined || facts.some(t => /\bauction\b/i.test(t)) ? 'Auction' : facts.some(t => /\bBuy It Now\b/i.test(t)) ? 'Buy It Now' : undefined,
      bid_count: bids, best_offer: facts.some(t => /\bbest offer\b/i.test(t)) || undefined,
      sold_count: count(/([\d,]+)\s+sold\b/i), watchers: count(/([\d,]+)\s+(?:watchers?|watching)\b/i),
      listed_at: date(/\bListed\s+(.+?)(?=\s*·|$)/i), sold_at: date(/(?:^|·\s*)Sold\s+(.+?)(?=\s*·|$)/i),
      ships_from: date(/^(?:Located in|from)\s+(.+)$/i), sponsored: footer.some(t => /\b(?:Sponsored|Promoted|derosnopS)\b/i.test(t)) || undefined,
      image_url: image, rank, converted: host.converted || undefined, host: new URL(host.www).host }));
  }
  return { rows, dropped };
}

// Sold search needs the person's sign-in on every host; the regional sites are not a way around it.
async function searchPage(c: PageClient, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const q = str(a.q), sold = a.status === 'sold';
  if (!q) return refuse('missing_input', 'the search page needs q');
  if (sold && !c.signed_in) return relink(); // eBay shows sold listings only to a signed-in person
  for (let i = 0; i < PAGE_HOSTS.length; i++) {
    if (i) await delay(HOST_PAUSE_MS, undefined, { signal: s });
    const url = URLS.search(q, sold, i), p = await c.page(url, s);
    if (isErrorPage(p) && i + 1 < PAGE_HOSTS.length) continue;
    const r = judge(p, url); if (!r.ok) return r;
    const parsed = searchRows(r.html, sold ? 'sold' : 'live', PAGE_HOSTS[i]!);
    return parsed ? { ...classifyRead({ challenge: false, rows: parsed.rows }, MP.search), yield: pageYield(parsed.rows, parsed.dropped) } as PageRead : changed('srp-results-heading');
  }
  return changed('PAGE_HOSTS'); // unreachable: the last host never continues
}

const ldJson = (h: string): Obj[] => [...h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => {
  try { const v: unknown = JSON.parse(m[1]!); return isObj(v) ? [v] : []; } catch (e) { return [{ '@type': 'unparsed', error: String(e) }]; } // kept so a missing Product names it
});
const AVAILABILITY: Record<string, 'live' | 'sold' | 'ended'> = { InStock: 'live', LimitedAvailability: 'live', InStoreOnly: 'live', OutOfStock: 'sold', SoldOut: 'sold', Discontinued: 'ended' };

// One listing from /itm/<id>: the schema.org Product eBay embeds. Not a kernel verb; search and the live check use it.
// shortcut: OutOfStock, SoldOut and Discontinued were not observed on a recorded page; record an ended listing to confirm them.
export async function readItemPage(c: PageClient, id: string, s: AbortSignal): Promise<AdapterResult> {
  if (!/^\d+$/.test(id)) return refuse('missing_input', 'an eBay item id is all digits');
  const url = URLS.item(id);
  const r = await loadPage(c, url, s); if (!r.ok) return r;
  const blocks = ldJson(r.html), prod = blocks.find(o => o['@type'] === 'Product');
  if (!prod) return changed(blocks.some(o => o['@type'] === 'unparsed') ? 'JSON-LD Product (a block did not parse)' : 'JSON-LD Product');
  const offer = isObj(prod.offers) ? prod.offers : list(prod.offers)[0];
  const state = AVAILABILITY[str(at(offer, 'availability'))?.replace(/^https?:\/\/schema\.org\//, '') ?? ''];
  if (!state) return changed('JSON-LD offers.availability');
  const out = classifyRead({ challenge: false, rows: [clean({ external_id: id, item_id: id, title: str(prod.name), url, state, price_cents: cents(str(at(offer, 'price'))),
    currency: str(at(offer, 'priceCurrency')), watchers: int(r.html.match(/x-watch-heart-btn-text">(\d[\d,]*)</)?.[1]) })] }, MP.search);
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

export async function stillUpPage(c: PageClient, id: string, s: AbortSignal): Promise<AdapterResult<{ state: 'live' | 'sold' | 'ended' | 'gone' }>> {
  const r = await readItemPage(c, id, s);
  if (!r.ok) return r.error.code === 'not_found' ? { ok: true, data: { state: 'gone' } } : r;
  const st = at(r.data, 'state');
  return st === 'live' || st === 'sold' || st === 'ended' ? { ok: true, data: { state: st } } : changed('state');
}

// The public seller profile /usr/<user>: feedback, items sold, followers, member since. Live listings are not counted there.
async function storefrontPage(c: PageClient, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const user = str(a.username);
  if (!user || !/^[\w.\-]+$/.test(user)) return refuse('missing_input', 'read_storefront needs an eBay username');
  const url = URLS.store(user);
  const r = await loadPage(c, url, s); if (!r.ok) return r;
  if (/this user was not found/i.test(r.html)) return fail('not_found', 'no eBay user by that name', { do: 'reconcile', searched: [url] });
  const card = r.html.match(/str-seller-card__store-stats[\s\S]*?(?=str-seller-card__buttons|$)/)?.[0];
  if (!card) return changed('str-seller-card__store-stats');
  const t = text(card, ' ').replace(/\s+/g, ' '), about = text(r.html.match(/str-about-description__seller-info[\s\S]*?<\/section>/)?.[0] ?? '', ' ').replace(/\s+/g, ' ');
  const fb = t.match(/([\d.]+)% positive feedback \(([\d,]+)\)/);
  const out = classifyRead({ challenge: false, rows: [clean({ rating: num(fb?.[1]), review_count: int(fb?.[2]), sold_count: int(t.match(/([\d,]+) items sold/)?.[1]),
    followers: int(t.match(/([\d,]+) followers?/)?.[1]), joined_at: about.match(/Member since: ([A-Z][a-z]{2} \d{1,2}, \d{4})/)?.[1] })] }, MP.read_storefront);
  return out.ok ? { ok: true, data: out.data[0] } : out;
}

// --- account reads: user token through token_ref ---

const LISTING_STATE = (offer: Obj): SnapListing['state'] => {
  if (str(offer.status) === 'UNPUBLISHED') return 'draft';
  const ls = str(at(offer, 'listing', 'listingStatus'));
  if (ls === 'ACTIVE') return 'live';
  return (num(at(offer, 'listing', 'soldQuantity')) ?? 0) > 0 ? 'sold' : 'ended';
};
// shortcut: the first 100 inventory items, upgrade by paging offset when a seller passes 100 SKUs.
async function readListings(c: Client, _a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const inv = await userGet(c, `${H(c).api}/sell/inventory/v1/inventory_item?limit=100&offset=0`, s);
  if (!inv.ok) return inv;
  const rows: Obj[] = [];
  for (const item of list(at(inv.body, 'inventoryItems'))) {
    const sku = str(item.sku);
    if (!sku) continue;
    const r = await userGet(c, `${H(c).api}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`, s);
    if (!r.ok) { if (r.error.code === 'not_found') continue; return r; }
    for (const o of list(at(r.body, 'offers')))
      rows.push(clean({ external_id: str(at(o, 'listing', 'listingId')) ?? str(o.offerId), sku, offer_id: str(o.offerId), title: str(at(item, 'product', 'title')),
        state: LISTING_STATE(o), price_cents: cents(at(o, 'pricingSummary', 'price', 'value')), quantity: num(o.availableQuantity) }));
  }
  return classifyRead({ challenge: false, rows }, M.read_listings);
}

const OFFER_STATE: Record<string, SnapOffer['state']> = { Pending: 'open', Active: 'open', Countered: 'countered', Accepted: 'accepted', Declined: 'declined', Expired: 'expired', Retracted: 'withdrawn' };
// Best Offers received come from Trading GetBestOffers; with no ItemID it returns every item's offers grouped per item.
async function readOffers(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const t = await c.user_token(s);
  if (!t.ok) return relink();
  const item = str(a.item_id);
  const r = await c.send(trading(c, 'GetBestOffers', t.token, `<BestOfferStatus>All</BestOfferStatus>${item && /^\d+$/.test(item) ? `<ItemID>${item}</ItemID>` : ''}`), s);
  const f = statusFail(c, r) ?? tradingFail(c, r);
  if (f) return f;
  const x = String(r.body), groups = tags(x, 'ItemBestOffers');
  const rows = (groups.length ? groups : [x]).flatMap(g => {
    const listing = tag(tags(g, 'Item')[0] ?? '', 'ItemID');
    return tags(g, 'BestOffer').map(b => {
      const buyer = tag(b, 'UserID');
      return clean({ external_id: tag(b, 'BestOfferID'), listing_external_id: listing, amount_cents: cents(tag(b, 'Price')), state: OFFER_STATE[tag(b, 'Status') ?? ''],
        buyer_ref_hash: buyer && refHash(buyer), expires_at: tag(b, 'ExpirationTime') });
    });
  });
  return classifyRead({ challenge: false, rows }, M.read_offers);
}

// Listings a seller may send an offer on (Negotiation find_eligible_items): the input make_offer needs.
export async function readEligible(c: Client, s: AbortSignal): Promise<AdapterResult<string[]>> {
  const r = await userGet(c, `${H(c).api}/sell/negotiation/v1/find_eligible_items?limit=200`, s);
  return r.ok ? { ok: true, data: list(at(r.body, 'eligibleItems')).flatMap(o => str(o.listingId) ?? []) } : r;
}

// item_cents is lineItemCost: the price the buyer agreed to, which is the accepted Best Offer amount when the sale came from an offer.
// shortcut: one row per order (first line item), upgrade when multi-item orders matter.
async function readOrders(c: Client, _a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const r = await userGet(c, `${H(c).api}/sell/fulfillment/v1/order?limit=50&offset=0`, s);
  if (!r.ok) return r;
  const rows = list(at(r.body, 'orders')).map(o => {
    const line = list(o.lineItems)[0], buyer = str(at(o, 'buyer', 'username'));
    return clean({ external_order_id: str(o.orderId), listing_external_id: str(at(line, 'legacyItemId')), state: str(o.orderFulfillmentStatus),
      price_cents: cents(at(o, 'pricingSummary', 'total', 'value')), item_cents: cents(at(line, 'lineItemCost', 'value')), created_at: str(o.creationDate),
      buyer_ref_hash: buyer && refHash(buyer) });
  });
  return classifyRead({ challenge: false, rows }, M.read_orders);
}

// Only who sent the latest message and when; the text never leaves this function.
async function readInbox(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  let me = str(a.username);
  if (!me) {
    const id = await userGet(c, `${H(c).apiz}/commerce/identity/v1/user/`, s);
    if (!id.ok) return id;
    me = str(at(id.body, 'username'));
  }
  const r = await userGet(c, `${H(c).api}/commerce/message/v1/conversation?conversation_type=FROM_MEMBERS&limit=25&offset=0`, s);
  if (!r.ok) return r;
  const rows = list(at(r.body, 'conversations')).map(o => clean({ external_id: str(at(o, 'latestMessage', 'messageId')), thread_ref: str(o.conversationId),
    listing_external_id: str(o.referenceType) === 'LISTING' ? str(o.referenceId) : undefined, at: str(at(o, 'latestMessage', 'createdDate')),
    from: str(at(o, 'latestMessage', 'senderUsername')) === me ? 'us' : 'buyer' }));
  return classifyRead({ challenge: false, rows }, M.read_inbox);
}

// traffic_report dates are YYYYMMDD in Pacific time; the default is the 7 days before today.
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d).replaceAll('-', '');
async function readStats(c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> {
  const now = c.now?.() ?? new Date();
  const from = str(a.from) ?? ymd(new Date(now.getTime() - 7 * 86400_000)), to = str(a.to) ?? ymd(now);
  const p = new URLSearchParams({ dimension: 'LISTING', metric: 'LISTING_VIEWS_TOTAL,LISTING_IMPRESSION_TOTAL,TRANSACTION', filter: `marketplace_ids:{EBAY_US},date_range:[${from}..${to}]` });
  const r = await userGet(c, `${H(c).api}/sell/analytics/v1/traffic_report?${p}`, s);
  if (!r.ok) return r;
  const keys = list(at(r.body, 'header', 'metrics')).map(m => str(m.key));
  const rows = list(at(r.body, 'records')).map(rec => {
    const v = (k: string) => num(at(list(rec.metricValues)[keys.indexOf(k)], 'value'));
    return clean({ external_id: str(at(list(rec.dimensionValues)[0], 'value')), views: v('LISTING_VIEWS_TOTAL'), impressions: v('LISTING_IMPRESSION_TOTAL'), transactions: v('TRANSACTION') });
  });
  return classifyRead({ challenge: false, rows }, M.read_stats);
}

// --- writes: dry plans of the documented requests ---

type Plan = { dry: true; url: string; steps: string[]; request: { calls: Req[] } };
const TOKEN = '<token from account.token_ref>'; // a plan never carries the real token
const INV = (c: Client) => `${H(c).api}/sell/inventory/v1`;
const json = (method: Req['method'], url: string, body?: unknown): Req => ({ method, url, headers: bearer(TOKEN), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const ints = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);
// Every price-setting write names the item's floor and never goes under it.
function underFloor(a: CallArgs, price: number | undefined): Failed | undefined {
  const floor = ints(a.floor_cents);
  if (price === undefined) return refuse('missing_input', 'a price-setting write needs a whole-cent price');
  if (floor === undefined) return refuse('missing_input', 'a price-setting write needs floor_cents');
  return price < floor ? refuse('price_under_floor', `${price} cents is under the floor of ${floor}`) : undefined;
}
const id = (a: CallArgs, k: string) => { const v = str(a[k]); return v && /^[\w.\-|]+$/.test(v) ? v : undefined; };

const WRITES: Record<'post' | 'revise' | 'end' | 'relist' | 'send_message' | 'answer_offer' | 'make_offer' | 'save', (c: Client, a: CallArgs) => Plan | Failed> = {
  post: (c, a) => {
    const sku = id(a, 'sku'), title = str(a.title), cat = id(a, 'category_id'), price = ints(a.price_cents), qty = ints(a.quantity) ?? 1;
    if (!sku || !title || !cat) return refuse('missing_input', 'post needs sku, title and category_id');
    const f = underFloor(a, price); if (f) return f;
    const pol = isObj(a.policies) ? a.policies : {};
    return { dry: true, url: `${H(c).www}/sh/lst/active`, steps: ['create or replace the inventory item', 'create the offer', 'publish the offer (the offerId from call 2)'],
      request: { calls: [
        json('PUT', `${INV(c)}/inventory_item/${sku}`, { availability: { shipToLocationAvailability: { quantity: qty } }, condition: str(a.condition) ?? 'USED_EXCELLENT',
          product: { title, ...(str(a.description) ? { description: str(a.description) } : {}), imageUrls: Array.isArray(a.image_urls) ? a.image_urls.filter(u => typeof u === 'string') : [] } }),
        json('POST', `${INV(c)}/offer`, { sku, marketplaceId: 'EBAY_US', format: 'FIXED_PRICE', availableQuantity: qty, categoryId: cat, pricingSummary: { price: money(price!) },
          listingPolicies: { fulfillmentPolicyId: str(pol.fulfillment), paymentPolicyId: str(pol.payment), returnPolicyId: str(pol.return) }, merchantLocationKey: str(a.location_key) }),
        json('POST', `${INV(c)}/offer/{offerId}/publish`),
      ] } };
  },
  revise: (c, a) => {
    const offer = id(a, 'offer_id'), sku = id(a, 'sku'), price = ints(a.price_cents);
    if (!offer || !sku) return refuse('missing_input', 'revise needs offer_id and sku');
    const f = underFloor(a, price); if (f) return f;
    return { dry: true, url: `${H(c).www}/sh/lst/active`, steps: ['update the price (and quantity when given) of one published offer'],
      request: { calls: [json('POST', `${INV(c)}/bulk_update_price_quantity`, { requests: [{ sku, offers: [{ offerId: offer, price: money(price!), ...(ints(a.quantity) ? { availableQuantity: ints(a.quantity) } : {}) }] }] })] } };
  },
  end: (c, a) => {
    const offer = id(a, 'offer_id'); if (!offer) return refuse('missing_input', 'end needs offer_id');
    return { dry: true, url: `${H(c).www}/sh/lst/active`, steps: ['withdraw the offer; the listing ends and the offer stays to relist'], request: { calls: [json('POST', `${INV(c)}/offer/${offer}/withdraw`)] } };
  },
  relist: (c, a) => {
    const offer = id(a, 'offer_id'); if (!offer) return refuse('missing_input', 'relist needs offer_id');
    return { dry: true, url: `${H(c).www}/sh/lst/ended`, steps: ['publish the withdrawn offer again'], request: { calls: [json('POST', `${INV(c)}/offer/${offer}/publish`)] } };
  },
  // A reply in an existing conversation only, so the plan never names the other member.
  send_message: (c, a) => {
    const conv = id(a, 'conversation_id'), text = str(a.text);
    if (!conv || !text) return refuse('missing_input', 'send_message needs conversation_id and text');
    return { dry: true, url: `${H(c).www}/sh/ovw`, steps: ['send the reply in the conversation'],
      request: { calls: [json('POST', `${H(c).api}/commerce/message/v1/send_message`, { conversationId: conv, messageText: text })] } };
  },
  answer_offer: (c, a) => {
    const offer = id(a, 'offer_id'), item = id(a, 'item_id'), action = str(a.action), sent = str(a.received_at);
    if (!offer || !item || !sent || !['accept', 'decline', 'counter'].includes(action ?? '')) return refuse('missing_input', 'answer_offer needs offer_id, item_id, received_at and accept, decline or counter');
    const ends = offerExpiresAt('ebay', 'buyer', new Date(sent)) as Date | null;
    const now = a.now ? new Date(String(a.now)) : (c.now?.() ?? new Date());
    if (ends && now >= ends) return refuse('offer_expired', `the offer ended at ${ends.toISOString()}`);
    if (action !== 'decline') { const f = underFloor(a, ints(a.amount_cents)); if (f) return f; }
    const verb = action === 'accept' ? 'Accept' : action === 'decline' ? 'Decline' : 'Counter';
    const counter = action === 'counter' ? `<CounterOfferPrice currencyID="USD">${(ints(a.amount_cents)! / 100).toFixed(2)}</CounterOfferPrice><CounterOfferQuantity>1</CounterOfferQuantity>` : '';
    return { dry: true, url: `${H(c).www}/sh/lst/active`, steps: [`${verb.toLowerCase()} the Best Offer`],
      request: { calls: [trading(c, 'RespondToBestOffer', TOKEN, `<ItemID>${esc(item)}</ItemID><BestOfferID>${esc(offer)}</BestOfferID><Action>${verb}</Action>${counter}`)] } };
  },
  make_offer: (c, a) => {
    const listing = id(a, 'listing_external_id'); if (!listing) return refuse('missing_input', 'make_offer needs listing_external_id');
    // spec/sites.mjs defaults last_sent_at to null, which tsc reads as the only allowed type
    const r = (sellerOffer as unknown as (site: string, o: Record<string, unknown>) => unknown)('ebay', { list_cents: Number(a.list_cents), offer_cents: Number(a.offer_cents),
      lowest_cents: a.lowest_cents === undefined ? undefined : Number(a.lowest_cents), last_sent_at: a.last_sent_at ? new Date(String(a.last_sent_at)) : null,
      now: a.now ? new Date(String(a.now)) : (c.now?.() ?? new Date()), promised_elsewhere: a.promised_elsewhere === true }) as { ok: boolean; why?: string };
    if (!r.ok) return refuse('seller_offer', r.why ?? 'refused');
    const f = underFloor(a, ints(a.offer_cents)); if (f) return f;
    const HOURS_A_DAY = 24;
    const days = (fact('offer.seller.expires_h', 'ebay') as number) / HOURS_A_DAY;
    return { dry: true, url: `${H(c).www}/sh/lst/active`, steps: ['send the offer to every interested buyer of the listing'],
      request: { calls: [json('POST', `${H(c).api}/sell/negotiation/v1/send_offer_to_interested_buyers`, { allowCounterOffer: false, offerDuration: { unit: 'DAY', value: days },
        offeredItems: [{ listingId: listing, price: money(ints(a.offer_cents)!), quantity: 1 }] })] } };
  },
  save: (c, a) => {
    const item = id(a, 'item_id'); if (!item || !/^\d+$/.test(item)) return refuse('missing_input', 'save needs a legacy item_id');
    return { dry: true, url: `${H(c).www}/mye/myebay/watchlist`, steps: ['add the item to the watchlist'], request: { calls: [trading(c, 'AddToWatchList', TOKEN, `<ItemID>${item}</ItemID>`)] } };
  },
};
// A sent write is designed, not built tonight: dry:false checks the link, then hands the person the page.
const write = (verb: keyof typeof WRITES) => async (c: Client, a: CallArgs, s: AbortSignal): Promise<AdapterResult> => {
  const plan = WRITES[verb](c, a);
  if ('ok' in plan) return plan;
  if (a.dry !== false) return { ok: true, data: plan };
  const t = await c.user_token(s);
  return t.ok ? handoff(plan.url, 'sending eBay writes is designed, not built; the dry plan is the request') : relink();
};

// Promoted listings: a lever the person can switch on. Always a plan; there is no path that sends it.
export function promotedProposal(c: Client, o: { name: string; listing_ids: string[]; bid_pct: number }): Plan {
  return { dry: true, url: `${H(c).www}/sh/mkt/campaigns`, steps: ['the person reviews and creates the campaign themselves'],
    request: { calls: [json('POST', `${H(c).api}/sell/marketing/v1/ad_campaign`, { campaignName: o.name, marketplaceId: 'EBAY_US', fundingStrategy: { fundingModel: 'COST_PER_SALE', bidPercentage: o.bid_pct.toFixed(1) },
      startDate: new Date(0).toISOString() }), json('POST', `${H(c).api}/sell/marketing/v1/ad_campaign/{campaign_id}/bulk_create_ads_by_listing_id`,
      { requests: o.listing_ids.map(listingId => ({ listingId, bidPercentage: o.bid_pct.toFixed(1) })) })] } };
}

export const M = {
  search: manifest('search', { session: 'public', version: '1.0.0', fields: ITEM, input: { q: 'string', category_ids: 'string', filter: 'string', status: 'string', limit: 'number', offset: 'number' },
    fixture_ref: 'search.json', daily: 5000 }),
  read_storefront: manifest('read_storefront', { session: 'public', version: '0.1.0', input: { username: 'string', category_ids: 'string' }, fixture_ref: 'search.json', daily: 5000,
    fields: [F('rating', 'number', { opt: true }), F('review_count', 'number', { opt: true }), F('active_count', 'number'),
      F('sold_count', 'number', { s: true, opt: true }), F('gross_cents', 'cents', { s: true, opt: true })] }),
  read_listings: manifest('read_listings', { session: 'signed_in', version: '0.1.0', input: {}, fixture_ref: 'offers.json', daily: 2_000_000,
    fields: [F('external_id', 'string', { s: true }), F('sku', 'string', { s: true }), F('offer_id', 'string', { s: true }), F('title', 'string', { s: true, opt: true }),
      F('state', 'string', { s: true }), F('price_cents', 'cents', { s: true }), F('quantity', 'number', { s: true, opt: true })] }),
  read_offers: manifest('read_offers', { session: 'signed_in', version: '0.1.0', input: { item_id: 'string' }, fixture_ref: 'best-offers.xml', daily: 5000,
    fields: [F('external_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('amount_cents', 'cents', { s: true }), F('state', 'string', { s: true }),
      F('buyer_ref_hash', 'string', { s: true, opt: true }), F('expires_at', 'datetime', { s: true, opt: true })] }),
  read_orders: manifest('read_orders', { session: 'signed_in', version: '0.1.0', input: {}, fixture_ref: 'orders.json', daily: 100_000,
    fields: [F('external_order_id', 'string', { s: true }), F('listing_external_id', 'string', { s: true }), F('state', 'string', { s: true }), F('price_cents', 'cents', { s: true }),
      F('item_cents', 'cents', { s: true, opt: true }), F('created_at', 'datetime', { s: true, opt: true }), F('buyer_ref_hash', 'string', { s: true, opt: true })] }),
  // The Commerce Message API's call limit was not found on the limits page; read at the slowest documented pace.
  read_inbox: manifest('read_inbox', { session: 'signed_in', version: '0.1.0', input: { username: 'string' }, fixture_ref: 'conversations.json', daily: 5000,
    fields: [F('external_id', 'string', { s: true }), F('thread_ref', 'string', { s: true }), F('listing_external_id', 'string', { s: true, opt: true }), F('at', 'datetime', { s: true }), F('from', 'string', { s: true })] }),
  read_stats: manifest('read_stats', { session: 'signed_in', version: '0.1.0', input: { from: 'string', to: 'string' }, fixture_ref: 'traffic.json', daily: 5000,
    fields: [F('external_id', 'string', { s: true }), F('views', 'number', { s: true }), F('impressions', 'number', { s: true, opt: true }), F('transactions', 'number', { s: true, opt: true })] }),
  ...Object.fromEntries(Object.keys(WRITES).map(verb => [verb, manifest(verb as Verb, { session: 'signed_in', version: '0.1.0', fields: PLAN, input: {},
    fixture_ref: '(none: dry plan, no write sent)', per_minute: 6 })])) as Record<keyof typeof WRITES, Manifest>,
} satisfies Record<Verb, Manifest>;

const RUN: Record<Verb, (c: Client, a: CallArgs, s: AbortSignal) => Promise<AdapterResult>> = {
  search, read_storefront: readStorefront, read_listings: readListings, read_offers: readOffers, read_orders: readOrders, read_inbox: readInbox, read_stats: readStats,
  post: write('post'), revise: write('revise'), end: write('end'), relist: write('relist'), send_message: write('send_message'),
  answer_offer: write('answer_offer'), make_offer: write('make_offer'), save: write('save'),
};

export function ebayAdapters(client: Client): Adapter[] {
  return (Object.keys(RUN) as Verb[]).map(verb => ({ route_id: `ebay.${verb}.endpoint`, manifest: M[verb], run: (a, s) => RUN[verb](client, a, s) }));
}

// The page lane, by Nate's decision of 2026-11-15 ("read ebay pages anyway", README.md, Public pages); the API replaces it the day keys exist.
// Register after ebayAdapters: the endpoint answers no_route without a keyset and the kernel falls to the page route.
const page = (verb: 'search' | 'read_storefront', o: Parameters<typeof manifest>[1]): Manifest => ({ ...manifest(verb, { ...o, per_minute: 6 }), route_kind: 'page' });
export const MP = {
  search: page('search', { session: 'public', version: '1.0.0', input: { q: 'string', status: 'string' }, fixture_ref: 'page-search.html',
    fields: [...ITEM.map(f => (f.name === 'sold_at' ? { ...f, needs_session: true } : f)), F('converted', 'boolean', { opt: true }), F('host', 'string', { opt: true }),
      ...['condition', 'size', 'brand', 'ships_from'].map(name => F(name, 'string', { opt: true })), F('shipping_cents', 'cents', { opt: true }), F('image_url', 'url', { opt: true }),
      // Agent proposal: these page facts need canon rows; WORKER_REPORT.md lists their meaning for the lead.
      F('price_high_cents', 'cents', { opt: true }), F('buying_format', 'string', { opt: true }), F('bid_count', 'number', { opt: true }),
      F('best_offer', 'boolean', { opt: true }), F('sold_count', 'number', { opt: true }), F('sponsored', 'boolean', { opt: true }), F('rank', 'number', { opt: true })] }),
  read_storefront: page('read_storefront', { session: 'public', version: '0.1.0', input: { username: 'string' }, fixture_ref: 'page-store.html',
    fields: [F('rating', 'number', { opt: true }), F('review_count', 'number', { opt: true }), F('active_count', 'number', { opt: true }), F('sold_count', 'number', { opt: true }),
      F('followers', 'number', { opt: true }), F('joined_at', 'string', { opt: true })] }),
};
export function ebayPageAdapters(c: PageClient): Adapter[] {
  return [
    { route_id: 'ebay.search.page', manifest: MP.search, run: async (a, s) => {
      const read = await searchPage(c, a, s);
      return 'yield' in read ? read : { ...read, yield: pageYield([]) };
    } },
    { route_id: 'ebay.read_storefront.page', manifest: MP.read_storefront, run: (a, s) => storefrontPage(c, a, s) },
  ];
}

// --- the watch snapshot (app/src/edge/events/event.ts): a section that was not read stays undefined ---

export function toWatchSnapshot(o: { account_id: string; user_id: string; taken_at: string; listings?: Obj[]; offers?: Obj[]; messages?: Obj[]; orders?: Obj[] }): Snapshot {
  const listings = o.listings?.flatMap((r): SnapListing[] => typeof r.external_id === 'string' && typeof r.price_cents === 'number' && r.state
    ? [{ external_id: r.external_id, state: r.state as SnapListing['state'], price_cents: r.price_cents,
      ...(num(r.views) !== undefined ? { views: num(r.views) } : {}), ...(num(r.watchers) !== undefined ? { watchers: num(r.watchers) } : {}) }] : []);
  const signed = !!(o.offers || o.messages || o.orders);
  return { site, account_id: o.account_id, user_id: o.user_id, taken_at: o.taken_at, route: signed ? 'signed_in' : 'public',
    ...(listings ? { listings } : {}),
    ...(o.offers ? { offers: o.offers.map((r): SnapOffer => ({ external_id: String(r.external_id), listing_external_id: String(r.listing_external_id), amount_cents: Number(r.amount_cents),
      state: r.state as SnapOffer['state'], ...(r.buyer_ref_hash ? { buyer_ref_hash: String(r.buyer_ref_hash) } : {}) })) } : {}),
    ...(o.messages ? { messages: o.messages.map((r): SnapMessage => ({ external_id: String(r.external_id), thread_ref: String(r.thread_ref), at: String(r.at),
      from: r.from === 'us' ? 'us' : 'buyer', ...(r.listing_external_id ? { listing_external_id: String(r.listing_external_id) } : {}) })) } : {}),
    ...(o.orders ? { orders: o.orders.map((r): SnapOrder => ({ external_order_id: String(r.external_order_id), listing_external_id: String(r.listing_external_id),
      state: String(r.state), price_cents: Number(r.price_cents) })) } : {}),
  };
}

// --- push against the watcher: seconds from the sale to our event, push versus a poll every poll_interval_s ---

// The sale time is the Fulfillment order's creationDate; the push times are the notification's eventDate and when our webhook took it.
// A poller finds the sale on its next tick: worst case one interval, mean half of one.
export function pushLatency(m: { order_created_at: string; push_event_at: string; push_received_at: string; poll_interval_s: number }) {
  const t = (v: string) => Date.parse(v) / 1000, sale = t(m.order_created_at);
  const sale_to_event_s = t(m.push_event_at) - sale, sale_to_push_s = t(m.push_received_at) - sale, watcher_mean_s = m.poll_interval_s / 2;
  return { sale_to_event_s, sale_to_push_s, watcher_worst_s: m.poll_interval_s, watcher_mean_s, push_wins_by_s: watcher_mean_s - sale_to_push_s };
}
