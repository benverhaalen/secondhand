import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classify, siteRows } from './classify.ts';
import type { AspectsReply } from './aspects.ts';
import { memoryStore } from '../param/param.ts';
import { missingFor } from '../capture/complete.ts';
import { plan, type State } from '../capture/plan.ts';

// Recorded Taxonomy getItemAspectsForCategory shape; no live taxonomy call.
const aspects: AspectsReply = {categoryId:'57989',aspects:[
  {localizedAspectName:'Brand',aspectConstraint:{aspectRequired:true,aspectMode:'FREE_TEXT',aspectMaxLength:65}},
  {localizedAspectName:'Size',aspectConstraint:{aspectRequired:true,aspectMode:'SELECTION_ONLY'},aspectValues:[{localizedValue:'38x36'}]},
  {localizedAspectName:'Color',aspectConstraint:{aspectUsage:'RECOMMENDED',aspectMode:'SELECTION_ONLY'},aspectValues:[{localizedValue:'Black'}]},
  {localizedAspectName:'Inseam',aspectConstraint:{aspectRequired:true,aspectMode:'FREE_TEXT',aspectMaxLength:65}},
  {localizedAspectName:'Department',aspectConstraint:{aspectRequired:true,aspectMode:'SELECTION_ONLY'},aspectValues:[{localizedValue:'Men'}]},
]};
const pants = {kind:'pants',family:'apparel',attrs:{
  brand:{value:'Carhartt',source:'label' as const,confidence:.8},
  size_label:{value:'38x36',source:'label' as const,confidence:0},
  fabric:{value:'100% cotton',source:'label' as const,confidence:0},
}};
const options = () => ({params:memoryStore(),aspects:{ebay:aspects},suggested:{ebay:{category_id:'57989',name:"Men's Pants"}}});

