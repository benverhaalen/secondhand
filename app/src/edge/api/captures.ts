// Rests-on: spec/product.md §7 Resources; spec/engines/capture.md §1; spec/examples/captures.json.
// Upload signing and realtime credentials remain contract examples.
// The shared example boundary stays here until the contract layer's owner can move it to http.ts.
import { ApiError, paramsOf, served, type Ctx, type Handler, type Reply } from './http.ts';
import { EXAMPLES, example, type Example } from './examples.ts';
import { FAMILIES, type Family } from '../../engines/capture/process.ts';
import { plan, type State, type Fact } from '../../engines/capture/plan.ts';
import { select } from '../../engines/capture/select.ts';
import type { FieldRow, Site } from '../../engines/capture/table.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { SITES } from '../../../../spec/sites.mjs';

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
const engineHandlers = new WeakSet<Handler>();
export function fromEngine(handler: Handler): Handler { engineHandlers.add(handler); return handler; }
export function manifestFor(handlers: Record<string, Handler>): ManifestEntry[] {
  return Object.keys(handlers).map(endpoint => ({ endpoint, source: engineHandlers.has(handlers[endpoint]) ? 'engine' : 'example', auth: EXAMPLES.some(e => e.endpoint === endpoint && e.auth === 'visitor') ? 'visitor' : 'user' }));
}

// Example rows belong to the same synthetic user as jobs.seedExamples, never to a second bearer.
// Endpoint-specific validation runs before the answer; replacing the last handler swaps in the service.
export function exampleHandler(endpoint: string, validate: (ctx: Ctx) => void = () => {}, choose?: (ctx: Ctx) => string, run?: (ctx: Ctx, seed: Exclude<Reply, Response>) => Promise<Reply>, versionOf?: (ctx: Ctx) => Promise<number>): Handler {
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
    const expected = versionOf ? await versionOf(ctx) : object(selected.request?.body) ? selected.request.body.version : undefined;
    if (expected !== undefined && ctx.body.version !== expected) throw new ApiError('stale', 'the resource changed', 'version_check', { by: 'user' }, { current: { version: expected } });
    const seed = { status: selected.status, body: structuredClone(selected.response), headers: selected.headers };
    if (run) {
      const reply = await ctx.log.call('tool', 'api.engine', { endpoint }, () => run(ctx, seed), () => ({ result: { source: 'engine' } }));
      return page(reply, ctx, endpoint);
    }
    ctx.log.note('answer from contract example', { endpoint, example: selected.name });
    return page(choose ? seed : base, ctx, endpoint);
  };
}

type CaptureRow = { user_id: string; version: number; state: State; status: string; mode: string; photos: number };
const open = example('captures.open').response as {id: string; item_id: string; created_at: string; picker: string[]};
const linkedSites = (example('accounts.list').response as {data: {site: string}[]}).data
  .map(account => account.site).filter((site): site is Site => SITES.includes(site));
