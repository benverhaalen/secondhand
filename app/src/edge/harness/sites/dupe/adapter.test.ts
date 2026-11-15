// Dupe.com search on the fixtures (the envelopes as recorded, the search rows written by hand), plus the failure envelopes and Dupe's published conditions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createLog, memorySink } from '../../../../../../log/index.js';
import { ENDPOINT, MIN_GAP_MS, ROUTE_ID, createDupe, type Reply, type Send } from './adapter.ts';

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');
const sse = (o: unknown) => `event: message\ndata: ${JSON.stringify(o)}\n\n`;
const data = (t: string): Record<string, unknown> => JSON.parse(t.split('\n').find(l => l.startsWith('data:'))!.slice(5));
const reply = (status: number, text: string, headers: Record<string, string> = {}): Reply =>
  ({ status, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, text: async () => text });
const ok = (text: string, extra: Record<string, string> = {}) => reply(200, text, { 'content-type': 'text/event-stream', 'mcp-session-id': 'sess-1', ...extra });

// The search response with its products replaced, for the price and schema cases.
function searchWith(edit: (p: { products: Record<string, unknown>[] }) => void): string {
  const env = data(fx('search.sse')) as { result: { content: { text: string }[] } };
  const p = JSON.parse(env.result.content[0].text); edit(p);
  env.result.content[0].text = JSON.stringify(p);
  return sse(env);
}

type Sent = { method: string; headers: Record<string, string>; body: Record<string, unknown> };
function harness(o: { search?: () => Reply; tools?: string; init?: () => Reply } = {}) {
  const sent: Sent[] = []; const sleeps: number[] = []; let clock = 1_763_190_000_000;
  const send: Send = async (url, init) => {
    assert.equal(url, ENDPOINT);
    const body = JSON.parse(init.body) as Record<string, unknown>; sent.push({ method: String(body.method), headers: init.headers, body });
    if (body.method === 'initialize') return o.init ? o.init() : ok(fx('initialize.sse'));
    if (body.method === 'notifications/initialized') return reply(202, '');
    if (body.method === 'tools/list') return ok(o.tools ?? fx('tools-list.sse'));
    return o.search ? o.search() : ok(fx('search.sse'));
  };
  const sink = memorySink();
  const log = createLog({ src: 'test.dupe', build: 'test', sink });
  const dupe = createDupe({ send, log, now: () => clock, sleep: async ms => { sleeps.push(ms); clock += ms; } });
  return { dupe, sent, sleeps, sink, tick: (ms: number) => { clock += ms; } };
}
const s = new AbortController().signal;

