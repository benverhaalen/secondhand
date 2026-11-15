// Dupe.com as a search-only source (README.md beside this file). Server only. Speaks MCP Streamable HTTP to Dupe's published
// server over an injected `send` (fetch in live.ts, recordings in the tests). Never Dupe's web pages, never its internal APIs.
// Dupe is not a `Site`: adding it to SITES ripples into 49 Record<Site, …> files, so this module stands alone and the search
// plan calls it directly. Its errors use the protocol's codes and hints, with `site: 'dupe'` where a hint names a site.
import { createHash } from 'node:crypto';

import type { Log } from '../../../../../../log/index.js';
import type { Row } from '../../../intel/public/readers.ts';
import type { CallArgs, ErrorCode, HintFor, Verb } from '../../protocol.ts';

export const ENDPOINT = 'https://mcp.dupe.com/mcp';
export const ROUTE_ID = 'dupe.search.api';
export const TOOL = 'search_products_by_text';
const HOME = 'https://dupe.com';
const PROTOCOL = '2025-06-18';
const CLIENT = { name: 'secondhand-client', version: '0.1' }; // agent.txt asks for an honest User-Agent; generic, no contact
// Dupe publishes no rate limit, so this is ours and conservative: one search at a time, starts at least 3 s apart (at most 20 a minute).
export const MIN_GAP_MS = 3000;
// The tool's search_category enum as listed by tools/list on 2026-11-15.
export const CATEGORIES = ['all', 'Fashion', 'Furniture', 'Home Decor', 'Electronics', 'Beauty', 'Toys', 'Sporting', 'Pets',
  'Baby & Kids', 'Auto', 'Food', 'Hardware', 'Office', 'Media', 'Other'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Reply = { status: number; headers: { get(name: string): string | null }; text(): Promise<string> };
export type Send = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Reply>;

type DupeHint = { [C in ErrorCode]: C extends 'blocked' ? { do: 'pause_session'; site: 'dupe' } : HintFor[C] };
export type DupeError = { [C in ErrorCode]: { code: C; message: string; hint: DupeHint[C] } }[ErrorCode];
export type DupeFail = { ok: false; error: DupeError };
const fail = <C extends ErrorCode>(code: C, message: string, hint: DupeHint[C]): DupeFail => ({ ok: false, error: { code, message, hint } as DupeError });
const changed = (message: string) => fail('page_changed', message, { do: 'author', missing: [TOOL] });
const blocked = (message: string) => fail('blocked', message, { do: 'pause_session', site: 'dupe' });

// The canonical search row (readers.ts) plus Dupe's terms carried on every row.
export type DupeRow = Required<Pick<Row, 'id' | 'title' | 'price_cents' | 'currency' | 'url'>> & Pick<Row, 'image_url'> & {
  source_site: string;        // the marketplace or retailer as Dupe names it, verbatim ("Poshmark", "eBay", "Ebay")
  secondhand: boolean;        // Dupe's own flag, as given
  commercial_link: true;      // terms §13: the links are commercially compensated and that must be disclosed
  attribution: 'Dupe.com';    // terms §13: attribute results to Dupe.com where shown
  keep_until: string;         // terms §13: no storing past what Dupe permits; none is published, so the request time
};
export type SearchData = { rows: DupeRow[]; dropped: number; total: number; keep_until: string };
export type DupeResult = { ok: true; data: SearchData } | DupeFail;

// --- narrowing at the boundary ---

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown) => (typeof x === 'string' && x.trim() ? x : undefined);
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
// A price that is not a safe whole number of cents is not a price we can hold.
export function cents(v: unknown): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return undefined;
  const c = Math.round(v * 100);
  return Number.isSafeInteger(c) && Math.abs(v * 100 - c) < 1e-6 ? c : undefined;
}

// A reply is JSON or an SSE stream of `data:` lines; the JSON-RPC message is the one with a result or an error.
function message(text: string): Obj | undefined {
  const parts = text.trimStart().startsWith('{') ? [text] : text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5));
  for (const p of parts) { try { const m: unknown = JSON.parse(p); if (isObj(m) && ('result' in m || 'error' in m)) return m; } catch { continue; /* a data line that is not JSON is not the message; the caller maps none found to page_changed */ } }
  return undefined;
}

