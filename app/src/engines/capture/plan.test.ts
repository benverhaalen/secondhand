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

import { scan } from '../../../../scripts/copy-lint.mjs';
const variants = [
  {label:'120 x 75 cm',value:{width:120,depth:75,height:75},p:.55},
  {label:'140 x 80 cm',value:{width:140,depth:80,height:75},p:.45},
];
const furniture = {type:'furniture' as const,sites:['facebook','ebay'] as State['sites'],rigid:true,extent_cm:120,kept:['scan'],lookups:'done' as const,variants:{dimensions:variants}};
const measured = {value:{width:120.6,depth:75.2,height:74.8},source:'measured' as const,confidence:.9};
test('unique measured match chooses published dimensions and explains the choice', () => {
  const p=run({...furniture,facts:{dimensions:measured}});
  const field=p.fields.find(f=>f.field==='dimensions')!;
  assert.equal(field.source,'lookup');assert.deepEqual(field.value,variants[0].value);
  assert.match(field.note!,/reading/i);
  assert.ok(!p.questions.some(q=>q.field==='dimensions'));
});
test('ambiguous or unavailable readings ask once with labelled variants and typed other', () => {
  const patches: Partial<State>[] = [
    {has_lidar:false,kept:['ring'],facts:{}},
    {facts:{dimensions:measured},variants:{dimensions:[variants[0],{...variants[1],value:{width:121,depth:76,height:75}}]}},
    {has_lidar:false,kept:['ring'],facts:{dimensions:measured}},
  ];
  for (const patch of patches) {
    const s={...furniture,...patch};const p=run(s);
    const questions=p.questions.filter(q=>q.field==='dimensions');assert.equal(questions.length,1);
    const q=questions[0];assert.equal(q.kind,'pick_one');assert.equal(q.other,true);assert.equal(q.why,'required');
    assert.deepEqual(q.options,s.variants!.dimensions!.map(v=>({value:v.value,label:v.label,proposed:false})));
    assert.deepEqual(q.parts,['width','depth','height']);assert.deepEqual(q.units,['cm','in']);
  }
});
test('confident variant needs no question; confirmed answers override variants', () => {
  const factsList: State['facts'][]=[{},{dimensions:{value:variants[1].value,source:'you_said',confidence:1}}];
  for (const facts of factsList) {
    const p=run({...furniture,has_lidar:false,kept:['ring'],variants:{dimensions:[{...variants[0],p:.93},variants[1]]},facts});
    assert.ok(!p.questions.some(q=>q.field==='dimensions'));
    assert.deepEqual(p.fields.find(f=>f.field==='dimensions')!.value,'dimensions' in facts?variants[1].value:variants[0].value);
  }
});
const tee={type:'apparel' as const,sites:['ebay','depop'] as State['sites'],kept:['front','back','tag'],lookups:'done' as const,
 facts:{dimensions:{value:{pit_to_pit:52,length:71},source:'measured' as const,confidence:.85},condition:{value:'good',source:'you_said' as const,confidence:1},size_label:{value:'M',source:'you_said' as const,confidence:1},brand:{value:'Gildan',source:'you_said' as const,confidence:1},department:{value:'unisex',source:'you_said' as const,confidence:1}}};
