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

const fixture = (name: string): Message[] => JSON.parse(readFileSync(new URL(`./fixtures/converse/${name}.json`, import.meta.url), 'utf8'));
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
    text: 'Find a wool jacket', effort: 'low', model: 'claude-sonnet-5-5', client: recording.client,
    tools: { defs: [{ name: 'value_item', description: 'Value an item', input_schema: { type: 'object' }, strict: true }],
      run: async () => structuredClone(result) },
    log: createLog({ src: 'test.assist', build: 'test', sink }), signal: new AbortController().signal,
    now: () => clock++, onEvent: event => events.push(event), ...overrides,
  };
  return { ...recording, sink, events, options, run: () => converse(options) };
}

const prose = (answer: Awaited<ReturnType<typeof converse>>) => answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join(' ');

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

test('an invented $999 sentence is cut while the tool-backed $45 sentence stays', async () => {
  const t = setup('numbers');
  const answer = await t.run();
  assert.equal(prose(answer), 'It costs $45.');
  assert.equal(answer.gate.checked, 2);
  assert.equal(answer.gate.cut, 1);
  assert.deepEqual(answer.gate.cut_sentences, ['It costs $999.']);
});

test('number normalization preserves money variants, shares, bare decimals, negation and standalone years', async () => {
  const t = setup('normalization');
  t.options.tools.run = async () => ({ ...result, rows: [{ price_cents: 129900, score: 4.5, sold_share: 0.12 }], counts: { sold: 3 } });
  const answer = await t.run();
  assert.equal(answer.gate.cut, 1);
  assert.deepEqual(answer.gate.cut_sentences, ['The rating is 4.']);
  for (const s of ['$1,299.', '$1,299.00.', '1299 dollars.', '12%.', '4.5.', 'not enough data: 3 listings.', 'In 2026.']) assert.ok(prose(answer).includes(s), s);
});

test('money and percent strings back their normalized claims, but money cannot borrow a bare count', async () => {
  const t = setup('normalization');
  t.options.tools.run = async () => ({ ...result, rows: [{ price: '$1,299.00', share: '12%', score: 4.5 }], counts: { sold: 3 } });
  assert.equal((await t.run()).gate.cut, 1);
  const bare = setup('numbers');
  bare.options.tools.run = async () => ({ ...result, rows: [{ count: 45 }], counts: {} });
  assert.equal((await bare.run()).gate.cut, 2);
});

test('numbers attached to units are gated, and only standalone years are exempt', async () => {
  const answer = await setup('attached-units', { text: 'I measured 4.5 cm' }).run();
  assert.deepEqual(answer.gate.cut_sentences, ['The length is 999cm.', 'The length is 2026cm.']);
  assert.equal(prose(answer), 'The length is 4.5cm. In 2026.');
});

test('a number in this turn’s own text passes, while history alone supplies no facts', async () => {
  const t = setup('numbers', { text: 'My budget is $45', history: [{ role: 'user', content: 'I saw $999 before' }] });
  t.options.tools.run = async () => ({ ...result, rows: [], counts: {} });
  assert.equal((await t.run()).gate.cut, 1);
  assert.deepEqual(t.requests[0].messages[0], t.options.history?.[0]);
});

test('a web citation cited_text backs a number; sources retain indexes and dates', async () => {
  const t = setup('citation');
  const answer = await t.run();
  assert.equal(answer.gate.cut, 0);
  assert.match(prose(answer), /73%/);
  assert.deepEqual(answer.sources, [{ url: 'https://example.org/report', title: 'Audience report', page_age: 'November 2026' }]);
  assert.deepEqual(answer.blocks.find(b => b.type === 'text' && b.text.includes('73%')), {
    type: 'text', text: 'The report found 73%.', web_sources: [0],
  });
  assert.ok(answer.blocks.some(b => b.type === 'widget' && b.result_id === 'web'));
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

test('usage sums rounds and provider cost wins over the price table, including zero', async () => {
  const t = setup('usage');
  const answer = await t.run();
  assert.deepEqual(answer.usage, {
    input_tokens: 300, output_tokens: 30, cache_read_input_tokens: 150, web_searches: 2,
    cost_usd: 0.003, cost_source: 'provider',
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
  assert.equal(answer.reason, 'provider offline');
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
