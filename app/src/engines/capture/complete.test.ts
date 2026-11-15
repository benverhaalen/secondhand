import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeness, missingFor } from './complete.ts';
import { select } from './select.ts';
import type { State } from './select.ts';
const state = (patch: Partial<State> = {}): State => ({capture_id:'c',item_id:'i',purpose:'sell',confirm_mode:'tap',has_lidar:true,sites:['ebay'],type:null,kept:[],retakes:{},facts:{},lookups:'none',refused:[],...patch});
import { memoryStore } from '../param/param.ts';
const params=memoryStore();
test('missing names sorted and invalid known enums remain missing',()=>{const s=state({type:'apparel',sites:['depop'],facts:{condition:{value:'bogus',source:'you_said',confidence:1}}});const c=completeness(select(s,params).rows,s,params);assert.deepEqual(c.depop!.missing.map(f=>f.field),['brand','condition','department','size_label']);assert.equal(c.depop!.ready,false);});
test('recall blocks every linked site with exact reason',()=>{const s=state({sites:['facebook','ebay'],recall_flag:true});const c=completeness(select(s,params).rows,s,params);for(const site of s.sites)assert.deepEqual(c[site],{ready:false,missing:[{field:'recall_flag',state:'blocked'}]});assert.deepEqual(Object.keys(c),s.sites);});
test('listing missingFor agrees on equivalent attribute facts',()=>{const s=state({type:'apparel',sites:['depop'],facts:{condition:{value:'good',source:'you_said',confidence:1},brand:{value:'Gildan',source:'lookup',confidence:0}}});assert.deepEqual(missingFor({condition:{value:'good',source:'you_said',confirmed:true},brand:{value:'Gildan',source:'spec',confirmed:false}},'apparel','depop','tap'),completeness(select(s,params).rows,s,params).depop!.missing.map(f=>f.field));});
test('every attribute source maps to the same missing names in tap and auto modes',()=>{const sources={spec:'lookup',marketplace:'lookup',inferred:'seen',label:'label',measured:'measured',you_said:'you_said'} as const;for(const mode of ['tap','auto'] as const)for(const source of Object.keys(sources) as (keyof typeof sources)[])for(const confirmed of [false,true]){const attrs={condition:{value:'good',source,confirmed},brand:{value:'A',source,confirmed},size_label:{value:'M',source,confirmed},department:{value:'unisex',source,confirmed}};const facts=Object.fromEntries(Object.entries(attrs).map(([field,attr])=>[field,{value:attr.value,source:sources[attr.source],confidence:confirmed?1:0,confirmed}]));const s=state({type:'apparel',sites:['depop'],confirm_mode:mode,kept:['front','back','tag'],facts});assert.deepEqual(missingFor(attrs,'apparel','depop',mode),completeness(select(s,params).rows,s,params).depop!.missing.map(f=>f.field),`${mode} ${source} confirmed=${confirmed}`);}});
test('all required known and valid is ready, including derived mercari weight',()=>{const s=state({type:'other',sites:['ebay','mercari'],facts:{condition:{value:'good',source:'you_said',confidence:1}}});const c=completeness(select(s,params).rows,s,params);assert.deepEqual(c,{ebay:{ready:true,missing:[]},mercari:{ready:true,missing:[]}});});
test('required refusal stays missing with refused state',()=>{const s=state({type:'other',sites:['ebay'],refused:['condition']});assert.deepEqual(completeness(select(s,params).rows,s,params).ebay!.missing,[{field:'condition',state:'refused'}]);});

import type { ItemCard } from '../listing/build.ts';
type MissingAttrs = Parameters<typeof missingFor>[0];
const acceptsItemCardAttrs = (attrs: ItemCard['attrs']): MissingAttrs => {
  const accepted: Parameters<typeof missingFor>[0] = attrs;
  return accepted;
};
test('missingFor accepts dimensions and selection context with supplied params', () => {
  const attrs: MissingAttrs = {condition:{value:'good',source:'you_said',confirmed:true},dimensions:{value:{width:130,height:20,depth:30},source:'measured',confirmed:true}};
  assert.deepEqual(acceptsItemCardAttrs({}),{});
  assert.ok(!missingFor(attrs,'lighting_home','ebay','tap',{extent_cm:130,rigid:true}).includes('dimensions'));
  const missing = missingFor({},'lighting_home','ebay','tap',{extent_cm:130,rigid:true});
  assert.ok(missing.includes('dimensions'));
  const store = memoryStore();
  const params = {...store,read:(name:string,scope:Parameters<typeof store.read>[1])=>({...store.read(name,scope),...(name==='capture_large_cm'?{value:150}:{})})};
  assert.ok(!missingFor({},'lighting_home','ebay','tap',{extent_cm:130,rigid:true,params}).includes('dimensions'));
  assert.ok(missingFor({},'apparel','depop','tap',{pieces:2,profile:{handover:'pickup'}}).includes('size_label.2'));
});

test('missingFor and completeness agree on recall for every linked site', () => {
  const s=state({type:'other',sites:['ebay','facebook','depop','poshmark','mercari'],recall_flag:true});
  const complete=completeness(select(s,params).rows,s,params);
  for(const site of s.sites) {
    const options: Parameters<typeof missingFor>[4]={recall_flag:true};
    assert.deepEqual(missingFor({},'other',site,'tap',options),complete[site]!.missing.map(field=>field.field),`${site} recall must block listing as it blocks capture`);
  }
});
