import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam, Message, MessageCreateParamsBase, MessageParam, Tool, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { Log } from '../../../../log/index.js';
import { sha256Hex } from '../../engines/proof/sha256.ts';
import { gate } from '../gate/gate.ts';
import type { LateUpdate } from './tools.ts';
import { SYSTEM } from './prompt.ts';
import { resolveTags, stripTags } from './widgets.ts';
import type { Answer, AssistEvent, ToolCallInfo, ToolName, ToolResult, Usage, WebSource } from './types.ts';

const INPUT_PER_MILLION = 2;
export const PRICE_TABLE = Object.freeze({
  input_per_million: INPUT_PER_MILLION, output_per_million: 10, cache_read_per_million: 0.10, web_search: 0.01,
  // Anthropic's 5-minute cache writes cost 1.25 times base input:
  // https://platform.claude.com/docs/en/build-with-claude/prompt-caching#pricing
  cache_creation_per_million: INPUT_PER_MILLION * 1.25,
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
  seed?: ToolResult[];
  late?: { on(fn: (update: LateUpdate) => void): () => void };
  effort: 'low' | 'medium';
  max_cost_usd: number;
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

function missingTokenUsage(usage: Message['usage']): boolean {
  return usage.input_tokens == null || usage.output_tokens == null;
}

function usageOf(message: Message, max_tokens: number): Usage {
  const usage = message.usage as Message['usage'] & { cost?: number };
  const providerCost = typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : 0;
  const input_tokens = usage.input_tokens ?? 0, output_tokens = usage.output_tokens ?? max_tokens;
  const cache_read_input_tokens = usage.cache_read_input_tokens ?? 0;
  const cache_creation_input_tokens = usage.cache_creation_input_tokens ?? 0;
  const web_searches = usage.server_tool_use?.web_search_requests ?? 0;
  const tokenCost = input_tokens * PRICE_TABLE.input_per_million / 1e6
    + output_tokens * PRICE_TABLE.output_per_million / 1e6
    + cache_read_input_tokens * PRICE_TABLE.cache_read_per_million / 1e6
    + cache_creation_input_tokens * PRICE_TABLE.cache_creation_per_million / 1e6
    + web_searches * PRICE_TABLE.web_search;
  return {
    input_tokens, output_tokens, cache_read_input_tokens, web_searches,
    cost_usd: Math.max(providerCost, tokenCost),
    cost_source: providerCost > tokenCost ? 'provider' : 'price_table',
  };
}

const TAGS = /\[(?:price_range|price_trend|sites|listings|alternatives|table|sources):[^\]\r\n]*\]/g;
const ISO_DATE = /\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2})?)?/;
const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const WRITTEN_DATE = new RegExp(`(?:${MONTH}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+${MONTH}\\s+\\d{4})`, 'i');
const CURRENCIES = [
  { words: 'US dollars?|U\\.S\\. dollars?|dollars?|bucks?|USD', symbols: ['$', 'US$'], unit: 'usd', divisor: 1 },
  { words: 'CAD', symbols: ['CA$'], unit: 'cad', divisor: 1 },
  { words: 'AUD', symbols: ['A$', 'AU$'], unit: 'aud', divisor: 1 },
  { words: 'NZD', symbols: ['NZ$'], unit: 'nzd', divisor: 1 },
  { words: 'HKD', symbols: ['HK$'], unit: 'hkd', divisor: 1 },
  { words: 'euros?|EUR', symbols: ['€'], unit: 'eur', divisor: 1 },
  { words: 'pounds?\\s+sterling|sterling|quid|GBP', symbols: ['£'], unit: 'gbp', divisor: 1 },
  { words: 'yen|JPY', symbols: ['¥'], unit: 'jpy', divisor: 1 },
  { words: 'rupees?|Rs\\.?|INR', symbols: ['₹'], unit: 'inr', divisor: 1 },
  { words: 'francs?|CHF', symbols: [], unit: 'chf', divisor: 1 },
  { words: 'CNY', symbols: [], unit: 'cny', divisor: 1 },
  { words: 'MXN', symbols: [], unit: 'mxn', divisor: 1 },
  { words: 'cents?', symbols: ['¢'], unit: 'usd', divisor: 100 },
];
const CURRENCY_WORD = CURRENCIES.map(currency => currency.words).join('|');
const CURRENCY_CUE = new RegExp(`(?<![a-z])[a-z]+\\$|\\p{Sc}|(?<![a-z])(?:${CURRENCY_WORD})(?![a-z])`, 'giu');
const NUMBERS = new RegExp(`${ISO_DATE.source}|${WRITTEN_DATE.source}|-?(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|\\.\\d+)`, 'gi');
const NUMBER_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|half)';
const WORD_FIGURE = new RegExp(`\\b${NUMBER_WORD}(?:[\\s-]+(?:(?:and|a)[\\s-]+)*(?:${NUMBER_WORD}))*[\\s-]+(?:(?:${CURRENCY_WORD})(?![a-z])|percent\\b|per\\s+cent\\b)`, 'gi');
const PERCENT = /^[\s-]*(?:%|percent\b|per\s+cent\b)/i;
const CERTAINTY = /^\s+(?:sure|certain)\b/i;
const DATE_CONTEXT = /\b(?:in|since|by|from|until|of|January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s*$/i;
const UNIT_WORD = /^\s*(?:cm|mm|km|m|inches?|feet|ft|yards?|miles?|grams?|kg|kilograms?|pounds?|lbs?|oz|ounces?|dollars?|USD|percent|per\s+cent|items?|listings?|rows?|comps?|sales?|units?|pieces?|people|buyers?|sellers?|days?|weeks?|months?|years?|hours?|minutes?|seconds?|times?|sizes?|pairs?|colors?|stars?|reviews?|photos?)\b/i;
const SENTENCES = new Intl.Segmenter('en', { granularity: 'sentence' });
export const MAX_TOOL_USES_PER_ROUND = 4;

function sentences(text: string): { segment: string; index: number }[] {
  const masked = text.replace(new RegExp(WRITTEN_DATE, 'gi'), date => date.replace(/\./g, ' '))
    .replace(/\b(?:U\.S\.|Rs\.|no\.)/gi, abbreviation => abbreviation.replace(/\./g, ' '));
  return [...SENTENCES.segment(masked)].map(({ segment, index }) => ({ segment: text.slice(index, index + segment.length), index }));
}

function dateToken(raw: string): string | null {
  if (WRITTEN_DATE.test(raw)) {
    const parts = raw.replace(',', '').split(/\s+/);
    const month = parts.find(part => /^[a-z]/i.test(part))!.slice(0, 3);
    const months = 'January February March April May June July August September October November December'.split(' ');
    const day = parts.find(part => /^\d{1,2}$/.test(part))!;
    raw = `${parts[2]}-${String(months.findIndex(value => value.slice(0, 3).toLowerCase() === month.toLowerCase()) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (raw.length > 10 && !/(?:z|[+-]\d{2}:?\d{2})$/i.test(raw)) raw += 'Z';
  const day = new Date(raw.slice(0, 10)), parsed = new Date(raw);
  if (!Number.isFinite(day.getTime()) || !Number.isFinite(parsed.getTime())
    || day.toISOString().slice(0, 10) !== raw.slice(0, 10)) return null;
  const value = raw.length === 10 ? raw : parsed.toISOString();
  return `date${value.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;
}

function normalizeFigures(text: string): string {
  return text.normalize('NFKC').replace(/\p{Nd}/gu, digit => {
    const point = digit.codePointAt(0)!;
    let first = point;
    while (/\p{Nd}/u.test(String.fromCodePoint(first - 1))) first--;
    return String((point - first) % 10);
  }).replace(/\p{Cf}/gu, '').replace(/[*_`]/g, '')
    .replace(new RegExp(`\\(\\s*(${CURRENCY_WORD})\\s*\\)|\\[\\s*(${CURRENCY_WORD})\\s*\\]`, 'gi'), (_match, paren: string | undefined, bracket: string | undefined) => paren ?? bracket!);
}

function figureToken(unit: string, value: number): string {
  return `${unit}${String(value).replace('-', 'm').replace('.', 'p')}`;
}

function wordValue(raw: string): number {
  const words = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
  const tens = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
  let total = 0, group = 0, lastScale = Infinity;
  const parts = raw.toLowerCase().trim().split(/[\s-]+/);
  for (const [index, word] of parts.entries()) {
    if (word === 'hundred') group = (group || 1) * 100;
    else if (['thousand', 'million', 'billion'].includes(word)) {
      const scale = { thousand: 1e3, million: 1e6, billion: 1e9 }[word]!;
      if (scale >= lastScale) return NaN;
      total += (group || 1) * scale;
      lastScale = scale;
      group = 0;
    } else if (word === 'half') group = parts.slice(0, index).includes('and') ? group + 0.5 : (group || 1) * 0.5;
    else if (word === 'dozen') group = (group || 1) * 12;
    else if (words.includes(word)) group += words.indexOf(word) + 1;
    else if (tens.includes(word)) group += (tens.indexOf(word) + 2) * 10;
  }
  return total + group;
}

type CurrencyCue = { start: number; end: number; unit: string; divisor: number };
type Figure = { start: number; end: number; value: number; unit: string; divisor: number; scale: number; explained: boolean };

function currencyCues(text: string): CurrencyCue[] {
  const cues = [...text.matchAll(CURRENCY_CUE)].map(match => {
    const currency = CURRENCIES.find(entry => entry.symbols.some(symbol => symbol.toLowerCase() === match[0].toLowerCase())
      || new RegExp(`^(?:${entry.words})$`, 'i').test(match[0]));
    return { start: match.index, end: match.index + match[0].length,
      unit: currency?.unit ?? 'money_unknown', divisor: currency?.divisor ?? 1 };
  });
  if (/£|\b(?:GBP|sterling)\b/i.test(text)) {
    for (const match of text.matchAll(/\bpounds?\b/gi)) {
      if (!cues.some(cue => match.index >= cue.start && match.index < cue.end)) {
        cues.push({ start: match.index, end: match.index + match[0].length, unit: 'gbp', divisor: 1 });
      }
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

function sentenceFigures(text: string): string[] {
  const cues = currencyCues(text);
  const tokens: string[] = [];
  const figures: Figure[] = [];
  const matches = [...text.matchAll(NUMBERS), ...text.matchAll(WORD_FIGURE)].sort((a, b) => a.index - b.index);
  for (const match of matches) {
    const raw = match[0], start = match.index, end = start + raw.length;
    if (ISO_DATE.test(raw) || WRITTEN_DATE.test(raw)) {
      tokens.push(dateToken(raw) ?? 'dateinvalid');
      continue;
    }
    const isWord = /^[a-z]/i.test(raw);
    const numericEnd = isWord ? start + raw.search(new RegExp(`(?:${CURRENCY_WORD}|percent|per\\s+cent)(?![a-z])`, 'i')) : end;
    const before = text.slice(0, start), after = text.slice(numericEnd);
    const value = isWord ? wordValue(text.slice(start, numericEnd)) : Number(raw.replace(/,/g, ''));
    const percent = after.match(PERCENT);
    if (value === 100 && percent && CERTAINTY.test(after.slice(percent[0].length))) continue;
    const multiplier = after.match(/^\s*(bn|[kKmM])(?![a-z])/i);
    const joined = cues.filter(cue => cue.end <= start ? /^[\s-]*$/.test(text.slice(cue.end, start))
      : cue.start >= numericEnd + (multiplier?.[0].length ?? 0)
        && /^[\s-]*$/.test(text.slice(numericEnd + (multiplier?.[0].length ?? 0), cue.start)));
    if (/^\d{4}$/.test(raw) && DATE_CONTEXT.test(before) && !/\w/.test(after[0] ?? '')
      && !UNIT_WORD.test(after) && joined.length === 0
      && !/^\s*(?:[-–—/]|to\b|and\b|or\b|up\s+to\b)/i.test(after)) continue;
    const gluedMultiplier = multiplier && !/^\s/.test(multiplier[0]);
    const figure: Figure = { start, end: numericEnd, value, unit: percent ? 'pct' : 'n', divisor: 1, scale: 1,
      explained: (!gluedMultiplier && UNIT_WORD.test(after)) || /(?:\b(?:size|no\.|model|style|lot|item)\s*|#\s*)$/i.test(before)
        || /[\p{L}](?:-)?$/u.test(before) || (!gluedMultiplier && /^[\p{L}]/u.test(after)) };
    // A hyphen inside an identifier or a range is not a negative sign.
    if (raw.startsWith('-') && start > 0 && !/[\s([{]/.test(text[start - 1])) {
      figure.value = Math.abs(value);
      figure.start++;
    }
    if (!percent) {
      const cue = joined[0];
      if (cue) {
        figure.unit = joined.every(other => other.unit === cue.unit && other.divisor === cue.divisor) ? cue.unit : 'money_unknown';
        figure.divisor = cue.divisor;
        figure.start = Math.min(start, cue.start);
        figure.end = Math.max(numericEnd, cue.end);
        if (cue.end <= start && /(?:^|[\s([{])-$/.test(text.slice(0, cue.start))) figure.value = -Math.abs(figure.value);
      }
    } else figure.end += percent[0].length;
    if (multiplier) {
      figure.scale = /^bn$/i.test(multiplier[1]) ? 1e9 : /^k$/i.test(multiplier[1]) ? 1e3 : 1e6;
      figure.end = Math.max(figure.end, numericEnd + multiplier[0].length);
    }
    if (!Number.isFinite(value)) figure.unit = 'money_unknown';
    figures.push(figure);
  }
  // Ranges inherit units in both directions, before the conservative sentence fallback.
  for (let pass = 0; pass < figures.length; pass++) {
    for (let i = 1; i < figures.length; i++) {
      const left = figures[i - 1], right = figures[i];
      if (!/^\s*(?:[-–—/]|to|and|or|up\s+to)\s*$/i.test(text.slice(left.end, right.start))) continue;
      for (const [source, target] of [[left, right], [right, left]]) {
        if (source.unit !== 'n' && source.unit !== 'pct' && target.unit === 'n' && !target.explained) {
          target.unit = source.unit;
          target.divisor = source.divisor;
        }
      }
    }
  }
  const contextUnit = new Set(cues.map(cue => cue.unit)).size === 1 ? cues[0]?.unit : 'money_unknown';
  for (const figure of figures) {
    if (figure.unit === 'n' && cues.length && !figure.explained) figure.unit = contextUnit!;
    const money = figure.unit !== 'n' && figure.unit !== 'pct';
    tokens.push(figureToken(figure.unit, figure.value * (money ? figure.scale / figure.divisor : 1)));
  }
  return tokens;
}

function numbers(text: string): string[] {
  return sentences(normalizeFigures(text.replace(TAGS, ''))).flatMap(({ segment }) => sentenceFigures(segment));
}

function figureFacts(value: unknown, key: string): string[] {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (key.endsWith('_cents') && Number.isInteger(value)) return numbers(`${value / 100} dollars`);
    const tokens = numbers(String(value));
    if (/(?:share|probability|p_sale|rate|change)/.test(key) && Math.abs(value) <= 1) {
      tokens.push(...numbers(`${Number((Math.abs(value) * 100).toFixed(10))}%`));
    }
    return tokens;
  }
  if (typeof value === 'string' && !URL.canParse(normalizeFigures(value))) return numbers(value);
  return [];
}

const RESULT_METADATA = new Set(['tool', 'ok', 'reason', 'rows', 'counts', 'as_of', 'citation_ids', 'basis', 'not_built', 'widgets', 'ms']);
const DATE_FIELDS = new Set(['as_of', 'sold_at', 'listed_at', 'read_at']);

function toolFacts(results: Answer['results']): string[] {
  return Object.values(results).flatMap(result => {
    if (!result.ok) return [];
    const cited = result.citation_ids.length > 0;
    const tokens = Object.entries(result.counts).filter(([key]) => !/(?:id|url|href|link|image|src)$/i.test(key))
      .flatMap(([, value]) => numbers(String(value)));
    const fields = [...result.rows.flatMap(row => Object.entries(row)),
      ...Object.entries(result).filter(([key]) => !RESULT_METADATA.has(key) || key === 'as_of')];
    for (const [key, value] of fields) {
      if (key === 'input' || key === 'inputs' || /(?:id|url|href|link|image|src)$/i.test(key)) continue;
      if (DATE_FIELDS.has(key) && typeof value === 'string' && ISO_DATE.test(normalizeFigures(value))) {
        const date = normalizeFigures(value).match(ISO_DATE)![0];
        const token = dateToken(date);
        if (token) tokens.push(token, dateToken(date.slice(0, 10))!);
      } else {
        tokens.push(...figureFacts(value, key).filter(token => !token.startsWith('date')
          && !token.startsWith('money_unknown') && (cited || token.startsWith('n'))));
      }
    }
    return tokens;
  });
}

type CitedSpan = { start: number; end: number; sources: number[] };

async function checkedDraft(message: Message | undefined, answer: Answer, text: string, log: Log, now: number, preview = false) {
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
  const tokens = [...new Set([...toolFacts(answer.results),
    ...numbers(text).filter(token => token.startsWith('n') || (token.startsWith('date') && token !== 'dateinvalid')),
    ...citedFacts.filter(token => !token.startsWith('date') && !token.startsWith('money_unknown')),
    // shortcut: no person time zone; upgrade when the request carries one.
    ...[now, now - 12 * 60 * 60 * 1000].map(time => dateToken(new Date(time).toISOString().slice(0, 10))!)])];
  const facts = tokens.map((value, index) => ({ attribute_id: `number${index}`, name: 'number', value }));
  let kept = '';
  let numberWords = false;
  const keptSpans: CitedSpan[] = [];
  for (const { segment: sentence, index } of sentences(draft)) {
    const claims = numbers(sentence).map(text => ({ text, kind: 'number' }));
    const wordFigure = [...normalizeFigures(sentence.replace(TAGS, '')).matchAll(WORD_FIGURE)].length > 0;
    if (claims.length) {
      answer.gate.checked++;
      const verdict = await gate({ subject: 'assist', text: claims.map(c => c.text).join(' ') }, facts, [], () => claims, { log });
      if (verdict.verdict !== 'pass') {
        numberWords ||= wordFigure;
        answer.gate.cut++;
        answer.gate.cut_sentences.push(sentence.trim());
        continue;
      }
    }
    const sources = [...new Set(spans.filter(span => span.start < index + sentence.length && span.end > index).flatMap(span => span.sources))];
    keptSpans.push({ start: kept.length, end: kept.length + sentence.length, sources });
    kept += sentence;
  }
  if (numberWords && !preview) log.note('assist.gate', { reason: 'number_words' });
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
  return kept;
}

function failedResult(name: ToolName, ms: number, reason = 'failed'): ToolResult {
  return { tool: name, ok: false, reason, rows: [], counts: {}, as_of: '', citation_ids: [], basis: '', not_built: [], widgets: [], ms };
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

function publicCall({ input: _input, ...call }: ToolCallInfo): Omit<ToolCallInfo, 'input'> {
  return call;
}

type PendingWeb = Map<string, { call: ToolCallInfo; started: number }>;

export async function converse(o: ConverseOptions): Promise<Answer> {
  if (o.effort !== 'low' && o.effort !== 'medium') throw new Error('effort must be low or medium');
  if (!Number.isFinite(o.max_cost_usd) || o.max_cost_usd <= 0) throw new Error('max_cost_usd must be finite and positive');
  const started = o.now();
  const answer: Answer = {
    state: 'answered', blocks: [], results: {}, sources: [], calls: [],
    gate: { checked: 0, cut: 0, cut_sentences: [], tags_removed: 0 }, model: o.model, effort: o.effort,
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, web_searches: 0, cost_usd: 0, cost_source: 'price_table' },
    ms: { first_text: null, done: 0 },
  };
  const toolEvent = (call: ToolCallInfo, phase: 'start' | 'end') => o.onEvent?.({ event: 'assist.tool', data: { ...publicCall(call), phase } });
  let resultId = 0, early = false;
  const pendingWeb: PendingWeb = new Map();
  const queued: LateUpdate[] = [];
  let settled = false;
  const offLate = o.late?.on(update => {
    if (settled) o.log.note('assist.late.after_settle', { site: update.site });
    else queued.push(update);
  });
  const renderResult = (result: ToolResult, id: string) => JSON.stringify({ ...result, id });
  const addResult = (result: ToolResult) => {
    const id = `r${++resultId}`;
    answer.results[id] = result;
    return { id, rendered: renderResult(result, id) };
  };
  const drainLate = () => queued.splice(0).map(update => {
    const result: ToolResult = { tool: 'search_market', ok: true, rows: update.rows,
      counts: { rows: update.rows.filter(row => row.kind !== 'site_summary').length, sites_pending: update.sites_pending.length },
      citation_ids: update.rows.map(row => String(row.citation_id ?? row.id)),
      as_of: new Date(o.now()).toISOString(), basis: 'search job rows', not_built: [], widgets: ['listings'], ms: 0 };
    const { id, rendered } = addResult(result);
    return { type: 'text' as const, text: `late result ${id}: ${update.site}
${rendered}` };
  });
  try {
    o.log.input('buy', 'assist', { length: o.text.length, image_attached: Boolean(o.image), text_hash: sha256Hex(o.text) });
    o.signal.throwIfAborted();
    const content: ContentBlockParam[] = [];
    if (o.image) content.push({ type: 'image', source: { type: 'base64', media_type: o.image.media_type, data: o.image.data_base64 } });
    content.push({ type: 'text', text: o.text });
    for (const result of o.seed ?? []) {
      const { id, rendered } = addResult(result);
      content.push({ type: 'text', text: `seed result ${id}:
${rendered}` });
    }
    const messages: MessageParam[] = [...(o.history ?? []), { role: 'user', content }];
    const maxRounds = o.max_rounds ?? 6;
    if (!Number.isInteger(maxRounds) || maxRounds < 1) throw new Error('max_rounds must be a positive integer');
    for (let round = 0; round < maxRounds; round++) {
      o.signal.throwIfAborted();
      if (!(answer.usage.cost_usd < o.max_cost_usd)) {
        early = true;
        answer.reason = 'cost_cap';
        break;
      }
      const lateNotes = drainLate();
      if (lateNotes.length) messages.push({ role: 'user', content: lateNotes });
      const roundStart = o.now();
      const max_tokens = Math.max(1024, Math.min(16000,
        Math.floor((o.max_cost_usd * 1e6 - answer.usage.cost_usd * 1e6) / PRICE_TABLE.output_per_million)));
      const final = await o.log.call('model', o.model, { round: round + 1, effort: o.effort, message_count: messages.length }, async () => {
        try {
          const stream = o.client.messages.stream({
            model: o.model, max_tokens,
            system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], messages,
            tools: [...o.tools.defs, { type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
            output_config: { effort: o.effort }, thinking: { type: 'adaptive' },
          }, { signal: o.signal });
          // Hold the round until its text and web citations are complete, then gate whole sentences.
          let accumulated = '';
          stream.on('text', delta => { accumulated += delta; });
          const message = await stream.finalMessage();
          const streamed: Message = { ...message, content: [{ type: 'text', text: accumulated || message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join(''), citations:
            message.content.flatMap(block => block.type === 'text' ? block.citations ?? [] : []) }] };
          const preview: Answer = { ...answer, blocks: [], gate: { checked: 0, cut: 0, cut_sentences: [], tags_removed: 0 } };
          const visible = stripTags(await checkedDraft(streamed, preview, o.text, o.log, o.now(), true));
          for (const { segment } of sentences(visible)) {
            if (answer.ms.first_text === null) answer.ms.first_text = o.now() - started;
            o.onEvent?.({ event: 'assist.text', data: { delta: stripTags(segment) } });
          }
          return message;
        } catch (error) {
          throw safeError(error, o);
        }
      }, message => {
        const usage = usageOf(message, max_tokens);
        return { ms: o.now() - roundStart, ...usage, tokens_in: usage.input_tokens,
          tokens_out: usage.output_tokens, stop_reason: message.stop_reason };
      });
      const usage = usageOf(final, max_tokens);
      if (missingTokenUsage(final.usage)) {
        o.log.note('assist.usage', { reason: 'missing_token_usage', round: round + 1, tokens_in: usage.input_tokens, tokens_out: usage.output_tokens });
      }
      for (const key of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'web_searches', 'cost_usd'] as const) answer.usage[key] += usage[key];
      if (usage.cost_source === 'provider') answer.usage.cost_source = 'provider';
      await collectWeb(final, answer, o, toolEvent, pendingWeb, roundStart);
      await checkedDraft(final, answer, o.text, o.log, o.now());
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
        if (!early && queued.length) {
          if (round + 1 === maxRounds) { early = true; answer.reason = 'max_rounds'; break; }
          messages.push({ role: 'assistant', content: final.content });
          continue;
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
        const returned = await Promise.all(uses.map(async (use, index) => {
          const id = `r${++resultId}`, tool = use.name as ToolName;
          const call: ToolCallInfo = { id, tool, input: use.input, ok: false, counts: {}, ms: 0 };
          answer.calls.push(call);
          toolEvent(call, 'start');
          const toolStart = o.now();
          let result: ToolResult;
          try {
            if (index >= MAX_TOOL_USES_PER_ROUND) {
              result = failedResult(tool, 0, 'too_many_calls');
              o.log.note('assist.tool limit', { tool, result_id: id, reason: result.reason });
            } else result = await o.log.call('tool', use.name, logValue(use.input, o), async () => {
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
          return { type: 'tool_result', tool_use_id: use.id, content: renderResult(result, id),
            ...(!result.ok ? { is_error: true } : {}) } satisfies ToolResultBlockParam;
        }));
        o.signal.throwIfAborted();
        messages.push({ role: 'user', content: returned });
      }
    }
    await closeWeb(pendingWeb, answer.reason ?? 'missing_result', o, toolEvent);
    if (early) answer.blocks.push({ type: 'text', text: 'The answer stopped early.' });
    o.log.note('assist.gate', { ...answer.gate, cut_sentences: undefined, early_count: early ? 1 : 0 });
  } catch (error) {
    answer.state = 'failed';
    answer.reason = 'failed';
    o.log.error('assist.converse', safeError(error, o));
    await closeWeb(pendingWeb, 'failed', o, toolEvent);
  }
  settled = true;
  offLate?.();
  answer.ms.done = o.now() - started;
  o.log.event('state.change', { entity: 'assist', id: 'assist', to: answer.state, reason: answer.reason, ms: answer.ms.done });
  o.onEvent?.({ event: 'assist.settled', data: { ...answer, gate: { ...answer.gate, cut_sentences: [] }, calls: answer.calls.map(publicCall) } });
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
