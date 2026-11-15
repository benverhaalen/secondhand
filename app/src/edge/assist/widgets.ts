import type { Block, ToolResult, WidgetKind } from './types.ts';

const KINDS = ['price_range', 'price_trend', 'sites', 'listings', 'alternatives', 'table', 'sources'] as const;
const TAG = /\[(price_range|price_trend|sites|listings|alternatives|table|sources):([^\]\r\n]*)\]/g;

export function resolveTags(text: string, results: Record<string, ToolResult>): { blocks: Block[]; removed: number } {
  const blocks: Block[] = [];
  let removed = 0, cursor = 0;
  const addText = (value: string) => {
    if (value.trim()) blocks.push({ type: 'text', text: value.trim() });
  };
  for (const match of text.matchAll(TAG)) {
    addText(text.slice(cursor, match.index));
    const kind = match[1] as WidgetKind, id = match[2];
    // The caller supplies web source rows under web only for tag resolution.
    const allowed = kind === 'sources'
      ? id === 'web' && (results.web?.rows.length ?? 0) > 0
      : /^r\d+$/.test(id) && results[id]?.widgets.includes(kind);
    if (allowed) blocks.push({ type: 'widget', widget: kind, result_id: id });
    else removed++;
    cursor = match.index + match[0].length;
  }
  addText(text.slice(cursor));
  return { blocks, removed };
}

// Pass accumulated text, not isolated chunks, so a partial tag has no shared mutable state.
export function stripTags(delta: string): string {
  let text = delta.replace(TAG, '');
  const start = text.lastIndexOf('[');
  if (start < 0) return text;
  const partial = text.slice(start + 1);
  const pending = KINDS.some(kind => kind.startsWith(partial)
    || (partial.startsWith(`${kind}:`) && !/[\]\r\n]/.test(partial)));
  if (pending) text = text.slice(0, start);
  return text;
}
