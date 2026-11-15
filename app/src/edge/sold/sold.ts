// sd-1 See the sale cheaply: the sold ladder (research/sold/ben/cheap-sale-detection.md §1, protocol-and-adapters §3.5, §3.6).
// How it operates, cheapest signal first, one authoritative read last (OPERATING.md has the table per verb):
//   rung 0  eBay's signed push (wh-1) -> order.updated event
//   rung 1  Facebook: our own state; the agent booked the pickup, so no poll at all
//   rung 3  Poshmark, Mercari: a plain server fetch of the PUBLIC listing page every 1 to 2 min, no session, read
//           with no model (JSON-LD availability, then the product:availability meta, then the sold banner)
//   rung 4  every site: the signed-in `read_orders` in the person's leased session confirms. Depop has no public
//           read and no push, so its signed-in sweep (ws-1) is the trigger and the confirmation at once.
// A public "sold" only raises a `listing.sold` event (source watcher_public), which starts a `poll_orders` job;
// nothing is delisted until confirm() finds the paid order. confirm() never waits for the person: an expired
// session pauses the job through as-1 and returns at once.
// A bot wall (403, a challenge page) is `unknown`, never routed around; the signed-in sweep keeps the cadence.
// Likely breaks, each tested: a public page that shows sold falsely; a bot wall read as sold or live; a job that
// stalls waiting for the person; a public route used for the order amount it cannot return; a double delist.
import { ingest, type LogLike } from '../events/intake.ts';
import type { Site } from '../events/event.ts';
import type { HarnessLike, Store } from '../events/ports.ts';
import { fanOut, type ItemListing } from '../delist/delist.ts';
import type { orderBook, OrderRead } from '../orders/orders.ts';

export type PublicState = { state: 'sold' | 'live' | 'unknown'; why: string };

const SOLD = /^(?:https?:\/\/schema\.org\/)?(OutOfStock|SoldOut|Discontinued)$/i;
const LIVE = /^(?:https?:\/\/schema\.org\/)?(InStock|LimitedAvailability|InStoreOnly|OnlineOnly)$/i;

// Pure: read a public listing page's HTML. Order: JSON-LD offer availability, the meta tag, the sold banner.
export function readPublicPage(html: string, status = 200): PublicState {
  if (status === 403 || status === 429 || /cf-chl|challenge-platform|captcha/i.test(html)) return { state: 'unknown', why: 'bot_wall' };
  if (status === 404 || status === 410) return { state: 'unknown', why: 'gone' }; // gone is not sold: the signed-in read decides
  if (status !== 200) return { state: 'unknown', why: `http_${status}` };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const found = /"availability"\s*:\s*"([^"]+)"/.exec(m[1])?.[1];
    if (found && SOLD.test(found)) return { state: 'sold', why: `jsonld:${found}` };
    if (found && LIVE.test(found)) return { state: 'live', why: `jsonld:${found}` };
  }
  const meta = /<meta[^>]+(?:property|name)="product:availability"[^>]+content="([^"]+)"|<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="product:availability"/i.exec(html);
  const v = (meta?.[1] ?? meta?.[2] ?? '').toLowerCase();
  if (v === 'oos' || v === 'out of stock' || v === 'sold') return { state: 'sold', why: `meta:${v}` };
  if (v === 'instock' || v === 'in stock') return { state: 'live', why: `meta:${v}` };
  if (/This item is sold/i.test(html)) return { state: 'sold', why: 'banner' };
  return { state: 'unknown', why: 'no_signal' };
}

// Which rung watches each site between confirmations.
export const LADDER: Record<Site, { trigger: 'push' | 'own_state' | 'public_page' | 'signed_in_sweep'; confirm: 'read_orders' | 'appointment_done' }> = {
  ebay: { trigger: 'push', confirm: 'read_orders' },
  facebook: { trigger: 'own_state', confirm: 'appointment_done' },
  depop: { trigger: 'signed_in_sweep', confirm: 'read_orders' },
  poshmark: { trigger: 'public_page', confirm: 'read_orders' },
  mercari: { trigger: 'public_page', confirm: 'read_orders' },
};

export type Fetcher = (url: string) => Promise<{ status: number; text: string }>;

// Rung 3: one public check. A sold reading writes one listing.sold event (one poll_orders job); nothing else.
export async function publicCheck(store: Store, log: LogLike, fetcher: Fetcher, l: { user_id: string; listing_id: string; item_id: string; site: Site; account_id: string; url: string; trace_id: string }, now = () => new Date().toISOString()) {
  const res = await fetcher(l.url).catch(e => ({ status: 0, text: String(e) }));
  const read = readPublicPage(res.text, res.status);
  if (read.state !== 'sold') return { read };
  const at = now();
  const r = ingest(store, log, {
    user_id: l.user_id, source: 'watcher_public', site: l.site, account_id: l.account_id, action: 'listing.sold',
    item_id: l.item_id, listing_id: l.listing_id, dedupe_key: `${l.site}:${l.account_id}:listing.sold:${l.listing_id}`,
    actor: 'site', why: `public page: ${read.why}`, observed_at: at, effective_at: at, trace_id: l.trace_id,
    payload: { listing_id: l.listing_id, public: read.why },
  });
  return { read, ingested: r };
}

type Orders = ReturnType<typeof orderBook>;

// Rung 4, the poll_orders job's body: the signed-in read confirms, then the order is recorded and the delists fan out.
export async function confirm(d: { store: Store; log: LogLike; harness: HarnessLike; orders: Orders; listingsOf: (item_id: string) => ItemListing[] },
  job: { user_id: string; site: Site; account_id: string; listing_id: string; item_id: string; trace_id: string }) {
  const env = await d.harness.call<{ orders: Omit<OrderRead, 'user_id' | 'item_id' | 'site' | 'kind'>[] }>(job.site, 'read_orders', { account_id: job.account_id, listing_id: job.listing_id });
  if (!env.ok) return env.error.code === 'auth_expired' ? { outcome: 'paused' as const } : { outcome: 'error' as const, code: env.error.code };
  const paid = (env.data.orders ?? []).find(o => o.listing_id === job.listing_id && o.state !== 'cancelled');
  if (!paid) return { outcome: 'not_sold' as const }; // the public page was wrong: nothing is delisted
  const applied = d.orders.apply({ ...paid, kind: 'sale', user_id: job.user_id, item_id: job.item_id, site: job.site });
  const delist = fanOut(d.store, d.log, { user_id: job.user_id, item_id: job.item_id, sold_listing_id: job.listing_id, confirmed: true, trace_id: job.trace_id, listings: d.listingsOf(job.item_id) });
  return { outcome: 'sold' as const, order: applied.order, new_sale: applied.new_sale, delist };
}
