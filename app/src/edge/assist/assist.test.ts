import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assist, type CitedAnswer } from './assist.ts';
import { fakeIntel, type Evidence, type Fact } from '../intel/answer.ts';
import type { Llm } from '../intel/jev.ts';

const ev = (url: string, at = '2026-11-10T00:00:00Z'): Evidence => ({ source_url: url, read_at: at, snapshot_ref: null, fingerprint: 'f', extractor_version: '1', rights: { may_share: true } });
const shown = (name: string, value: unknown, urls: string[]): Fact => ({ name, value, guarded: { state: 'shown', basis_count: 5, as_of: '2026-11-10T00:00:00Z', citation_id: 'c' }, sources: urls.map(u => ev(u)) });
const writer = (sentences: { text: string; cites: string[] }[]): Llm => async () => ({ sentences });
const ask = (facts: Fact[], llm: Llm) => assist({ text: 'what is it worth', intel: fakeIntel({ general: facts }), llm });

test('every sentence carries a citation to a source in the answer; an uncited one is removed', async () => {
  const r = await ask([shown('sold_median', 4200, ['https://a.example/1', 'https://b.example/2'])], writer([
    { text: 'It sells near $42.', cites: ['s1', 's2'] },
    { text: 'Everyone loves it.', cites: [] },
    { text: 'Made in 1990.', cites: ['s9'] },
  ]));
  assert.equal(r.status, 'answered');
  assert.deepEqual(r.sentences.map(s => s.text), ['It sells near $42.']);
  assert.deepEqual(r.sentences[0]!.cites, ['s1', 's2']);
  assert.deepEqual(r.sources.map(s => s.id), ['s1', 's2']);
  assert.equal(r.dropped, 2);
});

test('no source: says so and lists what was searched; the writer is never called', async () => {
  let called = false;
  const r = await ask([], async () => { called = true; return {}; });
  assert.equal(r.status, 'no_source');
  assert.equal(called, false);
  assert.equal(r.sentences.length, 0);
  assert.ok(r.searched.length > 0);
});

test('conflicting sources show both values with their sources, unwritten by the model', async () => {
  const r = await ask([shown('price', 4000, ['https://a.example/1']), shown('price', 6000, ['https://b.example/2'])], writer([{ text: 'Price is $50.', cites: ['s1'] }]));
  assert.equal(r.status, 'conflict');
  assert.deepEqual(r.conflicts.map(c => [c.value, c.source.url]), [[4000, 'https://a.example/1'], [6000, 'https://b.example/2']]);
});

test('a writer that fails or returns a bad shape yields no uncited prose', async () => {
  const bad = await ask([shown('x', 1, ['https://a.example/1'])], async () => ({ nope: 1 }));
  assert.equal(bad.sentences.length, 0);
  assert.equal(bad.status, 'no_source');
  const boom = await ask([shown('x', 1, ['https://a.example/1'])], async () => { throw new Error('x'); });
  assert.equal(boom.sentences.length, 0);
});

test('a source that may not be shared is not cited', async () => {
  const f = shown('x', 1, ['https://a.example/1']);
  f.sources[0]!.rights.may_share = false;
  const r: CitedAnswer = await ask([f], writer([{ text: 'X is 1.', cites: ['s1'] }]));
  assert.equal(r.status, 'no_source');
});