const params = memoryStore();
const captures = new Map<string, CaptureRow>();
function initial(body: Record<string, unknown>): State {
  const device = body.device as {has_lidar?: boolean; object_capture?: boolean} | undefined;
  const has_lidar = device?.has_lidar ?? true;
  return { capture_id: open.id, item_id: body.item_id as string ?? open.item_id,
    purpose: body.purpose as State['purpose'], confirm_mode: body.confirm_mode as State['confirm_mode'] ?? 'tap',
    has_lidar, object_capture: device?.object_capture ?? has_lidar, sites: [...linkedSites], type: null,
    ...(body.suggestion === undefined ? {} : {suggestion: structuredClone(body.suggestion) as State['suggestion']}),
    ...(body.pieces === undefined ? {} : {pieces: body.pieces as number}),
    kept: [], retakes: {}, facts: {}, lookups: 'none', refused: [] };
}
export function resetCaptures() {
  captures.clear();
  captures.set(open.id, {user_id: 'usr_8f2k', version: 1, state: initial(example('captures.open').request!.body as Record<string, unknown>), status: 'framing', mode: 'shots', photos: 0});
}
resetCaptures();
function read(ctx: Ctx): CaptureRow {
  const row = captures.get(ctx.params.id);
  if (!row || row.user_id !== ctx.user_id) throw new ApiError('not_found', 'capture not found', 'read');
  return row;
}
async function versionOf(ctx: Ctx) { return read(ctx).version; }
function view(row: CaptureRow) {
  const next = plan(row.state, params);
  return {id: row.state.capture_id, item_id: row.state.item_id, state: row.status, mode: row.mode, purpose: row.state.purpose,
    type: row.state.type, suggested_type: row.state.suggestion?.family ?? null, picker: open.picker,
    process: next.process, coverage: {needed: next.process.map(step => step.key).filter(key => !row.state.kept.includes(key)), kept: [...row.state.kept]},
    created_at: open.created_at, version: row.version, plan: next};
}
function write(ctx: Ctx, row: CaptureRow, status: string) {
  row.status = status; row.version++;
  ctx.log.event('state.change', {entity: 'capture', id: row.state.capture_id, to: status});
}
const probability = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const family = oneOf(...FAMILIES);
class InvalidAnswer extends ApiError { get status() { return 422; } }
function answerError(field: string) { return new InvalidAnswer('invalid', `${field} is not valid for the current question`, 'validate', {by: 'user'}, {fields: [field]}); }
function validValue(row: FieldRow, value: unknown): boolean {
  switch(row.type) {
    case 'text': return text(value);
    case 'enum': return !!row.values?.includes(value as string | number);
    case 'number': return number(value);
    case 'bool': return bool(value);
    case 'dimensions': return object(value) && (row.ask?.parts ?? []).every(part => number(value[part]));
    case 'list': return Array.isArray(value) && new Set(value).size === value.length &&
      (row.values ? value.length <= row.values.length && value.every(v => row.values!.includes(v)) : value.every(text));
  }
}
type PhotoRead = {field: string; value: unknown; source?: 'seen'|'label'|'measured'; confidence?: number; unknown_reason?: 'not_read'};
type Photo = {role: string; step: string; key?: string; reads?: PhotoRead[]};
function validRead(v: unknown): boolean {
  return object(v) && text(v.field) && Object.hasOwn(v, 'value') && (v.value === null
    ? v.unknown_reason === 'not_read'
    : oneOf('seen', 'label', 'measured')(v.source) && probability(v.confidence));
}
const rank: Record<Fact['source'], number> = {seen: 0, label: 1, measured: 2, derived: 3, lookup: 4, you_said: 5};

