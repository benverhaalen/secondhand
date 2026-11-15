import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { reply } from './assist.ts';

const fx = JSON.parse(readFileSync(new URL('../fixtures/assist-follow-up.json', import.meta.url), 'utf8'));

test('words build as they stream, a tool shows from its start to its end, and the settled blocks replace the draft', () => {
  const at = (k: number) => reply(fx.frames.slice(0, k));
  assert.equal(at(2).tools[0].phase, 'start');
  assert.deepEqual(at(3).tools.map(t => [t.tool, t.phase, t.counts.sold]), [['value_item', 'end', 11]]);
  assert.equal(at(5).text, 'Used 501s sold for about the middle of that band.');
  const done = at(7);
  assert.equal(done.state, 'done');
  assert.deepEqual(done.blocks?.map(b => b.type), ['text', 'widget']);
  assert.equal(done.results.r1.basis, '11 sold on Poshmark and Mercari');
});

test('a refused answer and a failed job say so; frames it cannot read are counted, never guessed', () => {
  const refused = reply([{ id: 1, event: 'assist.settled', data: { state: 'refused', reason: 'not about buying', blocks: [] } }]);
  assert.equal(refused.error, 'not about buying');
  const failed = reply([{ id: 1, event: 'job.state', data: { state: 'failed', error: { code: 'site_failed', message: 'the model did not answer' } } }, null, { event: 'assist.text', data: { delta: 4 } }]);
  assert.equal(failed.state, 'failed');
  assert.equal(failed.error, 'the model did not answer');
  assert.equal(failed.skipped, 2);
});
