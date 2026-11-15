// GET /v1/events and POST /v1/events/:id/undo over rp-1 and td-1 (rt-events). Rests: spec/product.md §7 (the one log and
// the "why?" timeline), §5 Undo.
// - list: with item_id, rp-1's replayItem (filtered by user in the store call, so a foreign item is 404); without it, the
//   person's events newest first. Each row in the contract shape {event_id, item_id, action, actor, at, why, trace_id, undo}.
// - undo: only the person's own event (404 otherwise), then td-1's undo: past the site's limit is 409 site_no_undo.
import type { EventRow } from '../events/event.ts';
import { replayItem } from '../replay/replay.ts';
import { undo as undoEvent } from '../today/today.ts';
import { ApiError, type Ctx } from './http.ts';
import { store } from './store.ts';

const row = (e: EventRow) => ({
  event_id: e.id, item_id: e.item_id ?? null, action: e.action, actor: e.actor, at: e.effective_at, why: e.why ?? null,
  trace_id: e.trace_id, undo: { allowed: !!e.undo?.allowed, until: e.undo?.until ?? null },
});

export function list(ctx: Ctx) {
  const user_id = ctx.user_id!;
  const item_id = ctx.query.get('item_id');
  const limit = Math.min(Math.max(Number(ctx.query.get('limit')) || 50, 1), 100);
  let rows: EventRow[];
  if (item_id) {
    const r = replayItem(store, { user_id, item_id });
    if ('refused' in r) throw new ApiError('not_found', `no item ${item_id} for this user`, 'read');
    rows = [...r.events].reverse();
  } else rows = store.events({ user_id }).sort((a, b) => (a.effective_at < b.effective_at ? 1 : -1));
  const cursor = ctx.query.get('cursor');
  const start = cursor ? rows.findIndex((e) => e.id === cursor) + 1 : 0;
  const page = rows.slice(start, start + limit);
  return { status: 200, body: { data: page.map(row), next_cursor: start + limit < rows.length ? page[page.length - 1].id : null } };
}

export function undo(ctx: Ctx) {
  const e = store.events({ user_id: ctx.user_id! }).find((x) => x.id === ctx.params.id);
  if (!e) throw new ApiError('not_found', `no event ${ctx.params.id} for this user`, 'read');
  const r = undoEvent(store, e.id, new Date().toISOString());
  if ('error' in r) {
    if (r.error === 'not_found') throw new ApiError('not_found', `no event ${e.id}`, 'read');
    throw new ApiError('site_no_undo', 'past the site\'s limit, or already undone', 'undo');
  }
  ctx.log.event('item.action', { item: e.item_id, action: 'undo', actor: 'user', undo_of: e.id });
  return { status: 200, body: { event: row(r.event), undo_of: e.id } };
}

export const routeHandlers = {
  'GET /v1/events': list,
  'POST /v1/events/:id/undo': undo,
};
export const manifest = Object.keys(routeHandlers).map(endpoint => ({ endpoint, source: 'engine' as const, auth: 'user' as const }));
