// Server-only, search-only source. Finalization SR12: asking prices, never stored or handed to a model.
import { createHash } from 'node:crypto';
import type { Log } from '../../../../../../log/index.js';
import { searchParams } from '../../../intel/run.ts';
import type { Row } from '../../../intel/public/readers.ts';
import type { HintFor } from '../../protocol.ts';

export const ENDPOINT = 'https://treg.to/call/serper.google.serp.shopping';
export const ROUTE_ID = 'google_shopping.search';
// Lead's observed call (2026-11-15 13:40 UTC); cap and cost remain tunable priors.
searchParams.declare({ name: 'search_shopping_cost_per_call_usd', family: 'scalar', prior: 0.002, guard_lo: 0 });
searchParams.declare({ name: 'search_shopping_usd_per_day', family: 'scalar', prior: 1.00, guard_lo: 0 });

export type ShoppingSpend = { reserve(day: string, usd: number): Promise<{ ok: true } | { ok: false; cap: string }> };
export type ShoppingFetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  status: number; headers: { get(name: string): string | null }; text(): Promise<string>;
}>;
export type ShoppingRow = Required<Pick<Row, 'id' | 'title' | 'price_cents' | 'currency' | 'url'>> & Pick<Row, 'image_url' | 'sold'> & {
  source_site: string; secondhand: boolean; attribution: 'Google Shopping'; may_store: false; may_model: false; keep_until: string;
};
type ShoppingHint = Pick<HintFor, 'no_route' | 'policy_refused' | 'rate_limited' | 'page_changed'> & {
  blocked: { do: 'pause_session'; site: 'google_shopping' }; timed_out: HintFor['rate_limited'];
};
type ShoppingCode = keyof ShoppingHint;
type Failure = { ok: false; error: { [C in ShoppingCode]: { code: C; message: string; hint: ShoppingHint[C] } }[ShoppingCode] };
export type ShoppingResult = { ok: true; data: { rows: ShoppingRow[]; dropped: number; total: number; keep_until: string } } | Failure;
const hints: ShoppingHint = {
  no_route: { do: 'handoff', url: 'https://shopping.google.com' },
  policy_refused: { do: 'raise_decision', kind: 'missing_input' },
  rate_limited: { do: 'retry_after', after_s: 60 }, page_changed: { do: 'author', missing: ['shopping'] },
  blocked: { do: 'pause_session', site: 'google_shopping' }, timed_out: { do: 'retry_after', after_s: 0 },
};
const fail = (code: ShoppingCode, message: string): Failure => ({ ok: false, error: { code, message, hint: hints[code] } as Failure['error'] });
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
// Google names a marketplace seller as "eBay - <seller>"; the seller part never reaches a row.
const resale = /^(ebay|poshmark|depop|mercari|thredup|the realreal)\b/;

function cents(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\$(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{2})?$/.test(value)) return undefined;
  const amount = Number(value.slice(1).replaceAll(',', '')) * 100, rounded = Math.round(amount);
  return Number.isSafeInteger(rounded) && Math.abs(amount - rounded) < 1e-6 ? rounded : undefined;
}
function row(value: unknown, keep_until: string): ShoppingRow | undefined {
  if (!object(value)) return undefined;
  const title = text(value.title), url = text(value.link), price_cents = cents(value.price);
  if (!title || !url || price_cents === undefined) return undefined;
  // The API ranks with URL(), so reject unusable links at the input boundary.
  if (!URL.canParse(url)) return undefined;   // unreadable_card, counted by parse
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  const merchant = (text(value.source) ?? '').trim().toLowerCase(), site = merchant.match(resale)?.[1];
  const source_site = site ?? merchant;
  return { id: text(value.productId) ?? `google_shopping-${createHash('sha256').update(url).digest('hex').slice(0, 12)}`,
    title, url, price_cents, currency: 'USD', ...(text(value.imageUrl) ? { image_url: text(value.imageUrl) } : {}),
    source_site, secondhand: !!site, attribution: 'Google Shopping', may_store: false, may_model: false, keep_until };
}
function parse(body: string, keep_until: string): ShoppingResult {
  let value: unknown;
  try { value = JSON.parse(body); } catch { return fail('page_changed', 'Shopping response is not JSON'); }
  if (!object(value) || !Array.isArray(value.shopping)) return fail('page_changed', 'Shopping response has no shopping list');
  const rows = value.shopping.flatMap(value => row(value, keep_until) ?? []);
  return { ok: true, data: { rows, dropped: value.shopping.length - rows.length, total: value.shopping.length, keep_until } };
}

export function createShopping({ token, log, fetch: send = (url, init) => fetch(url, init), now = Date.now, spend }:
  { token: string; log: Log; fetch?: ShoppingFetch; now?: () => number; spend: ShoppingSpend }) {
  async function search({ q }: { q: string }, signal: AbortSignal): Promise<ShoppingResult> {
    if (!token.trim()) return fail('no_route', 'no live route composed');
    if (!q.trim()) return fail('policy_refused', 'search needs q');
    if (signal.aborted) return fail('timed_out', 'Shopping search timed out');
    const prior = Number(searchParams.read('search_shopping_cost_per_call_usd', {}).value);
    const reservation = await spend.reserve(new Date(now()).toISOString().slice(0, 10), prior);
    if (!reservation.ok) {
      log.note('Shopping search blocked', { cap: reservation.cap });
      return fail('rate_limited', reservation.cap);
    }
    const out = await log.call('tool', ROUTE_ID, {}, async () => {
      let cost_usd = prior, cost_estimated = true;
      let result: ShoppingResult;
      try {
        signal.throwIfAborted();
        const response = await send(ENDPOINT, { method: 'POST', headers: {
          'content-type': 'application/json', 'X-Treg-Token': token, 'X-Treg-Route-Max-Cost': '0.005',
        }, body: JSON.stringify({ q, gl: 'us' }), signal });
        const micro = response.headers.get('x-treg-cost-micro');
        if (micro !== null && /^\d+$/.test(micro) && Number.isSafeInteger(Number(micro))) {
          cost_usd = Number(micro) / 1e6; cost_estimated = false;
        }
        result = response.status >= 400 ? fail(response.status === 429 ? 'rate_limited' : 'blocked', `Shopping answered ${response.status}`)
          : parse(await response.text(), new Date(now()).toISOString());
      } catch {
        // Transport errors can echo request headers. Record a fixed failure, never the thrown text or vendor body.
        result = signal.aborted ? fail('timed_out', 'Shopping search timed out') : fail('blocked', 'Shopping request failed');
      }
      return { result, cost_usd, cost_estimated };
    }, out => ({ cost_usd: out.cost_usd, cost_estimated: out.cost_estimated,
      rows: out.result.ok ? out.result.data.rows.length : 0,
      result: out.result.ok ? { ok: true, dropped: out.result.data.dropped } : { ok: false, code: out.result.error.code } }));
    return out.result;
  }
  return { route_id: ROUTE_ID, search };
}