test('studio measure ask is covered by known dimensions from the shared ladder', () => {
 const before=run(tee),p=run({...tee,studio:{requested:true,measurements:['pit_to_pit','length'],asks:[{type:'measure',name:'pit_to_pit',text:'Measure across the chest.'}]}});
 assert.equal(p.complete.studio!.ready,true);assert.deepEqual(p.questions,before.questions);
 assert.deepEqual(Object.keys(p.complete),['ebay','depop','studio']);
});
test('studio measurements append to class parts and incomplete known dimensions still ask', () => {
 const p=run({...tee,studio:{requested:true,measurements:['waist','inseam','rise','leg_opening'],asks:[]}});
 const q=p.questions.find(q=>q.field==='dimensions')!;
 assert.deepEqual(q.parts,['pit_to_pit','length','waist','inseam','rise','leg_opening']);
 assert.deepEqual(q.required_by,['studio']);assert.deepEqual(q.unlocks.ready_after,['studio']);assert.equal(p.complete.studio!.ready,false);
});
const flaw={type:'flaw' as const,kind:'stain',zone:'left_sleeve',text:'Get close to the stain on the left sleeve so it fills the middle of the screen.'};
test('studio shot survives cap, stays held while shooting and settles only when kept', () => {
 const s={...tee,sites:['ebay'] as State['sites'],studio:{requested:true,measurements:['pit_to_pit','length'],asks:[flaw]}};
 const p=run(s),q=p.questions.find(q=>q.kind==='shot')!;
 assert.equal(p.questions.filter(q=>q.unlocks.required===0).length,0);
 assert.deepEqual(q.shot,{step:'flaw:left_sleeve',reason:'add',for:'studio',zone:'left_sleeve',flaw_kind:'stain'});
 assert.equal(q.words,flaw.text);assert.equal(q.why,'required');assert.deepEqual(q.required_by,['studio']);assert.equal(q.unlocks.required,1);
 assert.deepEqual(q.answer,{method:'POST',path:'/v1/captures/c/photos'});
 assert.equal(p.complete.studio!.ready,false);
 assert.ok(!run({...s,kept:['front']}).questions.some(q=>q.kind==='shot'));
 const settled=run({...s,refused:[],kept:[...s.kept,'flaw:left_sleeve']});assert.equal(settled.complete.studio!.ready,true);assert.ok(!settled.questions.some(q=>q.kind==='shot'));
});
test('every non-measure studio ask uses its exact text and step; studio is last in lists', () => {
 const asks=[{type:'cover' as const,text:'Take a photo of the whole front.'},{type:'back' as const,text:'Take a photo of the back.'},{type:'tag' as const,text:'Take a photo of the tag.'},{type:'graphic' as const,zone:'front',text:'Get close to the print.'},flaw];
 for(const ask of asks) {
  assert.deepEqual(scan(ask.text),[],ask.text);
  const p=run({...tee,studio:{requested:true,measurements:['pit_to_pit','length'],asks:[ask]}});
  const q=p.questions.find(q=>q.kind==='shot');
  if(tee.kept.includes(ask.type)) {assert.equal(q,undefined);assert.equal(p.complete.studio!.ready,true);continue;}
  assert.ok(q);assert.equal(q.words,ask.text);assert.equal(q.shot!.step,['graphic','flaw'].includes(ask.type)?`${ask.type}:${ask.zone}`:ask.type);
  assert.deepEqual(q.unlocks.ready_after,['studio']);
  for(const list of [...p.fields.map(f=>f.required_by),...p.questions.flatMap(q=>[q.required_by,q.unlocks.ready_after])]) if(list.includes('studio'))assert.equal(list.at(-1),'studio');
 }
});
test('studio alone requires dimensions and its shots, not marketplace all fields', () => {
 const p=run({type:'apparel',sites:[],kept:['front','back','tag'],facts:{dimensions:tee.facts.dimensions},studio:{requested:true,measurements:['pit_to_pit','length'],asks:[]}});
 assert.equal(p.complete.studio!.ready,true);assert.deepEqual(p.questions,[]);
});
import studioSpec from '../../../../jobs/studio/slides.json' with {type:'json'};
test('studio ask templates pass copy lint with the values _ask substitutes', () => {
 for(const type of ['cover','back','tag','graphic','flaw','measure'] as const) {
  const text=studioSpec.slide_types[type].ask.replaceAll('{zone}','left sleeve').replaceAll('{kind}','stain').replaceAll('{name}','pit to pit');
  assert.deepEqual(scan(text),[],`${type}: ${text}`);
 }
});
test('dimensions question unlocks linked sites then studio when every target lacks dimensions', () => {
 const p=run({...furniture,has_lidar:false,kept:['ring'],facts:{condition:{value:'good',source:'you_said',confidence:1},material:{value:'wood',source:'seen',confidence:.9}},profile:{handover:'pickup'},studio:{requested:true,measurements:['width','depth','height'],asks:[]}});
 const q=p.questions.find(q=>q.field==='dimensions')!;
 assert.deepEqual(q.required_by,['facebook','ebay','studio']);
 assert.deepEqual(q.unlocks,{required:3,ready_after:['facebook','ebay','studio']});
});
test('optional ambiguous variants ask for value with no proposed reading', () => {
 const q=run({...furniture,type:'bags',extent_cm:30,sites:['ebay'],kept:['scan','inside_tab'],facts:{condition:{value:'good',source:'you_said',confidence:1}}}).questions.find(q=>q.field==='dimensions')!;
 assert.equal(q.why,'value');assert.ok(q.options.every(o=>!o.proposed));
});
test('missing studio measurement does not make complete marketplace dimensions missing', () => {
 const p=run({...furniture,facts:{dimensions:{value:variants[0].value,source:'lookup',confidence:.96},condition:{value:'good',source:'you_said',confidence:1}},profile:{handover:'pickup'},studio:{requested:true,measurements:['width','depth','height','seat_height'],asks:[]}});
 assert.equal(p.complete.facebook!.ready,true);assert.equal(p.complete.ebay!.ready,true);assert.equal(p.complete.studio!.ready,false);
 const q=p.questions.find(q=>q.field==='dimensions')!;assert.ok(q);assert.deepEqual(q.unlocks.ready_after,['studio']);
});


