// The fixed "now" every demo render reads, and the formatters for money and time. Renders are stable because
// nothing here reads the clock. Times are UTC in the data and shown in the person's zone (America/Chicago, UTC-6 in November).
import type { Cents, Iso } from './types.ts';

export const NOW: Iso = '2026-11-15T18:00:00Z'; // Sunday, noon in Chicago
const OFFSET_MIN = -360;
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;

export const ms = (iso: Iso) => Date.parse(iso);
const iso = (t: number): Iso => new Date(t).toISOString().replace('.000Z', 'Z');
// A time relative to now: inHours(-26) is 26 hours ago.
export const inMinutes = (m: number, now: Iso = NOW): Iso => iso(ms(now) + m * MIN);
export const inHours = (h: number, now: Iso = NOW): Iso => iso(ms(now) + h * HOUR);
export const inDays = (d: number, now: Iso = NOW): Iso => iso(ms(now) + d * DAY);

// $85, $85.20, $12,950. Whole dollars drop the cents; a negative amount reads -$12.78.
export function usd(cents: Cents): string {
  if (!Number.isInteger(cents)) throw new Error(`money is whole cents, got ${cents}`);
  const sign = cents < 0 ? '-' : '', a = Math.abs(cents);
  const dollars = Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${dollars}${a % 100 ? '.' + String(a % 100).padStart(2, '0') : ''}`;
}
// Always two decimals, for records and receipts: $85.00.
export const usdExact = (cents: Cents) => { const s = usd(cents); return s.includes('.') ? s : s + '.00'; };
export const range = (r: { low: Cents; high: Cents }) => `${usd(r.low)} to ${usd(r.high)}`;

// Time left before a deadline, in the words a card shows: 3h 40m, 45m, 2d 4h. Null once it has passed.
export function countdown(deadline: Iso, now: Iso = NOW): string | null {
  const left = ms(deadline) - ms(now);
  if (left <= 0) return null;
  const d = Math.floor(left / DAY), h = Math.floor((left % DAY) / HOUR), m = Math.floor((left % HOUR) / MIN);
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(1, m)}m`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const local = (t: Iso) => new Date(ms(t) + OFFSET_MIN * MIN);
const dayNumber = (t: Iso) => Math.floor((ms(t) + OFFSET_MIN * MIN) / DAY);

// 3:30 pm
export function clock(t: Iso): string {
  const d = local(t), h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`;
}
// Today, Tomorrow, Yesterday, Tuesday (within a week), else Nov 2.
export function day(t: Iso, now: Iso = NOW): string {
  const diff = dayNumber(t) - dayNumber(now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WEEKDAYS[local(t).getUTCDay()];
  return `${MONTHS[local(t).getUTCMonth()]} ${local(t).getUTCDate()}`;
}
// For a deadline inside a sentence: today at 3 pm, tomorrow at 6 pm, Tuesday at 6 pm, Nov 30 at 9 am.
export function when(t: Iso, now: Iso = NOW): string {
  const d = day(t, now);
  return `${d === 'Today' || d === 'Tomorrow' || d === 'Yesterday' ? d.toLowerCase() : d} at ${clock(t)}`;
}
// For a past time on a row: 5m ago, 3h ago, Yesterday, Tuesday, Nov 2.
export function ago(t: Iso, now: Iso = NOW): string {
  const past = ms(now) - ms(t);
  if (past < HOUR) return `${Math.max(1, Math.floor(past / MIN))}m ago`;
  if (past < 12 * HOUR) return `${Math.floor(past / HOUR)}h ago`;
  return day(t, now);
}
export const daysBetween = (a: Iso, b: Iso) => Math.floor((ms(b) - ms(a)) / DAY);
