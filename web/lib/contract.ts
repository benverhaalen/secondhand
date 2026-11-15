import type { Answer, AssistEvent, Block, ToolCallInfo, ToolResult, WebSource, WidgetKind } from './types.ts';
const widgets: WidgetKind[] = ['price_range', 'price_trend', 'sites', 'listings', 'alternatives', 'table', 'sources'];
const tools = ['search_market', 'value_item', 'price_trend', 'where_to_list', 'market_store', 'web_search'];
export const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const numeric = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(v => typeof v === 'string');
const counts = (x: unknown): boolean => record(x) && Object.values(x).every(numeric);
export function isCall(x: unknown): x is ToolCallInfo {
  return record(x) && typeof x.id === 'string' && typeof x.tool === 'string' && tools.includes(x.tool) && typeof x.ok === 'boolean' && counts(x.counts) && numeric(x.ms);
}
function isSource(x: unknown): x is WebSource {
  return record(x) && typeof x.url === 'string' && typeof x.title === 'string' && (x.page_age === undefined || x.page_age === null || typeof x.page_age === 'string');
}
function isBlock(x: unknown): x is Block {
  if (!record(x)) return false;
  return x.type === 'text' ? typeof x.text === 'string' && (x.web_sources === undefined || Array.isArray(x.web_sources) && x.web_sources.every(numeric)) : x.type === 'widget' && widgets.includes(x.widget as WidgetKind) && typeof x.result_id === 'string';
}
function isResult(x: unknown): x is ToolResult {
  return record(x) && typeof x.tool === 'string' && tools.includes(x.tool) && typeof x.ok === 'boolean' && Array.isArray(x.rows) && x.rows.every(row => record(row) && Object.values(row).every(v => v === null || typeof v === 'string' || typeof v === 'boolean' || numeric(v))) && counts(x.counts) && typeof x.as_of === 'string' && strings(x.citation_ids) && typeof x.basis === 'string' && strings(x.not_built) && Array.isArray(x.widgets) && x.widgets.every(v => widgets.includes(v)) && numeric(x.ms);
}
export function isAnswer(x: unknown): x is Answer {
  return record(x) && ['answered', 'refused', 'failed'].includes(String(x.state)) && (x.reason === undefined || typeof x.reason === 'string') && Array.isArray(x.blocks) && x.blocks.every(isBlock) && record(x.results) && Object.values(x.results).every(isResult) && Array.isArray(x.sources) && x.sources.every(isSource) && Array.isArray(x.calls) && x.calls.every(isCall) && record(x.gate) && numeric(x.gate.cut) && numeric(x.gate.checked) && strings(x.gate.cut_sentences) && numeric(x.gate.tags_removed) && typeof x.model === 'string' && ['low', 'medium', 'high'].includes(String(x.effort)) && record(x.ms) && (x.ms.first_text === null || numeric(x.ms.first_text)) && numeric(x.ms.done) && record(x.usage) && ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'web_searches', 'cost_usd'].every(k => numeric(x.usage && record(x.usage) ? x.usage[k] : undefined)) && ['provider', 'price_table'].includes(String(x.usage.cost_source));
}
export function parseEvent(event: string, data: unknown): AssistEvent {
  if (event === 'assist.settled' && isAnswer(data)) return { event, data };
  if (event === 'assist.text' && record(data) && typeof data.delta === 'string') return { event, data: { delta: data.delta } };
  if (event === 'assist.tool' && isCall(data) && record(data) && (data.phase === 'start' || data.phase === 'end')) return { event, data: { ...data, phase: data.phase } };
  throw new Error('Invalid assist event');
}
