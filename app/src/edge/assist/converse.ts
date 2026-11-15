import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam, Message, MessageCreateParamsBase, MessageParam, Tool, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { Log } from '../../../../log/index.js';
import { sha256Hex } from '../../engines/proof/sha256.ts';
import { gate } from '../gate/gate.ts';
import { SYSTEM } from './prompt.ts';
import { resolveTags, stripTags } from './widgets.ts';
import type { Answer, AssistEvent, ToolCallInfo, ToolName, ToolResult, Usage, WebSource } from './types.ts';

export const PRICE_TABLE = Object.freeze({
  input_per_million: 2, output_per_million: 10, cache_read_per_million: 0.10, web_search: 0.01,
});

export interface StreamClient {
  messages: {
    stream(params: MessageCreateParamsBase, options?: { signal?: AbortSignal }): {
      on(event: 'text', listener: (delta: string) => void): unknown;
      finalMessage(): Promise<Message>;
    };
  };
}

export interface ToolPort {
  defs: Array<{ name: string; description: string; input_schema: Tool.InputSchema; strict: true }>;
  run(name: string, input: unknown, signal: AbortSignal): Promise<ToolResult>;
}

export interface ConverseOptions {
  text: string;
  image?: { media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data_base64: string };
  history?: MessageParam[];
  effort: 'low' | 'medium' | 'high';
  model: string;
  client: StreamClient;
  tools: ToolPort;
  onEvent?(event: AssistEvent): void;
  now(): number;
  log: Log;
  signal: AbortSignal;
  max_rounds?: number;
}

export function clientFromEnv(env: { ANTHROPIC_API_KEY?: string; OPENROUTER_API_KEY?: string }): { client: Anthropic; model: string } | null {
  if (env.ANTHROPIC_API_KEY !== undefined) {
    return { client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), model: 'claude-sonnet-5-5' };
  }
  if (env.OPENROUTER_API_KEY !== undefined) {
    return { client: new Anthropic({ baseURL: 'https://openrouter.ai/api', authToken: env.OPENROUTER_API_KEY, apiKey: null }), model: 'anthropic/claude-sonnet-5.5' };
  }
  return null;
}

function usageOf(message: Message): Usage {
  const usage = message.usage as Message['usage'] & { cost?: number };
  const { input_tokens, output_tokens } = usage;
  const cache_read_input_tokens = usage.cache_read_input_tokens ?? 0;
  const web_searches = usage.server_tool_use?.web_search_requests ?? 0;
  const providerCost = typeof usage.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : undefined;
  return {
    input_tokens, output_tokens, cache_read_input_tokens, web_searches,
    cost_usd: providerCost ?? (
      input_tokens * PRICE_TABLE.input_per_million / 1e6
      + output_tokens * PRICE_TABLE.output_per_million / 1e6
      + cache_read_input_tokens * PRICE_TABLE.cache_read_per_million / 1e6
      + web_searches * PRICE_TABLE.web_search
    ),
    cost_source: providerCost !== undefined ? 'provider' : 'price_table',
  };
}

const TAGS = /\[(?:price_range|price_trend|sites|listings|alternatives|table|sources):[^\]\r\n]*\]/g;
const NUMBERS = /(?<![\w])(?:\$\s*)?-?(?:\d+(?:,\d{3})*(?:\.\d+)?|\.\d+)(?:\s*(?:%|dollars\b))?/gi;

function numberToken(raw: string, standalone = true): string | null {
  const value = Number(raw.replace(/[$,%\s]|dollars/gi, ''));
  if (!Number.isFinite(value)) return null;
  const unit = /\$|dollars/i.test(raw) ? 'usd' : raw.includes('%') ? 'pct' : 'n';
  if (standalone && unit === 'n' && Number.isInteger(value) && value >= 1900 && value <= 2100) return null;
  return `${unit}${String(value).replace('-', 'm').replace('.', 'p')}`;
}

function numbers(text: string): string[] {
  const prose = text.replace(TAGS, '');
  return [...prose.matchAll(NUMBERS)].flatMap(match => {
    const standalone = !/\w/.test(prose[match.index + match[0].length] ?? '');
    const token = numberToken(match[0], standalone);
    return token ? [token] : [];
  });
}

