import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plan } from './plan.ts';
import { memoryStore } from '../param/param.ts';
import { walks } from './walks.ts';
for (const {name,initial,cls,keys,events} of walks) {
 test(name,()=> {
  function run() {
   const state=structuredClone(initial),params=memoryStore(),plans:ReturnType<typeof plan>[]=[];
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
     assert.ok(!p.fields.some(field=>field.field===question.field && field.state==='known'),`${name}: never ask known ${question.field}`);
     assert.deepEqual(question.answer,question.kind==='shot' ? {method:'POST',path:`/v1/captures/${state.capture_id}/photos`} : {method:'PATCH',path:`/v1/captures/${state.capture_id}`});
    }
    plans.push(p);
   }
   const last=plans.at(-1)!;assert.equal(last.status,'done');assert.deepEqual(last.questions,[]);
   for(const site of state.sites)assert.equal(last.complete[site]!.ready,true,`${name} ${site} ready`);
   return plans;
  }
  assert.deepEqual(run(),run(),`${name} deterministic full plan sequence`);
 });
}
