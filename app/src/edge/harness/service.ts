// A site service (spec/engines/protocol-and-adapters.md §3.8): one site's adapters built and warmed at start, always ready behind
// harness.call, a concurrency limit with a queue, and writes deduped by operation_id so a restart never runs one twice.
import { createHarness, fail, isWrite, type Adapter, type CallArgs, type Envelope, type Harness, type Meta, type Site, type Verb } from './protocol.ts';
import type { Log } from '../../../../log/index.js';

export type OpRecord = { state: 'started' } | { state: 'done'; envelope: Envelope };
export type OpStore = { get(operation_id: string): OpRecord | undefined; set(operation_id: string, rec: OpRecord): void };  // durable in prod; a Map here
export const memoryOpStore = (): OpStore => { const m = new Map<string, OpRecord>(); return { get: k => m.get(k), set: (k, v) => { m.set(k, v); } }; };

export function createSiteService(site: Site, adapters: Adapter[], { concurrency, warm = async () => {}, ops = memoryOpStore(), log, timeoutMs, now }: {
  concurrency: number; warm?: (a: Adapter) => Promise<void>; ops?: OpStore; log?: Log; timeoutMs?: number; now?: () => number;
}) {
  const harness: Harness = createHarness({ adapters, log, timeoutMs, now });
  const started = Promise.all(adapters.map(warm)).then(() => undefined);   // every adapter warm before the first call is served
  let running = 0;
  const waiting: (() => void)[] = [];
  const inflight = new Map<string, Promise<Envelope>>();

  const acquire = async () => { if (running >= concurrency) await new Promise<void>(r => waiting.push(r)); else running++; };
  const release = () => { const next = waiting.shift(); if (next) next(); else running--; };   // the slot passes straight to the next in line

  async function run<T>(verb: Verb, args: CallArgs): Promise<Envelope<T>> {
    await acquire();
    try { return await harness.call<T>(site, verb, args); } finally { release(); }
  }

  async function call<T = unknown>(verb: Verb, args: CallArgs = {}): Promise<Envelope<T>> {
    await started;
    const op = args.operation_id;
    if (!isWrite(verb) || !op) return run<T>(verb, args);
    const live = inflight.get(op);
    if (live) return live as Promise<Envelope<T>>;
    const rec = ops.get(op);
    if (rec?.state === 'done') return rec.envelope as Envelope<T>;
    if (rec?.state === 'started') {   // a service died after the write began: do not run it again, reconcile reads the state
      const meta: Meta = { route_id: 'service', adapter_version: '0.0.0', ms: 0, fell_back: false, observation_ids: [] };
      return { ...fail('outcome_unknown', 'the service restarted mid-write', { do: 'reconcile', operation_id: op }), meta };
    }
    ops.set(op, { state: 'started' });
    const p = run<T>(verb, args).then(e => { ops.set(op, { state: 'done', envelope: e }); return e; }).finally(() => inflight.delete(op));
    inflight.set(op, p);
    return p;
  }

  return { site, ready: () => started, call, running: () => running, queued: () => waiting.length };
}
export type SiteService = ReturnType<typeof createSiteService>;
