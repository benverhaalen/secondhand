// Turns each site's own signals into readings that can sit side by side, without pretending a Depop like
// equals an eBay watcher. Three readings, all *agent proposal* (../levers-and-signals.md, "Relative signals"):
//   band      each signal against listings like it on the same site at the same age (listing D15)
//   rate      how many of a signal one sale has taken on that site: its "exchange rate", learned from sold listings
//   pull      the item's signals converted to sales' worth through those rates, the max within a site, summed across sites
// A signal with no reference or no rate yet is shown raw and left out of pull: never guessed.
import { data } from './defaults.mjs';

export const STAGES = Object.keys(data.stages); // exposure, attention, interest, intent, outcome
export const MIN_REFERENCE = 50; // pooled listings needed for a band (listing D15)
export const MIN_SALES = 5;      // sold listings needed before a rate is trusted (a starting value)

export const stageOf = (site, signal) => data.sites[site]?.signals.find(s => s.id === signal)?.stage ?? null;

// ref: { n, p25, p75 } for this site, category, price position and age in days.
export function band(count, ref) {
  if (count == null || !ref || ref.n < MIN_REFERENCE) return null;
  return count > ref.p75 ? 'ahead' : count < ref.p25 ? 'behind' : 'on';
}

// history: finished listings, [{ site, counts: { signal: n }, sold: bool }]. Returns { site: { signal: perSale } }.
export function rates(history) {
  const acc = {};
  for (const { site, counts, sold } of history) {
    const s = (acc[site] ??= { sales: 0, totals: {} });
    if (sold) s.sales += 1;
    for (const [sig, n] of Object.entries(counts)) s.totals[sig] = (s.totals[sig] ?? 0) + n;
  }
  const out = {};
  for (const [site, { sales, totals }] of Object.entries(acc)) {
    if (sales < MIN_SALES) continue;
    out[site] = Object.fromEntries(Object.entries(totals).filter(([, t]) => t > 0).map(([sig, t]) => [sig, t / sales]));
  }
  return out;
}

// item: { site: { signal: count } }; r: output of rates(). Within a site the same buyers like, save and offer,
// so the site's pull is its strongest signal, not the sum; across sites buyers are mostly different people.
export function pull(item, r) {
  const sites = {};
  let total = 0, known = false;
  for (const [site, counts] of Object.entries(item)) {
    let best = null;
    for (const [sig, n] of Object.entries(counts)) {
      const perSale = r[site]?.[sig];
      if (!perSale || !n) continue;
      const v = n / perSale;
      if (!best || v > best.value) best = { signal: sig, value: v };
    }
    const top = strongest(site, counts);
    sites[site] = { pull: best?.value ?? null, by: best?.signal ?? null, strongest: top };
    if (best) { total += best.value; known = true; }
  }
  return { total: known ? total : null, sites };
}

// The furthest stage a site's signals reached, for the one word on an item tile ("2 offers" beats "40 views").
export function strongest(site, counts) {
  let top = null;
  for (const [sig, n] of Object.entries(counts)) {
    const st = stageOf(site, sig);
    if (!n || !st || st === 'outcome') continue;
    if (!top || STAGES.indexOf(st) > STAGES.indexOf(top.stage) || (st === top.stage && n > top.count)) top = { signal: sig, stage: st, count: n };
  }
  return top;
}
