// What the Ship and Pickup sheets read besides the world's rows: where a parcel can go near the person, what cancelling a
// sale costs on each site, what shipping without tracking gives up, the money's four words, and meeting a buyer: the days, spans and
// safe places. Times are relative to NOW like everything else here, so renders are stable.
import { decision } from './build.ts';
import { day, inHours, ms, NOW, usd } from './format.ts';
import type { Cents, Iso, Order, Site } from './types.ts';
import type { World } from './world.ts';

// Drop-off spots near the person. Fiction for the demo, as every place in the worlds is. NOW is Sunday noon, when post
// offices are shut, so each spot carries the next time it takes a parcel. USPS carrier pickup is free for Ground Advantage
// (observed, spec/features/sold.md, "USPS carrier pickup is free"), so the door is a spot too.
export type DropOff = { id: string; name: string; kind: 'counter' | 'door'; distance_mi: number | null; next_open: Iso };
export const DROP_OFFS: DropOff[] = [
  { id: 'do_main', name: 'Post office, Main St', kind: 'counter', distance_mi: 0.6, next_open: inHours(20) },
  { id: 'do_oak', name: 'Post office, Oak Ave', kind: 'counter', distance_mi: 1.8, next_open: inHours(20.5) },
  { id: 'do_door', name: 'Picked up at your door', kind: 'door', distance_mi: null, next_open: inHours(22) },
];

// What the person gives up by shipping without tracking. eBay decides a not-received case against a seller with no
// tracked service; Depop, Mercari and Facebook protect only parcels sent on their own label (observed,
// research/sold/nate/trust-returns-disputes.md §3). One line, the same for every site, since none protects it.
export const NO_TRACKING = 'Without tracking, the site can’t protect you if the buyer says it never came.';

// What cancelling a sold order does on each site, shown before the tap (spec/ways-out.md §6.9). eBay: a seller cancel for
// out of stock is a transaction defect (observed). Mercari: up to 5% of the price, at most $25 (observed). Depop, Poshmark,
// Facebook: no seller-cancel penalty found (research/sold/nate/trust-returns-disputes.md §3, a narrow search).
export function cancelCost(site: Site, price: Cents): string {
  if (site === 'ebay') return 'The site marks your seller record.';
  if (site === 'mercari') return `The site may charge you ${usd(Math.min(2500, Math.round(price * 0.05)))}.`;
  return 'The site charges you nothing for it.';
}
export const CANCEL_REASONS = [
  { id: 'broke', label: 'It broke' },
  { id: 'gone', label: 'Sold it in person' },
  { id: 'other', label: 'Something else' },
] as const;

