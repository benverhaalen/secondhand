import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifier } from './notify.ts';
import { memoryParams } from '../events/ports.ts';
import type { DecisionRow } from '../events/ports.ts';
import { createLog, memorySink } from '../../../../log/index.js';

const d = (id: string, user_id = 'u1'): DecisionRow => ({ id, user_id, kind: 'markdown', subject: id, why: 'w', options: [], state: 'open' });
const log = () => createLog({ src: 't', build: 't', sink: memorySink() });
const setup = (at: string, rows: Record<string, number> = {}) => {
  let t = new Date(at); const sent: { user_id: string; decisions: DecisionRow[] }[] = [];
  const params = memoryParams({ quiet_hours_start: 22, quiet_hours_end: 7 }, rows);
  const n = createNotifier({ params, send: async x => { sent.push(x); }, now: () => t, log: log() });
  return { n, sent, at: (s: string) => { t = new Date(s); } };
};

test('outside quiet hours one decision sends once; the same id again is dropped', async () => {
  const { n, sent } = setup('2026-06-01T12:00:00Z');
  await n.onDecision(d('a')); await n.onDecision(d('a'));
  await n.flush();
  assert.equal(sent.length, 1);
});

test('quiet hours hold, then one batch when they end', async () => {
  const { n, sent, at } = setup('2026-06-01T23:00:00Z');
  await n.onDecision(d('a')); await n.onDecision(d('b')); await n.onDecision(d('a'));
  await n.flush(); assert.equal(sent.length, 0, 'held at 23:00');
  at('2026-06-02T06:59:00Z'); await n.flush(); assert.equal(sent.length, 0, 'still held at 06:59');
  at('2026-06-02T07:00:00Z'); await n.flush();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].decisions.map(x => x.id), ['a', 'b']);
  await n.flush(); assert.equal(sent.length, 1, 'nothing left to send');
});

test('the hours are read from params, not constants', async () => {
  const { n, sent } = setup('2026-06-01T12:00:00Z', { quiet_hours_start: 9, quiet_hours_end: 15 });
  await n.onDecision(d('a'));
  assert.equal(sent.length, 0, 'noon is quiet under 9 to 15');
});

test('hours are the person\'s own timezone', async () => {
  const sent: unknown[] = [];
  const n = createNotifier({ params: memoryParams({ quiet_hours_start: 22, quiet_hours_end: 7 }), send: async x => { sent.push(x); }, now: () => new Date('2026-06-01T12:00:00Z'), log: log(), timezone: () => 'Pacific/Auckland' });
  await n.onDecision(d('a')); // 00:00 in Auckland
  assert.equal(sent.length, 0);
});

test('batches are per person', async () => {
  const { n, sent, at } = setup('2026-06-01T23:00:00Z');
  await n.onDecision(d('a')); await n.onDecision(d('b', 'u2'));
  at('2026-06-02T08:00:00Z'); await n.flush();
  assert.deepEqual(sent.map(s => s.user_id).sort(), ['u1', 'u2']);
});

test('a failed send keeps the batch for the next flush and sends it once', async () => {
  let fail = true; const sent: unknown[] = [];
  const n = createNotifier({ params: memoryParams({ quiet_hours_start: 0, quiet_hours_end: 0 }), send: async x => { if (fail) throw new Error('push down'); sent.push(x); }, now: () => new Date('2026-06-01T12:00:00Z'), log: log() });
  await n.onDecision(d('a')); assert.equal(sent.length, 0);
  fail = false; await n.flush(); await n.flush();
  assert.equal(sent.length, 1);
});

test('a decision that is no longer open is not sent', async () => {
  const { n, sent } = setup('2026-06-01T12:00:00Z');
  await n.onDecision({ ...d('a'), state: 'answered' });
  assert.equal(sent.length, 0);
});
