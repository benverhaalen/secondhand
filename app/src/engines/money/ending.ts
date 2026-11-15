// negotiation.md §3 step 2; D13 learns the ending per site and category.
export type EndingRule = { above_cents: number; digits: number[] };
export const DEFAULT_ENDING: EndingRule = { above_cents: 2000, digits: [5, 8] };
const DOLLAR = 100; // Fixed unit: cents per dollar.
const CYCLE = 10 * DOLLAR; // Fixed decimal ending cycle.

export function money(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${field} must be a whole number of cents, zero or more`);
  return value;
}
function amount(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${field} must be finite, zero or more`);
  return value;
}
function validateRule(rule: EndingRule): void {
  money(rule.above_cents, 'above_cents');
  if (!rule.digits.length || rule.digits.some(d => !Number.isInteger(d) || d < 0 || d > 9)) throw new RangeError('digits must be decimal digits');
}

export function endings(lo_cents: number, hi_cents: number, rule: EndingRule = DEFAULT_ENDING): number[] {
  amount(lo_cents, 'lo_cents');
  if (hi_cents === Infinity) hi_cents = Number.MAX_SAFE_INTEGER;
  amount(hi_cents, 'hi_cents'); validateRule(rule);
  lo_cents = Math.ceil(lo_cents); hi_cents = Math.floor(hi_cents);
  const out: number[] = [];
  const dollar = BigInt(DOLLAR), hi = BigInt(hi_cents);
  for (let c = ((BigInt(lo_cents) + dollar - 1n) / dollar) * dollar; c <= hi; c += dollar) {
    const value = Number(c);
    if (BigInt(value) !== c) continue;
    if (c <= BigInt(rule.above_cents) || rule.digits.includes(Number((c / dollar) % 10n))) out.push(value);
  }
  return out;
}

// Fractional inputs round to whole cents on an ending. A tie goes down.
export function roundToEnding(cents: number, rule: EndingRule = DEFAULT_ENDING, lo_cents = 0, hi_cents = Number.MAX_SAFE_INTEGER): number | null {
  amount(cents, 'cents');
  amount(lo_cents, 'lo_cents');
  // Infinity is the existing caller protocol for an unbounded search, never a returned amount.
  if (hi_cents === Infinity) hi_cents = Number.MAX_SAFE_INTEGER;
  amount(hi_cents, 'hi_cents'); validateRule(rule);
  lo_cents = Math.ceil(lo_cents); hi_cents = Math.floor(hi_cents);
  if (lo_cents > hi_cents) return null;
  const near = endings(Math.max(lo_cents, Math.ceil(cents - CYCLE), 0), Math.min(hi_cents, Math.floor(cents + CYCLE)), rule);
  return near.reduce<number | null>((best, c) => best === null || Math.abs(c - cents) < Math.abs(best - cents) ? c : best, null);
}
