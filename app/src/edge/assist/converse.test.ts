import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Message, MessageCreateParamsBase, MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { converse, clientFromEnv, PRICE_TABLE, type ConverseOptions, type StreamClient } from './converse.ts';
import { SYSTEM } from './prompt.ts';
import { gate } from '../gate/gate.ts';
import { createLog, memorySink } from '../../../../log/index.js';
import { sha256Hex } from '../../engines/proof/sha256.ts';
import type { AssistEvent, ToolResult } from './types.ts';

const cite = (text: string, id = 'r1') => {
  const masked = text.replace(/\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Rs|no)\.|U\.S\./gi, word => word.replace(/\./g, ' '));
  let cited = '', cursor = 0;
  for (const match of masked.matchAll(/[.!?](?=\s|$)|$/g)) {
    if (!match[0] && /[.!?]$/.test(masked)) continue;
    cited += `${text.slice(cursor, match.index)} [${id}]${match[0]}`;
    cursor = match.index + match[0].length;
  }
  return cited;
};
const fixture = (name: string): Message[] => {
  const messages: Message[] = JSON.parse(readFileSync(new URL(`./fixtures/converse/${name}.json`, import.meta.url), 'utf8'));
  if (name === 'numbers' || name === 'normalization') {
    for (const message of messages) for (const block of message.content) if (block.type === 'text') block.text = cite(block.text);
  }
  return messages;
};
const result: ToolResult = {
  tool: 'value_item', ok: true, rows: [{ price: '$45', price_cents: 4500 }], counts: { sold: 3 },
  as_of: '2026-11-15', citation_ids: ['c1'], basis: '3 sold on Mercari', not_built: [],
  widgets: ['price_range', 'table'], ms: 2,
};

