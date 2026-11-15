import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { diagnosticLog, log } from './log.ts';
import { replays } from './fixtures.ts';
test('recorded flow logs states and counts, masks personal fields and writes a checkable diagnostic trace', () => {
  log.input('buy', 'ask.send', { text: 'PRIVATE_TEST_WORDS', photo_count: 1 });
  for (const event of replays['words-fixture-prices-counts'].events) log.show('buy', { state: event.event, recorded: true, ...(event.event === 'assist.tool' ? { count: Object.values(event.data.counts).reduce((sum, n) => sum + n, 0) } : {}) });
  log.end();
  const trace = diagnosticLog();
  assert.ok(trace.includes('assist.settled'));
  assert.ok(trace.includes('"count":14'));
  assert.ok(!trace.includes('PRIVATE_TEST_WORDS'));
  assert.ok(!trace.includes('data_base64'));
  const directory = new URL('../.next/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  writeFileSync(new URL('web-log-check.jsonl', directory), `${trace}\n`);
});
