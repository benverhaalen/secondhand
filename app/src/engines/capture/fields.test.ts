import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONDITION } from '../../../../spec/sites.mjs';
import { known, fieldState, formValue } from './fields.ts';
import { select } from './select.ts';
import { plan } from './plan.ts';
import { walks } from './walks.ts';
import type { State } from './select.ts';
const state = (patch: Partial<State> = {}): State => ({capture_id:'c',item_id:'i',purpose:'sell',confirm_mode:'tap',has_lidar:true,sites:['ebay'],type:null,kept:[],retakes:{},facts:{},lookups:'none',refused:[],...patch});
import { memoryStore } from '../param/param.ts';
import { rowsFor } from './table.ts';
const params=memoryStore();
const size=rowsFor('apparel')[0], condition=rowsFor('root')[1];
test('size at .97 requires tap in tap mode and auto accepts in auto mode',()=>{const f={value:'M',source:'label' as const,confidence:.97};assert.equal(known(size,f,'tap',params).known,false);assert.deepEqual(known(size,f,'auto',params),{known:true,auto_accepted:true});});
test('seen never settles condition even in auto mode',()=>{for(const mode of ['tap','auto'] as const)assert.equal(known(condition,{value:'good',source:'seen',confidence:1},mode,params).known,false);});
test('null never known even if confirmed',()=>assert.equal(known(condition,{value:null,source:'you_said',confidence:1,confirmed:true},'tap',params).known,false));
test('you said and confirmed settle always fields',()=>{assert.ok(known(condition,{value:'good',source:'you_said',confidence:0},'tap',params).known);assert.ok(known(condition,{value:'good',source:'seen',confidence:0,confirmed:true},'tap',params).known);});
test('unkept label waits instead of asking',()=>assert.equal(fieldState(size,state({type:'apparel'}),['front','back','tag'],params).state,'waiting'));
test('running lookup waits',()=>assert.equal(fieldState(rowsFor('root')[2],state({lookups:'running'}),[],params).state,'waiting'));
test('no lidar skips measured and asks dimensions after lookup',()=>{const s=state({type:'bags',has_lidar:false,kept:['ring','inside_tab'],lookups:'done'});const row=select(s,params).rows.find(r=>r.field==='dimensions')!;assert.equal(fieldState(row,s,['ring','inside_tab'],params).state,'missing');});
test('not read retakes stop at parameter bound',()=>{const s=state({kept:['tag'],facts:{size_label:{value:null,source:'label',confidence:0,unknown_reason:'not_read',step:'tag'}}});assert.deepEqual(fieldState(size,s,['tag'],params).shot,{step:'tag',reason:'retake'});s.retakes.tag=2;assert.equal(fieldState(size,s,['tag'],params).state,'missing');});
test('refused overrides a known fact',()=>assert.equal(fieldState(size,state({refused:['size_label'],facts:{size_label:{value:'M',source:'you_said',confidence:1}}}),[],params).state,'refused'));
test('form maps every condition site and rejects invalid enum',()=>{for(const [site,value] of [['ebay','USED_GOOD'],['facebook','used_good'],['depop','used_good'],['poshmark','good'],['mercari','good']] as const)assert.deepEqual(formValue(condition,site,'good'),{ok:true,value});assert.deepEqual(formValue(condition,'ebay','bogus'),{ok:false,reason:'invalid'});});
test('text shortens at word boundary including exact ending',()=>{assert.deepEqual(formValue({...size,site_names:{ebay:{max_length:7}}},'ebay',' one two three '),{ok:true,value:'one two'});});
test('auto rows require confidence from a matching way',()=>{const brand=rowsFor('root')[2];assert.equal(known(brand,{value:'A',source:'seen',confidence:1},'auto',params).known,false);assert.equal(known(brand,{value:'A',source:'lookup',confidence:.89},'auto',params).known,false);assert.equal(known(brand,{value:'A',source:'lookup',confidence:.9},'tap',params).known,true);});
test('type auto bounds use suggestion margin instead of generic auto acceptance',()=>{const row=rowsFor('root')[0];const fact={value:'apparel',source:'seen' as const,confidence:.9};assert.ok(known(row,fact,'auto',params,{family:'apparel',p:.9,second_p:.03}).known);assert.ok(!known(row,{...fact,confidence:1},'auto',params,{family:'apparel',p:.99,second_p:.6}).known);});
test('required absent view without asked becomes add shot; optional absent view is skipped',()=>{const row={...size,ways:[{way:'label' as const,view:'extra',min_conf:.9}],required:['ebay'] as State['sites']};assert.deepEqual(fieldState(row,state(),[],params).shot,{step:'extra',reason:'add'});assert.equal(fieldState({...row,required:[]},state(),[],params).state,'unobtainable');});
test('unread view without explicit fact step still gets a retake',()=>assert.deepEqual(fieldState(size,state({kept:['tag'],facts:{size_label:{value:null,source:'label',confidence:0,unknown_reason:'not_read'}}}),['tag'],params).shot,{step:'tag',reason:'retake'}));
test('derived class weight and profile are resolved before a running lookup',()=>{const s=state({type:'furniture',profile:{handover:'pickup'},lookups:'running'});for(const field of ['package_weight','handover']){const row=select(s,params).rows.find(r=>r.field===field)!;assert.equal(fieldState(row,s,[],params).state,'known');}});
test('all process views wait until the last view is kept',()=>{const colour=rowsFor('root')[3];assert.equal(fieldState(colour,state({kept:['front']}),['front','back'],params).state,'waiting');});
test('no asking path leaves low confidence value unobtainable',()=>{const row=rowsFor('media')[0];assert.equal(fieldState(row,state({kept:['back_barcode'],facts:{code:{value:'123',source:'label',confidence:.8}}}),['back_barcode'],params).state,'unobtainable');});
test('every condition has the prescribed mapping on all sites',()=>{const expected={ebay:['NEW','NEW_OTHER','LIKE_NEW','USED_EXCELLENT','USED_GOOD','USED_ACCEPTABLE','USED_ACCEPTABLE'],depop:['brand_new','brand_new','used_like_new','used_excellent','used_good','used_fair','used_fair'],poshmark:['nwt','like_new','like_new','good','good','fair','fair'],mercari:['new','new','like_new','good','good','fair','poor'],facebook:['new','new','used_like_new','used_good','used_good','used_fair','used_fair']};for(const site of Object.keys(expected) as (keyof typeof expected)[])for(const [i,value] of condition.values!.entries())assert.deepEqual(formValue(condition,site,value),{ok:true,value:expected[site][i]});});
test('auto accept and retake limits read supplied params',()=>{const store=memoryStore();const tuned={...store,read:(name:string,scope:Parameters<typeof store.read>[1])=>({...store.read(name,scope),...(name==='capture_auto_accept'?{value:.99}:name==='capture_max_retakes'?{value:0}:{})})};assert.equal(known(size,{value:'M',source:'label',confidence:.97},'auto',tuned).known,false);assert.equal(fieldState(size,state({kept:['tag'],facts:{size_label:{value:null,source:'label',confidence:0,unknown_reason:'not_read',step:'tag'}}}),['tag'],tuned).shot,undefined);});
test('condition evidence marks cite the supplied platform note',()=>{for(const site of ['ebay','facebook','depop','poshmark','mercari'] as const){assert.equal(CONDITION[site].mark,['depop','mercari'].includes(site)?'observed':'asserted');assert.match(CONDITION[site].src,/^research\/list\/nate\/listing-fields-by-platform.md#/);}});

test('ring depth is known with LiDAR even when Object Capture failed; no LiDAR skips it', () => {
  for (const has_lidar of [true,false]) {
    const s = state({type:'bags',has_lidar,object_capture:false,kept:['ring','inside_tab'],lookups:'done',facts:{dimensions:{value:{width:30,height:22,depth:12},source:'measured',confidence:.85,step:'ring'}}});
    const row = select(s,params).rows.find(row=>row.field==='dimensions')!;
    assert.equal(fieldState(row,s,['ring','inside_tab'],params).state, has_lidar ? 'known' : 'proposed');
  }
});
test('failed Object Capture ring waits and retakes the substituted view', () => {
  const s = state({type:'bags',object_capture:false});
  const row = select(s,params).rows.find(row=>row.field==='dimensions')!;
  assert.equal(fieldState(row,s,['ring','inside_tab'],params).state,'waiting');
  s.kept=['ring','inside_tab'];
  s.facts.dimensions={value:null,source:'measured',confidence:0,unknown_reason:'not_read',step:'ring'};
  assert.deepEqual(fieldState(row,s,['ring','inside_tab'],params).shot,{step:'ring',reason:'retake'});
});
test('dimension variant tolerance uses max of cm and percent and reads tuned params', () => {
 const s=state({type:'furniture',kept:['scan'],lookups:'done',variants:{dimensions:[{label:'Small',value:{width:20,height:200},p:.5},{label:'Large',value:{width:40,height:300},p:.5}]},facts:{dimensions:{value:{width:22,height:205},source:'measured',confidence:.9}}});
 const row=select(s,params).rows.find(row=>row.field==='dimensions')!;
 const result=fieldState(row,s,['scan'],params);assert.equal(result.state,'known');assert.equal(result.fact!.confidence,s.facts.dimensions.confidence);assert.deepEqual(result.fact!.value,{width:20,height:200});
 const tuned={...params,read:(name:string,scope:Parameters<typeof params.read>[1])=>({...params.read(name,scope),...(['capture_dims_match_cm','capture_dims_match_pct'].includes(name)?{value:0}:{})})};
 assert.equal(fieldState(row,s,['scan'],tuned).reason,'variants');
});
test('known lookup dimensions survive variants with their original confidence', () => {
 const s=state({type:'furniture',kept:['scan'],variants:{dimensions:[{label:'Small',value:{width:120},p:.55},{label:'Large',value:{width:140},p:.45}]},facts:{dimensions:{value:{width:130},source:'lookup',confidence:.96}}});
 const row=select(s,params).rows.find(row=>row.field==='dimensions')!;
 const result=fieldState(row,s,['scan'],params);assert.equal(result.state,'known');assert.deepEqual(result.fact,s.facts.dimensions);
});
const bagVariants = [
 {label:'Small',value:{width:30,height:22,depth:12},p:.6},
 {label:'Large',value:{width:40,height:30,depth:20},p:.6},
];
test('unsettled variants wait for their view or lookup and preserve unmatched readings', () => {
 const reading={value:{width:60,height:50,depth:30},source:'measured' as const,confidence:.9};
 for(const patch of [{kept:['inside_tab'],lookups:'done' as const},{kept:['scan','inside_tab'],lookups:'running' as const},{kept:['scan','inside_tab'],lookups:'done' as const}]) {
  const factsList: State['facts'][]=[{},{dimensions:reading}];
  for(const facts of factsList) {
   const s=state({type:'bags',variants:{dimensions:bagVariants},...patch,facts});
   const selected=select(s,params),row=selected.rows.find(row=>row.field==='dimensions')!;
   const result=fieldState(row,s,selected.process.map(step=>step.key),params);
   assert.equal(result.state,patch.lookups==='running'||!patch.kept.includes('scan')?'waiting':'missing');
   assert.deepEqual(result.fact,s.facts.dimensions,'unsettled variants retain the measured fact');
  }
 }
});
test('only readings at the measured confidence floor settle a variant and retain confidence', () => {
 for(const confidence of [.5,.8,.85]) {
  const s=state({type:'bags',kept:['scan','inside_tab'],lookups:'done',variants:{dimensions:bagVariants},facts:{dimensions:{value:bagVariants[0].value,source:'measured',confidence}}});
  const row=select(s,params).rows.find(row=>row.field==='dimensions')!;
  const result=fieldState(row,s,s.kept,params);
  assert.equal(result.state,confidence>=.8?'known':'missing',`reading confidence ${confidence}`);
  assert.equal(result.fact!.confidence,confidence,'variant selection must retain reading confidence');
 }
});
test('flat garment variants can settle without a lookup way', () => {
 const value={pit_to_pit:52,length:71};
 const s=state({type:'apparel',kept:['front','back','tag'],lookups:'done',variants:{dimensions:[{label:'M',value,p:.6},{label:'L',value:{pit_to_pit:60,length:80},p:.6}]},facts:{dimensions:{value,source:'measured',confidence:.9}}});
 const row=select(s,params).rows.find(row=>row.field==='dimensions')!;
 assert.deepEqual(row.ways.map(way=>way.way),['measured','asked']);
 const result=fieldState(row,s,s.kept,params);
 assert.equal(result.state,'known');
 assert.deepEqual(result.fact!.value,value);
});

function promoteConfidence(store: ReturnType<typeof memoryStore>, field: string, way: string, kind: string, prior: number, value: number): void {
  const name=`capture_min_conf.${field}.${way}`,scope={kind};
  store.declare({name,family:'scalar',prior});
  const row=store.propose({name,scope,family:'scalar',prior,value_or_hyperparams:value,n_eff:40,
    fitted_on_ids_hash:'confidence-fixture',metric:'precision',held_out_score:1,guard_lo:0,guard_hi:1},0);
  assert.equal(store.promote(name,scope,row.version,0,'2026-11-15T00:00:00Z').promoted,true);
}
test('a promoted row does not move the known rule: higher scoped confidence makes a known fact unknown', () => {
  const store=memoryStore(),s=state({type:'apparel',kept:['front','back','tag'],lookups:'done',facts:{brand:{value:'A',source:'label',confidence:.94}}});
  const row=select(s,store).rows.find(row=>row.field==='brand')!;
  assert.equal(fieldState(row,s,s.kept,store).state,'known');
  assert.equal(known(row,s.facts.brand,s.confirm_mode,store,s.suggestion,{kind:'apparel'}).known,true);
  promoteConfidence(store,'brand','label','apparel',row.ways[0].min_conf!,.98);
  assert.equal(known(row,s.facts.brand,s.confirm_mode,store,s.suggestion,{kind:'apparel'}).known,false);
  assert.notEqual(fieldState(row,s,s.kept,store).state,'known');
});
test('a param read with the wrong scope falls to another family row: family and kind rows stay isolated', () => {
  const store=memoryStore();
  promoteConfidence(store,'brand','label','electronics',.9,.99);
  promoteConfidence(store,'brand','label','electronics.phones',.95,.98);
  for(const [type,kind,confidence,expected] of [
    ['apparel',undefined,.94,'known'],['electronics',undefined,.94,'proposed'],
    ['electronics','phones',.97,'proposed'],['electronics','phones',.985,'known'],
  ] as const) {
    const s=state({type,kind,lookups:'done',facts:{brand:{value:'A',source:'label',confidence}}});
    const selected=select(s,store);s.kept=selected.process.map(step=>step.key);
    assert.equal(fieldState(selected.rows.find(row=>row.field==='brand')!,s,s.kept,store).state,expected,`${type}.${kind}`);
  }
});
test('bundle pieces read the base field confidence param in the family scope', () => {
  const store=memoryStore();promoteConfidence(store,'brand','label','apparel',.9,.98);
  const s=state({type:'apparel',pieces:2,lookups:'done',facts:{'brand.1':{value:'A',source:'label',confidence:.94}}});
  const selected=select(s,store);s.kept=selected.process.map(step=>step.key);
  assert.equal(fieldState(selected.rows.find(row=>row.field==='brand.1')!,s,s.kept,store).state,'proposed');
});
test('dimension variant lookup and measured comparisons read the same scoped confidence params', () => {
  for(const way of ['lookup','measured'] as const) {
    const store=memoryStore(),value=bagVariants[0].value;
    const s=state({type:'bags',lookups:'done',kept:['scan','inside_tab'],variants:{dimensions:bagVariants.map((v,i)=>({...v,p:way==='lookup'&&i===0?.94:.6}))},
      facts:way==='measured'?{dimensions:{value,source:'measured',confidence:.94}}:{}});
    const row=select(s,store).rows.find(row=>row.field==='dimensions')!;
    assert.equal(fieldState(row,s,s.kept,store).state,'known');
    promoteConfidence(store,'dimensions',way,'bags',row.ways.find(w=>w.way===way)!.min_conf!,.98);
    assert.equal(fieldState(row,s,s.kept,store).reason,'variants');
  }
});
test('walk outputs change with no param rows is a regression: original questions and counts', () => {
  const counts=[3,2,4,5,5,2,9,1,2,2,6,4,3];
  for(const [index,fixture] of walks.entries()) {
    const store=memoryStore(),s=structuredClone(fixture.initial),asked=new Set<string>();
    for(const event of fixture.events) {
      const facts=s.facts;Object.assign(s,event.patch);s.facts={...facts,...event.patch.facts};
      const result=plan(s,store);
      assert.deepEqual(result.questions.map(q=>[q.shot?.step??q.field,q.kind,q.options.find(o=>o.proposed)?.value??null]),event.questions,fixture.name);
      for(const q of result.questions)asked.add(`${q.id}:${q.shot?.reason==='retake'?s.retakes[q.shot.step]??0:''}`);
    }
    assert.equal(asked.size,counts[index],fixture.name);
  }
});

test('no champion falls back to each row own prior after reading a different kind', () => {
  const store=memoryStore();
  for(const kind of ['phones',undefined,'phones',undefined]) {
    const s=state({type:'electronics',kind,lookups:'done',facts:{brand:{value:'A',source:'label',confidence:.94}}});
    const selected=select(s,store);s.kept=selected.process.map(step=>step.key);
    assert.equal(fieldState(selected.rows.find(row=>row.field==='brand')!,s,s.kept,store).state,kind?'proposed':'known');
  }
});

test('desktop part waits for build, lookups and offer, then becomes askable after kept or refused',()=>{
  for(const outcome of ['kept','refused'] as const) {
    const s=state({type:'electronics',kind:'desktops',kept:['scan','model_plate'],lookups:'done'});
    const row=select(s,params).rows.find(r=>r.field==='part.graphics')!;
    assert.equal(fieldState(row,s,s.kept,params).state,'waiting','build unresolved');
    s.facts.custom_build={value:true,source:'you_said',confidence:1};
    assert.equal(fieldState(row,s,s.kept,params).state,'waiting','offer unresolved');
    s[outcome].push('system_info');s.lookups='running';
    assert.equal(fieldState(row,s,s.kept,params).state,'waiting','lookup running');
    s.lookups='done';assert.equal(fieldState(row,s,s.kept,params).state,'missing',outcome);
  }
});
test('known lookup part bypasses unsettled build and read offer',()=>{
  const s=state({type:'electronics',kind:'desktops',lookups:'running',facts:{'part.memory':{value:32,source:'lookup',confidence:.95}}});
  const row=select(s,params).rows.find(r=>r.field==='part.memory')!;
  assert.equal(fieldState(row,s,[],params).state,'known');
});
test('part min_conf uses its kind scope and promoted threshold without moving another kind',()=>{
  const store=memoryStore();promoteConfidence(store,'part.memory','label','electronics.desktops',.9,.98);
  for(const kind of ['desktops','laptops']) {
    const s=state({type:'electronics',kind,lookups:'done',kept:['scan','model_plate','system_info','about_screenshot','front_screen_on','back'],facts:{custom_build:{value:true,source:'you_said',confidence:1},'part.memory':{value:16,source:'label',confidence:.95}}});
    const row=select(s,store).rows.find(r=>r.field==='part.memory')!;
    assert.equal(fieldState(row,s,s.kept,store).state,kind==='desktops'?'proposed':'known');
  }
});
test('refused build settles the part gate; a refused read does not wait on its label view',()=>{
  const s=state({type:'electronics',kind:'desktops',kept:['scan','model_plate'],lookups:'done',refused:['custom_build','system_info']});
  const row=select(s,params).rows.find(r=>r.field==='part.processor')!;
  assert.equal(fieldState(row,s,s.kept,params).state,'missing');
});
test('kept component read resolves label facts and retakes an explicit failed read',()=>{
  const s=state({type:'electronics',kind:'desktops',kept:['scan','model_plate','system_info'],lookups:'done',facts:{custom_build:{value:true,source:'you_said',confidence:1},'part.graphics':{value:'Example GPU',source:'label',confidence:.95,step:'system_info'}}});
  const row=select(s,params).rows.find(row=>row.field==='part.graphics')!;
  assert.equal(fieldState(row,s,['scan','model_plate'],params).state,'known');
  s.facts['part.graphics']={value:null,source:'label',confidence:0,step:'system_info',unknown_reason:'not_read'};
  assert.deepEqual(fieldState(row,s,['scan','model_plate'],params).shot,{step:'system_info',reason:'retake'});
});
test('unread unasked parts are unobtainable after the offer is refused',()=>{
  const s=state({type:'electronics',kind:'desktops',kept:['scan','model_plate'],lookups:'done',refused:['custom_build','system_info']});
  for(const row of select(s,params).rows.filter(row=>row.rank!==undefined && !row.ways.some(way=>way.way==='asked')))
    assert.equal(fieldState(row,s,s.kept,params).state,'unobtainable',row.field);
});
