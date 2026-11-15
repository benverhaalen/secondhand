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
  assert.equal(last?.type === 'text' && last.text, 'Finished.');
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

test('this turn backs counts, while money and history alone supply no facts', async () => {
  const t = setup('numbers', { text: 'My budget is $45', history: [{ role: 'user', content: 'I saw $999 before' }] });
  t.options.tools.run = async () => ({ ...result, rows: [], counts: {} });
  assert.equal((await t.run()).gate.cut, 2);
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

test('years need facts outside date context, and date context cannot exempt unit quantities', async () => {
  const { answer } = await backedText('There are 2026 listings. In 2026. Since 2026. By 2026. From 2026. Until 2026. Of 2026. November 2026. In 2026 listings. November 2026 dollars.');
  assert.deepEqual(answer.gate.cut_sentences, ['There are 2026 listings.', 'In 2026 listings.', 'November 2026 dollars.']);
  const clean = await backedText('There are 2026 listings.', { ...result, counts: { listings: 2026 } });
  assert.equal(clean.answer.gate.cut, 0);
});

test('percent, per cent and USD normalize without borrowing counts', async () => {
  for (const spelling of ['percent', 'per cent', '%']) {
    const { answer } = await backedText(`The share is 12 ${spelling}. The share is 13 ${spelling}.`, { ...result, rows: [{ sold_share: 0.12 }], counts: { listed: 13 } });
    assert.equal(answer.gate.cut, 1, spelling);
    assert.match(prose(answer), /12/);
    assert.ok(!prose(answer).includes('13'));
  }
  const { answer } = await backedText('It costs 45 USD. It costs 46 USD.');
  assert.equal(answer.gate.cut, 1);
  assert.equal(prose(answer), 'It costs 45 USD.');
});

test('ISO dates and timestamps are whole tokens backed only by result dates or today', async () => {
  for (const key of ['as_of', 'sold_at', 'listed_at', 'read_at']) {
    const returned = key === 'as_of' ? { ...result, as_of: '2026-11-14' }
      : { ...result, rows: [{ [key]: '2026-11-14T12:30:00Z' }] };
    const { answer } = await backedText('Read on 2026-11-14. Read on 2026-11-13.', returned);
    assert.equal(answer.gate.cut, 1, key);
    assert.equal(prose(answer), 'Read on 2026-11-14.');
  }
  const recording = replay([textMessage('Today is 2026-11-15. Next is 2026-11-16.')]);
  const t = setup('answer', { client: recording.client, now: () => Date.parse('2026-11-15T20:00:00Z'), text: 'My note says 2026-11-16' });
  assert.equal(prose(await t.run()), 'Today is 2026-11-15. Next is 2026-11-16.');
  const timestamp = await backedText('Read at 2026-11-14T12:30:00Z. Read at 2026-11-14T13:30:00Z.', { ...result, rows: [{ read_at: '2026-11-14T12:30:00Z' }] });
  assert.equal(timestamp.answer.gate.cut, 1);
  assert.equal(prose(timestamp.answer), 'Read at 2026-11-14T12:30:00Z.');
});

test('only successful cited rows and top-level figures back money and percentages, never inputs or counts', async () => {
  for (const patch of [{ citation_ids: [] }, { ok: false }]) {
    const { answer } = await backedText('It costs $45.', { ...result, ...patch });
    assert.equal(answer.gate.cut, 1);
  }
  assert.equal((await backedText('It costs $45.')).answer.gate.cut, 0);
  const echoed = Object.assign({ ...result, rows: [], counts: { price_cents: 4500, sold_share: 0.12 } }, { input: { price_cents: 4500, sold_share: 0.12 } });
  assert.equal((await backedText('It costs $45. The share is 12%.', echoed)).answer.gate.cut, 2);
  const topLevel = Object.assign({ ...result, rows: [] }, { price_cents: 4500, sold_share: 0.12 });
  assert.equal((await backedText('It costs $45. The share is 12%.', topLevel)).answer.gate.cut, 0);
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
    assert.equal((await backedText('It costs $45.', returned)).answer.gate.cut, 1);
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

for (const join of ['-', '–', ' to ']) test(`money range joined by ${join} cannot borrow its upper end from a count`, async () => {
  const text = `Most sell for $85${join}120.`;
  const low = { ...result, rows: [{ price_cents: 8500 }], counts: { sold: 120 } };
  const held = await backedText(text, low);
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.ok(!streamed(held.events).includes('120'));
  const backed = await backedText(text, { ...low, rows: [...low.rows, { price_cents: 12000 }] });
  assert.equal(backed.answer.gate.cut, 0);
  assert.equal(prose(backed.answer), text);
});

test('person text backs only counts and valid dates, never money or percentages', async () => {
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
  assert.equal((await t.run()).gate.cut, 0);
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

test('non-finite accumulated cost reaches the cap', async () => {
  const recording = replay(Array.from({ length: 6 }, () => continuingRound({ output_tokens: NaN })));
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 1);
  assert.equal(answer.reason, 'cost_cap');
});

test('cache creation costs 1.25 times input pricing and counts toward the cap', async () => {
  const recording = replay(Array.from({ length: 6 }, () => continuingRound({
    input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 100000,
  })));
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 1);
  assert.equal(answer.reason, 'cost_cap');
  assert.equal(answer.usage.cost_usd, 0.25);
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
  test(`unbacked ${spelling} cannot borrow a plain count`, async () => {
    const { answer, events } = await backedText(`It costs ${spelling}.`, { ...result, rows: [], counts: { sold: 412 } });
    // A glued plain count still needs evidence, unlike a currency figure.
    if (spelling === 'approx412') {
      assert.equal(answer.gate.checked, 1);
      assert.equal(answer.gate.cut, 0);
      assert.equal((await backedText(`It costs ${spelling}.`)).answer.gate.cut, 1);
    } else {
      assert.equal(answer.gate.cut, 1);
      assert.ok(!streamed(events).includes('412'));
    }
  });
}

test('currency spellings match cited figures only in their own unit', async () => {
  const usd = { ...result, rows: [{ price_cents: 41200 }] };
  for (const spelling of ['USD 412', 'USD412', 'US$412', '412 bucks']) {
    assert.equal((await backedText(`It costs ${spelling}.`, usd)).answer.gate.cut, 0, spelling);
  }
  for (const symbol of ['€', '£']) {
    assert.equal((await backedText(`It costs ${symbol}412.`, usd)).answer.gate.cut, 1, symbol);
    const matching = { ...result, rows: [{ price: `${symbol}412` }] };
    assert.equal((await backedText(`It costs ${symbol}412.`, matching)).answer.gate.cut, 0, symbol);
    const other = { ...result, rows: [{ price: `${symbol === '€' ? '£' : '€'}412` }] };
    assert.equal((await backedText(`It costs ${symbol}412.`, other)).answer.gate.cut, 1, symbol);
  }
});

for (const [label, count] of [['4k', 4], ['32x32', 32]] as const) {
  test(`${label} keeps its current count matching`, async () => {
    const text = `The size is ${label}.`;
    assert.equal((await backedText(text, { ...result, counts: { size: count } })).answer.gate.cut, 0);
    assert.equal((await backedText(text, { ...result, counts: {} })).answer.gate.cut, 1);
  });
}

test('month-first and day-first dates match a whole result date', async () => {
  const returned = { ...result, rows: [{ sold_at: '2026-11-15' }] };
  const { answer } = await backedText('Sold November 15, 2026. Sold 15 November 2026. Sold November 14, 2026.', returned);
  assert.equal(answer.gate.checked, 3);
  assert.deepEqual(answer.gate.cut_sentences, ['Sold November 14, 2026.']);
  assert.equal(prose(answer), 'Sold November 15, 2026. Sold 15 November 2026.');
});

test('today accepts UTC and UTC-12 dates without accepting tomorrow', async () => {
  const recording = replay([textMessage('Today is 2026-11-14. Today is 2026-11-15. Today is 2026-11-16.')]);
  const t = setup('answer', { client: recording.client, now: () => Date.parse('2026-11-15T02:00:00Z') });
  const answer = await t.run();
  assert.deepEqual(answer.gate.cut_sentences, ['Today is 2026-11-16.']);
  assert.equal(prose(answer), 'Today is 2026-11-14. Today is 2026-11-15.');
});

test('naive date-times are UTC regardless of the server time zone', async () => {
  const originalZone = process.env.TZ;
  process.env.TZ = 'America/Chicago';
  try {
    for (const date of ['2026-11-15 10:00', '2026-11-15T10:00:00Z']) {
      const { answer } = await backedText(`Read at ${date}.`, { ...result, rows: [{ read_at: '2026-11-15 10:00' }] });
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

for (const [spelling, amount, other] of [
  ['400 euros', '€400', '$400'], ['400 euro', '€400', '£400'],
  ['400 pounds sterling', '£400', '$400'], ['400 pound sterling', '£400', '€400'],
  ['400 EUR', '€400', '$400'], ['400 GBP', '£400', '$400'],
  ['a 400-dollar jacket', '$400', '€400'], ['400-dollars', '$400', '£400'],
  ['400-USD', '$400', '€400'], ['400 - bucks', '$400', '£400'],
  ['$-400', '$400', '€400'], ['USD-400', '$400', '£400'],
  ['50 cents', '$0.50', '$50'], ['1 cent', '$0.01', '$1'],
] as const) {
  test(`${spelling} needs cited money in its currency, never a count or the person's number`, async () => {
    const text = `It is ${spelling}.`;
    const counts = { ...result, rows: [], counts: { sold: 400, listed: 50, items: 1 } };
    const input = 'I counted 400, 50 and 1 items.';
    const held = await backedText(text, counts, input);
    assert.deepEqual(held.answer.gate.cut_sentences, [text], 'counts and person numbers cannot back money');
    assert.equal(streamed(held.events), '', 'unbacked money must not stream');
    const cited = { ...counts, rows: [{ price: amount }] };
    const kept = await backedText(text, cited, input);
    assert.equal(prose(kept.answer), text, 'same currency and amount backs money');
    assert.equal(streamed(kept.events), text);
    assert.equal((await backedText(text, { ...cited, citation_ids: [] }, input)).answer.gate.cut, 1, 'money needs a citation');
    assert.equal((await backedText(text, { ...cited, rows: [{ price: other }] }, input)).answer.gate.cut, 1, 'units and cents scale must agree');
    const reverse = await backedText(`It costs ${amount}.`, { ...counts, rows: [{ price: spelling }] });
    assert.equal(reverse.answer.gate.cut, 0, 'suffixes normalize in result fields too');
  });
}

const hyphenCases: [string, Record<string, number>][] = [
  ['Sizes 8-10 are available.', { low: 8, high: 10 }],
  ['Delivery takes 2-3 days.', { low: 2, high: 3 }],
  ['The MA-1 is available.', { model: 1 }],
  ['COVID-19 affected sales.', { version: 19 }],
];
for (const [text, counts] of hyphenCases) {
  test(`a hyphen in ${text} does not make a negative number`, async () => {
    const returned = { ...result, rows: [], counts };
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

for (const text of ['-8 items remain.', 'There are -8 items.', 'There are (-8) items.', 'There are [-8] items.', 'There are {-8} items.']) {
  test(`a sign at an allowed boundary stays negative: ${text}`, async () => {
    assert.equal((await backedText(text, { ...result, rows: [], counts: { items: 8 } })).answer.gate.cut, 1);
    assert.equal((await backedText(text, { ...result, rows: [], counts: { items: -8 } })).answer.gate.cut, 0);
  });
}

for (const [title, text, money] of [
  ['MacBook A1466 2017', 'The A1466 is the 2017 model.', '$1466'],
  ['Jeans W32', 'The size is W32.', '$32'],
  ['Sony PS5', 'The PS5 is available.', '$5'],
  ['Y2K', 'The style is Y2K.', '$2'],
] as const) {
  test(`an ok string field backs counts in ${title} without backing money`, async () => {
    for (const citation_ids of [[], ['c1']]) {
      const returned = { ...result, rows: [{ title }], counts: {}, citation_ids };
      const kept = await backedText(text, returned);
      assert.equal(kept.answer.gate.cut, 0, 'plain counts in strings need no citation');
      assert.equal(prose(kept.answer), text);
      assert.equal((await backedText(`It costs ${money}.`, returned)).answer.gate.cut, 1);
      assert.equal((await backedText(text, { ...returned, ok: false })).answer.gate.cut, 1, 'failed results supply no facts');
    }
    const topLevel = Object.assign({ ...result, rows: [], counts: {}, citation_ids: [] }, { title });
    assert.equal((await backedText(text, topLevel)).answer.gate.cut, 0, 'top-level string fields also back counts');
  });
}

test('strings without citations supply counts but cannot supply money or percent', async () => {
  const returned = { ...result, rows: [{ title: 'A1466 costs $400 with 12% sold' }], counts: {}, citation_ids: [] };
  const { answer } = await backedText('The model is A1466. It costs $400. The share is 12%.', returned);
  assert.equal(prose(answer), 'The model is A1466.');
  assert.deepEqual(answer.gate.cut_sentences, ['It costs $400.', 'The share is 12%.']);
});

test('a round without token fields or provider cost uses max_tokens pricing and logs the estimate once', async () => {
  const round = continuingRound({});
  for (const key of Object.keys(round.usage)) Reflect.deleteProperty(round.usage, key);
  const recording = replay(Array.from({ length: 6 }, () => structuredClone(round)));
  const t = setup('answer', { client: recording.client, max_cost_usd: 0.001 });
  const answer = await t.run();
  assert.equal(recording.requests.length, 1);
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
  test(`number words keep ordinary prose: ${text}`, async () => {
    const t = setup('answer', { client: replay([textMessage(text)]).client });
    const answer = await t.run();
    assert.equal(prose(answer), text);
    assert.equal(streamed(t.events), text);
    assert.equal(answer.gate.cut, 0);
    assert.doesNotMatch(t.sink.text(), /number_words/);
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
  test(`${date} is one date, never independent day and year counts`, async () => {
    const text = `Sold on ${date}.`;
    const returned = { ...result, rows: [{ sold_at: '2026-11-15' }], counts: {} };
    const kept = await backedText(text, returned);
    assert.equal(kept.answer.gate.checked, 1);
    assert.equal(kept.answer.gate.cut, 0);
    assert.equal(prose(kept.answer), text);
    assert.equal(streamed(kept.events), text);
    const held = await backedText(text, { ...returned, rows: [], as_of: '', counts: { day: 15, year: 2026 } });
    assert.deepEqual(held.answer.gate.cut_sentences, [text], 'plain counts cannot back a date');
  });
}


const plantedMoney: [string, string[]][] = [
  ['It is 400 US dollars.', ['$400']], ['It is 400 U.S. dollars.', ['$400']],
  ['It costs 400 (dollars).', ['$400']], ['It costs _400_ dollars.', ['$400']],
  ['400 €', ['€400']], ['50¢', ['$0.50']], ['¥400', ['JPY 400']],
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

for (const [text, prices] of plantedMoney) {
  test(`BC2 cuts planted ${text} and keeps its cited currency and value`, async () => {
    const run = async (citedPrices: string[]) => {
      const t = setup('answer', { text: 'I counted 400 and 85 items.' });
      t.options.client = replay([fixture('parallel')[0], textMessage(text)]).client;
      t.options.tools.run = async name => name === 'search_market'
        ? { ...result, tool: 'search_market', citation_ids: [], counts: {}, rows: [{ url: 'https://www.ebay.com/itm/400?x=85', title: 'Kettlebell 5 pounds' }] }
        : { ...result, counts: {}, rows: citedPrices.map(price => ({ price })) };
      return { answer: await t.run(), events: t.events };
    };
    const held = await run(text === '$400k' || text === 'CA$400' ? ['$400'] : ['$120']);
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '', 'planted price must never stream');
    const kept = await run(prices);
    assert.equal(kept.answer.gate.cut, 0);
    assert.equal(prose(kept.answer), text.replace(/\*\*|__/g, ''), 'figures stay unchanged and emphasis is stripped');
    assert.equal(streamed(kept.events), text.replace(/\*\*|__/g, ''));
  });
}

test('BC1 reported zero never lowers token pricing or disables max_cost_usd', async () => {
  const recording = replay([continuingRound({ cost: 0, input_tokens: 900000, output_tokens: 16000, cache_read_input_tokens: 0 })]);
  const answer = await setup('answer', { client: recording.client, max_cost_usd: 0.25 }).run();
  assert.equal(recording.requests.length, 1);
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

test('BC2 weight, size, signed percent fractions and certainty keep their meaning', async () => {
  for (const text of ['It weighs 5 pounds.', 'It weighs 5 lb.', 'It weighs 5 lbs.', 'It weighs 5 oz.']) {
    const kept = await backedText(text, { ...result, citation_ids: [], rows: [{ weight: 5 }], counts: {} });
    assert.equal(prose(kept.answer), text);
  }
  const size = await backedText('Size 10 sells for $120.', { ...result, rows: [{ price_cents: 12000 }] }, 'Size 10');
  assert.equal(prose(size.answer), 'Size 10 sells for $120.');
  const percent = await backedText('It is down 5%.', { ...result, rows: [{ change: -0.05 }] });
  assert.equal(prose(percent.answer), 'It is down 5%.');
  assert.equal((await backedText('It is down 5%.', { ...result, citation_ids: [], rows: [{ change: -0.05 }] }, '5')).answer.gate.cut, 1);
  for (const text of ['I am 100% sure.', 'I am 100 percent certain.', 'I am one hundred percent sure.']) {
    const kept = await backedText(text);
    assert.equal(prose(kept.answer), text);
    assert.equal(streamed(kept.events), text);
  }
});

for (const context of ['10 items', '10 times', '10 sizes', '10 pairs', '10 colors', '10 stars', '10 reviews', '10 photos', '10 lb', '10 lbs', '10 oz', '10 pounds', 'size 10', '#10', 'no. 10', 'model 10', 'style 10', 'lot 10', 'item 10', 'A10', 'PS10', 'Y10K', 'MA-10', 'W10']) {
  test(`BC2 explains ${context} as a count beside money`, async () => {
    const text = `For ${context}, it costs $120.`;
    const kept = await backedText(text, { ...result, rows: [{ price: '$120' }] }, '10');
    assert.equal(prose(kept.answer), text);
    assert.equal(streamed(kept.events), text);
  });
}

test('BC2 shared normalization applies to result fields and person counts and dates', async () => {
  const money = await backedText('It costs $400.', { ...result, rows: [{ price: '_٤٠٠_ (dollars)' }] });
  assert.equal(prose(money.answer), 'It costs $400.');
  const count = await backedText('There are 4 items. Sold on 2026-11-12.', { ...result, rows: [], counts: {} }, '４ items sold on ٢٠٢٦-١١-١٢');
  assert.equal(count.answer.gate.cut, 0);
});

for (const key of ['id', 'external_id', 'url', 'photo_url', 'href', 'item_href', 'link', 'source_link', 'image', 'hero_image', 'src', 'photo_src']) {
  test(`BC2 ${key} fields cannot back counts or money`, async () => {
    for (const value of [400, '400', '$400']) {
      const held = await backedText('There are 400 items. It costs $400.', { ...result, rows: [{ [key]: value }], counts: {} });
      assert.equal(held.answer.gate.cut, 2);
    }
  });
}

test('BC2 a URL string under an innocent field name cannot supply figures', async () => {
  const held = await backedText('There are 400 items. There are 85 items.', { ...result, rows: [{ title: 'https://www.ebay.com/itm/400?x=85' }], counts: {} });
  assert.equal(held.answer.gate.cut, 2);
  const kept = await backedText('There are 400 items.', { ...result, citation_ids: [], rows: [{ title: '400 items' }], counts: {} });
  assert.equal(kept.answer.gate.cut, 0);
});

test('BC2 an unknown currency cannot be backed even by the identical cited spelling', async () => {
  const text = 'It costs ₿400.';
  const held = await backedText(text, { ...result, rows: [{ price: '₿400' }], counts: { sold: 400 } }, '400');
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
});


test('BC2 a minus before currency and a currency multiplier cannot borrow an unscaled positive price', async () => {
  for (const text of ['-$40', '-CA$40', '$400k', '$1.2M', '$2bn']) {
    const held = await backedText(text, { ...result, rows: [{ price: '$40' }, { price: 'CAD 40' }, { price: '$400' }, { price: '$1.2' }, { price: '$2' }] });
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  }
});

test('BC2 count metadata identifiers cannot supply counts', async () => {
  const held = await backedText('There are 400 items.', { ...result, rows: [], counts: { external_id: 400 } });
  assert.equal(held.answer.gate.cut, 1);
});

test('BC2 normalized result dates remain whole dates', async () => {
  const kept = await backedText('Sold on 2026-11-12.', { ...result, rows: [{ sold_at: '٢٠٢٦-١١-١٢' }] });
  assert.equal(prose(kept.answer), 'Sold on 2026-11-12.');
});


test('BC2 a year-shaped price or range endpoint cannot use the standalone year exemption', async () => {
  for (const [text, prices] of [
    ['It runs from 4000 to 5000 dollars.', ['$5000']],
    ['It runs from 2026 to 4000 dollars.', ['$4000']],
    ['In 2026 EUR.', ['$2026']],
  ] as const) {
    const held = await backedText(text, { ...result, rows: prices.map(price => ({ price })), counts: { sold: 4000 } }, '2026 and 4000');
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
  }
  const kept = await backedText('In 2026, it costs $120.', { ...result, rows: [{ price: '$120' }] });
  assert.equal(kept.answer.gate.cut, 0);
});


for (const [suffix, value] of [['k', 120000], ['m', 120000000], ['M', 120000000], ['bn', 120000000000]] as const) {
  test(`BC2 range endpoint ${suffix} scales as money rather than a glued count`, async () => {
    const text = `It costs $85–120${suffix}.`;
    const returned = { ...result, rows: [{ price: '$85' }] };
    const held = await backedText(text, returned, '120 items');
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
    const kept = await backedText(text, { ...returned, rows: [...returned.rows, { price: `$${value}` }] });
    assert.equal(prose(kept.answer), text);
  });
}

test('BC2 quid alone does not turn pounds of weight into currency', async () => {
  const text = 'It weighs 5 pounds and costs 10 quid.';
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
    const text = `It costs ${words} dollars.`;
    const held = await backedText(text, { ...result, rows: [{ price: wrong }] });
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    assert.equal(streamed(held.events), '');
    const kept = await backedText(text, { ...result, rows: [{ price: honest }] });
    assert.equal(prose(kept.answer), text);
  });
}

test('BC2 a left multiplier inherits the range currency even with another currency present', async () => {
  const text = 'It costs 85k–120 CAD or US$5.';
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
    const text = `It costs ${words} dollars.`;
    const held = await backedText(text, { ...result, rows: [{ price: wrong }] });
    assert.deepEqual(held.answer.gate.cut_sentences, [text]);
    const kept = await backedText(text, { ...result, rows: [{ price: honest }] });
    assert.equal(prose(kept.answer), text);
  });
}

test('BC2 uncertain consecutive number-word scales cannot back themselves', async () => {
  const text = 'It costs one thousand million dollars.';
  const held = await backedText(text, { ...result, rows: [{ price: text }] });
  assert.deepEqual(held.answer.gate.cut_sentences, [text]);
  assert.equal(streamed(held.events), '');
});

test('seed rows reach the first user message, back their price, and keep invented money cut', async () => {
  const recording = replay(fixture('numbers').slice(1));
  const t = setup('answer', { client: recording.client, seed: [result] });
  const answer = await t.run();
  assert.equal(prose(answer), 'It costs $45.');
  assert.equal(answer.gate.cut, 1);
  assert.equal(answer.results.r1.citation_ids[0], 'c1');
  assert.ok(JSON.stringify(recording.requests[0].messages).includes('r1'));
  assert.equal(answer.calls.length, 0);
});

test('queued late rows get a new id and one bounded round after end_turn', async () => {
  const messages = [fixture('answer')[0], fixture('numbers')[1]];
  messages[1].content = [{ type: 'text', text: 'The late listing costs $60. It costs $999.', citations: null }];
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
    assert.equal(answer.reason, limit === 'rounds' ? 'max_rounds' : 'cost_cap');
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

test('ambiguous sizes use the shared Ask in content order and end even at the round limit', async () => {
  const recording = replay([askMessage()]);
  const t = setup('answer', { ...recording, job_id: 'job_sizes', seed: [result], max_rounds: 1,
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

test('plain text removes emphasis after gating and cuts internal error sentences in stream and settled text', async () => {
  const text = '**These match.** __Choose freely.__ It failed with not_connected. A call to search_market failed. Sold prices are not available here yet.';
  const t = setup('answer', { client: replay([textMessage(text)]).client });
  const answer = await t.run();
  assert.equal(prose(answer), 'These match. Choose freely. Sold prices are not available here yet.');
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
