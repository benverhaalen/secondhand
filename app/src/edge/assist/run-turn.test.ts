import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { Message, MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages';
import { createLog, memorySink } from '../../../../log/index.js';
import { memoryJobs } from '../api/jobs.ts';
import { assistParams } from '../../engines/param/param.ts';
import { runTurn, type RunTurnDeps } from './run-turn.ts';
import type { ToolResult } from './types.ts';
import type { StreamClient } from './converse.ts';
import { defaultDeps } from './tools.ts';

test('concurrent person and visitor turns keep their own tool caller and person id', async () => {
  const t = setup();
  const shared = defaultDeps({}, async () => { throw new Error('network forbidden'); }, t.deps.log);
  const seen: { caller: string; person_id?: string }[] = [];
  const search = t.jobs.put({ kind: 'search', state: 'running' }, 'person-a');
  t.jobs.append(search.id, 'answer.settled', { results: [], sites_pending: [] });
  t.jobs.append(search.id, 'job.state', { state: 'done' });
  shared.searchJob = {
    async start(input) { seen.push({ caller: input.caller, person_id: input.person_id }); return { id: search.id }; },
    listen: t.jobs.listen, framesAfter: t.jobs.framesAfter,
  };
  t.deps.toolDeps = shared;
  t.deps.tools = undefined;
  const entered: (() => void)[] = [];
  t.deps.converse = async o => {
    await new Promise<void>(resolve => { entered.push(resolve); if (entered.length === 2) entered.forEach(done => done()); });
    await o.tools.run('search_market', { query: 'coat' }, o.signal);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(seen.length, 2);
    return (await import('./converse.ts')).converse({ ...o, client: { messages: { stream() {
      return { on() {}, finalMessage: async () => fixture()[1] };
    } } } });
  };
  const visitor = t.jobs.put({ kind: 'assist', state: 'running' }, 'vis_test');
  const answers = await Promise.all([
    runTurn(t.job.id, { surface: 'buy', text: 'coat', user_id: 'person-a' }, t.deps),
    runTurn(visitor.id, { surface: 'buy', text: 'coat' }, t.deps),
  ]);
  assert.deepEqual(seen, [{ caller: 'person', person_id: 'person-a' }, { caller: 'visitor', person_id: undefined }]);
  assert.equal(shared.caller, 'visitor', 'the injected template must not be mutated');
  assert.equal(shared.person_id, undefined);
  assert.ok(answers.every(answer => answer?.state === 'answered'));
});

const NOW = Date.parse('2026-11-15T12:00:00Z');
const result: ToolResult = { tool: 'value_item', ok: true, rows: [{ id: 'price', price_cents: 4500 }],
  counts: { sold: 3 }, as_of: '2026-11-15', citation_ids: ['price'], basis: 'sold rows', not_built: [], widgets: ['table'], ms: 0 };
const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/converse/numbers.json', import.meta.url), 'utf8')) as Message[];
function setup(messages = fixture()) {
  const jobs = memoryJobs(), sink = memorySink(), requests: MessageCreateParamsBase[] = [];
  const client: StreamClient = { messages: { stream(params) {
    requests.push(structuredClone(params));
    return { on() {}, async finalMessage() { return messages[requests.length - 1]; } };
  } } };
  const deps: RunTurnDeps = { env: {}, jobs, now: () => NOW, params: assistParams,
    log: createLog({ src: 'test', build: 'test', sink }), client: { client, model: 'stand-in' },
    tools: { defs: [], run: async () => result } };
  const job = jobs.put({ kind: 'assist', state: 'running' }, 'person-a');
  return { deps, jobs, sink, requests, job };
}

test('tool lifecycle, gated text, sanitized settled answer, and terminal state are appended in order', async () => {
  const t = setup();
  const answer = await runTurn(t.job.id, { surface: 'buy', text: 'Find a jacket', user_id: 'person-a' }, t.deps);
  assert.equal(answer?.gate.cut, 1);
  const frames = t.jobs.framesAfter(t.job.id, 0);
  assert.deepEqual(frames.map(f => f.event), ['assist.tool', 'assist.tool', 'assist.text', 'assist.settled', 'job.state']);
  assert.deepEqual(frames.slice(0, 2).map(f => f.data.phase), ['start', 'end']);
  assert.equal(frames[2].data.delta, 'It costs $45.');
  assert.ok(!JSON.stringify(frames).includes('$999'));
  const settled = frames[3].data;
  assert.deepEqual((settled.gate as { cut_sentences: string[] }).cut_sentences, []);
  assert.ok((settled.calls as Record<string, unknown>[]).every(c => !('input' in c)));
  assert.ok(frames.filter(f => f.event === 'assist.tool').every(f => !('input' in f.data)));
  assert.equal(frames.at(-1)?.data.kind, 'assist');
  assert.equal(t.jobs.get(t.job.id, 'person-a')?.state, 'done');
});

test('history and visitor image reach the real converse options; private text cannot reach logs', async () => {
  const t = setup(fixture().slice(1));
  const image = { media_type: 'image/png' as const, data_base64: 'cHJpdmF0ZSBpbWFnZQ==' };
  t.deps.tools = { defs: [], run: async () => { throw new Error('unused'); } };
  t.deps.client = { model: 'stand-in', client: { messages: { stream(p) {
    t.requests.push(structuredClone(p));
    return { on() {}, async finalMessage() { throw new Error('vendor ' + JSON.stringify(p.messages)); } };
  } } } };
  await runTurn(t.job.id, { surface: 'buy', text: 'private current ask', history: [{ role: 'user', text: 'private history ask' }], image }, t.deps);
  const messages = t.requests[0].messages;
  assert.equal(messages[0].content, 'private history ask');
  assert.ok(JSON.stringify(messages).includes(image.data_base64));
  for (const value of ['private current ask', 'private history ask', image.data_base64]) assert.ok(!t.sink.text().includes(value), value);
});

test('vendor rejection fails the job with fixed text instead of hanging or exposing its message', async () => {
  const t = setup();
  t.deps.client = { model: 'stand-in', client: { messages: { stream() {
    return { on() {}, async finalMessage() { throw new Error('FAKE_VENDOR_SECRET'); } };
  } } } };
  await runTurn(t.job.id, { surface: 'buy', text: 'jacket' }, t.deps);
  assert.equal(t.jobs.get(t.job.id, 'person-a')?.state, 'failed');
  const frames = t.jobs.framesAfter(t.job.id, 0);
  assert.deepEqual(frames.at(-1)?.data.error, { code: 'unavailable', message: 'The answer could not be finished.' });
  assert.ok(!JSON.stringify(frames).includes('FAKE_VENDOR_SECRET'));
  assert.ok(t.sink.text().includes('FAKE_VENDOR_SECRET'));
});

test('a deadline aborts and fails even when an injected model ignores its signal', async () => {
  const t = setup();
  t.deps.params = { read: (name, scope) => ({ ...assistParams.read(name, scope), ...(name === 'assist_turn_deadline_ms' ? { value: 5 } : {}) }) };
  let received: AbortSignal | undefined;
  t.deps.client = { model: 'stand-in', client: { messages: { stream(_p, o) {
    received = o?.signal;
    return { on() {}, finalMessage: () => new Promise<Message>(() => {}) };
  } } } };
  await runTurn(t.job.id, { surface: 'buy', text: 'jacket' }, t.deps);
  assert.equal(received?.aborted, true);
  assert.equal(t.jobs.get(t.job.id, 'person-a')?.state, 'failed');
});

test('turn params, caller identity, and private reference gaps are passed without inventing a reader', async () => {
  const t = setup(fixture().slice(1));
  let options: import('./converse.ts').ConverseOptions | undefined;
  t.deps.params = { read: (name, scope) => ({ ...assistParams.read(name, scope),
    ...(name === 'assist_effort' ? { value: 'medium' } : name === 'assist_turn_max_usd' ? { value: 0.1 } : {}) }) };
  const { converse } = await import('./converse.ts');
  t.deps.converse = async o => { options = o; return converse(o); };
  const answer = await runTurn(t.job.id, { surface: 'item', text: 'jacket', user_id: 'person-a', item_id: 'it_a' }, t.deps);
  assert.equal(options?.effort, 'medium');
  assert.equal(options?.max_cost_usd, 0.1);
  assert.ok(answer?.not_built?.some(line => line.includes('item_id')));
  assert.ok(answer?.blocks.some(b => b.type === 'text' && b.text.includes('not built')));
});

test('a running search seeds its current rows and a later job frame becomes a gated next-round result', async () => {
  const t = setup();
  const search = t.jobs.put({ kind: 'search', state: 'running' }, 'person-a');
  const offer = (id: string, site: string, price_cents: number) => ({ id, listing_id: id, site, title: 'coat',
    url: 'https://example.test/' + id, condition: 'good', relation: 'exact',
    price_cents: { amount_cents: price_cents, currency: 'USD' }, delivered_cents: null });
  t.jobs.append(search.id, 'answer.partial', { site: 'poshmark',
    results: [offer('a', 'poshmark', 4500), offer('b', 'poshmark', 5000), offer('c', 'dupe', 5500)], sites_pending: ['ebay'] });
  t.deps.client = { model: 'stand-in', client: { messages: { stream(p) {
    t.requests.push(structuredClone(p));
    const round = t.requests.length;
    return { on() {}, async finalMessage() {
      const final = fixture()[1];
      if (round === 1) t.jobs.append(search.id, 'answer.late', {
        site: 'ebay', results: [offer('late', 'ebay', 6000)], sites_pending: [] });
      else final.content = [{ type: 'text', text: 'The late row costs $60. It costs $999.', citations: null }];
      return final;
    } };
  } } } };
  const answer = await runTurn(t.job.id, { surface: 'buy', text: 'analyse', user_id: 'person-a', search_job_id: search.id }, t.deps);
  assert.equal(t.requests.length, 2);
  assert.equal(answer?.results.r1.rows.filter(row => row.kind !== 'site_summary').length, 3);
  assert.equal(answer?.results.r2.rows[0].citation_id, 'late');
  assert.ok(JSON.stringify(t.requests[1].messages).includes('late result r2: ebay'));
  const frames = t.jobs.framesAfter(t.job.id, 0);
  assert.ok(JSON.stringify(frames).includes('$45'));
  assert.ok(JSON.stringify(frames).includes('$60'));
  assert.ok(!JSON.stringify(frames).includes('$999'));
  assert.equal(t.jobs.listenerCount(search.id), 0);
});

test('default tool wiring uses the authenticated caller and the injected environment, fetch and clock', async () => {
  const t = setup();
  const { defaultDeps } = await import('./tools.ts');
  let fetches = 0;
  t.deps.fetch = async () => { fetches++; throw new Error('network forbidden'); };
  const d = defaultDeps({}, t.deps.fetch, t.deps.log);
  t.deps.toolDeps = d;
  t.deps.tools = undefined;
  const callers: string[] = [];
  d.forUser = async id => { callers.push(id); return null; };
  t.deps.converse = async o => {
    const result = await o.tools.run('market_store', { function: 'ask_genie', args: { question: 'counts' } }, o.signal);
    assert.equal(result.reason, 'not_connected');
    assert.equal(o.tools.defs.length, 5);
    assert.equal(o.model, 'stand-in');
    return (await import('./converse.ts')).converse({ ...o, tools: { defs: [], run: async () => result } });
  };
  await runTurn(t.job.id, { surface: 'buy', text: 'jacket', user_id: 'person-a' }, t.deps);
  assert.deepEqual(callers, ['person-a']);
  assert.equal(d.caller, 'visitor');
  assert.equal(d.person_id, undefined);
  assert.equal(fetches, 0);
});

test('runner catches a throw from converse itself and still closes the job', async () => {
  const t = setup();
  t.deps.converse = async () => { throw new Error('FAKE_VENDOR_THROW'); };
  await runTurn(t.job.id, { surface: 'buy', text: 'jacket' }, t.deps);
  assert.equal(t.jobs.get(t.job.id, 'person-a')?.state, 'failed');
  assert.ok(!JSON.stringify(t.jobs.framesAfter(t.job.id, 0)).includes('FAKE_VENDOR_THROW'));
  assert.ok(t.sink.text().includes('FAKE_VENDOR_THROW'));
});

test('escaped multiline history and image echoes are redacted even inside tool failures', async () => {
  const t = setup();
  const history = [{ role: 'assistant' as const, text: 'private "quoted"\nhistory' }];
  const image = { media_type: 'image/png' as const, data_base64: 'cHJpdmF0ZQ==' };
  const text = 'private "current"\nask';
  t.deps.tools = { defs: [], async run() { throw new Error(JSON.stringify({ text, history, image })); } };
  await runTurn(t.job.id, { surface: 'buy', text, history, image }, t.deps);
  const logged = t.sink.text();
  for (const value of [text, history[0].text, image.data_base64]) {
    assert.ok(!logged.includes(value));
    assert.ok(!logged.includes(JSON.stringify(value).slice(1, -1)));
  }
});
