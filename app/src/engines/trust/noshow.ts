import type { ParamStore, Scope } from '../param/param.ts';
import { numeric, priors, priorVersions, resolve, type ParamInput } from './params.ts';
import { publish, type Proof, type Published } from './publication.ts';
export type NsIn = {
  pastNoShows: number; paidInApp: boolean; exactTimeConfirmed24h: boolean; vagueTime: boolean; newNoRatings: boolean;
  hardHaggle: boolean; rescheduledOnce: boolean; repliedConfirm30: boolean;
};
const signals = (i: NsIn) => ({ past: i.pastNoShows, paid: +i.paidInApp, exact: +i.exactTimeConfirmed24h, vague: +i.vagueTime, new: +i.newNoRatings, haggle: +i.hardHaggle, reschedule: +i.rescheduledOnce, reply: +i.repliedConfirm30 });
export function nsScore(i: NsIn, values: ParamInput = priors()): number {
  if (!Number.isSafeInteger(i.pastNoShows) || i.pastNoShows < 0) throw new RangeError('pastNoShows');
  const p = numeric(values);
  return Object.entries(signals(i)).reduce((s, [k, v]) => s + p(`trust_ns_${k}_weight`) * v, 0);
}
export function nsDecide(i: NsIn, input?: ParamInput, proof?: Proof, versions?: Record<string, number>): { s: number; q: number; confirm: boolean; askBeforeBooking: boolean; shown: string | null; count: Published | null } {
  const values = input ?? priors();
  const paramVersions = versions ?? (input === undefined ? priorVersions() : {});
  const p = numeric(values), s = nsScore(i, values);
  const ask = s >= p('trust_ns_ask') || i.pastNoShows >= p('trust_ns_past_ask');
  const confirm = s >= p('trust_ns_confirm');
  const count = proof?.rows.length === i.pastNoShows ? publish(i.pastNoShows, 'trust_missed_pickups', proof, paramVersions, typeof values === 'function' ? priors() : values) : null;
  return { s, q: nsProbability(i, values), confirm, askBeforeBooking: ask, count, shown: count && i.pastNoShows > 0 ? `Missed ${i.pastNoShows} pickup${i.pastNoShows > 1 ? 's' : ''} with you.${confirm ? ' Confirm sent.' : ''}` : null };
}
export function observeAppointment(store: ParamStore, scope: Scope, i: NsIn, no_show: 0 | 1, at: string, weight = 1) {
  resolve(store, scope);
  store.observe('trust_ns_b', scope, { success: no_show, weight }, at);
  for (const [k, v] of Object.entries(signals(i))) {
    store.observe(`trust_ns_r.${k}`, scope, { success: +(v > 0), weight }, at);
    if (no_show) store.observe(`trust_ns_q.${k}`, scope, { success: +(v > 0), weight }, at);
  }
}
export function nsProbability(i: NsIn, values: ParamInput = priors()) {
  const b = (typeof values === 'function' ? values('trust_ns_b') : values.trust_ns_b) as { alpha: number; beta: number };
  if (![b?.alpha, b?.beta].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('trust_ns_b');
  const z = Math.log(b.alpha / b.beta) + nsScore(i, values);
  return sigmoid(z);
}
import { sigmoid } from './calibration.ts';
export type Tap = { who: 'person' | 'buyer'; kind: 'here' | 'on_my_way'; at: string };
export type Slot = 'pending' | 'met' | 'coming' | 'no_show';
export function resolveSlot(slotAt: string, now: string, taps: Tap[], waitMin: number): Slot {
  const slot = Date.parse(slotAt), t = Date.parse(now);
  if (![slot, t, waitMin].every(Number.isFinite) || waitMin < 0 || taps.some(x => !Number.isFinite(Date.parse(x.at)))) throw new RangeError('slot time');
  const seen = taps.filter(x => Date.parse(x.at) <= t);
  if (seen.some(x => x.kind === 'here')) return 'met';
  if (seen.some(x => x.kind === 'on_my_way')) return 'coming';
  return t - slot >= waitMin * 60_000 ? 'no_show' : 'pending'; // Fixed conversion: milliseconds per minute.
}