function afterS(v: string | null, now: number): number {
  if (!v) return 60;
  if (/^\d+$/.test(v.trim())) return Number(v.trim());
  const at = Date.parse(v);
  return Number.isNaN(at) ? 60 : Math.max(1, Math.ceil((at - now) / 1000));
}

function statusFail(r: Reply, now: number): DupeFail | undefined {
  if (r.status === 429 || r.status === 503) return fail('rate_limited', `Dupe answered ${r.status}`, { do: 'retry_after', after_s: afterS(r.headers.get('retry-after'), now) });
  // The server is published as keyless; a demand for credentials means that changed, and there is no account here to relink.
  if (r.status === 401 || (r.status === 403 && r.headers.get('www-authenticate'))) return fail('no_route', `Dupe asked for credentials (${r.status})`, { do: 'handoff', url: HOME });
  if (r.status >= 400) return blocked(`Dupe answered ${r.status}`);
  if (/html/i.test(r.headers.get('content-type') ?? '')) return blocked('Dupe answered with a page, not MCP');
  return undefined;
}

// The search tool's input schema as observed; anything else means the tool changed under us.
function schemaOk(tools: unknown): boolean {
  const t = list(tools).find(x => isObj(x) && x.name === TOOL);
  const sc = isObj(t) ? t.inputSchema : undefined;
  if (!isObj(sc) || !isObj(sc.properties)) return false;
  const p = sc.properties, req = list(sc.required);
  const type = (k: string) => (isObj(p[k]) ? (p[k] as Obj).type : undefined);
  const en = isObj(p.search_category) ? list(p.search_category.enum) : [];
  return req.length === 3 && ['query', 'refresh', 'search_category'].every(k => req.includes(k))
    && type('query') === 'string' && type('refresh') === 'boolean' && type('search_category') === 'string'
    && CATEGORIES.every(c => en.includes(c));
}

function toRow(p: unknown, keep_until: string): DupeRow | undefined {
  if (!isObj(p) || !isObj(p.price)) return undefined;
  const title = str(p.title), url = str(p.link), source_site = str(p.source), currency = str(p.price.currency), price_cents = cents(p.price.extracted_value);
  if (!title || !url || !url.startsWith(`${HOME}/`) || !source_site || !currency || price_cents === undefined) return undefined;
  const image = str(p.thumbnail);
  // The redirect token is the only per-row key Dupe gives (textGridHash is shared by a whole search).
  const id = `dupe-${createHash('sha256').update(new URL(url).pathname).digest('hex').slice(0, 12)}`;
  return { id, title, price_cents, currency, url, ...(image?.startsWith('https://') ? { image_url: image } : {}),
    source_site, secondhand: p.secondhand === true, commercial_link: true, attribution: 'Dupe.com', keep_until };
}

export function parseSearch(m: Obj, keep_until: string): DupeResult {
  if (isObj(m.error)) return changed(`Dupe refused the call: ${str(m.error.message) ?? 'JSON-RPC error'}`);
  const res = m.result;
  const text = isObj(res) ? list(res.content).map(c => (isObj(c) ? str(c.text) : undefined)).find(Boolean) : undefined;
  if (!isObj(res) || !text) return changed('Dupe answered without a result');
  if (res.isError === true) return /validation|invalid arguments/i.test(text) ? changed(`Dupe rejected the arguments: ${text.slice(0, 200)}`) : blocked(`Dupe refused: ${text.slice(0, 200)}`);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return changed('the search result is not JSON'); }
  if (!isObj(body) || !Array.isArray(body.products)) return changed('the search result has no products list');
  const rows = body.products.flatMap(p => toRow(p, keep_until) ?? []);
  return { ok: true, data: { rows, dropped: body.products.length - rows.length, total: body.products.length, keep_until } };
}

// --- the client ---

