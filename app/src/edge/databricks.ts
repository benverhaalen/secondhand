// Server only: the edge's one way into the Databricks workspace. Never import this from a screen.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { consoleSink, createLog } from '../../../log/index.js';
import { readHealth, type Health } from '../health.ts';

const log = createLog({ src: 'edge', build: process.env.npm_package_version ?? 'dev', sink: consoleSink });

// A deployed edge gets DATABRICKS_TOKEN from its host's secrets. On a laptop the Databricks CLI's own sign-in is used, so no token is ever written to a file.
async function bearer(host: string): Promise<string> {
  if (process.env.DATABRICKS_TOKEN) return process.env.DATABRICKS_TOKEN;
  const { stdout } = await promisify(execFile)('databricks', ['auth', 'token', '--host', host]);
  const parsed: unknown = JSON.parse(stdout);
  if (typeof parsed !== 'object' || parsed === null || !('access_token' in parsed) || typeof parsed.access_token !== 'string')
    throw new Error('databricks auth token returned no access_token');
  return parsed.access_token;
}

export async function health(): Promise<Health> {
  const host = process.env.DATABRICKS_HOST, warehouse_id = process.env.DATABRICKS_WAREHOUSE_ID;
  if (!host || !warehouse_id) return { ok: false, state: 'NOT_CONFIGURED' };
  const statement = 'select current_catalog(), cast(current_timestamp() as string)';
  return log.call('http', 'databricks.sql.statements', { warehouse_id, statement }, async () => {
    const res = await fetch(`${host}/api/2.0/sql/statements`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await bearer(host)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ warehouse_id, statement, wait_timeout: '30s' }),
    });
    return res.ok ? readHealth(await res.json()) : { ok: false, state: `HTTP_${res.status}` };
  }, (h: Health) => ({ status: h.state, result: { ok: h.ok } }));
}
