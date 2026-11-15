// Rests-on: .agents/team/packets/team/80-new-four-jobs-storage.md; spec/redesign/new-results.md; app/src/demo/types.ts Lookup.
import { ApiError, type Ctx, type Handler } from './http.ts';
import { captureRows, manifestFor, fromEngine, pagination, type CaptureRow } from './captures.ts';

// shortcut: no item or capture state says "kept" or "sold" yet, so every find or worth capture is listed until hidden; filter on that state once it exists.
const lookups = (ctx: Ctx) => [...captureRows.values()]
  .filter(row => row.user_id === ctx.user_id && (row.intent === 'find' || row.intent === 'worth') && !row.lookup_hidden)
  .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
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
    data: lookups(ctx).slice(0, Number(ctx.query.get('limit') ?? 20)).map(row => ({ capture_id: row.id, kind: row.intent, product_id: null, short_name: shortName(row), at: row.created_at })),
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
    return { status: 204 };
  }),
};
export const manifest = manifestFor(handlers);
