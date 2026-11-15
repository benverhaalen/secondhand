import categories from './categories.json' with { type: 'json' };
import { aspectRows, type AspectsReply } from './aspects.ts';
import { select, type State, type Fact } from '../capture/select.ts';
import { fieldState, formValue } from '../capture/fields.ts';
import { completeness } from '../capture/complete.ts';
import { FAMILIES, type Family } from '../capture/process.ts';
import { linked, type Site, type FieldRow } from '../capture/table.ts';
import type { ParamStore } from '../param/param.ts';

type Attribute = {value: unknown; source: Fact['source']|'spec'|'marketplace'|'inferred'; confidence: number; confirmed?: boolean};
type Item = {kind: string; family: string; department?: string; attrs: Record<string,Attribute>; title_words?: string[]};
type Status = 'known'|'proposed'|'missing';
type CategoryRow = {kind?: string; family?: string; department?: string; site: string; category: unknown; source: string; mark: string};
export type Classification = Record<Site,{
  category: {value?: unknown; status: Status; rests_on: string[]};
  fields: {field: string; site_name: string; required: boolean; status: Status; value?: unknown; source?: Attribute['source'];
    allowed?: string[]; max_length?: number; recommended?: boolean; capture_row?: boolean}[];
}>;
type Options = {params: ParamStore; aspects?: Partial<Record<Site,AspectsReply>>;
  suggested?: Partial<Record<Site,{category_id: string; name: string}>>};
const hasValue = (value: unknown) => value!==undefined && value!==null;

function categoryFor(item: Item, site: Site, suggested: Options['suggested']): Classification[Site]['category'] {
  const confirmed=item.attrs[`category:${site}`];
  if(confirmed?.confirmed && hasValue(confirmed.value))return {value:confirmed.value,status:'known',rests_on:['You confirmed the category']};
  if(site==='ebay' && suggested?.[site])return {value:suggested[site],status:'proposed',rests_on:["eBay's category suggestion"]};
  const department=item.department ?? item.attrs.department?.value;
  const rows=(categories.rows as CategoryRow[]).filter(row=>row.site===site);
  const row=rows.find(row=>row.kind===item.kind && (!row.department || row.department===department)) ??
    rows.find(row=>!row.kind && row.family===item.family && (!row.department || row.department===department)) ??
    rows.find(row=>!row.kind && !row.family && row.department===department);
  return row ? {value:row.category,status:'proposed',rests_on:[row.source]} : {status:'missing',rests_on:[]};
}

export function classify(item: Item, sites: Site[], opts: Options): Classification {
  if(!(FAMILIES as readonly string[]).includes(item.family))throw new Error(`unknown family ${item.family}`);
  const sources={spec:'lookup',marketplace:'lookup',inferred:'seen'} as const;
  const facts: State['facts']=Object.fromEntries(Object.entries(item.attrs).map(([field,attr])=>[field,{
    ...attr,source:attr.source in sources ? sources[attr.source as keyof typeof sources] : attr.source as Fact['source'],
  }]));
  const kind=item.kind.startsWith(`${item.family}.`) ? item.kind.slice(item.family.length+1) : item.kind;
  const state: State={capture_id:'',item_id:'',purpose:'sell',confirm_mode:'tap',has_lidar:true,sites,type:item.family as Family,kind,
    kept:[],retakes:{},facts,lookups:'done',refused:[]};
  const selected=select(state,opts.params);
  state.kept=selected.process.map(step=>step.key);
  const complete=completeness(selected.rows,state,opts.params);
  return Object.fromEntries(sites.map(site=> {
    const aspectReply=site==='ebay' ? opts.aspects?.ebay : undefined;
    const captureFields=selected.rows.filter(row=>linked([site],row.required).length || linked([site],row.recommended).length).map(row=>({
      field:row.field,site_name:row.site_names?.[site]?.name ?? row.field,
      required:!!linked([site],row.required).length,recommended:!!linked([site],row.recommended).length,
    }));
    const rows: Omit<Classification[Site]['fields'][number],'status'>[]=aspectReply ? aspectRows(item.kind,aspectReply).map(row=>({field:row.field,site_name:row.site_names.ebay.name,
      required:row.usage==='required',recommended:row.usage==='recommended',
      ...(row.allowed ? {allowed:row.allowed}:{}),
      ...(row.site_names.ebay.max_length!==null ? {max_length:row.site_names.ebay.max_length}:{}),
    })) : captureFields;
    // Condition is a separate eBay policy, never an item aspect (research §1.2).
    if(aspectReply && !rows.some(row=>row.field==='condition'))rows.push(...captureFields.filter(row=>row.field==='condition'));
    const fields=rows.map(row=> {
      const captureRow=selected.rows.find(candidate=>candidate.field===row.field);
      const rule:FieldRow=captureRow ?? {field:row.field,type:row.allowed?'enum':'text',values:row.allowed,
        ways:[{way:'asked'}],confirm:'always',required:row.required?[site]:[],recommended:row.recommended?[site]:[]};
      const resolution=fieldState(rule,state,state.kept,opts.params);
      const fact=resolution.fact;
      const valid=captureRow ? !complete[site]!.missing.some(missing=>missing.field===row.field) :
        !row.required || formValue(rule,site,fact?.value).ok;
      const known=resolution.state==='known' && valid;
      const status: Status=known ? 'known' : hasValue(fact?.value) ? 'proposed' : 'missing';
      return {...row,status,capture_row:!!captureRow,...(hasValue(fact?.value) ? {value:fact!.value,
        source:item.attrs[row.field]?.source ?? fact!.source}:{} )};
    });
    return [site,{category:categoryFor({...item,kind},site,opts.suggested),fields}];
  })) as Classification;
}

export function siteRows(result: Classification): NonNullable<State['site_rows']> {
  return Object.entries(result).flatMap(([site,listing])=>listing.fields.filter(row=>!row.capture_row && (row.required || row.recommended)).map(row=>({
    site:site as Site,field:row.field,name:row.site_name,required:row.required,
    ...(row.allowed ? {allowed:[...row.allowed]}:{}),...(row.max_length!==undefined ? {max_length:row.max_length}:{}),
  })));
}