test('search speaks MCP over HTTP: initialize, initialized, tools/list, then the tool call with a generic client name', async () => {
  const h = harness();
  const r = await h.dupe.search({ q: "levi's 501" }, s);
  assert.equal(r.ok, true);
  assert.deepEqual(h.sent.map(x => x.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
  assert.match(h.sent[0].headers.accept, /text\/event-stream/);
  assert.equal(h.sent[0].headers['user-agent'], 'secondhand-client/0.1');
  assert.equal(h.sent[0].headers['mcp-session-id'], undefined);
  assert.equal(h.sent[3].headers['mcp-session-id'], 'sess-1');
  assert.deepEqual(h.sent[3].body.params, { name: 'search_products_by_text', arguments: { query: "levi's 501", refresh: false, search_category: 'all' } });
  assert.equal(ROUTE_ID, 'dupe.search.api');
});

test('rows: the canonical shape plus source_site, Dupe link verbatim, compensated flag, attribution and keep_until', async () => {
  const h = harness();
  const r = await h.dupe.search({ q: "levi's 501", category: 'Fashion' }, s);
  assert.ok(r.ok);
  const raw = (JSON.parse((data(fx('search.sse')) as { result: { content: { text: string }[] } }).result.content[0].text) as { products: { link: string }[] }).products;
  assert.equal(r.data.rows.length, 6);
  assert.deepEqual(r.data.rows.map(x => x.url), raw.map(p => p.link)); // links are never altered
  assert.deepEqual(r.data.rows.map(x => x.source_site), ['Poshmark', 'Depop', 'eBay', 'eBay', 'Ebay', 'Walmart']);
  assert.deepEqual(r.data.rows.map(x => x.price_cents), [1500, 1614, 2499, 2999, 2500, 3578]);
  assert.deepEqual(r.data.rows.map(x => x.secondhand), [true, true, true, true, false, false]);
  for (const row of r.data.rows) {
    assert.match(row.id, /^dupe-[0-9a-f]{12}$/);
    assert.equal(row.currency, 'USD');
    assert.equal(row.commercial_link, true);
    assert.equal(row.attribution, 'Dupe.com');
    assert.equal(row.keep_until, r.data.keep_until);
    assert.ok(row.title.length > 0);
    assert.match(row.image_url ?? '', /^https:\/\//);
  }
  assert.equal(new Set(r.data.rows.map(x => x.id)).size, 6);
  assert.equal(h.sent[3].body.params && (h.sent[3].body.params as { arguments: { search_category: string } }).arguments.search_category, 'Fashion');
});

test('keep_until is the request time: Dupe publishes no cache period, so nothing outlives the request', async () => {
  const h = harness();
  const r = await h.dupe.search({ q: 'x' }, s);
  assert.ok(r.ok);
  assert.equal(r.data.keep_until, new Date(1_763_190_000_000).toISOString());
});

test('a price that is not a safe whole number of cents drops the row and is counted', async () => {
  const h = harness({ search: () => ok(searchWith(p => {
    (p.products[0].price as Record<string, unknown>).extracted_value = 12.345;
    (p.products[1].price as Record<string, unknown>).extracted_value = 1e17;
    (p.products[2].price as Record<string, unknown>).extracted_value = '24.99';
    delete p.products[3].link;
  })) });
  const r = await h.dupe.search({ q: 'x' }, s);
  assert.ok(r.ok);
  assert.equal(r.data.rows.length, 2);
  assert.equal(r.data.dropped, 4);
});

test('pace: one search at a time, starts at least MIN_GAP_MS apart', async () => {
  const h = harness();
  await Promise.all([h.dupe.search({ q: 'a' }, s), h.dupe.search({ q: 'b' }, s), h.dupe.search({ q: 'c' }, s)]);
  assert.equal(MIN_GAP_MS, 3000);
  assert.deepEqual(h.sleeps, [3000, 3000]);
  assert.deepEqual(h.sent.filter(x => x.method === 'tools/call').map(x => (x.body.params as { arguments: { query: string } }).arguments.query), ['a', 'b', 'c']);
  assert.equal(h.sent.filter(x => x.method === 'initialize').length, 1); // the session is reused
  h.tick(10_000);
  await h.dupe.search({ q: 'd' }, s);
  assert.equal(h.sleeps.length, 2); // a gap already waited out needs no sleep
});

test('429 answers rate_limited and honours Retry-After in seconds or as a date', async () => {
  const a = await harness({ search: () => reply(429, '', { 'retry-after': '42' }) }).dupe.search({ q: 'x' }, s);
  assert.deepEqual(a.ok ? null : a.error, { code: 'rate_limited', message: 'Dupe answered 429', hint: { do: 'retry_after', after_s: 42 } });
  const b = await harness({ search: () => reply(429, '', { 'retry-after': new Date(1_763_190_000_000 + 90_000).toUTCString() }) }).dupe.search({ q: 'x' }, s);
  assert.ok(!b.ok && b.error.code === 'rate_limited' && 'after_s' in b.error.hint && b.error.hint.after_s === 90);
  const c = await harness({ search: () => reply(429, '') }).dupe.search({ q: 'x' }, s);
  assert.ok(!c.ok && 'after_s' in c.error.hint && c.error.hint.after_s === 60);
});

test('an auth demand answers no_route with a handoff: there is no account to relink', async () => {
  for (const r of [reply(401, ''), reply(403, '', { 'www-authenticate': 'Bearer' })]) {
    const x = await harness({ init: () => r }).dupe.search({ q: 'x' }, s);
    assert.ok(!x.ok); assert.equal(x.error.code, 'no_route'); assert.deepEqual(x.error.hint, { do: 'handoff', url: 'https://dupe.com' });
  }
});

test('a refusal or challenge answers blocked and pauses the source', async () => {
  for (const r of [reply(403, '<html>denied</html>', { 'content-type': 'text/html' }), reply(200, '<html>challenge</html>', { 'content-type': 'text/html' }), reply(500, '')]) {
    const x = await harness({ search: () => r }).dupe.search({ q: 'x' }, s);
    assert.ok(!x.ok); assert.equal(x.error.code, 'blocked'); assert.deepEqual(x.error.hint, { do: 'pause_session', site: 'dupe' });
  }
  const tool = await harness({ search: () => ok(sse({ jsonrpc: '2.0', id: 3, result: { isError: true, content: [{ type: 'text', text: 'You are not allowed' }] } })) }).dupe.search({ q: 'x' }, s);
  assert.ok(!tool.ok && tool.error.code === 'blocked');
});

test('a changed tool schema answers page_changed before any search is sent', async () => {
  const env = data(fx('tools-list.sse')) as { result: { tools: { name: string; inputSchema: { required: string[] } }[] } };
  env.result.tools.find(t => t.name === 'search_products_by_text')!.inputSchema.required.push('api_key');
  const h = harness({ tools: sse(env) });
  const x = await h.dupe.search({ q: 'x' }, s);
  assert.ok(!x.ok); assert.equal(x.error.code, 'page_changed'); assert.deepEqual(x.error.hint, { do: 'author', missing: ['search_products_by_text'] });
  assert.equal(h.sent.some(m => m.method === 'tools/call'), false);
  const gone = await harness({ tools: sse({ jsonrpc: '2.0', id: 2, result: { tools: [] } }) }).dupe.search({ q: 'x' }, s);
  assert.ok(!gone.ok && gone.error.code === 'page_changed');
});

test('a validation error or an unreadable result answers page_changed', async () => {
  const bodies = [
    sse({ jsonrpc: '2.0', id: 3, result: { isError: true, content: [{ type: 'text', text: 'MCP error -32602: Input validation error: Required at refresh' }] } }),
    sse({ jsonrpc: '2.0', id: 3, error: { code: -32602, message: 'bad params' } }),
    sse({ jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'not json' }] } }),
    sse({ jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: '{"products":"no"}' }] } }),
    'event: message\n\n',
  ];
  for (const b of bodies) {
    const x = await harness({ search: () => ok(b) }).dupe.search({ q: 'x' }, s);
    assert.ok(!x.ok, b); assert.equal(x.error.code, 'page_changed', b);
  }
});

