import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readParts } from './parts.ts';
import { table, bound, type FieldRow } from './table.ts';
import { memoryStore } from '../param/param.ts';

// data: example. Constructed from the public layouts of Windows 11 About and
// macOS About This Mac; these are not real captures.
export const windows = [
  'Device name   EXAMPLE-DESKTOP',
  'Processor   Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz   2.90 GHz',
  'Installed RAM   16.0 GB (15.8 GB usable)',
  'Storage   476.9 GB SSD SAMSUNG MZVL2512HCJQ',
  'Graphics Card   NVIDIA GeForce RTX 3060 (12 GB)',
  'Product ID   EXAMPLE-PRODUCT-ID',
].map(line=>({line,confidence:.95}));
const desktop=()=>table.components['electronics.desktops'].parts;
const slack=()=>bound(memoryStore(),'capture_part_size_slack');
const read=(line:string,field='storage')=>readParts([{line,confidence:.93}],desktop().filter(row=>row.field===field),slack());
const fact=(field:string,value:unknown,confidence=.93)=>({field:`part.${field}`,value,source:'label',confidence});
test('F17: storage size matching uses the 0.03 prior',()=>assert.equal(slack(),0.03));
for(const [line,value] of [
  ['Storage   123 GB used of 476 GB',512],
  ['Storage   1.82 TB',2000],['Storage   476.9 GB',512],
  ['Storage   2 TB',2000],['Storage   465.7 GB',500],
  ['Storage   500.07 GB',500],['Storage   238.4 GB',256],
] as const)test(`F17: ${line} reads ${value}`,()=>assert.deepEqual(read(line),[fact('storage',value)]));
test('300 GB and 447 GB are dropped beyond the 0.03 size slack',()=>{
  assert.deepEqual(read('Storage   300 GB'),[]);assert.deepEqual(read('Storage   447 GB'),[]);
});
test('size slack is supplied by the caller',()=>assert.deepEqual(readParts([{line:'Storage 476.9 GB',confidence:.95}],desktop(),0),[]));
test('Windows 11 About parses each labelled part with its own confidence',()=>{
  assert.deepEqual(readParts(windows,desktop(),slack()),[
    fact('graphics','NVIDIA GeForce RTX 3060 (12 GB)',.95),
    fact('processor','Intel Core i7-10700',.95),fact('memory',16,.95),fact('storage',512,.95),
  ]);
});
test('macOS Chip Memory and Graphics labels parse their expected parts',()=>{
  const lines=['Chip   Apple M2 Pro','Memory   16 GB','Graphics   Apple M2 Pro'].map((line,i)=>({line,confidence:.91+i*.01}));
  assert.deepEqual(readParts(lines,desktop(),slack()),[fact('graphics','Apple M2 Pro',.93),fact('processor','Apple M2 Pro',.91),fact('memory',16,.92)]);
  assert.deepEqual(readParts(lines,table.components['electronics.laptops'].parts,slack()),[fact('memory',16,.92)]);
});
test('Processors does not match Processor; the first whole-word label wins',()=>{
  const lines=['Processors   Wrong','Processor   Intel® Core™ CPU @ 3.00GHz','Processor   Later'].map(line=>({line,confidence:.9}));
  assert.deepEqual(readParts(lines,desktop(),slack()),[fact('processor','Intel Core',.9)]);
  assert.deepEqual(read('Processors   Wrong','processor'),[]);
});
test('the first matching line is used even when its value cannot be parsed',()=>{
  assert.deepEqual(readParts([{line:'Memory unavailable',confidence:.95},{line:'Memory 16 GB',confidence:.95}],desktop(),slack()),[]);
});
test('labels and units come from rows; watts are the number before W',()=>{
  const rows:FieldRow[]=[{...desktop()[0],field:'supply',type:'number',unit:'W',labels:['Power Supply']}];
  assert.deepEqual(readParts([{line:'Power Supply   750 W',confidence:.87}],rows,slack()),[fact('supply',750,.87)]);
  assert.deepEqual(readParts([{line:'Power Supply unknown',confidence:.87}],rows,slack()),[]);
});
test('same input twice gives deep-equal output and leaves lines and rows unchanged',()=>{
  const rows=desktop(),before=structuredClone({lines:windows,rows});
  assert.deepEqual(readParts(windows,rows,slack()),readParts(windows,rows,slack()));
  assert.deepEqual({lines:windows,rows},before);
});
test('Device name and Product ID lines never appear in output',()=>{
  const output=JSON.stringify(readParts(windows,desktop(),slack()));
  assert.doesNotMatch(output,/Device name|Product ID|EXAMPLE-DESKTOP|EXAMPLE-PRODUCT-ID/);
  assert.deepEqual(readParts([windows[0],windows.at(-1)!],desktop(),slack()),[]);
});

test('the last of clause determines capacity even with more than one of clause',()=>{
  assert.deepEqual(read('Storage 123 GB used of 256 GB of 2 TB'),[fact('storage',2000)]);
});
test('GB enum values use the nearest ratio regardless of row order',()=>{
  const row={...desktop().find(row=>row.field==='storage')!,values:[2048,512,2000,128]};
  assert.deepEqual(readParts([{line:'Storage 1.82 TB',confidence:.95}],[row],slack()),[fact('storage',2000,.95)]);
});
test('equal ratios between the two tries prefer the as-printed size regardless of row order',()=>{
  const row={...desktop().find(row=>row.field==='storage')!,values:[128*1.073741824,128]};
  assert.deepEqual(readParts([{line:'Storage 128 GB',confidence:.95}],[row],0),[fact('storage',128,.95)]);
});
test('size slack includes its ratio boundary and drops a reading just outside it',()=>{
  const row={...desktop().find(row=>row.field==='storage')!,values:[100]};
  const lines=[{line:'Storage 125 GB',confidence:.95}];
  assert.deepEqual(readParts(lines,[row],.25),[fact('storage',100,.95)]);
  assert.deepEqual(readParts(lines,[row],.249),[]);
});
test('a zero size cannot match a positive listed capacity',()=>assert.deepEqual(read('Storage 0 GB'),[]));
test('trademark and CPU words are removed while interior model numbers remain',()=>{
  assert.deepEqual(read('Processor Intel® Core™ i7-10700 Processor CPU @ 2.90GHz 2.90 GHz','processor'),[fact('processor','Intel Core i7-10700')]);
});
test('a Device name or Product ID inside a matching part line is also dropped',()=>{
  assert.deepEqual(read('Processor Device name EXAMPLE','processor'),[]);
  assert.deepEqual(read('Processor Product ID EXAMPLE','processor'),[]);
});
test('labels match the first words across leading spaces and OCR whitespace',()=>{
  assert.deepEqual(read('  Installed\tRAM   16 GB','memory'),[fact('memory',16)]);
});
