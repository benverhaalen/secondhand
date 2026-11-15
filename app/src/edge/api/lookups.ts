// Rests-on: .agents/team/packets/team/80-new-four-jobs-storage.md; spec/redesign/new-results.md; app/src/demo/types.ts Lookup.
import { ApiError, deps, type Ctx, type Handler } from './http.ts';
import { captureRows, manifestFor, fromEngine, pagination, type CaptureRow } from './captures.ts';

// shortcut: no item or capture state says "kept" or "sold" yet, so every find or worth capture is listed until hidden; filter on that state once it exists.
const lookups = (ctx: Ctx) => [...captureRows.values()]
  .filter(row => row.user_id === ctx.user_id && (row.intent === 'find' || row.intent === 'worth') && !row.lookup_hidden)
  .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
// A signed-in person's own searches, newest first, so their shopping can start from what they looked for (Nate, 2026-11-15).
// Kept 90 days in the shared kv, never for a signed-out visitor, cleared with the lookups and deleted with the account.
type Searched = { q: string; at: string };
type Kv = Pick<typeof deps.kv, 'get' | 'set' | 'delete'>;
const SEARCHES_KEPT = 20, SEARCHES_MS = 90 * 864e5;
export const searchesOf = (kv: Kv, user_id: string): Searched[] => kv.get<Searched[]>('search_history', user_id) ?? [];
export function rememberSearch(kv: Kv, user_id: string, q: string, at: string): void {
  const kept = searchesOf(kv, user_id).filter(row => row.q.toLowerCase() !== q.toLowerCase());
  kv.set('search_history', user_id, [{ q, at }, ...kept].slice(0, SEARCHES_KEPT), SEARCHES_MS);
}
export const forgetSearches = (kv: Kv, user_id: string) => kv.delete('search_history', user_id);
const shortName = (row: CaptureRow) => {
  const named = ['brand', 'model'].map(key => row.state.facts[key]?.value).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return named.length ? named.join(' ') : row.state.type ?? row.state.suggestion?.family ?? 'item';
};
const hide = (ctx: Ctx, row: CaptureRow) => {
  row.lookup_hidden = true;
  ctx.log.event('state.change', { entity: 'lookup', id: row.id, was: 'listed', to: 'hidden' });
};
const wrap = (endpoint: string, run: Handler): Handler => fromEngine((ctx, req) => {
  pagination(ctx);
  ctx.log.input('api', endpoint, { fields: Object.keys(ctx.body), query_fields: [...ctx.query.keys()] });
  return run(ctx, req);
});

export const handlers: Record<string, Handler> = {
  'GET /v1/lookups': wrap('GET /v1/lookups', ctx => ({ status: 200, body: {
    data: [...lookups(ctx).map(row => ({ capture_id: row.id as string | null, kind: row.intent as string | undefined, product_id: null, short_name: shortName(row), at: row.created_at })),
      ...searchesOf(deps.kv, ctx.user_id!).map(row => ({ capture_id: null, kind: 'search', product_id: null, short_name: row.q, at: row.at }))]
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, Number(ctx.query.get('limit') ?? 20)),
    next_cursor: null,
  } })),
  'DELETE /v1/lookups/:capture_id': wrap('DELETE /v1/lookups/:capture_id', ctx => {
    const row = lookups(ctx).find(r => r.id === ctx.params.capture_id);
    if (!row) throw new ApiError('not_found', 'lookup not found', 'read');
    hide(ctx, row);
    return { status: 204 };
  }),
  'DELETE /v1/lookups': wrap('DELETE /v1/lookups', ctx => {
    for (const row of lookups(ctx)) hide(ctx, row);
    forgetSearches(deps.kv, ctx.user_id!);
    return { status: 204 };
  }),
};
export const manifest = manifestFor(handlers);
