import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog } from '../../../../log/index.js';
import { jevAsk, validateChoice, parseFieldText, fieldText, JEV_ENDPOINT, JEV_MODEL, type JevQuestions } from './jev.ts';

const log = createLog({ src: 'test', build: 'test', sink: () => {} });
const REAL_KEY = process.env.OPENROUTER_API_KEY;
const questions: JevQuestions = { kind: { type: 'choice', instructions: 'pick', criteria: { a: 'first', b: 'second', c: null } } };
const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

async function withKey<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env.OPENROUTER_API_KEY;
  if (key === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = key;
  try { return await fn(); } finally { if (before === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = before; }
}

const CH = ['a', 'b', 'c'];
const good = { choice: 'a', confidence: 0.9, probabilities: { a: 0.9, b: 0.06, c: 0.04 } };

test('validate_choice: accepts a valid distribution and a choice with no probabilities', () => {
  assert.deepEqual(validateChoice(good, CH), { ok: true, choice: 'a', confidence: 0.9, probabilities: good.probabilities });
  assert.equal(validateChoice({ choice: 'b' }, CH).ok, true);
  assert.equal(validateChoice({ choice: 'a', probabilities: { a: 0.5, b: 0.5 - 0.019, c: 0 } }, CH).ok, true); // within 0.02
});

test('validate_choice: rejects every break', () => {
  const bad: [string, unknown][] = [
    ['sum 0.9', { choice: 'a', probabilities: { a: 0.8, b: 0.05, c: 0.05 } }],
    ['sum 1.1', { choice: 'a', probabilities: { a: 0.9, b: 0.1, c: 0.1 } }],
    ['choice not the max', { choice: 'b', probabilities: { a: 0.6, b: 0.3, c: 0.1 } }],
    ['different set', { choice: 'a', probabilities: { a: 0.9, b: 0.05, z: 0.05 } }],
    ['missing key', { choice: 'a', probabilities: { a: 0.9, b: 0.1 } }],
    ['extra key', { choice: 'a', probabilities: { a: 0.9, b: 0.05, c: 0.05, d: 0 } }],
    ['choice outside the set', { choice: 'z', probabilities: good.probabilities }],
    ['choice not a string', { choice: 1 }],
    ['NaN probability', { choice: 'a', probabilities: { a: NaN, b: 0.5, c: 0.5 } }],
    ['negative probability', { choice: 'a', probabilities: { a: 1.2, b: -0.1, c: -0.1 } }],
    ['string probability', { choice: 'a', probabilities: { a: '0.9', b: 0.05, c: 0.05 } }],
    ['probabilities an array', { choice: 'a', probabilities: [0.9, 0.05, 0.05] }],
    ['null', null], ['string', 'a'], ['array', ['a']],
  ];
  for (const [name, x] of bad) assert.equal(validateChoice(x, CH).ok, false, name);
});

test('fieldText: exactly one text key, a string, at most 2000 characters', () => {
  assert.equal(parseFieldText({ text: 'hello' }), 'hello');
  assert.equal(parseFieldText({ text: 'x'.repeat(2000) })?.length, 2000);
  for (const x of [{ text: 'x'.repeat(2001) }, { text: 1 }, { text: 'a', extra: 1 }, {}, { body: 'a' }, null, 'text', [{ text: 'a' }]])
    assert.equal(parseFieldText(x), null);
});

test('fieldText: the injected llm answer is typed only when valid; a throwing llm types nothing', async () => {
  assert.equal(await fieldText(async () => ({ text: 'ok' }), 'p'), 'ok');
  assert.equal(await fieldText(async () => ({ text: 'ok', x: 1 }), 'p'), null);
  assert.equal(await fieldText(async () => { throw new Error('down'); }, 'p'), null);
});

test('jevAsk: one request carries every head; sends model, state, questions and the bearer', async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const r = await withKey('test-key', () => jevAsk('s', questions, {
    log, fetchImpl: async (url, init) => { seen = { url: String(url), init: init! }; return new Response(JSON.stringify({ result: { answers: { kind: good } } })); },
  }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.answers, { kind: good });
  assert.equal(seen!.url, JEV_ENDPOINT);
  const body = JSON.parse(String(seen!.init.body));
  assert.deepEqual([body.model, body.state, Object.keys(body.questions)], [JEV_MODEL, 's', ['kind']]);
  assert.equal((seen!.init.headers as Record<string, string>).authorization, 'Bearer test-key');
});

test('jevAsk: top-level answers are accepted too', async () => {
  const r = await withKey('k', () => jevAsk('s', questions, { log, fetchImpl: reply({ answers: { kind: good } }) as typeof fetch }));
  assert.equal(r.ok, true);
});

test('budget: a call past 400 ms times out and reports timeout, even when fetch ignores its signal', async () => {
  const slow = (() => new Promise<Response>(res => setTimeout(() => res(new Response('{}')), 1500))) as typeof fetch;
  const r = await withKey('k', () => jevAsk('s', questions, { log, fetchImpl: slow }));
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, 'timeout');
  assert.ok(r.ms >= 395 && r.ms < 900, `ms ${r.ms}`);
});