test('furniture on depop asks brand after lookups and becomes ready after the answer', () => {
  const s = state({type:'furniture',sites:['depop'],kept:['scan'],lookups:'done',facts:{
    condition:{value:'good',source:'you_said',confidence:1},
    dimensions:{value:{width:52,depth:55,height:84},source:'measured',confidence:.9},
  }});
  const before=plan(s,memoryStore());
  const q=before.questions.find(question=>question.field==='brand');
  assert.ok(q,'missing furniture brand must be askable on depop');
  assert.equal(q.kind,'text');assert.equal(q.words,'Brand?');
  assert.deepEqual(q.unlocks.ready_after,['depop']);
  s.candidates={brand:['IKEA','West Elm']};
  assert.equal(plan(s,memoryStore()).questions.find(question=>question.field==='brand')!.kind,'pick_one');
  s.facts.brand={value:'IKEA',source:'you_said',confidence:1};
  assert.equal(plan(s,memoryStore()).complete.depop!.ready,true);
});
test('tapped seen colour consumes one optional answer on ebay bags', () => {
  const p=run({type:'bags',kept:['scan','inside_tab'],lookups:'done',facts:{colour:{value:['black'],source:'seen',confidence:.9,confirmed:true}}});
  assert.equal(p.questions.filter(q=>q.unlocks.required===0).length,2,'confirmed optional colour must consume the cap');
});
test('capped optional retake leaves the kept step kept', () => {
  const params=memoryStore();
  const zero={...params,read:(name:string,scope:Parameters<typeof params.read>[1])=>({...params.read(name,scope),...(name==='capture_question_cap'?{value:0}:{})})};
  const s=state({type:'bags',kept:['scan','inside_tab'],lookups:'done',facts:{brand:{value:null,source:'label',confidence:0,unknown_reason:'not_read',step:'inside_tab'}}});
  const uncapped=plan(s,{...params,read:(name:string,scope:Parameters<typeof params.read>[1])=>({...params.read(name,scope),...(name==='capture_question_cap'?{value:10}:{})})});
  assert.ok(uncapped.questions.some(q=>q.shot?.step==='inside_tab'));
  assert.equal(uncapped.process.find(step=>step.key==='inside_tab')!.state,'retake');
  const capped=plan(s,zero);
  assert.ok(!capped.questions.some(q=>q.shot?.step==='inside_tab'));
  assert.equal(capped.process.find(step=>step.key==='inside_tab')!.state,'kept','hidden retake must not mark a process step');
});
test('twelve-piece bundle keeps tag.1 without keeping tag.11', () => {
  const p=run({type:'apparel',pieces:12,sites:['depop'],kept:['group','tag.1']});
  assert.equal(p.process.find(step=>step.key==='tag.1')!.state,'kept');
  assert.equal(p.process.find(step=>step.key==='tag.11')!.state,'pending');
  assert.equal(p.fields.find(field=>field.field==='size_label.11')!.state,'waiting');
});
test('plan fields preserve only known auto-accept markers', () => {
  const initial={type:'apparel' as const,sites:['depop'] as State['sites'],kept:['front','back','tag'],facts:{
    size_label:{value:'M',source:'label' as const,confidence:.97},
    brand:{value:'Gildan',source:'label' as const,confidence:.96},
    condition:{value:'good',source:'seen' as const,confidence:1},
  }};
  const auto=run({...initial,confirm_mode:'auto'});
  assert.deepEqual(auto.fields.filter(field=>'auto_accepted' in field).map(field=>field.field),['size_label'],'known auto acceptance must reach fields output');
  assert.equal(auto.fields.find(field=>field.field==='size_label')!.auto_accepted,true);
  assert.ok(run(initial).fields.every(field=>!('auto_accepted' in field)));
  assert.ok(run({...initial,confirm_mode:'auto',facts:{...initial.facts,size_label:{...initial.facts.size_label,confirmed:true}}}).fields.every(field=>!('auto_accepted' in field)));
});
test('plan always carries inner_class, null for a single item', () => {
  assert.equal(run({type:'apparel'}).inner_class,null,'non-bundle inner_class must be null');
  assert.equal(run({type:'apparel',pieces:2}).inner_class,'flat_garment');
});
test('unsettled variants keep the reading visible and hold the question until shooting ends', () => {
 const reading={value:{width:60,height:50,depth:30},source:'measured' as const,confidence:.9};
 const initial={type:'bags' as const,lookups:'done' as const,variants:{dimensions:[{label:'Small',value:{width:30,height:22,depth:12},p:.6},{label:'Large',value:{width:40,height:30,depth:20},p:.6}]},facts:{dimensions:reading}};
 for(const kept of [['inside_tab'],['scan','inside_tab']]) {
  const p=run({...initial,kept}),field=p.fields.find(field=>field.field==='dimensions')!;
  assert.equal(field.state,kept.includes('scan')?'missing':'waiting');
  assert.deepEqual(field.value,reading.value);assert.equal(field.source,'measured');
  assert.equal(p.questions.filter(q=>q.field==='dimensions').length,kept.includes('scan')?1:0);
 }
});
test('weak matching reading leaves a variant question without a proposed option', () => {
 const p=run({...furniture,facts:{dimensions:{...measured,confidence:.5}}});
 const q=p.questions.find(q=>q.field==='dimensions');
 assert.ok(q,'weak measurement must leave the variant question');
 assert.ok(q.options.every(option=>!option.proposed));
});
test('zone-less graphic and flaw asks each collapse into one shot by type', () => {
 for(const type of ['graphic','flaw'] as const) {
  const asks=[{type,text:'Take a close photo.'},{type,text:'Take another close photo.'}];
  const p=run({...tee,studio:{requested:true,measurements:['pit_to_pit','length'],asks}});
  const shots=p.questions.filter(q=>q.kind==='shot');
  assert.equal(shots.length,1,'duplicate studio steps require one shot');
  assert.equal(shots[0].shot!.step,type);
  assert.equal(shots[0].words,asks[0].text);
  assert.ok(!shots[0].shot!.step.includes('undefined'));
  const settled=run({...tee,kept:[...tee.kept,type],studio:{requested:true,measurements:['pit_to_pit','length'],asks}});
  assert.equal(settled.complete.studio!.ready,true);
  assert.ok(!settled.questions.some(q=>q.kind==='shot'));
 }
});
