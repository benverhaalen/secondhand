// Rests-on: spec/product.md §7 Resources; spec/engines/capture.md §§2,5,6,8,11; spec/examples/captures.json.
// Realtime credentials remain contract examples.
// The shared example boundary stays here until the contract layer's owner can move it to http.ts.
import { ApiError, deps as sharedDeps, paramsOf, served, type Ctx, type Handler, type Reply } from './http.ts';
import { photos as photoStore } from './uploads.ts';
import { EXAMPLES, example, type Example } from './examples.ts';
import { FAMILIES, type Family } from '../../engines/capture/process.ts';
import { plan, type State, type Fact } from '../../engines/capture/plan.ts';
import { select } from '../../engines/capture/select.ts';
import type { StudioAsk } from '../../engines/capture/select.ts';
import { fieldState, viewsFor } from '../../engines/capture/fields.ts';
import { bound, table, type FieldRow, type Site } from '../../engines/capture/table.ts';
import { mergeAttribute, type Attribute } from '../card/card.ts';
import type { AttributeEvidence } from '../../engines/proof/proof.ts';
import { memoryStore } from '../../engines/param/param.ts';
import { SITES } from '../../../../spec/sites.mjs';
import slides from '../../../../jobs/studio/slides.json' with { type: 'json' };
import { identify, type IdentifyInput, type IdentifyPorts, type Stage } from '../../engines/capture/identify/identify.ts';
import { classify, siteRows } from '../../engines/listing/classify.ts';
import type { AspectsReply } from '../../engines/listing/aspects.ts';
import type { Blobs } from '../store/blobs.ts';
import { jobs } from './jobs.ts';

// The server composes ports on the same dependency object used by the API routes.
export const deps = sharedDeps as typeof sharedDeps & {
  identifyPorts?: IdentifyPorts;
  listingAspects?: Partial<Record<Site, AspectsReply>>;
};

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

export type CaptureRow = { id: string; user_id: string; item_id: string; version: number; created_at: string; updated_at: string; data: 'example' | 'captured'; state: State; status: 'framing' | 'shooting' | 'uploading' | 'judged'; mode: string; photos: number; replacements: Record<string,number>; phone_suggestion: boolean; studio_plan?: StudioPlan; intent?: 'sell' | 'worth' | 'track' | 'find'; lookup_hidden?: boolean; photo_rows?: KeptPhoto[]; identify_job_id?: string; identify_empty?: boolean; visual_retry?: boolean };
const open = example('captures.open').response as {id: string; item_id: string; created_at: string; picker: string[]};
const linkedSites = (example('accounts.list').response as {data: {site: string}[]}).data
  .map(account => account.site).filter((site): site is Site => SITES.includes(site));
