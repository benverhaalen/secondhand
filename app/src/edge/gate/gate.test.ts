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

const wool = [{ attribute_id: 'material-wool', name: 'material', value: 'wool' }];
const oneClaim = (text: string) => [{ text, kind: 'fact' }];

test('a negated match cannot hide a contradictory material or bypass its decision', async () => {
  const store = memoryStore();
  for (let repeat = 0; repeat < 2; repeat++) {
    const r = await gate({ subject: 'material-reply', text: 'not wool, real cashmere' }, wool, [], oneClaim, { store, user_id: 'u1' });
    assert.equal(r.verdict, 'hold');
    assert.deepEqual(r.claims, [{ text: 'not wool, real cashmere', state: 'contradicted', attribute_id: 'material-wool' }]);
  }
  const decisions = store.decisions({ kind: 'unbacked_claim' });
  assert.equal(decisions.length, 1);
  assert.match(decisions[0].why, /contradicts/i);
  assert.match(decisions[0].why, /material-wool/);
  assert.match(decisions[0].why, /material.*wool/);
});

for (const negator of ['not', 'no', 'never', "isn't", 'isnt', "aren't", 'arent', "wasn't", 'wasnt', 'without', 'non', 'free of']) {
  test(`${negator} within three words of wool is unbacked`, async () => {
    const text = `${negator} really pure wool`;
    const r = await gate({ subject: 'negated', text }, wool, [], oneClaim);
    assert.equal(r.verdict, 'hold');
    assert.equal(r.claims[0].state, 'unbacked');
  });
}

for (const [text, value] of [['non-wool', 'wool'], ['un-lined', 'lined'], ['wool-free', 'wool'], ['ISN’T WOOL', 'wool']]) {
  test(`${text} preserves negation through normalisation`, async () => {
    const r = await gate({ subject: 'hyphen', text }, [{ attribute_id: 'a1', name: 'material', value }], [], oneClaim);
    assert.equal(r.verdict, 'hold');
    assert.equal(r.claims[0].state, 'unbacked');
  });
}

test('negation scope ends at three words', async () => {
  for (const text of ['not actually really pure wool', 'plain wool']) {
    assert.equal((await gate({ subject: 'scope', text }, wool, [], oneClaim)).verdict, 'pass', text);
  }
});

test('punctuation cannot hide a negator inside the three-word window', async () => {
  for (const text of ['not, wool', 'no: wool', 'not (wool)', 'never; wool', 'not however wool']) {
    assert.equal((await gate({ subject: 'punctuation', text }, wool, [], oneClaim)).verdict, 'hold', text);
  }
});

test('a plain value and a negated fact stay backed, but an external negator holds', async () => {
  assert.equal((await gate({ subject: 'plain', text: '100% wool' }, wool, [], oneClaim)).verdict, 'pass');
  const flaws = [{ attribute_id: 'flaws-none', name: 'flaws', value: 'no stains' }];
  assert.equal((await gate({ subject: 'clean', text: 'no stains' }, flaws, [], oneClaim)).verdict, 'pass');
  assert.equal((await gate({ subject: 'double-negative', text: 'not no stains' }, flaws, [], oneClaim)).verdict, 'hold');
  assert.equal((await gate({ subject: 'stained', text: 'no stains' }, [{ attribute_id: 'stain', name: 'flaws', value: 'stains' }], [], oneClaim)).verdict, 'hold');
});

test('a negated fact cannot back a claim that also affirms its opposite', async () => {
  for (const [value, opposite] of [['no stains', 'stains'], ['not authenticated', 'authenticated'], ['non-wool', 'wool'], ['wool-free', 'wool']]) {
    const facts = [{ attribute_id: 'negative-fact', name: 'flaws', value }];
    for (const text of [`${value}; there is ${opposite}`, opposite]) {
      const r = await gate({ subject: 'opposite', text }, facts, [], oneClaim);
      assert.equal(r.verdict, 'hold', text);
      assert.equal(r.claims[0].state, 'contradicted', text);
      assert.equal(r.claims[0].attribute_id, 'negative-fact');
    }
  }
});

test('all occurrences and contradictions are checked before a fact or photo can back the claim', async () => {
  for (const text of ['wool and cashmere', 'wool; not wool', 'cashmere']) {
    const r = await gate({ subject: 'conflict', text }, wool, [{ id: 'p1', shows: [text] }], oneClaim);
    assert.equal(r.verdict, 'hold', text);
  }
  const facts = [...wool, { attribute_id: 'colour', name: 'colour', value: 'grey' }];
  for (const ordered of [facts, [...facts].reverse()]) {
    const r = await gate({ subject: 'conflict', text: 'grey cashmere' }, ordered, [], oneClaim);
    assert.equal(r.claims[0].state, 'contradicted');
    assert.equal(r.claims[0].attribute_id, 'material-wool');
  }
});

test('a photo value cannot back its own negation', async () => {
  const r = await gate({ subject: 'photo-negated', text: 'not wool' }, [], [{ id: 'p1', shows: ['wool'] }], oneClaim);
  assert.equal(r.verdict, 'hold');
});

test('a backed fact cannot hide a claim negating photo evidence', async () => {
  const r = await gate({ subject: 'photo-conflict', text: 'Wool; no stains' }, wool, [{ id: 'p1', shows: ['stains'] }], oneClaim);
  assert.equal(r.verdict, 'hold');
  assert.equal(r.claims[0].state, 'unbacked');
});

test('decimal measurements cannot borrow a matching integer substring', async () => {
  const facts = [{ attribute_id: 'width', name: 'measurements', value: '56' }];
  assert.equal((await gate({ subject: 'decimal', text: '56.5' }, facts, [], oneClaim)).verdict, 'hold');
  assert.equal((await gate({ subject: 'integer', text: '56' }, facts, [], oneClaim)).verdict, 'pass');
  const decimal = [{ attribute_id: 'width', name: 'measurements', value: '56.5' }];
  assert.equal((await gate({ subject: 'word-boundary', text: '56.5cm' }, decimal, [], oneClaim)).verdict, 'hold');
});

test('the documented function vocabulary and an item value both participate in contradictions', async () => {
  const facts = [{ attribute_id: 'function', name: 'function', value: 'not_checked' }];
  const r = await gate({ subject: 'function', text: 'works' }, facts, [], oneClaim);
  assert.deepEqual(r.claims, [{ text: 'works', state: 'contradicted', attribute_id: 'function' }]);
});

test('malformed extractor entries abstain before matching', async () => {
  // Exercise the untyped model boundary without weakening the extractor's TypeScript contract.
  const extractJunk = (): { text: string; kind: string }[] => JSON.parse('[{"text":42,"kind":"fact"}]');
  const r = await gate({ subject: 'junk', text: 'wool' }, wool, [], extractJunk);
  assert.equal(r.verdict, 'abstain');
});
