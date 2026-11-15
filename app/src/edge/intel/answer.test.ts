import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_KINDS, checkAnswer, fakeIntel, type AnswerEvent, type Fact } from './answer.ts';

const ev = { source_url: 'https://example.com/a', read_at: '2026-11-14T00:00:00Z', snapshot_ref: null, fingerprint: 'f1', extractor_version: 'jsonld@1', rights: { may_share: true } };
const sold: Fact = { name: 'sold_range', range: { low: 140, high: 210 }, unit: 'USD', guarded: { state: 'shown', basis_count: 9, as_of: '2026-11-14T00:00:00Z', citation_id: 'ci_1' }, sources: [ev] };

test('the kind list is the canon list of fourteen', () => assert.equal(QUESTION_KINDS.length, 14));

test('fake streams partial then settled, and the settled answer is valid', async () => {
  const seen: AnswerEvent[] = [];
  const a = await fakeIntel({ price_now: [sold] }).ask({ kind: 'price_now', slots: { text: 'wool overcoat' } }, e => seen.push(e));
  assert.deepEqual(seen, ['answer.partial', 'answer.settled']);
  assert.equal(a.stage, 'settled');
  assert.deepEqual(checkAnswer(a), []);
});

test('nothing found is a not_found fact with its searched list, never an error', async () => {
  const a = await fakeIntel({}).ask({ kind: 'retail_price' });
  assert.equal(a.facts[0].guarded.state, 'not_found');
  assert.ok(a.searched.length > 0);
  assert.deepEqual(checkAnswer(a), []);
});

test('checkAnswer names a hidden number without a reason and a shown number without a source', async () => {
  const a = await fakeIntel({ price_now: [sold] }).ask({ kind: 'price_now' });
  a.facts = [{ ...sold, guarded: { ...sold.guarded, state: 'hidden' } }, { ...sold, name: 'ask_range', sources: [] }];
  assert.deepEqual(checkAnswer(a), ['sold_range hidden without hide_reason', 'ask_range shown with no source']);
});
