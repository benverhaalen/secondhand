import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadInputs, mapRead, inchesToCm, recordItem, root, output, python } from './capture-real.mjs';
import { plan } from '../app/src/engines/capture/plan.ts';
import { memoryStore } from '../app/src/engines/param/param.ts';

const inputs = loadInputs();
const expected = {
  'carhartt-pants': {size_label:'38x36', fabric:'100% Cotton'},
  'chico-hoodie': {size_label:'XXL', brand:'RUSSELL ATHLETIC'},
  'marquette-tee': {size_label:'XL', fabric:'100% COTTON', brand:'FRUIT OF THE LOOM'},
};
for (const input of inputs) test(`${input.item}: tag rules, provenance, process roles and tape only`, () => {
  const {state, rules} = mapRead(input);
  assert.equal(state.type, 'apparel');
  assert.equal(state.purpose, 'sell');
  assert.equal(state.confirm_mode, 'tap');
  assert.equal(state.has_lidar, false);
  assert.equal(state.object_capture, false);
  assert.equal(state.lookups, 'none');
  assert.deepEqual(state.sites, ['ebay','depop','poshmark']);
  assert.deepEqual(state.kept, input.item === 'chico-hoodie' ? ['front','tag'] : ['front','back','tag']);
  assert.deepEqual(Object.fromEntries(Object.entries(state.facts).filter(([key])=>key!=='dimensions').map(([key,f])=>[key,f.value])), expected[input.item]);
  for (const [field, fact] of Object.entries(state.facts)) {
    assert.ok(rules[field], `${field} missing rule`);
    assert.equal(fact.confidence, field === 'dimensions' ? 1 : 0);
    assert.equal(fact.source, field === 'dimensions' ? 'you_said' : 'label');
  }
  assert.equal(state.facts.colour, undefined);
  assert.equal(state.facts.condition, undefined);
  if (input.item === 'marquette-tee') assert.deepEqual(state.facts.dimensions.value, {pit_to_pit:54, length:68.6});
  else assert.equal(state.facts.dimensions, undefined);
  assert.match(input.manifest, input.item === 'carhartt-pants' ? /20261115-0800/ : /20261115-0836/);
});
test('no token, one-word overlap, free colour and flaws make no fact', () => {
  const input = {...inputs[0], tape:null, read:{name:'Red Carhartt pants', tag_text:'Carhartt regular cotton', item_text:'red worn pants', photos:[{index:0,role:'front',flaws:[{kind:'hole'}]}]}};
  assert.deepEqual(mapRead(input).state.facts, {});
});
test('size is a single whole token; spaced WxL normalizes; brand is longest contiguous overlap', () => {
  const check = (name,tag_text)=>mapRead({...inputs[0],tape:null,read:{name,tag_text,photos:[]}}).state.facts;
  assert.equal(check('a','SMALL MEDIUM').size_label, undefined);
  assert.equal(check('a','S M').size_label, undefined);
  assert.equal(check('a','38 X 36').size_label.value, '38x36');
  assert.equal(check('The Fruit of the Loom tee','FRUIT OF THE LOOM Fruit').brand.value,'FRUIT OF THE LOOM');
  for (const size of ['XS','S','M','L','XL','XXL','XXXL']) assert.equal(check('a',size).size_label.value,size);
});
test('inches become cm rounded to one decimal', () => {
  assert.equal(inchesToCm(21.25),54);
  assert.equal(inchesToCm(27),68.6);
});
test('every photo is scored with its indexed role; fields, questions and site completion are engine results', () => {
  for (const input of inputs) {
    const calls=[];
    const record=recordItem(input,(file,role)=>{calls.push([file,role]); return {score:7,parts:{exposure:.5}};});
    const files=readdirSync(`${root}/assets/demo-items/real/${input.item}`).filter(f=>/\.(jpg|jpeg|png)$/i.test(f)).sort();
    assert.deepEqual(calls,files.map((file,index)=>[`assets/demo-items/real/${input.item}/${file}`,input.read.photos.find(p=>p.index===index).role]));
    assert.deepEqual(record.photos,calls.map(([file,role])=>({file,role,score:7,parts:{exposure:.5}})));
    const p=plan(record.state,memoryStore());
    assert.equal(record.status,p.status);
    assert.deepEqual(record.fields,p.fields);
    assert.deepEqual(record.questions,p.questions.map(q=>[q.shot?.step ?? q.field,q.kind,q.options.find(o=>o.proposed)?.value ?? null]));
    assert.deepEqual(record.complete,p.complete);
    assert.deepEqual(record.flaws,input.read.photos.flatMap(p=>(p.flaws ?? []).map(flaw=>({index:p.index,flaw}))));
  }
});
test('missing or duplicate photo indices fail with their cause before scoring', () => {
  for (const photos of [inputs[0].read.photos.slice(1),inputs[0].read.photos.map(p=>({...p,index:0}))]) {
    assert.throws(()=>recordItem({...inputs[0],read:{...inputs[0].read,photos}},()=>assert.fail('scored before validation')), /photo indices/);
  }
});
test('two real CLI runs produce identical records, captured header and one summary per item', () => {
  const run=()=>{
    const r=spawnSync(process.execPath,['scripts/capture-real.mjs'],{cwd:root,encoding:'utf8',timeout:120000});
    assert.ifError(r.error);
    assert.equal(r.status,0,r.stderr);
    return {bytes:readFileSync(output,'utf8'),summary:r.stdout.trim().split('\n')};
  };
  const a=run(), b=run();
  assert.deepEqual(a,b);
  const record=JSON.parse(a.bytes);
  assert.deepEqual(record.header,{
    data:'captured',items:3,
    what_is_real:"Ben's photos of three real garments and a recorded vision-model read of them",
    what_is_not:'no identify run, no phone reads or depth, confidences absent from the read',
    date:'2026-11-15',read_model:'google/gemini-4-carbon',
  });
  assert.equal(record.items.length,3);
  assert.equal(a.summary.length,3);
  for(const line of a.summary) assert.match(line,/one run on three items, not accuracy/);
  for(const item of record.items) for(const photo of item.photos) {
    assert.ok(Number.isInteger(photo.score) && photo.score>=0 && photo.score<=100);
    assert.equal(Object.keys(photo.parts).length,7);
    assert.equal(photo.parts.fill,.5);
  }
});

test('Python entry really calls project score() on every original photo with the recorded role', () => {
  const record=JSON.parse(readFileSync(output,'utf8'));
  const photos=record.items.flatMap(item=>item.photos);
  const result=spawnSync(python,['-c',`
import json, sys
import numpy as np
from PIL import Image
from jobs.photo.score import score
out=[]
for photo in json.load(sys.stdin):
    with Image.open(photo['file']) as image:
        out.append(score(np.asarray(image.convert('RGB')), role=photo['role']))
print(json.dumps(out))
`],{cwd:root,input:JSON.stringify(photos),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(photos.map(({score,parts})=>({score,parts})),JSON.parse(result.stdout));
});
