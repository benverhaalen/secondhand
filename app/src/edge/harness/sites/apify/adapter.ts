// Apify as a gap-filling search source (README.md beside this file). Server only. Runs two public Apify actors through the
// run-sync-get-dataset-items endpoint over an injected `send`: eBay listings (automation-lab/ebay-scraper) and Facebook
// Marketplace (apify/facebook-marketplace-scraper), which has no working reader of our own. Neither actor returns a sold
// price or a sold date (probed 2026-11-15), so this lane fills search only, never valuation's sold comps.
// The token is the caller's: it goes in the Authorization header only, never a URL, and is scrubbed from every message.
import type { Log } from '../../../../../../log/index.js';
import type { Row } from '../../../intel/public/readers.ts';
import type { CallArgs, ErrorCode, HintFor, Verb } from '../../protocol.ts';

export const API = 'https://api.apify.com/v2';
export const ACTORS = { ebay: 'automation-lab~ebay-scraper', facebook: 'apify~facebook-marketplace-scraper' } as const;
export type Lane = keyof typeof ACTORS;
export const ROUTE_IDS = { ebay: 'apify.ebay.search', facebook: 'apify.facebook.search' } as const;
// Spend per call stays at a few cents: 8 eBay items ≈ $0.029, 8 Facebook items ≈ $0.050, 4 with details ≈ $0.050 (FREE tier
// prices, 2026-11-15). maxTotalChargeUsd makes Apify itself stop the run at the cap whatever the pricing model.
export const MAX_ITEMS = 8;
export const MAX_DETAILS = 4;
export const MAX_CHARGE_USD = 0.05;
export const RUN_TIMEOUT_S = 60;          // the actor run's own limit, sent to Apify
const DEADLINE_MS = 75_000;                // ours: the run limit plus the dataset download
const HOME = 'https://apify.com';

export type Reply = { status: number; headers: { get(name: string): string | null }; text(): Promise<string> };
export type Send = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Reply>;

type ApifyHint = { [C in ErrorCode]: C extends 'blocked' ? { do: 'pause_session'; site: 'apify' } : C extends 'auth_expired' ? { do: 'relink'; site: 'apify' } : HintFor[C] };
export type ApifyError = { [C in ErrorCode]: { code: C; message: string; hint: ApifyHint[C] } }[ErrorCode];
export type ApifyFail = { ok: false; error: ApifyError };

// The canonical search row (readers.ts) plus where it came from and the terms it carries.
export type ApifyRow = Pick<Row, 'title' | 'currency' | 'condition' | 'listed_at' | 'image_url' | 'sold' | 'sold_date'> & {
  id: string; price_cents: number; url: string;
  via: 'apify';
  actor: (typeof ACTORS)[Lane];
  may_model: false;               // scraped through a third party: cited, never trained on
  use_scope: 'hackathon_demo';    // Apify's and the marketplaces' terms are not cleared past the demo
};
export type SearchData = { rows: ApifyRow[]; dropped: number; total: number };
export type ApifyResult = { ok: true; data: SearchData } | ApifyFail;

// --- narrowing at the boundary ---

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x : undefined);
export function cents(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return undefined;
  const c = Math.round(v * 100);
  return Number.isSafeInteger(c) && Math.abs(v * 100 - c) < 1e-6 ? c : undefined;
}
const decimal = (v: unknown) => (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? cents(Number(v)) : undefined);

