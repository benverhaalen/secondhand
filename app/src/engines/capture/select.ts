import { processFor, type Family, type Step } from './process.ts';
import { SITES } from '../../../../spec/sites.mjs';
import { table, rowsFor, classFor, bound, compare, type Site, type DimensionClass, type Target } from './table.ts';
import type { ParamStore } from '../param/param.ts';
export type Fact = { value: unknown; source: 'seen'|'label'|'measured'|'derived'|'lookup'|'you_said'; confidence: number;
  confirmed?: boolean; unknown_reason?: 'not_read'; step?: string; note?: string };
export type StudioAsk = {type:'cover'|'back'|'tag'|'graphic'|'flaw'|'measure'; text:string; zone?:string; kind?:string; name?:string};
export const studioStep = (ask: StudioAsk): string => ['graphic','flaw'].includes(ask.type) ? `${ask.type}:${ask.zone}` : ask.type;
export const targets = (state: State): Target[] => state.studio?.requested ? [...state.sites,'studio'] : [...state.sites];
export type State = {
  capture_id: string; item_id: string; purpose: 'sell'|'appraise'|'find'; confirm_mode: 'tap'|'auto'; has_lidar: boolean; object_capture?: boolean;
  sites: Site[]; type: Family|null; suggestion?: {family: Family; p: number; second_p: number}; kind?: string;
  extent_cm?: number; rigid?: boolean; pieces?: number; kept: string[]; retakes: Record<string,number>;
  variants?: {dimensions?: {label:string;value:Record<string,number>;p:number}[]};
  studio?: {requested:boolean;measurements:string[];asks:StudioAsk[]};
  facts: Record<string,Fact>; candidates?: Record<string,string[]>; lookups: 'none'|'running'|'done';
  profile?: {handover?: 'pickup'|'delivery'|'either'}; refused: string[]; recall_flag?: boolean;
};
export function suggestionPasses(state: State, params: ParamStore): boolean {
  return !!state.suggestion && state.suggestion.p >= bound(params,'capture_preselect_floor') &&
    state.suggestion.p-state.suggestion.second_p+Number.EPSILON >= bound(params,'assist_preselect_margin');
}
export function select(state: State, params: ParamStore) {
  for (const site of state.sites) if (!SITES.includes(site)) throw new Error(`unknown linked site ${site}`);
  const family = state.type ?? (suggestionPasses(state,params) ? state.suggestion!.family : 'other');
  const fallback = !state.type && !suggestionPasses(state,params) ? 'type_unsure' as const : null;
  const kind = state.kind ?? null;
  const key = `${family}.${kind}`;
  const small = bound(params,'capture_small_cm'), large = bound(params,'capture_large_cm');
  let inner = table.family_class[key] ?? table.family_class[family];
  if (!inner) inner = !state.rigid ? 'soft_goods' : state.extent_cm === undefined ? 'medium_hard' : state.extent_cm >= large ? 'large_bulky' : state.extent_cm >= small ? 'medium_hard' : 'small_hard';
  if (state.rigid && state.extent_cm !== undefined && state.extent_cm >= large) inner = 'large_bulky';
  if (inner === 'medium_hard' && state.extent_cm !== undefined && state.extent_cm < small) inner = 'small_hard';
  const pieces = state.pieces ?? 1;
  const bundle = pieces >= 2;
  const dimension_class: DimensionClass = bundle ? 'set_bundle' : inner;
  const objectCapture = state.object_capture ?? state.has_lidar;
  let steps = processFor(family,objectCapture,{rigid:state.rigid,kind});
  const usesRing = steps.some(step => step.step === 'ring');
  if (inner === 'small_hard' || inner === 'soft_goods') {
    const hasFront = steps.some(s=>s.step==='front');
    steps = steps.flatMap(s => s.kind === 'scan' || s.step === 'ring' ? hasFront ? [] : [{...table.steps.front_still}] : [s]);
  }
  const process: (Step & {key:string})[] = bundle ? [
    {...table.steps.group,key:table.steps.group.step},
    ...Array.from({length:pieces},(_,i)=>steps.map(s=>({...s,key:`${s.step}.${i+1}`}))).flat(),
  ] : steps.map(s=>({...s,key:s.step}));
  const merged = [...rowsFor('root')];
  for (const row of [...rowsFor(family),...rowsFor(key)]) {
    const i=merged.findIndex(r=>r.field===row.field);
    if(i<0)merged.push(row);else merged[i]=row;
  }
  const cls=classFor(inner);
  if(cls.dimensions)merged.push(structuredClone(cls.dimensions));
  if(state.studio?.requested) {
    let dimensions=merged.find(row=>row.field==='dimensions');
    if(!dimensions) {
      dimensions=structuredClone(classFor('bag').dimensions!);
      const view=steps.find(step=>step.step==='scan' || step.step==='front' || step.step==='ring')?.step;
      dimensions.ways=dimensions.ways.filter(way=>way.way!=='measured' || !!view).map(way=>way.way==='measured'?{...way,view}:way);
      dimensions.ask!.parts=[];
      merged.push(dimensions);
    }
    dimensions.required=[...(dimensions.required==='all'?state.sites:dimensions.required),'studio'];
    dimensions.ask!.parts=[...new Set([...(dimensions.ask!.parts ?? []),...state.studio.measurements])];
  }
  if(bundle)merged.push(structuredClone(table.classes.set_bundle.lot_count));
  for (const row of merged) {
    row.ways = row.ways.map(way => usesRing && way.view === 'scan' ? {...way,view:'ring'} : way);
  }
  const rows=merged.flatMap(row=>bundle && row.per_piece ? Array.from({length:pieces},(_,i)=>({...row,field:`${row.field}.${i+1}`,
    ways:row.ways.map(w=>({...w,...(w.view && ['seen','label','measured'].includes(w.way) ? {view:`${w.view}.${i+1}`} : {})}))})) : [row])
    .sort((a,b)=>compare(a.field,b.field));
  return {family,kind,dimension_class,inner_class:bundle ? inner : null,fallback,process,rows,checks:[...cls.checks]};
}