export function createDupe({ send = (url, init) => fetch(url, init), log, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) }:
  { send?: Send; log: Log; now?: () => number; sleep?: (ms: number) => Promise<void> }) {
  let session: string | null = null, ready = false, id = 0, lastStart: number | undefined;
  let chain: Promise<unknown> = Promise.resolve();

  const post = async (body: Obj, signal: AbortSignal): Promise<Reply> => {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'user-agent': `${CLIENT.name}/${CLIENT.version}` };
    if (session) { headers['mcp-session-id'] = session; headers['mcp-protocol-version'] = PROTOCOL; }
    const r = await send(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body), signal });
    const sid = r.headers.get('mcp-session-id'); if (sid) session = sid;
    return r;
  };
  // One logged outside call: the reply's status, or the failure it maps to.
  const rpc = (method: string, params: Obj, signal: AbortSignal, notify = false) =>
    log.call('http', `dupe.${method}`, { method }, async () => {
      const r = await post(notify ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id: ++id, method, params }, signal);
      return { r, text: await r.text() };
    }, ({ r }) => ({ status: r.status }));

  async function open(signal: AbortSignal): Promise<DupeFail | undefined> {
    session = null; ready = false;
    const init = await rpc('initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT }, signal);
    const bad = statusFail(init.r, now()); if (bad) return bad;
    if (!message(init.text)) return changed('initialize answered without a result');
    const note = await rpc('notifications/initialized', {}, signal, true);
    const nb = statusFail(note.r, now()); if (nb) return nb;
    const tl = await rpc('tools/list', {}, signal);
    const tb = statusFail(tl.r, now()); if (tb) return tb;
    const m = message(tl.text);
    if (!m || !isObj(m.result) || !schemaOk(m.result.tools)) return changed(`${TOOL} is missing or its input schema changed`);
    ready = true;
    return undefined;
  }

  async function once(query: string, category: Category, signal: AbortSignal, retried = false): Promise<DupeResult> {
    if (!ready) { const bad = await open(signal); if (bad) return bad; }
    const keep_until = new Date(now()).toISOString();
    const out = await log.call('http', `dupe.${TOOL}`, { category }, async (): Promise<DupeResult | 'expired'> => {
      const r = await post({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name: TOOL, arguments: { query, refresh: false, search_category: category } } }, signal);
      const text = await r.text();
      if (r.status === 404 && !retried) return 'expired'; // MCP: a 404 on a session means start a new one
      const bad = statusFail(r, now()); if (bad) return bad;
      const m = message(text);
      return m ? parseSearch(m, keep_until) : changed('the search answered without a JSON-RPC message');
    }, o => ({ result: o === 'expired' ? { ok: false, code: 'session_expired' } : o.ok ? { ok: true, rows: o.data.rows.length, dropped: o.data.dropped } : { ok: false, code: o.error.code } }));
    if (out !== 'expired') return out;
    ready = false;
    return once(query, category, signal, true);
  }

  async function paced(query: string, category: Category, signal: AbortSignal): Promise<DupeResult> {
    if (lastStart !== undefined) { const wait = lastStart + MIN_GAP_MS - now(); if (wait > 0) await sleep(wait); }
    lastStart = now();
    return once(query, category, signal);
  }

  function search(a: CallArgs, signal: AbortSignal): Promise<DupeResult> {
    const q = str(a.q), category = a.category ?? 'all';
    if (!q || !(CATEGORIES as readonly unknown[]).includes(category))
      return Promise.resolve(fail('policy_refused', 'search needs q and, if given, one of Dupe\'s categories', { do: 'raise_decision', kind: 'missing_input' }));
    const run = chain.then(() => paced(q.trim(), category as Category, signal));
    chain = Promise.allSettled([run]); // the next search waits for this one to settle; its caller gets the rejection, if any
    return run;
  }

  // The kernel verbs: only search has a route here.
  const call = (verb: Verb, a: CallArgs, signal: AbortSignal): Promise<DupeResult> => verb === 'search' ? search(a, signal)
    : Promise.resolve(fail('no_route', `Dupe is a search-only source; ${verb} has no route`, { do: 'handoff', url: HOME }));

  return { route_id: ROUTE_ID, search, call };
}
