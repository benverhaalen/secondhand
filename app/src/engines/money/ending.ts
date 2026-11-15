// negotiation.md §3 step 2; D13 learns the ending per site and category.
export type EndingRule = { above_cents: number; digits: number[] };
export const DEFAULT_ENDING: EndingRule = { above_cents: 2000, digits: [5, 8] };
const DOLLAR = 100; // Fixed unit: cents per dollar.
const CYCLE = 10 * DOLLAR; // Fixed decimal ending cycle.

export function money(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be a whole number of cents, zero or more`);
  return value;
}
function validateRule(rule: EndingRule): void {
  money(rule.above_cents, 'above_cents');
  if (!rule.digits.length || rule.digits.some(d => !Number.isInteger(d) || d < 0 || d > 9)) throw new RangeError('digits must be decimal digits');
}
const fits = (c: number, rule: EndingRule) => c <= rule.above_cents || rule.digits.includes((c / DOLLAR) % 10);

export function endings(lo_cents: number, hi_cents: number, rule: EndingRule = DEFAULT_ENDING): number[] {
  money(lo_cents, 'lo_cents'); money(hi_cents, 'hi_cents'); validateRule(rule);
  const out: number[] = [];
  for (let c = Math.ceil(lo_cents / DOLLAR) * DOLLAR; c <= hi_cents; c += DOLLAR) if (fits(c, rule)) out.push(c);
  return out;
}

// Inputs and output are integer cents. A tie goes down.
export function roundToEnding(cents: number, rule: EndingRule = DEFAULT_ENDING, lo_cents = 0, hi_cents = Number.MAX_SAFE_INTEGER): number | null {
  money(cents, 'cents');
  // Infinity is the existing caller protocol for an unbounded search, never a returned amount.
  if (hi_cents === Infinity) hi_cents = Number.MAX_SAFE_INTEGER;
  money(lo_cents, 'lo_cents'); money(hi_cents, 'hi_cents'); validateRule(rule);
  if (lo_cents > hi_cents) return null;
  const target = Math.min(hi_cents, Math.max(lo_cents, cents));
  const near = endings(Math.max(lo_cents, Math.ceil(target - CYCLE), 0), Math.min(hi_cents, Math.floor(target + CYCLE)), rule);
  return near.reduce<number | null>((best, c) => best === null || Math.abs(c - cents) < Math.abs(best - cents) ? c : best, null);
}
