// The shape GET /v1/health answers with. Shared by the edge route that builds it and the screen that reads it.
export type Health = { ok: boolean; state: string; catalog?: string; at?: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isHealth(v: unknown): v is Health {
  return isRecord(v) && typeof v.ok === 'boolean' && typeof v.state === 'string';
}

// Reads the answer of Databricks' SQL statement API for `select current_catalog(), <time as text>`.
export function readHealth(statement: unknown): Health {
  if (!isRecord(statement)) return { ok: false, state: 'UNKNOWN' };
  const state = isRecord(statement.status) && typeof statement.status.state === 'string' ? statement.status.state : 'UNKNOWN';
  if (state !== 'SUCCEEDED') return { ok: false, state };
  const rows = isRecord(statement.result) ? statement.result.data_array : undefined;
  const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'string') return { ok: false, state: 'NO_ROWS' };
  return { ok: true, state, catalog: row[0], at: row[1] };
}