function replay(messages: Message[]) {
  const requests: MessageCreateParamsBase[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const client: StreamClient = { messages: { stream(params, options) {
    requests.push(structuredClone(params));
    signals.push(options?.signal);
    const message = messages[requests.length - 1];
    if (!message) throw new Error('replay exhausted');
    let listener: ((delta: string) => void) | undefined;
    return {
      on(event, callback) { assert.equal(event, 'text'); listener = callback; },
      async finalMessage() {
        for (const block of message.content) if (block.type === 'text') {
          for (let i = 0; i < block.text.length; i += 5) listener?.(block.text.slice(i, i + 5));
        }
        return structuredClone(message);
      },
    };
  } } };
  return { client, requests, signals };
}

function setup(name = 'answer', overrides: Partial<ConverseOptions> = {}) {
  const recording = replay(fixture(name));
  const sink = memorySink();
  const events: AssistEvent[] = [];
  let clock = 100;
  const options: ConverseOptions = {
    text: 'Find a wool jacket', effort: 'low', model: 'claude-sonnet-5-5', client: recording.client, max_cost_usd: 1,
    tools: { defs: [{ name: 'value_item', description: 'Value an item', input_schema: { type: 'object' }, strict: true }],
      run: async () => structuredClone(result) },
    log: createLog({ src: 'test.assist', build: 'test', sink }), signal: new AbortController().signal,
    now: () => clock++, onEvent: event => events.push(event), ...overrides,
  };
  return { ...recording, sink, events, options, run: () => converse(options) };
}

const prose = (answer: Awaited<ReturnType<typeof converse>>) => answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join(' ');

test('settled blocks preserve text and widgets from every round in order', async () => {
  const first = fixture('one-tool')[0];
  first.content.unshift({ type: 'text', text: 'Looking now. ', citations: null });
  const second = fixture('one-tool')[1];
  second.stop_reason = 'pause_turn';
  const t = setup('answer', { client: replay([first, second, textMessage('Finished.')]).client });
  const answer = await t.run();
  assert.equal(answer.blocks[0].type, 'text');
  assert.equal(answer.blocks[0].type === 'text' && answer.blocks[0].text, 'Looking now.');
  assert.deepEqual(answer.blocks.filter(b => b.type === 'widget').map(b => b.widget), ['price_range', 'table']);
  const last = answer.blocks.at(-1);
  assert.equal(last?.type === 'text' && last.text, '\nFinished.');
  assert.equal(answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join('').replace(/\s/g, ''), streamed(t.events).replace(/\s/g, ''));
  const settled = t.events.find(e => e.event === 'assist.settled');
  assert.ok(settled?.event === 'assist.settled');
  assert.deepEqual(settled.data.blocks, answer.blocks);
});

test('early-stop text is gated, streamed and included in settled blocks', async () => {
  const t = setup('answer', { client: replay([continuingRound({})]).client, max_rounds: 1 });
  const answer = await t.run();
  assert.equal(streamed(t.events), 'The answer stopped early.');
  assert.equal(prose(answer), streamed(t.events));
  assert.ok(answer.ms.first_text !== null);
  assert.equal(t.events.at(-2)?.event, 'assist.text');
});

test('gate tokenization treats money commas, decimals, percent and years as exact tokens', async () => {
  for (const [claim, value, verdict] of [
    ['$1,299', '1299', 'pass'], ['1299', '$1,299', 'pass'], ['4.5', '4', 'hold'],
    ['4.5', '4.5', 'pass'], ['12%', '12', 'pass'], ['2026', '2026', 'pass'],
    ['not enough data: 3 listings', '3', 'hold'],
  ] as const) {
    const check = await gate({ subject: 'probe', text: claim }, [{ attribute_id: 'f1', name: 'number', value }], [],
      text => [{ text, kind: 'number' }]);
    assert.equal(check.verdict, verdict, claim);
  }
});

test('one tool round resolves two valid tags, streams tag-free text and sets first_text', async () => {
  const t = setup('one-tool');
  const answer = await t.run();
  assert.equal(answer.state, 'answered');
  assert.deepEqual(answer.blocks.filter(b => b.type === 'widget'), [
    { type: 'widget', widget: 'price_range', result_id: 'r1' },
    { type: 'widget', widget: 'table', result_id: 'r1' },
  ]);
  assert.ok(answer.ms.first_text !== null && answer.ms.first_text < answer.ms.done);
  assert.equal(t.events.at(-1)?.event, 'assist.settled');
  const streamed = t.events.flatMap(e => e.event === 'assist.text' ? [e.data.delta] : []).join('');
  assert.equal(streamed, 'The measured range.  More detail .');
  assert.deepEqual(t.events.filter(e => e.event === 'assist.tool').map(e => e.data.phase), ['start', 'end']);
  assert.equal(answer.calls[0].id, 'r1');
  assert.equal(answer.calls[0].counts.sold, 3);
  assert.equal(t.signals[0], t.options.signal);
  assert.equal(t.requests[0].max_tokens, 16000);
  assert.deepEqual(t.requests[0].system, [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(t.requests[0].thinking, { type: 'adaptive' });
  assert.deepEqual(t.requests[0].output_config, { effort: 'low' });
  assert.deepEqual(t.requests[0].tools?.at(-1), { type: 'web_search_20260209', name: 'web_search', max_uses: 3 });
  for (const field of ['tool_choice', 'temperature', 'top_p']) assert.ok(!(field in t.requests[0]));
});

test('parallel tool_use calls run concurrently and all results return in one user message in call order', async () => {
  const t = setup('parallel');
  const pending: (() => void)[] = [];
  const started: string[] = [];
  t.options.tools.run = async (name) => {
    started.push(name);
    await new Promise<void>(resolve => {
      pending.push(resolve);
      if (pending.length === 2) pending.forEach(done => done());
    });
    return { ...result, tool: name === 'search_market' ? 'search_market' : 'value_item' };
  };
  const answer = await t.run();
  assert.deepEqual(started, ['search_market', 'value_item']);
  assert.deepEqual(answer.calls.map(c => c.id), ['r1', 'r2']);
  const messages = t.requests[1].messages;
  assert.equal(messages.length, 3);
  assert.deepEqual(messages[1], { role: 'assistant', content: fixture('parallel')[0].content });
  const content = messages[2].content;
  assert.ok(Array.isArray(content));
  assert.deepEqual(content.map(b => b.type === 'tool_result' ? b.tool_use_id : null), ['tool-a', 'tool-b']);
  for (const [i, block] of content.entries()) {
    assert.equal(block.type, 'tool_result');
    if (block.type === 'tool_result') {
      assert.equal(typeof block.content, 'string');
      assert.equal(JSON.parse(String(block.content)).id, `r${i + 1}`);
    }
  }
});

test('an invented $999 sentence is cut while the cited $45 sentence stays', async () => {
  const t = setup('numbers');
  const answer = await t.run();
  assert.equal(prose(answer), cite('It costs $45.'));
  assert.equal(answer.gate.checked, 2);
  assert.equal(answer.gate.cut, 1);
  assert.deepEqual(answer.gate.cut_sentences, [cite('It costs $999.')]);
});

test('normalization preserves cited money, decimals, counts and year parts', async () => {
  const t = setup('normalization');
  t.options.tools.run = async () => ({ ...result, rows: [{ price_cents: 129900, score: 4.5, share: 12 }], counts: { sold: 3 } });
  const answer = await t.run();
  assert.deepEqual(answer.gate.cut_sentences, [cite('The rating is 4.')]);
  for (const text of ['$1,299', '$1,299.00', '1299 dollars', '12%', '4.5', '3 listings', '2026']) assert.ok(prose(answer).includes(text), text);
});

test('money and percent strings back equal figures; an absent figure is still cut', async () => {
  const t = setup('normalization');
  t.options.tools.run = async () => ({ ...result, rows: [{ price: '$1,299.00', share: '12%', score: 4.5 }], counts: { sold: 3 } });
  assert.deepEqual((await t.run()).gate.cut_sentences, [cite('The rating is 4.')]);
  const bare = setup('numbers');
  bare.options.tools.run = async () => ({ ...result, rows: [{ count: 46 }], counts: {} });
  assert.equal((await bare.run()).gate.cut, 2);
});

test('units and standalone years cannot use person text as evidence', async () => {
  const answer = await setup('attached-units', { text: 'I measured 4.5 cm' }).run();
  assert.deepEqual(answer.gate.cut_sentences, ['The length is 999cm.', 'The length is 4.5cm.', 'In 2026.', 'The length is 2026cm.']);
  assert.equal(prose(answer), '');
});

test('this turn backs counts, while money and history alone supply no facts', async () => {
  const t = setup('numbers', { text: 'My budget is $45', history: [{ role: 'user', content: 'I saw $999 before' }] });
  t.options.tools.run = async () => ({ ...result, rows: [], counts: {} });
  assert.equal((await t.run()).gate.cut, 2);
  assert.deepEqual(t.requests[0].messages[0], t.options.history?.[0]);
});

test('web sources retain indexes and dates but cited_text cannot back an uncited number', async () => {
  const messages = fixture('citation');
  const block = messages[0].content.find(block => block.type === 'text');
  assert.ok(block?.type === 'text');
  block.text += ' Read the report.';
  const t = setup('answer', { client: replay(messages).client });
  const answer = await t.run();
  assert.deepEqual(answer.gate.cut_sentences, ['The report found 73%.']);
  assert.deepEqual(answer.sources, [{ url: 'https://example.org/report', title: 'Audience report', page_age: 'November 2026' }]);
  assert.deepEqual(answer.blocks.find(block => block.type === 'text'), { type: 'text', text: 'Read the report.', web_sources: [0] });
  assert.ok(answer.blocks.some(block => block.type === 'widget' && block.result_id === 'web'));
  assert.equal(answer.calls[0].tool, 'web_search');
  assert.equal(answer.calls[0].counts.sources, 1);
});

test('a web search error object is logged and cannot resolve a sources widget', async () => {
  const t = setup('web-error');
  const answer = await t.run();
  assert.equal(answer.state, 'answered');
  assert.equal(answer.sources.length, 0);
  assert.equal(answer.gate.tags_removed, 1);
  assert.equal(answer.calls[0].ok, false);
  assert.equal(answer.calls[0].reason, 'max_uses_exceeded');
  assert.match(t.sink.text(), /max_uses_exceeded/);
});

test('a nonexistent r9 and an unsupported kind are removed and counted after the gate', async () => {
  const answer = await setup('invalid-tags').run();
  assert.equal(answer.gate.tags_removed, 2);
  assert.equal(answer.gate.cut, 0, 'result ids are not numeric claims');
  assert.equal(answer.blocks.filter(b => b.type === 'widget').length, 0);
});

test('a failing tool port sends is_error and the loop still answers', async () => {
  const t = setup('one-tool');
  t.options.tools.run = async () => { throw new Error('market unavailable'); };
  const answer = await t.run();
  assert.equal(answer.state, 'answered');
  assert.equal(answer.results.r1.ok, false);
  assert.equal(answer.calls[0].ok, false);
  const content = t.requests[1].messages.at(-1)?.content;
  assert.ok(Array.isArray(content));
  assert.equal(content[0].type === 'tool_result' && content[0].is_error, true);
  assert.match(t.sink.text(), /market unavailable/);
});

test('pause_turn returns the entire assistant content and continues', async () => {
  const t = setup('pause');
  assert.equal((await t.run()).state, 'answered');
  assert.deepEqual(t.requests[1].messages.at(-1), { role: 'assistant', content: fixture('pause')[0].content });
});

test('a server search paused across rounds still collects its result and emits one completed call', async () => {
  const t = setup('web-pause');
  const answer = await t.run();
  assert.equal(answer.sources.length, 1);
  assert.equal(answer.gate.tags_removed, 0);
  assert.equal(answer.calls.length, 1);
  assert.equal(answer.calls[0].ok, true);
  assert.ok(answer.calls[0].ms > 0);
  assert.deepEqual(t.events.filter(e => e.event === 'assist.tool').map(e => e.data.phase), ['start', 'end']);
  const logs = t.sink.lines.map(line => JSON.parse(line));
  assert.equal(logs.filter(line => line.event === 'call.start' && line.name === 'web_search').length, 1);
});

test('result ids keep call order across multiple rounds', async () => {
  const t = setup('multiple-rounds');
  const answer = await t.run();
  assert.deepEqual(answer.calls.map(call => call.id), ['r1', 'r2', 'r3']);
  assert.deepEqual(Object.keys(answer.results), ['r1', 'r2', 'r3']);
  assert.equal(answer.blocks.find(b => b.type === 'widget')?.result_id, 'r3');
});

test('refusal settles refused with the provider category', async () => {
  const answer = await setup('refusal').run();
  assert.equal(answer.state, 'refused');
  assert.equal(answer.reason, 'cyber');
});

test('max_rounds stops early with a counted explanation; max_tokens also states truncation', async () => {
  const t = setup('pause', { max_rounds: 1 });
  const answer = await t.run();
  assert.equal(t.requests.length, 1);
  assert.equal(answer.state, 'answered');
  assert.equal(answer.reason, 'max_rounds');
  assert.match(prose(answer), /stopped early/i);
  assert.match(t.sink.text(), /early_count.*1/);
  const truncated = await setup('max-tokens').run();
  assert.equal(truncated.reason, 'max_tokens');
  assert.match(prose(truncated), /stopped early/i);
});

test('image precedes text only when supplied and history is never mutated', async () => {
  const history: MessageParam[] = [{ role: 'user', content: 'Earlier product terms' }, { role: 'assistant', content: 'Earlier answer' }];
  const original = structuredClone(history);
  const image = { media_type: 'image/png' as const, data_base64: 'c3ludGhldGlj' };
  const t = setup('answer', { image, history });
  await t.run();
  assert.deepEqual(t.requests[0].messages.at(-1)?.content, [
    { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data_base64 } },
    { type: 'text', text: t.options.text },
  ]);
  assert.deepEqual(history, original);
  const plain = setup();
  await plain.run();
  assert.deepEqual(plain.requests[0].messages.at(-1)?.content, [{ type: 'text', text: plain.options.text }]);
});

test('logs contain the input hash, length, attachment flag and tool terms but never raw text or photo bytes', async () => {
  const text = 'private synthetic request never put in the log';
  const image = { media_type: 'image/jpeg' as const, data_base64: 'cHJpdmF0ZS1zeW50aGV0aWMtcGhvdG8=' };
  const t = setup('one-tool', { text, image });
  await t.run();
  const lines = t.sink.text();
  assert.ok(!lines.includes(text));
  assert.ok(!lines.includes(image.data_base64));
  assert.ok(lines.includes(sha256Hex(text)));
  assert.ok(lines.includes(`"length":${text.length}`));
  assert.ok(lines.includes('"image_attached":true'));
  assert.match(lines, /wool jacket/);
  const calls = t.sink.lines.map(line => JSON.parse(line)).filter(line => line.event === 'call.start');
  assert.equal(calls.filter(c => c.kind === 'model').length, 2);
  assert.equal(calls.filter(c => c.kind === 'tool').length, 1);
});

test('usage sums rounds using the larger of provider and token pricing', async () => {
  const t = setup('usage');
  const answer = await t.run();
  assert.deepEqual(answer.usage, {
    input_tokens: 300, output_tokens: 30, cache_read_input_tokens: 150, web_searches: 2,
    cost_usd: 0.020915, cost_source: 'price_table',
  });
  const table = await setup('one-tool').run();
  assert.equal(table.usage.cost_source, 'price_table');
  assert.equal(table.usage.cost_usd, table.usage.input_tokens * PRICE_TABLE.input_per_million / 1e6
    + table.usage.output_tokens * PRICE_TABLE.output_per_million / 1e6
    + table.usage.cache_read_input_tokens * PRICE_TABLE.cache_read_per_million / 1e6);
});

test('a thrown model error and an aborted signal settle failed and emit a logged result', async () => {
  const t = setup();
  t.options.client = { messages: { stream() { throw new Error('provider offline'); } } };
  const answer = await t.run();
  assert.equal(answer.state, 'failed');
  assert.equal(answer.reason, 'failed');
  assert.match(t.sink.text(), /provider offline/);
  assert.equal(t.events.at(-1)?.event, 'assist.settled');
  const controller = new AbortController();
  controller.abort(new Error('request cancelled'));
  const aborted = setup('answer', { signal: controller.signal });
  assert.equal((await aborted.run()).state, 'failed');
  assert.equal(aborted.requests.length, 0);
});

test('an error echoing the request or photo and a tool echoing raw input cannot leak them to logs', async () => {
  const text = 'private synthetic input for this test';
  const image = { media_type: 'image/png' as const, data_base64: 'cHJpdmF0ZS1waG90by10ZXN0' };
  const t = setup('one-tool', { text, image });
  const messages = fixture('one-tool');
  const call = messages[0].content.find(b => b.type === 'tool_use');
  assert.ok(call);
  call.input = { query: text };
  t.options.client = replay(messages).client;
  t.options.tools.run = async () => { throw new Error(`Failed for ${text} and ${image.data_base64}`); };
  await t.run();
  assert.ok(!t.sink.text().includes(text));
  assert.ok(!t.sink.text().includes(image.data_base64));
  const failed = setup('answer', { text, image });
  failed.options.client = { messages: { stream() { throw new Error(`Bad request ${text} ${image.data_base64}`); } } };
  assert.equal((await failed.run()).state, 'failed');
  assert.ok(!failed.sink.text().includes(text));
  assert.ok(!failed.sink.text().includes(image.data_base64));
});

test('a provider error quoting a JSON-escaped multiline request is redacted before it reaches the logger', async () => {
  const text = 'private synthetic line one\nprivate synthetic line two';
  const escaped = JSON.stringify(text).slice(1, -1);
  const t = setup('answer', { text });
  t.options.client = { messages: { stream() { throw new Error(`Bad request ${JSON.stringify(text)}`); } } };
  const answer = await t.run();
  assert.equal(answer.state, 'failed');
  assert.ok(!answer.reason?.includes(escaped));
  const lines = t.sink.lines.map(line => JSON.parse(line));
  for (const line of lines) assert.ok(!JSON.stringify(line).includes(JSON.stringify(escaped).slice(1, -1)));
});

test('clientFromEnv chooses Anthropic by presence, then OpenRouter, or null', () => {
  assert.equal(clientFromEnv({}), null);
  const direct = clientFromEnv({ ANTHROPIC_API_KEY: '', OPENROUTER_API_KEY: 'synthetic' });
  assert.equal(direct?.model, 'claude-sonnet-5-5');
  assert.equal(direct?.client.baseURL, 'https://api.anthropic.com');
  const router = clientFromEnv({ OPENROUTER_API_KEY: 'synthetic' });
  assert.equal(router?.model, 'anthropic/claude-sonnet-5.5');
  assert.equal(router?.client.baseURL, 'https://openrouter.ai/api');
});

function textMessage(text: string): Message {
  const message = fixture('answer')[0];
  message.content = [{ type: 'text', text, citations: null }];
  return message;
}

const streamed = (events: AssistEvent[]) => events.flatMap(e => e.event === 'assist.text' ? [e.data.delta] : []).join('');

async function backedText(text: string, returned: ToolResult = result, input = 'Find a wool jacket') {
  const t = setup('answer', { text: input });
  const recording = replay([fixture('one-tool')[0], textMessage(text)]);
  t.options.client = recording.client;
  t.options.tools.run = async () => returned;
  return { answer: await t.run(), events: t.events };
}

test('cost cap stops before the third model round and keeps gated text', async () => {
  const rounds = Array.from({ length: 6 }, () => {
    const message = fixture('one-tool')[0];
    message.content.unshift({ type: 'text', text: 'Still looking.', citations: null });
    Object.assign(message.usage, { cost: 0.2 });
    return message;
  });
  const recording = replay(rounds);
  const t = setup('answer', { client: recording.client, max_cost_usd: 0.25 });
  const answer = await t.run();
  assert.equal(recording.requests.length, 2);
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.usage.cost_usd, 0.4);
  assert.match(prose(answer), /Still looking/);
  assert.match(prose(answer), /stopped early/);
});

test('six tool uses run only four ports and return two too_many_calls errors', async () => {
  const message = fixture('one-tool')[0];
  const use = message.content.find(b => b.type === 'tool_use');
  assert.ok(use);
  message.content = Array.from({ length: 6 }, (_, i) => ({ ...use, id: `call-${i}` }));
  const recording = replay([message, textMessage('Done.')]);
  let calls = 0;
  const t = setup('answer', { client: recording.client });
  t.options.tools.run = async () => { calls++; return result; };
  const answer = await t.run();
  assert.equal(calls, 4);
  assert.deepEqual(answer.calls.slice(4).map(c => c.reason), ['too_many_calls', 'too_many_calls']);
  const content = recording.requests[1].messages.at(-1)?.content;
  assert.ok(Array.isArray(content));
  for (const block of content.slice(4)) {
    assert.ok(block.type === 'tool_result' && block.is_error);
    assert.equal(JSON.parse(String(block.content)).reason, 'too_many_calls');
  }
});

test('high effort and invalid cost caps throw before a model call', async () => {
  for (const patch of [{ effort: 'high' }, ...[0, -1, NaN, Infinity, undefined].map(max_cost_usd => ({ max_cost_usd }))]) {
    const t = setup();
    Object.assign(t.options, patch);
    await assert.rejects(t.run, /effort|max_cost_usd/);
    assert.equal(t.requests.length, 0);
  }
  assert.equal((await setup('answer', { effort: 'medium' }).run()).state, 'answered');
});

test('unbacked streamed money never reaches assist.text but a clean sentence does', async () => {
  const recording = replay([textMessage('It costs $412. Let me check the listings.')]);
  const t = setup('answer', { client: recording.client });
  const answer = await t.run();
  assert.ok(!streamed(t.events).includes('$412'));
  for (const event of t.events) assert.ok(!JSON.stringify(event).includes('$412'), event.event);
  assert.deepEqual(answer.gate.cut_sentences, ['It costs $412.']);
  const settled = t.events.find(e => e.event === 'assist.settled');
  assert.ok(settled?.event === 'assist.settled');
  assert.deepEqual(settled.data.gate, { ...answer.gate, cut_sentences: [] });
  assert.match(streamed(t.events), /Let me check the listings/);
  assert.equal(prose(answer), 'Let me check the listings.');
  assert.ok(answer.ms.first_text !== null && answer.ms.first_text < answer.ms.done);
});

test('all year-shaped figures need equal figures in the cited result', async () => {
  const text = cite('There are 2027 listings. In 2027. Since 2027. By 2027. From 2027. Until 2027. Of 2027. November 2027. In 2027 listings. November 2027 dollars.');
  const held = await backedText(text);
  assert.equal(held.answer.gate.cut, 10);
  assert.equal(prose(held.answer), '');
  const clean = cite('There are 2027 listings.');
  assert.equal(prose((await backedText(clean, { ...result, counts: { listings: 2027 } })).answer), clean);
});

test('percent spellings and currency words use equal figures without unit inference', async () => {
  for (const spelling of ['percent', 'per cent', '%']) {
    const clean = cite(`The share is 12 ${spelling}.`);
    const bad = cite(`The share is 13 ${spelling}.`);
    const { answer } = await backedText(`${clean} ${bad}`, { ...result, rows: [{ share: 12, sold_share: 0.12 }], counts: { listed: 14 } });
    assert.deepEqual(answer.gate.cut_sentences, [bad]);
    assert.equal(prose(answer), clean);
  }
  const clean = cite('It costs 45 USD.');
  const { answer } = await backedText(`${clean} ${cite('It costs 46 USD.')}`);
  assert.equal(answer.gate.cut, 1);
  assert.equal(prose(answer), clean);
});

test('ISO dates and timestamps compare their parts with the cited result', async () => {
  for (const key of ['as_of', 'sold_at', 'listed_at', 'read_at']) {
    const returned = key === 'as_of' ? { ...result, as_of: '2026-11-14' } : { ...result, rows: [{ [key]: '2026-11-14T12:30:00Z' }] };
    const clean = cite('Read on 2026-11-14.');
    const { answer } = await backedText(`${clean} ${cite('Read on 2026-11-13.')}`, returned);
    assert.equal(answer.gate.cut, 1, key);
    assert.equal(prose(answer), clean);
  }
  const recording = replay([textMessage('Today is 2026-11-15. Next is 2026-11-16.')]);
  const t = setup('answer', { client: recording.client, now: () => Date.parse('2026-11-15T20:00:00Z'), text: 'My note says 2026-11-16' });
  assert.equal((await t.run()).gate.cut, 2);
  const clean = cite('Read at 2026-11-14T12:30:00Z.');
  const timestamp = await backedText(`${clean} ${cite('Read at 2026-11-14T13:30:00Z.')}`, { ...result, rows: [{ read_at: '2026-11-14T12:30:00Z' }] });
  assert.equal(timestamp.answer.gate.cut, 1);
  assert.equal(prose(timestamp.answer), clean);
});

test('only successful results explicitly cited by a unit supply figures', async () => {
  for (const text of ['It costs $45.', cite('It costs $45.', 'r9')]) {
    assert.equal((await backedText(text)).answer.gate.cut, 1);
  }
  assert.equal((await backedText(cite('It costs $45.'), { ...result, ok: false })).answer.gate.cut, 1);
  assert.equal((await backedText(cite('It costs $45.'), { ...result, citation_ids: [] })).answer.gate.cut, 0);
  const echoed = Object.assign({ ...result, rows: [], counts: {} }, { input: { price_cents: 4500, sold_share: 0.12 } });
  assert.equal((await backedText(cite('It costs $45. The share is 12%.'), echoed)).answer.gate.cut, 2);
  const topLevel = Object.assign({ ...result, rows: [], counts: {} }, { price_cents: 4500, sold_share: 0.12 });
  assert.equal((await backedText(cite('It costs $45. The share is 12%.'), topLevel)).answer.gate.cut, 2);
});

test('vendor error details stay in logs and settled calls omit input', async () => {
  const t = setup();
  t.options.client = { messages: { stream() { throw new Error('401 invalid x-api-key sk-test'); } } };
  const answer = await t.run();
  assert.equal(answer.reason, 'failed');
  assert.doesNotMatch(JSON.stringify({ answer, events: t.events }), /401|sk-test/);
  assert.match(t.sink.text(), /401/);
  const withTool = setup('one-tool');
  await withTool.run();
  const settled = withTool.events.find(e => e.event === 'assist.settled');
  assert.ok(settled?.event === 'assist.settled');
  assert.ok(settled.data.calls.length);
  assert.ok(settled.data.calls.every(call => !Object.hasOwn(call, 'input')));
});

test('echoed input strings are not top-level figures or row evidence', async () => {
  for (const returned of [
    Object.assign({ ...result, rows: [] }, { input: '45 dollars' }),
    { ...result, rows: [{ inputs: '45 dollars' }] },
  ]) {
    assert.equal((await backedText(cite('It costs $45.'), returned)).answer.gate.cut, 1);
  }
});

test('malformed model or person dates are held without losing clean text', async () => {
  for (const date of ['2026-11-15T25:00:00Z', '2026-02-30', '2026-13-15T12:00:00Z']) {
    const recording = replay([textMessage(`Read at ${date}. Let me check the listings.`)]);
    const t = setup('answer', { client: recording.client, text: `My note says ${date}` });
    const answer = await t.run();
    assert.equal(answer.state, 'answered', date);
    assert.equal(prose(answer), 'Let me check the listings.', date);
    assert.equal(streamed(t.events).trim(), 'Let me check the listings.', date);
    assert.equal(answer.gate.cut, 1, date);
  }
});

for (const join of ['-', '–', ' to ']) test(`money range joined by ${join} needs both endpoint figures`, async () => {
  const text = cite(`Most sell for $85${join}120.`);
  const low = { ...result, rows: [{ price_cents: 8500 }], counts: { sold: 121 } };
  const held = await backedText(text, low);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.ok(!streamed(held.events).includes('120'));
  const backed = await backedText(text, { ...low, rows: [...low.rows, { price_cents: 12000 }] });
  assert.equal(backed.answer.gate.cut, 0);
  assert.equal(prose(backed.answer), text);
});

test('person text backs no counts, dates, money or percentages', async () => {
  for (const [text, claim] of [
    ['Is $400 fair for this?', 'Comparable sales put it at $400.'],
    ['Is 12% realistic?', 'The share is 12%.'],
  ]) {
    const recording = replay([textMessage(claim)]);
    const t = setup('answer', { client: recording.client, text });
    assert.deepEqual((await t.run()).gate.cut_sentences, [claim]);
  }
  const recording = replay([textMessage('You have 7 items. Sold on 2026-11-12.')]);
  const t = setup('answer', { client: recording.client, text: 'I have 7 items sold on 2026-11-12' });
  assert.equal((await t.run()).gate.cut, 2);
});

function continuingRound(usage: Partial<Message['usage']> & { cost?: number }) {
  const message = fixture('one-tool')[0];
  message.usage = { ...message.usage, ...usage };
  return message;
}

test('negative provider cost falls back to table pricing and cannot postpone the cap', async () => {
  const recording = replay([
    continuingRound({ cost: -1, input_tokens: 0, output_tokens: 20000, cache_read_input_tokens: 0 }),
    ...Array.from({ length: 5 }, () => continuingRound({ cost: 0.2 })),
  ]);
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 2);
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.usage.cost_usd, 0.4);
});

