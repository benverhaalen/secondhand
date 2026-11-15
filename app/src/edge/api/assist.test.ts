import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { Message, MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages';
import { createLog, memorySink } from '../../../../log/index.js';
import { deps, route, ApiError, type Ctx, type Handler } from './http.ts';
import { example } from './examples.ts';
import { handlers, manifest, createAssistHandler, visitorBudget } from './assist.ts';
import { memoryJobs, jobsOn, getJob, jobEvents } from './jobs.ts';
import { sqliteStore } from '../events/sqlite-store.ts';
import { assistParams } from '../../engines/param/param.ts';
import type { StreamClient } from '../assist/converse.ts';
import type { ToolResult } from '../assist/types.ts';

const NOW = Date.parse('2026-11-15T23:59:00Z');
const message = () => {
  const reply = (JSON.parse(readFileSync(new URL('../assist/fixtures/converse/numbers.json', import.meta.url), 'utf8')) as Message[])[1];
  reply.content = [{ type: 'text', text: 'It costs $999. It costs $45 [r1].', citations: null }];
  return reply;
};
const noNetwork: typeof fetch = async () => { throw new Error('network forbidden'); };
const tools = { defs: [], async run(): Promise<ToolResult> { throw new Error('unexpected tool'); } };

test('the standalone assist route loads runtime clients before serving requests', () => {
  const source = readFileSync(new URL('../../app/v1/assist/index+api.ts', import.meta.url), 'utf8');
  assert.match(source, /import ['"]@\/edge\/api\/runtime['"]/);
});

test('a throwing visitor turn settles its reservation before the next successful ask', async () => {
  const t = setup(), tasks: (() => Promise<void>)[] = [], settled: number[] = [];
  const pool = visitorBudget();
  let throwing = true;
  const handler = createAssistHandler({ env: {}, jobs: t.jobs, now: () => NOW,
    params: { read(name, scope) {
      if (name === 'assist_turn_deadline_ms' && throwing) { throwing = false; throw new Error('turn setup failed'); }
      return assistParams.read(name, scope);
    } },
    client: { model: 'stand-in', client: { messages: { stream() { return { on() {}, finalMessage: async () => message() }; } } } },
    tools, schedule: task => tasks.push(task), budget: { reserve(...args) {
      const settle = pool.reserve(...args);
      return cost => { settled.push(cost); settle(cost); };
    } },
  });
  await handler(t.ctx('vis_first'), new Request('http://test'));
  await assert.rejects(tasks[0](), /turn setup failed/);
  assert.deepEqual(settled, [0.25], 'a throw charges the reserved amount and clears the reservation');
  const next = await handler(t.ctx('vis_next'), new Request('http://test'));
  assert.ok(!(next instanceof Response));
  assert.equal(next.status, 202);
  await tasks[1]();
  assert.equal(settled.length, 2);
  assert.ok(settled[1] < 0.25);
});

test('non-storable tool rows survive only in the live job and expire with it', async () => {
  const t = setup(), database = new DatabaseSync(':memory:');
  const store = sqliteStore(database), jobs = jobsOn(store, database, {}), tasks: (() => Promise<void>)[] = [];
  const hidden = { ...offer('no-store', 'dupe', 4500), title: 'TRANSIENT_DUPE_ROW', may_store: false, may_model: false, use_scope: 'hackathon_demo' };
  const search = jobs.put({ kind: 'search', state: 'running' }, 'person-a');
  jobs.append(search.id, 'answer.settled', { results: [hidden], sites_pending: [] });
  jobs.append(search.id, 'job.state', { state: 'done' });
  const requests: MessageCreateParamsBase[] = [];
  const handler = createAssistHandler({ env: {}, jobs, params: assistParams, now: () => NOW, tools,
    client: { model: 'stand-in', client: { messages: { stream(p) {
      requests.push(structuredClone(p));
      return { on() {}, finalMessage: async () => message() };
    } } } }, schedule: task => tasks.push(task) });
  const response = await handler(t.ctx('person-a', { surface: 'buy', text: 'analyse', search_job_id: search.id }), new Request('http://test'));
  assert.ok(!(response instanceof Response));
  await tasks[0]();
  const id = (response.body as { id: string }).id;
  const answer = jobs.get(id, 'person-a')?.result as { results: Record<string, ToolResult> };
  assert.equal(answer.results.r1.rows[0].may_store, false);
  const content = requests[0].messages.at(-1)?.content;
  assert.ok(Array.isArray(content));
  assert.ok(content.some(block => block.type === 'text' && block.text.includes('"may_store":false')));
  assert.ok(!t.sink.text().includes('TRANSIENT_DUPE_ROW'));
  for (const table of ['frames', 'kv']) {
    const durable = database.prepare(`SELECT * FROM ${table}`).all();
    assert.ok(!JSON.stringify(durable).includes('TRANSIENT_DUPE_ROW'), `${table} must not hold a non-storable row`);
  }
  assert.equal(store.getJob(id), undefined, 'assist jobs never enter the durable job history');
  jobs.prune(Date.now() + 86400000);
  assert.equal(jobs.get(id, 'person-a'), undefined);
  assert.deepEqual(jobs.framesAfter(id, 0), []);
  database.close();
});
function setup() {
  const jobs = memoryJobs(), sink = memorySink(), tasks: (() => Promise<void>)[] = [], requests: MessageCreateParamsBase[] = [];
  let now = NOW;
  const client: StreamClient = { messages: { stream(params) {
    requests.push(structuredClone(params));
    return { on() {}, async finalMessage() { return message(); } };
  } } };
  const handler = createAssistHandler({ env: { ANTHROPIC_API_KEY: 'stand-in', SECONDHAND_EXAMPLES: '0' }, jobs, now: () => now,
    params: assistParams, client: { client, model: 'stand-in' }, fetch: noNetwork, tools,
    budget: visitorBudget(), schedule: task => { tasks.push(task); } });
  const log = createLog({ src: 'test', build: 'test', sink });
  const ctx = (owner: string, body: Record<string, unknown> = { surface: 'buy', text: 'find a jacket' }): Ctx => ({
    user_id: owner.startsWith('vis_') ? null : owner, visitor_id: owner.startsWith('vis_') ? owner : null,
    request_id: 'request', params: {}, query: new URLSearchParams(), body, headers: new Headers(), log,
  });
  const post = async (owner = 'person-a', body?: Record<string, unknown>) => {
    const response = await handler(ctx(owner, body), new Request('http://test/v1/assist', { method: 'POST' }));
    assert.ok(!(response instanceof Response));
    return response as { status: number; body: { id: string; stream: string; state: string; kind: string; stages: unknown[] } };
  };
  return { jobs, sink, tasks, requests, handler, ctx, post, setNow: (time: number) => { now = time; }, log };
}
async function rejects(work: Promise<unknown>, code: string, status: number) {
  await assert.rejects(work, (error: unknown) => error instanceof ApiError && error.code === code && error.status === status);
}

test('202 returns an owned assist job and stream before the model is called', async () => {
  const t = setup(), response = await t.post();
  assert.equal(response.status, 202);
  assert.deepEqual(response.body, { id: response.body.id, kind: 'assist', state: 'running', stages: [], stream: '/v1/jobs/' + response.body.id + '/events' });
  assert.equal(t.jobs.get(response.body.id, 'person-a')?.state, 'running');
  assert.equal(t.requests.length, 0);
  await t.tasks[0]();
  assert.equal(t.jobs.get(response.body.id, 'person-a')?.state, 'done');
});

test('two people and two visitors cannot read one another’s assist jobs or events', async () => {
  const t = setup();
  for (const owner of ['person-a', 'vis_a']) {
    const response = await t.post(owner);
    await t.tasks.at(-1)!();
    for (const stranger of owner === 'person-a' ? ['person-b', 'vis_b'] : ['vis_b', 'person-b']) {
      const ctx = { ...t.ctx(stranger), params: { id: response.body.id } };
      for (const reader of [getJob(t.jobs), jobEvents(t.jobs)]) {
        await rejects(Promise.resolve().then(() => reader(ctx, new Request('http://test'))), 'not_found', 404);
      }
    }
  }
});

function offer(id: string, site: string, cents: number) {
  return { id, listing_id: id, site, title: 'OWNED_SEARCH_ROW', url: 'https://example.test/' + id, condition: 'good',
    relation: 'exact', price_cents: { amount_cents: cents, currency: 'USD' }, delivered_cents: null };
}

test('a foreign search id is refused before its rows can be read, logged, or used by a model', async () => {
  const t = setup(), job = t.jobs.put({ kind: 'search', state: 'done' }, 'person-a');
  t.jobs.append(job.id, 'answer.settled', { results: [offer('private-row', 'poshmark', 4500)], sites_pending: [] });
  let reads = 0;
  const framesAfter = t.jobs.framesAfter;
  t.jobs.framesAfter = (...args) => { reads++; return framesAfter(...args); };
  for (const stranger of ['person-b', 'vis_b']) await rejects(t.post(stranger, { surface: 'buy', text: 'analyse', search_job_id: job.id }), 'not_found', 404);
  assert.equal(reads, 0);
  assert.equal(t.tasks.length, 0);
  assert.equal(t.requests.length, 0);
  assert.ok(!t.sink.text().includes('OWNED_SEARCH_ROW'));
  const assist = await t.post();
  await rejects(t.post('person-a', { surface: 'buy', text: 'analyse', search_job_id: assist.body.id }), 'not_found', 404);
});

test('owned settled search seeds three rows on two sites; the gate keeps only backed money', async () => {
  const t = setup(), job = t.jobs.put({ kind: 'search', state: 'done' }, 'person-a');
  t.jobs.append(job.id, 'answer.settled', { results: [offer('a', 'poshmark', 4500), offer('b', 'poshmark', 5000), offer('c', 'dupe', 6000)], sites_pending: [] });
  const r = await t.post('person-a', { surface: 'buy', text: 'analyse', search_job_id: job.id });
  await t.tasks[0]();
  const frames = t.jobs.framesAfter(r.body.id, 0);
  const settled = frames.find(f => f.event === 'assist.settled')!.data;
  assert.deepEqual((settled.results as Record<string, ToolResult>).r1.rows.filter(row => row.kind !== 'site_summary').map(row => row.id), ['a', 'b', 'c']);
  assert.ok(JSON.stringify(settled.blocks).includes('$45'));
  assert.ok(!JSON.stringify(frames).includes('$999'));
});

test('no configured key refuses cleanly before any job or background task', async () => {
  const t = setup();
  let puts = 0;
  const handler = createAssistHandler({ env: { SECONDHAND_EXAMPLES: '0' }, jobs: { ...t.jobs, put(...args) { puts++; return t.jobs.put(...args); } } });
  await assert.rejects(Promise.resolve().then(() => handler(t.ctx('vis_a'), new Request('http://test'))),
    (e: unknown) => e instanceof ApiError && e.status === 503 && e.code === 'unavailable' && e.message === 'The conversation is not configured here.' && e.extra.reason === 'not_configured');
  assert.equal(puts, 0);
});

for (const [cause, change] of [
  ['empty text', { text: '' }], ['long text', { text: 'x'.repeat(2001) }],
  ['too much history', { history: Array.from({ length: 11 }, () => ({ role: 'user', text: 'old' })) }],
  ['long history turn', { history: [{ role: 'user', text: 'x'.repeat(4001) }] }],
  ['bad history role', { history: [{ role: 'system', text: 'old' }] }],
  ['bad image type', { image: { media_type: 'image/gif', data_base64: 'YQ==' } }],
  ['large image', { image: { media_type: 'image/png', data_base64: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') } }],
  ['invalid base64', { image: { media_type: 'image/png', data_base64: '%%%%' } }],
  ['visitor private reference', { item_id: 'it_a' }],
] as const) test('bad input: ' + cause + ' creates no job', async () => {
  const t = setup();
  await rejects(t.post('vis_a', { surface: 'buy', text: 'jacket', ...change }), 'invalid', 400);
  assert.equal(t.tasks.length, 0);
  assert.equal(t.requests.length, 0);
});

test('valid visitor photo is accepted and reaches converse without appearing in logs', async () => {
  const t = setup(), image = { media_type: 'image/png', data_base64: 'cHJpdmF0ZSBwaG90bw==' };
  const r = await t.post('vis_a', { surface: 'buy', text: 'private request', image, history: [{ role: 'assistant', text: 'private history' }] });
  assert.equal(r.status, 202);
  await t.tasks[0]();
  assert.ok(JSON.stringify(t.requests).includes(image.data_base64));
  for (const value of [image.data_base64, 'private request', 'private history']) assert.ok(!t.sink.text().includes(value));
});

test('twenty concurrent visitor turns reserve exactly 500 cents before running; people remain allowed', async () => {
  const t = setup();
  const starts = await Promise.all(Array.from({ length: 20 }, (_, i) => t.post('vis_' + i)));
  assert.equal(starts.length, 20);
  assert.equal(t.requests.length, 0);
  await assert.rejects(t.post('vis_next'), (e: unknown) => e instanceof ApiError && e.status === 429
    && e.code === 'rate_limited' && e.extra.cap === 'daily' && e.retry.after_s === 60);
  assert.equal((await t.post('person-a')).status, 202);
  t.setNow(Date.parse('2026-11-16T00:00:00Z'));
  assert.equal((await t.post('vis_next')).status, 202);
});

test('completed visitor reservations settle to actual cost and release unused budget', async () => {
  const t = setup();
  for (let i = 0; i < 20; i++) await t.post('vis_' + i);
  await rejects(t.post('vis_next'), 'rate_limited', 429);
  await t.tasks[0]();
  await t.tasks[1]();
  assert.equal((await t.post('vis_next')).status, 202);
});

test('visitor pool reaches exactly 500 cents of actual cost and resets at UTC midnight', async () => {
  const t = setup();
  const billable = message();
  Object.assign(billable.usage, { cost: 0.25 });
  const client: StreamClient = { messages: { stream() { return { on() {}, async finalMessage() { return billable; } }; } } };
  const tasks: (() => Promise<void>)[] = [];
  const handler = createAssistHandler({ env: { SECONDHAND_EXAMPLES: '0' }, jobs: t.jobs, now: () => NOW, params: assistParams,
    client: { client, model: 'stand-in' }, tools, budget: visitorBudget(), schedule: task => tasks.push(task) });
  for (let i = 0; i < 20; i++) {
    await handler(t.ctx('vis_a'), new Request('http://test'));
    await tasks.at(-1)!();
  }
  await assert.rejects(Promise.resolve().then(() => handler(t.ctx('vis_b'), new Request('http://test'))),
    (e: unknown) => e instanceof ApiError && e.extra.cap === 'daily');
});

test('real Request goes through visitor auth and per-minute limit with X-Visitor-Id', async () => {
  const t = setup();
  deps.verify = async () => null; deps.log = t.log; deps.visits.clear(); deps.now = () => NOW;
  const post = route('POST /v1/assist', t.handler, { auth: 'visitor' });
  const request = () => new Request('http://test/v1/assist', { method: 'POST', body: JSON.stringify({ surface: 'buy', text: 'jacket' }) });
  const response = await post(request());
  assert.equal(response.status, 202);
  assert.ok(response.headers.get('X-Visitor-Id')?.startsWith('vis_'));
  const limit = deps.visitorPerMinute;
  deps.visitorPerMinute = 0;
  try { assert.equal((await post(request())).status, 429); } finally { deps.visitorPerMinute = limit; }
});

test('vis_example01 is never allowed to own a real assist job', async () => {
  const t = setup();
  await rejects(t.post('vis_example01'), 'invalid', 400);
  assert.equal(t.tasks.length, 0);
});

test('example mode preserves the specified POST contract and the Expo entry uses visitor auth', async () => {
  const t = setup(), e = example('assist.parse');
  const h = createAssistHandler({ env: { SECONDHAND_EXAMPLES: '1' }, jobs: t.jobs });
  const response = await h(t.ctx('usr_8f2k', e.request!.body as Record<string, unknown>), new Request('http://test'));
  assert.ok(!(response instanceof Response));
  assert.deepEqual(response.body, e.response);
  assert.equal(response.status, 202);
  assert.equal(manifest.find(m => m.endpoint === 'POST /v1/assist')?.auth, 'visitor');
  assert.equal(typeof handlers['POST /v1/assist'], 'function');
  const source = readFileSync(new URL('../../app/v1/assist/index+api.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("auth: 'visitor'"));
});

test('legacy surfaces and signed-in reference ids are validated, recorded by presence, and disclose missing readers', async () => {
  const t = setup();
  for (const surface of ['buy', 'sell', 'capture', 'market', 'item', 'want']) {
    const r = await t.post('person-a', { surface, text: 'jacket', item_id: 'it_a', want_id: 'want_a', capture_id: 'cap_a' });
    await t.tasks.at(-1)!();
    const answer = t.jobs.get(r.body.id, 'person-a')!.result as { not_built: string[] };
    for (const field of ['item_id', 'want_id', 'capture_id']) assert.ok(answer.not_built.some(line => line.includes(field)));
  }
  for (const value of ['it_a', 'want_a', 'cap_a']) assert.ok(!t.sink.text().includes('"' + value + '"'));
  await rejects(t.post('person-a', { surface: 'item', text: 'jacket', item_id: 7 }), 'invalid', 400);
});

test('malformed JSON, missing fields, and invalid pagination keep the existing fields helper code', async () => {
  const t = setup();
  deps.verify = async () => 'person-a'; deps.log = t.log;
  const h = route('POST /v1/assist', t.handler, { auth: 'visitor' });
  for (const body of ['{', '[]', 'null', '{}']) assert.equal((await h(new Request('http://test/v1/assist', { method: 'POST', body }))).status, 400);
  await rejects(Promise.resolve().then(() => t.handler({ ...t.ctx('person-a'), query: new URLSearchParams('limit=101') }, new Request('http://test'))), 'invalid', 400);
});

test('idempotent reconnect replays the same job and changed input is refused', async () => {
  const t = setup();
  deps.verify = async () => 'person-a'; deps.log = t.log; deps.idem.clear();
  const h = route('POST /v1/assist', t.handler, { auth: 'visitor' });
  const request = (text: string) => new Request('http://test/v1/assist', { method: 'POST', headers: { Authorization: 'Bearer person-a', 'Idempotency-Key': 'assist-test' }, body: JSON.stringify({ surface: 'buy', text }) });
  const first = await h(request('jacket')), again = await h(request('jacket'));
  assert.equal(first.status, 202);
  assert.equal(await first.text(), await again.text());
  assert.equal(again.headers.get('Idempotent-Replayed'), 'true');
  assert.equal(t.tasks.length, 1);
  assert.equal((await h(request('changed'))).status, 409);
});

test('boundary lengths and exactly five MiB of decoded visitor image are accepted', async () => {
  const t = setup();
  const image = { media_type: 'image/webp', data_base64: Buffer.alloc(5 * 1024 * 1024, 1).toString('base64') };
  const response = await t.post('vis_a', { surface: 'buy', text: 'x'.repeat(2000),
    history: Array.from({ length: 10 }, () => ({ role: 'assistant', text: 'h'.repeat(4000) })), image });
  assert.equal(response.status, 202);
  assert.equal(t.tasks.length, 1);
});

test('visitor cannot send any private reference and references are not looked up for a person', async () => {
  const t = setup();
  for (const [field, value] of [['item_id', 'it_a'], ['want_id', 'want_a'], ['capture_id', 'cap_a']]) {
    await rejects(t.post('vis_a', { surface: 'buy', text: 'coat', [field]: value }), 'invalid', 400);
    await rejects(t.post('person-a', { surface: 'buy', text: 'coat', [field]: '' }), 'invalid', 400);
    assert.equal((await t.post('person-a', { surface: 'buy', text: 'coat', [field]: value })).status, 202);
  }
});

test('next midnight retry and daily cap reach the app through the shared ApiError response', async () => {
  const t = setup();
  for (let i = 0; i < 20; i++) await t.post('vis_' + i);
  deps.verify = async () => null; deps.log = t.log; deps.visits.clear();
  const response = await route('POST /v1/assist', t.handler, { auth: 'visitor' })(new Request('http://test/v1/assist', {
    method: 'POST', body: JSON.stringify({ surface: 'buy', text: 'coat' }),
  }));
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.code, 'rate_limited');
  assert.equal(body.cap, 'daily');
  assert.equal(body.retry.after_s, 60);
});

function askingRoute(kind: 'pick_one' | 'pick_many' | 'yes_no' | 'text' | 'number_with_unit' = 'pick_one') {
  const t = setup(); let asks = 0;
  const handler = createAssistHandler({ env: {}, jobs: t.jobs, params: assistParams, now: () => NOW, tools,
    client: { model: 'stand-in', client: { messages: { stream(p) {
      t.requests.push(structuredClone(p)); const m = message();
      if (++asks <= 2) {
        m.stop_reason = 'tool_use';
        m.content = [{ type: 'tool_use', id: 'size-question', name: 'ask_person', caller: { type: 'direct' }, input: {
          field: 'size', kind, words: 'PRIVATE_ASK_WORDS', other: false, why: 'value',
          options: [{ value: 'small', label: 'Small', proposed: false, cites: [], rests_on: [] },
            { value: 'medium', label: 'Medium', proposed: true, cites: [], rests_on: [] }],
          ...(kind === 'text' ? { max_length: 20 } : {}),
          ...(kind === 'number_with_unit' ? { unit: 'cm', units: ['cm', 'in'] } : {}),
        } }];
      } else m.content = [{ type: 'text', text: 'These match.', citations: null }];
      return { on() {}, finalMessage: async () => m };
    } } } }, schedule: task => t.tasks.push(task) });
  const post = async (owner = 'person-a', answer?: unknown) => {
    const response = await handler(t.ctx(owner, { surface: 'buy', text: 'Chosen size', ...(answer === undefined ? {} : { answer }) }), new Request('http://test'));
    assert.ok(!(response instanceof Response)); return { status: response.status, id: (response.body as { id: string }).id };
  };
  const ask = async () => {
    const response = await post(); await t.tasks.at(-1)!();
    const result = t.jobs.get(response.id, 'person-a')!.result as import('../assist/types.ts').Answer;
    const block = result.blocks.find(b => b.type === 'ask'); assert.ok(block?.type === 'ask'); return block.ask;
  };
  return { ...t, post, ask };
}

test('answers are owner scoped, superseded across turns, reach the model as a note, and close once', async () => {
  const t = askingRoute(), first = await t.ask();
  await rejects(t.post('person-b', { ask_id: first.id, field: 'size', value: 'medium' }), 'not_found', 404);
  await rejects(t.post('person-a', { ask_id: 'q_unknown_size', field: 'size', value: 'medium' }), 'not_found', 404);
  await rejects(t.post('person-a', { ask_id: first.id, field: 'size', value: 'extra-large' }), 'invalid', 422);
  await rejects(t.post('person-a', { ask_id: first.id, field: 'other', value: 'medium' }), 'invalid', 422);
  const second = await t.ask(); assert.equal(second.replaces, first.id);
  const settled = t.jobs.framesAfter(second.id.slice(2, -5), 0).find(f => f.event === 'assist.settled');
  assert.ok(JSON.stringify(settled?.data).includes(first.id), 'replaces must be visible in the settled stream');
  await rejects(t.post('person-a', { ask_id: first.id, field: 'size', value: 'medium' }), 'conflict', 409);
  const response = await t.post('person-a', { ask_id: second.id, field: 'size', value: 'medium' });
  assert.equal(response.status, 202); await t.tasks.at(-1)!();
  assert.ok(JSON.stringify(t.requests.at(-1)?.messages).includes('answer to ' + second.id));
  assert.ok(JSON.stringify(t.requests.at(-1)?.messages).includes('size = \\"medium\\"'));
  await rejects(t.post('person-a', { ask_id: second.id, field: 'size', value: 'medium' }), 'not_found', 404);
  assert.ok(!t.sink.text().includes('PRIVATE_ASK_WORDS'));
});

for (const [kind, good, bad] of [
  ['pick_many', ['small', 'medium'], ['unlisted']], ['yes_no', false, 'yes'],
  ['text', '  PRIVATE_ANSWER  ', 'x'.repeat(21)], ['number_with_unit', 42.5, '42.5'],
] as const) test(`answer validation follows ${kind}`, async () => {
  const t = askingRoute(kind), ask = await t.ask();
  await rejects(t.post('person-a', { ask_id: ask.id, field: ask.field, value: bad }), 'invalid', 422);
  assert.equal((await t.post('person-a', { ask_id: ask.id, field: ask.field, value: good })).status, 202);
  await t.tasks.at(-1)!();
  assert.ok(JSON.stringify(t.requests.at(-1)?.messages).includes('answer to ' + ask.id));
  assert.ok(!t.sink.text().includes('PRIVATE_ANSWER'));
});

test('pruning a job also forgets its open asks', async () => {
  const t = askingRoute(), ask = await t.ask(); t.jobs.prune(Date.now() + 86400000);
  await rejects(t.post('person-a', { ask_id: ask.id, field: ask.field, value: 'small' }), 'not_found', 404);
});

test('question and answer logging passes the shared log contract and stores only lengths and hashes', async () => {
  const t = askingRoute(), ask = await t.ask();
  const value = 'medium';
  await t.post('person-a', { ask_id: ask.id, field: ask.field, value });
  await t.tasks.at(-1)!();
  t.log.end();
  const { checkLog } = await import('../../../../spec/log.mjs');
  assert.deepEqual(checkLog(t.sink.text()).problems, []);
  const logged = t.sink.lines.map(line => JSON.parse(line) as Record<string, unknown>);
  const answered = logged.find(line => line.msg === 'assist.answer');
  assert.equal(answered?.length, JSON.stringify(value).length);
  assert.equal(answered?.value_hash, (await import('../../engines/proof/sha256.ts')).sha256Hex(JSON.stringify(value)));
  for (const line of logged) assert.ok(!JSON.stringify(line).includes('PRIVATE_ASK_WORDS'));
  const calls = logged.filter(line => line.event === 'call.start' && line.name === 'ask_person');
  assert.ok(calls.length > 0);
  assert.ok(calls.every(line => !JSON.stringify(line.input).includes('medium')));
});

for (const count of [84, 307]) test(`round 4 route replay answers from all ${count} attached listings on three sites`, async () => {
  const t = setup(), query = 'carhartt detroit jacket';
  const search = t.jobs.put({ kind: 'search', state: 'done' }, 'person-a');
  const sites = ['poshmark', 'ebay', 'dupe'];
  const siteCounts = Object.fromEntries(sites.map((site, index) => [site, Math.floor((count + 2 - index) / 3)]));
  t.jobs.append(search.id, 'answer.settled', { results: Array.from({ length: count }, (_, i) => offer(`ls_coat_${i}`, sites[i % 3], 4500)),
    sites_pending: [], at: '2026-11-15T14:58:00Z',
    answer: { slots: { text: query }, found: { results_used: count, results_found: count, sites: siteCounts } } });
  t.jobs.append(search.id, 'job.state', { state: 'done' });
  const empty = t.jobs.put({ kind: 'search', state: 'running' }, 'person-a');
  t.jobs.append(empty.id, 'answer.partial', { results: [], sites_pending: sites });
  let searches = 0;
  const handler = createAssistHandler({ env: {}, jobs: t.jobs, params: assistParams, now: () => NOW,
    fetch: noNetwork, schedule: task => t.tasks.push(task),
    toolDeps: { caller: 'person', store: null, now: () => NOW, log: t.log, sold: async () => { throw new Error('unexpected sold read'); },
      searchJob: { start: async () => { searches++; return { id: empty.id }; }, listen: t.jobs.listen, framesAfter: t.jobs.framesAfter } },
    client: { model: 'stand-in', client: { messages: { stream(p) {
      t.requests.push(structuredClone(p));
      const final = message();
      const first = p.messages[0].content;
      assert.ok(Array.isArray(first));
      const seed = first.find(b => b.type === 'text' && b.text.startsWith('seed result'));
      assert.ok(seed?.type === 'text');
      const result = JSON.parse(seed.text.slice(seed.text.indexOf('\n') + 1)) as ToolResult;
      const text = `${result.counts.rows} listings for sale now [r1]. ${sites.map(site => `${site}: ${result.counts[`${site}_n`]} listings [r1].`).join(' ')}`;
      final.content = [{ type: 'text', text: `## What we measured\n${text}\n[widget:r5]\nIt failed with not_connected.\nSources:`, citations: null }];
      if (t.requests.length === 1 && count === 84) {
        final.stop_reason = 'tool_use';
        final.content.push({ type: 'tool_use', id: 'redundant-search', name: 'search_market', input: { query }, caller: { type: 'direct' } });
      }
      return { on() {}, finalMessage: async () => final };
    } } } },
  });
  const response = await handler(t.ctx('person-a', { surface: 'buy', text: 'What do these rows show?', search_job_id: search.id }), new Request('http://test'));
  assert.ok(!(response instanceof Response));
  await t.tasks[0]();
  const job = t.jobs.get((response.body as { id: string }).id, 'person-a')!;
  const answer = job.result as import('../assist/types.ts').Answer;
  assert.equal(job.state, 'done');
  assert.equal(searches, 0, 'the attached item must never start a second search');
  const text = answer.blocks.flatMap(b => b.type === 'text' ? [b.text] : []).join('');
  assert.match(text, new RegExp(`\\b${count} listings for sale now`));
  for (const site of sites) assert.match(text, new RegExp(`${site}: ${siteCounts[site]} listings`));
  assert.doesNotMatch(text, /\*\*|\[widget:|not_connected|search_market|Sources:|stopped early/);
  const deltas = t.jobs.framesAfter(job.id, 0).filter(f => f.event === 'assist.text').map(f => String(f.data.delta)).join('');
  assert.doesNotMatch(deltas, /\*\*|\[widget:|not_connected|search_market|Sources:|stopped early/);
});

test('round 4 route gate never lets a web citation back a prose figure', async () => {
  const t = setup();
  const final = (JSON.parse(readFileSync(new URL('../assist/fixtures/converse/citation.json', import.meta.url), 'utf8')) as Message[])[0];
  const block = final.content.find(b => b.type === 'text' && b.citations?.length);
  assert.ok(block?.type === 'text');
  block.text = 'They sell for $150 to $400 depending on era.';
  for (const citation of block.citations ?? []) if (citation.type === 'web_search_result_location') citation.cited_text = block.text;
  const handler = createAssistHandler({ env: {}, jobs: t.jobs, now: () => NOW, tools, fetch: noNetwork,
    client: { model: 'stand-in', client: { messages: { stream() { return { on() {}, finalMessage: async () => final }; } } } },
    schedule: task => t.tasks.push(task) });
  const response = await handler(t.ctx('person-a'), new Request('http://test'));
  assert.ok(!(response instanceof Response));
  await t.tasks[0]();
  const job = t.jobs.get((response.body as { id: string }).id, 'person-a')!;
  assert.equal(job.state, 'done');
  const answer = job.result as import('../assist/types.ts').Answer;
  assert.equal(answer.sources.length, 1);
  assert.doesNotMatch(JSON.stringify(answer.blocks), /\$150|\$400/);
  assert.doesNotMatch(JSON.stringify(t.jobs.framesAfter(job.id, 0).filter(f => f.event === 'assist.text')), /\$150|\$400/);
  assert.equal(answer.gate.cut, 1);
});
