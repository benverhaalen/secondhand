// Genie with citations (spec/product.md POST /v1/genie; spec/features/assist.md). Full users only: the caller checks that.
// How it runs: start-conversation -> poll the message until COMPLETED/FAILED/CANCELLED -> fetch the query attachment's result.
// Endpoints are the Genie Conversation API (databricks-genie-agents skill, query-genie-agent.md).
// An answer is returned only with its citation: the SQL, the tables it reads, the row count and as_of. No SQL or no table -> 'no_table'.
// fetch, token, clock and sleep are injected; no CLI is called and no profile is chosen here.
import type { Log } from '../../../../log/index.js';

export interface GenieDeps {
  fetch: typeof globalThis.fetch; host: string; token: () => Promise<string>; space_id: string;
  now?: () => number; sleep?: (ms: number) => Promise<void>; log: Log;
  freshness_s?: number; timeout_ms?: number; poll_ms?: number;
}
export interface GenieCitation { sql: string; tables: string[]; row_count: number; as_of: string; stale: boolean; note?: string }
export type GenieResult =
  | { status: 'answered'; text: string; columns: string[]; rows: unknown[][]; citation: GenieCitation }
  | { status: 'no_table'; reason: string }
  | { status: 'error'; reason: string };

// Env by presence only. The token comes from DATABRICKS_TOKEN; with none, the caller supplies its own token function.
export function genieFromEnv(env: Record<string, string | undefined>, fetch: typeof globalThis.fetch, log?: Log): GenieDeps | null {
  const { DATABRICKS_HOST: host, DATABRICKS_TOKEN: token, GENIE_SPACE_ID: space_id } = env;
  if (!host || !token || !space_id) return null;
  return { fetch, host, token: async () => token, space_id, log: log as Log };
}

const obj = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? x as Record<string, unknown> : null);
const str = (x: unknown) => (typeof x === 'string' ? x : undefined);

// shortcut: tables are the names after FROM/JOIN in the SQL text, not a parsed plan; upgrade if Genie returns lineage.
export const tablesRead = (sql: string): string[] =>
  [...new Set([...sql.matchAll(/\b(?:from|join)\s+([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*){0,2})/gi)].map(m => m[1]!))];

class Fail extends Error {}

export async function genie(question: string, d: GenieDeps): Promise<GenieResult> {
  const now = d.now ?? Date.now, sleep = d.sleep ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  const base = `${d.host.replace(/\/$/, '')}/api/2.0/genie/spaces/${encodeURIComponent(d.space_id)}`;
  const call = (name: string, path: string, body?: unknown): Promise<Record<string, unknown>> =>
    d.log.call('http', `databricks.genie.${name}`, { space_id: d.space_id, chars: name === 'start' ? question.length : undefined }, async () => {
      const res = await d.fetch(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${await d.token()}`, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!res.ok) throw new Fail(`HTTP_${res.status}`);
      const o = obj(await res.json().catch(e => { throw new Fail('bad_reply', { cause: e }); }));
      if (!o) throw new Fail('bad_reply');
      return o;
    }, o => ({ status: str(o.status) ?? 'ok' }));
  try {
    const started = await call('start', '/start-conversation', { content: question });
    const conv = str(started.conversation_id), msg = str(started.message_id);
    if (!conv || !msg) throw new Fail('bad_reply');
    const t0 = now(), path = `/conversations/${conv}/messages/${msg}`;
    let m = await call('message', path);
    while (!['COMPLETED', 'FAILED', 'CANCELLED'].includes(str(m.status) ?? '')) {
      if (now() - t0 > (d.timeout_ms ?? 120_000)) throw new Fail('timeout');
      await sleep(d.poll_ms ?? 1500);
      m = await call('message', path);
    }
    if (m.status !== 'COMPLETED') return { status: 'error', reason: str(obj(m.error)?.type) ?? String(m.status) };
    const atts = (Array.isArray(m.attachments) ? m.attachments : []).map(obj).filter((a): a is Record<string, unknown> => a !== null);
    const q = atts.find(a => str(obj(a.query)?.query));
    const sql = str(obj(q?.query)?.query), tables = sql ? tablesRead(sql) : [];
    if (!q || !sql || !tables.length) return { status: 'no_table', reason: 'Genie returned no query over a table, so there is nothing to cite.' };
    const r = await call('result', `${path}/attachments/${str(q.attachment_id)}/query-result`);
    const sr = obj(r.statement_response), manifest = obj(sr?.manifest);
    const cols = obj(manifest?.schema)?.columns, data = obj(sr?.result)?.data_array;
    const columns = (Array.isArray(cols) ? cols : []).map(c => str(obj(c)?.name) ?? '');
    const rows = Array.isArray(data) ? data.filter(Array.isArray) as unknown[][] : [];
    const ts = typeof m.last_updated_timestamp === 'number' ? m.last_updated_timestamp : now();
    const stale = now() - ts > (d.freshness_s ?? 86_400) * 1000, as_of = new Date(ts).toISOString();
    const row_count = typeof manifest?.total_row_count === 'number' ? manifest.total_row_count : rows.length;
    const text = atts.map(a => str(obj(a.text)?.content)).find(Boolean) ?? str(obj(q.query)?.description) ?? '';
    return { status: 'answered', text, columns, rows, citation: { sql, tables, row_count, as_of, stale, ...(stale ? { note: `as of ${as_of.slice(0, 10)}` } : {}) } };
  } catch (e) {
    return { status: 'error', reason: e instanceof Fail ? e.message : 'request_failed' };
  }
}
