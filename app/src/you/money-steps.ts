// Where one sale's money is, in four words with their dates (spec/edge-cases.md, "The money arrives at different times",
// Ben 05:05): Sold, On its way, Ready on the site, In your bank. Each site has its own clock; a date we cannot know is said
// in words ("after you ship"), never guessed. Instant payout is offered with its fee where the site has one, never the default
// ("Instant payout costs money"). Local pickup is paid in hand, so it has two words: Sold, then In your hand.
// The per-site facts are research/price/nate/fees-and-taxes.md and spec/edge-cases.md, with their marks; move them into
// spec/sites.mjs when its FACTS table grows payout rows.
import { day, ms, type Order, type Site, type World } from '@/demo';

type Clock = {
  ready: string;                     // when the site makes it ready, in words
  readyDays?: { from: 'payment' | 'delivery'; business: number }; // a date we can work out
  bankDays?: number;                 // business days from ready to the bank
  instantCents?: number;             // the fee to get it today, where the site has one
};
const CLOCK: Record<Site, Clock> = {
  // observed: available 1 to 2 business days after payment, credited 1 to 3 business days later; instant fee not found
  ebay: { ready: '1 to 2 days after payment', readyDays: { from: 'payment', business: 2 }, bankDays: 3 },
  // observed: 72 hours after delivery (edge-cases), direct deposit about 5 business days, Instant Pay $3
  mercari: { ready: '3 days after it arrives', readyDays: { from: 'delivery', business: 3 }, bankDays: 5, instantCents: 300 },
  // edge-cases: after the buyer accepts, or 3 days after delivery; Instant Transfer $2 (asserted)
  poshmark: { ready: 'when the buyer accepts it, or 3 days after it arrives', instantCents: 200 },
  // not found
  depop: { ready: 'when the buyer gets it' },
  // edge-cases: shipped orders up to 20 days
  facebook: { ready: 'up to 20 days after the sale' },
};

export type Step = { word: string; when: string; done: boolean; t?: number }; // t: the worked-out time, where there is one
const DAY = 864e5;
const addBusiness = (t: number, n: number) => { let d = t; for (let i = 0; i < n;) { d += DAY; const wd = new Date(d).getUTCDay(); if (wd !== 0 && wd !== 6) i++; } return d; };
const iso = (t: number) => new Date(t).toISOString();
// "About tomorrow", "About Tuesday", "About Nov 30": the relative words go lower case inside the phrase.
const about = (t: number, now: string) => { const d = day(iso(t), now); return `About ${['Today', 'Tomorrow', 'Yesterday'].includes(d) ? d.toLowerCase() : d}`; };
// A step's date inside a sentence: "about Tuesday", "after you ship", but "Nov 11" stays as it is.
export const inLine = (when: string) => /^(About|After|At|When|Up|Shipped|Today|Tomorrow|Yesterday)\b/.test(when) ? when.charAt(0).toLowerCase() + when.slice(1) : when;

export function moneySteps(o: Order, now: string, pickupAt?: string): { steps: Step[]; now: number; instantCents: number | null } {
  const c = CLOCK[o.site], sold = { word: 'Sold', when: day(o.created_at, now), done: true };
  if (o.state === 'pickup_booked' || (o.site === 'facebook' && !o.label && o.state === 'handed_over')) {
    const done = o.state === 'handed_over';
    return { steps: [sold, { word: 'In your hand', when: pickupAt ? `At pickup, ${day(pickupAt, now)}` : 'At pickup', done }], now: done ? 1 : 0, instantCents: null };
  }
  const shipped = !['paid', 'to_ship'].includes(o.state);
  const released = o.state === 'released';
  const readyAt = o.clocks.release_at ? ms(o.clocks.release_at)
    : c.readyDays?.from === 'payment' ? addBusiness(ms(o.created_at), c.readyDays.business) : null;
  const bankAt = readyAt !== null && c.bankDays !== undefined ? addBusiness(readyAt, c.bankDays) : null;
  const inBank = released && bankAt !== null && bankAt <= ms(now);
  const steps: Step[] = [
    sold,
    { word: 'On its way', when: shipped ? 'Shipped' : 'After you ship', done: shipped },
    { word: 'Ready on the site', when: readyAt !== null ? (released ? day(iso(readyAt), now) : about(readyAt, now)) : c.ready.charAt(0).toUpperCase() + c.ready.slice(1), done: released, t: readyAt ?? undefined },
    { word: 'In your bank', when: bankAt !== null ? (inBank ? day(iso(bankAt), now) : about(bankAt, now)) : 'When you cash out', done: inBank, t: bankAt ?? undefined },
  ];
  const at = steps.filter(s => s.done).length - 1;
  // Instant payout only makes sense once the money is ready on the site and not yet in the bank.
  return { steps, now: at, instantCents: released && !inBank && c.instantCents ? c.instantCents : null };
}

// Every sale's money for Payouts and the You tab: the steps, what it keeps, and whether the last word is done.
// A claim or a return holds the money where it is; it is said instead of a next date.
export type MoneyRow = { o: Order; title: string; kept: number; steps: Step[]; at: number; instantCents: number | null; held: boolean; arrived: boolean };
export function moneyRows(w: World): MoneyRow[] {
  return w.orders.filter(o => o.kind === 'sale' && o.state !== 'cancelled' && o.state !== 'refunded').map(o => {
    const m = moneySteps(o, w.now);
    return {
      o, title: w.items.find(i => i.id === o.item_id)?.title ?? '', kept: o.price_cents - o.fees_cents - o.shipping_cents,
      steps: m.steps, at: m.now, instantCents: m.instantCents,
      held: o.state === 'return_open' || o.state === 'dispute_open', arrived: m.steps[m.steps.length - 1].done,
    };
  }).sort((a, b) => ms(b.o.created_at) - ms(a.o.created_at));
}
// What a row says under its title: where the money is now, and the next word with its date.
export function moneyLine(r: MoneyRow): string {
  if (r.held) return 'Held while the buyer’s claim is open';
  const cur = r.steps[r.at], next = r.steps[r.at + 1];
  // Every row is sold, so a row still at Sold says only what comes next: "On its way after you ship".
  if (next && r.at === 0) return `${next.word} ${inLine(next.when)}`;
  return next ? `${cur.word}. ${next.word} ${inLine(next.when)}` : `${cur.word} ${inLine(cur.when)}`;
}
// The soonest word still to come that has a worked-out date, across the money on its way, for the You tab:
// "Ready on the site about Tuesday". None when no site gives a date yet.
export function soonest(rows: MoneyRow[]): string | null {
  const next = rows.filter(r => !r.arrived && !r.held).flatMap(r => r.steps.filter(s => !s.done && s.t !== undefined)).sort((a, b) => a.t! - b.t!)[0];
  return next ? `${next.word} ${inLine(next.when)}` : null;
}
