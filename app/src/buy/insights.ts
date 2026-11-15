// What the listings a search found say, computed only from those rows (Nate, words.md 2026-11-15: "show how we can run
// data analysis and extract insights this reveals accurately"). Pure and deterministic. These are asks for sale now,
// never sales: what sold, and why, comes from the buying conversation's sold-price tools (app/src/buy/chat/use-shop.ts).
import type { Reach } from './reach';

type Row = Reach['results'][number];
export interface Spread { n: number; low: number; q1: number; median: number; q3: number; high: number; currency: string }
export interface Insights {
  spread: Spread | null;                          // asks in the most common currency, in cents
  bySite: { id: string; n: number; median: number }[];   // cheapest median first; a site with under 3 asks is left out
  terms: { term: string; n: number }[];           // words most listings use beyond the query, most first
}

const cents = (r: Row) => (r.delivered_cents ?? r.price_cents);
// Nearest-rank quantile on sorted cents: the value a person could find in the list, never one between two rows.
const at = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
const STOP = new Set(['the', 'and', 'with', 'for', 'size', 'mens', 'men', 'womens', 'women', 'new', 'nwt', 'euc', 'sz', 'in', 'of', 'a', 'w', 'l', 'x', 'by', 'to', 'on']);

export function insights(reach: Reach, query: string, home = 'USD'): Insights {
  const priced = reach.results.filter(r => cents(r));
  const counts = new Map<string, number>();
  for (const r of priced) counts.set(cents(r)!.currency, (counts.get(cents(r)!.currency) ?? 0) + 1);
  // The person's own currency whenever three asks are in it: a read that came back in pounds (eBay shows its prices in
  // the reader's country) must not turn the whole answer into pounds over the dollar asks beside it.
  const currency = (counts.get(home) ?? 0) >= 3 ? home : [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const same = priced.filter(r => cents(r)!.currency === currency);
  const sorted = same.map(r => cents(r)!.amount_cents).sort((a, b) => a - b);
  const spread = sorted.length >= 3 && currency ? { n: sorted.length, low: sorted[0], q1: at(sorted, 0.25), median: at(sorted, 0.5), q3: at(sorted, 0.75), high: sorted.at(-1)!, currency } : null;

  const bySiteRows = new Map<string, number[]>();
  for (const r of same) bySiteRows.set(r.site, [...(bySiteRows.get(r.site) ?? []), cents(r)!.amount_cents]);
  const bySite = [...bySiteRows.entries()].filter(([, v]) => v.length >= 3)
    .map(([id, v]) => ({ id, n: v.length, median: at([...v].sort((a, b) => a - b), 0.5) }))
    .sort((a, b) => a.median - b.median || a.id.localeCompare(b.id));

  const asked = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const seen = new Map<string, number>();
  for (const r of reach.results) {
    // A word counts once per listing; a slug title (a Depop URL name) has no spaces and is skipped.
    if (!/\s/.test(r.title)) continue;
    const words = new Set(r.title.toLowerCase().replace(/[’']/g, '').split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w) && ![...asked].some(a => w.startsWith(a))));
    for (const w of words) seen.set(w, (seen.get(w) ?? 0) + 1);
  }
  const terms = [...seen.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([term, n]) => ({ term, n }));
  return { spread, bySite, terms };
}
