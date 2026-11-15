import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTags, stripTags } from './widgets.ts';
import type { ToolResult } from './types.ts';

const result: ToolResult = {
  tool: 'value_item', ok: true, rows: [{ price: '$45' }], counts: { sold: 3 },
  as_of: '2026-11-15', citation_ids: ['c1'], basis: '3 sold on Mercari', not_built: [],
  widgets: ['price_range', 'table'], ms: 4,
};

test('two allowed tags resolve in place with trimmed text and no empty blocks', () => {
  assert.deepEqual(resolveTags('  Range [price_range:r1]\n[table:r1] Done. ', { r1: result }), {
    blocks: [
      { type: 'text', text: 'Range' },
      { type: 'widget', widget: 'price_range', result_id: 'r1' },
      { type: 'widget', widget: 'table', result_id: 'r1' },
      { type: 'text', text: 'Done.' },
    ], removed: 0,
  });
});

test('unknown result r9 and a kind absent from widgets are removed and counted', () => {
  assert.deepEqual(resolveTags('[price_range:r9] [listings:r1]', { r1: result }), { blocks: [], removed: 2 });
});

test('a known widget with a malformed id is removed from both settled text and the stream', () => {
  assert.deepEqual(resolveTags('Range [price_range:missing]', {}), { blocks: [{ type: 'text', text: 'Range' }], removed: 1 });
  assert.equal(stripTags('Range [price_range:miss'), 'Range ');
  assert.equal(stripTags('Range [price_range:missing]'), 'Range ');
});

test('sources:web resolves only with web rows; sources never borrows an engine id', () => {
  const web: ToolResult = { ...result, rows: [{ url: 'https://example.org/report', title: 'Report' }], widgets: ['sources'] };
  assert.deepEqual(resolveTags('[sources:web]', { web }), {
    blocks: [{ type: 'widget', widget: 'sources', result_id: 'web' }], removed: 0,
  });
  assert.equal(resolveTags('[sources:web]', {}).removed, 1);
  assert.equal(resolveTags('[sources:web]', { web: { ...web, rows: [] } }).removed, 1);
  assert.equal(resolveTags('[sources:r1]', { r1: { ...result, widgets: ['sources'] } }).removed, 1);
});

test('stripTags holds a partial [price_ran until it completes on the accumulated stream', () => {
  assert.equal(stripTags('Range [price_ran'), 'Range ');
  assert.equal(stripTags('Range [price_range:r'), 'Range ');
  assert.equal(stripTags('Range [price_range:r1] then [sources:we'), 'Range  then ');
  assert.equal(stripTags('Range [price_range:r1] then [sources:web].'), 'Range  then .');
  assert.equal(stripTags('Read [this note] and [unknown:r2].'), 'Read [this note] and [unknown:r2].');
  assert.equal(stripTags('A ['), 'A ');
  assert.equal(stripTags('A [listings:r9] B'), 'A  B');
});
