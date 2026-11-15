import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { State } from './select.ts';
import { plan } from './plan.ts';
import { memoryStore } from '../param/param.ts';
import { walks } from './walks.ts';
for (const fixture of walks) {
 for(const shifted of fixture.initial.variants?.dimensions ? [false,true] : [false]) {
 const {name,initial,cls,keys,events}=structuredClone(fixture);
 if(shifted) {
  for(const variant of initial.variants!.dimensions!)variant.value={...variant.value,width:variant.value.width+10};
  for(const event of events) {
   const value=event.patch.facts?.dimensions?.value;
   if(value && typeof value==='object' && 'width' in value && typeof value.width==='number')value.width+=10;
  }
 }
 test(name+(shifted?' with shifted fixture dimensions':''),(t)=> {
  function run(studio?: State['studio']) {
   const state=structuredClone(initial),params=memoryStore(),plans:ReturnType<typeof plan>[]=[];
   if(studio)state.studio=studio;
   const asked=new Set<string>();
   let expectedClass=cls,expectedKeys=keys;
   for(const [i,event] of events.entries()) {
    const oldFacts=state.facts;
    Object.assign(state,event.patch);
    state.facts={...oldFacts,...event.patch.facts};
    expectedClass=event.cls??expectedClass;expectedKeys=event.keys??expectedKeys;
    const p=plan(state,params);
    assert.equal(p.dimension_class,expectedClass,`${name} event ${i+1} class`);
    assert.deepEqual(p.process.map(s=>s.key),expectedKeys,`${name} event ${i+1} process`);
    assert.deepEqual(p.questions.map(x=>[x.shot?.step??x.field,x.kind,x.options.find(o=>o.proposed)?.value??null]),event.questions,`${name} event ${i+1} questions`);
    assert.equal(p.status,event.status,`${name} event ${i+1} status`);
    for (const question of p.questions) {
     asked.add(`${question.id}:${question.shot?.reason==='retake'?state.retakes[question.shot.step]??0:''}`);
     assert.ok(!p.fields.some(field=>field.field===question.field && field.state==='known'),`${name}: never ask known ${question.field}`);
     assert.deepEqual(question.answer,question.kind==='shot' ? {method:'POST',path:`/v1/captures/${state.capture_id}/photos`} : {method:'PATCH',path:`/v1/captures/${state.capture_id}`});
    }
    plans.push(p);
   }
   const last=plans.at(-1)!;assert.equal(last.status,'done');assert.deepEqual(last.questions,[]);
   for(const site of state.sites)assert.equal(last.complete[site]!.ready,true,`${name} ${site} ready`);
   return {plans,questions:asked.size};
  }
  const result=run();const {plans}=result;
  assert.deepEqual(result,run(),`${name} deterministic full plan sequence`);
  assert.deepEqual(result,run({requested:false,measurements:['waist'],asks:[{type:'back',text:'Take a photo of the back.'}]}),`${name} Generate off leaves full output identical`);
  if(!shifted)t.diagnostic(`capture.questions ${name}=${result.questions}`);
  if(initial.variants?.dimensions) {
   const fact=events.map(event=>event.patch.facts?.dimensions).findLast(fact=>fact!==undefined)!;
   const reading=fact.value as Record<string,number>;
   const distance=(value:Record<string,number>)=>Object.entries(value).reduce((sum,[part,value])=>sum+(reading[part]-value)**2,0);
   const chosen=initial.variants.dimensions.reduce((best,variant)=>distance(variant.value)<distance(best.value)?variant:best);
   assert.deepEqual(plans.at(-1)!.fields.find(f=>f.field==='dimensions')!.value,chosen.value);
  }
 });
}
}
