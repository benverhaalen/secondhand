// Reconcile (spec/engines/protocol-and-adapters.md §9 "Unknown outcome"): an outcome_unknown write is read back before anything else.
// Found: it settled, ok with the found id. Absent, or the read-back failed: a decision for the person. Never an automatic repost.
import { fail, isWrite, type CallArgs, type Envelope, type Harness, type Meta, type Site, type Verb, type WriteVerb } from './protocol.ts';
import type { Store } from '../events/ports.ts';

export type Settled = { id: string; operation_id: string };
export type ReadBack = { verb: Verb; match: string[]; args?: CallArgs };   // the manifest's read_back, plus the read's own args
export type ReconcileOptions = { store?: Store; sleep?: (ms: number) => Promise<void>; now?: () => number };

const decision = (kind: string, message: string, meta: Meta): Envelope<Settled> =>
  ({ ...fail('policy_refused', message, { do: 'raise_decision', kind }), meta });

export async function reconcile(harness: Harness, site: Site, write: { verb: WriteVerb; args: CallArgs }, readBack: ReadBack,
  { store, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now }: ReconcileOptions = {}): Promise<Envelope<Settled>> {
  if (isWrite(readBack.verb)) throw new Error('reconcile needs a read verb');
  const operation_id = write.args.operation_id ?? '';
  const user_id = write.args.user_id;
  if (store && (typeof user_id !== 'string' || !user_id)) throw new Error('ledger reconciliation needs user_id');
  const operation = store && typeof user_id === 'string' ? store.get('operation', user_id, operation_id) : undefined;
  const sku_hash = store ? operation?.sku_hash : write.args.sku_hash;
  // Calls predating the operation ledger pass only the manifest's match fields.
  const matchSku = write.verb === 'post' && (store !== undefined || sku_hash !== undefined);
  async function read(attempt: number): Promise<Envelope<Settled>> {
    if (attempt > 0) await sleep(attempt === 1 ? 2000 : 5000);
    const r = await harness.call<Record<string, unknown>[]>(site, readBack.verb, readBack.args ?? {});
    if (!r.ok) return decision('write_unconfirmed', 'the read-back failed, so the write is unknown', r.meta);
    const rows = Array.isArray(r.data) ? r.data : [];
    const hit = rows.find(row => matchSku
      ? typeof sku_hash === 'string' && sku_hash.length > 0 && row.sku === sku_hash
      : readBack.match.length > 0 && readBack.match.every(f => row[f] !== undefined && row[f] === write.args[f]));
    const id = typeof hit?.external_id === 'string' ? hit.external_id : hit?.id;
    if (typeof id === 'string') {
      const envelope: Envelope<Settled> = { ok: true, data: { id, operation_id }, meta: r.meta };
      if (store && typeof user_id === 'string') store.settleOperation(user_id, operation_id, { state: 'done', envelope, at: new Date(now()).toISOString() });
      return envelope;
    }
    if (attempt === 2) return decision('write_absent', 'the read-back found no such write', r.meta);
    return read(attempt + 1);
  }
  return read(0);
}

// A write through the harness: only an outcome_unknown goes to reconcile, and the write itself runs exactly once.
export async function writeOnce(harness: Harness, site: Site, verb: WriteVerb, args: CallArgs, readBack: ReadBack, options?: ReconcileOptions): Promise<Envelope<unknown>> {
  if (!isWrite(verb)) throw new Error(`${verb} is not a write`);
  const e = await harness.call(site, verb, args);
  if (e.ok || e.error.code !== 'outcome_unknown') return e;
  return reconcile(harness, site, { verb, args }, readBack, options);
}
