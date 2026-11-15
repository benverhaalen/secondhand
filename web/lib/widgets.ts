import type { Block, ToolResult } from './types.ts';
export type Row = ToolResult['rows'][number];
export function priceBand(row: Row): { low: number; mid: number; high: number; position: number } | null {
  const low = row.q10_cents ?? row.q10;
  const mid = row.q50_cents ?? row.q50;
  const high = row.q90_cents ?? row.q90;
  if (typeof low !== 'number' || typeof mid !== 'number' || typeof high !== 'number' || ![low, mid, high].every(Number.isFinite) || low < 0 || low > mid || mid > high) return null;
  return { low, mid, high, position: high === low ? 50 : (mid - low) / (high - low) * 100 };
}
export function widgetRows(block: Extract<Block, { type: 'widget' }>, results: Record<string, ToolResult>): Row[] {
  const result = results[block.result_id];
  if (!result || !result.widgets.includes(block.widget)) return [];
  return block.widget === 'listings' || block.widget === 'alternatives' ? result.rows.slice(0, 6) : result.rows;
}
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !URL.canParse(value)) return null;
  const url = new URL(value);
  return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
}
export function money(cents: unknown): string {
  return typeof cents === 'number' && Number.isFinite(cents) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100) : 'Not available';
}
export function number(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value) : 'Not available';
}
export function percent(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(value) : 'Not available';
}
