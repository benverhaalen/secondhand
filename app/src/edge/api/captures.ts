// Rests-on: spec/product.md §7 Resources; spec/engines/capture.md §1; spec/examples/captures.json.
// Capture persistence, upload signing and realtime credentials have no route service yet.
// The shared example boundary stays here until the contract layer's owner can move it to http.ts.
import { ApiError, paramsOf, served, type Ctx, type Handler, type Reply } from './http.ts';
import { EXAMPLES, example, type Example } from './examples.ts';
import { FAMILIES } from '../../engines/capture/process.ts';

export const invalid = (message: string, fields?: string[]) => new ApiError('invalid', message, 'validate', { by: 'user' }, fields ? { fields } : {});
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export const bool = (v: unknown) => typeof v === 'boolean';
export const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
export const version = (v: unknown) => integer(v) && v > 0;
export const strings = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(text);
export const money = (v: unknown) => object(v) && integer(v.amount_cents) && typeof v.currency === 'string' && /^[A-Z]{3}$/.test(v.currency);
export const oneOf = (...values: readonly string[]) => (v: unknown) => typeof v === 'string' && values.includes(v);
export const url = (v: unknown) => {
  if (!text(v)) return false;
  try { return ['https:', 'http:'].includes(new URL(v).protocol); } catch { return false; }
};
type Check = (v: unknown) => boolean;
export function fields(body: Record<string, unknown>, required: Record<string, Check>, optional: Record<string, Check> = {}) {
  for (const [name, ok] of Object.entries(required)) if (!ok(body[name])) throw invalid(`${name} is not valid`, [name]);
  for (const [name, ok] of Object.entries(optional)) if (body[name] !== undefined && !ok(body[name])) throw invalid(`${name} is not valid`, [name]);
}
export function reference(value: unknown, ids: readonly string[]) {
  if (!ids.includes(String(value))) throw new ApiError('not_found', `no ${String(value)} for this user`, 'read');
}
export const sites = oneOf('ebay', 'facebook', 'depop', 'poshmark', 'mercari', 'offerup', 'grailed');
export const siteList = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(sites);
export function pagination(ctx: Ctx) {
  const limit = ctx.query.get('limit');
  if (ctx.query.getAll('limit').length > 1 || limit !== null && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100)) throw invalid('limit must be between 1 and 100');
}
function page(reply: Reply, ctx: Ctx, endpoint: string): Reply {
  if (reply instanceof Response || !object(reply.body) || !Array.isArray(reply.body.data) || !('next_cursor' in reply.body) && !ctx.query.has('limit') && !ctx.query.has('cursor')) return reply;
  const rows = reply.body.data;
  const filters = [...ctx.query.entries()].filter(([name]) => !['cursor', 'limit'].includes(name)).sort();
  const scope = JSON.stringify([endpoint, ctx.params, filters]);
  const cursor = ctx.query.get('cursor');
  let offset = 0;
  if (cursor) {
    let parsed: unknown;
    try { parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()); }
    catch { throw invalid('cursor is not valid'); }
    if (!object(parsed) || parsed.scope !== scope || !integer(parsed.offset) || parsed.offset > rows.length) throw invalid('cursor is not valid for this list');
    offset = parsed.offset;
  }
  const limit = Number(ctx.query.get('limit') ?? 100);
  const data = rows.slice(offset, offset + limit);
  const next_cursor = offset + limit < rows.length ? Buffer.from(JSON.stringify({ scope, offset: offset + limit })).toString('base64url') : reply.body.next_cursor ?? null;
  return { ...reply, body: { ...reply.body, data, next_cursor } };
}
export type ManifestEntry = { endpoint: string; source: 'example' | 'engine'; auth: 'user' | 'visitor' };
export function manifestFor(handlers: Record<string, Handler>): ManifestEntry[] {
  return Object.keys(handlers).map(endpoint => ({ endpoint, source: 'example', auth: EXAMPLES.some(e => e.endpoint === endpoint && e.auth === 'visitor') ? 'visitor' : 'user' }));
}

// Example rows belong to the same synthetic user as jobs.seedExamples, never to a second bearer.
// Endpoint-specific validation runs before the answer; replacing the last handler swaps in the service.
export function exampleHandler(endpoint: string, validate: (ctx: Ctx) => void = () => {}, choose?: (ctx: Ctx) => string): Handler {
  const answer = served(endpoint);
  const options = EXAMPLES.filter(e => e.endpoint === endpoint && e.status < 400);
  const pattern = endpoint.split(' ')[1];
  return async (ctx, req) => {
    if (!options.some(e => e.auth === 'visitor') && ctx.user_id !== 'usr_8f2k') throw new ApiError('not_found', 'no example data for this user', 'read');
    // Check ownership before validating a write, so a foreign id always answers 404.
    if (!options.some(e => JSON.stringify(paramsOf(pattern, e.path.split('?')[0])) === JSON.stringify(ctx.params))) {
      const entity = pattern.split('/')[2].replace(/s$/, '');
      throw new ApiError('not_found', `no ${entity} ${Object.values(ctx.params).join('/')} for this user`, 'read');
    }
    const base = await answer(ctx, req);
    pagination(ctx);
    ctx.log.input('api', endpoint, { fields: Object.keys(ctx.body), query_fields: [...ctx.query.keys()] });
    validate(ctx);
    const selected: Example | undefined = choose ? example(choose(ctx)) : options.find(e => JSON.stringify(paramsOf(pattern, e.path.split('?')[0])) === JSON.stringify(ctx.params));
    if (!selected || selected.endpoint !== endpoint) throw new Error(`invalid example selection for ${endpoint}`);
    const expected = object(selected.request?.body) ? selected.request.body.version : undefined;
    if (expected !== undefined && ctx.body.version !== expected) throw new ApiError('stale', 'the resource changed', 'version_check', { by: 'user' }, { current: { version: expected } });
    ctx.log.note('answer from contract example', { endpoint, example: selected.name });
    return page(choose ? { status: selected.status, body: selected.response, headers: selected.headers } : base, ctx, endpoint);
  };
}

export const handlers: Record<string, Handler> = {
  'POST /v1/captures': exampleHandler('POST /v1/captures', c => fields(c.body, { mode: oneOf('shots', 'scan', 'talk'), purpose: oneOf('sell', 'appraise', 'find') }, { first_photo_hint: text })),
  'POST /v1/captures/:id/photos': exampleHandler('POST /v1/captures/:id/photos', c => {
    fields(c.body, { photos: v => Array.isArray(v) && v.length > 0 && v.every(p => object(p) && text(p.role) && text(p.step) && oneOf('image/heic', 'image/jpeg', 'image/png')(p.content_type) && version(p.bytes)) });
  }),
  'PATCH /v1/captures/:id': exampleHandler('PATCH /v1/captures/:id', c => fields(c.body, { version, type: oneOf(...FAMILIES) })),
  'POST /v1/captures/:id/finish': exampleHandler('POST /v1/captures/:id/finish', c => fields(c.body, { version }, { note: text })),
  'POST /v1/captures/:id/talk': exampleHandler('POST /v1/captures/:id/talk', c => fields(c.body, { voice: bool })),
};
export const manifest = manifestFor(handlers);