// Meeting a buyer (decision "no fixed pickup windows", Ben 05:18 to 05:24; spec/edge-cases.md §16). Nothing is set up
// ahead and no calendar is read: the person taps the days this week that work and drags a span on each, picks a place,
// and the agent says it to the buyer the way a person would. Times are half hours from local midnight (28 is 2 pm).
const OFFSET = -360 * 60e3, DAY = 864e5;
const iso = (t: number): Iso => new Date(t).toISOString().replace('.000Z', 'Z');
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export type MeetDay = { key: string; label: string; word: string; midnight: Iso };
// The next seven days from now, as the chips show them: "Today", then "Mon 16".
export function nextDays(now: Iso = NOW): MeetDay[] {
  const first = Math.floor((ms(now) + OFFSET) / DAY) * DAY - OFFSET;
  return Array.from({ length: 7 }, (_, i) => {
    const t = first + i * DAY, local = new Date(t + OFFSET + 12 * 3600e3), name = SHORT[local.getUTCDay()];
    return { key: iso(t).slice(0, 10), label: i === 0 ? 'Today' : `${name} ${local.getUTCDate()}`, word: i === 0 ? 'today' : i === 1 ? 'tomorrow' : name, midnight: iso(t) };
  });
}
// Daylight by default; a span that ends after dark asks first. Chicago's sunset in mid-November is about 4:30 pm
// (asserted, any almanac), so dark starts at 33 half hours.
export const DARK = 33;
// The span a day gets when it is first tapped: an afternoon in daylight.
export const FIRST_SPAN = { start: 28, end: 32 };
function clockOf(h: number, withPart: boolean) {
  const hr = Math.floor(h / 2), half = h % 2 ? ':30' : '', part = hr < 12 || hr === 24 ? 'am' : 'pm';
  return `${hr % 12 || 12}${half}${withPart ? ` ${part}` : ''}`;
}
// "2 to 4 pm", "11 am to 1 pm", "2:30 to 4 pm".
export function spanWords(start: number, end: number): string {
  return `${clockOf(start, (start < 24) !== (end < 24))} to ${clockOf(end, true)}`;
}
export const atTime = (day: MeetDay, h: number): Iso => iso(ms(day.midnight) + h * 1800e3);
// What the agent writes to the buyer from what was tapped: one sentence of times, one of place, one question. Never a list
// of slots, never a form (edge-cases §16, step 2).
export function freeLine(picks: { day: MeetDay; start: number; end: number }[], place: string): string {
  const times = picks.map(p => `${p.day.word} ${spanWords(p.start, p.end)}`);
  const said = times.length <= 1 ? times.join('') : `${times.slice(0, -1).join(', ')} or ${times[times.length - 1]}`;
  const ask = picks.length === 1 ? 'Does that suit you?' : picks.length === 2 ? 'Does either suit you?' : 'Does one of those suit you?';
  // "Library parking lot, Main St" reads as a person says it: "Library parking lot on Main St".
  return `I’m free ${said}. ${place.replace(/, (?=[^,]+$)/, " on ")} works for me. ${ask}`;
}
// Safe places to meet, after the saved spot: a police station's safe exchange zone first, then a busy, lit, public spot
// (edge-cases §16, "Where"). Fiction for the demo, as every place in the worlds is.
export const SAFE_SPOTS = [
  { id: 'sp_police', label: 'Police station, Elm St', line: 'A safe exchange zone, lit and on camera' },
  { id: 'sp_store', label: 'Grocery store entrance, Oak Ave', line: 'Busy and lit until 10 pm' },
] as const;
// Who is coming, as the site shows them (edge-cases §16, step 3: name, rating, reviews, time on the site). The worlds
// hold no buyer profiles, so these are demo fiction; a real one is read from the site.
export const PROFILES: Record<string, { rating: number; reviews: number; since: string }> = {
  Jordan: { rating: 4.9, reviews: 31, since: '2019' },
};
// The cases the Pickup page asks for, since no world holds them: a buyer asking to meet (`case=ask`), and the buyer's pick
// coming back (`case=pick`): tomorrow at 3 pm at the saved spot.
export const MEET_ASK = { text: 'Hi, is it still available? When could I come get it?', sent_at: inHours(-0.4) };
export const MEET_PICK = { text: 'Tomorrow 3 pm works, see you at the library lot', sent_at: inHours(-0.2), at: inHours(27) };

// Which sales wait for a label. A thing that sold on two sites ships nothing until the person picks a buyer on the
// `double_sale` card on Today, and the cancelled sale never gets a label (spec/edge-cases.md §1; sold.md, "Double sale").
const LIVE: Order['state'][] = ['paid', 'to_ship'];
export function twoSold(w: World, itemId: string): boolean {
  if (w.decisions.some(d => d.kind === 'double_sale' && d.item_id === itemId && d.state === 'open')) return true;
  return w.orders.filter(o => o.kind === 'sale' && o.item_id === itemId && o.state !== 'cancelled' && o.state !== 'refunded').length > 1;
}
// The double-sale case for the Ship page (`?case=double`): a second buyer paid on another site inside the delist window,
// and the double sale card waits on Today. No world holds one, so the page asks for it, as Pickup asks for `case=late`.
export function withDoubleSale(w: World, itemId: string): World {
  const first = w.orders.find(o => o.kind === 'sale' && o.item_id === itemId && LIVE.includes(o.state));
  if (!first) return w;
  const site: Site = first.site === 'mercari' ? 'ebay' : 'mercari';
  const second: Order = { ...first, id: `${first.id}_2`, site, buyer: 'second_buyer', external_order_id: `${site.slice(0, 2).toUpperCase()}-${first.id.slice(-4)}2`, created_at: inHours(-0.05, w.now) };
  const card = decision({ id: `dec_dbl_${itemId}`, kind: 'double_sale', item_id: itemId, site: null, feed: 'now', group_form: 'single', deadline: null, order_id: first.id, why: 'It sold on two sites.', options: [], suggested: null });
  return { ...w, orders: [...w.orders, second], decisions: [...w.decisions, card] };
}
export const shippable = (w: World): Order[] =>
  w.orders.filter(o => o.kind === 'sale' && LIVE.includes(o.state) && !twoSold(w, o.item_id));

