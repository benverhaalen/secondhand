import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blanksAtStop, factFound, type Source } from './facts.ts';

const ctx = { job_id: 'job_9a', capture_id: 'cap_1' };
const brand = (value: string | null, source: Source) => ({ name: 'brand', value, source });

test('first value gives one frame with the packet shape', () => {
  assert.deepEqual(factFound(undefined, { ...brand('Carhartt', 'label'), photo_id: 'p1' }, ctx), {
    event: 'fact.found', job_id: 'job_9a', capture_id: 'cap_1', attribute: { name: 'brand', value: 'Carhartt', source: 'label', photo_id: 'p1' },
  });
});

test('no value yet gives no frame', () => {
  assert.equal(factFound(undefined, brand(null, 'seen'), ctx), null);
});

test('the same value gives no frame', () => {
  assert.equal(factFound(brand('Carhartt', 'label'), brand('Carhartt', 'label'), ctx), null);
});

test('a changed value gives a frame', () => {
  assert.equal(factFound(brand('Carhartt', 'label'), brand('Dickies', 'label'), ctx)?.attribute.value, 'Dickies');
});

test('the same value from a higher source gives a frame, up the whole ladder', () => {
  const ladder = ['seen', 'label', 'measured', 'asked'] as const;
  for (let i = 1; i < ladder.length; i++)
    assert.equal(factFound(brand('x', ladder[i - 1]), brand('x', ladder[i]), ctx)?.attribute.source, ladder[i]);
});

test('the same value from a lower source gives no frame', () => {
  assert.equal(factFound(brand('x', 'asked'), brand('x', 'seen'), ctx), null);
  assert.equal(factFound(brand('x', 'label'), brand('x', 'seen'), ctx), null);
});

test('blanks come only at stop, only for names never found', () => {
  const blank = (name: string) => ({ event: 'fact.found', job_id: 'job_9a', capture_id: 'cap_1', attribute: { name, value: null, unknown_reason: 'not_visible' } });
  assert.deepEqual(blanksAtStop(['brand', 'size', 'color'], ['brand'], ctx), [blank('size'), blank('color')]);
  assert.deepEqual(blanksAtStop(['brand'], ['brand'], ctx), []);
});

test('a changed value from a lower source gives no frame', () => {
  const ctx = { job_id: 'job_1', capture_id: 'cap_1' };
  assert.equal(factFound({ value: 'M', source: 'label' }, { name: 'size', value: 'L', source: 'seen' }, ctx), null);
  assert.notEqual(factFound({ value: 'M', source: 'label' }, { name: 'size', value: 'L', source: 'asked' }, ctx), null);
});