function liveCaptures() {
  const params = memoryStore();
  params.declare({name:'capture_label_sharp_min', family:'scalar', prior:.5});
  return {rows:new Map<string,CaptureRow>(),identifyRuns:new Map<string,Promise<void>>(),
    generation:0,number:0,exampleOpened:false,subscriptions:new WeakSet<Blobs>(),params};
}
const shared = globalThis as { __secondhandCaptures?: ReturnType<typeof liveCaptures> };
const firstLoad = shared.__secondhandCaptures === undefined;
const captures = shared.__secondhandCaptures ??= liveCaptures();
export const captureRows = captures.rows;
function initial(body: Record<string, unknown>, id: string, item_id: string): State {
  const device = body.device as {has_lidar?: boolean; object_capture?: boolean} | undefined;
  const has_lidar = device?.has_lidar ?? false;
  return { capture_id: id, item_id,
    purpose: body.purpose as State['purpose'], confirm_mode: body.confirm_mode as State['confirm_mode'] ?? 'tap',
    has_lidar, object_capture: device?.object_capture ?? false, sites: [...linkedSites], type: null,
    ...(body.suggestion === undefined ? {} : {suggestion: structuredClone(body.suggestion) as State['suggestion']}),
    ...(body.pieces === undefined ? {} : {pieces: body.pieces as number}),
    ...(body.extent_cm === undefined ? {} : {extent_cm: body.extent_cm as number}),
    ...(body.rigid === undefined ? {} : {rigid: body.rigid as boolean}),
    kept: [], retakes: {}, facts: {}, lookups: 'none', refused: [] };
}
export function resetCaptures() {
  captures.generation++;captures.identifyRuns.clear();
  captures.rows.clear();
  captures.number = 0; captures.exampleOpened = false;
  const state=initial(example('captures.open').request!.body as Record<string, unknown>,open.id,open.item_id);
  captures.rows.set(open.id, {id:open.id,user_id:'usr_8f2k',item_id:state.item_id,version:1,created_at:open.created_at,updated_at:open.created_at,data:'example',state,status:'framing',mode:'shots',photos:0,replacements:{},phone_suggestion:true});
}
if (firstLoad) resetCaptures();
function read(ctx: Ctx): CaptureRow {
  return ownedCapture(ctx.user_id!,ctx.params.id);
}
function ownedCapture(user_id: string, capture_id: string): CaptureRow {
  const row = captures.rows.get(capture_id);
  if (!row || row.user_id !== user_id) throw new ApiError('not_found', 'capture not found', 'read');
  return row;
}
function effectiveState(row: CaptureRow): State {
  const state=row.state;
  return state.lookups==='running' && (state.lookups_at===undefined ||
    deps.now()-Date.parse(state.lookups_at)>=bound(captures.params,'capture_lookup_wait_s')*1000) ? {...state,lookups:'done'} : state;
}
function view(row: CaptureRow) {
  const next = plan(effectiveState(row), captures.params);
  return {id: row.state.capture_id, item_id: row.state.item_id, state: row.status, mode: row.mode, purpose: row.state.purpose, intent: row.intent ?? 'sell',
    type: row.state.type, suggested_type: row.state.suggestion?.family ?? null, picker: open.picker,
    process: next.process, coverage: {needed: next.process.map(step => step.key).filter(key => !row.state.kept.includes(key)), kept: [...row.state.kept]},
    created_at: row.created_at, version: row.version, plan: next};
}
function write(ctx: Pick<Ctx,'log'>, row: CaptureRow, status: CaptureRow['status'], detail: Record<string,unknown> = {}) {
  const was=row.status;
  row.status = status; row.version++; row.updated_at = new Date(deps.now()).toISOString();
  if (was!==status) ctx.log.event('state.change', {entity: 'capture', id: row.state.capture_id, was, to: status, ...detail});
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
      value.length<=(row.max ?? row.values?.length ?? Infinity) &&
      (row.values ? value.every(v=>row.values!.includes(v)) : value.every(text));
  }
}
type PhotoRead = {field: string; value: unknown; source?: 'seen'|'label'|'measured'; confidence?: number; unknown_reason?: 'not_read'};
type Scan = {scan_ok: boolean; extent_cm: {width:number;depth:number;height:number}; extent_conf:number; frames:number};
type KeptPhoto = {id: string; key: string; role: string; read_text?: {line:string;confidence:number}[]; codes?: {symbology:string;payload:string}[]};
type Photo = {text?: {line:string;confidence:number}[]; codes?: {symbology:string;payload:string}[]; role: string; step: string; content_type: 'image/heic' | 'image/jpeg' | 'image/png'; bytes: number; key?: string; reads?: PhotoRead[]; scan?:Scan};
const positive = (v: unknown): v is number => number(v) && v>0;
function validScan(v:unknown): boolean {
  if (!object(v) || !object(v.extent_cm)) return false;
  const extent=v.extent_cm;
  return bool(v.scan_ok) && ['width','depth','height'].every(part=>positive(extent[part])) && probability(v.extent_conf) && integer(v.frames);
}
function validRead(v: unknown): boolean {
  return object(v) && text(v.field) && Object.hasOwn(v, 'value') && (v.value === null
    ? v.unknown_reason === 'not_read' && v.source === undefined && v.confidence === undefined
    : v.unknown_reason === undefined && oneOf('seen', 'label', 'measured')(v.source) && probability(v.confidence));
}
const rank: Record<Fact['source'], number> = {seen: 0, label: 1, measured: 2, derived: 3, lookup: 4, you_said: 5};
function applyRead(state:State, read:PhotoRead, key:string) {
  const old=state.facts[read.field];
  const source=read.source ?? 'label';
  if (!old || old.source!=='you_said' && !old.confirmed && read.unknown_reason!=='not_read' && (old.unknown_reason==='not_read' || rank[source]>=rank[old.source])) state.facts[read.field]={
    value:structuredClone(read.value),source,confidence:read.confidence ?? 0,step:key,
    ...(read.unknown_reason?{unknown_reason:read.unknown_reason}:{}),
  };
}

