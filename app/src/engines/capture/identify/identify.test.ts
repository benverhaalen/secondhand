import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createLog, memorySink } from '../../../../../log/index.js';
import { checkLog } from '../../../../../spec/log.mjs';
import { memoryStore } from '../../param/param.ts';
import { bound } from './ladder.ts';
import { identify, type IdentifyInput, type IdentifyPorts } from './identify.ts';

const root = new URL('../../../../../', import.meta.url);
const json = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const record = json('spec/items/capture-real/2026-11-15.json') as {items: {item: string; manifest: string; photos: {file: string; role: string}[]; state: {capture_id: string; type: string}}[]};
const visualFixture = JSON.parse(readFileSync(new URL('./fixtures/visual.json', import.meta.url), 'utf8')) as {reply: {title: string; rank: number}[]};
const modelFixture = JSON.parse(readFileSync(new URL('./fixtures/model.json', import.meta.url), 'utf8')) as {reply: unknown};
const tagLines = JSON.parse(readFileSync(new URL('./fixtures/tag-lines.json', import.meta.url), 'utf8')) as {items: Record<string, string[]>};
function logger() {
  const sink = memorySink();
  return {sink, log: createLog({src: 'job.identify', build: 'test', seed: 1, sink})};
}
const input: IdentifyInput = {capture_id: 'cap_unknown', family: 'apparel', photos: [{key: 'front', role: 'front'}, {key: 'tag', role: 'tag', text: [{line: 'Size XL MADE IN MEXICO', confidence: 0}]}]};

test('M5: Nike FY23 cannot confirm an invented model through the tag rung', async () => {
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line: 'Nike FY23\nM\nMade in Vietnam', confidence: 0.9}]}]}, {}, memoryStore(), logger().log);
  assert.equal(out.set[0]?.brand, 'Nike');
  assert.ok([...out.set, ...out.others].every(candidate => candidate.model === undefined && !candidate.product_id.includes('/model:')));
  assert.deepEqual(out.facts.filter(fact => fact.field === 'style_code'), []);
});

test('M4: fabric origin cannot reach the confirmed garment facts', async () => {
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line: 'Nike\nFabric made in Italy\nMade in China', confidence: 0.9}]}]}, {}, memoryStore(), logger().log);
  assert.deepEqual(out.facts.filter(fact => fact.field === 'origin').map(fact => fact.value), ['China']);
});

for (const row of record.items) test(`${row.item}: the real tag confirms its brand without visual or model calls`, async () => {
  const {read} = json(row.manifest) as {read: {tag_text: string}};
  assert.equal(tagLines.items[row.item].join(' '), read.tag_text);
  const calls: string[] = [];
  const capture: IdentifyInput = {capture_id: row.state.capture_id, family: row.state.type,
    photos: row.photos.map(photo => ({key: photo.file, role: photo.role, file_ref: photo.file, ...(photo.role === 'tag' ? {text: tagLines.items[row.item].map(line => ({line, confidence: 0}))} : {})}))};
  const {log} = logger();
  const out = await identify(capture, {visual: async () => {calls.push('visual'); return [];}, model: async () => {calls.push('model'); return {};}}, memoryStore(), log);
  assert.equal(out.action, 'confirm');
  assert.equal(out.set[0]?.brand, {'carhartt-pants': 'Carhartt', 'chico-hoodie': 'Russell Athletic', 'marquette-tee': 'Fruit of the Loom'}[row.item]);
  assert.ok(out.set[0].rests_on.some(line => line.includes('on the tag')));
  assert.ok(out.facts.every(fact => fact.confidence === 0 && capture.photos.some(photo => photo.key === fact.ref)));
  const expected = {'carhartt-pants': [null, null], 'chico-hoodie': ['XXL', 'Mexico'], 'marquette-tee': ['XL', 'Honduras']}[row.item];
  assert.ok(expected);
  assert.deepEqual(out.facts.filter(fact => fact.field === 'size_label').map(fact => fact.value), expected[0] ? [expected[0]] : []);
  assert.deepEqual(out.facts.filter(fact => fact.field === 'origin').map(fact => fact.value), expected[1] ? [expected[1]] : []);
  if (row.item === 'carhartt-pants') assert.equal(out.set[0].model, undefined);
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
  assert.ok(Math.abs(nike.c - 0.40145985401459855) < 1e-12);
  assert.deepEqual(nike.rests_on, ['3 of 5 similar listings']);
  assert.equal(sink.lines.filter(line => JSON.parse(line).event === 'user.input').length, 1);
  assert.equal(sink.lines.filter(line => JSON.parse(line).event === 'job.stage').length, 4);
  assert.ok(!sink.text().includes(visualFixture.reply[0].title));
  log.end();
  assert.deepEqual(checkLog(sink.text()).problems, []);
  if (process.env.IDENTIFY_TEST_LOG) writeFileSync(process.env.IDENTIFY_TEST_LOG, sink.text());
});

