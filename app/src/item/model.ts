// What the item page, its Plan sheet and its Post preview show, worked out from the demo world (spec/pages.md §6.6 to
// §6.8). No rendering here, so every number on those pages is computed in one place and tested in node (model.test.ts).
// A page never types a number, a date or a name of its own (app/src/demo/README.md).
import {
  WORLDS, day, inDays, ms, usd, when, youKeep,
  type AnyWorld, type Attribute, type Cents, type Decision, type Item, type Listing, type Offer, type Order, type Site, type World,
} from '../demo/index.ts';
import { MORE_SHOTS } from '../demo/item-shots.ts';
import { LISTING_FORMS, RETURNS, VERDICT_RANK, fitOf, listingTitle, titleOn, type Verdict } from '../demo/listing-forms.ts';

// The five moments of one item (pages.md §6.6), with drafting split in two because its top differs: Researching fills in,
// Review asks for the four facts. Offer is Live with an offer waiting. Done is shipped and paid; Kept and Unsold end it.
export type Moment = 'researching' | 'review' | 'live' | 'offer' | 'sold' | 'done' | 'kept' | 'unsold';

// The item and the world it lives in. A named world wins; otherwise the first world that holds the id, the person we
// build for first, so /item/it_f003 opens the flipper's item without a ?world.
const ORDER: AnyWorld[] = ['clearing', 'flipper', 'buyer', 'new', 'edge', 'one', 'stage'];
export function find(id: string, world?: string): { w: World; item: Item } | null {
  const names = world && world in WORLDS ? [world as AnyWorld, ...ORDER] : ORDER;
  for (const n of names) { const w = WORLDS[n]; const item = w.items.find(i => i.id === id); if (item) return { w, item }; }
  return null;
}

const openOn = (w: World, it: Item) => w.decisions.filter(d => d.item_id === it.id && (d.state === 'open' || d.state === 'acting' || d.state === 'failed'));
export const saleOf = (w: World, it: Item): Order | null =>
  w.orders.find(o => o.item_id === it.id && o.kind === 'sale' && o.state !== 'cancelled' && o.state !== 'refunded') ?? null;

export function momentOf(w: World, it: Item): Moment {
  if (it.state === 'researching' || it.state === 'capturing') return 'researching';
  if (it.state === 'review' || it.state === 'failed' && !it.listings.some(l => l.posted_at)) return 'review';
  if (it.state === 'kept' || it.state === 'owned') return 'kept';
  if (it.state === 'unsold') return 'unsold';
  const sale = saleOf(w, it);
  if (sale && (sale.state === 'released' || it.state === 'done')) return 'done';
  if (sale || ['sold', 'handed_over', 'done'].includes(it.state)) return 'sold';
  if (openOn(w, it).some(d => d.kind === 'accept_offer' || d.kind === 'price_below_floor')) return 'offer';
  return 'live';
}

// The offer card the Offer moment leads with, and its offers, best first.
export function offerOf(w: World, it: Item): { decision: Decision; offers: Offer[] } | null {
  const d = openOn(w, it).find(x => x.kind === 'accept_offer' || x.kind === 'price_below_floor');
  if (!d) return null;
  const offers = w.offers.filter(o => d.offer_ids?.includes(o.id)).sort((a, b) => b.amount_cents - a.amount_cents);
  return { decision: d, offers };
}

// Three counter amounts between the best offer and the asking price, in whole dollars and never under the lowest the
// person takes; the middle one is the agent's pick (assist.md, a picker of a few named amounts ending in Something else).
export function counters(offer: Cents, ask: Cents, floor: Cents): Cents[] {
  const dollars = (c: number) => Math.round(c / 100) * 100;
  const gap = Math.max(ask - offer, 300);
  const top = Math.max(ask, offer + gap);
  const xs = [offer + gap / 3, offer + (gap * 2) / 3, top].map(dollars).map(c => Math.max(c, floor));
  return [...new Set(xs)].sort((a, b) => a - b);
}

// Listings that count: posted, posting or failed. A draft's listings are the plan (state none).
const shown = (l: Listing) => l.state !== 'none';
export const liveListings = (it: Item) => it.listings.filter(l => l.state === 'live' || l.state === 'postFailed' || l.state === 'posting');

