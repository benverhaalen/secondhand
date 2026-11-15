import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, memorySink } from '../../../../log/index.js';
import { genie, genieFromEnv, type GenieDeps } from './genie.ts';

const NOW = Date.parse('2026-11-14T00:00:00Z');
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

// A fake workspace: start -> two polls (EXECUTING_QUERY, COMPLETED) -> result.
function fake(over: { msg?: Record<string, unknown>; result?: unknown; start?: Response } = {}) {
  const calls: { url: string; method: string; auth: string | null; body: string | null }[] = [];
  let polls = 0;
  const fetch: typeof globalThis.fetch = async (u, init) => {
    const url = String(u), h = new Headers(init?.headers);
    calls.push({ url, method: init?.method ?? 'GET', auth: h.get('authorization'), body: typeof init?.body === 'string' ? init.body : null });
    if (url.endsWith('/start-conversation')) return over.start ?? json({ conversation_id: 'c1', message_id: 'm1' });
    if (url.endsWith('/query-result')) return json(over.result ?? { statement_response: { manifest: { total_row_count: 2, schema: { columns: [{ name: 'brand', type_name: 'STRING' }, { name: 'n', type_name: 'INT' }] } }, result: { data_array: [['boss', '3'], ['roland', '1']] } } });
    if (++polls < 2) return json({ status: 'EXECUTING_QUERY' });
    return json({ status: 'COMPLETED', last_updated_timestamp: NOW - 1000, attachments: [
      { attachment_id: 't1', text: { content: 'Boss leads with 3.' } },
      { attachment_id: 'q1', query: { query: 'SELECT brand, count(*) n FROM main.sh.items i JOIN main.sh.sales s ON i.id = s.item_id GROUP BY brand', description: 'items by brand' } }] , ...over.msg });
  };
  const deps: GenieDeps = { fetch, host: 'https://w.example', token: async () => 'tok-SECRET', space_id: 'sp1', now: () => NOW, sleep: async () => {}, log: createLog({ src: 'test', build: 't', sink: memorySink() }) };
  return { deps, calls };
}

test('a question returns the answer with its SQL, tables read, row count and as_of', async () => {
  const { deps, calls } = fake();
  const r = await genie('how many items by brand', deps);
  assert.equal(r.status, 'answered');
  if (r.status !== 'answered') return;
  assert.equal(r.text, 'Boss leads with 3.');
  assert.match(r.citation.sql, /^SELECT brand/);
  assert.deepEqual(r.citation.tables, ['main.sh.items', 'main.sh.sales']);
  assert.equal(r.citation.row_count, 2);
  assert.deepEqual(r.columns, ['brand', 'n']);
  assert.deepEqual(r.rows, [['boss', '3'], ['roland', '1']]);
  assert.equal(r.citation.as_of, new Date(NOW - 1000).toISOString());
  assert.equal(r.citation.stale, false);
  assert.ok(calls.every(c => c.auth === 'Bearer tok-SECRET'));
  assert.ok(calls[0]!.url.endsWith('/api/2.0/genie/spaces/sp1/start-conversation'));
  assert.equal(JSON.parse(calls[0]!.body!).content, 'how many items by brand');
});

test('a citation older than its freshness is dated, not hidden', async () => {
  const { deps } = fake({ msg: { last_updated_timestamp: NOW - 3 * 86_400_000 } });
  const r = await genie('q', { ...deps, freshness_s: 86_400 });
  assert.equal(r.status, 'answered');
  if (r.status === 'answered') { assert.equal(r.citation.stale, true); assert.match(r.citation.note!, /^as of 2026-11-11/); }
});

test('no query attachment: it says so; no uncited answer is returned', async () => {
  const { deps } = fake({ msg: { attachments: [{ attachment_id: 't1', text: { content: 'Boss leads.' } }] } });
  const r = await genie('q', deps);
  assert.equal(r.status, 'no_table');
  assert.equal('text' in r, false);
});

test('a SQL with no table read is not cited', async () => {
  const { deps } = fake({ msg: { attachments: [{ attachment_id: 'q1', query: { query: 'SELECT 1' } }] } });
  assert.equal((await genie('q', deps)).status, 'no_table');
});

test('FAILED and a non-2xx are returned as errors, and the token never reaches the log', async () => {
  const sink = memorySink();
  const a = fake({ msg: { status: 'FAILED', error: { error: '[INSUFFICIENT_PERMISSIONS] x', type: 'SQL_EXECUTION_EXCEPTION' } } });
  const failed = await genie('q', { ...a.deps, log: createLog({ src: 't', build: 't', sink }) });
  assert.equal(failed.status, 'error');
  const b = fake({ start: json({}, 403) });
  const denied = await genie('q', b.deps);
  assert.equal(denied.status, 'error');
  assert.ok(!sink.text().includes('tok-SECRET'));
});

test('a reply of the wrong shape is an error, not an answer', async () => {
  const { deps } = fake({ start: json({ nope: 1 }) });
  assert.equal((await genie('q', deps)).status, 'error');
});

test('polling gives up at the timeout', async () => {
  const { deps } = fake({ msg: { status: 'EXECUTING_QUERY' } });
  let t = NOW;
  const r = await genie('q', { ...deps, now: () => (t += 40_000), timeout_ms: 60_000 });
  assert.equal(r.status, 'error');
});

test('config comes from env by presence; no CLI, no profile', () => {
  assert.equal(genieFromEnv({}, fetch), null);
  const d = genieFromEnv({ DATABRICKS_HOST: 'https://w', DATABRICKS_TOKEN: 't', GENIE_SPACE_ID: 's' }, fetch);
  assert.equal(d?.space_id, 's');
});
