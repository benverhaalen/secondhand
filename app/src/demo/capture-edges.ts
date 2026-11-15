// Where capture meets what people get wrong or do not know (spec/edge-cases.md §3, §4 and §6, agent proposal from Ben and a
// mentor at 05:05): a misspelled name is matched to the catalog before it is shown, a typed price far outside the sold
// range asks once, "I don't know" is an answer, and a maker's mark stops the quick path. Nothing here reads the clock.
import { range, usd } from './format.ts';
import { PRODUCTS } from './market.ts';
import type { Cents } from './types.ts';

// Known ways people write a name, beside the catalog's own spelling (edge-cases §3: "lulu lemon", "air jordon").
const ALIASES: Record<string, string> = { 'lulu lemon': 'lululemon', 'air jordon': 'Air Jordan', 'levis': 'Levi’s', 'carhart': 'Carhartt' };
// The names the catalog knows: each product's brand and model, and the alias targets.
const NAMES = [...new Set([...PRODUCTS.flatMap(p => [p.brand, p.model.replace(/\s+[A-Z]\d+$/, '')]), ...Object.values(ALIASES)])];

// Edits between two words (insert, delete, change, swap two side by side).
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

// A typed name, matched to the catalog with spelling tolerance and aliases: "Carhart" is shown as "Carhartt". A word the
// catalog does not know is kept as typed. A word of 4 letters or fewer must match (Bike is not Nike); one edit is
// tolerated up to 7 letters, two past that.
export function correct(typed: string): string {
  const t = typed.trim(), key = t.toLowerCase();
  if (!t) return t;
  if (ALIASES[key]) return ALIASES[key];
  let best: { name: string; d: number } | null = null;
  for (const name of NAMES) {
    const d = distance(key, name.toLowerCase());
    if (d <= (key.length <= 4 ? 0 : key.length <= 7 ? 1 : 2) && (!best || d < best.d)) best = { name, d };
  }
  return best?.name ?? t;
}

// The product a description names, read word by word with the same spelling tolerance: "carhart detroit jacket".
export function described(text: string) {
  const words = text.toLowerCase().split(/[^a-z0-9’']+/).filter(Boolean).map(w => correct(w).toLowerCase());
  return PRODUCTS.find(p => words.includes(p.brand.toLowerCase()) && p.model.toLowerCase().split(/\s+/).some(m => words.includes(m))) ?? null;
}

// A typed price more than 3 times the top of the sold range, or under a third of the bottom, asks once with the range
// (edge-cases §3, "a price with an extra zero"). Within it, nothing is asked.
export function priceAsk(cents: Cents, sold: { low: Cents; high: Cents }): string | null {
  if (cents <= 3 * sold.high && cents * 3 >= sold.low) return null;
  return `Similar ones sold for ${range(sold)}. List at ${usd(cents)}?`;
}
// What a person typed as a price, in cents; nothing when it is not a number.
export function cents(typed: string): Cents | null {
  const n = Number(typed.replace(/[$,\s]/g, ''));
  return typed.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// The brass lamp from a relative's spare room (the clearing world's it_lamp): two lamps look alike, so identify offers both
// and "I don't know"; and a maker's mark on its base may mean it is worth far more (edge-cases §4).
export const LAMP = {
  key: 'brass-lamp' as const,
  candidates: ['Banker’s lamp', 'Desk lamp'] as const,
  mark: 'A maker’s mark on the base',
};
