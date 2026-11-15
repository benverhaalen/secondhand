// ob-1 outbox. Operating notes:
// withOutbox: one store.tx runs the route's change and writes its event + job (intake.write), so they commit or roll back together.
//   A refused event throws, which rolls the change back. The event.received log line is written after the commit.
// deliver: reads every event whose job has no 'delivered' stage, hands (event, job) to the consumer, then marks the stage.
//   Consumer first, mark second: a crash between them re-delivers on the next call, so delivery is at least once and
//   consumers must be idempotent by event.id. A consumer that throws leaves the event undelivered and the loop goes on.
// The marker is a job stage {name:'delivered', state:'arrived'}; the pipeline must append to job.stages, never overwrite it.
// Parallelism: none needed; two deliver calls at once may both hand an event over, which idempotency absorbs.
// Likely to break: event write throws (change must roll back), crash after commit (delivered on restart), double delivery.
import type { EventRow } from './event.ts';
import type { JobRow, Store } from './ports.ts';
import { logReceived, write } from './intake.ts';
import type { Ingested, LogLike } from './intake.ts';

export function withOutbox<R>(store: Store, log: LogLike, fn: (t: Store) => { result: R; event: Omit<EventRow, 'id'> }, now?: () => string): { result: R } & Ingested {
  const out = store.tx(t => { const { result, event } = fn(t); return { result, ...write(t, event, now) }; });
  logReceived(log, out);
  return out;
}

export type Consumer = (event: EventRow, job: JobRow) => void | Promise<void>;
const delivered = (j: JobRow) => j.stages.some(s => s.name === 'delivered');

export async function deliver(store: Store, consumer: Consumer, { worker }: { worker: string }): Promise<{ delivered: number; failed: number }> {
  let ok = 0, failed = 0;
  for (const event of store.events()) {
    const job = store.jobs({ user_id: event.user_id }).find(j => j.event_id === event.id);
    if (!job || delivered(job)) continue;
    try {
      await consumer(event, job);
      const fresh = store.getJob(job.id)!; // re-read: the pipeline may have added stages meanwhile
      store.updateJob(job.id, { stages: [...fresh.stages, { name: 'delivered', state: 'arrived', result: { worker }, ended_at: new Date().toISOString() }] });
      ok++;
    } catch { failed++; }
  }
  return { delivered: ok, failed };
}