function toolFacts(value: unknown, key = ''): string[] {
  if (typeof value === 'number') {
    const token = numberToken(String(value), false);
    const tokens = token ? [token] : [];
    if (key.endsWith('_cents') && Number.isInteger(value)) tokens.push(...numbers(`${value / 100} dollars`));
    if (/(?:share|probability|p_sale|rate|change)/.test(key) && value >= 0 && value <= 1) {
      tokens.push(...numbers(`${Number((value * 100).toFixed(10))}%`));
    }
    return tokens;
  }
  if (typeof value === 'string') return /\$|%|\bdollars\b/.test(value) ? numbers(value) : [];
  if (Array.isArray(value)) return value.flatMap(entry => toolFacts(entry, key));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([name, entry]) => toolFacts(entry, name));
  return [];
}

type CitedSpan = { start: number; end: number; sources: number[] };

async function checkedDraft(message: Message | undefined, answer: Answer, text: string, log: Log) {
  let draft = '';
  const spans: CitedSpan[] = [];
  const citedFacts: string[] = [];
  for (const block of message?.content ?? []) {
    if (block.type !== 'text') continue;
    const cited = (block.citations ?? []).filter(c => c.type === 'web_search_result_location');
    citedFacts.push(...cited.flatMap(c => numbers(c.cited_text)));
    spans.push({ start: draft.length, end: draft.length + block.text.length,
      sources: cited.flatMap(c => {
        const index = answer.sources.findIndex(source => source.url === c.url);
        return index < 0 ? [] : [index];
      }) });
    draft += block.text;
  }
  const tokens = [...new Set([...toolFacts(answer.results), ...numbers(text), ...citedFacts])];
  const facts = tokens.map((value, index) => ({ attribute_id: `number${index}`, name: 'number', value }));
  let kept = '';
  const keptSpans: CitedSpan[] = [];
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  for (const { segment: sentence, index } of segmenter.segment(draft)) {
    const claims = numbers(sentence).map(text => ({ text, kind: 'number' }));
    if (claims.length) {
      answer.gate.checked++;
      const verdict = await gate({ subject: 'assist', text: claims.map(c => c.text).join(' ') }, facts, [], () => claims, { log });
      if (verdict.verdict !== 'pass') {
        answer.gate.cut++;
        answer.gate.cut_sentences.push(sentence.trim());
        continue;
      }
    }
    const sources = [...new Set(spans.filter(span => span.start < index + sentence.length && span.end > index).flatMap(span => span.sources))];
    keptSpans.push({ start: kept.length, end: kept.length + sentence.length, sources });
    kept += sentence;
  }
  const results = { ...answer.results };
  if (answer.sources.length) results.web = {
    tool: 'market_store', ok: true, rows: answer.sources.map(source => ({ url: source.url, title: source.title })),
    counts: { sources: answer.sources.length }, as_of: '', citation_ids: [], basis: '', not_built: [], widgets: ['sources'], ms: 0,
  };
  const resolved = resolveTags(kept, results);
  answer.gate.tags_removed = resolved.removed;
  let cursor = 0;
  for (const block of resolved.blocks) {
    if (block.type !== 'text') continue;
    const start = kept.indexOf(block.text, cursor), end = start + block.text.length;
    const sources = [...new Set(keptSpans.filter(span => span.start < end && span.end > start).flatMap(span => span.sources))];
    if (sources.length) block.web_sources = sources;
    cursor = end;
  }
  answer.blocks = resolved.blocks;
}

function failedResult(name: ToolName, ms: number): ToolResult {
  return { tool: name, ok: false, reason: 'failed', rows: [], counts: {}, as_of: '', citation_ids: [], basis: '', not_built: [], widgets: [], ms };
}

function logValue(value: unknown, o: ConverseOptions): unknown {
  if (typeof value === 'string') {
    let safe = value;
    if (o.text) {
      const replacement = `[input ${sha256Hex(o.text)}]`;
      safe = safe.split(JSON.stringify(o.text).slice(1, -1)).join(replacement);
      safe = safe.split(o.text).join(replacement);
    }
    if (o.image?.data_base64) safe = safe.split(o.image.data_base64).join('[image]');
    return safe;
  }
  if (Array.isArray(value)) return value.map(entry => logValue(entry, o));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, logValue(entry, o)]));
  return value;
}

