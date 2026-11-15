// Rests-on: spec/engines/capture.md §5; Nate's paid visual port brief (2026-11-15).
import { randomUUID } from 'node:crypto';
import type { Log } from '../../../../log/index.js';
import type { Declared, ParamStore } from '../../engines/param/param.ts';
import { DECLARED, type ParamName } from '../../engines/capture/identify/ladder.ts';

export type SpendKV = {
  get(namespace: string, key: string): unknown;
  set(namespace: string, key: string, value: unknown, ttl?: number): void;
};
type Reservation = {tool: string; capture_id: string; micro: number; day: string; expires: number};
export type ReserveResult = {ok: true; id: string} | {ok: false; reason: 'capture_cap' | 'day_cap'};

export function identifyParam(params: ParamStore, name: Extract<ParamName, `identify_${string}`>): number {
  const prior: Declared = DECLARED.find(row => row.name === name)!;
  params.declare(prior);
  const value = params.read(name, {}).value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (prior.guard_lo ?? 0) || value > (prior.guard_hi ?? Infinity))
    throw new RangeError(`${name} outside guard`);
  return value;
}
function micro(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('cost_micro must be a non-negative safe integer');
}

export function createSpend({kv, params, log, now}: {kv: SpendKV; params: ParamStore; log: Log; now: () => number}) {
  const pending = new Map<string, Reservation>();
  const count = (key: string): number => {
    const value = kv.get('spend', key);
    if (value === undefined || value === null) return 0;
    if (typeof value !== 'number') throw new TypeError('spend counter must be micro-dollars');
    micro(value); return value;
  };
  return {
    reserve(input: {tool: string; capture_id: string; micro: number}): ReserveResult {
      micro(input.micro);
      const at = now(), day = `day:${new Date(at).toISOString().slice(0, 10)}`, capture = `capture:${input.capture_id}`;
      const captureCap = identifyParam(params, 'identify_spend_cap_capture_micro'), dayCap = identifyParam(params, 'identify_spend_cap_day_micro');
      // SQLite in one process: synchronous reads and writes with no await cannot interleave reservations.
      const captureMicro = count(capture), dayMicro = count(day);
      const reason = captureMicro + input.micro > captureCap ? 'capture_cap' : dayMicro + input.micro > dayCap ? 'day_cap' : null;
      if (reason) {
        log.note('spend.refused', {tool: input.tool, capture_id: input.capture_id, cost_micro: input.micro, reason});
        return {ok: false, reason};
      }
      kv.set('spend', capture, captureMicro + input.micro);
      kv.set('spend', day, dayMicro + input.micro, 2 * 86400000);
      const id = randomUUID(); pending.set(id, {...input, day, expires: at + 2 * 86400000});
      log.note('spend.reserve', {tool: input.tool, capture_id: input.capture_id, cost_micro: input.micro});
      return {ok: true, id};
    },
    settle(id: string, cost_micro: number | null): void {
      const reservation = pending.get(id);
      if (!reservation) throw new Error('unknown spend reservation');
      if (cost_micro !== null) micro(cost_micro);
      const {tool, capture_id, day, expires} = reservation;
      const counted = Math.max(reservation.micro, cost_micro ?? reservation.micro);
      if (cost_micro !== null) {
        const delta = counted - reservation.micro, capture = `capture:${capture_id}`;
        kv.set('spend', capture, count(capture) + delta);
        if (expires > now()) kv.set('spend', day, count(day) + delta, expires - now());
      }
      pending.delete(id);
      log.note('spend.settle', {tool, capture_id, cost_micro: counted, ...(cost_micro === null ? {reason: 'cost_header_missing'} : {})});
    },
  };
}
