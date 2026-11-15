import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { scan } from '../../../../scripts/copy-lint.mjs';
import data from '../../../../jobs/capture/process.json' with {type:'json'};
import { validateTable, table, type Table, type Site } from './table.ts';
test('v2 table validates every question and family', () => { assert.equal(table.version, 2); validateTable(data); });
for (const [cause, change] of [
  ['unknown site', (t) => { t.fields.root[0].required = ['unknown' as Site]; }],
  ['missing view', (t) => { t.fields.apparel[0].ways[0].view = 'absent'; }],
  ['family fields', (t) => { delete t.fields.shoes; }],
] satisfies [string,(t: Table)=>void][]) test(`validation rejects ${cause}`, () => { const t = structuredClone(data) as unknown as Table; change(t); assert.throws(() => validateTable(t), undefined, cause); });
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
