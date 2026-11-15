import { CONDITION } from '../../../../spec/sites.mjs';
import { bound, classFor, linked, minConf, table, type FieldRow, type Site } from './table.ts';
import { select, suggestionPasses, targets, type State, type Fact } from './select.ts';
import type { ParamStore, Scope } from '../param/param.ts';
export function known(row: FieldRow, fact: Fact|undefined, mode: State['confirm_mode'], params: ParamStore,
  suggestion?: State['suggestion'], scope: Scope = {}): {known:boolean;auto_accepted?:true} {
  if (!fact || fact.value === null || fact.value === undefined) return {known:false};
  if (fact.source === 'you_said' || fact.confirmed) return {known:true};
  if (row.confirm === 'always') return {known:false};
  if (row.confirm === 'tap') {
    const accept = row.field === 'type' ? !!suggestion && suggestion.p >= bound(params,'capture_type_auto_floor') &&
      suggestion.p-suggestion.second_p+Number.EPSILON >= bound(params,'capture_type_auto_margin') : fact.confidence >= bound(params,'capture_auto_accept');
    return mode === 'auto' && accept ? {known:true,auto_accepted:true} : {known:false};
  }
  return {known:row.ways.some(w=>w.way===fact.source && fact.confidence >= (minConf(params,row,w,scope) ?? 0))};
}
export type FieldStatus = 'known'|'proposed'|'waiting'|'missing'|'unobtainable'|'refused';
export type Resolution = {state:FieldStatus; reason:string; fact?:Fact; auto_accepted?:true; shot?:{step:string;reason:'retake'|'add'}};
export function viewsFor(view: string, keys: string[]): string[] {
  return view==='*' ? keys : view.startsWith('*.') ? keys.filter(key=>key.endsWith(view.slice(1))) : [view];
}
export function fieldState(row: FieldRow,state: State,processKeys: string[],params: ParamStore): Resolution {
  const family=state.type ?? (suggestionPasses(state,params) ? state.suggestion!.family : 'other');
  const kind=`${family}.${state.kind}`;
  const field=row.field.replace(/\.\d+$/, '');
  const scope={kind:table.fields[kind]?.some(candidate=>candidate.field===field) ? kind : family};
  let fact=state.facts[row.field];
  if(row.field==='type') {
    if(state.type)fact={value:state.type,source:'you_said',confidence:1};
    else if(suggestionPasses(state,params))fact={value:state.suggestion!.family,source:'seen',confidence:state.suggestion!.p};
  }
  if(state.refused.includes(row.field))return {state:'refused',reason:'refused',fact};
  if(!fact || fact.value===null || fact.value===undefined) for(const w of row.ways) if(w.way==='derived') {
    let value: unknown;
    if(w.from==='profile.handover')value=state.profile?.handover;
    if(w.from==='class_weight') { const s=select(state,params); value=classFor(s.inner_class ?? s.dimension_class as Exclude<typeof s.dimension_class,'set_bundle'>).weight; }
    if(value!==undefined) {fact={value,source:'derived',confidence:minConf(params,row,w,scope) ?? 0};break;}
  }
  let unresolvedVariants=false;
  if(row.field==='dimensions' && (state.variants?.dimensions?.length ?? 0)>=2 &&
    !(fact && (fact.source!=='measured' || fact.confirmed) && known(row,fact,state.confirm_mode,params,state.suggestion,scope).known)) {
    const variants=state.variants!.dimensions!;
    const measured=row.ways.find(way=>way.way==='measured'),lookup=row.ways.find(way=>way.way==='lookup');
    const measuredFloor=measured ? minConf(params,row,measured,scope) : undefined;
    const floor=(lookup ? minConf(params,row,lookup,scope) : undefined) ?? measuredFloor;
    const confident=variants.filter(variant=>floor!==undefined && variant.p>=floor);
    let chosen=confident.length===1?confident[0]:undefined;
    let reading=false;
    if(!chosen && state.has_lidar && fact?.source==='measured' && measuredFloor!==undefined && fact.confidence>=measuredFloor && fact.value && typeof fact.value==='object') {
      const values=fact.value as Record<string,unknown>;
      const matches=variants.filter(variant=>Object.entries(variant.value).every(([part,value])=>
        typeof values[part]==='number' && Math.abs(values[part]-value)<=Math.max(bound(params,'capture_dims_match_cm'),bound(params,'capture_dims_match_pct')*value)));
      if(matches.length===1) {chosen=matches[0];reading=true;}
    }
    if(chosen)return {state:'known',reason:'accepted',fact:{value:chosen.value,source:'lookup',confidence:reading?fact!.confidence:chosen.p,...(reading?{note:'The reading chose this variant.'}:{})}};
    unresolvedVariants=true;
  }
  const availableWays = row.ways.filter(way => way.way !== 'measured' || state.has_lidar);
  const k=known({...row,ways:availableWays},fact,state.confirm_mode,params,state.suggestion,scope);
  if(!unresolvedVariants && k.known)return {state:'known',reason:'accepted',fact,...(k.auto_accepted ? {auto_accepted:true as const} : {})};
  const hasAsked=row.ways.some(w=>w.way==='asked');
  for(const w of row.ways) {
    if(w.way==='measured' && !state.has_lidar)continue;
    if(['seen','label','measured'].includes(w.way) && w.view && w.view!=='first_frame') {
      const views=viewsFor(w.view,processKeys);
      for(const view of views) {
        if(!processKeys.includes(view)) {
          if(linked(targets(state),row.required).length && !hasAsked)return {state:'missing',reason:'add',fact,shot:{step:view,reason:'add'}};
          continue;
        }
        if(!state.kept.includes(view))return {state:'waiting',reason:'view',fact};
        if(!unresolvedVariants && fact?.unknown_reason==='not_read' && (!fact.step || fact.step===view) && (state.retakes[view]??0)<bound(params,'capture_max_retakes'))
          return {state:'missing',reason:'retake',fact,shot:{step:view,reason:'retake'}};
      }
    }
    if(w.way==='lookup' && state.lookups==='running')return {state:'waiting',reason:'lookup',fact};
  }
  if(unresolvedVariants)return {state:'missing',reason:'variants',fact};
  if(fact && fact.value!==null && fact.value!==undefined) return {state:row.confirm!=='auto'||hasAsked ? 'proposed':'unobtainable',reason:'unconfirmed',fact};
  return {state:hasAsked || row.field==='type' ? 'missing':'unobtainable',reason:hasAsked?'ask':'no_way',fact};
}
export function formValue(row: FieldRow, site: Site, value: unknown): {ok:true;value:unknown}|{ok:false;reason:'invalid'} {
  if(row.type==='enum' && !row.values?.includes(value as string|number))return {ok:false,reason:'invalid'};
  if(row.field==='condition') {
    const values:Record<string,string>=CONDITION[site].v;
    return typeof value==='string' && Object.hasOwn(values,value) ? {ok:true,value:values[value]} : {ok:false,reason:'invalid'};
  }
  if(row.type==='text' && typeof value==='string') {
    const text=value.trim(),max=row.site_names?.[site]?.max_length ?? null;
    return {ok:true,value:max===null || text.length<=max ? text : text.slice(0,max+1).replace(/\S+$/,'').trimEnd()};
  }
  return {ok:true,value};
}
