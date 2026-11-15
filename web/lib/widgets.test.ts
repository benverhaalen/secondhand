import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widgetRows, safeUrl, priceBand } from './widgets.ts';
import type { ToolResult, WidgetKind } from './types.ts';

test('each widget reads its named result rows, and listings stop at six', () => {
  const kinds: WidgetKind[] = ['price_range', 'price_trend', 'sites', 'listings', 'alternatives', 'table', 'sources'];
  const result: ToolResult = { tool: 'search_market', ok: true, rows: Array.from({ length: 8 }, (_, i) => ({ title: `Item ${i}` })), counts: {}, as_of: '', citation_ids: [], basis: '', not_built: [], widgets: kinds, ms: 0 };
  for (const widget of kinds) {
    assert.equal(widgetRows({ type: 'widget', widget, result_id: 'r1' }, { r1: result }).length, ['listings', 'alternatives'].includes(widget) ? 6 : 8);
  }
});
test('a missing result or incompatible widget returns no rows', () => {
  const block = { type: 'widget', widget: 'sites', result_id: 'missing' } as const;
  assert.deepEqual(widgetRows(block, {}), []);
});
test('outbound links reject scripts, protocol-relative and local addresses', () => {
  for (const url of ['javascript:alert(1)', '//example.com', '/buy', 'data:text/html,test']) assert.equal(safeUrl(url), null);
  assert.equal(safeUrl('https://example.com/item'), 'https://example.com/item');
});
test('price bands use the actual middle position and omit hidden or malformed figures', () => {
  assert.equal(priceBand({ q10_cents: 2000, q50_cents: 3000, q90_cents: 6000 })?.position, 25);
  assert.equal(priceBand({ q10: 2000, q50: 2000, q90: 2000 })?.position, 50);
  assert.equal(priceBand({ q10: 2000, q50: null, q90: 6000 }), null);
  assert.equal(priceBand({ q10: 6000, q50: 3000, q90: 2000 }), null);
});
