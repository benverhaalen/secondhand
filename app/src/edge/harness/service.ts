// A site service (spec/engines/protocol-and-adapters.md §3.8): one site's adapters built and warmed at start, always ready behind
// harness.call, a concurrency limit with a queue, and writes deduped by operation_id so a restart never runs one twice.
import { createHarness, fail, isWrite, type Adapter, type CallArgs, type CallOptions, type Envelope, type Harness, type Meta, type Site, type Verb } from './protocol.ts';
import { createHash } from 'node:crypto';
import type { Store } from '../events/ports.ts';
import type { Log } from '../../../../log/index.js';
import { classOf, readLedger, type ReadLedger } from './read-ledger.ts';

export function createSiteService(site: Site, adapters: Adapter[], { concurrency, warm = async () => {}, store, data, log, timeoutMs, now = Date.now, ledger = readLedger }: {
  concurrency: number; warm?: (a: Adapter) => Promise<void>; store: Store;
  data: Parameters<Store['beginOperation']>[0]['data']; log: Log; timeoutMs?: number; now?: () => number; ledger?: ReadLedger;
}) {
  const harness: Harness = createHarness({ adapters, log, timeoutMs, now });
  const started = Promise.all(adapters.map(warm)).then(() => undefined);   // every adapter warm before the first call is served
  let running = 0;
  const waiting: (() => void)[] = [];
  const inflight = new Map<string, Promise<Envelope>>();

  const acquire = async (signal?: AbortSignal): Promise<boolean> => {
    if (signal?.aborted) return false;
    if (running < concurrency) { running++; return true; }
    return new Promise<boolean>(resolve => {
      const next = () => { signal?.removeEventListener('abort', abort); resolve(true); };
      const abort = () => { waiting.splice(waiting.indexOf(next), 1); resolve(false); };
      waiting.push(next);
      signal?.addEventListener('abort', abort, { once: true });
    });
  };
  const release = () => { const next = waiting.shift(); if (next) next(); else running--; };   // the slot passes straight to the next in line

  function readPause(verb: Verb): Envelope<never> | undefined {
    if (isWrite(verb)) return;
    const pause = ledger.paused(site);
    if (!pause) return;
    return { ...fail('rate_limited', 'the site asked us to slow down', { do: 'retry_after', after_s: Math.ceil((pause.until_ms - now()) / 1000) }),
      meta: { route_id: 'service', adapter_version: '0.0.0', ms: 0, fell_back: false, observation_ids: [] } };
  }

  async function run<T>(verb: Verb, args: CallArgs, options: CallOptions): Promise<Envelope<T>> {
    const pause = readPause(verb);
    if (pause) return pause;
    const acquired = await acquire(options.signal);
    try {
      const queuedPause = !options.signal?.aborted && readPause(verb);
      if (queuedPause) return queuedPause;
      const envelope = await harness.call<T>(site, verb, args, options);
      if (!isWrite(verb)) ledger.record(site, verb, classOf(envelope), envelope.meta.ms);
      return envelope;
    } finally { if (acquired) release(); }
  }

  async function call<T = unknown>(verb: Verb, args: CallArgs = {}, options: CallOptions = {}): Promise<Envelope<T>> {
    const pause = readPause(verb);
    if (pause) return pause;
    if (options.signal) {
      const signal = options.signal, stopped = Promise.withResolvers<void>();
      const abort = () => stopped.resolve();
      signal.addEventListener('abort', abort, { once: true });
      try { if (!signal.aborted) await Promise.race([started, stopped.promise]); }
      finally { signal.removeEventListener('abort', abort); }
    } else await started;
    const op = args.operation_id;
    if (!isWrite(verb) || !op) return run<T>(verb, args, options);
    const user_id = args.user_id;
    if (typeof user_id !== 'string' || !user_id) throw new Error('a ledger write needs user_id');
    const key = JSON.stringify([user_id, op]);
    const live = inflight.get(key);
    if (live) return live as Promise<Envelope<T>>;
    const listing = args.listing as { sku?: unknown } | undefined;
    const sku_hash = verb === 'post'
      ? typeof listing?.sku === 'string' && listing.sku.length > 0 ? listing.sku : 'sh' + createHash('sha256').update(op).digest('hex').slice(0, 16)
      : undefined;
    const { row, duplicate } = store.beginOperation({ id: op, user_id, site, verb, sku_hash, data, at: new Date(now()).toISOString() });
    if (duplicate && row.state === 'done') return row.envelope as Envelope<T>;
    if (duplicate) {   // a service died after the write began: do not run it again, reconcile reads the state
      const meta: Meta = { route_id: 'service', adapter_version: '0.0.0', ms: 0, fell_back: false, observation_ids: [] };
      return { ...fail('outcome_unknown', 'the service restarted mid-write', { do: 'reconcile', operation_id: op }), meta };
    }
    log.event('state.change', { entity: 'operation', id: op, to: 'started' });
    const p = run<T>(verb, sku_hash === undefined ? args : { ...args, sku_hash }, options).then(e => {
      let state: 'done' | 'unknown' = !e.ok && e.error.code === 'outcome_unknown' ? 'unknown' : 'done';
      try { store.settleOperation(user_id, op, { state, envelope: e, at: new Date(now()).toISOString() }); }
      catch (error) {
        log.error('service.settleOperation', error, { operation_id: op });
        state = 'unknown';
        store.settleOperation(user_id, op, { state, at: new Date(now()).toISOString() });
      }
      log.event('state.change', { entity: 'operation', id: op, to: state, was: 'started' });
      return e;
    }).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  return { site, ready: () => started, call, running: () => running, queued: () => waiting.length };
}
export type SiteService = ReturnType<typeof createSiteService>;