test('unconfirmed Carhartt label and zero-confidence size stay proposed, while absent aspects stay missing', () => {
  const result=classify(pants,['ebay'],options()).ebay!;
  assert.deepEqual(result.category,{value:{category_id:'57989',name:"Men's Pants"},status:'proposed',rests_on:["eBay's category suggestion"]});
  assert.deepEqual(result.fields.map(row=>[row.site_name,row.status]),[
    ['Brand','proposed'],['Size','proposed'],['Color','missing'],['Inseam','missing'],['Department','missing'],['condition','missing'],
  ]);
  assert.equal(result.fields.find(row=>row.site_name==='Inseam')!.field,'ebay:Inseam');
  const confirmed={...pants,attrs:{...pants.attrs,brand:{...pants.attrs.brand,confirmed:true}}};
  assert.equal(classify(confirmed,['ebay'],options()).ebay!.fields[0].status,'known');
});
test('an unmapped kind without a suggestion leaves category missing instead of guessing', () => {
  const result=classify({kind:'unmapped',family:'other',attrs:{}},['ebay','depop','poshmark','mercari','facebook'],{params:memoryStore()});
  for(const listing of Object.values(result))assert.deepEqual(listing.category,{status:'missing',rests_on:[]});
});
test('a confirmed category overrides a suggestion and static categories retain their source', () => {
  const value={category_id:'confirmed',name:'Chosen category'};
  const item={...pants,department:'men',attrs:{...pants.attrs,'category:ebay':{value,source:'you_said' as const,confidence:1,confirmed:true}}};
  assert.equal(classify(item,['ebay'],options()).ebay!.category.status,'known');
  assert.deepEqual(classify(item,['ebay'],options()).ebay!.category.value,value);
  const category=classify({...pants,department:'men'},['ebay'],{params:memoryStore()}).ebay!.category;
  assert.equal(category.status,'proposed');
  assert.deepEqual(category.value,{category_id:'57989',name:"Men's Pants"});
  assert.match(category.rests_on[0],/item-attributes-by-site\.md#12-ebay/);
  assert.equal(classify({...pants,department:'women'},['ebay'],{params:memoryStore()}).ebay!.category.status,'missing');
  assert.equal(classify(pants,['ebay'],{params:memoryStore()}).ebay!.category.status,'missing');
});
test('researched tees and hoodies map only to the department whose tree was read', () => {
  const tee=classify({kind:'tee',family:'apparel',department:'men',attrs:{}},['ebay'],{params:memoryStore()});
  assert.deepEqual(tee.ebay!.category.value,{category_id:'15687',name:"Men's T-Shirts"});
  const hoodie=classify({kind:'hoodie',family:'apparel',department:'women',attrs:{}},['poshmark'],{params:memoryStore()});
  assert.deepEqual(hoodie.poshmark!.category.value,{department:'Women',category:'Tops',subcategory:'Sweatshirts & Hoodies'});
  assert.equal(classify({kind:'hoodie',family:'apparel',department:'men',attrs:{}},['poshmark'],{params:memoryStore()}).poshmark!.category.status,'missing');
});
test('eBay aspect names and allowed values never leak into another site', () => {
  const result=classify(pants,['ebay','depop','poshmark','mercari','facebook'],options());
  for(const site of ['depop','poshmark','mercari','facebook'] as const) {
    assert.ok(result[site]!.fields.every(row=>!row.field.startsWith('ebay:')));
    assert.ok(!JSON.stringify(result[site]).includes('Inseam'));
    assert.ok(!JSON.stringify(result[site]).includes('Black'));
    assert.equal(result[site]!.fields.find(row=>row.field==='brand')!.status,'proposed');
  }
});
test('siteRows retains required Inseam limits and excludes capture fields and optional aspects', () => {
  const reply={...aspects,aspects:[...aspects.aspects!,
    {localizedAspectName:'Rise',aspectConstraint:{aspectUsage:'RECOMMENDED' as const,aspectMode:'SELECTION_ONLY' as const},aspectValues:[{localizedValue:'High'}]},
    {localizedAspectName:'Theme',aspectConstraint:{aspectUsage:'OPTIONAL' as const,aspectMode:'SELECTION_ONLY' as const}},
  ]};
  const result=classify(pants,['ebay'],{...options(),aspects:{ebay:reply}});
  assert.deepEqual(siteRows(result),[
    {site:'ebay',field:'ebay:Inseam',name:'Inseam',required:true,max_length:65},
    {site:'ebay',field:'ebay:Rise',name:'Rise',required:false,allowed:['High']},
  ]);
});
test('unknown aspect rules require confirmation or you_said even at full confidence', () => {
  for(const [source,confirmed,status] of [['label',false,'proposed'],['label',true,'known'],['you_said',false,'known']] as const) {
    const item={...pants,attrs:{...pants.attrs,'ebay:Inseam':{value:'36',source,confidence:1,confirmed}}};
    assert.equal(classify(item,['ebay'],options()).ebay!.fields.find(row=>row.field==='ebay:Inseam')!.status,status);
  }
});
test('capture required fields and classification use the same known rule, including derived values', () => {
  const item={...pants,attrs:{...pants.attrs,condition:{value:'good',source:'you_said' as const,confidence:1}}};
  const params=memoryStore();
  const result=classify(item,['depop','poshmark','mercari'],{params});
  const attrs=Object.fromEntries(Object.entries(item.attrs).map(([field,attr])=>[field,{...attr,confirmed:false}]));
  for(const site of ['depop','poshmark','mercari'] as const) {
    const missing=missingFor(attrs,'apparel.pants',site,'tap',{params});
    for(const row of result[site]!.fields.filter(row=>row.required))assert.equal(row.status==='known',!missing.includes(row.field),row.field);
  }
});
test('an aspects reply does not hide required condition, which eBay keeps outside its aspects', () => {
  const before=classify(pants,['ebay'],options()).ebay!.fields.find(row=>row.field==='condition');
  assert.ok(before);assert.equal(before.required,true);assert.equal(before.status,'missing');
  const item={...pants,attrs:{...pants.attrs,condition:{value:'good',source:'you_said' as const,confidence:1}}};
  assert.equal(classify(item,['ebay'],options()).ebay!.fields.find(row=>row.field==='condition')!.status,'known');
});
test('an invalid required aspect value cannot be known while capture rejects it', () => {
  const item={...pants,attrs:{...pants.attrs,'ebay:Rise':{value:'Mid',source:'you_said' as const,confidence:1}}};
  const reply:AspectsReply={aspects:[{localizedAspectName:'Rise',aspectConstraint:{aspectRequired:true,aspectMode:'SELECTION_ONLY'},aspectValues:[{localizedValue:'High'},{localizedValue:'Low'}]}]};
  const result=classify(item,['ebay'],{params:memoryStore(),aspects:{ebay:reply}});
  assert.equal(result.ebay!.fields.find(row=>row.field==='ebay:Rise')!.status,'proposed');
  const state:State={capture_id:'c',item_id:'i',purpose:'sell',confirm_mode:'tap',has_lidar:true,sites:['ebay'],type:'apparel',kind:'pants',
    kept:['front','back','tag'],retakes:{},facts:{'ebay:Rise':item.attrs['ebay:Rise']},lookups:'done',refused:[],site_rows:siteRows(result)};
  assert.ok(plan(state,memoryStore()).questions.some(row=>row.field==='ebay:Rise'));
  state.facts['ebay:Rise'].value='High';
  assert.ok(!plan(state,memoryStore()).questions.some(row=>row.field==='ebay:Rise'));
});

test('no requested sites classifies for no site and returns an empty object', () => {
 assert.deepEqual(classify(pants,[],options()),{});
});
test('unknown and prototype attribute sources are dropped even when confirmed', () => {
 for(const source of ['unknown','constructor','__proto__','toString']) {
  const attrs=JSON.parse(JSON.stringify({brand:{value:'Untrusted',source,confidence:1,confirmed:true}}));
  const result=classify({...pants,attrs},['ebay'],options());
  const brand=result.ebay!.fields.find(row=>row.field==='brand')!;
  assert.equal(brand.status,'missing');assert.ok(!('value' in brand));assert.ok(!('source' in brand));
 }
});
test('siteRows carries a held string value from classification', () => {
 const result=classify({...pants,attrs:{...pants.attrs,'ebay:Inseam':{value:'36',source:'label',confidence:1}}},['ebay'],options());
 assert.equal(siteRows(result).find(row=>row.field==='ebay:Inseam')!.value,'36');
});
test('FIELD-mapped Department stays a capture row on pants and uses its bare name otherwise', () => {
 const pantsResult=classify(pants,['ebay'],options());
 assert.equal(pantsResult.ebay!.fields.find(row=>row.field==='department')!.capture_row,true);
 assert.ok(!siteRows(pantsResult).some(row=>row.field==='department'));
 const other=classify({kind:'unmapped',family:'other',attrs:{}},['ebay'],options());
 assert.deepEqual(siteRows(other).find(row=>row.field==='department'),{site:'ebay',field:'department',name:'Department',required:true,allowed:['Men']});
});
