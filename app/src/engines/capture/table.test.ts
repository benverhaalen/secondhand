import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { scan } from '../../../../scripts/copy-lint.mjs';
import { memoryStore } from '../param/param.ts';
import { plan } from './plan.ts';
import { walks } from './walks.ts';
import data from '../../../../jobs/capture/process.json' with {type:'json'};
import { bound, validateTable, table, type Table } from './table.ts';
test('v2 table validates every question and family', () => { assert.equal(table.version, 2); validateTable(data); });
for (const [cause, change, expected] of [
  ['unknown site', (t) => { Reflect.set(t.fields.root[0], 'required', ['unknown']); }, /unknown site unknown/],
  ['missing view', (t) => { t.fields.apparel[0].ways[0].view = 'absent'; }, /missing view absent/],
  ['family fields', (t) => { delete t.fields.shoes; }, /missing fields for shoes/],
] satisfies [string,(t: Table)=>void,RegExp][]) test(`validation rejects ${cause}`, () => { const t = structuredClone(table); change(t); assert.throws(() => validateTable(t), expected, cause); });
test('root ways validate against every family process',()=>{const t=structuredClone(table);t.fields.root[3].ways[0].view='absent';assert.throws(()=>validateTable(t),/missing view absent/);});
test('site_names cannot hide an unknown site',()=>{const t=structuredClone(table);t.fields.root[2].site_names={etsy:{max_length:10}} as Table['fields'][string][number]['site_names'];assert.throws(()=>validateTable(t),/unknown site etsy/);});
test('class measurement views validate too',()=>{const t=structuredClone(table);t.classes.bag.dimensions!.ways[0].view='absent';assert.throws(()=>validateTable(t),/missing view absent/);});

test('every ask.words passes copy lint in tests only', () => {
  function check(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    const ask = object.ask as {words?: string}|undefined;
    if (ask?.words) assert.deepEqual(scan(ask.words), [], ask.words);
    for (const child of Object.values(object)) check(child);
  }
  check(data);
});
test('capture sources remain safe for Metro API route bundles', () => {
  const folder = new URL('.', import.meta.url);
  for (const file of readdirSync(folder).filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))) {
    const source = readFileSync(new URL(file, folder), 'utf8');
    assert.doesNotMatch(source, /import\.meta|readFileSync|^await /m, file);
  }
  assert.doesNotMatch(readFileSync(new URL('table.ts', folder), 'utf8'), /copy-lint/, 'table.ts must not load copy-lint');
});
test('ways use canonical fill-ladder rung seen', () => {
  assert.doesNotMatch(JSON.stringify(data.fields), /"way":"photo"/);
  assert.doesNotMatch(JSON.stringify(data.classes), /"way":"photo"/);
});
test('rigid dimensions try published lookup before measurement and asking', () => {
  for (const name of ['bag','medium_hard','large_bulky'] as const) {
    assert.deepEqual(table.classes[name].dimensions!.ways.map(w=>[w.way,w.min_conf]),[['lookup',.9],['measured',.8],['asked',undefined]]);
  }
});

test('furniture brand uses lookup then asked and only depop requires it', () => {
  const brand=table.fields.furniture.find(row=>row.field==='brand')!;
  assert.deepEqual(brand.ways,[{way:'lookup',min_conf:.9},{way:'asked'}]);
  assert.deepEqual(brand.required,['depop']);assert.deepEqual(brand.recommended,[]);
  assert.deepEqual(brand.ask,{kind:'pick_one',words:'Brand?'});
});

test('a prior stated in two files: capture bounds are declared only from process.json params', () => {
  const folder = new URL('.', import.meta.url);
  assert.doesNotMatch(readFileSync(new URL('table.ts', folder), 'utf8'), /const PRIORS\s*=\s*\{/);
  const priors = table.params;
  assert.ok(priors && Object.keys(priors).length > 0);
  for (const file of readdirSync(folder).filter(file=>file.endsWith('.ts') && !file.endsWith('.test.ts'))) {
    const source=readFileSync(new URL(file,folder),'utf8');
    for(const match of source.matchAll(/bound\(params,\s*['"]([^'"]+)['"]/g))
      assert.ok(Object.hasOwn(priors,match[1]),`${file}: undeclared bound ${match[1]}`);
  }
  const store=memoryStore(),declare=store.declare;
  store.declare=declaration=>{
    assert.equal(declaration.prior,priors[declaration.name as keyof typeof priors],declaration.name);
    declare(declaration);
  };
  for(const [name,prior] of Object.entries(priors))assert.equal(bound(store,name as keyof typeof data.params),prior,name);
  const original=priors.capture_preselect_floor;
  try {
    priors.capture_preselect_floor=original/2;
    assert.equal(bound(store,'capture_preselect_floor'),original/2);
  } finally {priors.capture_preselect_floor=original;}
});
test('every name bound() is called with is in the params block, including computed effort names', () => {
  const store=memoryStore(), read=store.read;
  store.read=(name,scope)=>{
    if(!name.startsWith('capture_min_conf.'))assert.ok(Object.hasOwn(table.params,name),`undeclared bound ${name}`);
    return read(name,scope);
  };
  for(const fixture of walks) {
    const state=structuredClone(fixture.initial);
    for(const event of fixture.events) {
      const facts=state.facts;
      Object.assign(state,event.patch);state.facts={...facts,...event.patch.facts};
      plan(state,store);
    }
  }
});
test('max on a non-list row accepted is rejected', () => {
  const t=structuredClone(table);Reflect.set(t.fields.root[0],'max',2);
  assert.throws(()=>validateTable(t),/max.*list/);
});
test('list max under one is rejected', () => {
  for(const max of [0,-1,.5]) {
    const t=structuredClone(table);Reflect.set(t.fields.root.find(row=>row.field==='colour')!,'max',max);
    assert.throws(()=>validateTable(t),/max.*1/);
  }
});
test('colour list maximum lives in the table', () => {
  for(const rows of Object.values(table.fields))for(const row of rows)
    if(row.field==='colour')assert.equal(row.max,2);
});