// How the listing is doing, in the words a person reads on the row: views, watchers, likes.
export function interest(l: Listing): string | null {
  const { views, watchers, likes } = l.interest;
  const parts = [views ? `${views} views` : null, watchers ? `${watchers} watching` : null, likes ? `${likes} likes` : null].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export type SiteRow = {
  site: Site; listing: Listing;
  // The title as this site's buyers will read it (spec/edge-cases.md §5).
  title: string;
  // The row's tag: what this listing is doing.
  tag: 'live' | 'hot' | 'stuck' | 'failed' | 'ended' | 'sold' | 'draft' | 'working';
  word?: string;
  price: Cents; keep: Cents; interest: string | null;
  // The standing line, when the site has one ("Third cheapest of 14 like it").
  line: string | null;
  // Where this site's listing is not the same as the others: its price, its title, its photos (Ben, round 11).
  differs: string[];
};

// One row per site the item is on or will be on, with where each differs from the others.
export function siteRows(w: World, it: Item, title = it.title): SiteRow[] {
  const sale = saleOf(w, it);
  const rows = it.listings.filter(l => shown(l) || it.state === 'review');
  const prices = rows.map(l => l.price_cents);
  const common = mode(prices);
  const photos = photoCount(it);
  return rows.map(l => {
    const differs: string[] = [];
    if (rows.length > 1 && l.price_cents !== common) differs.push(`${usd(Math.abs(l.price_cents - common))} ${l.price_cents > common ? 'more' : 'less'} here`);
    const form = LISTING_FORMS[l.site];
    const own = listingTitle(l.site, title, it.attributes);
    if (form.title === 'description_line_1') differs.push('No title here: the name opens the description');
    else if (titleOn(l.site, title) !== title) differs.push(`Title cut to ${form.title_max} characters`);
    if (/size \S+/.test(own) && !/size \S+/.test(title)) differs.push(`Says “${own.match(/size \S+/)![0]}”`);
    if (own.length > title.length && own.startsWith(title) && !/size \S+$/.test(own)) differs.push('Model and specs in the title');
    if (photos > form.photos_max) differs.push(`First ${form.photos_max} of ${photos} photos`);
    if (form.cover !== '1:1' && photos > 0) differs.push('Photos cropped taller');
    const st = l.market_standing?.state === 'shown' ? l.market_standing : null;
    const tag: SiteRow['tag'] = l.state === 'postFailed' || l.state === 'delistFailed' ? 'failed'
      : sale?.listing_id === l.id ? 'sold'
      : l.state === 'delisted' ? 'ended'
      : l.state === 'posting' || l.state === 'delisting' ? 'working'
      : l.state === 'none' ? 'draft'
      : st?.word === 'hot' ? 'hot' : st?.word === 'stuck' ? 'stuck' : 'live';
    const word = tag === 'ended' && sale ? 'Taken down' : tag === 'working' ? (l.state === 'posting' ? 'Posting' : 'Taking down') : undefined;
    return { site: l.site, listing: l, title: own, tag, word, price: l.price_cents, keep: youKeep(l.site, l.price_cents), interest: interest(l), line: st ? st.line : null, differs };
  });
}

function mode(xs: number[]): number {
  const n = new Map<number, number>(); for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}

// How many photos the item has: its own, plus the shots after the cover that Ben's real items carry.
export const photoCount = (it: Item) => it.photos.length + (it.photos[0] ? MORE_SHOTS[it.photos[0].key]?.length ?? 0 : 0);

// One number first (brand Art. 7.10): the amount, what it is, and the sum behind it, closed until asked for.
export type Headline = { amount: Cents; what: string; sum: { label: string; amount: Cents }[]; site?: Site };
export function headline(w: World, it: Item, m: Moment): Headline | null {
  const sale = saleOf(w, it);
  if ((m === 'sold' || m === 'done') && sale) {
    const kept = sale.price_cents - sale.fees_cents - sale.shipping_cents;
    const sum = [{ label: 'Sold for', amount: sale.price_cents }, { label: 'Site fee', amount: -sale.fees_cents }];
    if (sale.shipping_cents) sum.push({ label: 'Label', amount: -sale.shipping_cents });
    return { amount: kept, what: m === 'done' ? 'Kept, after fees' : 'You keep, after fees', sum: [...sum, { label: 'You keep', amount: kept }], site: sale.site };
  }
  if (m === 'live' || m === 'offer') {
    const ls = liveListings(it).filter(l => l.state === 'live');
    if (!ls.length) return null;
    // The site that keeps the most leads; the sum shows each site's price and keep.
    const best = [...ls].sort((a, b) => youKeep(b.site, b.price_cents) - youKeep(a.site, a.price_cents))[0];
    return {
      amount: youKeep(best.site, best.price_cents), what: `You keep at ${usd(best.price_cents)}, after fees`, site: best.site,
      sum: ls.flatMap(l => [{ label: `Price`, amount: l.price_cents }, { label: 'Site fee', amount: youKeep(l.site, l.price_cents) - l.price_cents }]),
    };
  }
  return null;
}

// What happened on the way to the sale and after it, for the Sold and Done moments: listed, sold, shipped, paid.
export function clocks(w: World, it: Item): { id: string; label: string; at: string; done: boolean }[] {
  const sale = saleOf(w, it);
  if (!sale) return [];
  const posted = it.listings.map(l => l.posted_at).filter((t): t is string => !!t).sort()[0];
  const out = [] as { id: string; label: string; at: string; done: boolean }[];
  if (posted) out.push({ id: 'listed', label: 'Listed', at: day(posted, w.now), done: true });
  out.push({ id: 'sold', label: 'Sold', at: day(sale.created_at, w.now), done: true });
  const pickup = w.appointments.find(a => a.order_id === sale.id && a.kind === 'pickup');
  if (pickup) out.push({ id: 'pickup', label: `Pickup, ${pickup.place?.label ?? 'your spot'}`, at: when(pickup.window.start, w.now), done: pickup.state === 'done' });
  else if (sale.clocks.ship_by) out.push({ id: 'ship', label: 'Ship by', at: when(sale.clocks.ship_by, w.now), done: ['shipped', 'delivered', 'released'].includes(sale.state) });
  else if (sale.label?.tracking_ref) out.push({ id: 'ship', label: 'Shipped', at: day(sale.created_at, w.now), done: true });
  if (sale.clocks.release_at) out.push({ id: 'paid', label: sale.state === 'released' ? 'Paid' : 'Money arrives', at: day(sale.clocks.release_at, w.now), done: sale.state === 'released' });
  return out;
}

// Days from the first post to the sale, for "Sold in 9 days".
export function daysToSell(w: World, it: Item): number | null {
  const sale = saleOf(w, it); const posted = it.listings.map(l => l.posted_at).filter((t): t is string => !!t).sort()[0];
  return sale && posted ? Math.max(1, Math.round((ms(sale.created_at) - ms(posted)) / 864e5)) : null;
}

// A field of the item, as the page shows it: what it is, its value in the person's units, and where it came from.
export type Field = { id: string; name: string; value: string | null; from: string; guessed: boolean; attr: Attribute };
const NAMES: Record<string, string> = {
  brand: 'Brand', size: 'Size', color: 'Color', chest_width: 'Chest', 'flaw.1': 'Flaw', material: 'Material', height: 'Height', works: 'Works',
  storage: 'Storage', battery: 'Battery', pit_to_pit: 'Pit to pit', waist: 'Waist', inseam: 'Inseam', inseam_measured: 'Inseam, measured',
  model: 'Model', joy_con_drift: 'Joy-Con drift', box: 'Box',
};
// Where a value came from, in the words pages.md §6.6 gives for each source.
const FROM: Record<Attribute['source'], string> = {
  measured: 'Measured', label: 'From the tag', inferred: 'From the photos', spec: 'Looked up', marketplace: 'From the site', you_said: 'You said',
};
const WHY_BLANK: Record<NonNullable<Attribute['unknown_reason']>, string> = {
  not_visible: 'Not in the photos', not_read: 'Couldn’t read it', conflict: 'Two sources disagree', not_asked: 'Only you know this',
};
// Lengths are kept in millimetres and shown in the person's unit: inches for en-US.
const MEASURES = new Set(['chest_width', 'height', 'pit_to_pit', 'inseam_measured']);
const inches = (mm: number) => `${Math.round(mm / 25.4)} in`;
export function fields(it: Item): Field[] {
  return it.attributes.map(a => ({
    id: a.id, attr: a,
    name: NAMES[a.name] ?? a.name.replace(/[._]/g, ' ').replace(/^\w/, c => c.toUpperCase()),
    value: a.value === null ? null : MEASURES.has(a.name) && typeof a.value === 'number' ? inches(a.value) : String(a.value),
    from: a.value === null ? WHY_BLANK[a.unknown_reason ?? 'not_visible'] : FROM[a.source],
    guessed: a.source !== 'you_said',
  }));
}

// The research a new item goes through, each with its real count once it has one (pages.md §6.6, Researching).
export function stages(it: Item): { id: string; label: string; state: 'done' | 'working' | 'waiting'; count?: string }[] {
  const n = photoCount(it), v = it.valuation;
  return [
    { id: 'photos', label: 'Photos', state: n ? 'done' : 'working', count: n ? `${n}` : undefined },
    { id: 'identified', label: 'What it is', state: it.attributes.length ? 'done' : 'working' },
    { id: 'sales', label: 'Sales like it', state: v ? 'done' : it.attributes.length ? 'working' : 'waiting', count: v ? `${v.basis_count}` : undefined },
    { id: 'range', label: 'Price', state: v ? 'done' : 'waiting' },
  ];
}

// The auto-list tree (spec/edge-cases.md §7, agent proposal): nine steps from the shots to the read-back. Each moves on by
// itself when it is sure and stops at the first thing it cannot settle. Every stop is one question on one card, so a
// stopped tree costs a tap, not a restart; the answers fill the item and the tree goes on from where it stopped.
export const TREE = ['Shots', 'What it is', 'Is it allowed', 'Facts a camera can’t see', 'Price', 'Sites', 'Drafts', 'Post', 'Check'] as const;
export type Stop = {
  id: string; step: number; question: string; options: { id: string; label: string }[];
  // The answer picked for the person where one can be; null when only they know.
  pick: string | null;
  // Something else: the person can type their own answer.
  typed: boolean;
  // The field the answer fills.
  field?: string;
};
// Facts a camera can't see, asked as a question with its answers (§7 step 4: "it works, size where unmeasured, smoke or pets").
const ASK: Record<string, { q: string; options: string[] }> = {
  joy_con_drift: { q: 'Do the Joy-Cons drift?', options: ['No', 'Yes', 'I don’t know'] },
  works: { q: 'Does it work?', options: ['Yes', 'No', 'Not tested'] },
  smoke: { q: 'From a smoke-free home?', options: ['Yes', 'No'] },
  pets: { q: 'From a home with pets?', options: ['No', 'Yes'] },
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function autoList(w: World, it: Item): { steps: { n: number; label: string; state: 'done' | 'stopped' | 'waiting' }[]; stops: Stop[] } {
  const stops: Stop[] = [];
  for (const f of fields(it).filter(x => x.value === null).slice(0, 3)) {
    const a = ASK[f.attr.name];
    stops.push({
      id: `fact-${f.attr.name}`, step: 4, question: a?.q ?? `What’s the ${f.name.toLowerCase()}?`,
      options: (a?.options ?? ['I don’t know']).map(label => ({ id: slug(label), label })), pick: null, typed: !a, field: f.id,
    });
  }
  const v = it.valuation;
  if (!v || v.state !== 'shown' || v.basis_count < 5) {
    stops.push({ id: 'price', step: 5, question: 'Few sales like it. How should it be priced?', options: [{ id: 'best', label: 'Best price' }], pick: 'best', typed: true });
  }
  if (!w.connections.some(c => c.account && c.account.health !== 'broken' && !c.error)) {
    stops.push({ id: 'sites', step: 6, question: 'No site is linked. Copy the listing instead?', options: [{ id: 'copy', label: 'Copy listing' }, { id: 'link', label: 'Link a site' }], pick: 'copy', typed: false });
  }
  const first = stops.length ? stops[0].step : 8;
  const at = new Set(stops.map(s => s.step));
  const steps = TREE.map((label, i) => {
    const n = i + 1;
    return { n, label, state: at.has(n) ? 'stopped' as const : n < first ? 'done' as const : 'waiting' as const };
  });
  return { steps, stops };
}

// The plan (pages.md §6.7, price.md Selling intents). Each choice, what it sets, and what it says it will do.
export type Choice = 'sell' | 'fast' | 'best' | 'reserve' | 'check';
export const CHOICES: { id: Choice; label: string }[] = [
  { id: 'sell', label: 'Sell it' }, { id: 'fast', label: 'Gone fast' }, { id: 'best', label: 'Best price' },
  { id: 'reserve', label: 'Only at my price' }, { id: 'check', label: 'Just checking' },
];
const whole = (c: number) => Math.round(c / 100) * 100;
// The price a choice starts at, from what similar ones sold for, never under the lowest the person takes.
export function priceFor(it: Item, c: Choice): Cents | null {
  const v = it.valuation?.state === 'shown' ? it.valuation.range : null;
  const floor = it.limits?.floor_cents ?? 0;
  if (!v) return null;
  const at = { sell: (v.low + v.high) / 2, fast: v.low, best: v.high, reserve: Math.max(v.high, floor), check: v.high }[c];
  return Math.max(whole(at), floor);
}

// What a listing at this price would keep on each site the plan uses, and what a site that is left out says. `flipped`
// holds the sites the person switched from the agent's pick: a site it picked, skipped; a linked one it left out, added.
// Which sites this kind of thing fits (edge-cases §11): a blocked site can't be added and says why; an avoided one is
// greyed with its reason and a tap still adds it. Each site also carries its returns rule in one line (edge-cases §10).
export type PlanSite = { site: Site; on: boolean; can: boolean; why: string; keep: Cents | null; avoid: boolean; returns: string };
export function planSites(w: World, it: Item, price: Cents, flipped: Site[] = []): PlanSite[] {
  const listed = new Set(it.listings.map(l => l.site));
  const rows = w.connections.map(c => {
    const linked = !!c.account && c.account.health !== 'broken' && !c.error;
    const fit = fitOf(it, c.site);
    const blocked = fit?.verdict === 'blocked', avoid = fit?.verdict === 'avoid';
    const can = linked && !blocked;
    const on = can && listed.has(c.site) !== flipped.includes(c.site);
    const keep = `You get ${usd(youKeep(c.site, price))}`;
    // A site that posts says why it was picked for this kind of thing, then what lands in the account there.
    const why = blocked ? `Not allowed here. ${fit!.why}` : !c.account ? 'Not linked' : !linked ? 'Signed out'
      : on ? (fit ? `${PICKED[fit.verdict]}: ${lower(fit.why)}. ${keep}` : `Posts at ${usd(price)}. ${keep}`)
      : listed.has(c.site) ? 'You skipped it' : avoid ? fit!.why : 'Not posting here';
    return { site: c.site, on, can, why, keep: can ? youKeep(c.site, price) : null, avoid: avoid && !on, returns: RETURNS[c.site], rank: fit ? VERDICT_RANK[fit.verdict] : 2 };
  });
  return rows.sort((a, b) => a.rank - b.rank).map(({ rank: _, ...r }) => r);
}

// The verdict a posting site was picked on, as the plan says it (platform-fit.json, verdicts).
const PICKED: Record<Verdict, string> = { best: 'Best for this', good: 'Sells well', ok: 'Reach', avoid: 'Added by you', blocked: '' };
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// The price drops the plan will make (money.md D15, its age table): the next rung at the plan's median days, the one
// after at twice that, then it asks. Never under the lowest; a step that would cross it asks instead (decision 11-14).
export function drops(it: Item, price: Cents, choice: Choice, from: string): { at: string; label: string }[] {
  const floor = it.limits?.floor_cents ?? 0;
  if (choice === 'reserve' || choice === 'check') return [];
  const outlook = it.listings.map(l => l.market_standing?.outlook?.days_hi).find((d): d is number => d != null);
  const m = outlook ?? { sell: 30, fast: 7, best: 90 }[choice];
  const low = Math.max(floor, it.valuation?.range.low ?? floor);
  const out: { at: string; label: string }[] = [];
  let p = price;
  for (const k of [1, 2]) {
    const next = Math.max(whole(p - (price - low) / 2), floor);
    if (next >= p) break;
    out.push({ at: day(inDays(m * k, from), from), label: `Drops to ${usd(next)}` }); p = next;
  }
  out.push({ at: day(inDays(m * 3, from), from), label: 'Asks you what next' });
  return out;
}

// What Approve on the Post preview says it will do: "Post at $235 on 2 sites".
export function postWords(prices: Cents[]): string {
  if (!prices.length) return 'Pick a site';
  const lo = Math.min(...prices), same = prices.every(p => p === lo);
  return `Post ${same ? `at ${usd(lo)}` : `from ${usd(lo)}`} on ${prices.length} ${prices.length === 1 ? 'site' : 'sites'}`;
}

// Delete is refused while an order is open (ways-out §6.6): a claim window, a return or a dispute.
export function deleteBlocked(w: World, it: Item): string | null {
  const sale = saleOf(w, it);
  if (sale && sale.state !== 'released') return 'Can’t delete while the sale is open';
  return null;
}
