import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { EVENT_KINDS, SOURCES } from './event.ts';
import { memoryStore, TABLES, type Store, type StoreState } from './ports.ts';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (row: Record<string, unknown>, keys: string[]) => keys.every(k => typeof row[k] === 'string');
const oneOf = (value: unknown, values: readonly string[]) => typeof value === 'string' && values.includes(value);
const arrayOf = (value: unknown, valid: (row: Record<string, unknown>) => boolean) =>
  Array.isArray(value) && value.every(row => record(row) && valid(row));

function validState(value: unknown): value is StoreState {
  if (!record(value) || !record(value.rows)) return false;
  return arrayOf(value.events, row => strings(row, ['id', 'user_id', 'dedupe_key', 'observed_at', 'effective_at', 'trace_id'])
      && oneOf(row.action, EVENT_KINDS) && oneOf(row.source, SOURCES) && oneOf(row.actor, ['user', 'auto', 'site']))
    && arrayOf(value.jobs, row => strings(row, ['id', 'user_id', 'event_id', 'idempotency_key', 'trace_id', 'created_at']) && typeof row.kind === 'string' && row.kind.length > 0
      && oneOf(row.state, ['queued', 'running', 'done', 'failed']) && record(row.args)
      && Number.isInteger(row.attempts) && (row.attempts as number) >= 0
      && arrayOf(row.stages, stage => strings(stage, ['name']) && oneOf(stage.state, ['started', 'running', 'arrived', 'failed'])))
    && arrayOf(value.decisions, row => strings(row, ['id', 'user_id', 'kind', 'subject', 'why'])
      && oneOf(row.state, ['open', 'acting', 'answered', 'failed', 'expired', 'superseded'])
      && arrayOf(row.options, option => strings(option, ['id', 'label'])))
    && Object.entries(value.rows).every(([table, rows]) => oneOf(table, TABLES)
      && arrayOf(rows, row => strings(row, ['id', 'user_id']) && Number.isInteger(row.version) && (row.version as number) >= 1));
}

function load(path: string): StoreState | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const state: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!validState(state)) throw new Error('invalid Store state');
    for (const job of state.jobs) if (job.state === 'running') job.state = 'queued';
    return state;
  } catch (cause) {
    throw new Error(`Cannot load Store at ${path}`, { cause });
  }
}

export function fileStore(path: string): Store & { claims: Map<string, string> } {
  const memory = memoryStore(load(path));
  let depth = 0;
  // shortcut: rewrites the whole file per write; fine for one person's demo data, replace with the Lakebase port before real volume.
  const persist = () => {
    mkdirSync(dirname(path), { recursive: true });
    // This file holds only Store state, never tokens; account.token_ref is a vault reference.
    writeFileSync(path + '.tmp', JSON.stringify(memory.dump()));
    renameSync(path + '.tmp', path);
  };
  const mutate = <T>(fn: () => T): T => depth ? fn() : store.tx(fn);
  const store: Store & { claims: Map<string, string> } = {
    claims: memory.claims,
    put: (table, row) => mutate(() => memory.put(table, row)),
    get: (table, user_id, id) => memory.get(table, user_id, id),
    rows: (table, filter) => memory.rows(table, filter),
    insertEvent: event => mutate(() => memory.insertEvent(event)),
    insertJob: job => mutate(() => memory.insertJob(job)),
    getJob: id => memory.getJob(id),
    updateJob: (id, patch) => mutate(() => memory.updateJob(id, patch)),
    claimJobs: (limit, worker) => memory.claimJobs(limit, worker),
    release: id => memory.release(id),
    jobs: filter => memory.jobs(filter),
    events: filter => memory.events(filter),
    raiseDecision: decision => mutate(() => memory.raiseDecision(decision)),
    decisions: filter => memory.decisions(filter),
    updateDecision: (id, patch) => mutate(() => memory.updateDecision(id, patch)),
    tx(fn) {
      return memory.tx(() => {
        depth++;
        try {
          const result = fn(store);
          if (depth === 1) persist();
          return result;
        } finally { depth--; }
      });
    },
  };
  return store;
}
