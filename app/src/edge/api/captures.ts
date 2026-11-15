// Rests-on: spec/product.md §7 Resources; spec/engines/capture.md §11; spec/examples/captures.json.
// Upload signing and realtime credentials remain contract examples.
// The shared example boundary stays here until the contract layer's owner can move it to http.ts.
import { ApiError, deps, paramsOf, served, type Ctx, type Handler, type Reply } from './http.ts';
import { EXAMPLES, example, type Example } from './examples.ts';
import { FAMILIES, type Family } from '../../engines/capture/process.ts';
import { plan, type State, type Fact } from '../../engines/capture/plan.ts';
import { select } from '../../engines/capture/select.ts';
import type { StudioAsk } from '../../engines/capture/select.ts';
import { viewsFor } from '../../engines/capture/fields.ts';
import type { FieldRow, Site } from '../../engines/capture/table.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { SITES } from '../../../../spec/sites.mjs';
import slides from '../../../../jobs/studio/slides.json' with { type: 'json' };

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

export type CaptureRow = { id: string; user_id: string; item_id: string; version: number; created_at: string; updated_at: string; data: 'example' | 'captured'; state: State; status: 'framing' | 'shooting' | 'uploading' | 'judged'; mode: string; photos: number; replacements: Record<string,number>; phone_suggestion: boolean; studio_plan?: StudioPlan };
const open = example('captures.open').response as {id: string; item_id: string; created_at: string; picker: string[]};
const linkedSites = (example('accounts.list').response as {data: {site: string}[]}).data
  .map(account => account.site).filter((site): site is Site => SITES.includes(site));
const params = memoryStore();
params.declare({name:'capture_label_sharp_min', family:'scalar', prior:.5});
export const captureRows = new Map<string, CaptureRow>();
let captureNumber = 0;
let exampleOpened = false;
function initial(body: Record<string, unknown>, id: string, item_id: string): State {
  const device = body.device as {has_lidar?: boolean; object_capture?: boolean} | undefined;
  const has_lidar = device?.has_lidar ?? false;
  return { capture_id: id, item_id,
    purpose: body.purpose as State['purpose'], confirm_mode: body.confirm_mode as State['confirm_mode'] ?? 'tap',
    has_lidar, object_capture: device?.object_capture ?? false, sites: [...linkedSites], type: null,
    ...(body.suggestion === undefined ? {} : {suggestion: structuredClone(body.suggestion) as State['suggestion']}),
    ...(body.pieces === undefined ? {} : {pieces: body.pieces as number}),
    kept: [], retakes: {}, facts: {}, lookups: 'none', refused: [] };
}
export function resetCaptures() {
  captureRows.clear();
  captureNumber = 0; exampleOpened = false;
  const state=initial(example('captures.open').request!.body as Record<string, unknown>,open.id,open.item_id);
  captureRows.set(open.id, {id:open.id,user_id:'usr_8f2k',item_id:state.item_id,version:1,created_at:open.created_at,updated_at:open.created_at,data:'example',state,status:'framing',mode:'shots',photos:0,replacements:{},phone_suggestion:true});
}
resetCaptures();
function read(ctx: Ctx): CaptureRow {
  return ownedCapture(ctx.user_id!,ctx.params.id);
}
function ownedCapture(user_id: string, capture_id: string): CaptureRow {
  const row = captureRows.get(capture_id);
  if (!row || row.user_id !== user_id) throw new ApiError('not_found', 'capture not found', 'read');
  return row;
}
function view(row: CaptureRow) {
  const next = plan(row.state, params);
  return {id: row.state.capture_id, item_id: row.state.item_id, state: row.status, mode: row.mode, purpose: row.state.purpose,
    type: row.state.type, suggested_type: row.state.suggestion?.family ?? null, picker: open.picker,
    process: next.process, coverage: {needed: next.process.map(step => step.key).filter(key => !row.state.kept.includes(key)), kept: [...row.state.kept]},
    created_at: row.created_at, version: row.version, plan: next};
}
function write(ctx: Pick<Ctx,'log'>, row: CaptureRow, status: CaptureRow['status'], detail: Record<string,unknown> = {}) {
  row.status = status; row.version++; row.updated_at = new Date(deps.now()).toISOString();
  ctx.log.event('state.change', {entity: 'capture', id: row.state.capture_id, to: status, ...detail});
}
function writable(row: CaptureRow) {
  if (row.status === 'judged') throw new ApiError('stale', 'capture is finished', 'state_check', {by:'none'}, {current:{version:row.version}});
}
function checkVersion(ctx: Ctx, row: CaptureRow) {
  if (ctx.body.version !== row.version) throw new ApiError('stale', 'the resource changed', 'version_check', {by:'user'}, {current:{version:row.version}});
}
function captureHandler(endpoint: string, run: Handler): Handler {
  return fromEngine(async (ctx, req) => {
    if (ctx.params.id) read(ctx);
    pagination(ctx);
    ctx.log.input('api',endpoint,{fields:Object.keys(ctx.body),query_fields:[...ctx.query.keys()]});
    return ctx.log.call('tool','api.engine',{endpoint},()=>run(ctx,req),()=>({result:{source:'engine'}}));
  });
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
    case 'number': return number(value) && (row.values ? row.values.includes(value) : !['cm','mm','m','in','ft','%'].includes(row.unit ?? '') || value>=0);
    case 'bool': return bool(value);
    case 'dimensions': {
      const parts=row.ask?.parts ?? [];
      return object(value) && Object.keys(value).length===parts.length && parts.every(part=>Object.hasOwn(value,part) && number(value[part]) && value[part]>0);
    }
    case 'list': return Array.isArray(value) && value.length>0 && new Set(value).size===value.length &&
      value.length<=(row.field.split('.')[0]==='colour'?2:row.values?.length ?? Infinity) &&
      (row.values ? value.every(v=>row.values!.includes(v)) : value.every(text));
  }
}
type PhotoRead = {field: string; value: unknown; source?: 'seen'|'label'|'measured'; confidence?: number; unknown_reason?: 'not_read'};
type Photo = {role: string; step: string; key?: string; reads?: PhotoRead[]};
function validRead(v: unknown): boolean {
  return object(v) && text(v.field) && Object.hasOwn(v, 'value') && (v.value === null
    ? v.unknown_reason === 'not_read' && v.source === undefined && v.confidence === undefined
    : v.unknown_reason === undefined && oneOf('seen', 'label', 'measured')(v.source) && probability(v.confidence));
}
const rank: Record<Fact['source'], number> = {seen: 0, label: 1, measured: 2, derived: 3, lookup: 4, you_said: 5};

