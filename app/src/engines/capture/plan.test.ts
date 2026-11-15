import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plan } from './plan.ts';
import type { State } from './select.ts';
const state = (patch: Partial<State> = {}): State => ({capture_id:'c',item_id:'i',purpose:'sell',confirm_mode:'tap',has_lidar:true,sites:['ebay'],type:null,kept:[],retakes:{},facts:{},lookups:'none',refused:[],...patch});
import { memoryStore } from '../param/param.ts';
const run=(patch: Parameters<typeof state>[0])=>plan(state(patch),memoryStore());
test('type first and suggestion proposal requires margin',()=>{const p=run({suggestion:{family:'apparel',p:.86,second_p:.05},lookups:'running',kept:['front']});assert.equal(p.questions[0].field,'type');assert.deepEqual(p.questions[0].options[0],{value:'apparel',proposed:true});assert.ok(!run({suggestion:{family:'apparel',p:.45,second_p:.4}}).questions[0].options.some(o=>o.proposed));});
test('function from asked only never has a proposal',()=>{const q=run({type:'electronics',kept:['scan','model_plate']}).questions.find(q=>q.field==='function')!;assert.ok(q);assert.ok(q.options.every(o=>!o.proposed));});
test('find skips condition and refused fields never reappear',()=>assert.ok(run({type:'shoes',purpose:'find',kept:['scan','size_label','soles'],refused:['size']}).questions.every(q=>!['condition','size'].includes(q.field))));
test('required survives zero optional budget and fourth optional is capped',()=>{const p=run({type:'electronics',kind:'phones_laptops',kept:['about_screenshot','front_screen_on','back'],sites:['ebay'],facts:{type:{value:'electronics',source:'you_said',confidence:1}}});assert.ok(p.questions.some(q=>q.field==='signed_out'));assert.ok(p.questions.filter(q=>q.unlocks.required===0).length<=3);});
test('plan pure with field output sorted and fixed paths',()=>{const s=state({type:'apparel',kept:['front','back','tag']});const p=plan(s,memoryStore());assert.deepEqual(p,plan(structuredClone(s),memoryStore()));assert.deepEqual(p.fields.map(f=>f.field),p.fields.map(f=>f.field).sort());assert.equal(p.questions.find(q=>q.field==='condition')?.answer.path,'/v1/captures/c');});
test('optional cap drops the fourth and never caps required questions',()=>{const p=run({type:'bags',sites:['ebay'],kept:['scan','inside_tab'],lookups:'done'});assert.deepEqual(p.questions.filter(q=>q.unlocks.required===0).map(q=>q.field),['accessories','colour','brand']);assert.ok(p.questions.some(q=>q.field==='condition'));});
test('answered and refused optional fields consume the same cap',()=>{const p=run({type:'electronics',kind:'phones_laptops',sites:['ebay'],kept:['about_screenshot','front_screen_on','back'],refused:['brand','colour'],facts:{carrier_lock:{value:'unlocked',source:'you_said',confidence:1}}});assert.equal(p.questions.filter(q=>q.unlocks.required===0).length,0);assert.deepEqual(p.questions.map(q=>q.field),['condition','function','signed_out','storage_gb','model']);});
test('question cap reads ParamStore instead of a hardcoded three',()=>{const params=memoryStore();const tuned={...params,read:(name:string,scope:Parameters<typeof params.read>[1])=>({...params.read(name,scope),...(name==='capture_question_cap'?{value:0}:{})})};const p=plan(state({type:'bags',kept:['scan','inside_tab']}),tuned);assert.ok(p.questions.length>0);assert.ok(p.questions.every(q=>q.unlocks.required>0));});
test('text candidates select one with other and preserve a proposed value outside them',()=>{const p=run({type:'bags',sites:['depop'],kept:['scan','inside_tab'],candidates:{brand:['Coach','Gucci']},facts:{brand:{value:'Other brand',source:'lookup',confidence:.7}}});const q=p.questions.find(q=>q.field==='brand')!;assert.equal(q.kind,'pick_one');assert.equal(q.other,true);assert.deepEqual(q.options,[{value:'Other brand',proposed:true},{value:'Coach',proposed:false},{value:'Gucci',proposed:false}]);});
test('type auto acceptance uses its own floor and lead',()=>{assert.ok(!run({confirm_mode:'auto',suggestion:{family:'shoes',p:.91,second_p:.04}}).questions.some(q=>q.field==='type'));assert.ok(run({confirm_mode:'auto',suggestion:{family:'shoes',p:.91,second_p:.45}}).questions.some(q=>q.field==='type'));});
test('unlocks counts site-field pairs and ready_after follows linked site order',()=>{const p=run({type:'apparel',sites:['poshmark','depop'],kept:['front','back','tag'],facts:{condition:{value:'good',source:'you_said',confidence:1},brand:{value:'A',source:'you_said',confidence:1},department:{value:'unisex',source:'you_said',confidence:1},size_label:{value:'M',source:'label',confidence:.97}}});const q=p.questions[0];assert.equal(q.field,'size_label');assert.deepEqual(q.required_by,['poshmark','depop']);assert.deepEqual(q.unlocks,{required:2,ready_after:['poshmark','depop']});});
test('one retake groups both unread fields and marks the kept process step retake',()=>{const p=run({type:'apparel',pieces:2,sites:['depop','poshmark'],kept:['group','front.1','back.1','tag.1','front.2','back.2','tag.2'],facts:{'brand.2':{value:null,source:'label',confidence:0,unknown_reason:'not_read',step:'tag.2'},'size_label.2':{value:null,source:'label',confidence:0,unknown_reason:'not_read',step:'tag.2'}}});const shots=p.questions.filter(q=>q.kind==='shot');assert.equal(shots.length,1);assert.deepEqual(shots[0].fields,['brand.2','colour','condition','size_label.2']);assert.equal(shots[0].unlocks.required,3);assert.equal(p.process.find(s=>s.key==='tag.2')!.state,'retake');assert.deepEqual(shots[0].answer,{method:'POST',path:'/v1/captures/c/photos'});});
test('words and dimensions metadata come straight from the table',()=>{const p=run({type:'furniture',sites:['ebay'],kept:['scan'],lookups:'done'});const q=p.questions.find(q=>q.field==='dimensions')!;assert.equal(q.words,'Dimensions?');assert.deepEqual(q.parts,['width','depth','height']);assert.deepEqual(q.units,['cm','in']);assert.equal(q.unit,'cm');});
test('asked-only questions have no proposal even when an unsupported model fact exists',()=>{const q=run({type:'electronics',kept:['scan','model_plate'],facts:{function:{value:'works',source:'seen',confidence:1}}}).questions.find(q=>q.field==='function')!;assert.ok(q.options.every(o=>!o.proposed));});
test('ready_after uses form validity when a proposed enum is invalid',()=>{const p=run({type:'other',kept:['front','back'],facts:{condition:{value:'bogus',source:'seen',confidence:.7}}});assert.deepEqual(p.questions.find(q=>q.field==='condition')!.unlocks.ready_after,[]);});