test('missing input counts default to zero and missing output uses max_tokens', async () => {
  const message = continuingRound({ output_tokens: 20000, cache_read_input_tokens: 0 });
  Reflect.deleteProperty(message.usage, 'input_tokens');
  const recording = replay(Array.from({ length: 6 }, () => structuredClone(message)));
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 2);
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.usage.input_tokens, 0);
  assert.equal(answer.usage.cost_usd, 0.4);
  const missingOutput = textMessage('Done.');
  Reflect.deleteProperty(missingOutput.usage, 'output_tokens');
  assert.equal((await setup('answer', { client: replay([missingOutput]).client }).run()).usage.output_tokens, 16000);
});

test('non-finite accumulated cost forces one final answer attempt', async () => {
  const recording = replay(Array.from({ length: 6 }, () => continuingRound({ output_tokens: NaN })));
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 2);
  assert.deepEqual(recording.requests[1].tool_choice, { type: 'none' });
  assert.equal(answer.reason, 'cost_cap');
});

test('cache creation costs 1.25 times input pricing and counts toward the cap', async () => {
  const recording = replay(Array.from({ length: 6 }, () => continuingRound({
    input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 100000,
  })));
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 2);
  assert.deepEqual(recording.requests[1].tool_choice, { type: 'none' });
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.usage.cost_usd, 0.5);
});

test('each round sizes max_tokens from remaining output budget, bounded by 1024 and 16000', async () => {
  const recording = replay([continuingRound({ cost: 0.2 }), textMessage('Done.')]);
  await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.deepEqual(recording.requests.map(request => request.max_tokens), [16000, 5000]);
  const small = replay([textMessage('Done.')]);
  await setup('answer', { client: small.client, max_cost_usd: 0.001 }).run();
  assert.equal(small.requests[0].max_tokens, 1024);
});

for (const spelling of ['USD 412', 'USD412', 'US$412', '€412', '£412', '412 bucks', 'approx412']) {
  test(`${spelling} needs an equal figure in its cited result`, async () => {
    const text = cite(`It costs ${spelling}.`);
    const held = await backedText(text, { ...result, rows: [], counts: { sold: 413 } });
    assert.equal(held.answer.gate.cut, 1);
    assert.equal(streamed(held.events), '');
    assert.equal(prose((await backedText(text, { ...result, rows: [], counts: { sold: 412 } })).answer), text);
  });
}

test('currency spellings compare figures without interpreting the currency', async () => {
  for (const spelling of ['USD 412', 'USD412', 'US$412', '412 bucks', '€412', '£412']) {
    const text = cite(`It costs ${spelling}.`);
    assert.equal(prose((await backedText(text, { ...result, rows: [{ price_cents: 41200 }] })).answer), text);
    assert.equal((await backedText(text, { ...result, rows: [{ price: '$413' }] })).answer.gate.cut, 1);
  }
});

for (const [label, count] of [['4k', 4000], ['32x32', 32]] as const) {
  test(`${label} compares its expanded figure`, async () => {
    const text = cite(`The size is ${label}.`);
    assert.equal((await backedText(text, { ...result, counts: { size: count } })).answer.gate.cut, 0);
    assert.equal((await backedText(text, { ...result, counts: {} })).answer.gate.cut, 1);
  });
}

test('month-first and day-first dates compare their parts', async () => {
  const returned = { ...result, rows: [{ sold_at: '2026-11-15' }] };
  const clean = cite('Sold November 15, 2026. Sold 15 November 2026.');
  const bad = cite('Sold November 14, 2026.');
  const { answer } = await backedText(`${clean} ${bad}`, returned);
  assert.equal(answer.gate.checked, 3);
  assert.deepEqual(answer.gate.cut_sentences, [bad]);
  assert.equal(prose(answer), clean);
});

test('the current date supplies no implicit evidence', async () => {
  const recording = replay([textMessage('Today is 2026-11-14. Today is 2026-11-15. Today is 2026-11-16.')]);
  const t = setup('answer', { client: recording.client, now: () => Date.parse('2026-11-15T02:00:00Z') });
  const answer = await t.run();
  assert.deepEqual(answer.gate.cut_sentences, ['Today is 2026-11-14.', 'Today is 2026-11-15.', 'Today is 2026-11-16.']);
  assert.equal(prose(answer), '');
});

test('naive date-times compare their literal parts regardless of the server time zone', async () => {
  const originalZone = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    for (const date of ['2026-11-15 10:00', '2026-11-15T10:00:00Z']) {
      const { answer } = await backedText(cite(`Read at ${date}.`), { ...result, rows: [{ read_at: '2026-11-15 10:00' }] });
      assert.equal(answer.gate.cut, 0, date);
    }
  } finally {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  }
});

test('cuts in a tool_use round remain in answer.gate exactly once', async () => {
  const first = continuingRound({});
  first.content.unshift({ type: 'text', text: 'It costs $412.', citations: null });
  const recording = replay([first, textMessage('Let me check the listings.')]);
  const t = setup('answer', { client: recording.client });
  const answer = await t.run();
  assert.deepEqual(answer.gate, { checked: 1, cut: 1, cut_sentences: ['It costs $412.'], tags_removed: 0 });
  for (const event of t.events) assert.ok(!JSON.stringify(event).includes('$412'));
});

test('cuts on a continued round stopped by the cap are counted once', async () => {
  const first = continuingRound({ cost: 0.3 });
  first.content.unshift({ type: 'text', text: 'It costs $412.', citations: null });
  const t = setup('answer', { client: replay([first]).client, max_cost_usd: 0.25 });
  const answer = await t.run();
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.gate.cut, 1);
  assert.deepEqual(answer.gate.cut_sentences, ['It costs $412.']);
});

test('number words next to money or percent words are held and the reason is logged', async () => {
  for (const text of ['It sells for four hundred dollars.', 'It sells for a dozen bucks.',
    'The share is half percent.', 'The share is twenty per cent.',
    'It is a Kennedy half dollar.', 'It is a two-dollar bill.']) {
    const t = setup('answer', { client: replay([textMessage(`${text} Let me check.`)]).client });
    const answer = await t.run();
    assert.equal(answer.gate.checked, 1, text);
    assert.deepEqual(answer.gate.cut_sentences, [text]);
    assert.equal(prose(answer), 'Let me check.');
    assert.match(t.sink.text(), /number_words/);
    for (const event of t.events) assert.ok(!JSON.stringify(event).includes(text));
  }
});

test('prompt tells the model to write every figure in digits', () => {
  assert.match(SYSTEM, /Write every figure in digits\./);
});

test('a later tool fact cannot erase a streamed cut when the cap ends the turn', async () => {
  const first = continuingRound({ cost: 0.3 });
  first.content.unshift({ type: 'text', text: 'It costs $412. Let me check.', citations: null });
  const t = setup('answer', { client: replay([first]).client, max_cost_usd: 0.25 });
  t.options.tools.run = async () => ({ ...result, rows: [{ price_cents: 41200 }] });
  const answer = await t.run();
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.gate.checked, 1);
  assert.deepEqual(answer.gate.cut_sentences, ['It costs $412.']);
  assert.equal(answer.gate.cut, 1);
  assert.doesNotMatch(prose(answer), /\$412/);
  for (const event of t.events) assert.ok(!JSON.stringify(event).includes('$412'));
});

for (const spelling of [
  '400 euros', '400 euro', '400 pounds sterling', '400 pound sterling', '400 EUR', '400 GBP',
  'a 400-dollar jacket', '400-dollars', '400-USD', '400 - bucks', '$-400', 'USD-400', '50 cents', '1 cent',
]) {
  test(`${spelling} needs its literal signed figure in a cited result`, async () => {
    const text = cite(`It is ${spelling}.`);
    const value = spelling === '$-400' ? -400 : spelling.startsWith('50') ? 50 : spelling.startsWith('1 ') ? 1 : 400;
    const returned = { ...result, rows: [{ value }], counts: {} };
    const held = await backedText(text, { ...returned, rows: [] }, 'I counted 400, 50 and 1 items.');
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
    assert.equal(prose((await backedText(text, returned)).answer), text);
    assert.equal((await backedText(text.replace(' [r1]', ''), returned)).answer.gate.cut, 1, 'a matching result still needs a citation');
    assert.equal((await backedText(text, { ...returned, rows: [{ value: 401 }] })).answer.gate.cut, 1, 'the signed figure must agree');
  });
}

