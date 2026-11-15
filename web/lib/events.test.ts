import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTurn, reduceEvent, retryTurn } from './events.ts';
import type { Answer, AssistEvent, ToolCallInfo } from './types.ts';

const call: ToolCallInfo = { id: 'r1', tool: 'search_market', input: {}, ok: true, counts: { poshmark: 14 }, ms: 1200 };
export const answer: Answer = { state: 'answered', blocks: [{ type: 'text', text: 'Final answer.' }], results: {}, sources: [], calls: [], gate: { checked: 0, cut: 0, cut_sentences: [], tags_removed: 0 }, model: 'fixture', effort: 'low', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, web_searches: 0, cost_usd: 0, cost_source: 'provider' }, ms: { first_text: 100, done: 1200 } };
test('tool start then end updates one line with the returned counts', () => {
  let turn = newTurn('one', 'Find a jacket');
  turn = reduceEvent(turn, { event: 'assist.tool', data: { ...call, counts: {}, phase: 'start' } });
  assert.equal(turn.tools[0].phase, 'start');
  turn = reduceEvent(turn, { event: 'assist.tool', data: { ...call, phase: 'end' } });
  assert.equal(turn.tools.length, 1);
  assert.equal(turn.tools[0].counts.poshmark, 14);
});
test('text deltas append in order; settlement removes the provisional text', () => {
  let turn = newTurn('one', 'Ask');
  for (const delta of ['First ', 'draft']) turn = reduceEvent(turn, { event: 'assist.text', data: { delta } });
  assert.equal(turn.streamed, 'First draft');
  turn = reduceEvent(turn, { event: 'assist.settled', data: answer });
  assert.equal(turn.streamed, '');
  assert.deepEqual(turn.answer?.blocks, answer.blocks);
  assert.equal(turn.status, 'answered');
});
test('an end before a start stays ended; late events cannot change a settled turn', () => {
  let turn = reduceEvent(newTurn('one', 'Ask'), { event: 'assist.tool', data: { ...call, phase: 'end' } });
  turn = reduceEvent(turn, { event: 'assist.tool', data: { ...call, phase: 'start' } });
  assert.equal(turn.tools[0].phase, 'end');
  turn = reduceEvent(turn, { event: 'assist.settled', data: answer });
  const late: AssistEvent = { event: 'assist.text', data: { delta: 'late' } };
  assert.deepEqual(reduceEvent(turn, late), turn);
});
test('refusal is terminal and preserved instead of becoming answered', () => {
  assert.equal(reduceEvent(newTurn('one', 'Ask'), { event: 'assist.settled', data: { ...answer, state: 'refused' } }).status, 'refused');
});
test('retry clears a terminal failure and its job, but offline retries preserve the running job', () => {
  const failed = { ...newTurn('one', 'Ask'), jobId: 'job_old', status: 'failed' as const, jobFailed: true, answer: { ...answer, state: 'failed' as const } };
  const retry = retryTurn(failed);
  assert.equal(retry.answer, undefined);
  assert.equal(retry.jobId, undefined);
  assert.notEqual(retry.idempotencyKey, failed.idempotencyKey);
  assert.equal(reduceEvent(retry, { event: 'assist.settled', data: answer }).status, 'answered');
  const offline = { ...newTurn('two', 'Ask'), jobId: 'job_running', status: 'offline' as const };
  assert.equal(retryTurn(offline).jobId, 'job_running');
  assert.equal(retryTurn(offline).idempotencyKey, offline.idempotencyKey);
});
test('retry after a transient polling failure follows the existing job with the original key', () => {
  const failed = { ...newTurn('one', 'Ask'), jobId: 'job_running', status: 'failed' as const };
  assert.equal(retryTurn(failed).jobId, failed.jobId);
  assert.equal(retryTurn(failed).idempotencyKey, failed.idempotencyKey);
});