// Each lane: the core fields a recording always had, and how one item becomes a row (undefined: dropped).
const CORE: Record<Lane, string[][]> = { ebay: [['itemId'], ['price']], facebook: [['id'], ['listing_price', 'listingPrice']] };
function toRow(lane: Lane, x: Obj): Omit<ApifyRow, 'via' | 'actor' | 'may_model' | 'use_scope'> | undefined {
  if (lane === 'ebay') {
    const id = str(x.itemId), price_cents = cents(x.price), url = str(x.url);
    if (!id || price_cents === undefined || !url) return undefined;
    return { id: `ebay:${id}`, price_cents, url, title: str(x.title), currency: str(x.currency), condition: str(x.condition), image_url: str(x.thumbnail) };
  }
  const p = isObj(x.listingPrice) ? x.listingPrice : isObj(x.listing_price) ? x.listing_price : {};
  const id = str(x.id), price_cents = decimal(p.amount), url = str(x.itemUrl) ?? str(x.listingUrl);
  if (!id || price_cents === undefined || !url) return undefined;
  const photo = isObj(x.primary_listing_photo) ? x.primary_listing_photo.photo_image_url
    : isObj(x.primaryListingPhoto) && isObj(x.primaryListingPhoto.listing_image) ? x.primaryListingPhoto.listing_image.uri : undefined;
  const listed = str(x.timestamp);
  return { id: `facebook:${id}`, price_cents, url, title: str(x.listingTitle) ?? str(x.marketplace_listing_title),
    currency: str(p.currency), condition: str(x.condition), image_url: str(photo),
    ...(listed && Number.isFinite(Date.parse(listed)) ? { listed_at: listed } : {}),
    ...(x.is_sold === true || x.isSold === true ? { sold: true as const } : {}) };
}

// --- the client ---

