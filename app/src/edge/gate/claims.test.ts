import { test } from 'node:test';
import assert from 'node:assert/strict';
import claims from './fixtures/claims.json' with { type: 'json' };
import { gate } from './gate.ts';

test('20 buyer questions: hold every planted false claim and pass every clean draft', async t => {
  const counts = { planted: 0, held: 0, clean: 0, passed: 0, wrongly_held: 0 };
  assert.equal(claims.drafts.length, 20);
  assert.equal(new Set(claims.drafts.map(d => d.id)).size, 20);
  for (const draft of claims.drafts) {
    await t.test(`${draft.id}: ${draft.question}`, async () => {
      const r = await gate({ subject: draft.id, text: draft.text }, draft.facts, [], text => {
        assert.equal(text, draft.text);
        return draft.claims.map(text => ({ text, kind: 'fact' }));
      });
      if (draft.planted) {
        counts.planted++;
        if (r.verdict === 'hold') counts.held++;
        assert.equal(r.verdict, 'hold', `${draft.item}: false claim escaped`);
        assert.ok(r.claims.some(c => c.state !== 'backed'));
      } else {
        counts.clean++;
        if (r.verdict === 'pass') counts.passed++;
        if (r.verdict === 'hold') counts.wrongly_held++;
        assert.equal(r.verdict, 'pass', `${draft.item}: supported answer was held`);
        assert.ok(r.claims.every(c => c.state === 'backed'));
      }
    });
  }
  t.diagnostic(`Planted false drafts held: ${counts.held}/${counts.planted}; clean drafts passed: ${counts.passed}/${counts.clean}; clean drafts wrongly held: ${counts.wrongly_held}`);
  assert.deepEqual(counts, { planted: 10, held: 10, clean: 10, passed: 10, wrongly_held: 0 });
});