export type IdentifyResult = {kind:'identify';action:'confirm'|'pick'|'ask';set:{product_id:string;family:Family;brand?:string;model?:string;c:number;label?:string;dimensions?:Record<string,number>}[]};
export type StudioPlan = {kind:string;asks:StudioAsk[]};
export type JobResult = IdentifyResult | {kind:'studio_plan';plan:StudioPlan} | {kind:'photo_score';photos:{key:string;role:string;score:number;parts:{sharpness:number;exposure:number;clipping:number;[part:string]:number}}[]};
const positiveDimensions = (v:unknown): v is Record<string,number> => object(v) && Object.keys(v).length>0 && Object.values(v).every(n=>number(n) && n>0);
function validateJobResult(result: unknown): asserts result is JobResult {
  if (!object(result)) throw invalid('result is not valid',['result']);
  fields(result,{kind:oneOf('identify','studio_plan','photo_score')});
  if (result.kind==='identify') {
    fields(result,{action:oneOf('confirm','pick','ask'),set:Array.isArray});
    let previous=1;
    for (const [index,member] of (result.set as unknown[]).entries()) {
      if (!object(member)) throw invalid(`set.${index} is not valid`,[`set.${index}`]);
      fields(member,{product_id:text,family,c:probability},{brand:text,model:text,label:text,dimensions:positiveDimensions});
      if (Number(member.c)>previous) throw invalid(`set.${index}.c must be descending`,['c']);
      previous=member.c as number;
    }
  } else if (result.kind==='studio_plan') {
    fields(result,{plan:object});
    const p=result.plan as Record<string,unknown>;
    fields(p,{kind:text,asks:Array.isArray});
    for (const ask of p.asks as unknown[]) {
      if (!object(ask)) throw invalid('asks is not valid',['asks']);
      fields(ask,{type:oneOf('cover','back','tag','graphic','flaw','measure'),text},{zone:text,kind:text,name:text});
    }
  } else {
    fields(result,{photos:Array.isArray});
    for (const photo of result.photos as unknown[]) {
      if (!object(photo)) throw invalid('photos is not valid',['photos']);
      fields(photo,{key:text,role:text,score:v=>number(v) && v>=0 && v<=100,parts:object});
      const parts=photo.parts as Record<string,unknown>;
      fields(parts,{sharpness:probability,exposure:probability,clipping:probability});
      for (const [part,value] of Object.entries(parts)) if (!probability(value)) throw invalid(`${part} is not valid`,[part]);
    }
  }
}
function studioPlan(row:CaptureRow, p:StudioPlan) {
  const kinds:Record<string,{measurements:string[]}> = slides.kinds;
  row.state.studio={requested:true, asks:structuredClone(p.asks), measurements:Object.hasOwn(kinds,p.kind)?[...kinds[p.kind].measurements]:[]};
}
export function applyJobResult(user_id:string, capture_id:string, result:unknown) {
  const current=ownedCapture(user_id,capture_id);
  const log=deps.log.child({user:user_id,capture:capture_id});
  log.input('api','capture.job_result',{kind:object(result)?result.kind:undefined});
  try {
    validateJobResult(result);
    const row=structuredClone(current);
    const state=row.state;
    if (result.kind==='identify') {
      const first=result.set[0];
      if (!row.phone_suggestion && first) state.suggestion={family:first.family,p:first.c,second_p:result.set[1]?.c ?? 0};
      state.candidates={...state.candidates};
      for (const field of ['brand','model'] as const) {
        state.candidates[field]=[...new Set(result.set.flatMap(member=>member[field]===undefined?[]:[member[field]]))];
      }
      const dimensions=result.set.flatMap(member=>member.dimensions?[{label:member.label ?? member.product_id,value:structuredClone(member.dimensions),p:member.c}]:[]);
      state.variants={...state.variants,dimensions:dimensions.length>=2?dimensions:[]};
      if (dimensions.length===1 && result.action==='confirm' && state.facts.dimensions?.source!=='you_said')
        state.facts.dimensions={value:dimensions[0].value,source:'lookup',confidence:dimensions[0].p};
      state.lookups='done';
    } else if (result.kind==='studio_plan') {
      row.studio_plan=structuredClone(result.plan);
      if (state.studio?.requested) studioPlan(row,result.plan);
    } else {
      const selected=select(state,params);
      const keys=selected.process.map(step=>step.key);
      const minimum=params.read('capture_label_sharp_min',{}).value as number;
      for (const photo of result.photos) {
        if (!['tag','care_label','screenshot'].includes(photo.role) || photo.parts.sharpness>=minimum) continue;
        for (const field of selected.rows) if (!state.facts[field.field] && field.ways.some(way=>way.way==='label' && way.view && viewsFor(way.view,keys).includes(photo.key)))
          state.facts[field.field]={value:null,source:'label',confidence:0,unknown_reason:'not_read',step:photo.key};
        state.retakes[photo.key]=row.replacements[photo.key] ?? 0;
      }
    }
    row.version++; row.updated_at=new Date(deps.now()).toISOString();
    const body=view(row);
    captureRows.set(capture_id,row);
    log.event('state.change',{entity:'capture',id:capture_id,to:row.status,kind:result.kind});
    return body;
  } catch (error) {
    log.error('capture.job_result',error);
    throw error;
  }
}

