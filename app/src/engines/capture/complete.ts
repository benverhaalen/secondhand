import { FAMILIES, type Family } from './process.ts';
import { select, targets, studioStep, type State, type Fact } from './select.ts';
import { fieldState, formValue, type FieldStatus } from './fields.ts';
import { linked, compare, type FieldRow, type Target, type Site } from './table.ts';
import { memoryStore, type ParamStore } from '../param/param.ts';
export type Completeness = Partial<Record<Target,{ready:boolean;missing:{field:string;state:FieldStatus|'blocked'}[]}>>;
export function completeness(rows: FieldRow[],state: State,params: ParamStore): Completeness {
  const keys=select(state,params).process.map(s=>s.key);
  return Object.fromEntries(targets(state).map(site=> {
    if(state.recall_flag)return [site,{ready:false,missing:[{field:'recall_flag',state:'blocked'}]}];
    const missing=rows.filter(row=>linked([site],row.required).length).flatMap(row=> {
      const f=fieldState(row,state,keys,params);
      if(site==='studio' && row.type==='dimensions' && !state.studio!.measurements.every(part=>
        f.fact?.value && typeof f.fact.value==='object' && typeof (f.fact.value as Record<string,unknown>)[part]==='number'))
        return [{field:row.field,state:f.state==='known'?'missing':f.state}];
      return f.state==='known' && (site==='studio' || formValue(row,site,f.fact?.value).ok) ? [] : [{field:row.field,state:f.state}];
    }).sort((a,b)=>compare(a.field,b.field));
    if(site==='studio')for(const ask of state.studio!.asks) {
      if(ask.type!=='measure' && !state.kept.includes(studioStep(ask)))missing.push({field:studioStep(ask),state:'missing'});
    }
    return [site,{ready:missing.length===0,missing}];
  }));
}
export type Attributes = Record<string, {
  value: unknown;
  source: 'spec'|'marketplace'|'inferred'|'label'|'measured'|'you_said';
  confirmed: boolean;
  confidence?: number;
}>;
export type SelectionContext = Pick<State,'extent_cm'|'rigid'|'pieces'|'profile'> & {params?: ParamStore};
export function missingFor(attrs: Attributes,kind: string,site: Site,confirm_mode: State['confirm_mode'],context: SelectionContext = {}): string[] {
  const [family,subkind]=kind.split('.');
  if(!(FAMILIES as readonly string[]).includes(family))throw new Error(`unknown kind ${kind}`);
  const sources = {spec:'lookup',marketplace:'lookup',inferred:'seen',label:'label',measured:'measured',you_said:'you_said'} as const;
  const facts:Record<string,Fact>=Object.fromEntries(Object.entries(attrs).map(([field,attr])=>[field,{value:attr.value,source:sources[attr.source],confidence:attr.confidence ?? (attr.confirmed?1:0),confirmed:attr.confirmed}]));
  const state:State={capture_id:'',item_id:'',purpose:'sell',confirm_mode,has_lidar:true,sites:[site],type:family as Family,kind:subkind,
    kept:[],retakes:{},facts,lookups:'done',refused:[],extent_cm:context.extent_cm,rigid:context.rigid,pieces:context.pieces,profile:context.profile};
  const params=context.params ?? memoryStore();
  const selected=select(state,params);
  state.kept=selected.process.map(s=>s.key);
  return completeness(selected.rows,state,params)[site]!.missing.map(f=>f.field);
}
