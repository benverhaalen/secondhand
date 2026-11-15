import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gate } from './gate.ts';
import { memoryStore } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const facts = [
  { attribute_id: 'a1', name: 'material', value: '100% cotton' },
  { attribute_id: 'a2', name: 'size', value: 'M' },
  { attribute_id: 'a3', name: 'price', value: '$1,200' },
];
const photos = [{ id: 'p1', shows: ['a small stain on the cuff'] }];
// the fake extractor: one claim per sentence
const extract = (t: string) => t.split('.').map(s => s.trim()).filter(Boolean).map(s => ({ text: s, kind: 'fact' }));

test('backed claim passes, tied to its fact', async () => {
  const store = memoryStore();
  const r = await gate({ subject: 'm1', text: 'Made of 100% cotton.' }, facts, photos, extract, { store, user_id: 'u1' });
  assert.equal(r.verdict, 'pass');
  assert.deepEqual(r.claims.map(c => [c.state, c.attribute_id]), [['backed', 'a1']]);
  assert.equal(store.decisions().length, 0);
});

test('claim without evidence holds and raises one unbacked_claim decision', async () => {
  const store = memoryStore();
  const r = await gate({ subject: 'm2', text: 'Made of 100% cotton. Never been washed.' }, facts, photos, extract, { store, user_id: 'u1' });
  assert.equal(r.verdict, 'hold');
  assert.deepEqual(r.claims.map(c => c.state), ['backed', 'unbacked']);
  const d = store.decisions({ kind: 'unbacked_claim' });
  assert.equal(d.length, 1);
  assert.equal(d[0].subject, 'm2');
  assert.deepEqual(d[0].options.map(o => o.id), ['send_without', 'edit', 'confirm_fact']);
  await gate({ subject: 'm2', text: 'Never been washed.' }, facts, photos, extract, { store, user_id: 'u1' });
  assert.equal(store.decisions().length, 1, 'a repeat holds on the same open decision');
});

test('a photo backs a claim by evidence_ref', async () => {
  const r = await gate({ subject: 'm3', text: 'There is a small stain on the cuff.' }, facts, photos, extract);
  assert.deepEqual(r.claims[0], { text: 'There is a small stain on the cuff', state: 'backed', evidence_ref: 'photo:p1' });
});

test('matching is on the normalised value, not a piece of a word', async () => {
  const r = await gate({ subject: 'm4', text: 'Fits like a medium. Comes with a mouse.' }, facts, photos, extract);
  assert.deepEqual(r.claims.map(c => c.state), ['unbacked', 'unbacked']);
  const r2 = await gate({ subject: 'm4', text: 'Price is 1200 firm.' }, facts, photos, extract);
  assert.equal(r2.claims[0].attribute_id, 'a3');
});

test('no claims passes; an extractor that fails abstains, raises nothing and logs why', async () => {
  assert.equal((await gate({ subject: 'm5', text: '' }, facts, photos, () => [])).verdict, 'pass');
  const store = memoryStore(), sink = memorySink(), log = createLog({ src: 't', build: 't', sink });
  const r = await gate({ subject: 'm6', text: 'x' }, facts, photos, () => { throw new Error('model down'); }, { store, user_id: 'u1', log });
  assert.equal(r.verdict, 'abstain');
  assert.equal(store.decisions().length, 0);
  assert.match(sink.text(), /model down/);
});

test('an empty fact value never backs a claim', async () => {
  const r = await gate({ subject: 'm7', text: 'Brand new.' }, [{ attribute_id: 'a9', name: 'x', value: '' }], [], extract);
  assert.equal(r.verdict, 'hold');
});