export const handlers: Record<string, Handler> = {
  'POST /v1/captures': fromEngine(exampleHandler('POST /v1/captures', c => fields(c.body,
    {mode: oneOf('shots', 'scan', 'talk'), purpose: oneOf('sell', 'appraise', 'find')},
    {first_photo_hint: text, item_id: text, device: v => object(v) && bool(v.has_lidar) && (v.object_capture === undefined || bool(v.object_capture)),
      suggestion: v => object(v) && family(v.family) && probability(v.p) && probability(v.second_p) && v.second_p <= v.p,
      pieces: v => integer(v) && v >= 1 && v <= 12, confirm_mode: oneOf('tap', 'auto')}), undefined, async (ctx, seed) => {
    const row: CaptureRow = {user_id: ctx.user_id!, version: 1, state: initial(ctx.body), status: 'framing', mode: ctx.body.mode as string, photos: 0};
    captures.set(open.id, row);
    ctx.log.event('state.change', {entity: 'capture', id: open.id, to: row.status});
    return {...seed, body: view(row)};
  })),
  'GET /v1/captures/:id': fromEngine(exampleHandler('GET /v1/captures/:id', c => {read(c);}, undefined, async ctx => ({status: 200, body: view(read(ctx))}))),
  'POST /v1/captures/:id/photos': fromEngine(exampleHandler('POST /v1/captures/:id/photos', c => {
    read(c);
    fields(c.body, {photos: v => Array.isArray(v) && v.length > 0 && v.every(p => object(p) && text(p.role) && text(p.step) &&
      oneOf('image/heic', 'image/jpeg', 'image/png')(p.content_type) && version(p.bytes) &&
      (p.key === undefined || text(p.key)) && (p.reads === undefined || Array.isArray(p.reads) && p.reads.every(validRead)))});
  }, undefined, async (ctx, seed) => {
    const row = read(ctx);
    const uploads = (example('captures.photos').response as {photos: {upload: {expires_at: string}}[]}).photos;
    const photos = (ctx.body.photos as Photo[]).map(photo => {
      const key = photo.key ?? photo.step;
      const kept = row.state.kept.includes(key);
      if (kept && photo.reads?.some(read => read.unknown_reason === 'not_read')) row.state.retakes[key] = (row.state.retakes[key] ?? 0) + 1;
      if (!kept) row.state.kept.push(key);
      if (row.state.lookups === 'none') row.state.lookups = 'running';
      for (const read of photo.reads ?? []) {
        const old = row.state.facts[read.field];
        const source = read.source ?? 'label';
        if (!old || old.source !== 'you_said' && rank[source] >= rank[old.source]) row.state.facts[read.field] = {
          value: read.value, source, confidence: read.confidence ?? 0, step: key,
          ...(read.unknown_reason ? {unknown_reason: read.unknown_reason} : {}),
        };
      }
      const id = `ph_a${++row.photos}`;
      return {id, role: photo.role, step: photo.step, upload: {url: `https://uploads.example/v/${id}?sig=example`, method: 'PUT', expires_at: uploads[0].upload.expires_at}};
    });
    write(ctx, row, 'uploading');
    return {...seed, body: {photos, capture: view(row)}};
  })),
  'PATCH /v1/captures/:id': fromEngine(exampleHandler('PATCH /v1/captures/:id', c => {
    read(c); fields(c.body, {version}, {type: family, answer: v => object(v) && text(v.field) && Object.hasOwn(v,'value'), refuse: text});
    if (['type', 'answer', 'refuse'].filter(key => c.body[key] !== undefined).length !== 1) throw invalid('choose exactly one of type, answer or refuse', ['type','answer','refuse']);
  }, c => c.body.answer ? 'captures.answer' : c.body.refuse ? 'captures.refuse' : 'captures.set_type', async (ctx, seed) => {
    const row = read(ctx);
    if (ctx.body.type !== undefined) row.state.type = ctx.body.type as Family;
    else {
      const answer = ctx.body.answer as {field: string; value: unknown} | undefined;
      const field = answer?.field ?? ctx.body.refuse as string;
      const current = plan(row.state, params);
      if (!current.questions.some(q => q.field === field && q.kind !== 'shot')) throw answerError(field);
      if (answer) {
        const definition = select(row.state,params).rows.find(r => r.field === field)!;
        if (!validValue(definition, answer.value)) throw answerError(field);
        row.state.facts[field] = {value: structuredClone(answer.value), source: 'you_said', confidence: 1, confirmed: true};
        if (field === 'type') row.state.type = answer.value as Family;
      } else row.state.refused.push(field);
    }
    write(ctx, row, 'shooting');
    return {...seed, body: {...view(row), item: {id: row.state.item_id, category: row.state.type}}};
  }, versionOf)),
  'POST /v1/captures/:id/finish': fromEngine(exampleHandler('POST /v1/captures/:id/finish', c => {read(c); fields(c.body, {version}, {note: text});}, undefined, async (ctx, seed) => {
    const row = read(ctx); write(ctx, row, 'judged');
    return {...seed, body: {...seed.body as Record<string, unknown>, capture: view(row), item: {id: row.state.item_id, state: 'researching'}}};
  }, versionOf)),
  'POST /v1/captures/:id/talk': exampleHandler('POST /v1/captures/:id/talk', c => fields(c.body, {voice: bool})),
};
export const manifest = manifestFor(handlers);
