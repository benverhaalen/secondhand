// No-show (spec/engines/trust.md §2 No-show). Fixed card-6 weights; trust_ns_* params set the lines.
//   s >= confirm: a confirm goes out 2 h before.  s >= ask (or 2+ past no-shows with this seller): ask before booking.
//   15 min of silence after the slot records no_show, but a "here" or "on my way" tap from either side is read first.
export type NsIn = {
  pastNoShows: number; paidInApp: boolean; exactTimeConfirmed24h: boolean; vagueTime: boolean; newNoRatings: boolean;
  hardHaggle: boolean; rescheduledOnce: boolean; repliedConfirm30: boolean;
};
type Pf = (name: string) => number;
export function nsScore(i: NsIn): number {
  return 2.0 * i.pastNoShows + (i.paidInApp ? -3.0 : 0) + (i.exactTimeConfirmed24h ? -1.0 : 0) + (i.vagueTime ? 1.0 : 0) +
    (i.newNoRatings ? 0.5 : 0) + (i.hardHaggle ? 0.3 : 0) + (i.rescheduledOnce ? 0.7 : 0) + (i.repliedConfirm30 ? -1.5 : 0);
}
export function nsDecide(i: NsIn, p: Pf): { s: number; confirm: boolean; askBeforeBooking: boolean; shown: string | null } {
  const s = nsScore(i);
  const ask = s >= p('trust_ns_ask') || i.pastNoShows >= 2;
  const confirm = s >= p('trust_ns_confirm');
  return { s, confirm, askBeforeBooking: ask, shown: i.pastNoShows > 0 ? `Missed ${i.pastNoShows} pickup${i.pastNoShows > 1 ? 's' : ''} with you.${confirm ? ' Confirm sent.' : ''}` : null };
}

export type Tap = { who: 'person' | 'buyer'; kind: 'here' | 'on_my_way'; at: string };
export type Slot = 'pending' | 'met' | 'coming' | 'no_show';
// Taps are read before the silence rule: a "here" at minute 14 (or any time) is not a no_show.
export function resolveSlot(slotAt: string, now: string, taps: Tap[], waitMin: number): Slot {
  const slot = Date.parse(slotAt), t = Date.parse(now);
  const seen = taps.filter((x) => Date.parse(x.at) <= t);
  if (seen.some((x) => x.kind === 'here')) return 'met';
  if (seen.some((x) => x.kind === 'on_my_way')) return 'coming'; // shortcut: stays open until the person marks it; no timer on "coming"
  return t - slot >= waitMin * 60_000 ? 'no_show' : 'pending';
}
