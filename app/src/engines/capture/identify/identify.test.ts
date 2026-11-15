import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createLog, memorySink } from '../../../../../log/index.js';
import { memoryStore } from '../../param/param.ts';
import { identify, type IdentifyInput, type IdentifyPorts } from './identify.ts';

const root = new URL('../../../../../', import.meta.url);
const json = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const record = json('spec/items/capture-real/2026-11-15.json') as {items: {item: string; manifest: string; photos: {file: string; role: string}[]; state: {capture_id: string; type: string}}[]};
const visualFixture = JSON.parse(readFileSync(new URL('./fixtures/visual.json', import.meta.url), 'utf8')) as {reply: {title: string; rank: number}[]};
const modelFixture = JSON.parse(readFileSync(new URL('./fixtures/model.json', import.meta.url), 'utf8')) as {reply: unknown};
function logger() {
  const sink = memorySink();
  return {sink, log: createLog({src: 'job.identify', build: 'test', seed: 1, sink})};
}
const input: IdentifyInput = {capture_id: 'cap_unknown', family: 'apparel', photos: [{key: 'front', role: 'front'}, {key: 'tag', role: 'tag', text: [{line: 'XL MADE IN MEXICO', confidence: 0}]}]};

for (const row of record.items) test(`${row.item}: the real tag confirms its brand without visual or model calls`, async () => {
  const {read} = json(row.manifest) as {read: {tag_text: string}};
  const calls: string[] = [];
  const capture: IdentifyInput = {capture_id: row.state.capture_id, family: row.state.type,
    photos: row.photos.map(photo => ({key: photo.file, role: photo.role, file_ref: photo.file, ...(photo.role === 'tag' ? {text: [{line: read.tag_text, confidence: 0}]} : {})}))};
  const {log} = logger();
  const out = await identify(capture, {visual: async () => {calls.push('visual'); return [];}, model: async () => {calls.push('model'); return {};}}, memoryStore(), log);
  assert.equal(out.action, 'confirm');
  assert.equal(out.set[0]?.brand, {'carhartt-pants': 'Carhartt', 'chico-hoodie': 'Russell Athletic', 'marquette-tee': 'Fruit of the Loom'}[row.item]);
  assert.ok(out.set[0].rests_on.some(line => line.includes('on the tag')));
  assert.ok(out.facts.every(fact => fact.confidence === 0 && capture.photos.some(photo => photo.key === fact.ref)));
  assert.deepEqual(calls, []);
});

test('code abstention opens visual search but visual evidence cannot enter the conformal set', async () => {
  const calls: string[] = [];
  const {log, sink} = logger();
  const out = await identify(input, {visual: async () => {calls.push('visual'); return visualFixture.reply;}, model: async () => {calls.push('model'); return {};}}, memoryStore(), log);
  assert.deepEqual(calls, ['visual']);
  assert.equal(out.action, 'ask');
  assert.deepEqual(out.set, []);
  const found = out.stages.find(s => s.name === 'visual')!.found;
  const proposed = found.candidates as {brand: string; c: number; rests_on: string[]}[];
  const nike = proposed.find(row => row.brand === 'Nike')!;
  assert.ok(nike.c <= 0.5);
  const total = visualFixture.reply.reduce((sum, hit) => sum + 1 / hit.rank, 0);
  assert.ok(Math.abs(nike.c - 0.5 * (1 + 1 / 2 + 1 / 3) / total) < 1e-12);
  assert.deepEqual(nike.rests_on, ['3 of 5 similar listings']);
  assert.equal(sink.lines.filter(line => JSON.parse(line).event === 'user.input').length, 1);
  assert.equal(sink.lines.filter(line => JSON.parse(line).event === 'job.stage').length, 4);
  assert.ok(!sink.text().includes(visualFixture.reply[0].title));
  log.end();
  if (process.env.IDENTIFY_TEST_LOG) writeFileSync(process.env.IDENTIFY_TEST_LOG, sink.text());
});

test('without a visual port the recorded model proposal is capped at rung four', async () => {
  const calls: string[] = [];
  const {log} = logger();
  const out = await identify(input, {model: async (_photos, ask) => {calls.push(...ask.fields); return modelFixture.reply;}}, memoryStore(), log);
  assert.deepEqual(calls, ['brand']);
  assert.equal(out.action, 'ask');
  const proposed = out.stages.find(s => s.name === 'model')!.found.candidates as {brand: string; c: number}[];
  assert.equal(proposed[0]?.brand, 'Carhartt');
  assert.equal(proposed[0]?.c, 0.3);
});

test('untrusted model fields are dropped individually and logged', async () => {
  const {log, sink} = logger();
  const out = await identify({...input, family: null}, {model: async () => ({family: 'spaceship', brand: ' '.repeat(5), model: 42, extra: 'not accepted'})}, memoryStore(), log);
  assert.equal(out.set.length, 0);
  assert.equal(out.stages.find(s => s.name === 'model')!.found.family, undefined);
  assert.ok(sink.text().includes('identify model field dropped'));
  assert.ok(sink.text().includes('family'));
});