test('jevAsk: typed failures, never a throw', async () => {
  const run = (f: typeof fetch) => withKey('k', () => jevAsk('s', questions, { log, fetchImpl: f }));
  const reason = (r: Awaited<ReturnType<typeof run>>) => (r.ok ? 'ok' : r.reason);
  assert.equal(reason(await run(reply({}, 500) as typeof fetch)), 'http');
  assert.equal(reason(await run((async () => { throw new TypeError('network'); }) as typeof fetch)), 'http');
  assert.equal(reason(await run((async () => new Response('not json')) as typeof fetch)), 'bad_response');
  assert.equal(reason(await run(reply({ nothing: 1 }) as typeof fetch)), 'bad_response');
  assert.equal(reason(await run(reply({ answers: [] }) as typeof fetch)), 'bad_response');
  assert.equal(reason(await withKey(undefined, () => jevAsk('s', questions, { log, fetchImpl: reply({}) as typeof fetch }))), 'no_key');
});

test('jevAsk: the key never reaches the log', async () => {
  const lines: string[] = [];
  const l = createLog({ src: 'test', build: 'test', sink: line => { lines.push(line); } });
  await withKey('sk-' + 'or-v1-' + '0123456789abcdef'.repeat(2), () => jevAsk('s', questions, { log: l, fetchImpl: reply({ answers: { kind: good } }) as typeof fetch }));
  assert.ok(lines.length > 1);
  assert.ok(!lines.join('\n').includes('0123456789abcdef'));
});

test('LIVE: one small classification returns a valid choice (skipped without OPENROUTER_API_KEY)', { skip: !REAL_KEY, timeout: 60000 }, async () => {
  const heads: JevQuestions = { kind: { type: 'choice', instructions: 'What is the person asking?', criteria: {
    price_now: 'what an item is worth right now', product_reviews: 'what buyers say about a product', site_rules: 'the fees or rules of a marketplace' } } };
  const state = { question: 'what are the fees for selling shoes on poshmark' };
  const ms: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await jevAsk(state, heads, { log, timeoutMs: 3000 });
    assert.equal(r.ok, true, `live call ${i}: ${r.ok ? '' : r.reason}`);
    if (!r.ok) return;
    const v = validateChoice(r.answers.kind, Object.keys(heads.kind!.criteria));
    assert.equal(v.ok, true, `live answer ${i} invalid`);
    ms.push(r.ms);
  }
  const sorted = [...ms].sort((a, b) => a - b);
  process.stdout.write(`LIVE jev ms: ${ms.join(',')} median ${sorted[2]} max ${sorted[4]}\n`);
});
