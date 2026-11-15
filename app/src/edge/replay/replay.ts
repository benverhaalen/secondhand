// Replay: what happened to an item (rp-1). Rests: spec/features/replay.md#what-the-person-does-and-sees, spec/replay.mjs.
//
// Operating notes
// - Reads: store.events({user_id, item_id}) only. The filter is on user_id in the store call itself, so another
//   person's rows are never fetched, let alone returned.
// - One read, one sort: effective_at, then observed_at, then id (ISO strings in UTC compare as text; Date parse guards a
//   mixed offset). No model.
// - An item with no events for this person answers {refused: 'not_found'}: another person's item and a missing item look
//   the same, so a replay never reveals that an item exists. (The store has no items table; when db-1 lands, an own item
//   with no events should return {events: []}.)
// - Likely breaks, each with a test: another user's item, a nonexistent item, a shared item id leaking rows, events
//   inserted out of order, equal timestamps.
import type { EventRow } from '../events/event.ts';
import type { Store } from '../events/ports.ts';

const t = (s: string) => { const n = Date.parse(s); return Number.isNaN(n) ? 0 : n; };

export function replayItem(store: Store, { user_id, item_id }: { user_id: string; item_id: string }): { events: EventRow[] } | { refused: 'not_found' } {
  const events = store.events({ user_id, item_id });
  if (!events.length) return { refused: 'not_found' };
  return { events: [...events].sort((a, b) => t(a.effective_at) - t(b.effective_at) || t(a.observed_at) - t(b.observed_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}