test('a throwing visual port leaves parsed facts and the remaining stages intact', async () => {
  const {log, sink} = logger();
  const out = await identify(input, {visual: async () => {throw new Error('recorded visual failure');}, model: async () => modelFixture.reply}, memoryStore(), log);
  assert.equal(out.action, 'ask');
  assert.ok(out.facts.some(fact => fact.field === 'size_label' && fact.value === 'XL'));
  assert.equal(out.stages.find(s => s.name === 'visual')?.state, 'failed');
  assert.equal(out.stages.find(s => s.name === 'model')?.state, 'arrived');
  assert.ok(sink.text().includes('recorded visual failure'));
});

test('UPC and leading-zero EAN share the existing GTIN normalizer and catalogue lookup', async () => {
  const codes: string[] = [];
  const {log} = logger();
  const out = await identify({capture_id: 'cap_code', family: 'apparel', photos: [{key: 'front', role: 'front', codes: [{symbology: 'UPC-A', payload: '012345678905'}, {symbology: 'EAN-13', payload: '0012345678905'}, {symbology: 'QR', payload: 'not a gtin'}]}]}, {
    catalogue: async code => {codes.push(code); return {brand: 'Carhartt', model: 'B324', family: 'apparel'};},
    visual: async () => {assert.fail('catalogue hit must close visual search');},
    model: async () => {assert.fail('catalogue hit must close model');},
  }, memoryStore(), log);
  assert.deepEqual(codes, ['00012345678905']);
  assert.equal(out.set[0].product_id, 'brand:carhartt/model:b324');
  assert.equal(out.set[0].c, 1);
  assert.equal(out.action, 'confirm');
});

test('missing phone text and codes use OCR and barcode ports without rereading provided arrays', async () => {
  const calls: string[] = [];
  const ports: IdentifyPorts = {
    barcode: async p => {calls.push(`barcode:${p.key}`); return undefined;},
    ocr: async p => {calls.push(`ocr:${p.key}`); return [{line: 'Russell Athletic XXL', confidence: 0.8}];},
  };
  const {log} = logger();
  const out = await identify({capture_id: 'cap_ocr', family: 'apparel', photos: [{key: 'tag', role: 'tag'}, {key: 'read', role: 'care_label', text: [], codes: []}]}, ports, memoryStore(), log);
  assert.equal(out.action, 'confirm');
  assert.deepEqual(calls, ['barcode:tag', 'ocr:tag']);
});

test('an OCR failure does not discard other tag photos or catalogue evidence', async () => {
  const {log, sink} = logger();
  const out = await identify({...input, photos: [...input.photos, {key: 'bad', role: 'care_label'}]}, {ocr: async () => {throw new Error('unreadable');}}, memoryStore(), log);
  assert.equal(out.stages.find(stage => stage.name === 'tag')?.state, 'failed');
  assert.ok(out.facts.some(fact => fact.field === 'size_label'));
  assert.ok(sink.text().includes('unreadable'));
});

test('family still open calls the model only for family and preserves the tag brand', async () => {
  const {log} = logger();
  let asked: string[] = [];
  const out = await identify({capture_id: 'cap_family', family: null, photos: [{key: 'tag', role: 'tag', text: [{line: 'Carhartt', confidence: 0}]}]}, {
    model: async (_photos, ask) => {asked = ask.fields; return {family: 'apparel', brand: 'Nike'};},
  }, memoryStore(), log);
  assert.deepEqual(asked, ['family']);
  assert.equal(out.set[0].family, 'apparel');
  assert.equal(out.set[0].brand, 'Carhartt');
});

test('identical input produces identical results and no input is mutated', async () => {
  const before = structuredClone(input);
  const ports: IdentifyPorts = {visual: async () => visualFixture.reply};
  const a = await identify(input, ports, memoryStore(), logger().log);
  const b = await identify(input, ports, memoryStore(), logger().log);
  assert.deepEqual(a, b);
  assert.deepEqual(input, before);
  assert.deepEqual(a.stages[0], {name: 'code', state: 'arrived', found: {codes: 0}});
});

test('invalid OCR confidence fails only the tag stage and leaves the model available', async () => {
  const {log, sink} = logger();
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag'}]}, {
    ocr: async () => [{line: 'Carhartt', confidence: 2}], model: async () => modelFixture.reply,
  }, memoryStore(), log);
  assert.equal(out.stages.find(stage => stage.name === 'tag')?.state, 'failed');
  assert.equal(out.stages.find(stage => stage.name === 'model')?.state, 'arrived');
  assert.ok(sink.text().includes('line confidence must be between 0 and 1'));
});

test('a generic tag brand does not turn a catalogue model confirmation into a redundant pick', async () => {
  const {log} = logger();
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line: 'Carhartt', confidence: 1}], codes: [{symbology: 'UPC-A', payload: '012345678905'}]}]}, {
    catalogue: async () => ({brand: 'Carhartt', model: 'B324', family: 'apparel'}),
  }, memoryStore(), log);
  assert.equal(out.action, 'confirm');
  assert.equal(out.set[0]?.product_id, 'brand:carhartt/model:b324');
});
