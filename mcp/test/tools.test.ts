import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createClient, parseBlock } from '../src/client.ts';
import { createServer, summarize } from '../src/tools.ts';
import { startFakeApi, VISITOR } from './fake-api.ts';

type Result = { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, any> };

async function connect(opts: { modelKey?: boolean } = {}) {
  const api = await startFakeApi(opts);
  const server = createServer(createClient(api.origin));
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as Result;
  return { api, call, close: async () => { await client.close(); await api.close(); } };
}

test('search_secondhand returns listings and a summary from the terminal job.state, resuming a dropped stream', async () => {
  const t = await connect();
  try {
    const result = await t.call('search_secondhand', { query: 'patagonia synchilla', max_results: 3 });
    assert.equal(result.isError, undefined, result.content[0].text);
    const s = result.structuredContent!;
    assert.equal(s.search_job_id, 'job_s1');
    assert.equal(s.listings.length, 3);
    assert.equal(s.summary.count, 7, 'the malformed row is dropped');
    assert.deepEqual(s.summary.price_spread, { currency: 'USD', p25_cents: 4500, median_cents: 5200, p75_cents: 6000, low_cents: 3800, high_cents: 7000 });
    assert.equal(s.summary.other_currency, 1);
    assert.deepEqual(s.summary.cheapest_per_site.map((c: { site: string; price_cents: number }) => [c.site, c.price_cents]),
      [['poshmark', 3800], ['ebay', 4500], ['mercari', 5200], ['depop', 7000]]);
    assert.match(result.content[0].text, /median \$52\.00/);
    const streams = t.api.seen.filter(r => r.path === '/v1/jobs/job_s1/events');
    assert.deepEqual(streams.map(r => r.lastEventId), [undefined, '1'], 'the second read resumes after id 1');
    assert.equal(t.api.seen[0].visitor, undefined);
    assert.ok(t.api.seen.slice(1).every(r => r.visitor === VISITOR), 'the issued visitor id is sent back');
    assert.deepEqual(t.api.seen[0].body, { text: 'patagonia synchilla' });
  } finally { await t.close(); }
});

test('search_secondhand passes sources and turns server errors into tool errors with the code and when to retry', async () => {
  const t = await connect();
  try {
    await t.call('search_secondhand', { query: 'fleece', sources: ['ebay', 'osint'] });
    assert.deepEqual(t.api.seen[0].body, { text: 'fleece', sources: ['ebay', 'osint'] });
    const limited = await t.call('search_secondhand', { query: 'too many' });
    assert.equal(limited.isError, true);
    assert.equal(limited.content[0].text, 'rate_limited: visitor bucket empty Retry after 60 seconds.');
    assert.deepEqual(limited.structuredContent!.error, { code: 'rate_limited', message: 'visitor bucket empty', status: 429, retry: { by: 'auto', after_s: 60 } });
    const failed = await t.call('search_secondhand', { query: 'fails' });
    assert.equal(failed.isError, true);
    assert.match(failed.content[0].text, /^site_failed: Every site failed\./);
    const rejected = await t.call('search_secondhand', { query: 'fleece', sources: ['facebook'] });
    assert.equal(rejected.isError, true, 'an unknown source is refused by the input schema');
    const empty = await t.call('search_secondhand', { query: '   ' });
    assert.equal(empty.isError, true);
  } finally { await t.close(); }
});

test('ask_market says plainly when the host has no model key', async () => {
  const t = await connect({ modelKey: false });
  try {
    const result = await t.call('ask_market', { question: 'is $45 fair?' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^unavailable: The conversation is not configured here\. This secondhand host has no model key/);
    assert.equal(result.structuredContent!.error.reason, 'not_configured');
  } finally { await t.close(); }
});

test('ask_market returns the answer without gate marks and only the cited listings', async () => {
  const t = await connect({ modelKey: true });
  try {
    const result = await t.call('ask_market', { question: 'is $45 fair?', search_job_id: 'job_s1' });
    assert.equal(result.isError, undefined, result.content[0].text);
    const s = result.structuredContent!;
    assert.equal(s.state, 'answered');
    assert.equal(s.answer, 'Most sell between $38 and $60.');
    assert.deepEqual(s.listings, [{ title: 'Patagonia Synchilla fleece M', url: 'https://ebay.example/4500', site: 'ebay', price: '$45', price_cents: 4500 }]);
    assert.deepEqual(s.web_sources, [{ url: 'https://guide.example/fleece', title: 'Fleece guide' }]);
    assert.deepEqual(t.api.seen[0].body, { surface: 'buy', text: 'is $45 fair?', search_job_id: 'job_s1' });
    const missing = await t.call('ask_market', { question: 'and this?', search_job_id: 'job_other' });
    assert.match(missing.content[0].text, /^not_found: Search job not found\./);
  } finally { await t.close(); }
});

test('list_sources lists every source id search_secondhand accepts', async () => {
  const t = await connect();
  try {
    const result = await t.call('list_sources');
    assert.deepEqual(result.structuredContent!.sources.map((s: { id: string }) => s.id), ['depop', 'ebay', 'poshmark', 'mercari', 'dupe', 'google_shopping']);
    assert.equal(t.api.seen.length, 0, 'no request spent');
  } finally { await t.close(); }
});

test('summarize and parseBlock edge cases', () => {
  assert.equal(summarize([]).price_spread, null);
  const one = summarize([{ title: 'a', url: 'u', site: 'ebay', price: { amount_cents: 999, currency: 'USD' }, delivered: null }]);
  assert.deepEqual(one.price_spread, { currency: 'USD', p25_cents: 999, median_cents: 999, p75_cents: 999, low_cents: 999, high_cents: 999 });
  assert.deepEqual(parseBlock('id: 7\r\nevent: job.state\r\ndata: {"state":"done"}'), { id: 7, event: 'job.state', data: { state: 'done' } });
  assert.equal(parseBlock('event: x\ndata: {}'), null, 'no id');
  assert.equal(parseBlock('id: 1\ndata: [1]'), null, 'not an object');
});

test('over stdio, initialize and tools/list show the three tools', async () => {
  const api = await startFakeApi();
  const transport = new StdioClientTransport({
    command: process.execPath, args: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
    env: { ...process.env, SECONDHAND_API_ORIGIN: api.origin } as Record<string, string>, stderr: 'pipe',
  });
  const client = new Client({ name: 'stdio-test', version: '0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['ask_market', 'list_sources', 'search_secondhand']);
    for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
    const result = (await client.callTool({ name: 'search_secondhand', arguments: { query: 'fleece' } })) as Result;
    assert.equal(result.structuredContent!.summary.count, 7);
  } finally { await client.close(); await api.close(); }
});
