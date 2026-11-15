// eq-1 intake. Operating notes:
// Reads: the event row a source built (validated by validateEvent), the store's unique keys (user_id, dedupe_key) and (user_id, idempotency_key).
// Steps: validate (refuse, no write) -> one store.tx: insertEvent, insertJob(JOB_FOR[action], idempotency_key = dedupe_key) -> log event.received after commit.
// A repeat delivery hits both unique keys, so the tx writes nothing and returns the first event and job with duplicate true.
// No model anywhere: routing is the JOB_FOR table. Everything is one tx, so no parallelism is needed.
// Likely to break: missing/blank dedupe key (refused), unknown action (refused), a repeat (one job), a tx that logs before commit (we log after).
import { validateEvent } from './event.ts';
import type { EventRow } from './event.ts';
import { JOB_FOR } from './ports.ts';
import type { JobRow, Store } from './ports.ts';

export type LogLike = { event(name: string, fields?: Record<string, unknown>, level?: string): unknown };
export type Ingested = { event: EventRow; job: JobRow; duplicate: boolean };
const iso = () => new Date().toISOString();

// The writes only, for a caller that already holds a transaction (the outbox). Throws on a refused row.
export function write(t: Store, e: Omit<EventRow, 'id'>, now: () => string = iso): Ingested {
  const bad = validateEvent(e);
  if (bad.length) throw new Error(`event refused: ${bad.join(',')}`);
  const ev = t.insertEvent(e);
  const job = t.insertJob({
    kind: JOB_FOR[e.action], user_id: e.user_id, event_id: ev.row.id, idempotency_key: e.dedupe_key,
    site: e.site, account_id: e.account_id, item_id: e.item_id, listing_id: e.listing_id,
    args: e.payload ?? {}, state: 'queued', stages: [], attempts: 0, trace_id: e.trace_id, created_at: now(),
  });
  return { event: ev.row, job: job.row, duplicate: ev.duplicate };
}

export function logReceived(log: LogLike, r: Ingested) {
  const e = r.event;
  log.event('event.received', { source: e.source, kind: e.action, site: e.site, account_id: e.account_id, dedupe_key: e.dedupe_key, duplicate: r.duplicate, job: r.job.id });
}

export function ingest(store: Store, log: LogLike, e: Omit<EventRow, 'id'>, now: () => string = iso): Ingested | { refused: string[] } {
  const bad = validateEvent(e);
  if (bad.length) { log.event('note', { msg: `event refused: ${bad.join(',')}`, source: e.source }); return { refused: bad }; }
  const r = store.tx(t => write(t, e, now));
  logReceived(log, r);
  return r;
}
