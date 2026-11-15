// The numbers behind the You dashboard (Ben 06:19: "I want to know my sales, I want to know my listings, I want to know how
// they're doing ... how much I could earn"). Pure functions of the world, so the page draws and never computes.
// Imports carry .ts so node --test reads this file without the app's bundler.
import { insights, records, type Item, type Listing, type Site, type World } from '../demo/index.ts';
import { keep } from '../engines/valuation/keep.ts';

const DAY = 864e5;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const live = (l: Listing) => l.state === 'live';
const daysUp = (w: World, l: Listing) => (l.posted_at ? Math.max(0, Math.floor((Date.parse(w.now) - Date.parse(l.posted_at)) / DAY)) : 0);

// What the live listings would pay, after each site's fees at the asking price (spec/features/price.md, D9 keep).
// One item on two sites at two prices is a range; when every item is on one site the low and the high are the same, and the
// page says one number (Ben 06:19: "if it was one site, it would just be one number").
export function couldEarn(w: World): { low: number; high: number; things: number } | null {
  const items = w.items.filter(i => (i.state === 'live' || i.state === 'stale') && i.listings.some(live));
  if (!items.length) return null;
  let low = 0, high = 0;
  for (const i of items) {
    const kept = i.listings.filter(live).map(l => keep(l.site, l.price_cents).keep_cents);
    low += Math.min(...kept); high += Math.max(...kept);
  }
  return { low, high, things: items.length };
}

// Everything being sold, by where it is: the Sell tab's shelves without Needs you (that shelf cuts across these), in the
// order a thing moves through them. Ids are Sell's ?filter= values, so a tap lands on the same shelf.
export type StateKey = 'in_progress' | 'live' | 'sold' | 'unsold' | 'kept';
const BUCKETS: { id: StateKey; word: string; states: Item['state'][] }[] = [
  { id: 'in_progress', word: 'Getting ready', states: ['capturing', 'researching', 'review', 'failed'] },
  { id: 'live', word: 'Live', states: ['live', 'stale'] },
  { id: 'sold', word: 'Sold', states: ['sold', 'handed_over', 'done', 'returned', 'disputed'] },
  { id: 'unsold', word: 'Didn’t sell', states: ['unsold'] },
  { id: 'kept', word: 'Kept', states: ['kept'] },
];
export function byState(w: World): { id: StateKey; word: string; count: number }[] {
  return BUCKETS.map(b => ({ id: b.id, word: b.word, count: w.items.filter(i => b.states.includes(i.state)).length })).filter(b => b.count);
}