function untrusted(value: unknown): never { return value as never; }
for (const [cause, bad] of [
  ['null photo', null], ['non-object photo', 42], ['missing role', {key: 'bad'}],
  ['non-string role', {key: 'bad', role: 42}], ['missing key', {role: 'tag'}],
  ['empty key', {key: ' ', role: 'tag'}], ['empty role', {key: 'bad', role: ''}],
  ['non-string file reference', {key: 'bad', role: 'front', file_ref: 42}],
] as const) test(`${cause} is dropped with a reason while valid photos still run in order`, async () => {
  const {log, sink} = logger();
  const calls: string[] = [];
  const photos = [
    {key: 'z', role: 'tag', text: [{line: 'Size M', confidence: 1}]}, bad,
    {key: 'b', role: 'front'}, {key: 'a', role: 'front'},
  ];
  const out = await identify({...input, photos: untrusted(photos)}, {
    barcode: async photo => {calls.push(photo.key); return [];},
    visual: async photo => {assert.equal(photo.key, 'a'); return [];},
  }, memoryStore(), log);
  assert.deepEqual(calls, ['a', 'b', 'z']);
  assert.equal(out.stages.length, 4);
  assert.ok(out.facts.some(fact => fact.field === 'size_label' && fact.value === 'M'));
  const errors = sink.lines.map(line => JSON.parse(line)).filter(row => row.event === 'error');
  assert.equal(errors.length, 1);
  assert.ok(sink.text().includes('photo'));
  log.end();
  assert.deepEqual(checkLog(sink.text()).problems, []);
});
for (const photos of [null, {}, undefined]) test(`non-array photos ${JSON.stringify(photos)} cannot discard the model stage`, async () => {
  const {log, sink} = logger();
  const out = await identify({...input, photos: untrusted(photos)}, {model: async () => ({brand: 'Nike'})}, memoryStore(), log);
  assert.equal(out.stages.length, 4);
  assert.equal(out.others[0]?.brand, 'Nike');
  assert.ok(sink.text().includes('photos must be an array'));
  log.end();
  assert.deepEqual(checkLog(sink.text()).problems, []);
});
test('sparse photos are dropped with a reason without losing populated entries', async () => {
  const {log, sink} = logger();
  const photos: unknown[] = Array(2);
  photos[1] = input.photos[1];
  const out = await identify({...input, photos: untrusted(photos)}, {}, memoryStore(), log);
  assert.ok(out.facts.some(fact => fact.value === 'XL'));
  assert.ok(sink.lines.some(line => JSON.parse(line).event === 'error'));
});
for (const line of ['Nike EU42', 'Nike SS23', 'Nike FW22 Size M'])
  test(`a size or season cannot confirm a model through tag evidence: ${line}`, async () => {
    const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line, confidence: 1}]}]}, {}, memoryStore(), logger().log);
    assert.equal(out.set[0]?.brand, 'Nike');
    assert.equal(out.set[0]?.model, undefined);
  });
