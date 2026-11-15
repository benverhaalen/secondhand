import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONDITION } from '../../../../spec/sites.mjs';
import { known, fieldState, formValue } from './fields.ts';
import { select } from './select.ts';
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
