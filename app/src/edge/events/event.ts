// The event seam (stream 2), spec/engines/protocol-and-adapters.md §3.6 and spec/product.md §3 `event`.
// Every source writes one EventRow; each row starts exactly one job. A source never acts, it only reports.
// Platform teams emit Snapshots from a watcher sweep; the differ (differ.ts) turns two of them into events.
// Names are canon (product.md). Fields marked NEW are asked of the orchestrator for product.md and db-1.

export const SITES = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'] as const;
export type Site = (typeof SITES)[number];

// Where an event came from (§3.6 table, one value per row). NEW: `source`.
// The values are events.json `event.received` source enum.
export const SOURCES = ['app', 'site_push', 'live_channel', 'watcher_signed_in', 'watcher_public', 'market', 'databricks'] as const;
export type Source = (typeof SOURCES)[number];

export type Actor = 'user' | 'auto' | 'site';

// The event kinds §3.6 names, plus the app's own actions and the account state. Stored in canon `action`.
export const EVENT_KINDS = [
  // site events, from watchers, webhooks and the live channel
  'offer.received', 'message.received', 'listing.sold', 'listing.ended', 'like.added', 'price.changed',
  'order.updated',
  // market
  'value_moved', 'demand_rose',
  // the account
  'account_stale', 'account_relinked',
  // app actions (Nate, 2026-11-14): each becomes one job with a policy check
  'app.list', 'app.delist', 'app.relist', 'app.delete', 'app.reprice', 'app.offer', 'app.message', 'app.confirm',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface EventRow {
  id: string;
  user_id: string;
  source: Source; // NEW
  site?: Site; // NEW
  account_id?: string; // NEW
  action: EventKind; // canon `action`: §3.6 calls it kind
  item_id?: string;
  listing_id?: string;
  payload_ref?: string; // NEW: where the body lives (volume path or observation id); never text, tokens or cookies
  payload?: Record<string, unknown>; // small typed fields only (ids, cents, counts)
  dedupe_key: string; // NEW: same key, same event; required
  actor: Actor;
  why?: string;
  observed_at: string; // ISO
  effective_at: string;
  operation_id?: string;
  trace_id: string;
  undo?: { allowed: boolean; until?: string };
  undo_of?: string;
  route?: 'api' | 'replay' | 'browser';
  fell_back?: boolean;
  ms?: number;
}

// ---- The normalised snapshot: what one signed-in or public sweep of one account on one site read ----
// No buyer names, no message text: refs and hashes only (privacy-and-data). Order of arrays carries no meaning.

export interface SnapListing {
  external_id: string;
  state: 'live' | 'sold' | 'ended' | 'draft';
  price_cents: number;
  likes?: number;
  watchers?: number;
  views?: number;
}
export interface SnapOffer {
  external_id: string;
  listing_external_id: string;
  amount_cents: number;
  state: 'open' | 'countered' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  buyer_ref_hash?: string;
}
export interface SnapMessage {
  external_id: string;
  thread_ref: string;
  listing_external_id?: string;
  at: string;
  from: 'buyer' | 'us';
}
export interface SnapOrder {
  external_order_id: string;
  listing_external_id: string;
  state: string; // the §4 order states
  price_cents: number;
}
export interface SnapNotification {
  external_id: string;
  kind: string; // the site's own kind, mapped by the platform adapter
  ref?: string;
  at: string;
}

export interface Snapshot {
  site: Site;
  account_id: string;
  user_id: string;
  taken_at: string;
  route: 'signed_in' | 'public';
  route_id?: string;
  // a section that was not read is absent (undefined), never [] — empty means read and empty
  notifications?: SnapNotification[];
  listings?: SnapListing[];
  offers?: SnapOffer[];
  messages?: SnapMessage[];
  orders?: SnapOrder[];
}

// A typed change the differ found, before it becomes an EventRow.
export interface Change {
  action: EventKind;
  site: Site;
  account_id: string;
  listing_external_id?: string;
  ref: string; // the external id the change is about
  payload: Record<string, unknown>;
  dedupe_key: string;
}

// ---- Sources: anything that produces events. Platform teams implement this. ----
export interface EventSource {
  readonly source: Source;
  // pull whatever arrived since the cursor; return the new cursor. Idempotent per cursor.
  read(cursor: string | null): Promise<{ events: Omit<EventRow, 'id'>[]; cursor: string | null }>;
}

export function validateEvent(e: Partial<EventRow>): string[] {
  const bad: string[] = [];
  if (!e.dedupe_key) bad.push('dedupe_key');
  if (!e.user_id) bad.push('user_id');
  if (!e.source || !(SOURCES as readonly string[]).includes(e.source)) bad.push('source');
  if (!e.action || !(EVENT_KINDS as readonly string[]).includes(e.action)) bad.push('action');
  if (e.site !== undefined && !(SITES as readonly string[]).includes(e.site)) bad.push('site');
  if (!e.trace_id) bad.push('trace_id');
  if (!e.observed_at) bad.push('observed_at');
  return bad;
}

// The fake behind the interface: a scripted source that replays events in pages of `pageSize`.
export function fakeSource(source: Source, events: Omit<EventRow, 'id'>[], pageSize = 2): EventSource {
  return {
    source,
    async read(cursor) {
      const at = cursor ? Number(cursor) : 0;
      const page = events.slice(at, at + pageSize);
      return { events: page, cursor: at + page.length >= events.length ? String(events.length) : String(at + page.length) };
    },
  };
}
