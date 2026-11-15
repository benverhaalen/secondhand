// Copied from app/src/edge/assist/types.ts. Keep the wire contract in sync with that source.
// The buying conversation's shared contract (features/assist/README.md#the-conversation-agent-proposal).
// tools.ts produces ToolResult; converse.ts consumes it, assigns ids r1..rn per turn, and settles an Answer.
// A tool answers with rows, counts, dates and citation ids, never prose. The model computes nothing.

export type ToolName = 'search_market' | 'value_item' | 'price_trend' | 'where_to_list' | 'market_store';
export type WidgetKind = 'price_range' | 'price_trend' | 'sites' | 'listings' | 'alternatives' | 'table' | 'sources';

export interface ToolResult {
  tool: ToolName;
  ok: boolean;
  // Why the tool could not answer: not_connected, not_built, too_few, failed, invalid_input, function_missing.
  reason?: string;
  // Display-ready rows: money as "$1,299" strings beside raw *_cents integers; counts as integers.
  rows: Record<string, string | number | boolean | null>[];
  counts: Record<string, number>;
  as_of: string;
  citation_ids: string[];
  // What the result rests on, in words a person can check: "11 sold on Poshmark and Mercari, 2026-08-02 to 2026-11-14".
  basis: string;
  // What this tool cannot do yet, said plainly, e.g. "answers from live reads only; stored rows (MI2) are not built".
  not_built: string[];
  // The widgets this result can feed.
  widgets: WidgetKind[];
  ms: number;
}

export interface ToolCallInfo { id: string; tool: ToolName | 'web_search'; input: unknown; ok: boolean; reason?: string; counts: Record<string, number>; ms: number }

export interface WebSource { url: string; title: string; page_age?: string | null }

export type Block =
  | { type: 'text'; text: string; web_sources?: number[] }
  | { type: 'widget'; widget: WidgetKind; result_id: string };

export interface Usage { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; web_searches: number; cost_usd: number; cost_source: 'provider' | 'price_table' }

export interface Answer {
  state: 'answered' | 'refused' | 'failed';
  reason?: string;
  blocks: Block[];
  results: Record<string, ToolResult>;
  sources: WebSource[];
  calls: ToolCallInfo[];
  gate: { checked: number; cut: number; cut_sentences: string[]; tags_removed: number };
  model: string;
  effort: 'low' | 'medium' | 'high';
  usage: Usage;
  ms: { first_text: number | null; done: number };
}

export type AssistEvent =
  | { event: 'assist.tool'; data: ToolCallInfo & { phase: 'start' | 'end' } }
  | { event: 'assist.text'; data: { delta: string } }
  | { event: 'assist.settled'; data: Answer };
