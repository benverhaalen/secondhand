/**
 * Compare sections by external id, visiting ids in sorted order; array position
 * has no meaning. A null previous snapshot establishes a silent baseline, and
 * a section absent on either side is skipped (an empty array was read).
 * The feed is compared by notification id first; sweep keeps its changes before
 * section changes, with one shared fact key per site/account/kind/ref/new value.
 * Most likely breaks: adapters changing ids, treating unread sections as empty,
 * or using notification ids instead of entity refs. Notifications have no value
 * field: value-bearing keys use the matching next section when available;
 * without it the feed can only key the ref. Compare snapshots of one account.
 */
import { EVENT_KINDS } from './event.ts';
import type { Change, EventKind, EventRow, Snapshot } from './event.ts';

function index<T>(rows: readonly T[] | undefined, id: (row: T) => string): Map<string, T> {
  return new Map(rows?.map(row => [id(row), row]));
}
function sections(snapshot: Snapshot) {
  return {
    listings: index(snapshot.listings, row => row.external_id),
    offers: index(snapshot.offers, row => row.external_id),
    messages: index(snapshot.messages, row => row.external_id),
    orders: index(snapshot.orders, row => row.external_order_id),
    notifications: index(snapshot.notifications, row => row.external_id),
  };
}
type Sections = ReturnType<typeof sections>;
function byId<T>(rows: Map<string, T>): [string, T][] {
  return [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}

function change(action: EventKind, ref: string, next: Snapshot, before: Sections, after: Sections): Change {
  let listing_external_id: string | undefined;
  let value: string | number | undefined;
  let payload: Change['payload'] = {};
  switch (action) {
    case 'listing.sold':
    case 'listing.ended':
      listing_external_id = ref;
      break;
    case 'price.changed': {
      listing_external_id = ref;
      const listing = after.listings.get(ref);
      const old = before.listings.get(ref);
      if (listing) {
        value = listing.price_cents;
        payload = { ...(old ? { from_cents: old.price_cents } : {}), to_cents: value };
      }
      break;
    }
    case 'like.added': {
      listing_external_id = ref;
      const listing = after.listings.get(ref);
      const old = before.listings.get(ref);
      if (listing?.likes !== undefined) {
        value = listing.likes;
        payload = { ...(old?.likes !== undefined ? { from: old.likes } : {}), to: value };
      }
      break;
    }
    case 'offer.received': {
      const offer = after.offers.get(ref);
      if (offer) {
        listing_external_id = offer.listing_external_id;
        value = offer.amount_cents;
        payload = { amount_cents: value };
      }
      break;
    }
    case 'message.received': {
      const message = after.messages.get(ref);
      if (message) {
        listing_external_id = message.listing_external_id;
        payload = { thread_ref: message.thread_ref };
      }
      break;
    }
    case 'order.updated': {
      const order = after.orders.get(ref);
      if (order) {
        listing_external_id = order.listing_external_id;
        value = order.state;
        payload = { state: value, price_cents: order.price_cents };
      }
      break;
    }
  }
  return {
    action, site: next.site, account_id: next.account_id, ref,
    ...(listing_external_id !== undefined ? { listing_external_id } : {}),
    payload,
    dedupe_key: `${next.site}:${next.account_id}:${action}:${ref}${value === undefined ? '' : `:${value}`}`,
  };
}

export function diff(prev: Snapshot | null, next: Snapshot): Change[] {
  if (prev === null) return [];
  const before = sections(prev);
  const after = sections(next);
  const changes: Change[] = [];
  const emit = (kind: EventKind, ref: string) => changes.push(change(kind, ref, next, before, after));
  if (prev.listings !== undefined && next.listings !== undefined) {
    for (const [id, listing] of byId(after.listings)) {
      const old = before.listings.get(id);
      if (listing.state === 'sold' && old?.state !== 'sold') emit('listing.sold', id);
      if (listing.state === 'ended' && old?.state === 'live') emit('listing.ended', id);
      if (!old) continue;
      if (listing.price_cents !== old.price_cents) emit('price.changed', id);
      if (listing.likes !== undefined && old.likes !== undefined && listing.likes > old.likes) emit('like.added', id);
    }
  }
  if (prev.offers !== undefined && next.offers !== undefined) {
    for (const [id, offer] of byId(after.offers)) {
      const old = before.offers.get(id);
      if (!old || (offer.state === 'open' && offer.amount_cents !== old.amount_cents)) emit('offer.received', id);
    }
  }
  if (prev.messages !== undefined && next.messages !== undefined) {
    for (const [id, message] of byId(after.messages)) {
      if (message.from === 'buyer' && !before.messages.has(id)) emit('message.received', id);
    }
  }
  if (prev.orders !== undefined && next.orders !== undefined) {
    for (const [id, order] of byId(after.orders)) {
      const old = before.orders.get(id);
      if (!old || old.state !== order.state) emit('order.updated', id);
    }
  }
  return changes;
}

export function fromFeed(prev: Snapshot | null, next: Snapshot): Change[] {
  if (prev === null || prev.notifications === undefined || next.notifications === undefined) return [];
  const before = sections(prev);
  const after = sections(next);
  const changes: Change[] = [];
  const kinds: readonly string[] = EVENT_KINDS;
  const seen = new Set<string>();
  for (const [id, notification] of byId(after.notifications)) {
    if (before.notifications.has(id) || !kinds.includes(notification.kind)) continue;
    const fact = change(notification.kind as EventKind, notification.ref ?? id, next, before, after);
    if (seen.has(fact.dedupe_key)) continue;
    seen.add(fact.dedupe_key);
    changes.push(fact);
  }
  return changes;
}

export function diffSweep(prev: Snapshot | null, next: Snapshot): Change[] {
  const feed = fromFeed(prev, next);
  const seen = new Set(feed.map(fact => fact.dedupe_key));
  return [...feed, ...diff(prev, next).filter(fact => !seen.has(fact.dedupe_key))];
}

export function toEvent(
  change: Change,
  context: Pick<EventRow, 'user_id' | 'source' | 'observed_at' | 'trace_id'>,
): Omit<EventRow, 'id'> {
  return {
    ...context,
    action: change.action, site: change.site, account_id: change.account_id,
    actor: 'site', effective_at: context.observed_at, dedupe_key: change.dedupe_key,
    payload: {
      ...change.payload, ref: change.ref,
      ...(change.listing_external_id !== undefined ? { listing_external_id: change.listing_external_id } : {}),
    },
  };
}
