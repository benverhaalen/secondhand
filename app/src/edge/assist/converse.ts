import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam, Message, MessageCreateParamsBase, MessageParam, Tool, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { Log } from '../../../../log/index.js';
import { sha256Hex } from '../../engines/proof/sha256.ts';
import { gate } from '../gate/gate.ts';
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
const WRITTEN_DATE = new RegExp(`(?:${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\s+\\d{4})`, 'i');
const SENTENCES = new Intl.Segmenter('en', { granularity: 'sentence' });
export const MAX_TOOL_USES_PER_ROUND = 4;

type Sentence = { segment: string; index: number; header?: string };

function sentences(text: string): Sentence[] {
  const lines = [...text.matchAll(/[^\n]*\n|[^\n]+$/g)];
  const units: Sentence[] = [];
  let header: string | undefined, paragraph = '', paragraphIndex = 0;
  const flush = () => {
    const masked = paragraph.replace(new RegExp(WRITTEN_DATE, 'gi'), date => date.replace(/\./g, ' '))
      .replace(/\b(?:U\.S\.|Rs\.|no\.)/gi, abbreviation => abbreviation.replace(/\./g, ' '));
    for (const { segment, index } of SENTENCES.segment(masked)) {
      units.push({ segment: paragraph.slice(index, index + segment.length), index: paragraphIndex + index });
    }
    paragraph = '';
  };
  for (const [i, line] of lines.entries()) {
    const normalized = normalizeFigures(line[0]).trim();
    const divider = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(normalized);
    const tableHeader = normalized.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1]?.[0] ?? '');
    const isHeader = /:$/.test(normalized) || /^#{1,6}\s/.test(normalized) || tableHeader;
    const isRow = /^\s*(?:[-+*]|\d+[.)])\s/.test(line[0]) || normalized.includes('|');
    if (isHeader || isRow || divider) {
      flush();
      units.push({ segment: line[0], index: line.index, ...(!isHeader && !divider ? { header } : {}) });
      if (isHeader) header = line[0];
    } else {
      if (!paragraph) paragraphIndex = line.index;
      paragraph += line[0];
    }
  }
  flush();
  return units;
}