test('text rows with fixed values keep pick_one, other and the proposal', () => {
  const q = run({type:'apparel',sites:['depop'],kept:['front','back','tag'],facts:{size_label:{value:'M',source:'label',confidence:.97}}}).questions.find(q=>q.field==='size_label')!;
  assert.equal(q.kind,'pick_one');
  assert.equal(q.other,true);
  assert.deepEqual(q.options.find(option=>option.proposed),{value:'M',proposed:true});
  assert.ok(q.options.some(option=>option.value==='XXL'));
});
test('shooting holds value questions but permits a kept-view retake', () => {
  const p = run({type:'apparel',sites:['depop'],kept:['front','tag'],facts:{size_label:{value:null,source:'label',confidence:0,unknown_reason:'not_read',step:'tag'}}});
  assert.equal(p.status,'shooting');
  assert.deepEqual(p.questions.map(q=>q.field),['tag']);
});
test('unlinked rows are absent from fields, value questions and retake coverage', () => {
  const p = run({type:'apparel',sites:['depop','poshmark'],kept:['front','back','tag'],facts:{fabric:{value:null,source:'label',confidence:0,unknown_reason:'not_read',step:'tag'}}});
  assert.ok(!p.fields.some(field=>field.field==='fabric'));
  assert.ok(!p.questions.some(q=>q.field==='fabric' || q.fields?.includes('fabric')));
});
test('known invalid required condition asks without proposal until the site accepts it', () => {
  const initial = {type:'other' as const,kept:['front','back'],facts:{condition:{value:'bogus',source:'you_said' as const,confidence:1,confirmed:true}}};
  const p = run(initial);
  const q = p.questions.find(q=>q.field==='condition')!;
  assert.ok(q);
  assert.equal(q.kind,'pick_one');
  assert.equal(q.why,'required');
  assert.ok(q.options.every(option=>!option.proposed && option.value!=='bogus'));
  assert.equal(p.complete.ebay!.ready,false);
  assert.deepEqual(q.unlocks.ready_after,['ebay']);
  assert.equal(run({...initial,facts:{condition:{value:'good',source:'you_said',confidence:1}}}).complete.ebay!.ready,true);
});
test('facts and refusals from another family do not consume current optional cap', () => {
  const initial = {type:'bags' as const,sites:['ebay'] as State['sites'],kept:['scan','inside_tab'],lookups:'done' as const};
  const before = run(initial);
  const after = run({...initial,refused:['size_label'],facts:{carrier_lock:{value:'unlocked',source:'you_said',confidence:1},storage_gb:{value:128,source:'you_said',confidence:1}}});
  assert.deepEqual(after.questions,before.questions);
});
test('empty candidates fall back to the fixed row values', () => {
  const p = run({type:'apparel',sites:['depop'],kept:['front','back','tag'],candidates:{size_label:[]}});
  const q = p.questions.find(question=>question.field==='size_label')!;
  assert.equal(q.kind,'pick_one');
  assert.deepEqual(q.options.map(option=>option.value),['XS','S','M','L','XL','XXL']);
});