const hyphenCases: [string, Record<string, number>][] = [
  ['Sizes 8-10 are available.', { low: 8, high: 10 }],
  ['Delivery takes 2-3 days.', { low: 2, high: 3 }],
  ['The MA-1 is available.', { model: 1 }],
  ['COVID-19 affected sales.', { version: 19 }],
];
for (const [original, counts] of hyphenCases) {
  const text = cite(original);
  test(`a hyphen in ${text} does not make a negative number`, async () => {
    const returned = { ...result, rows: [], counts, basis: '' };
    const kept = await backedText(text, returned);
    assert.equal(kept.answer.gate.cut, 0);
    assert.equal(prose(kept.answer), text);
    assert.equal(streamed(kept.events), text);
    assert.equal((await backedText(text, { ...returned, counts: {} })).answer.gate.cut, 1, 'positive endpoints still need facts');
    if ('low' in counts) {
      assert.equal((await backedText(text, { ...returned, counts: { low: counts.low } })).answer.gate.cut, 1, 'both range endpoints need facts');
    }
  });
}

for (const original of ['-8 items remain.', 'There are -8 items.', 'There are (-8) items.', 'There are [-8] items.', 'There are {-8} items.']) {
  const text = cite(original);
  test(`a sign at an allowed boundary stays negative: ${text}`, async () => {
    assert.equal((await backedText(text, { ...result, rows: [], counts: { items: 8 } })).answer.gate.cut, 1);
    assert.equal((await backedText(text, { ...result, rows: [], counts: { items: -8 } })).answer.gate.cut, 0);
  });
}

for (const [title, original] of [
  ['MacBook A1466 2017', 'The A1466 is the 2017 model.'], ['Jeans W32', 'The size is W32.'],
  ['Sony PS5', 'The PS5 is available.'], ['Y2K', 'The style is Y2K.'],
] as const) {
  test(`cited title ${title} backs its figures`, async () => {
    const text = cite(original);
    for (const citation_ids of [[], ['c1']]) {
      const returned = { ...result, rows: [{ title }], counts: {}, citation_ids };
      const kept = await backedText(text, returned);
      assert.equal(kept.answer.gate.cut, 0);
      assert.equal(prose(kept.answer), text);
      assert.equal((await backedText('It costs $999.', returned)).answer.gate.cut, 1);
      assert.equal((await backedText(text, { ...returned, ok: false })).answer.gate.cut, 1);
      assert.equal((await backedText(text, { ...returned, rows: [] })).answer.gate.cut, 1);
    }
  });
}

test('uncited strings supply no counts, money or percent', async () => {
  const returned = { ...result, rows: [{ title: 'A1466 costs $400 with 12% sold' }], counts: {}, citation_ids: [] };
  const { answer } = await backedText('The model is A1466. It costs $400. The share is 12%.', returned);
  assert.equal(prose(answer), '');
  assert.deepEqual(answer.gate.cut_sentences, ['The model is A1466.', 'It costs $400.', 'The share is 12%.']);
});

test('a round without token fields or provider cost uses max_tokens pricing and logs the estimate once', async () => {
  const round = continuingRound({});
  for (const key of Object.keys(round.usage)) Reflect.deleteProperty(round.usage, key);
  const recording = replay(Array.from({ length: 6 }, () => structuredClone(round)));
  const t = setup('answer', { client: recording.client, max_cost_usd: 0.001 });
  const answer = await t.run();
  assert.equal(recording.requests.length, 1);
  assert.deepEqual(recording.requests[0].tool_choice, { type: 'none' });
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.usage.input_tokens, 0);
  assert.equal(answer.usage.output_tokens, recording.requests[0].max_tokens);
  assert.equal(answer.usage.cost_usd, recording.requests[0].max_tokens * PRICE_TABLE.output_per_million / 1e6);
  const lines = t.sink.lines.map(line => JSON.parse(line));
  const notes = lines.filter(line => line.event === 'note' && line.reason === 'missing_token_usage');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].tokens_out, recording.requests[0].max_tokens);
  const modelStart = lines.find(line => line.event === 'call.start' && line.kind === 'model');
  const modelEnd = lines.find(line => line.event === 'call.end' && line.call === modelStart.call);
  assert.equal(modelEnd.cost_usd, answer.usage.cost_usd, 'call and answer must use the same estimate');
  const priced = structuredClone(round);
  Object.assign(priced.usage, { cost: 0 });
  priced.stop_reason = 'end_turn';
  const provider = setup('answer', { client: replay([priced]).client });
  assert.equal((await provider.run()).usage.cost_usd, 0.16, 'missing output is priced even when provider reports zero');
  assert.match(provider.sink.text(), /missing_token_usage/);
});

for (const text of ['It costs dollars five.',
  'I am one hundred percent sure.', 'I am one hundred percent certain.']) {
  test(`number words always require cited figures: ${text}`, async () => {
    const t = setup('answer', { client: replay([textMessage(text)]).client });
    const answer = await t.run();
    assert.equal(prose(answer), '');
    assert.equal(streamed(t.events), '');
    assert.deepEqual(answer.gate.cut_sentences, [text]);
    assert.match(t.sink.text(), /number_words/);
  });
}

for (const text of ['The share is one percent.', 'The share is one percent surely.', 'It costs two dollars. It costs three dollars.']) {
  test(`number_words is logged once in a round that cuts: ${text}`, async () => {
    const rounds = [continuingRound({}), textMessage(text)];
    rounds[0].content.unshift({ type: 'text', text, citations: null });
    const t = setup('answer', { client: replay(rounds).client });
    const answer = await t.run();
    assert.equal(prose(answer), '');
    const notes = t.sink.lines.map(line => JSON.parse(line)).filter(line => line.reason === 'number_words');
    assert.equal(notes.length, 2, 'one note per model round regardless of sentence count or preview');
  });
}

for (const date of ['Nov 15, 2026', 'Nov. 15 2026', 'November 15 2026']) {
  test(`${date} needs every date part including its month`, async () => {
    const text = cite(`Sold on ${date}.`);
    const returned = { ...result, rows: [{ sold_at: '2026-11-15' }], counts: {} };
    const kept = await backedText(text, returned);
    assert.equal(kept.answer.gate.checked, 1);
    assert.equal(kept.answer.gate.cut, 0);
    assert.equal(prose(kept.answer), text);
    assert.equal(streamed(kept.events), text);
    const held = await backedText(text, { ...returned, rows: [], as_of: '', counts: { day: 15, year: 2026 } });
    assert.deepEqual(held.answer.gate.cut_sentences, [text], 'day and year alone do not back the month');
  });
}


const plantedMoney: [string, string[]][] = [
  ['It is 400 US dollars.', ['$400']], ['It is 400 U.S. dollars.', ['$400']],
  ['It costs 400 (dollars).', ['$400']], ['It costs _400_ dollars.', ['$400']],
  ['400 €', ['€400']], ['50¢', ['$0.50', '50']], ['¥400', ['JPY 400']],
  ['400 yen', ['JPY 400']], ['₹400', ['INR 400']], ['Rs. 400', ['INR 400']],
  ['CHF 400', ['CHF 400']], ['400 CAD', ['CAD 400']], ['400 quid', ['GBP 400']],
  ['It sells for $４００.', ['$400']], ['It sells for ٤٠٠ dollars.', ['$400']],
  ['$\u200b400', ['$400']], ['It runs 85-120 dollars.', ['$85', '$120']],
  ['It runs $85—120.', ['$85', '$120']], ['$85/120', ['$85', '$120']],
  ['$85 or 120', ['$85', '$120']], ['between $85 and 120', ['$85', '$120']],
  ['from $85 up to 120', ['$85', '$120']], ['400 to 500 dollars', ['$400', '$500']],
  ['$400k', ['$400000']], ['$1.2M', ['$1200000']],
  ['four hundred USD', ['$400']], ['CA$400', ['CAD 400']], ['£5', ['GBP 5']],
  ['It is 400 dollars, reduced from 500.', ['$400', '$500']],
  ['A$400', ['AUD 400']], ['AU$400', ['AUD 400']], ['NZ$400', ['NZD 400']],
  ['HK$400', ['HKD 400']], ['US$400', ['$400']], ['CNY 400', ['CNY 400']],
  ['MXN 400', ['MXN 400']], ['400 francs', ['CHF 400']],
  ['-$40', ['-$40']], ['$2bn', ['$2000000000']],
  ['It costs **400** [dollars].', ['$400']], ['It costs `400` dollars.', ['$400']],
];

for (const [original, prices] of plantedMoney) {
  const text = cite(original, 'r2');
  test(`BC2 cuts planted ${text} and keeps its cited currency and value`, async () => {
    const run = async (citedPrices: string[]) => {
      const t = setup('answer', { text: 'I counted 400 and 85 items.' });
      t.options.client = replay([fixture('parallel')[0], textMessage(text)]).client;
      t.options.tools.run = async name => name === 'search_market'
        ? { ...result, tool: 'search_market', citation_ids: [], counts: {}, rows: [{ url: 'https://www.ebay.com/itm/400?x=85', title: 'Kettlebell 5 pounds' }] }
        : { ...result, counts: {}, rows: citedPrices.map(price => ({ price })) };
      return { answer: await t.run(), events: t.events };
    };
    const held = await run(original === '$400k' ? ['$400'] : ['$121']);
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '', 'planted price must never stream');
    const kept = await run(prices);
    assert.equal(kept.answer.gate.cut, 0);
    assert.equal(prose(kept.answer), text, 'figures and supported bold stay unchanged');
    assert.equal(streamed(kept.events), text);
  });
}

test('BC1 reported zero never lowers token pricing or disables max_cost_usd', async () => {
  const recording = replay([continuingRound({ cost: 0, input_tokens: 900000, output_tokens: 16000, cache_read_input_tokens: 0 })]);
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 2);
  assert.deepEqual(recording.requests[1].tool_choice, { type: 'none' });
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.usage.cost_usd, 1.96);
  assert.equal(answer.usage.cost_source, 'price_table');
});

test('BC1 missing input or output logs a note even when provider cost is present', async () => {
  for (const field of ['input_tokens', 'output_tokens']) {
    const message = textMessage('Done.');
    Object.assign(message.usage, { cost: 0 });
    Reflect.deleteProperty(message.usage, field);
    const t = setup('answer', { client: replay([message]).client });
    const answer = await t.run();
    assert.equal(answer.usage[field === 'input_tokens' ? 'input_tokens' : 'output_tokens'], field === 'input_tokens' ? 0 : 16000);
    const notes = t.sink.lines.map(line => JSON.parse(line)).filter(line => line.reason === 'missing_token_usage');
    assert.equal(notes.length, 1);
  }
});

test('weight, size and signed fractions need literal cited figures', async () => {
  for (const original of ['It weighs 5 pounds.', 'It weighs 5 lb.', 'It weighs 5 lbs.', 'It weighs 5 oz.']) {
    const text = cite(original);
    assert.equal(prose((await backedText(text, { ...result, rows: [{ weight: 5 }], counts: {}, citation_ids: [] })).answer), text);
  }
  const size = await backedText(cite('Size 10 sells for $120.'), { ...result, rows: [{ price_cents: 12000 }] }, 'Size 10');
  assert.equal(size.answer.gate.cut, 1);
  const percent = await backedText(cite('It is down 5%.'), { ...result, rows: [{ change: -0.05 }] });
  assert.equal(percent.answer.gate.cut, 1);
  assert.equal((await backedText('It is down 5%.', { ...result, rows: [{ change: -0.05 }] }, '5')).answer.gate.cut, 1);
  for (const text of ['I am 100% sure.', 'I am 100 percent certain.', 'I am one hundred percent sure.']) {
    const held = await backedText(text);
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
  }
});

for (const context of ['10 items', '10 times', '10 sizes', '10 pairs', '10 colors', '10 stars', '10 reviews', '10 photos', '10 lb', '10 lbs', '10 oz', '10 pounds', 'size 10', '#10', 'no. 10', 'model 10', 'style 10', 'lot 10', 'item 10', 'A10', 'PS10', 'Y10K', 'MA-10', 'W10']) {
  test(`${context} is never explained by adjacent words or the person`, async () => {
    const text = cite(`For ${context}, it costs $120.`);
    const held = await backedText(text, { ...result, rows: [{ price: '$120' }] }, '10');
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
    const value = context === 'Y10K' ? 10000 : 10;
    assert.equal(prose((await backedText(text, { ...result, rows: [{ price: '$120', title: context, value }] })).answer), text);
  });
}

test('shared normalization applies to result fields but supplies no person facts', async () => {
  const text = cite('It costs $400.');
  const money = await backedText(text, { ...result, rows: [{ price: '_٤٠٠_ (dollars)' }] });
  assert.equal(prose(money.answer), text);
  const count = await backedText('There are 4 items. Sold on 2026-11-12.', { ...result, rows: [], counts: {} }, '４ items sold on ٢٠٢٦-١١-١٢');
  assert.equal(count.answer.gate.cut, 2);
});