function normalizeFigures(text: string): string {
  return text.normalize('NFKC').replace(/\p{Nd}/gu, digit => {
    const point = digit.codePointAt(0)!;
    let first = point;
    while (/\p{Nd}/u.test(String.fromCodePoint(first - 1))) first--;
    return String((point - first) % 10);
  }).replace(/\p{Cf}/gu, '').replace(/[\p{Pd}\u2212]/gu, '-').replace(/[*_`]/g, '');
}

const SMALL = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const SCALES: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
const ORDINALS: Record<string, string> = {
  zeroth: 'zero', first: 'one', second: 'two', third: 'three', fourth: 'four', fifth: 'five', sixth: 'six', seventh: 'seven',
  eighth: 'eight', ninth: 'nine', tenth: 'ten', eleventh: 'eleven', twelfth: 'twelve', thirteenth: 'thirteen', fourteenth: 'fourteen',
  fifteenth: 'fifteen', sixteenth: 'sixteen', seventeenth: 'seventeen', eighteenth: 'eighteen', nineteenth: 'nineteen',
  twentieth: 'twenty', thirtieth: 'thirty', fortieth: 'forty', fiftieth: 'fifty', sixtieth: 'sixty', seventieth: 'seventy',
  eightieth: 'eighty', ninetieth: 'ninety', hundredth: 'hundred', thousandth: 'thousand', millionth: 'million', billionth: 'billion',
};
const NUMBER_WORD = [...SMALL, ...TENS, ...Object.keys(SCALES), ...Object.keys(ORDINALS), 'dozen', 'couple', 'half', 'quarter'].join('|');
const WORD_INTEGER = `(?:a[n]?[\\s-]+)?(?:${NUMBER_WORD})(?:[\\s-]+(?:(?:and|a|an)[\\s-]+)*(?:${NUMBER_WORD}))*`;
const WORD_DIGITS = `(?:${SMALL.slice(0, 10).join('|')})(?:[\\s-]+(?:${SMALL.slice(0, 10).join('|')}))*`;
const WORD_DECIMAL = `(?:${WORD_INTEGER}[\\s-]+)?point[\\s-]+${WORD_DIGITS}`;
const WORD_FIGURE = new RegExp(`\\b(?:(?:minus|negative)[\\s-]+)?(?:${WORD_DECIMAL}|${WORD_INTEGER})\\b`, 'gi');
const NUMERAL = '-?(?:\\d{1,3}(?:[, ]\\d{3})+(?:\\.\\d+)?(?!\\d)|\\d+(?:\\.\\d+)?|\\.\\d+)(?:(?:bn|[km])(?![a-z])|st|nd|rd|th)?';
const NUMERALS = new RegExp(`${ISO_DATE.source}|${WRITTEN_DATE.source}|${NUMERAL}`, 'gi');
type Figure = { value: number; ordinal: boolean; title?: string };

function wordValue(raw: string): number {
  const sign = raw.match(/^(?:minus|negative)[\s-]+/i);
  if (sign) return -wordValue(raw.slice(sign[0].length));
  const decimal = raw.toLowerCase().split(/(?:^|[\s-]+)point[\s-]+/);
  if (decimal.length === 2) {
    const fraction = decimal[1].split(/[\s-]+/).map(word => SMALL.indexOf(word)).join('');
    return wordValue(decimal[0]) + Number(`0.${fraction}`);
  }
  let total = 0, group = 0, lastScale = Infinity;
  const parts = raw.toLowerCase().trim().split(/[\s-]+/).map(word => ORDINALS[word] ?? word);
  for (const [index, word] of parts.entries()) {
    if (word === 'hundred') group = (group || 1) * 100;
    else if (word in SCALES) {
      const scale = SCALES[word];
      if (scale >= lastScale) return NaN;
      total += (group || 1) * scale;
      lastScale = scale;
      group = 0;
    } else if (word === 'half' || word === 'quarter') {
      const fraction = word === 'half' ? 0.5 : 0.25;
      group = parts.slice(0, index).includes('and') ? group + fraction : (group || 1) * fraction;
    } else if (word === 'dozen') group = (group || 1) * 12;
    else if (word === 'couple') group += 2;
    else if (SMALL.includes(word)) group += SMALL.indexOf(word);
    else if (TENS.includes(word)) group += (TENS.indexOf(word) + 2) * 10;
  }
  return total + group;
}

function checkingText(raw: string): string {
  return normalizeFigures(raw.replace(TAGS, '')).replace(/\[r\d+\]/gi, '');
}

function numbers(raw: string): Figure[] {
  const text = checkingText(raw);
  const figures: Figure[] = [];
  for (const match of text.matchAll(NUMERALS)) {
    const raw = match[0];
    if (ISO_DATE.test(raw) || WRITTEN_DATE.test(raw)) {
      const month = raw.match(new RegExp(MONTH, 'i'))?.[0].slice(0, 3).toLowerCase();
      if (month) figures.push({ value: 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').indexOf(month) + 1, ordinal: false });
      figures.push(...[...raw.matchAll(/\d+(?:\.\d+)?/g)].map(part => ({ value: Number(part[0]), ordinal: false })));
      continue;
    }
    let value = Number(raw.replace(/[, ]/g, '').replace(/(?:bn|[km]|st|nd|rd|th)$/i, ''));
    const suffix = raw.match(/(?:bn|[km])$/i)?.[0].toLowerCase();
    if (suffix) value *= suffix === 'bn' ? 1e9 : suffix === 'k' ? 1e3 : 1e6;
    // A hyphen in a range or identifier separates positive figures.
    if (raw.startsWith('-') && match.index > 0 && /[\p{L}\p{N}]/u.test(text[match.index - 1])) value = Math.abs(value);
    // A sign before a currency prefix still belongs to the figure.
    if (/-[\p{L}\p{Sc}]+$|\b(?:minus|negative)\s*(?:[\p{L}]*\p{Sc}\s*)?$/iu.test(text.slice(0, match.index))) value = -Math.abs(value);
    figures.push({ value, ordinal: /(?:st|nd|rd|th)$/i.test(raw) });
  }
  for (const match of text.matchAll(WORD_FIGURE)) {
    figures.push({ value: wordValue(match[0]), ordinal: match[0].toLowerCase().split(/[\s-]+/).some(word => word in ORDINALS) });
  }
  return figures;
}

function figureToken(figure: Figure): string {
  return `${figure.title ? `title${figure.title}n` : figure.ordinal ? 'title' : 'n'}${String(figure.value).replace('-', 'm').replace('.', 'p')}`;
}

function figureFacts(value: unknown, key: string): Figure[] {
  if (typeof value !== 'string' && typeof value !== 'number') return [];
  if (typeof value === 'string' && URL.canParse(normalizeFigures(value))) return [];
  const figures = numbers(String(value)).filter(figure => Number.isFinite(figure.value));
  if (key.endsWith('_cents')) return figures.flatMap(figure => [figure, { value: figure.value / 100, ordinal: false }]);
  const money = typeof value === 'string'
    ? [...normalizeFigures(value).matchAll(new RegExp(`(?:-[\\p{L}]*\\p{Sc}|\\p{Sc})\\s*${NUMERAL}|${NUMERAL}\\s*\\p{Sc}`, 'giu'))].flatMap(match => numbers(match[0]))
    : [];
  if (figures.length === 1 && /(?:price|amount|cost|money)/i.test(key)) money.push(...figures);
  return [...figures, ...money.map(figure => ({ value: Number((figure.value * 100).toFixed(10)), ordinal: false }))];
}

function toolFacts(result: ToolResult | undefined): string[] {
  if (!result?.ok) return [];
  const tokens: string[] = [];
  const fields = [...result.rows.flatMap(row => Object.entries(row)), ...Object.entries(result.counts), ['basis', result.basis], ['as_of', result.as_of]];
  for (const [key, value] of fields) {
    if (key === 'input' || key === 'inputs' || /(?:id|url|href|link|image|src)$/i.test(key)) continue;
    const figures = figureFacts(value, key);
    for (const figure of figures) {
      tokens.push(figureToken({ ...figure, ordinal: false }));
      if (key === 'title' && typeof value === 'string') {
        tokens.push(figureToken({ ...figure, ordinal: true }));
      }
    }
  }
  for (const row of result.rows) {
    if (typeof row.title === 'string' && !URL.canParse(normalizeFigures(row.title))) {
      tokens.push(...titleFigures(row.title, titleAffixes(row.title)).map(figureToken));
    }
  }
  return tokens;
}

type TitleAffix = { side: 'before' | 'after'; text: string };

function titleAffixes(title: string): TitleAffix[] {
  const text = checkingText(title).toLowerCase();
  const matches = [...text.matchAll(new RegExp(`${NUMERALS.source}|${WORD_FIGURE.source}`, 'gi'))];
  return matches.flatMap(match => {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    return [
      ...[...before.matchAll(/(?<!\p{L})\p{L}/gu)].map(word => ({ side: 'before' as const, text: before.slice(word.index) })),
      ...[...after.matchAll(/\p{L}(?!\p{L})/gu)].map(word => ({ side: 'after' as const, text: after.slice(0, word.index + word[0].length) })),
    ];
  });
}

function titleFigures(text: string, affixes: TitleAffix[]): Figure[] {
  const unique = new Map(affixes.map(affix => [`${affix.side}:${affix.text}`, affix]));
  return [...unique.entries()].flatMap(([key, affix]) => {
    const escaped = affix.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const figure = `(?:${NUMERALS.source}|${WORD_FIGURE.source})`;
    const pattern = affix.side === 'before' ? `(?<![\\p{L}\\p{N}])${escaped}${figure}` : `${figure}${escaped}(?![\\p{L}\\p{N}])`;
    return [...checkingText(text).matchAll(new RegExp(pattern, 'giu'))]
      .flatMap(match => numbers(match[0]).map(figure => ({ ...figure, title: sha256Hex(key) })));
  });
}

function titleClaims(unit: string, results: (ToolResult | undefined)[]): Figure[] {
  const affixes = results.flatMap(result => result?.ok ? result.rows.flatMap(row =>
    typeof row.title === 'string' && !URL.canParse(normalizeFigures(row.title)) ? titleAffixes(row.title) : []) : []);
  return titleFigures(unit, affixes);
}

type CitedSpan = { start: number; end: number; sources: number[] };

async function checkedDraft(message: Message | undefined, answer: Answer, _text: string, log: Log, _now: number, preview = false) {
  let draft = '';
  const spans: CitedSpan[] = [];
  for (const block of message?.content ?? []) {
    if (block.type !== 'text') continue;
    const cited = (block.citations ?? []).filter(c => c.type === 'web_search_result_location');
    spans.push({ start: draft.length, end: draft.length + block.text.length,
      sources: cited.flatMap(c => {
        const index = answer.sources.findIndex(source => source.url === c.url);
        return index < 0 ? [] : [index];
      }) });
    draft += block.text;
  }
  let kept = '';
  let numberWords = false;
  const keptSpans: CitedSpan[] = [];
  for (const { segment: sentence, index, header } of sentences(draft)) {
    const unit = `${header ?? ''}${sentence}`;
    const resultIds = [...normalizeFigures(unit).matchAll(/\[(r\d+)\]/gi)].map(match => match[1].toLowerCase());
    const citedResults = resultIds.map(id => answer.results[id]);
    const claims = [...numbers(unit), ...titleClaims(unit, citedResults)]
      .map(figure => ({ text: Number.isFinite(figure.value) ? figureToken(figure) : 'invalid', kind: 'number' }));
    const tokens = [...new Set(citedResults.flatMap(result => toolFacts(result)))];
    const facts = tokens.map((value, index) => ({ attribute_id: `number${index}`, name: 'number', value }));
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
      if (!(answer.usage.cost_usd < o.max_cost_usd)) {
        early = true;
        answer.reason = 'cost_cap';
        break;
      }
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
          return { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify({ ...result, id }),
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