const empty: IdentifyInput = {capture_id: 'cap_boundary', family: null, photos: [{key: 'front', role: 'front'}, {key: 'tag', role: 'tag'}]};
const codePhoto = {key: 'front', role: 'front', codes: [{symbology: 'UPC-A', payload: '012345678905'}]};
for (const [cause, text] of [['confidence outside unit interval', [{line: 'x', confidence: 2}]], ['non-string line', [{line: 42, confidence: 1}]], ['non-array text', {}]] as const)
  test(`phone text ${cause} fails tag alone with a logged reason`, async () => {
    const {log, sink} = logger();
    const out = await identify({...empty, photos: [codePhoto, {key: 'tag', role: 'tag', text: untrusted(text)}]}, {
      catalogue: async () => ({brand: 'Carhartt'}), model: async () => ({family: 'apparel'}),
    }, memoryStore(), log);
    assert.equal(out.stages.find(stage => stage.name === 'tag')?.state, 'failed');
    assert.equal(out.stages.find(stage => stage.name === 'code')?.state, 'arrived');
    assert.equal(out.stages.find(stage => stage.name === 'model')?.state, 'arrived');
    assert.equal(out.set[0]?.brand, 'Carhartt');
    assert.ok(sink.lines.some(line => JSON.parse(line).event === 'error'));
  });

for (const [name, bad, stage] of [
  ['visual', [null], 'visual'], ['visual', 'oops', 'visual'], ['visual', {}, 'visual'],
  ['visual', [{title: 'Nike', rank: 1.5}], 'visual'], ['visual', [{title: 'a'.repeat(301), rank: 1}], 'visual'],
  ['barcode', [{symbology: 'QR', payload: 42}], 'code'], ['barcode', {}, 'code'],
  ['ocr', [{line: 42, confidence: 1}], 'tag'], ['ocr', [{line: 'x', confidence: 2}], 'tag'], ['ocr', {}, 'tag'],
  ['catalogue', {brand: 42}, 'code'], ['catalogue', {brand: ''}, 'code'], ['catalogue', {brand: 'x'.repeat(61)}, 'code'],
  ['catalogue', {brand: 'Nike', family: 'spaceship'}, 'code'], ['catalogue', {brand: 'Nike', kind: 42}, 'code'],
  ['model', 'oops', 'model'],
  ['visual', Array(1), 'visual'], ['barcode', Array(1), 'code'], ['ocr', Array(1), 'tag'],
] as const) test(`${name} malformed reply ${Array.isArray(bad) && bad.length && !(0 in bad) ? 'sparse array' : JSON.stringify(bad).slice(0, 60)} fails its own stage`, async () => {
  const {log, sink} = logger();
  const ports: IdentifyPorts = {
    barcode: async () => [], ocr: async () => [], visual: async () => [], model: async () => ({family: 'apparel'}),
    [name]: async () => untrusted(bad),
  };
  const capture = name === 'catalogue' ? {...empty, photos: [codePhoto, empty.photos[1]]} : empty;
  const out = await identify(capture, ports, memoryStore(), log);
  assert.equal(out.stages.find(row => row.name === stage)?.state, 'failed');
  assert.equal(out.stages.length, 4);
  assert.ok(out.stages.filter(row => row.name !== stage).every(row => row.state !== 'failed'));
  assert.ok(sink.lines.some(line => JSON.parse(line).event === 'error'));
});

for (const [name, stage] of [['barcode', 'code'], ['catalogue', 'code'], ['model', 'model']] as const)
  test(`throwing ${name} port cannot discard other stages`, async () => {
    const {log, sink} = logger();
    const out = await identify({...empty, photos: [name === 'catalogue' ? codePhoto : empty.photos[0], {key: 'tag', role: 'tag', text: [{line: 'Size XL', confidence: 1}]}]}, {
      [name]: async () => {throw new Error(`recorded ${name} failure`);}, visual: async () => [{title: 'Nike', rank: 1}],
    }, memoryStore(), log);
    assert.equal(out.stages.find(row => row.name === stage)?.state, 'failed');
    assert.ok(out.facts.some(fact => fact.value === 'XL'));
    assert.equal(out.stages.length, 4);
    assert.ok(sink.text().includes(`recorded ${name} failure`));
  });