for (const key of ['id', 'external_id', 'url', 'photo_url', 'href', 'item_href', 'link', 'source_link', 'image', 'hero_image', 'src', 'photo_src']) {
  test(`BC2 ${key} fields cannot back counts or money`, async () => {
    for (const value of [400, '400', '$400']) {
      const held = await backedText(cite('There are 400 items. It costs $400.'), { ...result, rows: [{ [key]: value }], counts: {} });
      assert.equal(held.answer.gate.cut, 2);
    }
  });
}

test('BC2 a URL string under an innocent field name cannot supply figures', async () => {
  const held = await backedText(cite('There are 400 items. There are 85 items.'), { ...result, rows: [{ title: 'https://www.ebay.com/itm/400?x=85' }], counts: {} });
  assert.equal(held.answer.gate.cut, 2);
  const kept = await backedText(cite('There are 400 items.'), { ...result, citation_ids: [], rows: [{ title: '400 items' }], counts: {} });
  assert.equal(kept.answer.gate.cut, 0);
});

test('an unknown currency supplies no exemption and needs an equal cited figure', async () => {
  const text = cite('It costs ₿400.');
  const held = await backedText(text, { ...result, rows: [{ price: '₿401' }], counts: { sold: 399 } }, '400');
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
  assert.equal(prose((await backedText(text, { ...result, rows: [{ price: '₿400' }] })).answer), text);
});

test('BC2 a minus before currency and a currency multiplier cannot borrow an unscaled positive price', async () => {
  for (const text of ['-$40', '-CA$40', '$400k', '$1.2M', '$2bn']) {
    const held = await backedText(text, { ...result, rows: [{ price: '$40' }, { price: 'CAD 40' }, { price: '$400' }, { price: '$1.2' }, { price: '$2' }] });
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  }
});

test('BC2 count metadata identifiers cannot supply counts', async () => {
  const held = await backedText(cite('There are 400 items.'), { ...result, rows: [], counts: { external_id: 400 } });
  assert.equal(held.answer.gate.cut, 1);
});

test('BC2 normalized result dates remain whole dates', async () => {
  const kept = await backedText(cite('Sold on 2026-11-12.'), { ...result, rows: [{ sold_at: '٢٠٢٦-١١-١٢' }] });
  assert.equal(prose(kept.answer), cite('Sold on 2026-11-12.'));
});


test('BC2 a year-shaped price or range endpoint cannot use the standalone year exemption', async () => {
  for (const [text, prices] of [
    ['It runs from 4000 to 5000 dollars.', ['$5000']],
    ['It runs from 2026 to 4000 dollars.', ['$4000']],
    ['In 2027 EUR.', ['$2026']],
  ] as const) {
    const held = await backedText(text, { ...result, rows: prices.map(price => ({ price })), counts: { sold: 4001 } }, '2026 and 4000');
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
  }
  const kept = await backedText(cite('In 2026, it costs $120.'), { ...result, rows: [{ price: '$120' }] });
  assert.equal(kept.answer.gate.cut, 0);
});


for (const [suffix, value] of [['k', 120000], ['m', 120000000], ['M', 120000000], ['bn', 120000000000]] as const) {
  test(`BC2 range endpoint ${suffix} scales as money rather than a glued count`, async () => {
    const text = cite(`It costs $85–120${suffix}.`);
    const returned = { ...result, rows: [{ price: '$85' }] };
    const held = await backedText(text, returned, '120 items');
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
    const kept = await backedText(text, { ...returned, rows: [...returned.rows, { price: `$${value}` }] });
    assert.equal(prose(kept.answer), text);
  });
}

test('BC2 quid alone does not turn pounds of weight into currency', async () => {
  const text = cite('It weighs 5 pounds and costs 10 quid.');
  const returned = { ...result, rows: [{ price: 'GBP 10', weight: 5 }] };
  const kept = await backedText(text, returned, '5 pounds');
  assert.equal(prose(kept.answer), text);
  const held = await backedText('It costs £5.', { ...returned, rows: [{ title: 'Kettlebell 5 pounds' }] }, '5 pounds');
  assert.deepEqual(held.answer.gate.cut_sentences, ['It costs £5.']);
});


for (const [words, wrong, honest] of [
  ['a hundred', '$0', '$100'], ['a thousand', '$0', '$1000'],
  ['one and a half', '$0.50', '$1.50'], ['half a million', '$1000000', '$500000'],
] as const) {
  test(`BC2 ${words} cannot be backed by a partial number-word value`, async () => {
    const text = cite(`It costs ${words} dollars.`);
    const held = await backedText(text, { ...result, rows: [{ price: wrong }] });
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
    const kept = await backedText(text, { ...result, rows: [{ price: honest }] });
    assert.equal(prose(kept.answer), text);
  });
}

test('BC2 a left multiplier inherits the range currency even with another currency present', async () => {
  const text = cite('It costs 85k–120 CAD or US$5.');
  const returned = { ...result, rows: [{ price: 'CAD 85000' }, { price: 'CAD 120' }, { price: 'US$5' }] };
  const kept = await backedText(text, returned);
  assert.equal(prose(kept.answer), text);
  assert.equal(streamed(kept.events), text);
  const held = await backedText(text, { ...returned, rows: [{ price: 'CAD 85' }, { price: 'CAD 120' }, { price: 'US$5' }] }, '85');
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
});

test('BC1 missing-input note records the actual output tokens', async () => {
  const message = textMessage('Done.');
  Object.assign(message.usage, { output_tokens: 50 });
  Reflect.deleteProperty(message.usage, 'input_tokens');
  const t = setup('answer', { client: replay([message]).client });
  await t.run();
  const note = t.sink.lines.map(line => JSON.parse(line)).find(line => line.reason === 'missing_token_usage');
  assert.equal(note.tokens_out, 50);
  assert.equal(note.tokens_in, 0);
});


for (const [words, wrong, honest] of [
  ['two dozen', '$14', '$24'], ['half dozen', '$12.50', '$6'], ['one half', '$1.50', '$0.50'],
] as const) {
  test(`BC2 ${words} uses its full number-word amount`, async () => {
    const text = cite(`It costs ${words} dollars.`);
    const held = await backedText(text, { ...result, rows: [{ price: wrong }] });
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    const kept = await backedText(text, { ...result, rows: [{ price: honest }] });
    assert.equal(prose(kept.answer), text);
  });
}

test('BC2 uncertain consecutive number-word scales cannot back themselves', async () => {
  const text = cite('It costs one thousand million dollars.');
  const held = await backedText(text, { ...result, rows: [{ price: text }] });
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
});

for (const text of [
  'It costs NZ$400 [r1].', 'new ones from 1299 [r1].', '400ish dollars [r1].',
  'four hundred new [r1].', 'sells for about 400 [r1].', '400 ZAR [r1].',
  '−400 [r1].', 'a dozen [r1].', 'a couple hundred [r1].', 'mid-300s [r1].',
]) test(`equal-figure gate cuts the review hole: ${text}`, async () => {
  const held = await backedText(text, { ...result, rows: [{ price: '$120' }], counts: { sources: 1 } }, 'I have 400 items. I have 1299 items. I have 300 items. NZ$400');
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
});

test('equal-figure gate checks each list item with its header and never a sibling citation', async () => {
  const text = 'Prices in US dollars:\n- New: 400\n- Used: 120 [r1]';
  const held = await backedText(text, { ...result, rows: [{ price: '$120' }], counts: {} });
  assert.deepEqual(held.answer.gate.cut_sentences, ['- New: 400']);
  assert.equal(prose(held.answer), 'Prices in US dollars:\n\n- Used: 120 [r1]');
  assert.equal(streamed(held.events), 'Prices in US dollars:\n\n- Used: 120 [r1]');
});

test('a table that ends one round and a heading that starts the next are kept apart by a blank line', async () => {
  // Seen on the dev server 2026-11-15: "| [r1] |## What is listed most" when a table ended a round with one line break.
  const first = continuingRound({});
  first.content.unshift({ type: 'text', text: 'Found across the sites.\n', citations: null });
  const t = setup('answer', { client: replay([first, textMessage('## What is listed most')]).client });
  const answer = await t.run();
  const settled = answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join('');
  assert.equal(settled, 'Found across the sites.\n\n## What is listed most');
  assert.equal(streamed(t.events), settled);
});