// Money kept each week, Monday to Sunday in the person's zone, with how many sales made it, so one big sale reads as one sale
// and not as a good week (Ben 06:19: "I could have sold one thing for like a whole lot of money"). Drawn once there are 3 sales
// in the 8 weeks: fewer is a sentence, not a shape.
const OFFSET = -6 * 36e5; // America/Chicago in November (demo/format.ts)
const monday = (t: number) => { const local = t + OFFSET, d = Math.floor(local / DAY), wd = (new Date(d * DAY).getUTCDay() + 6) % 7; return (d - wd) * DAY; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export type Week = { label: string; cents: number; sales: number; now: boolean };
export function salesWeeks(w: World, count = 8): Week[] | null {
  const rows = records(w), start = monday(Date.parse(w.now));
  const out = Array.from({ length: count }, (_, i) => {
    const from = start - (count - 1 - i) * 7 * DAY, d = new Date(from);
    const here = rows.filter(r => monday(Date.parse(r.date + 'T18:00:00Z')) === from);
    return { from, cents: here.reduce((a, r) => a + r.kept_cents, 0), sales: here.length, now: i === count - 1, day: d.getUTCDate(), month: d.getUTCMonth() };
  });
  if (out.reduce((a, x) => a + x.sales, 0) < 3) return null;
  return out.map((x, i) => ({ label: i === 0 || out[i - 1].month !== x.month ? `${MONTHS[x.month]} ${x.day}` : String(x.day), cents: x.cents, sales: x.sales, now: x.now }));
}

// The top of a money axis: the least of 1, 2, 2.5 and 5 times a power of ten, in whole dollars, at or over the tallest bar.
export function niceTop(cents: number): number {
  const dollars = Math.max(1, cents / 100), p = 10 ** Math.floor(Math.log10(dollars));
  const step = [1, 2, 2.5, 5, 10].find(s => s * p >= dollars) ?? 10;
  return step * p * 100;
}

// How each live thing is doing, against what is usual for it.
// Views, likes and offers: the usual is what the person's other live listings on the same site got per day, times the days this
// one has been up; it needs 3 listings to compare with on that site, else 3 across every site, else there is no usual (a guarded
// number never stands on fewer, spec/databricks.md §5.1). Watchers on eBay count as likes: both are a person saving it.
// Days up: the usual is the market's outlook for this listing, else how long the product takes to sell on that site, else how
// long the person's own sales took there. Where a site shows no views or likes, the cell says nothing instead of zero.
export type Metric = { value: number | null; usual: number | null };
export type Pulse = { id: string; title: string; key: string | null; sites: Site[]; price: { low: number; high: number }; line: string | null; slow: boolean; views: Metric; likes: Metric; offers: Metric; days: Metric };
const KINDS = ['views', 'likes', 'offers'] as const;
type Kind = typeof KINDS[number];
const read = (w: World, l: Listing, k: Kind): number | undefined =>
  k === 'views' ? l.interest.views : k === 'likes' ? (l.interest.likes === undefined && l.interest.watchers === undefined ? undefined : (l.interest.likes ?? 0) + (l.interest.watchers ?? 0))
    : w.offers.filter(o => o.listing_id === l.id && o.direction === 'in').length;

export function pulse(w: World): Pulse[] {
  const items = w.items.filter(i => (i.state === 'live' || i.state === 'stale') && i.listings.some(live));
  const all = items.flatMap(i => i.listings.filter(live));
  const rate = (k: Kind, site: Site): number | null => {
    const with_ = (ls: Listing[]) => ls.filter(l => read(w, l, k) !== undefined).map(l => read(w, l, k)! / Math.max(1, daysUp(w, l)));
    const here = with_(all.filter(l => l.site === site));
    if (here.length >= 3) return median(here);
    const every = with_(all);
    return every.length >= 3 ? median(every) : null;
  };
  const sold = insights(w).by_site;
  const usualDays = (i: Item, l: Listing): number | null => l.market_standing?.outlook?.days_hi
    ?? w.products.find(p => p.id === i.product_id)?.by_site.find(s => s.site === l.site)?.median_days
    ?? sold.find(s => s.site === l.site)?.days_to_sell ?? null;
  const rows = items.map(i => {
    const ls = i.listings.filter(live);
    const metric = (k: Kind): Metric => {
      const seen = ls.filter(l => read(w, l, k) !== undefined);
      if (!seen.length) return { value: null, usual: null };
      const value = seen.reduce((a, l) => a + read(w, l, k)!, 0);
      const rates = seen.map(l => rate(k, l.site));
      return { value, usual: rates.every(r => r !== null) ? Math.round(seen.reduce((a, l, j) => a + rates[j]! * Math.max(1, daysUp(w, l)), 0)) : null };
    };
    const days = Math.max(...ls.map(l => daysUp(w, l)));
    const usuals = ls.map(l => usualDays(i, l)).filter((d): d is number => d !== null);
    const standing = ls.map(l => l.market_standing).find(s => s?.state === 'shown' && s.line);
    const prices = ls.map(l => l.price_cents);
    return {
      id: i.id, title: i.title, key: i.photos[0]?.key ?? null, sites: ls.map(l => l.site), price: { low: Math.min(...prices), high: Math.max(...prices) },
      line: standing?.line ?? null, slow: ls.some(l => l.market_standing?.word === 'slow' || l.market_standing?.word === 'stuck') || i.state === 'stale',
      views: metric('views'), likes: metric('likes'), offers: metric('offers'),
      days: { value: days, usual: usuals.length ? Math.round(median(usuals)) : null },
    };
  });
  // What needs a look first: slow or stale, then the longest up.
  return rows.sort((a, b) => Number(b.slow) - Number(a.slow) || (b.days.value ?? 0) - (a.days.value ?? 0));
}

// A value against its usual, in words for a screen reader and for the cell's mark: more, about the same, or fewer.
export function against(m: Metric): 'more' | 'usual' | 'less' | null {
  if (m.value === null || m.usual === null || m.usual < 1) return null;
  const r = m.value / m.usual;
  return r >= 1.5 ? 'more' : r <= 0.67 ? 'less' : 'usual';
}

// The four counts of one live thing as the row draws them: the number in words, its noun, how far along its track (the value
// over twice the usual, so the usual sits in the middle), and the sentence a screen reader says. Days up that run past the
// usual are longer than usual; a site that shows no views says Not shown, never a zero.
const NOUNS = { views: ['view', 'views'], likes: ['like', 'likes'], offers: ['offer', 'offers'], days: ['day up', 'days up'] } as const;
const SAY = { more: 'more than usual', usual: 'about usual', less: 'less than usual' } as const;
const DAYS_SAY = { more: 'longer than usual', usual: 'about usual', less: 'shorter than usual' } as const;
const fmt = new Intl.NumberFormat('en-US');
export function cells(p: Pulse): { value: string; word: string; share: number | null; said: string; muted: boolean }[] {
  return (['views', 'likes', 'offers', 'days'] as const).map(k => {
    const m = p[k], [one, many] = NOUNS[k], a = against(m), word = m.value === 1 ? one : many;
    if (m.value === null) return { value: 'Not shown', word: many, share: null, said: `No ${many} shown on this site`, muted: true };
    const how = a ? `, ${(k === 'days' ? DAYS_SAY : SAY)[a]} (usual ${fmt.format(m.usual!)})` : '';
    return { value: fmt.format(m.value), word, share: m.usual ? Math.min(1, m.value / (2 * m.usual)) : null, said: `${fmt.format(m.value)} ${word}${how}`, muted: false };
  });
}