type IdentifyMember = {product_id:string;family:Family|null;kind?:string;brand?:string;model?:string;c:number;label?:string;dimensions?:Record<string,number>;rests_on?:string[]};
export type IdentifyResult = {kind:'identify';action:'confirm'|'pick'|'ask';set:IdentifyMember[];others?:IdentifyMember[];facts?:{field:string;value:unknown;source:'label';confidence:number;ref?:string}[]};
export type StudioPlan = {kind:string;asks:StudioAsk[]};
export type JobResult = IdentifyResult | {kind:'studio_plan';plan:StudioPlan} | {kind:'photo_score';photos:{key:string;role:string;score:number;parts:{sharpness:number;exposure:number;clipping:number;[part:string]:number}}[]};
const positiveDimensions = (v:unknown): v is Record<string,number> => object(v) && Object.keys(v).length>0 && Object.values(v).every(n=>number(n) && n>0);
function validateJobResult(result: unknown): asserts result is JobResult {
  if (!object(result)) throw invalid('result is not valid',['result']);
  fields(result,{kind:oneOf('identify','studio_plan','photo_score')});
  if (result.kind==='identify') {
    fields(result,{action:oneOf('confirm','pick','ask'),set:Array.isArray},{others:Array.isArray,facts:Array.isArray});
    for (const name of ['set','others'] as const) {
      let previous=1;
      for (const [index,member] of ((result[name] ?? []) as unknown[]).entries()) {
        if (!object(member)) throw invalid(`${name}.${index} is not valid`,[`${name}.${index}`]);
        fields(member,{product_id:text,family:v=>v===null || family(v),c:probability},{kind:text,brand:text,model:text,label:text,dimensions:positiveDimensions,
          rests_on:v=>Array.isArray(v) && v.length>=1 && v.length<=6 && v.every(r=>text(r) && r.length<=120)});
        if (Number(member.c)>previous) throw invalid(`${name}.${index}.c must be descending`,['c']);
        previous=member.c as number;
      }
    }
    for (const fact of (result.facts ?? []) as unknown[]) {
      if (!object(fact)) throw invalid('facts is not valid',['facts']);
      fields(fact,{field:text,source:v=>v==='label',confidence:probability},{ref:text});
      if (fact.value===null || fact.unknown_reason!==undefined) throw invalid('fact is not read',['facts']);
    }
  } else if (result.kind==='studio_plan') {
    fields(result,{plan:object});
    const p=result.plan as Record<string,unknown>;
    fields(p,{kind:text,asks:Array.isArray});
    for (const ask of p.asks as unknown[]) {
      if (!object(ask)) throw invalid('asks is not valid',['asks']);
      fields(ask,{type:oneOf('cover','back','tag','graphic','flaw','measure'),text},{zone:text,kind:text,name:text});
      if (ask.type==='graphic' || ask.type==='flaw') fields(ask,{zone:text});
      if (ask.type==='flaw') fields(ask,{kind:text});
      if (ask.type==='measure') {
        fields(ask,{name:text});
        const kinds:Record<string,{measurements:string[]}>=slides.kinds;
        if (Object.hasOwn(kinds,p.kind as string) && !kinds[p.kind as string].measurements.includes(ask.name as string))
          throw invalid('name is not a measurement for this kind',['name']);
      }
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
    writable(current);
    validateJobResult(result);
    if (result.kind==='identify') for (const fact of result.facts ?? []) {
      const definition=select(current.state,captures.params).rows.find(row=>row.field===fact.field);
      if (!definition || !validValue(definition,fact.value)) throw invalid('identify fact does not fit field row',[fact.field]);
    }
    if (result.kind==='photo_score') for (const photo of result.photos)
      if (!current.state.kept.includes(photo.key)) throw invalid(`${photo.key} was not kept`,[photo.key]);
    const row=structuredClone(current);
    const state=row.state;
    if (result.kind==='identify') {
      const first=result.set[0];
      if (!row.phone_suggestion && first?.family) state.suggestion={family:first.family,p:first.c,second_p:result.set[1]?.c ?? 0};
      if (!state.kind && result.action==='confirm' && result.set.length===1 && first?.kind) state.kind=first.kind;
      for (const fact of result.facts ?? []) applyRead(state,fact,fact.ref ?? 'tag');
      const members=[...result.set,...result.others ?? []];
      state.candidates={...state.candidates};
      state.candidate_detail={...state.candidate_detail};
      for (const field of ['brand','model'] as const) {
        state.candidates[field]=[...new Set(members.flatMap(member=>member[field]===undefined?[]:[member[field]]))];
        const detail:Record<string,{c:number;rests_on:string[]}>={};
        for (const member of members) {
          const value=member[field];
          if (value!==undefined && (!detail[value] || detail[value].c<member.c)) detail[value]={c:member.c,rests_on:[...member.rests_on ?? []]};
        }
        state.candidate_detail[field]=detail;
      }
      const brand=state.facts.brand;
      if (result.action==='confirm' && result.set.length===1 && first.brand!==undefined && brand?.source!=='you_said' && !brand?.confirmed &&
        (!brand || brand.unknown_reason==='not_read' || brand.source==='lookup' || brand.confidence<first.c))
        state.facts.brand={value:first.brand,source:'lookup',confidence:first.c};
      const dimensions=result.set.flatMap(member=>member.dimensions?[{label:member.label ?? member.product_id,value:structuredClone(member.dimensions),p:member.c}]:[]);
      state.variants={...state.variants,dimensions:dimensions.length>=2?dimensions:[]};
      if (dimensions.length===1 && result.action==='confirm' && state.facts.dimensions?.source!=='you_said' && !state.facts.dimensions?.confirmed)
        state.facts.dimensions={value:dimensions[0].value,source:'lookup',confidence:dimensions[0].p};
      state.lookups='done';
      classifyCapture(state);
    } else if (result.kind==='studio_plan') {
      row.studio_plan=structuredClone(result.plan);
      if (state.studio?.requested) studioPlan(row,result.plan);
    } else {
      const selected=select(state,captures.params);
      const keys=selected.process.map(step=>step.key);
      const minimum=captures.params.read('capture_label_sharp_min',{}).value as number;
      for (const photo of result.photos) {
        if (!['tag','care_label','screenshot'].includes(photo.role) || photo.parts.sharpness>=minimum) continue;
        for (const field of selected.rows) if (!state.facts[field.field] && field.ways.some(way=>way.way==='label' && way.view && viewsFor(way.view,keys).includes(photo.key)))
          state.facts[field.field]={value:null,source:'label',confidence:0,unknown_reason:'not_read',step:photo.key};
        state.retakes[photo.key]=row.replacements[photo.key] ?? 0;
      }
    }
    row.version++; row.updated_at=new Date(deps.now()).toISOString();
    const body=view(row);
    captures.rows.set(capture_id,row);
    if (current.status!==row.status) log.event('state.change',{entity:'capture',id:capture_id,was:current.status,to:row.status,kind:result.kind});
    return body;
  } catch (error) {
    log.error('capture.job_result',error);
    throw error;
  }
}

function validAnswer(state:State, field:string, value:unknown, definition?:FieldRow):boolean {
  if (definition) return validValue(definition,value);
  const rows=(state.site_rows ?? []).filter(row=>row.field===field && state.sites.includes(row.site));
  return rows.length>0 && rows.every(row=>row.allowed ? row.allowed.includes(value as string) : text(value) && value.length<=(row.max_length ?? Infinity));
}
function classifyCapture(state:State) {
  const selected=select(state,captures.params);
  state.site_rows=siteRows(classify({family:selected.family,kind:state.kind ?? selected.family,attrs:state.facts},state.sites,{params:captures.params,aspects:deps.listingAspects}));
}
export function pendingIdentify(user_id:string, capture_id:string):Promise<void>|undefined {
  ownedCapture(user_id,capture_id);
  return captures.identifyRuns.get(capture_id);
}
function subscribeUploads(blobs:Blobs) {
  if (captures.subscriptions.has(blobs)) return;
  captures.subscriptions.add(blobs);
  blobs.onUploaded(event=> {
    const row=captures.rows.get(event.capture_id);
    if (!row || row.user_id!==event.user_id || row.status==='judged' || row.visual_retry || !deps.identifyPorts?.visual ||
      !row.photo_rows?.some(photo=>photo.id===event.photo_id && photo.role==='front')) return;
    const first=captures.identifyRuns.get(row.id);
    if (!first) return;
    const retry=first.then(()=> {
      const current=captures.rows.get(row.id);
      if (!current || current.user_id!==event.user_id || current.status==='judged' || current.visual_retry || !current.identify_empty) return;
      current.visual_retry=true;
      return startIdentify(current,deps.log);
    }).catch(error=>deps.log.error('capture.upload_identify',error));
    captures.identifyRuns.set(row.id,retry);
  });
}
function startIdentify(row:CaptureRow, parent:Ctx['log']):Promise<void> {
  const generation=captures.generation;
  const started_at=new Date(deps.now()).toISOString();
  const job=jobs.start({id:`job_${crypto.randomUUID().replaceAll('-','')}`,kind:'identify',item_id:row.item_id,args:{capture_id:row.id},state:'running',created_at:started_at},row.user_id);
  row.identify_job_id=job.id;row.state.lookups='running';row.state.lookups_at=started_at;
  const log=parent.child({user:row.user_id,capture:row.id,job:job.id});
  log.job(job.id,'identify','running');
  jobs.append(job.id,'job.state',{job_id:job.id,kind:'identify',state:'running',at:started_at});
  // Starting on the next turn keeps the request independent of the in-process work.
  const task=new Promise<void>(resolve=>setImmediate(resolve)).then(async()=> {
    let emptySet:boolean|undefined;
    try {
      if (generation!==captures.generation) throw new ApiError('stale','capture changed','state_check');
      const snapshot=structuredClone(row);
      const blobs=photoStore();
      const input:IdentifyInput={capture_id:row.id,family:snapshot.state.type ?? snapshot.state.suggestion?.family ?? null,
        ...(snapshot.state.kind?{kind:snapshot.state.kind}:{}),photos:[]};
      for (const photo of snapshot.photo_rows ?? []) {
        if (!snapshot.state.kept.includes(photo.key)) continue;
        const blob=await blobs.read(snapshot.user_id,photo.id);
        input.photos.push({key:photo.key,role:photo.role,
          ...(photo.read_text!==undefined?{text:photo.read_text}:{}),...(photo.codes!==undefined?{codes:photo.codes}:{}),
          ...(blob?{file_ref:`data:${blob.content_type};base64,${Buffer.from(blob.bytes).toString('base64')}`}:{})});
      }
      const stages:Stage[]=[];
      const stageLog:Ctx['log']={...log,stage(_id,name,detail={}) {
        const stage:Stage={name,state:detail.state as Stage['state'],found:detail.found as Record<string,unknown>};
        stages.push(stage);
        jobs.update(job.id,{stages:structuredClone(stages)});
        jobs.append(job.id,'job.stage',{job_id:job.id,...stage});
        log.stage(job.id,name,detail);
      }};
      const result=await identify(input,deps.identifyPorts ?? {},captures.params,stageLog);
      emptySet=result.set.length===0;
      const failed=result.stages.find(stage=>stage.state==='failed');
      if (failed) throw new Error(String(failed.found.reason ?? `identify ${failed.name} failed`));
      if (generation!==captures.generation || ownedCapture(row.user_id,row.id).identify_job_id!==job.id) throw new ApiError('stale','capture changed','state_check');
      const rows=select(ownedCapture(row.user_id,row.id).state,captures.params).rows;
      const facts=result.facts.flatMap(fact=> {
        const definition=rows.find(row=>row.field===fact.field);
        const value=definition?.type==='list' ? [fact.value] : fact.value;
        if (!definition || !validValue(definition,value)) {
          log.note('capture read dropped',{field:fact.field,reason:definition?'value does not fit field row':'no field row'});
          return [];
        }
        return [{...fact,value}];
      });
      applyJobResult(row.user_id,row.id,{...result,facts});
      const current=ownedCapture(row.user_id,row.id);
      if (current.identify_empty===undefined) current.identify_empty=result.set.length===0;
      jobs.finish(job.id,{action:result.action,set_count:result.set.length,others_count:result.others.length,fact_count:facts.length});
      log.job(job.id,'identify','done');
    } catch (error) {
      const reason=error instanceof ApiError && error.code==='stale' ? 'stale' : error instanceof Error ? error.message : 'identify failed';
      const current=captures.rows.get(row.id);
      if (generation===captures.generation && current && current.user_id===row.user_id && current.status!=='judged' && current.identify_job_id===job.id) {
        if (current.identify_empty===undefined && emptySet!==undefined) current.identify_empty=emptySet;
        current.state.lookups='done';current.version++;current.updated_at=new Date(deps.now()).toISOString();
      }
      log.error('capture.identify',error,{reason});
      jobs.update(job.id,{state:'failed',reason,error:{code:reason==='stale'?'stale':'identify_failed',message:reason}});
      jobs.append(job.id,'job.state',{job_id:job.id,kind:'identify',state:'failed',reason});
      log.job(job.id,'identify','failed',{reason});
    }
  });
  const pending=task.catch(error=>log.error('capture.identify_background',error));
  captures.identifyRuns.set(row.id,pending);
  return pending;
}

export const handlers: Record<string, Handler> = {
  'POST /v1/captures': captureHandler('POST /v1/captures', async ctx => {
    fields(ctx.body,
      {mode:oneOf('shots','scan','talk')},
      {purpose:oneOf('sell','appraise','find'),first_photo_hint:text,item_id:text,device:v=>object(v) && (v.has_lidar===undefined || bool(v.has_lidar)) && (v.object_capture===undefined || bool(v.object_capture)),
        suggestion:v=>object(v) && family(v.family) && probability(v.p) && probability(v.second_p) && v.second_p<=v.p,
        pieces:v=>integer(v) && v>=1 && v<=12,confirm_mode:oneOf('tap','auto'),extent_cm:positive,extent_conf:probability,rigid:bool,intent:oneOf('sell','worth','track','find')});
    const purposeFor = {sell:'sell',worth:'appraise',track:'find',find:'find'} as const;
    const intent=ctx.body.intent as keyof typeof purposeFor|undefined;
    if (intent && ctx.body.purpose!==undefined && ctx.body.purpose!==purposeFor[intent]) throw invalid('intent and purpose disagree',['intent','purpose']);
    if (!intent && ctx.body.purpose===undefined) throw invalid('purpose or intent is required',['purpose']);
    const body={...ctx.body,purpose:intent ? purposeFor[intent] : ctx.body.purpose};
    const device=ctx.body.device as {has_lidar?:boolean;object_capture?:boolean}|undefined;
    if (device?.object_capture && !device.has_lidar) throw answerError('device.object_capture');
    if (ctx.body.item_id) {
      const {ports}=await import('./items.ts');
      if (!await ports.read(ctx.user_id!,ctx.body.item_id as string)) throw new ApiError('not_found','item not found','read');
    }
    const id=ctx.user_id==='usr_8f2k' && !captures.exampleOpened ? open.id : `cap_${++captures.number}`;
    if (id===open.id) captures.exampleOpened=true;
    const item_id=ctx.body.item_id as string ?? (id===open.id ? open.item_id : `it_${captures.number}`);
    const state=initial(body,id,item_id), created_at=new Date(deps.now()).toISOString();
    const row:CaptureRow={id,user_id:ctx.user_id!,item_id:state.item_id,version:1,created_at,updated_at:created_at,data:'captured',state,status:'framing',mode:ctx.body.mode as string,photos:0,replacements:{},phone_suggestion:ctx.body.suggestion!==undefined,intent:(ctx.body.intent as CaptureRow['intent']) ?? 'sell'};
    captures.rows.set(id,row);
    ctx.log.event('state.change',{entity:'capture',id,was:null,to:row.status});
    return {status:201,body:view(row)};
  }),
  'GET /v1/captures/:id': captureHandler('GET /v1/captures/:id', ctx=>({status:200,body:view(read(ctx))})),
  'POST /v1/captures/:id/photos': captureHandler('POST /v1/captures/:id/photos', ctx=> {
    const row=read(ctx); writable(row);
    fields(ctx.body,{photos:v=>Array.isArray(v) && v.length>0 && v.every(p=>object(p) && text(p.role) && text(p.step) &&
      oneOf('image/heic','image/jpeg','image/png')(p.content_type) && version(p.bytes) &&
      (p.key===undefined || text(p.key)) && (p.reads===undefined || Array.isArray(p.reads) && p.reads.every(validRead)) &&
      (p.scan===undefined || validScan(p.scan)) && (p.depth_ref===undefined || typeof p.depth_ref==='string') && (p.pose_ref===undefined || typeof p.pose_ref==='string'))});
    for (const photo of ctx.body.photos as Record<string,unknown>[]) {
      if (photo.text!==undefined && (!['tag','care_label','size_label','read'].includes(String(photo.role)) ||
        !Array.isArray(photo.text) || photo.text.length>200 || !photo.text.every(line=>object(line) && typeof line.line==='string' && line.line.length>=1 && line.line.length<=200 && probability(line.confidence)))) throw answerError('text');
      if (photo.codes!==undefined && (!Array.isArray(photo.codes) || photo.codes.length>10 || !photo.codes.every(code=>object(code) && text(code.symbology) && typeof code.payload==='string' && code.payload.length>=1 && code.payload.length<=64))) throw answerError('codes');
    }
    const wasShooting=plan(effectiveState(row),captures.params).status==='shooting';
    const retake=(ctx.body.photos as Photo[]).some(photo=>row.state.kept.includes(photo.key ?? photo.step) && ['tag','care_label','size_label'].includes(photo.role));
    subscribeUploads(photoStore());
    // shortcut: depth_ref and pose_ref are validated but not stored, store them when integration adds the photo table (F5).
    const uploads=(example('captures.photos').response as {photos:{upload:{expires_at:string}}[]}).photos;
    const photos=(ctx.body.photos as Photo[]).map(photo=> {
      const key=photo.key ?? photo.step;
      const selected=select(row.state,captures.params);
      const reads=(photo.reads ?? []).filter(read=> {
        const definition=selected.rows.find(field=>field.field===read.field);
        const reason=!definition?'no field row':read.value!==null && !validValue(definition,read.value)?'value does not fit field row':undefined;
        if (reason) ctx.log.note('capture read dropped',{field:read.field,reason});
        return !reason;
      });
      const kept=row.state.kept.includes(key);
      row.replacements[key]=(row.replacements[key] ?? 0)+(kept?1:0);
      if (kept && reads.some(read=>read.unknown_reason==='not_read')) row.state.retakes[key]=row.replacements[key];
      if (!kept) row.state.kept.push(key);
      if (row.state.lookups==='none') {
        row.state.lookups='running';
        row.state.lookups_at=new Date(deps.now()).toISOString();
        ctx.log.note('capture lookups started',{at:row.state.lookups_at});
      }
      for (const read of reads) applyRead(row.state,read,key);
      if (photo.scan && selected.process.some(step=>step.key===key && step.kind==='scan')) {
        if (!photo.scan.scan_ok) row.state.object_capture=false;
        else {
          const field=key.includes('.')?`dimensions.${key.split('.').at(-1)}`:'dimensions';
          const definition=selected.rows.find(row=>row.field===field);
          const value=Object.fromEntries(Object.entries(photo.scan.extent_cm).filter(([part])=>definition?.ask?.parts?.includes(part)));
          if (definition && validValue(definition,value))
            applyRead(row.state,{field,value,source:'measured',confidence:photo.scan.extent_conf},key);
          else ctx.log.note('capture read dropped',{field,reason:definition?'scan does not fill field parts':'no field row'});
        }
      }
      const id=`ph_a${++row.photos}`;
      // A captured row gets a real single-use target in the photo store; an example row keeps the contract's address.
      const upload=row.data==='example' ? {url:`https://uploads.example/v/${id}?sig=example`,method:'PUT' as const,expires_at:uploads[0].upload.expires_at}
        : photoStore().target({user_id:row.user_id,capture_id:row.id,photo_id:`${row.id}-${id}`,content_type:photo.content_type,max_bytes:photo.bytes});
      const stored:KeptPhoto={id:`${row.id}-${id}`,key,role:photo.role,
        ...(photo.text!==undefined && photo.role!=='read'?{read_text:structuredClone(photo.text)}:{}),
        ...(photo.codes!==undefined?{codes:structuredClone(photo.codes)}:{})};
      row.photo_rows=(row.photo_rows ?? []).filter(p=>p.key!==key);row.photo_rows.push(stored);
      return {id,role:photo.role,step:photo.step,upload};
    });
    write(ctx,row,'uploading');
    if (retake || wasShooting && select(row.state,captures.params).process.every(step=>row.state.kept.includes(step.key))) startIdentify(row,ctx.log);
    return {status:201,body:{photos,capture:view(row)}};
  }),
  'PATCH /v1/captures/:id': captureHandler('PATCH /v1/captures/:id', ctx=> {
    const row=read(ctx); writable(row);
    fields(ctx.body,{version},{type:family,answer:v=>object(v) && text(v.field) && Object.hasOwn(v,'value') && (v.ask_id===undefined || text(v.ask_id)),edit:v=>object(v) && text(v.field) && Object.hasOwn(v,'value'),refuse:text,generate:v=>v===true});
    if (['type','answer','edit','refuse','generate'].filter(key=>ctx.body[key]!==undefined).length!==1) throw invalid('choose exactly one of type, answer, edit, refuse or generate',['type','answer','edit','refuse','generate']);
    checkVersion(ctx,row);
    let field:string|undefined;
    if (ctx.body.type!==undefined) row.state.type=ctx.body.type as Family;
    else if (ctx.body.generate) {
      row.state.studio={requested:true,measurements:[],asks:[]};
      if (row.studio_plan) studioPlan(row,row.studio_plan);
    } else {
      const answer=(ctx.body.answer ?? ctx.body.edit) as {field:string;value:unknown;ask_id?:string}|undefined;
      field=answer?.field ?? ctx.body.refuse as string;
      const current=plan(effectiveState(row),captures.params);
      if (answer?.ask_id!==undefined && !current.questions.some(q=>q.id===answer.ask_id && q.field===field)) throw new ApiError('stale','the question changed','question_check');
      if (ctx.body.edit) {
        const selected=select(row.state,captures.params);
        const definition=selected.rows.find(r=>r.field===field);
        const held=definition ? fieldState(definition,row.state,selected.process.map(step=>step.key),captures.params).fact?.value :
          row.state.facts[field]?.value ?? row.state.site_rows?.find(r=>r.field===field && row.state.sites.includes(r.site))?.value;
        if (held===undefined || held===null) throw answerError(field);
      } else if (!current.questions.some(q=>q.field===field && q.kind!=='shot')) throw answerError(field);
      if (answer) {
        const definition=select(row.state,captures.params).rows.find(r=>r.field===field);
        if (!validAnswer(row.state,field,answer.value,definition)) throw answerError(field);
        row.state.facts[field]={value:structuredClone(answer.value),source:'you_said',confidence:1,confirmed:true};
        row.state.refused=row.state.refused.filter(refused=>refused!==field);
        if (field==='type') row.state.type=answer.value as Family;
      } else row.state.refused.push(field);
    }
    if (field) ctx.log.note('capture field updated',{field});
    write(ctx,row,plan(effectiveState(row),captures.params).status==='shooting'?'shooting':row.status,field?{field}:{});
    return {status:200,body:{...view(row),item:{id:row.state.item_id,category:row.state.type}}};
  }),
  'POST /v1/captures/:id/finish': captureHandler('POST /v1/captures/:id/finish', async ctx=> {
    const {runtime}=await import('./runtime.ts');
    const row=read(ctx); writable(row); fields(ctx.body,{version},{note:text}); checkVersion(ctx,row);
    if (row.data==='captured' && !row.identify_job_id) startIdentify(row,ctx.log);
    const at=new Date(deps.now()).toISOString();
    const state=effectiveState(row), selected=select(state,captures.params), keys=selected.process.map(step=>step.key);
    const sources:Record<Fact['source'],Attribute['source']>={label:'label',measured:'measured',lookup:'spec',you_said:'you_said',seen:'inferred',derived:'inferred'};
    const kinds:Record<Fact['source'],AttributeEvidence['kind']>={you_said:'owner',label:'label_text',measured:'depth',lookup:'lookup',seen:'image_region',derived:'image_region'};
    await ctx.log.call('db','capture.finish_item',{item_id:row.item_id},()=> {
      runtime.store.tx(st=> {
        const current=st.get('item',row.user_id,row.item_id);
        const attributes=[...(current?.attributes as Attribute[] ?? [])];
        for (const field of selected.rows) {
          if (field.field==='type' || field.field==='lot_count') continue;
          const resolution=fieldState(field,state,keys,captures.params);
          if (resolution.state!=='known') continue;
          const fact=resolution.fact!;
          const next:Attribute={name:field.field,value:structuredClone(fact.value),source:sources[fact.source],confidence:fact.confidence,
            confirmed:fact.confirmed===true || fact.source==='you_said',method:fact.source,at,
            evidence:[{kind:kinds[fact.source],ref:`${row.id}/${fact.step ?? field.field}`,captured_at:at,extractor_version:`capture.v${table.version}`}]};
          const index=attributes.findIndex(attribute=>attribute.name===next.name);
          const merged=mergeAttribute(index<0?next:attributes[index],next,next.source==='you_said'?'user':'auto');
          if (index<0) attributes.push(merged); else attributes[index]=merged;
        }
        st.put('item',current?{...current,attributes,updated_at:at}:{id:row.item_id,user_id:row.user_id,title:'',state:'researching',origin:'capture',data:'captured',quantity:row.state.pieces ?? 1,attributes,photos:[],created_at:at,updated_at:at});
      });
      write(ctx,row,'judged');
    },()=>({item_id:row.item_id}));
    return {status:202,body:{...structuredClone(example('captures.finish').response as Record<string,unknown>),capture:view(row),item:{id:row.state.item_id,state:'researching'},...(row.data==='captured'?{jobs:[{id:row.identify_job_id,kind:'identify',stream:`/v1/jobs/${row.identify_job_id}/events`}]}:{})}};
  }),
  'POST /v1/captures/:id/talk': exampleHandler('POST /v1/captures/:id/talk', c=>fields(c.body,{voice:bool})),
};
export const manifest = manifestFor(handlers);
