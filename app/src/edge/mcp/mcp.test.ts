import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicOnly, server, TOOLS, type Handler, type ToolName } from './mcp.ts';

const share = { may_share: true }, noShare = { may_share: false };
const handlers = Object.fromEntries((Object.keys(TOOLS) as ToolName[]).map(n => [n, (async args => ({
  tool: n, args, user_id: 'u_1', results: [{ title: 'a', rights: share, seller_ref: 'x' }, { title: 'b', rights: noShare }, { kind: 'listing', id: 'ls_1' }],
})) as Handler])) as Record<ToolName, Handler>;
const rpc = (method: string, params?: object, id = 1) => ({ jsonrpc: '2.0', id, method, params });

test('one MCP tool per public search endpoint', async () => {
  const h = server(handlers);
  const r = await h(rpc('tools/list'), 'k');
  const names = ((r.body!.result as { tools: { name: string }[] }).tools).map(t => t.name);
  assert.deepEqual(names, ['search', 'product', 'compare', 'history', 'trends']);
});

test('a private field is stripped and a row without may_share or a person\'s listing is never served', async () => {
  const h = server(handlers);
  const r = await h(rpc('tools/call', { name: 'search', arguments: { text: 'levi 501' } }), 'k');
  const out = (r.body!.result as { structuredContent: { user_id?: string; results: object[] } }).structuredContent;
  assert.equal(out.user_id, undefined);
  assert.deepEqual(out.results, [{ title: 'a', rights: share }]);
  assert.deepEqual(publicOnly({ a: { email: 'x', b: [{ rights: noShare }] } }), { a: { b: [] } });
});

test('over the rate limit answers 429 with retry-after', async () => {
  let t = 0;
  const h = server(handlers, { perMinute: 2, now: () => t });
  assert.equal((await h(rpc('ping'), 'k')).status, 200);
  assert.equal((await h(rpc('ping'), 'k')).status, 200);
  const r = await h(rpc('ping'), 'k');
  assert.equal(r.status, 429);
  assert.equal(r.headers!['retry-after'], '30');
  assert.equal((await h(rpc('ping'), 'other')).status, 200, 'per key');
  t = 60000;
  assert.equal((await h(rpc('ping'), 'k')).status, 200, 'refills');
});

test('initialize, unknown tool, missing argument, a failing handler, a bad request, a notification', async () => {
  const h = server({ ...handlers, product: async () => { throw new Error('db down'); } });
  assert.equal(((await h(rpc('initialize'), 'k')).body!.result as { protocolVersion: string }).protocolVersion, '2025-06-18');
  assert.equal(((await h(rpc('tools/call', { name: 'nope' }), 'k')).body!.error as { code: number }).code, -32602);
  assert.equal(((await h(rpc('tools/call', { name: 'history', arguments: {} }), 'k')).body!.result as { isError: boolean }).isError, true);
  const fail = (await h(rpc('tools/call', { name: 'product', arguments: { id: 'pr_1' } }), 'k')).body!.result as { isError: boolean; content: { text: string }[] };
  assert.equal(fail.isError, true);
  assert.ok(!fail.content[0]!.text.includes('db down'));
  assert.equal(((await h({ nope: 1 }, 'k')).body!.error as { code: number }).code, -32600);
  assert.equal((await h({ jsonrpc: '2.0', method: 'notifications/initialized' }, 'k')).status, 202);
});