// Where the money is, in four words (spec/edge-cases.md §2): Sold, On its way, Ready on the site, In your bank. Each step
// carries its date where the site's rule gives one from what has happened, and the rule itself where it waits on an event
// still to come (the parcel arriving). Rules: eBay funds are available 1 to 2 business days after payment and reach the
// bank 1 to 3 business days later (observed); Mercari releases 72 hours after delivery, then about 5 business days to the
// bank; Poshmark releases when the buyer accepts or 3 days after delivery; Facebook shipped orders start 15 days after
// shipping or 5 after delivery (asserted). Depop: not found, so no date is given
// (research/price/nate/fees-and-taxes.md §1, research/sold/nate/trust-returns-disputes.md §2).
export type MoneyStep = {
  word: 'Sold' | 'On its way' | 'Ready on the site' | 'In your bank'; done: boolean; at?: Iso; line: string;
  instant_cents?: Cents; instant_default?: false;
};
// Instant payout where the site states its fee: Mercari Instant Pay $3 (observed), Poshmark Instant Transfer $2
// (asserted). eBay, Depop and Facebook: not found, so not offered. Never the default (edge-cases §2).
export const INSTANT: Partial<Record<Site, Cents>> = { mercari: 300, poshmark: 200 };
function businessDays(from: Iso, n: number): Iso {
  let t = ms(from);
  for (let left = n; left > 0;) { t += DAY; const wd = new Date(t + OFFSET).getUTCDay(); if (wd !== 0 && wd !== 6) left--; }
  return iso(t);
}
const READY: Partial<Record<Site, string>> = {
  mercari: '3 days after it arrives',
  poshmark: 'When the buyer accepts it, or 3 days after it arrives',
  facebook: '5 days after it arrives, or 15 after you ship it',
};
const BANK: Partial<Record<Site, string>> = { mercari: 'About 5 business days after that' };
// A day inside a sentence: "Ship by tomorrow", "By Tuesday".
export const byDay = (t: Iso, now: Iso = NOW) => { const d = day(t, now); return d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : d; };
export function moneyPath(o: Order, now: Iso = NOW): MoneyStep[] {
  const shipped = !LIVE.includes(o.state) && o.state !== 'cancelled';
  const released = o.state === 'released';
  const ready = o.clocks.release_at ?? (o.site === 'ebay' ? businessDays(o.created_at, 2) : undefined);
  const bank = released ? o.clocks.release_at : o.site === 'ebay' && ready ? businessDays(ready, 3) : undefined;
  const instant = INSTANT[o.site];
  return [
    { word: 'Sold', done: true, at: o.created_at, line: day(o.created_at, now) },
    { word: 'On its way', done: shipped, at: o.clocks.ship_by, line: o.clocks.ship_by ? `Ship by ${byDay(o.clocks.ship_by, now)}` : 'When you ship it' },
    { word: 'Ready on the site', done: released, at: ready, line: ready ? `By ${byDay(ready, now)}` : READY[o.site] ?? 'When the site releases it' },
    { word: 'In your bank', done: released, at: bank, line: bank ? `By ${byDay(bank, now)}` : BANK[o.site] ?? 'The site doesn’t say how long', ...(instant ? { instant_cents: instant, instant_default: false as const } : {}) },
  ];
}
