// Site price endings in cents. D13 step 3 learns the ending per site and category from sold comps;
// until then the negotiation engine's rule stands: endings in 5 or 8 above $20, whole dollars below.
export type EndingRule = { above_cents: number; digits: number[] };
export const DEFAULT_ENDING: EndingRule = { above_cents: 2000, digits: [5, 8] };

const DOLLAR = 100;
const fits = (cents: number, rule: EndingRule) =>
  cents % DOLLAR === 0 && (cents <= rule.above_cents || rule.digits.includes((cents / DOLLAR) % 10));

// Every price on an ending between lo and hi, both included, ascending.
export function endings(lo_cents: number, hi_cents: number, rule: EndingRule = DEFAULT_ENDING): number[] {
  const out: number[] = [];
  for (let c = Math.ceil(lo_cents / DOLLAR) * DOLLAR; c <= hi_cents; c += DOLLAR) if (fits(c, rule)) out.push(c);
  return out;
}

// The nearest ending; a tie goes down. Clamped to [lo, hi] when given, and null when no ending lies inside them.
export function roundToEnding(cents: number, rule: EndingRule = DEFAULT_ENDING, lo_cents = 0, hi_cents = Infinity): number | null {
  const near = endings(Math.max(lo_cents, cents - 10 * DOLLAR), Math.min(hi_cents, cents + 10 * DOLLAR), rule);
  if (near.length === 0) return null;
  return near.reduce((best, c) => (Math.abs(c - cents) < Math.abs(best - cents) ? c : best));
}