test('a heading after a table in one round keeps its blank line in settled and streamed text', async () => {
  const text = '| Site | Listings |\n|---|---|\n| Depop | 18 [r1] |\n\n## What is listed most\n\nDepop has 18 [r1].';
  const held = await backedText(text, { ...result, rows: [{ site: 'depop', n: 18 }], counts: { depop: 18 } });
  const settled = held.answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join('');
  assert.doesNotMatch(settled, /\|[ \t]*## /, 'settled: a heading never joins a table row');
  assert.doesNotMatch(streamed(held.events), /\|## /, 'streamed: a heading never joins a table row');
  assert.match(settled, /\|\n\n## What is listed most/);
});

test('the gate checks a sentence against a 3000-row seeded search in well under a second', async () => {
  // Measured 2026-11-15: the claim gate's contradiction check was cubic in the cited figures and froze the server.
  const rows = Array.from({ length: 3000 }, (_, i) => ({ price: '$' + (i + 1), price_cents: (i + 1) * 100, title: 'Jacket ' + i }));
  const started = performance.now();
  const kept = await backedText('It costs $129 [r1].', { ...result, rows, counts: { listings: 3000 } });
  const cut = await backedText('It costs $9999 [r1].', { ...result, rows, counts: { listings: 3000 } });
  assert.ok(performance.now() - started < 1000, 'gating must stay linear in the cited figures');
  assert.equal(kept.answer.gate.cut, 0);
  assert.equal(cut.answer.gate.cut, 1);
});

test('equal-figure gate keeps a clean cited price and sold count whole', async () => {
  const text = 'It costs $129 with 11 sold [r1].';
  const kept = await backedText(text, { ...result, rows: [{ price: '$129', price_cents: 12900 }], counts: { sold: 11 } });
  assert.equal(prose(kept.answer), text);
  assert.equal(streamed(kept.events), text);
  assert.equal(kept.answer.gate.cut, 0);
});

test('equal-figure gate keeps a cited list item and cuts only its invented sibling', async () => {
  const text = 'Prices in US dollars:\n- New: $139 [r1]\n- Used: $129 [r1]';
  const returned = { ...result, rows: [{ price: '$129' }], counts: {} };
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, ['- New: $139 [r1]']);
  assert.equal(prose(held.answer), 'Prices in US dollars:\n\n- Used: $129 [r1]');
  const clean = 'Prices in US dollars:\n\n- New: $129 [r1]';
  assert.equal(prose((await backedText(clean, returned)).answer), clean);
});

test('equal-figure gate accepts equal digits across currency words', async () => {
  const text = '400 Canadian dollars [r1].';
  assert.equal(prose((await backedText(text, { ...result, rows: [{ price: 'USD 400' }] })).answer), text);
});

test('equal-figure gate requires a citation even for returned numbers and person counts', async () => {
  for (const text of ['It costs $45.', 'You have 3 items.', 'In 2026.', 'about 2 weeks.']) {
    const held = await backedText(text, result, text);
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
  }
});

test('equal-figure gate cannot borrow another result or another sentence citation', async () => {
  const text = 'It costs $400 [r1]. It costs $120 [r2]. It costs $120.';
  const t = setup('answer', { client: replay([fixture('parallel')[0], textMessage(text)]).client });
  t.options.tools.run = async name => ({ ...result, rows: [{ price: name === 'search_market' ? '$120' : '$400' }], counts: {} });
  const answer = await t.run();
  assert.equal(answer.gate.cut, 3);
  assert.equal(streamed(t.events), '');
});

for (const spelling of ['1,299', '1 299', '1299.00', '1.299k', 'one thousand two hundred and ninety-nine']) {
  test(`equal-figure gate expands ${spelling} and preserves its display`, async () => {
    const text = `${spelling} [r1].`;
    const kept = await backedText(text, { ...result, rows: [{ price_cents: 129900 }] });
    assert.equal(prose(kept.answer), text);
    assert.equal(streamed(kept.events), text);
  });
}

test('equal-figure gate reads counts, basis, ISO and written date parts from the cited result', async () => {
  const text = '11 sold over 90 days as of November 14, 2026 [r1]. 2026-11-14 [r1]. 129900 [r1].';
  const returned = { ...result, rows: [{ price_cents: 129900 }], counts: { sold: 11 }, basis: 'over 90 days', as_of: '2026-11-14' };
  assert.equal(prose((await backedText(text, returned)).answer), text);
});

test('equal-figure gate checks numbered headers independently and includes them in each row', async () => {
  const text = 'Prices for 400 items:\n- Used: 120 [r1]\nClean prose.';
  const held = await backedText(text, { ...result, rows: [{ price: '$120' }], counts: {} });
  assert.deepEqual(held.answer.gate.cut_sentences, ['Prices for 400 items:', '- Used: 120 [r1]']);
  assert.equal(prose(held.answer), 'Clean prose.');
});

for (const text of [
  '## Prices\n- New: 400\n- Used: 120 [r1]',
  '| Condition | Price |\n| --- | --- |\n| New | 400 |\n| Used | 120 [r1] |',
]) test(`equal-figure gate separates markdown rows: ${text.split('\n')[0]}`, async () => {
  const held = await backedText(text, { ...result, rows: [{ price: '$120' }], counts: {} });
  assert.equal(held.answer.gate.cut, 1);
  assert.doesNotMatch(prose(held.answer), /400/);
  assert.match(prose(held.answer), /120 \[r1\]/);
});

test('equal-figure gate ordinals require a cited row title', async () => {
  for (const title of ['The 21st edition', 'The twenty-first edition']) {
    const text = `${title} [r1].`;
    assert.equal(prose((await backedText(text, { ...result, rows: [{ title }], counts: {} })).answer), text);
    assert.equal((await backedText(text, { ...result, rows: [{ price: '$21' }], counts: { edition: 21 } })).answer.gate.cut, 1);
  }
});

for (const [words, value] of [
  ['four hundred new', 400], ['a dozen', 12], ['a couple hundred', 200], ['mid-300s', 300],
  ['zero', 0], ['one and a half', 1.5], ['forty thousand', 40000], ['1.2m', 1200000],
] as const) test(`equal-figure gate backs the full phrase ${words}`, async () => {
  const text = `${words} [r1].`;
  const returned = { ...result, rows: [{ value }], counts: {}, basis: '', as_of: '' };
  assert.equal(prose((await backedText(text, returned)).answer), text);
  const held = await backedText(text, { ...returned, rows: [{ value: value + 1 }] });
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
});

for (const digits of ['４００', '٤٠٠', '۴۰۰', '४००', '৪০০', '๔๐๐', '၄၀၀', '𞥔𞥐𞥐', '𝟜𝟘𝟘']) {
  test(`equal-figure gate normalizes Nd digits ${digits} on both sides`, async () => {
    const text = `It costs **${digits}** ZAR [r1].`;
    const returned = { ...result, rows: [{ value: '４\u200b００' }], counts: {} };
    assert.equal(prose((await backedText(text, returned)).answer), text);
    const held = await backedText(text, { ...returned, rows: [{ value: 401 }] });
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
  });
}

for (const minus of ['−', '–', '—', '﹣', '－']) test(`equal-figure gate preserves the sign of ${minus}400`, async () => {
  const text = `${minus}400 [r1].`;
  const returned = { ...result, rows: [{ value: -400 }], counts: {} };
  assert.equal(prose((await backedText(text, returned)).answer), text);
  assert.equal((await backedText(text, { ...returned, rows: [{ value: 400 }] })).answer.gate.cut, 1);
});

test('equal-figure gate inherits header citations and checks whole list items', async () => {
  const returned = { ...result, rows: [{ price: '$129' }], counts: {} };
  const text = 'Prices [r1]:\n- New: 129. Available now.\n- Used: 139. Check this row.';
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, ['- Used: 139. Check this row.']);
  assert.equal(prose(held.answer), 'Prices [r1]:\n\n- New: 129. Available now.');
  assert.equal(streamed(held.events), 'Prices [r1]:\n\n- New: 129. Available now.\n');
});

test('equal-figure gate can cite multiple results in one sentence without pooling other results', async () => {
  const clean = 'Asks are 120 [r1] and sold are 400 [r2].';
  const bad = 'Asks are 120 and 400 [r1].';
  const t = setup('answer', { client: replay([fixture('parallel')[0], textMessage(`${clean} ${bad}`)]).client });
  t.options.tools.run = async name => ({ ...result, rows: [{ price: name === 'search_market' ? '$120' : '$400' }], counts: {} });
  const answer = await t.run();
  assert.equal(prose(answer), clean);
  assert.deepEqual(answer.gate.cut_sentences, [bad]);
});

for (const text of ['November 14th, 2026 [r1].', '14th November 2026 [r1].']) {
  test(`equal-figure gate treats written date ordinals as date parts: ${text}`, async () => {
    const returned = { ...result, rows: [], counts: {}, as_of: '2026-11-14', basis: '' };
    assert.equal(prose((await backedText(text, returned)).answer), text);
    assert.equal((await backedText(text, { ...returned, as_of: '2026-11-13' })).answer.gate.cut, 1);
  });
}

test('equal-figure gate does not turn title years into money cents', async () => {
  const returned = { ...result, rows: [{ title: '2019 Nike shoes, $45' }], counts: {}, basis: '', as_of: '' };
  const text = 'There are 201900 listings [r1].';
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
  const clean = '4500 cents [r1].';
  assert.equal(prose((await backedText(clean, returned)).answer), clean);
});

test('equal-figure gate cannot back a different title number from a sold count', async () => {
  const returned = { ...result, rows: [{ title: 'Air Jordan 2' }], counts: { sold: 1 }, basis: '', as_of: '' };
  const text = 'Air Jordan 1 [r1].';
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
  const clean = 'Air Jordan 2 [r1].';
  assert.equal(prose((await backedText(clean, returned)).answer), clean);
});

test('equal-figure gate compares a decimal number phrase as its full value', async () => {
  const returned = { ...result, rows: [{ left: 4, right: 5 }], counts: {}, basis: '', as_of: '' };
  const text = 'The score is four point five [r1].';
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
  assert.equal(prose((await backedText(text, { ...returned, rows: [{ score: 4.5 }] })).answer), text);
});

test('equal-figure gate cannot borrow the model number from a different row title', async () => {
  const returned = { ...result, rows: [{ title: 'Air Jordan 2' }, { title: 'Reebok 1' }], counts: {}, basis: '', as_of: '' };
  const text = 'Air Jordan 1 [r1].';
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  const honest = { ...returned, rows: [...returned.rows, { title: 'Air Jordan 1' }] };
  assert.equal(prose((await backedText(text, honest)).answer), text);
});

test('equal-figure gate numeric-only titles do not turn citations into claims', async () => {
  const returned = { ...result, rows: [{ title: '1984', price: '$129' }], counts: {}, basis: '', as_of: '' };
  const text = 'Available now [r1].';
  const kept = await backedText(text, returned);
  assert.equal(prose(kept.answer), text);
  assert.equal(kept.answer.gate.checked, 0);
  assert.equal(prose((await backedText('129 [r1].', returned)).answer), '129 [r1].');
});

for (const title of ['Air Jordan 2 Retro', 'Nike Air Jordan 2 Retro', 'Nike Air Jordan two Retro']) {
  test(`equal-figure gate checks title numbers when the answer shortens ${title}`, async () => {
    const returned = { ...result, rows: [{ title }, { title: 'Reebok 1' }], counts: { sold: 1 }, basis: '', as_of: '' };
    const text = 'Air Jordan 1 [r1].';
    assert.deepEqual((await backedText(text, returned)).answer.gate.cut_sentences, [text]);
    assert.equal(prose((await backedText('Air Jordan 2 [r1].', returned)).answer), 'Air Jordan 2 [r1].');
  });
}

for (const title of ['2019 Nike shoes', '2019 Nike shoes Retro']) {
  test(`equal-figure gate checks leading title years in ${title}`, async () => {
    const returned = { ...result, rows: [{ title }, { title: '2020 Adidas shoes' }], counts: { sold: 2020 }, basis: '', as_of: '' };
    const text = '2020 Nike shoes [r1].';
    assert.deepEqual((await backedText(text, returned)).answer.gate.cut_sentences, [text]);
    assert.equal(prose((await backedText('2019 Nike shoes [r1].', returned)).answer), '2019 Nike shoes [r1].');
  });
}

test('equal-figure gate checks every figure in a title with adjacent numbers', async () => {
  const returned = { ...result, rows: [{ title: 'Air Jordan 2/2019' }], counts: { sold: 2020 }, basis: '', as_of: '' };
  const text = 'Air Jordan 2/2020 [r1].';
  assert.deepEqual((await backedText(text, returned)).answer.gate.cut_sentences, [text]);
  assert.equal(prose((await backedText('Air Jordan 2/2019 [r1].', returned)).answer), 'Air Jordan 2/2019 [r1].');
});

for (const sign of ['minus', 'negative']) test(`equal-figure gate preserves the written sign ${sign}`, async () => {
  const text = `It costs ${sign} four hundred dollars [r1].`;
  const returned = { ...result, rows: [{ value: 400 }], counts: {}, basis: '', as_of: '' };
  assert.deepEqual((await backedText(text, returned)).answer.gate.cut_sentences, [text]);
  assert.equal(prose((await backedText(text, { ...returned, rows: [{ value: -400 }] })).answer), text);
});

test('equal-figure gate never takes only three digits from a four-digit space-separated figure', async () => {
  const text = 'The figures are 2 2019 [r1].';
  const returned = { ...result, rows: [{ left: 2201, right: 9 }], counts: {}, basis: '', as_of: '' };
  assert.deepEqual((await backedText(text, returned)).answer.gate.cut_sentences, [text]);
  assert.equal(prose((await backedText(text, { ...returned, rows: [{ left: 2, right: 2019 }] })).answer), text);
});

for (const sign of ['minus', 'negative']) test(`equal-figure gate keeps ${sign} before a currency symbol`, async () => {
  const text = `It costs ${sign} $400 [r1].`;
  const returned = { ...result, rows: [{ value: 400 }], counts: {}, basis: '', as_of: '' };
  assert.deepEqual((await backedText(text, returned)).answer.gate.cut_sentences, [text]);
  assert.equal(prose((await backedText(text, { ...returned, rows: [{ value: -400 }] })).answer), text);
});

for (const [words, value] of [['point five', 0.5], ['minus point five', -0.5]] as const) {
  test(`equal-figure gate reads the leading decimal phrase ${words}`, async () => {
    const text = `The ratio is ${words} [r1].`;
    const returned = { ...result, rows: [{ value: 5 }], counts: {}, basis: '', as_of: '' };
    assert.deepEqual((await backedText(text, returned)).answer.gate.cut_sentences, [text]);
    assert.equal(prose((await backedText(text, { ...returned, rows: [{ value }] })).answer), text);
  });
}
test('seed rows reach the first user message, back their price, and keep invented money cut', async () => {
  const recording = replay(fixture('numbers').slice(1));
  const t = setup('answer', { client: recording.client, seed: [result] });
  const answer = await t.run();
  assert.equal(prose(answer), 'It costs $45 [r1].');
  assert.equal(answer.gate.cut, 1);
  assert.equal(answer.results.r1.citation_ids[0], 'c1');
  assert.ok(JSON.stringify(recording.requests[0].messages).includes('r1'));
  assert.equal(answer.calls.length, 0);
});

test('queued late rows get a new id and one bounded round after end_turn', async () => {
  const messages = [fixture('answer')[0], fixture('numbers')[1]];
  messages[1].content = [{ type: 'text', text: 'The late listing costs $60 [r2]. It costs $999.', citations: null }];
  const recording = replay(messages);
  let receive: ((u: import('./tools.ts').LateUpdate) => void) | undefined;
  let off = 0;
  const t = setup('answer', { seed: [result], late: { on(fn) { receive = fn; return () => { off++; }; } } });
  t.options.client = { messages: { stream(p, o) {
    const stream = recording.client.messages.stream(p, o);
    return { on: stream.on, async finalMessage() {
      const m = await stream.finalMessage();
      if (recording.requests.length === 1) receive!({ result_id: 'job:first:late:1', site: 'ebay', rows: [{ id: 'late-row', citation_id: 'late-row', price_cents: 6000 }], sites_pending: [] });
      return m;
    } };
  } } };
  const answer = await t.run();
  assert.equal(recording.requests.length, 2);
  assert.ok(JSON.stringify(recording.requests[1].messages).includes('late result r2: ebay'));
  assert.equal(answer.results.r2.citation_ids[0], 'late-row');
  assert.ok(prose(answer).includes('$60'));
  assert.ok(!prose(answer).includes('$999'));
  assert.equal(off, 1);
  receive!({ result_id: 'after', site: 'ebay', rows: [], sites_pending: [] });
  assert.ok(t.sink.text().includes('assist.late.after_settle'));
});

test('late updates remain bounded by max_rounds and the cost cap', async () => {
  for (const limit of ['rounds', 'cost']) {
    let receive: ((u: import('./tools.ts').LateUpdate) => void) | undefined;
    const t = setup('answer', { max_rounds: limit === 'rounds' ? 1 : 6, max_cost_usd: limit === 'cost' ? 0.000001 : 1,
      late: { on(fn) { receive = fn; return () => {}; } } });
    const original = t.options.client;
    t.options.client = { messages: { stream(p, o) {
      receive!({ result_id: 'late', site: 'poshmark', rows: [], sites_pending: [] });
      return original.messages.stream(p, o);
    } } };
    const answer = await t.run();
    assert.equal(t.requests.length, 1);
    assert.equal(answer.reason, undefined);
    assert.deepEqual(t.requests[0].tool_choice, { type: 'none' });
  }
});

const sizeQuestion = () => ({ field: 'size', kind: 'pick_one', words: 'Which size?',
  options: ['Small', 'Medium', 'Large'].map((label, i) => ({ value: label.toLowerCase(), label, proposed: i === 1,
    cites: i === 1 ? ['r1'] : [], rests_on: i === 1 ? ['Most matching rows'] : [] })), other: false, why: 'value' });
function askMessage(input: unknown = sizeQuestion()): Message {
  const message = textMessage('');
  message.stop_reason = 'tool_use';
  message.content = [{ type: 'text', text: 'These match. ', citations: null },
    { type: 'tool_use', id: 'ask-size', name: 'ask_person', caller: { type: 'direct' }, input: input as Record<string, unknown> },
    { type: 'text', text: 'You can change your pick.', citations: null }];
  return message;
}

test('ambiguous sizes use the shared Ask in content order before the final answer round', async () => {
  const recording = replay([askMessage()]);
  const t = setup('answer', { ...recording, job_id: 'job_sizes', seed: [result], max_rounds: 2,
    tools: { defs: [], run: async () => { throw new Error('ask_person must stay in converse'); } } });
  const answer = await t.run();
  assert.equal(answer.state, 'answered');
  assert.equal(answer.reason, undefined);
  assert.equal(recording.requests.length, 1);
  assert.deepEqual(answer.blocks.map(b => b.type), ['text', 'ask', 'text']);
  const block = answer.blocks.find(b => b.type === 'ask');
  assert.ok(block?.type === 'ask');
  assert.equal(block.ask.id, 'q_job_sizes_size');
  assert.equal(block.ask.options[1].proposed, true);
  assert.deepEqual(block.ask.answer, { method: 'POST', path: '/v1/assist' });
  assert.deepEqual(t.events.filter(e => e.event === 'assist.tool').map(e => e.data.phase), ['start', 'end']);
  assert.ok(t.events.filter(e => e.event === 'assist.tool').every(e => !('input' in e.data)));
  assert.ok(recording.requests[0].tools?.some(tool => 'name' in tool && tool.name === 'ask_person'));
  const logged = t.sink.text();
  assert.ok(!logged.includes('Which size?'));
  assert.ok(!logged.includes('Most matching rows'));
  assert.ok(logged.includes(sha256Hex(JSON.stringify(sizeQuestion()))));
});

for (const cited of [false, true]) test(`an option with money ${cited ? 'backed by its cited result stays' : 'without a cited result is dropped'}`, async () => {
  const question = sizeQuestion();
  question.options[0] = { value: 'extra', label: '$40 more', proposed: false, rests_on: [], cites: cited ? ['r1'] : [] };
  const t = setup('answer', { job_id: 'job_money', seed: [{ ...result, rows: [{ price_cents: 4000 }] }],
    client: replay([askMessage(question)]).client });
  const answer = await t.run();
  const block = answer.blocks.find(b => b.type === 'ask');
  assert.ok(block?.type === 'ask');
  assert.equal(block.ask.options.some(option => option.label === '$40 more'), cited);
  assert.equal(answer.gate.cut, cited ? 0 : 1);
});

test('multiple proposed picks are cleared and a second ask gets a tool error', async () => {
  const question = sizeQuestion(); question.options[0].proposed = true;
  const message = askMessage(question);
  message.content.push({ type: 'tool_use', id: 'ask-again', name: 'ask_person', caller: { type: 'direct' }, input: sizeQuestion() });
  const t = setup('answer', { job_id: 'job_twice', client: replay([message]).client });
  const answer = await t.run();
  const blocks = answer.blocks.filter(b => b.type === 'ask');
  assert.equal(blocks.length, 1);
  assert.ok(blocks[0].ask.options.every(option => !option.proposed));
  assert.equal(answer.calls[1].ok, false);
  assert.equal(answer.results[answer.calls[1].id].reason, 'already_asked');
  assert.match(t.sink.text(), /multiple_proposed/);
});

test('markdown preserves bold after gating and cuts internal error sentences in stream and settled text', async () => {
  const text = '**These match.** Choose freely. It failed with not_connected. A call to search_market failed. Sold prices are not available here yet.';
  const t = setup('answer', { client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(prose(answer), '**These match.** Choose freely. Sold prices are not available here yet.');
  assert.equal(streamed(t.events), prose(answer));
  assert.equal(answer.gate.cut, 2);
});

test('a sentence containing an internal code drops its widget and every fragment, but widget names are not prose', async () => {
  const t = setup('answer', { seed: [{ ...result, widgets: ['price_trend'] }], client: replay([
    textMessage('The trend [price_trend:r1] is shown. It failed [price_trend:r1] with invalid_input. These match.'),
  ]).client });
  const answer = await t.run();
  assert.equal(answer.blocks.filter(b => b.type === 'widget').length, 1);
  assert.ok(!prose(answer).includes('failed'));
  assert.ok(!prose(answer).includes('invalid_input'));
  assert.equal(streamed(t.events), 'The trend  is shown. These match.');
  assert.equal(answer.gate.cut, 1);
});

test('ask words use turn results, reasons use only cited results, and too few surviving choices drop the ask', async () => {
  const question = sizeQuestion(); question.words = 'Is it worth $999?';
  let answer = await setup('answer', { job_id: 'job_gate', client: replay([askMessage(question)]).client }).run();
  assert.equal(answer.blocks.filter(b => b.type === 'ask').length, 0);
  assert.equal(answer.gate.cut, 1);
  question.words = 'Which size?'; question.options[0].rests_on = ['$999 less'];
  question.options[1].label = '$999 more'; question.options[2].label = '$999 more';
  answer = await setup('answer', { job_id: 'job_gate', client: replay([askMessage(question)]).client }).run();
  assert.equal(answer.blocks.filter(b => b.type === 'ask').length, 0);
  assert.equal(answer.gate.cut, 4, 'one reason, two options and the question were dropped');
});

for (const [cause, changes] of [
  ['long field', { field: 'x'.repeat(61) }], ['long words', { words: 'x'.repeat(201) }],
  ['unknown why', { why: 'guess' }], ['extra property', { extra: 'unknown' }],
  ['too many options', { options: Array.from({ length: 9 }, (_, i) => ({ value: String(i), label: 'Size', proposed: false, cites: [] })) }],
  ['long label', { options: [{ value: 's', label: 'x'.repeat(81), proposed: false, cites: [] }] }],
  ['long value', { options: [{ value: 'x'.repeat(81), label: 'Small', proposed: false, cites: [] }] }],
  ['long reason', { options: [{ value: 's', label: 'Small', proposed: false, cites: [], rests_on: ['x'.repeat(201)] }] }],
  ['missing text limit', { kind: 'text' }], ['missing unit', { kind: 'number_with_unit' }],
] as const) test(`ask_person rejects ${cause} without running an outside tool`, async () => {
  const t = setup('answer', { job_id: 'job_invalid', client: replay([askMessage({ ...sizeQuestion(), ...changes })]).client });
  const answer = await t.run();
  assert.equal(answer.blocks.filter(b => b.type === 'ask').length, 0);
  assert.equal(answer.calls[0].ok, false);
  assert.equal(answer.gate.cut, 1);
});

test('an ask can cite another tool in the current round, and its event settles after the gate', async () => {
  const question = sizeQuestion(); question.options[0].label = '$40 more'; question.options[0].cites = ['r2'];
  const message = askMessage(question);
  message.content.push({ type: 'tool_use', id: 'lookup', name: 'value_item', caller: { type: 'direct' }, input: { query: 'jacket' } });
  const t = setup('answer', { job_id: 'job_round', client: replay([message]).client });
  t.options.tools.run = async () => { await new Promise(resolve => setImmediate(resolve)); return { ...result, rows: [{ price_cents: 4000 }] }; };
  const answer = await t.run();
  const block = answer.blocks.find(b => b.type === 'ask'); assert.ok(block?.type === 'ask');
  assert.equal(block.ask.options[0].label, '$40 more');
  assert.equal(answer.calls[0].ok, true);
  assert.equal(answer.calls[0].counts.options, 3);
});

for (const token of ['not_connected', 'invalid_input', 'not_built', 'too_few', 'function_missing', 'signed_in_only', 'too_many_calls', 'already_asked',
  'search_market', 'value_item', 'price_trend', 'where_to_list', 'market_store', 'web_search', 'ask_person']) {
  test(`internal token ${token} is cut from streamed and settled sentences`, async () => {
    const t = setup('answer', { client: replay([textMessage(`It failed with '${token}'. These match.`)]).client });
    const answer = await t.run();
    assert.equal(streamed(t.events), 'These match.');
    assert.equal(prose(answer), 'These match.');
    assert.equal(answer.gate.cut, 1);
  });
}

test('round 4 widget aliases resolve to the first widget; unknown bracket tags never become prose', async () => {
  const t = setup('answer', { seed: [result], client: replay([textMessage('See [widget:r1]. Missing [widget:r5] and [unknown:r1].')]).client });
  const answer = await t.run();
  assert.deepEqual(answer.blocks.filter(b => b.type === 'widget'), [{ type: 'widget', widget: 'price_range', result_id: 'r1' }]);
  assert.doesNotMatch(prose(answer) + streamed(t.events), /\[[^\]]*:/);
  assert.equal(answer.gate.tags_removed, 2);
});

test('round 4 prompt leads with attached rows and limits web sources to words', () => {
  assert.match(SYSTEM, /lead with.*rows/i);
  assert.match(SYSTEM, /never open with a refusal/i);
  assert.match(SYSTEM, /different item/i);
  assert.match(SYSTEM, /web sources.*words.*never figures/i);
  assert.match(SYSTEM, /never.*sources heading/i);
  assert.match(SYSTEM, /never write an id/i);
  assert.doesNotMatch(SYSTEM, /writing \[widget:result_id\]/);
});

test('round 4 drops an empty trailing sources heading after the gate cuts its contents', async () => {
  const t = setup('answer', { client: replay([textMessage('These match.\n\n**Sources:**\nIt costs $999.')]).client });
  const answer = await t.run();
  assert.equal(prose(answer), 'These match.');
  assert.equal(streamed(t.events).trim(), 'These match.');
});

for (const id of ['ls_dupe_dupe-de34e3be381e', 'job_search-private', 'summary:poshmark:abc', 'genie:abc']) {
  test(`round 4 cuts row or citation id ${id} after gating`, async () => {
    const t = setup('answer', { client: replay([textMessage(`These match. Pick (${id}).`)]).client });
    const answer = await t.run();
    assert.equal(prose(answer), 'These match.');
    assert.equal(streamed(t.events), 'These match. ');
  });
}

test('round 4 separate model rounds keep the same line break in streamed and settled text', async () => {
  const first = continuingRound({});
  first.content.unshift({ type: 'text', text: 'Found across the sites.', citations: null });
  const t = setup('answer', { client: replay([first, textMessage('- These are asking prices.')]).client });
  const answer = await t.run();
  assert.equal(answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join(''), 'Found across the sites.\n\n- These are asking prices.');
  assert.equal(streamed(t.events), 'Found across the sites.\n\n- These are asking prices.');
});

for (const limit of ['rounds', 'cost'] as const) test(`round 4 ${limit} limit reserves one tools-off answer from the results`, async () => {
  const first = continuingRound({ cost: limit === 'cost' ? 0.2 : 0.001 });
  const recording = replay([first, textMessage('There are 3 sold listings [r1].')]);
  const t = setup('answer', { seed: [result], client: recording.client,
    max_rounds: limit === 'rounds' ? 2 : 6, max_cost_usd: limit === 'cost' ? 0.25 : 1 });
  const answer = await t.run();
  assert.equal(recording.requests.length, 2);
  assert.deepEqual(recording.requests[1].tool_choice, { type: 'none' });
  assert.match(JSON.stringify(recording.requests[1].messages), /answer now.*results/i);
  assert.doesNotMatch(prose(answer), /stopped early/);
  assert.match(prose(answer), /3 sold listings/);
});

test('round 4 removes unknown and incomplete bracket tags as well as named kinds', async () => {
  const t = setup('answer', { client: replay([textMessage('These match. [price graph:r1] [weird-kind:r9]\n[widget:r5')]).client });
  const answer = await t.run();
  assert.doesNotMatch(prose(answer) + streamed(t.events), /\[/);
  assert.equal(answer.gate.tags_removed, 3);
});

test('round 4 malformed final response preserves its text in both stream and settled blocks', async () => {
  const final = continuingRound({});
  final.content.unshift({ type: 'text', text: 'These match.', citations: null });
  const t = setup('answer', { client: replay([final]).client, max_rounds: 1 });
  const answer = await t.run();
  assert.equal(answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join(''), streamed(t.events));
  assert.equal(streamed(t.events), 'These match.\nThe answer stopped early.');
});

test('round 4 a different item may still search when a search is attached', async () => {
  const first = fixture('one-tool')[0];
  first.content = [{ type: 'tool_use', id: 'different', name: 'search_market', input: { query: 'wool trousers' }, caller: { type: 'direct' } }];
  const t = setup('answer', { seed: [{ ...result, tool: 'search_market' }], search_query: 'carhartt detroit jacket',
    client: replay([first, textMessage('These match.')]).client });
  const queries: unknown[] = [];
  t.options.tools.run = async (_name, input) => { queries.push(input); return result; };
  await t.run();
  assert.deepEqual(queries, [{ query: 'wool trousers' }]);
});

test('round 4 a widget between model rounds still keeps the prose line break', async () => {
  const first = continuingRound({});
  first.content.unshift({ type: 'text', text: 'Found. [listings:r1]', citations: null });
  const t = setup('answer', { seed: [{ ...result, tool: 'search_market', widgets: ['listings'] }],
    client: replay([first, textMessage('Done.')]).client });
  const answer = await t.run();
  assert.equal(answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join(''), 'Found.\nDone.');
  assert.match(streamed(t.events), /Found\. *\nDone\./);
});

test('round 4 a malformed widget tag without its result id never becomes prose', async () => {
  const t = setup('answer', { client: replay([textMessage('These match. [widget] [listings]\n[widget')]).client });
  const answer = await t.run();
  assert.doesNotMatch(prose(answer) + streamed(t.events), /\[/);
  assert.equal(answer.gate.tags_removed, 3);
});

test('round 4 returned citation ids never become prose even when their dates are backed', async () => {
  const id = 'valuation:q_coat:all:2026-11-15T12:00:00Z';
  const t = setup('answer', { seed: [{ ...result, as_of: '2026-11-15T12:00:00Z', citation_ids: [id] }],
    client: replay([textMessage(`These match. Use ${id}.`)]).client });
  const answer = await t.run();
  assert.equal(prose(answer), 'These match.');
  assert.equal(streamed(t.events), 'These match. ');
});

for (const [words, value, unscaled] of [
  ['a grand', 1000, 400], ['grand', 1000, 400], ['two grand', 2000, 2],
  ['twelve grand', 12000, 12], ['12 grand', 12000, 12], ['1.5 grand', 1500, 1.5],
  ['minus two grand', -2000, 2000], ['-2 grand', -2000, 2000],
  ['zero grand', 0, 1000], ['two point five grand', 2500, 2.5],
] as const) {
  test(`equal-figure gate reads ${words} as its full thousand-scaled value`, async () => {
    const text = `It is worth ${words} [r1].`;
    const returned = { ...result, rows: [{ value: unscaled }], counts: {}, basis: '', as_of: '' };
    const held = await backedText(text, returned);
    assert.deepEqual(held.answer.gate.cut_sentences, [text], 'an unscaled figure cannot back grand');
    assert.equal(streamed(held.events), '', 'unbacked grand must not stream');
    const kept = await backedText(text, { ...returned, rows: [{ value }] });
    assert.equal(kept.answer.gate.cut, 0);
    assert.equal(prose(kept.answer), text);
    assert.equal(streamed(kept.events), text);
  });
}

test('numerals separate adjacent number-word claims instead of joining their values', async () => {
  const text = 'The sequence is one 2 three [r1].';
  const returned = { ...result, rows: [{ value: 4, middle: 2 }], counts: {}, basis: '', as_of: '' };
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
  const kept = await backedText(text, { ...returned, rows: [{ first: 1, middle: 2, last: 3 }] });
  assert.equal(prose(kept.answer), text);
  assert.equal(streamed(kept.events), text);
});

test('decimal number words with grand cannot borrow separate coefficient and scale facts', async () => {
  const text = 'It is worth two point five grand [r1].';
  const returned = { ...result, rows: [{ value: 2.5, scale: 1000 }], counts: {}, basis: '', as_of: '' };
  const held = await backedText(text, returned);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
});

// Nate, 14:59 UTC: "add headers, tables, and such, like claude in chat".
test('round 5 prompt names the supported markdown and row citations', () => {
  assert.match(SYSTEM, /## /);
  assert.match(SYSTEM, /- /);
  assert.match(SYSTEM, /\*\*bold\*\*/);
  assert.match(SYSTEM, /\|---\|/);
  assert.match(SYSTEM, /citation \[rN\] in (?:each|the) row/);
  assert.doesNotMatch(SYSTEM, /plain sentences.*no markdown/);
});

for (const [name, text, expected] of [
  ['single heading', 'Intro.\n# Picks\nThese match.', 'Intro.\n\n## Picks\nThese match.'],
  ['deep heading', 'Intro.\n### Picks\nThese match.', 'Intro.\n\n## Picks\nThese match.'],
  ['star list', 'Intro.\n* These match.', 'Intro.\n\n- These match.'],
  ['plus list', 'Intro.\n+ These match.', 'Intro.\n\n- These match.'],
  ['numbered list', 'Intro.\n1. These match.', 'Intro.\n\n- These match.'],
  ['unclosed bold', 'These **match.', 'These match.'],
  ['closed bold', 'These **match**.', 'These **match**.'],
  ['heading spacing', 'Intro.\n## Picks', 'Intro.\n\n## Picks'],
  ['list spacing', 'Intro.\n- These match.\n- Choose freely.', 'Intro.\n\n- These match.\n- Choose freely.'],
  ['missing separator', 'Intro.\n| Site | Ask |\n| Mercari | 45 [r1] |', 'Intro.\n\n| Site | Ask |\n|---|---|\n| Mercari | 45 [r1] |'],
  ['short row', '| Site | Ask | Basis |\n|---|---|---|\n| Mercari | 45 [r1] |', '| Site | Ask | Basis |\n|---|---|---|\n| Mercari | 45 [r1] |  |'],
  ['long row', '| Site | Ask |\n|---|---|\n| Mercari | 45 | asking [r1] |', '| Site | Ask |\n|---|---|\n| Mercari | 45 / asking [r1] |'],
] as const) test(`round 5 normalizes ${name} after gating in stream and settled text`, async () => {
  const t = setup('answer', { seed: [result], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(prose(answer), expected);
  assert.equal(streamed(t.events), expected);
});

for (const bad of ['| Bad | 999 [r1] |', '| Bad | 45 |']) test(`round 5 cuts only the unbacked or uncited table row ${bad}`, async () => {
  const text = `| Site | Median ask ($) |\n|---|---|\n| Mercari | 45 [r1] |\n${bad}\n| Poshmark | 45 [r1] |`;
  const t = setup('answer', { seed: [result], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(answer.gate.cut, 1);
  assert.equal(prose(answer), text.replace(`${bad}\n`, ''));
  assert.equal(streamed(t.events), prose(answer));
});

test('round 5 header citations cannot back any body row and an empty table disappears', async () => {
  const text = 'Intro.\n| Site [r1] | Ask |\n|---|---|\n| Mercari | 45 |\n| Poshmark | 45 |';
  const t = setup('answer', { seed: [result], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(answer.gate.cut, 2);
  assert.equal(prose(answer), 'Intro.');
  assert.equal(streamed(t.events).trim(), 'Intro.');
});

test('round 5 a table row can cite separate results for separate cells', async () => {
  const text = '| Site | Ask | Sold |\n|---|---|---|\n| Mercari | 45 [r1] | 17 [r2] |';
  const t = setup('answer', { seed: [result, { ...result, counts: { sold: 17 } }], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(answer.gate.cut, 0);
  assert.equal(prose(answer), text);
  assert.equal(streamed(t.events), text);
});

for (const header of ['Asks in 2026', 'Asks in 2026 [r1]']) test(`round 5 checks table header independently: ${header}`, async () => {
  const text = `| Site | ${header} |\n|---|---|\n| Mercari | 45 [r1] |`;
  const t = setup('answer', { seed: [result], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  if (header.includes('[r1]')) assert.equal(prose(answer), text);
  else {
    assert.ok(answer.gate.cut > 0);
    assert.equal(prose(answer), '');
    assert.equal(streamed(t.events), '');
  }
});

test('round 5 lists inherit their nearest heading and cannot use its citation for a missing figure', async () => {
  const text = '## Asks in 2026 [r1]\n- 45 [r1]\n- 999 [r1]';
  const t = setup('answer', { seed: [result], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(prose(answer), '## Asks in 2026 [r1]\n\n- 45 [r1]');
  assert.equal(streamed(t.events).trimEnd(), prose(answer));
  assert.equal(answer.gate.cut, 1);
});

test('round 5 streams table header only beside its first kept row and no rejected body', async () => {
  const text = 'Intro.\n| Site | Ask |\n|---|---|\n| Bad | 999 [r1] |\n| Mercari | 45 [r1] |\n| Poshmark | 45 [r1] |';
  const t = setup('answer', { seed: [result], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  const deltas = t.events.flatMap(event => event.event === 'assist.text' ? [event.data.delta] : []);
  const firstTable = deltas.find(delta => delta.includes('| Site |'));
  assert.ok(firstTable?.includes('|---|---|\n| Mercari | 45 [r1] |'));
  assert.ok(deltas.every(delta => !delta.includes('999')));
  assert.equal(streamed(t.events).match(/\| Mercari \|/g)?.length, 1);
  assert.equal(streamed(t.events).match(/\| Poshmark \|/g)?.length, 1);
  assert.equal(streamed(t.events), prose(answer));
});

test('round 5 markdown preserves round 4 privacy, widgets, total counts and round breaks', async () => {
  const first = continuingRound({});
  first.content.unshift({ type: 'text', text: '## Found\n**307** listings [r1].\n- not_connected\n- search_market\n- ls_private\n[widget:r1]', citations: null });
  const text = '| Site | Listings |\n|---|---|\n| Mercari | **307** [r1] |\n| Private | ls_private |';
  const t = setup('answer', { seed: [{ ...result, counts: { rows: 307 } }], client: replay([first, textMessage(text)]).client });
  const answer = await t.run();
  const visible = streamed(t.events);
  assert.match(visible, /\*\*307\*\*/);
  assert.doesNotMatch(visible + prose(answer), /not_connected|search_market|ls_private|\[widget:/);
  assert.match(visible, /\n\n\| Site/);
  assert.equal(answer.blocks.filter(block => block.type === 'widget').length, 1);
});

test('round 5 a complete gated table row streams before the model finishes', async () => {
  const events: AssistEvent[] = [];
  const rows = ['| Site | Ask |\n', '|---|---|\n', '| Bad | 999 [r1] |\n', '| Mercari | 45 [r1] |\n', '| Poshmark | 45 [r1] |\n'];
  let finished = false;
  const client: StreamClient = { messages: { stream() {
    let listener: ((delta: string) => void) | undefined;
    return { on(_event, fn) { listener = fn; }, async finalMessage() {
      for (const [i, row] of rows.entries()) {
        listener?.(row);
        await new Promise(resolve => setImmediate(resolve));
        if (i < 3) assert.equal(streamed(events), '', 'header and rejected rows must stay hidden');
        else assert.match(streamed(events), /Mercari/, 'the completed safe row must already be visible');
      }
      finished = true;
      return textMessage(rows.join(''));
    } };
  } } };
  const t = setup('answer', { seed: [result], client, onEvent: event => {
    if (event.event === 'assist.text') assert.equal(finished, false, 'all completed rows should stream before finalMessage resolves');
    events.push(event);
  } });
  const answer = await t.run();
  assert.equal(answer.state, 'answered');
  assert.equal(streamed(events).match(/\| Site \|/g)?.length, 1);
  assert.equal(streamed(events).match(/\| Mercari \|/g)?.length, 1);
  assert.equal(streamed(events).match(/\| Poshmark \|/g)?.length, 1);
  assert.equal(streamed(events).trimEnd(), prose(answer));
});

for (const header of ['| search_market | Ask |', '| Site ls_private | Ask |']) test(`round 5 an internal table header cannot promote a body row: ${header}`, async () => {
  const text = `${header}\n|---|---|\n| Mercari | 45 [r1] |\n| Poshmark | 45 [r1] |`;
  const t = setup('answer', { seed: [result], client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(prose(answer), '');
  assert.equal(streamed(t.events), '');
  assert.ok(answer.gate.cut > 0);
});

for (const text of ['Broken **opening.\n\nThese **match**.', 'Broken **opening. These **match**.']) test(`round 5 an earlier unclosed bold cannot break a later pair: ${text}`, async () => {
  const t = setup('answer', { client: replay([textMessage(text)]).client });
  const answer = await t.run();
  const expected = text.replace('Broken **opening.', 'Broken opening.');
  assert.equal(prose(answer), expected);
  assert.equal(streamed(t.events), expected);
});

test('round 5 failed model streams finish pending table checks before settling', async () => {
  const events: AssistEvent[] = [];
  const client: StreamClient = { messages: { stream() {
    let listener: ((delta: string) => void) | undefined;
    return { on(_event, fn) { listener = fn; }, async finalMessage() {
      listener?.('| Site | Ask |\n|---|---|\n| Mercari | 45 [r1] |\n');
      throw new Error('model stream failed');
    } };
  } } };
  const t = setup('answer', { seed: [result], client, onEvent: event => events.push(event) });
  const answer = await t.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(answer.state, 'failed');
  assert.equal(events.at(-1)?.event, 'assist.settled');
  assert.equal(streamed(events), '', 'pending preview must not publish after model failure');
});

test('round 5 a table publication error is handled by the turn failure path', async () => {
  const client: StreamClient = { messages: { stream() {
    let listener: ((delta: string) => void) | undefined;
    return { on(_event, fn) { listener = fn; }, async finalMessage() {
      const text = '| Site | Ask |\n|---|---|\n| Mercari | 45 [r1] |\n';
      listener?.(text);
      await new Promise(resolve => setImmediate(resolve));
      return textMessage(text);
    } };
  } } };
  const t = setup('answer', { seed: [result], client, onEvent: event => {
    if (event.event === 'assist.text') throw new Error('event sink failed');
  } });
  const answer = await t.run();
  assert.equal(answer.state, 'failed');
  assert.match(t.sink.text(), /event sink failed/);
});