function safeError(error: unknown, o: ConverseOptions): Error {
  return new Error(String(logValue(error instanceof Error ? error.message : String(error), o)));
}

type PendingWeb = Map<string, { call: ToolCallInfo; started: number }>;

export async function converse(o: ConverseOptions): Promise<Answer> {
  const started = o.now();
  const answer: Answer = {
    state: 'answered', blocks: [], results: {}, sources: [], calls: [],
    gate: { checked: 0, cut: 0, cut_sentences: [], tags_removed: 0 }, model: o.model, effort: o.effort,
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, web_searches: 0, cost_usd: 0, cost_source: 'price_table' },
    ms: { first_text: null, done: 0 },
  };
  const toolEvent = (call: ToolCallInfo, phase: 'start' | 'end') => o.onEvent?.({ event: 'assist.tool', data: { ...call, phase } });
  let resultId = 0, early = false;
  let final: Message | undefined;
  const pendingWeb: PendingWeb = new Map();
  try {
    o.log.input('buy', 'assist', { length: o.text.length, image_attached: Boolean(o.image), text_hash: sha256Hex(o.text) });
    o.signal.throwIfAborted();
    const content: ContentBlockParam[] = [];
    if (o.image) content.push({ type: 'image', source: { type: 'base64', media_type: o.image.media_type, data: o.image.data_base64 } });
    content.push({ type: 'text', text: o.text });
    const messages: MessageParam[] = [...(o.history ?? []), { role: 'user', content }];
    const maxRounds = o.max_rounds ?? 6;
    if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new Error('max_rounds must be a positive integer');
    for (let round = 0; round < maxRounds; round++) {
      o.signal.throwIfAborted();
      const roundStart = o.now();
      final = await o.log.call('model', o.model, { round: round + 1, effort: o.effort, message_count: messages.length }, async () => {
        try {
          const stream = o.client.messages.stream({
            model: o.model, max_tokens: 16000,
            system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], messages,
            tools: [...o.tools.defs, { type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
            output_config: { effort: o.effort }, thinking: { type: 'adaptive' },
          }, { signal: o.signal });
          let accumulated = '', sent = 0;
          stream.on('text', delta => {
            if (!delta) return;
            if (answer.ms.first_text === null) answer.ms.first_text = o.now() - started;
            accumulated += delta;
            const visible = stripTags(accumulated);
            const next = visible.slice(sent);
            if (next) o.onEvent?.({ event: 'assist.text', data: { delta: next } });
            sent = visible.length;
          });
          return await stream.finalMessage();
        } catch (error) {
          throw safeError(error, o);
        }
      }, message => ({ ms: o.now() - roundStart, tokens_in: message.usage.input_tokens,
        tokens_out: message.usage.output_tokens, ...usageOf(message), stop_reason: message.stop_reason }));
      const usage = usageOf(final);
      for (const key of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'web_searches', 'cost_usd'] as const) answer.usage[key] += usage[key];
      if (usage.cost_source === 'provider') answer.usage.cost_source = 'provider';
      await collectWeb(final, answer, o, toolEvent, pendingWeb, roundStart);
      if (final.stop_reason === 'refusal') {
        answer.state = 'refused';
        answer.reason = final.stop_details?.category ?? 'refusal';
        break;
      }
      if (final.stop_reason !== 'tool_use' && final.stop_reason !== 'pause_turn') {
        if (final.stop_reason === 'max_tokens' || final.stop_reason === 'model_context_window_exceeded') {
          early = true;
          answer.reason = final.stop_reason;
        }
        break;
      }
      messages.push({ role: 'assistant', content: final.content });
      if (round + 1 === maxRounds) {
        early = true;
        answer.reason = 'max_rounds';
        break;
      }
      if (final.stop_reason === 'tool_use') {
        const uses = final.content.filter(block => block.type === 'tool_use');
        if (!uses.length) throw new Error('tool_use stop without tool calls');
        const returned = await Promise.all(uses.map(async (use) => {
          const id = `r${++resultId}`, tool = use.name as ToolName;
          const call: ToolCallInfo = { id, tool, input: use.input, ok: false, counts: {}, ms: 0 };
          answer.calls.push(call);
          toolEvent(call, 'start');
          const toolStart = o.now();
          let result: ToolResult;
          try {
            result = await o.log.call('tool', use.name, logValue(use.input, o), async () => {
              try { return await o.tools.run(use.name, use.input, o.signal); }
              catch (error) { throw safeError(error, o); }
            },
              value => ({ ok: value.ok, reason: value.reason, counts: value.counts, ms: o.now() - toolStart, tokens_in: 0, tokens_out: 0, cost_usd: 0 }));
          } catch (error) {
            o.log.error('assist.tool', safeError(error, o), { tool: use.name, result_id: id });
            result = failedResult(tool, o.now() - toolStart);
          }
          answer.results[id] = result;
          Object.assign(call, { ok: result.ok, counts: result.counts, ms: o.now() - toolStart }, result.reason ? { reason: result.reason } : {});
          toolEvent(call, 'end');
          return { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify({ ...result, id }),
            ...(!result.ok ? { is_error: true } : {}) } satisfies ToolResultBlockParam;
        }));
        o.signal.throwIfAborted();
        messages.push({ role: 'user', content: returned });
      }
    }
    await closeWeb(pendingWeb, answer.reason ?? 'missing_result', o, toolEvent);
    await checkedDraft(final, answer, o.text, o.log);
    if (early) answer.blocks.push({ type: 'text', text: 'The answer stopped early.' });
    o.log.note('assist.gate', { ...answer.gate, cut_sentences: undefined, early_count: early ? 1 : 0 });
  } catch (error) {
    answer.state = 'failed';
    answer.reason = safeError(error, o).message;
    o.log.error('assist.converse', safeError(error, o));
    await closeWeb(pendingWeb, 'failed', o, toolEvent);
  }
  answer.ms.done = o.now() - started;
  o.log.event('state.change', { entity: 'assist', id: 'assist', to: answer.state, reason: answer.reason, ms: answer.ms.done });
  o.onEvent?.({ event: 'assist.settled', data: answer });
  return answer;
}

