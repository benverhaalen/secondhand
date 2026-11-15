import assert from 'node:assert/strict';
import { test } from 'node:test';
import { table } from './table.ts';
import { select, studioStep, type State } from './select.ts';
import { memoryStore } from '../param/param.ts';
export const state = (patch: Partial<State> = {}): State => ({capture_id:'c',item_id:'i',purpose:'sell',confirm_mode:'tap',has_lidar:true,sites:['ebay'],type:null,kept:[],retakes:{},facts:{},lookups:'none',refused:[],...patch});
const run = (patch: Partial<State>) => select(state(patch),memoryStore());
test('insufficient suggestion margin falls back without a proposal', () => {const s=run({suggestion:{family:'furniture',p:.45,second_p:.4},rigid:true,extent_cm:85});assert.equal(s.family,'other');assert.equal(s.fallback,'type_unsure');assert.equal(s.dimension_class,'medium_hard');});
test('person type wins over suggestion',()=>assert.equal(run({type:'apparel',suggestion:{family:'shoes',p:.99,second_p:0}}).family,'apparel'));
test('130 cm rigid lamp becomes large bulky',()=>assert.equal(run({type:'lighting_home',rigid:true,extent_cm:130}).dimension_class,'large_bulky'));
test('6 cm electronics replaces scan with front',()=>{const s=run({type:'electronics',extent_cm:6});assert.equal(s.dimension_class,'small_hard');assert.deepEqual(s.process.map(s=>s.key),['front','model_plate']);});
test('bag without lidar keeps ring and label',()=>assert.deepEqual(run({type:'bags',has_lidar:false}).process.map(s=>s.key),['ring','inside_tab']));
test('bundle keys piece by piece and expands per piece fields and views',()=>{const s=run({type:'apparel',pieces:3});assert.equal(s.inner_class,'flat_garment');assert.deepEqual(s.process.map(s=>s.key),['group','front.1','back.1','tag.1','front.2','back.2','tag.2','front.3','back.3','tag.3']);assert.equal(s.rows.find(r=>r.field==='brand.2')?.ways[0].view,'tag.2');assert.ok(s.rows.some(r=>r.field==='dimensions.3'));assert.ok(!s.rows.some(r=>r.field==='brand'));});
test('other rigid size boundaries and soft goods',()=>{for(const [extent,expected] of [[9,'small_hard'],[10,'medium_hard'],[120,'large_bulky']] as const)assert.equal(run({type:'other',rigid:true,extent_cm:extent}).dimension_class,expected);assert.equal(run({type:'other'}).dimension_class,'soft_goods');});
test('unknown linked site names the rejected site',()=>assert.throws(()=>run({sites:['etsy' as State['sites'][number]]}),/etsy/));
test('kind overrides model plate and inherits function',()=>{const s=run({type:'electronics',kind:'phones_laptops'});assert.equal(s.dimension_class,'small_hard');assert.equal(s.rows.find(r=>r.field==='model')!.ways[0].view,'about_screenshot');assert.ok(s.rows.some(r=>r.field==='function'));});
test('all four selection bounds read champion values from ParamStore',()=>{const base=memoryStore();const values:Record<string,number>={capture_preselect_floor:.9,assist_preselect_margin:.8,capture_large_cm:150,capture_small_cm:5};const params={...base,read:(name:string,scope:Parameters<typeof base.read>[1])=>({...base.read(name,scope),value:values[name]??base.read(name,scope).value})};assert.equal(select(state({suggestion:{family:'apparel',p:.85,second_p:0}}),params).fallback,'type_unsure');assert.equal(select(state({type:'lighting_home',rigid:true,extent_cm:130}),params).dimension_class,'medium_hard');assert.equal(select(state({type:'electronics',extent_cm:6}),params).dimension_class,'medium_hard');});
test('soft goods keep an existing front exactly once',()=>assert.deepEqual(run({type:'other',rigid:true,extent_cm:6}).process.map(s=>s.key),['front']));
test('inclusive margin accepts exact decimal boundary .7 versus .5',()=>assert.equal(run({suggestion:{family:'apparel',p:.7,second_p:.5}}).family,'apparel'));
test('floor and margin each independently reject a suggestion',()=>{assert.equal(run({suggestion:{family:'apparel',p:.49,second_p:0}}).fallback,'type_unsure');assert.equal(run({suggestion:{family:'apparel',p:.8,second_p:.7}}).fallback,'type_unsure');assert.equal(run({suggestion:{family:'apparel',p:.5,second_p:.3}}).family,'apparel');});

test('LiDAR with failed Object Capture uses ring and rewrites scan ways', () => {
  const selected = run({type:'bags',has_lidar:true,object_capture:false});
  assert.deepEqual(selected.process.map(step=>step.key), ['ring','inside_tab']);
  assert.equal(selected.rows.find(row=>row.field==='dimensions')!.ways.find(way=>way.way==='measured')!.view, 'ring');
});
test('bundle scan ways follow ring keys per piece', () => {
  const selected = run({type:'bags',has_lidar:true,object_capture:false,pieces:2});
  assert.equal(selected.rows.find(row=>row.field==='dimensions.2')!.ways.find(way=>way.way==='measured')!.view, 'ring.2');
});

test('unknown rigid extent offers a medium hard scan; unknown rigidity stays soft', () => {
  const rigid=run({type:'other',rigid:true});
  assert.equal(rigid.dimension_class,'medium_hard','unknown extent must not imply a small item');
  assert.ok(rigid.process.some(step=>step.kind==='scan'));
  assert.equal(run({type:'other'}).dimension_class,'soft_goods');
});

test('bundle group and replacement front read their step definitions from the table', () => {
  const steps=table.steps;
  assert.ok(steps,'process.json must define group and front_still steps');
  const group=structuredClone(steps.group),front=structuredClone(steps.front_still);
  try {
    steps.group.seconds=17;steps.front_still.seconds=23;
    const selected=run({type:'electronics',extent_cm:6,pieces:2});
    assert.deepEqual(selected.process[0],{...steps.group,key:'group'});
    assert.deepEqual(selected.process.find(step=>step.key==='front.1'),{...steps.front_still,key:'front.1'});
  } finally {steps.group=group;steps.front_still=front;}
});
test('zone-less graphic and flaw studio steps use the type alone', () => {
 for(const type of ['graphic','flaw'] as const)assert.equal(studioStep({type,text:'Take a close photo.'}),type);
});