test('visual-only brand is returned in others below the set bar with evidence', async () => {
  const out = await identify(empty, {visual: async () => [{title: 'Nike', rank: 1}]}, memoryStore(), logger().log);
  assert.deepEqual(out.set, []);
  assert.equal(out.action, 'ask');
  assert.equal(out.others[0]?.brand, 'Nike');
  assert.equal(out.others[0]?.c, 0.5);
  assert.deepEqual(out.others[0]?.rests_on, ['1 of 1 similar listings']);
});

test('others obeys fitted cap and score order and never duplicates set members', async () => {
  const params = memoryStore();
  const prior = bound(params, 'identity_max_pick');
  const row = params.propose({name: 'identity_max_pick', scope: {}, family: 'scalar', value_or_hyperparams: 2, prior,
    fitted_on_ids_hash: null, n_eff: 40, metric: 'held_out', held_out_score: 1, guard_lo: 1, guard_hi: null}, 0);
  params.promote('identity_max_pick', {}, row.version, 0, '2026-11-15T00:00:00Z');
  const out = await identify(empty, {visual: async () => [{title: 'Nike', rank: 1}, {title: 'Adidas', rank: 2}, {title: 'Carhartt', rank: 3}]}, params, logger().log);
  assert.deepEqual(out.others.map(row => row.brand), ['Nike', 'Adidas']);
  assert.ok(out.others.every(row => row.c < 0.6 && !out.set.some(member => member.product_id === row.product_id)));
});

test('visual stage that never ran is planned with the skip reason', async () => {
  for (const [capture, ports, reason] of [
    [input, {}, 'no visual port'],
    [{...input, photos: [{key: 'tag', role: 'tag', text: [{line: 'Nike', confidence: 1}]}]}, {visual: async () => []}, 'identity set already found'],
    [{...input, photos: []}, {visual: async () => []}, 'no front photo'],
  ] as const) {
    const out = await identify(untrusted(capture), ports, memoryStore(), logger().log);
    assert.deepEqual(out.stages.find(row => row.name === 'visual'), {name: 'visual', state: 'planned', found: {skipped: reason}});
  }
});

test('photo order cannot preserve a redundant brand-only candidate', async () => {
  const photos = [{key: 'a', role: 'tag', text: [{line: 'Carhartt', confidence: 1}]}, {key: 'z', role: 'tag', text: [{line: 'Carhartt B324', confidence: 1}]}];
  const a = await identify({...empty, photos}, {}, memoryStore(), logger().log);
  const b = await identify({...empty, photos: [...photos].reverse()}, {}, memoryStore(), logger().log);
  assert.deepEqual(a, b);
  assert.equal(a.action, 'confirm');
  assert.equal(a.set.length, 1);
  assert.equal(a.set[0].model, 'B324');
});

test('raw barcode payloads never enter input, port or catalogue evidence logs', async () => {
  for (const payload of ['private-example-payload', '00012345678905']) for (const phone of [true, false]) {
    const {log, sink} = logger();
    const codes = [{symbology: 'QR', payload}];
    await identify({...empty, photos: [{key: 'front', role: 'front', ...(phone ? {codes} : {})}]}, {
      barcode: async () => codes, catalogue: async () => ({brand: 'Nike'}),
    }, memoryStore(), log);
    assert.ok(!sink.text().includes(payload));
    assert.ok(sink.text().includes('QR'));
  }
});

test('model strings over eighty characters are dropped while bounded model strings survive', async () => {
  for (const length of [80, 81]) {
    const {log, sink} = logger();
    const out = await identify(empty, {model: async () => ({brand: 'Nike', model: 'x'.repeat(length)})}, memoryStore(), log);
    assert.equal(out.others[0]?.model, length === 80 ? 'x'.repeat(length) : undefined);
    if (length === 81) assert.ok(sink.text().includes('identify model field dropped'));
  }
});