async function collectWeb(message: Message, answer: Answer, o: ConverseOptions,
  emit: (call: ToolCallInfo, phase: 'start' | 'end') => void, pending: PendingWeb, started: number) {
  for (const block of message.content) {
    if (block.type !== 'server_tool_use' || block.name !== 'web_search') continue;
    const call: ToolCallInfo = { id: block.id, tool: 'web_search', input: block.input, ok: false, counts: {}, ms: 0 };
    answer.calls.push(call);
    emit(call, 'start');
    pending.set(block.id, { call, started });
  }
  for (const result of message.content) {
    if (result.type !== 'web_search_tool_result') continue;
    const running = pending.get(result.tool_use_id);
    if (Array.isArray(result.content)) {
      for (const source of result.content) {
        if (!answer.sources.some(existing => existing.url === source.url)) {
          const entry: WebSource = { url: source.url, title: source.title, page_age: source.page_age };
          answer.sources.push(entry);
        }
      }
    }
    if (!running) continue;
    const { call } = running;
    call.ms = o.now() - running.started;
    if (Array.isArray(result.content)) {
      call.ok = true;
      call.counts = { sources: result.content.length };
    } else call.reason = result.content.error_code;
    await logWeb(call, o, emit);
    pending.delete(result.tool_use_id);
  }
}

async function logWeb(call: ToolCallInfo, o: ConverseOptions, emit: (call: ToolCallInfo, phase: 'start' | 'end') => void) {
  await o.log.call('tool', 'web_search', logValue(call.input, o), () => call,
    value => ({ ok: value.ok, reason: value.reason, counts: value.counts, ms: value.ms, tokens_in: 0, tokens_out: 0, cost_usd: 0 }));
  emit(call, 'end');
}

async function closeWeb(pending: PendingWeb, reason: string, o: ConverseOptions, emit: (call: ToolCallInfo, phase: 'start' | 'end') => void) {
  for (const { call, started } of pending.values()) {
    call.reason = reason;
    call.ms = o.now() - started;
    await logWeb(call, o, emit);
  }
  pending.clear();
}
