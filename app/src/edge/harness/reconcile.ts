// Reconcile (spec/engines/protocol-and-adapters.md §9 "Unknown outcome"): an outcome_unknown write is read back before anything else.
// Found: it settled, ok with the found id. Absent, or the read-back failed: a decision for the person. Never an automatic repost.
import { fail, isWrite, type CallArgs, type Envelope, type Harness, type Meta, type Site, type Verb, type WriteVerb } from './protocol.ts';

export type Settled = { id: string; operation_id: string };
export type ReadBack = { verb: Verb; match: string[]; args?: CallArgs };   // the manifest's read_back, plus the read's own args

const decision = (kind: string, message: string, meta: Meta): Envelope<Settled> =>
  ({ ...fail('policy_refused', message, { do: 'raise_decision', kind }), meta });

export async function reconcile(harness: Harness, site: Site, write: { verb: WriteVerb; args: CallArgs }, readBack: ReadBack): Promise<Envelope<Settled>> {
  const operation_id = write.args.operation_id ?? '';
  const r = await harness.call<Record<string, unknown>[]>(site, readBack.verb, readBack.args ?? {});
  if (!r.ok) return decision('write_unconfirmed', 'the read-back failed, so the write is unknown', r.meta);
  const rows = Array.isArray(r.data) ? r.data : [];
  const hit = rows.find(row => readBack.match.length > 0 && readBack.match.every(f => row[f] !== undefined && row[f] === write.args[f]));
  if (hit && typeof hit.id === 'string') return { ok: true, data: { id: hit.id, operation_id }, meta: r.meta };
  return decision('write_absent', 'the read-back found no such write', r.meta);
}

// A write through the harness: only an outcome_unknown goes to reconcile, and the write itself runs exactly once.
export async function writeOnce(harness: Harness, site: Site, verb: WriteVerb, args: CallArgs, readBack: ReadBack): Promise<Envelope<unknown>> {
  if (!isWrite(verb)) throw new Error(`${verb} is not a write`);
  const e = await harness.call(site, verb, args);
  if (e.ok || e.error.code !== 'outcome_unknown') return e;
  return reconcile(harness, site, { verb, args }, readBack);
}
