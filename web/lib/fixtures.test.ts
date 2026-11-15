import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replays, replayTurn, reviewStates } from './fixtures.ts';
import { parseEvent } from './contract.ts';
test('three recordings carry exact events and every resulting turn is labeled', () => {
  assert.equal(Object.keys(replays).length, 3);
  for (const [name, replay] of Object.entries(replays)) {
    assert.match(name, /fixture-prices-counts/);
    for (const event of replay.events) assert.deepEqual(parseEvent(event.event, event.data), event);
    const turn = replayTurn(name);
    assert.equal(turn.recorded, name);
    assert.equal(turn.status, 'answered');
    assert.ok(turn.answer);
  }
});
test('the long answer covers all widgets and the gallery includes every required state', () => {
  const widgets = new Set(replayTurn('words-fixture-prices-counts').answer?.blocks.filter(b => b.type === 'widget').map(b => b.widget));
  assert.equal(widgets.size, 7);
  for (const state of ['empty', 'typing', 'photo_attached', 'running', 'answered', 'thin_data', 'refused', 'rate_limited', 'offline', 'failed', 'long_answer']) assert.ok(reviewStates.some(s => s.name === state), state);
});