export const handlers: Record<string, Handler> = {
  'POST /v1/captures': captureHandler('POST /v1/captures', async ctx => {
    fields(ctx.body,
      {mode:oneOf('shots','scan','talk'),purpose:oneOf('sell','appraise','find')},
      {first_photo_hint:text,item_id:text,device:v=>object(v) && (v.has_lidar===undefined || bool(v.has_lidar)) && (v.object_capture===undefined || bool(v.object_capture)),
        suggestion:v=>object(v) && family(v.family) && probability(v.p) && probability(v.second_p) && v.second_p<=v.p,
        pieces:v=>integer(v) && v>=1 && v<=12,confirm_mode:oneOf('tap','auto')});
    const device=ctx.body.device as {has_lidar?:boolean;object_capture?:boolean}|undefined;
    if (device?.object_capture && !device.has_lidar) throw answerError('device.object_capture');
    if (ctx.body.item_id) {
      const {ports}=await import('./items.ts');
      if (!await ports.read(ctx.user_id!,ctx.body.item_id as string)) throw new ApiError('not_found','item not found','read');
    }
    const id=ctx.user_id==='usr_8f2k' && !exampleOpened ? open.id : `cap_${++captureNumber}`;
    if (id===open.id) exampleOpened=true;
    const item_id=ctx.body.item_id as string ?? (id===open.id ? open.item_id : `it_${captureNumber}`);
    const state=initial(ctx.body,id,item_id), created_at=new Date(deps.now()).toISOString();
    const row:CaptureRow={id,user_id:ctx.user_id!,item_id:state.item_id,version:1,created_at,updated_at:created_at,data:'captured',state,status:'framing',mode:ctx.body.mode as string,photos:0,replacements:{},phone_suggestion:ctx.body.suggestion!==undefined};
    captureRows.set(id,row);
    ctx.log.event('state.change',{entity:'capture',id,to:row.status});
    return {status:201,body:view(row)};
  }),
  'GET /v1/captures/:id': captureHandler('GET /v1/captures/:id', ctx=>({status:200,body:view(read(ctx))})),
  'POST /v1/captures/:id/photos': captureHandler('POST /v1/captures/:id/photos', ctx=> {
    const row=read(ctx); writable(row);
    fields(ctx.body,{photos:v=>Array.isArray(v) && v.length>0 && v.every(p=>object(p) && text(p.role) && text(p.step) &&
      oneOf('image/heic','image/jpeg','image/png')(p.content_type) && version(p.bytes) &&
      (p.key===undefined || text(p.key)) && (p.reads===undefined || Array.isArray(p.reads) && p.reads.every(validRead)))});
    const uploads=(example('captures.photos').response as {photos:{upload:{expires_at:string}}[]}).photos;
    const photos=(ctx.body.photos as Photo[]).map(photo=> {
      const key=photo.key ?? photo.step;
      const kept=row.state.kept.includes(key);
      row.replacements[key]=(row.replacements[key] ?? 0)+(kept?1:0);
      if (kept && photo.reads?.some(read=>read.unknown_reason==='not_read')) row.state.retakes[key]=row.replacements[key];
      if (!kept) row.state.kept.push(key);
      if (row.state.lookups==='none') row.state.lookups='running';
      for (const read of photo.reads ?? []) {
        const old=row.state.facts[read.field];
        const source=read.source ?? 'label';
        if (!old || old.source!=='you_said' && read.unknown_reason!=='not_read' && (old.unknown_reason==='not_read' || rank[source]>=rank[old.source])) row.state.facts[read.field]={
          value:read.value,source,confidence:read.confidence ?? 0,step:key,
          ...(read.unknown_reason?{unknown_reason:read.unknown_reason}:{}),
        };
      }
      const id=`ph_a${++row.photos}`;
      return {id,role:photo.role,step:photo.step,upload:{url:`https://uploads.example/v/${id}?sig=example`,method:'PUT',expires_at:uploads[0].upload.expires_at}};
    });
    write(ctx,row,'uploading');
    return {status:201,body:{photos,capture:view(row)}};
  }),
  'PATCH /v1/captures/:id': captureHandler('PATCH /v1/captures/:id', ctx=> {
    const row=read(ctx); writable(row);
    fields(ctx.body,{version},{type:family,answer:v=>object(v) && text(v.field) && Object.hasOwn(v,'value'),refuse:text,generate:v=>v===true});
    if (['type','answer','refuse','generate'].filter(key=>ctx.body[key]!==undefined).length!==1) throw invalid('choose exactly one of type, answer, refuse or generate',['type','answer','refuse','generate']);
    checkVersion(ctx,row);
    let field:string|undefined;
    if (ctx.body.type!==undefined) row.state.type=ctx.body.type as Family;
    else if (ctx.body.generate) {
      row.state.studio={requested:true,measurements:[],asks:[]};
      if (row.studio_plan) studioPlan(row,row.studio_plan);
    } else {
      const answer=ctx.body.answer as {field:string;value:unknown}|undefined;
      field=answer?.field ?? ctx.body.refuse as string;
      const current=plan(row.state,params);
      if (!current.questions.some(q=>q.field===field && q.kind!=='shot')) throw answerError(field);
      if (answer) {
        const definition=select(row.state,params).rows.find(r=>r.field===field)!;
        if (!validValue(definition,answer.value)) throw answerError(field);
        row.state.facts[field]={value:structuredClone(answer.value),source:'you_said',confidence:1,confirmed:true};
        if (field==='type') row.state.type=answer.value as Family;
      } else row.state.refused.push(field);
    }
    write(ctx,row,plan(row.state,params).status==='shooting'?'shooting':row.status,field?{field}:{});
    return {status:200,body:{...view(row),item:{id:row.state.item_id,category:row.state.type}}};
  }),
  'POST /v1/captures/:id/finish': captureHandler('POST /v1/captures/:id/finish', ctx=> {
    const row=read(ctx); writable(row); fields(ctx.body,{version},{note:text}); checkVersion(ctx,row);
    write(ctx,row,'judged');
    return {status:202,body:{...structuredClone(example('captures.finish').response as Record<string,unknown>),capture:view(row),item:{id:row.state.item_id,state:'researching'}}};
  }),
  'POST /v1/captures/:id/talk': exampleHandler('POST /v1/captures/:id/talk', c=>fields(c.body,{voice:bool})),
};
export const manifest = manifestFor(handlers);
