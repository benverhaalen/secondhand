// lc-1 live channel listener. Operating notes:
// connect(signal) returns an async iterable of frames {id, action, ...}; it ends or throws when the channel drops. Each frame -> one event
//   (source live_channel, dedupe_key `${site}:${account}:live:${frame.id}`) through ingest, so a frame seen twice (live and backfill) is one job.
// On a drop: wait the backoff, call backfill(sinceAt) (frames missed while down, same shape), ingest them, then reconnect.
//   sinceAt = observed_at of the last frame seen (or the listen start). Backoff = live_reconnect_ms (Params, prior 1000) doubled per
//   consecutive failure up to 32x, reset once a frame arrives. stop() aborts the signal, the wait and the loop; listen resolves.
// Webhook/live are triggers only; the signed-in read confirms. No model, no harness call.
// Likely to break: a backfill that throws (logged, retried next cycle, sinceAt unchanged), a frame with no id (refused by validateEvent).
import type { EventKind } from './event.ts';
import { ingest } from './intake.ts';
import type { LogLike } from './intake.ts';
import type { Params, Store } from './ports.ts';

export type Frame = { id: string; action: EventKind; listing_id?: string; payload?: Record<string, unknown>; at?: string };
export interface ListenOpts {
  connect(signal: AbortSignal): AsyncIterable<Frame> | Promise<AsyncIterable<Frame>>;
  backfill(sinceAt: string): Promise<Frame[]> | Frame[];
  store: Store; log: LogLike; params: Pick<Params, 'get'>;
  account: string; site: string; user_id: string;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => string;
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>(res => {
  if (signal.aborted) return res();
  const t = setTimeout(done, ms); signal.addEventListener('abort', done, { once: true });
  function done() { clearTimeout(t); signal.removeEventListener('abort', done); res(); }
});

export function listen(o: ListenOpts): { stop(): void; done: Promise<void> } {
  const ac = new AbortController(), now = o.now ?? (() => new Date().toISOString()), sleep = o.sleep ?? wait;
  let since = now();
  const take = (f: Frame) => {
    const at = f.at ?? now();
    const r = ingest(o.store, o.log, {
      user_id: o.user_id, source: 'live_channel', site: o.site as never, account_id: o.account, action: f.action,
      listing_id: f.listing_id, payload: f.payload, payload_ref: `live:${o.site}:${f.id}`,
      dedupe_key: `${o.site}:${o.account}:live:${f.id}`, actor: 'site', observed_at: at, effective_at: at, trace_id: `live-${f.id}`,
    }, now);
    if (!('refused' in r) && at > since) since = at;
  };
  const run = async () => {
    let fails = 0;
    while (!ac.signal.aborted) {
      try {
        for await (const f of await o.connect(ac.signal)) { fails = 0; take(f); if (ac.signal.aborted) break; }
      } catch (err) { if (!ac.signal.aborted) o.log.event('note', { msg: 'live channel dropped', site: o.site, account_id: o.account, error: String((err as Error)?.message ?? err) }, 'warn'); }
      if (ac.signal.aborted) break;
      await sleep(o.params.get('live_reconnect_ms', { site: o.site }) * 2 ** Math.min(fails++, 5), ac.signal);
      if (ac.signal.aborted) break;
      try { for (const f of await o.backfill(since)) take(f); }
      catch (err) { o.log.event('note', { msg: 'live backfill failed', site: o.site, account_id: o.account, error: String((err as Error)?.message ?? err) }, 'warn'); }
    }
  };
  return { stop: () => ac.abort(), done: run() };
}