test('an expired session (404) is re-initialized once', async () => {
  let n = 0;
  const h = harness({ search: () => (++n === 2 ? reply(404, '') : ok(fx('search.sse'))) });
  assert.ok((await h.dupe.search({ q: 'a' }, s)).ok);
  assert.ok((await h.dupe.search({ q: 'b' }, s)).ok);
  assert.equal(h.sent.filter(x => x.method === 'initialize').length, 2);
  const dead = await harness({ search: () => reply(404, '') }).dupe.search({ q: 'x' }, s);
  assert.ok(!dead.ok && dead.error.code === 'blocked');
});

test('inputs: a missing query or an unknown category is refused before any call', async () => {
  const h = harness();
  for (const a of [{}, { q: '  ' }, { q: 'x', category: 'Spaceships' }]) {
    const x = await h.dupe.search(a, s);
    assert.ok(!x.ok); assert.equal(x.error.code, 'policy_refused'); assert.deepEqual(x.error.hint, { do: 'raise_decision', kind: 'missing_input' });
  }
  assert.equal(h.sent.length, 0);
});

test('every verb but search answers no_route: Dupe is a search-only source', async () => {
  const h = harness();
  for (const v of ['read_listings', 'post', 'make_offer', 'save'] as const) {
    const x = await h.dupe.call(v, {}, s);
    assert.ok(!x.ok); assert.equal(x.error.code, 'no_route'); assert.match(x.error.message, /search-only/);
  }
  assert.ok((await h.dupe.call('search', { q: 'x' }, s)).ok);
});

test('each outside call is logged with its result, and the query text stays out of the log', async () => {
  const h = harness();
  await h.dupe.search({ q: 'private words' }, s);
  const lines = h.sink.lines;
  assert.ok(lines.some(l => l.includes('"call.start"') && l.includes('dupe.search_products_by_text')));
  assert.ok(lines.some(l => l.includes('"call.end"') && l.includes('"rows":6')));
  assert.equal(lines.some(l => l.includes('private words')), false);
});
