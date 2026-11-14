import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readHealth } from './health.ts';

test('a finished statement with a row is a healthy workspace, with its catalog and clock', () => {
  const h = readHealth({ status: { state: 'SUCCEEDED' }, result: { data_array: [['workspace', '2026-11-14T23:59:00.000Z']] } });
  assert.deepEqual(h, { ok: true, state: 'SUCCEEDED', catalog: 'workspace', at: '2026-11-14T23:59:00.000Z' });
});

test('a warehouse still starting, a failed statement and an empty answer are all not ok, and say why', () => {
  assert.deepEqual(readHealth({ status: { state: 'PENDING' } }), { ok: false, state: 'PENDING' });
  assert.deepEqual(readHealth({ status: { state: 'FAILED' } }), { ok: false, state: 'FAILED' });
  assert.deepEqual(readHealth({ status: { state: 'SUCCEEDED' }, result: { data_array: [] } }), { ok: false, state: 'NO_ROWS' });
  assert.deepEqual(readHealth({}), { ok: false, state: 'UNKNOWN' });
});
