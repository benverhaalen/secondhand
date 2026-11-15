import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { checkLog } from '../../../../spec/log.mjs';
import { assembleCard, mergeAttribute, type CardRecord, type Attribute } from './card.ts';

const at = '2026-11-15T12:00:00Z';
const sink = memorySink();
const log = createLog({ src: 'test.card', build: 'test', sink });
const attribute = (value: unknown = 'M'): Attribute => ({ name: 'size', value, source: 'label', confirmed: false, confidence: 1, method: 'ocr', at, evidence: [{ kind: 'label_text', ref: 'photo_tag', captured_at: at, extractor_version: 'test' }] });
const record = (id = 'it_1'): CardRecord => ({ item: { id, user_id: 'usr_test', state: 'review', title: 'Shirt', quantity: 1 }, attributes: [attribute()], photos: [{ id: 'ph_1', role: 'front', file_ref: 'volume/front', use: 'real', ai_marked: false }], listings: [] });
const port = (rows: CardRecord[]) => ({ read: async (user: string, id: string) => rows.find(r => r.item.id === id && r.item.user_id === user) });

test('parts: a lot has one card and distinct physical part ids with their own evidence', async () => {
  const group = record('it_group'), part = record('it_part');
  part.item.group_id = group.item.id;
  group.part_ids = [part.item.id];
  const result = await assembleCard('usr_test', group.item.id, port([group, part]), log);
  assert.equal(result.item.id, 'it_group');
  assert.equal(result.parts[0].item.id, 'it_part');
  assert.equal(result.parts[0].attributes[0].evidence[0].ref, 'photo_tag');
});
test('asked: missing real photo requests a missing_shot and marks the site gap', async () => {
  const row = record(); row.photos = [];
  row.listings = [{ id: 'li_1', site: 'depop', state: 'draft', required_fields: ['photo', 'size'] }];
  const card = await assembleCard('usr_test', 'it_1', port([row]), log);
  assert.deepEqual(card.asked, [{ kind: 'missing_shot', item_id: 'it_1', role: 'front' }]);
  assert.deepEqual(card.listings[0].missing_fields, ['photo']);
});
test('a populated field without source evidence is refused', async () => {
  const row = record(); row.attributes[0].evidence = [];
  await assert.rejects(assembleCard('usr_test', 'it_1', port([row]), log), /size.*evidence/);
});
test('a confirmed owner edit remains pinned when a model proposes another value', () => {
  const owner = { ...attribute('L'), source: 'you_said' as const, confirmed: true, evidence: [{ kind: 'owner' as const, ref: 'ev_edit', captured_at: at, extractor_version: 'test' }] };
  assert.deepEqual(mergeAttribute(owner, attribute('M'), 'auto'), owner);
  assert.equal(mergeAttribute(owner, { ...owner, value: 'XL' }, 'user').value, 'XL');
});
test('foreign items and cyclic or duplicate parts are refused', async () => {
  await assert.rejects(assembleCard('usr_other', 'it_1', port([record()]), log), /not_found/);
  const row = record(); row.part_ids = ['it_1'];
  await assert.rejects(assembleCard('usr_test', 'it_1', port([row]), log), /part/);
});

after(() => { assert.deepEqual(checkLog([['card', sink.text()]]).problems, []); });