export function createApify({ token, send = (url, init) => fetch(url, init), log }: { token: string | undefined; send?: Send; log: Log }) {
  const chains: Record<Lane, Promise<unknown>> = { ebay: Promise.resolve(), facebook: Promise.resolve() };
  const scrub = (s: string) => (token ? s.split(token).join('[redacted]') : s).slice(0, 300);
  const fail = <C extends ErrorCode>(code: C, message: string, hint: ApifyHint[C]): ApifyFail => ({ ok: false, error: { code, message: scrub(message), hint } as ApifyError });
  const blocked = (m: string) => fail('blocked', m, { do: 'pause_session', site: 'apify' });

  function statusFail(r: Reply, text: string): ApifyFail | undefined {
    if (r.status === 200 || r.status === 201) return undefined;
    let type = '', msg = '';
    try { const e = (JSON.parse(text) as Obj).error; if (isObj(e)) { type = str(e.type) ?? ''; msg = str(e.message) ?? ''; } } catch { /* a non-JSON error body: the status alone decides */ }
    const m = `apify ${r.status} ${type}: ${msg || text}`;
    if (r.status === 402 || /payment|credit|usage|limit-reached|quota/i.test(`${type} ${msg}`)) return fail('policy_refused', m, { do: 'raise_decision', kind: 'apify_spend' });
    if (r.status === 401 || r.status === 403) return fail('auth_expired', m, { do: 'relink', site: 'apify' });
    if (r.status === 408 || type === 'run-timeout-exceeded') return fail('rate_limited', m, { do: 'retry_after', after_s: 30 });
    if (r.status === 429) { const a = Number(r.headers.get('retry-after')); return fail('rate_limited', m, { do: 'retry_after', after_s: Number.isFinite(a) && a > 0 ? a : 30 }); }
    if (/run-failed|aborted|canceled/.test(type) || r.status >= 500) return blocked(m);
    if (type === 'invalid-input') return fail('page_changed', m, { do: 'author', missing: ['input'] });
    if (r.status === 404) return fail('page_changed', m, { do: 'author', missing: ['actor'] });
    return blocked(m);
  }

  function parse(lane: Lane, text: string): ApifyResult {
    let body: unknown;
    try { body = JSON.parse(text); } catch { return fail('page_changed', `the dataset is not JSON: ${text}`, { do: 'author', missing: ['dataset'] }); }
    if (!Array.isArray(body)) return fail('page_changed', 'the dataset is not a list', { do: 'author', missing: ['dataset'] });
    const items = body.filter(isObj);
    const errors = items.filter(x => 'error' in x && !('id' in x) && !('itemId' in x));
    if (body.length > 0 && errors.length === body.length) return blocked(`the actor returned only errors: ${errors.map(e => String(e.error)).join('; ')}`);
    const real = items.filter(x => !errors.includes(x));
    const missing = CORE[lane].filter(alts => real.length > 0 && real.every(x => alts.every(k => !(k in x)))).map(alts => alts[0]);
    if (missing.length) return fail('page_changed', `items lack ${missing.join(', ')}`, { do: 'author', missing });
    const rows: ApifyRow[] = [];
    for (const x of real) {
      const row = toRow(lane, x);
      if (row) rows.push({ ...row, via: 'apify', actor: ACTORS[lane], may_model: false, use_scope: 'hackathon_demo' });
    }
    return { ok: true, data: { rows, dropped: body.length - rows.length, total: body.length } };
  }

  async function once(lane: Lane, input: Obj, items: number, signal: AbortSignal): Promise<ApifyResult> {
    const q = new URLSearchParams({ timeout: String(RUN_TIMEOUT_S), maxItems: String(items), maxTotalChargeUsd: String(MAX_CHARGE_USD), format: 'json' });
    const url = `${API}/acts/${ACTORS[lane]}/run-sync-get-dataset-items?${q}`;
    return log.call('http', `apify.${lane}.search`, { lane, items }, async (): Promise<ApifyResult> => {
      try {
        const r = await send(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(input), signal: AbortSignal.any([signal, AbortSignal.timeout(DEADLINE_MS)]) });
        const text = await r.text();
        return statusFail(r, text) ?? parse(lane, text);
      } catch (e) {
        if (signal.aborted) throw signal.reason; // the caller's own cancel, never carrying the token
        const m = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        return fail('rate_limited', `apify ${lane} did not answer: ${m}`, { do: 'retry_after', after_s: 30 });
      }
    }, o => ({ result: o.ok ? { ok: true, rows: o.data.rows.length, dropped: o.data.dropped } : { ok: false, code: o.error.code, message: o.error.message } }));
  }

  function search(lane: Lane, a: CallArgs, signal: AbortSignal): Promise<ApifyResult> {
    if (!token) return Promise.resolve(fail('auth_expired', 'no Apify token was passed', { do: 'relink', site: 'apify' }));
    const q = str(a.q)?.trim(), city = a.city;
    if (!q || (lane === 'facebook' && !(typeof city === 'string' && /^[a-z0-9-]+$/.test(city))))
      return Promise.resolve(fail('policy_refused', lane === 'facebook' ? 'Facebook search needs q and a city slug such as chicago' : 'search needs q', { do: 'raise_decision', kind: 'missing_input' }));
    const details = lane === 'facebook' && a.details === true;
    const items = Math.min(typeof a.limit === 'number' && a.limit > 0 ? Math.floor(a.limit) : MAX_ITEMS, details ? MAX_DETAILS : MAX_ITEMS);
    const input: Obj = lane === 'ebay'
      ? { searchQueries: [q], marketplace: 'US', maxProductsPerSearch: items, maxSearchPages: 1 }
      : { startUrls: [{ url: `https://www.facebook.com/marketplace/${city}/search?query=${encodeURIComponent(q)}` }], resultsLimit: items, includeListingDetails: details };
    const run = chains[lane].then(() => once(lane, input, items, signal));
    chains[lane] = Promise.allSettled([run]); // one run per actor at a time; the next waits for this one to settle
    return run;
  }

  const call = (verb: Verb, a: CallArgs & { lane?: Lane }, signal: AbortSignal): Promise<ApifyResult> => verb === 'search' && (a.lane === 'ebay' || a.lane === 'facebook')
    ? search(a.lane, a, signal)
    : Promise.resolve(fail('no_route', `the Apify lane is search-only with lane ebay or facebook; ${verb} has no route`, { do: 'handoff', url: HOME }));

  return { route_ids: ROUTE_IDS, search, call };
}