test('family param scope stays a family and kind ids use the qualified table key', async () => {
  const params = memoryStore();
  const scopes: unknown[] = [];
  const read = params.read.bind(params);
  params.read = (name, scope) => {scopes.push(scope); return read(name, scope);};
  await identify({...empty, family: 'apparel', kind: 'pants'}, {visual: async () => [{title: 'Nike', rank: 1}]}, params, logger().log);
  assert.ok(scopes.length > 0);
  assert.ok(scopes.every(scope => JSON.stringify(scope) === JSON.stringify({kind: 'apparel.pants'})));
  scopes.length = 0;
  await identify({...empty, family: 'apparel'}, {visual: async () => [{title: 'Nike', rank: 1}]}, params, logger().log);
  assert.ok(scopes.every(scope => JSON.stringify(scope) === JSON.stringify({kind: 'apparel'})));
});

test('unrelated company cue in care text cannot confirm Apple', async () => {
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line: 'Wash with apple juice. Acme Co.', confidence: 1}]}]}, {}, memoryStore(), logger().log);
  assert.deepEqual(out.set, []);
  assert.deepEqual(out.others, []);
  assert.equal(out.action, 'ask');
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

for (const line of [
  "Fits like Levi's 501\nW32 L32\n100% cotton\nMade in China",
  'Merino wool sourced from Patagonia, Argentina\n100% wool\nMade in Peru\nM',
  'Wool from Patagonia\n100% wool\nMade in Uruguay',
  'Compare to Nike\n100% Polyester\nMade in China\nM',
  'NIKE-INSPIRED TRAINING TEE\nL\n100% polyester', 'Do not use with Sony devices\nL',
  'COLOUR\nAPPLE\nM', 'COLOR:\nAMAZON\nL',
  'Inspired by Nike', 'R unrelated NIKE',
]) test(`R5: a prose or colour brand cannot reach identify candidates: ${line}`, async () => {
  const {log, sink} = logger();
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line, confidence: 1}]}]}, {}, memoryStore(), log);
  assert.equal(out.action, 'ask');
  assert.deepEqual(out.set, []);
  assert.deepEqual(out.others, []);
  log.end();
  assert.deepEqual(checkLog(sink.text()).problems, []);
});
for (const [line, expected] of [['R NIKE', 'Nike'], ['CHAMPION AB1234', 'Champion']])
  test(`R6: leading brand confirms without inventing a model: ${line}`, async () => {
    const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line, confidence: 1}]}]}, {}, memoryStore(), logger().log);
    assert.equal(out.action, 'confirm');
    assert.deepEqual(out.set.map(candidate => candidate.brand), [expected]);
    assert.ok(out.set.every(candidate => candidate.model === undefined));
  });
test('R5: the whole-line maker confirms without offering its licensor', async () => {
  const line = 'Officially Licensed NINTENDO\nGILDAN\nULTRA COTTON\nXL\nMade in Nicaragua';
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line, confidence: 1}]}]}, {}, memoryStore(), logger().log);
  assert.equal(out.action, 'confirm');
  assert.deepEqual(out.set.map(candidate => candidate.brand), ['Gildan']);
  assert.deepEqual(out.others, []);
});
for (const [line, excluded] of [
  ['SKECHERS\n9\nM\nMADE IN VIETNAM', 'size_label'],
  ['ITEM 1234567\nPO 4500123456\nMADE IN CHINA', 'style_code'],
  ['Item: 1068827\nKIRKLAND SIGNATURE\nM\nMade in Vietnam', 'style_code'],
]) test(`R5: a width or inventory number cannot reach identify facts: ${line}`, async () => {
  const out = await identify({...input, photos: [{key: 'tag', role: 'tag', text: [{line, confidence: 1}]}]}, {}, memoryStore(), logger().log);
  assert.deepEqual(out.facts.filter(fact => fact.field === excluded), []);
  assert.ok([...out.set, ...out.others].every(candidate => candidate.model === undefined));
});
