// A room the camera swept, and the agent's plan to have it empty by the day the person named. The brief it answers:
// "I'm moving out Friday. Get everything in this room sold or given away by then."
// The plan is spec/features/price.md "Gone fast": `plan_choice` fast with `gone_by`, a path that reaches each thing's
// lowest price before the date, and the ending (`fallback`) chosen now so nothing lingers (user-wants P1). Pages read
// `room(w, at)`; every number and time here is computed from the world's rows or is relative to NOW, never typed in a page.
import { valuation, youKeep } from './build.ts';
import { NOW, inHours, ms } from './format.ts';
import type { Cents, Iso, Item, Site, StandingWord } from './types.ts';
import type { World } from './world.ts';

// What happens to a thing by moving day. sell: listed, or listed now. give: free for pickup. sold: already sold, it only
// has to leave before the move. keep: the person said they keep it (item.kept_reason), so it is packed, not cleared.
export type Fate = 'sell' | 'give' | 'sold' | 'keep';
// Where a thing stands at a moment of the plan, for its tag on the page.
export type Now = 'found' | 'draft' | 'live' | 'hot' | 'offer' | 'free' | 'ship' | 'pickup' | 'gone' | 'given' | 'packed' | 'kept';

export type Thing = {
  item: Item; fate: Fate; now: Now;
  // The price it is listed at (or goes up at) under the plan, and the price live before the plan changed it.
  ask: Cents | null; was: Cents | null;
  // The lowest it may drop to before the drop day: the person's own lowest (limits.floor_cents), never below it.
  lowest: Cents | null;
  site: Site | null;
  // What the person keeps after the site's fee at `ask`, or at the price it sold for.
  keep: Cents | null;
  // A clock the thing already carries: when a sold thing must ship or be picked up.
  due: Iso | null;
  offer: Cents | null; standing: StandingWord | null;
  // One line, in plain words: why the agent guessed this fate.
  why: string;
};

export type Moment = 'sweeping' | 'plan' | 'started' | 'wednesday' | 'done';
export const MOMENTS: Moment[] = ['sweeping', 'plan', 'started', 'wednesday', 'done'];

export type Room = {
  label: string; moment: Moment; now: Iso;
  // What the agent understood from the sentence. Each is a guess the page underlines until the person touches it.
  moving: Iso; last_handover: Iso; drop_at: Iso; ship_stops: Iso; free_at: Iso;
  things: Thing[];
  // While the sweep runs: how many it has found so far.
  found: number;
  // What one tap on the plan does now, counted: new posts (including free ones) and prices lowered.
  posts: number; lowers: number;
  // If every thing up for sale sells at its ask: what the person keeps.
  could_keep: Cents;
  // Kept so far, after fees, from things sold under the plan or before it.
  kept: Cents;
  gone: number; to_clear: number;
  // The one thing the plan expects to miss the date, at the Wednesday check (the only alarm worth a push, price.md "Gone fast").
  miss: { item_id: string; at: Cents; free_keep: Cents; } | null;
};

// The times, from Sunday noon in Chicago (NOW). Moving day is Friday at 9 am; the last handover is Thursday at 8 pm, so
// the morning of the move is for the truck. Prices reach the lowest Wednesday at 9 am. Shipping stops Wednesday at 8 pm,
// so a shipped sale goes out Thursday, before the move. What is left goes up free Thursday at 9 am, a day of pickups.
const H = { moving: 117, last_handover: 104, drop_at: 69, ship_stops: 80, free_at: 93, wednesday: 69, done: 116 } as const;

// Below this, after fees at the low end of what similar ones sold for, a thing is given away rather than sold: a trip to
// a buyer costs more than it keeps. Agent proposal: no source gives a threshold (user-wants, Choices for Ben and Nate).
export const GIVE_UNDER: Cents = 1500;

// What the camera saw in the room, by the items it matched (ways-out §6.5 "I scanned that one already").
// The clearing world's spare room: everything not already gone, and not the chair in the garage.
const SEEN: Record<string, string[]> = {
  clearing: ['it_switch', 'it_jacket', 'it_fleece', 'it_pants', 'it_lamp', 'it_hoodie', 'it_kindle', 'it_tee', 'it_dunks'],
};
// Any other world: its spare room and bins, or else the one place that holds the most things (a world of one item is
// a room of one thing, not an empty room: break-ui found the "one" state drawn as empty).
function seen(w: World) {
  if (SEEN[w.name]) return SEEN[w.name];
  const room = w.items.filter(i => i.location.label === 'Spare room' || /^Bin [1-4]$/.test(i.location.label));
  if (room.length) return room.map(i => i.id);
  const count = new Map<string, number>();
  for (const i of w.items) count.set(i.location.label, (count.get(i.location.label) ?? 0) + 1);
  const most = [...count].sort((a, b) => b[1] - a[1])[0]?.[0];
  return w.items.filter(i => i.location.label === most).map(i => i.id);
}

// The sweep valued the one thing that was still being researched (it_hoodie): similar ones sold for $14 to $22.
const SWEPT: Record<string, Item['valuation']> = { it_hoodie: valuation(1400, 2200, 11, ['depop', 'ebay'], 'ci_hood') };

const liveListings = (it: Item) => it.listings.filter(l => l.state === 'live');
const lowestLive = (it: Item) => liveListings(it).sort((a, b) => a.price_cents - b.price_cents)[0];

function fateOf(w: World, it: Item): Thing {
  const base = { item: it, ask: null, was: null, lowest: it.limits?.floor_cents ?? null, site: null, keep: null, due: null, offer: null, standing: null } as const;
  const order = w.orders.find(o => o.kind === 'sale' && o.item_id === it.id && ['paid', 'to_ship', 'pickup_booked'].includes(o.state));
  if (order) return { ...base, fate: 'sold', now: 'ship', site: order.site, keep: order.price_cents - order.fees_cents - order.shipping_cents, due: order.clocks.ship_by ?? null, why: 'Already sold. It ships before you move.' };
  if (it.state === 'kept') return { ...base, fate: 'keep', now: 'kept', why: it.kept_reason ? `You said: ${it.kept_reason.toLowerCase()}.` : 'You kept it.' };
  const value = it.valuation ?? SWEPT[it.id];
  const live = lowestLive(it);
  const offer = w.offers.filter(o => o.state === 'open' && it.listings.some(l => l.id === o.listing_id)).sort((a, b) => b.amount_cents - a.amount_cents)[0];
  if (!live && value) {
    const lowKeep = youKeep(value.per_site[0]?.site ?? 'ebay', value.range.low);
    if (lowKeep < GIVE_UNDER) return { ...base, fate: 'give', now: 'draft', ask: 0, site: 'facebook', keep: 0, why: `Similar ones sold for ${dollars(value.range.low)} to ${dollars(value.range.high)}. After fees and a trip to the buyer, it keeps less than it costs.` };
  }
  if (live) {
    // A slow listing takes the markdown its card already offers; the rest keep their price and reach their lowest by Wednesday.
    const markdown = w.decisions.find(d => d.kind === 'markdown' && d.item_id === it.id && d.state === 'open')?.money?.price_cents;
    const ask = markdown ?? live.price_cents;
    const standing = live.market_standing?.word ?? null;
    const site = live.site;
    return { ...base, fate: 'sell', now: offer ? 'offer' : standing === 'hot' ? 'hot' : 'live', ask, was: markdown ? live.price_cents : null, site, keep: youKeep(site, ask, site === 'facebook'), offer: offer?.amount_cents ?? null, standing,
      why: markdown ? 'No messages in 9 days. A lower price gives it a chance by Thursday.' : offer ? `An offer of ${dollars(offer.amount_cents)} is waiting.` : 'Already up. It drops to your lowest Wednesday if it hasn’t sold.' };
  }
  // Not posted yet: it goes up now, on the site that sells it fastest by pickup, at the lower of its planned prices.
  const planned = it.listings.filter(l => l.state === 'none').sort((a, b) => a.price_cents - b.price_cents)[0];
  if (planned) return { ...base, fate: 'sell', now: 'draft', ask: planned.price_cents, site: planned.site, keep: youKeep(planned.site, planned.price_cents, planned.site === 'facebook'), why: 'Goes up now, for pickup, at the lower of its two prices.' };
  return { ...base, fate: 'sell', now: 'found', why: 'Still working out what it is.' };
}

const dollars = (c: Cents) => `$${Math.round(c / 100)}`;


// How the plan has gone by a moment. `started` is a minute after the tap; `wednesday` is the 9 am check; `done` is
// moving morning. Sales after the tap are demo rows: what a believable week does to these things.
const LATER: Record<string, Partial<Record<Moment, Partial<Thing>>>> = {
  it_switch: { started: { now: 'live' }, wednesday: { now: 'pickup', due: inHours(78) }, done: { now: 'gone' } },
  it_hoodie: { started: { now: 'free' }, wednesday: { now: 'given' }, done: { now: 'given' } },
  it_lamp: { started: { now: 'live' }, wednesday: { now: 'live' }, done: { now: 'given' } },
  it_fleece: { wednesday: { now: 'ship', due: inHours(96) }, done: { now: 'gone' } },
  it_pants: { wednesday: { now: 'gone' }, done: { now: 'gone' } },
  it_jacket: { wednesday: { now: 'live', offer: null }, done: { now: 'packed' } },
  it_kindle: { wednesday: { now: 'gone' }, done: { now: 'gone' } },
  it_tee: { wednesday: { now: 'gone' }, done: { now: 'gone' } },
};
const GONE: Now[] = ['gone', 'given'];
// Once the week moves a thing, its reason is where it is now: what the plan said on Sunday is history.
const NOW_WHY: Partial<Record<Now, string>> = {
  free: 'Up free for pickup.',
  pickup: 'Sold. The buyer picks it up before you move.',
  ship: 'Sold. It ships before you move.',
  gone: 'Sold and gone.',
  given: 'Given away and picked up.',
  packed: 'It didn’t sell in time, so it comes with you and stays for sale.',
};

// The moving days the person can name instead (Wednesday to Sunday): `shift` moves every date of the plan by whole days.
export const SHIFTS = [-2, -1, 0, 1, 2] as const;

export function room(w: World, moment: Moment = 'plan', shift = 0): Room {
  const at = (h: number) => inHours(h + shift * 24);
  const now = moment === 'wednesday' ? inHours(H.wednesday) : moment === 'done' ? inHours(H.done) : NOW;
  const ids = seen(w);
  let things = ids.map(id => w.items.find(i => i.id === id)).filter((i): i is Item => !!i).map(i => fateOf(w, i));
  // From Wednesday, what is still for sale is at its lowest; what sold kept the price it sold at.
  things = things.map(t => {
    const later = LATER[t.item.id]?.[moment];
    const next = { ...t, ...(later ?? {}), ...(later?.now && NOW_WHY[later.now] ? { why: NOW_WHY[later.now]! } : {}) };
    const stillUp = next.now === 'live' || next.now === 'hot' || next.now === 'offer';
    const atLowest = (moment === 'wednesday' || moment === 'done') && next.fate === 'sell' && stillUp && next.lowest != null
      // Its reason is the one for this moment: what was true on Sunday (an offer, nine quiet days) is not true now.
      ? { ask: next.lowest, keep: youKeep(next.site ?? 'ebay', next.lowest, next.site === 'facebook'), offer: null, why: 'At your lowest since this morning, and no buyer yet.' } : {};
    return { ...next, ...atLowest };
  });
  if (moment === 'sweeping') things = things.map((t, n) => (n >= 6 ? { ...t, now: 'found' as const } : t));
  const toClear = things.filter(t => t.fate !== 'keep');
  const forSale = things.filter(t => t.fate === 'sell');
  // Sold under the plan (later moments) or before it (an order already paid), after fees.
  const keptNow = things.filter(t => t.now !== 'given' && (t.fate === 'sold' || (t.fate === 'sell' && (GONE.includes(t.now) || t.now === 'ship' || t.now === 'pickup')))).reduce((a, t) => a + (t.keep ?? 0), 0);
  const jacket = things.find(t => t.item.id === 'it_jacket');
  return {
    label: 'Spare room', moment, now,
    moving: at(H.moving), last_handover: at(H.last_handover), drop_at: at(H.drop_at), ship_stops: at(H.ship_stops), free_at: at(H.free_at),
    things,
    found: moment === 'sweeping' ? 6 : things.length,
    posts: things.filter(t => t.now === 'draft' || (t.fate === 'give' && moment === 'plan')).length,
    lowers: things.filter(t => t.was != null && t.ask != null && t.ask < t.was).length,
    could_keep: forSale.reduce((a, t) => a + (t.keep ?? 0), 0),
    kept: keptNow,
    gone: things.filter(t => GONE.includes(t.now)).length,
    to_clear: toClear.length,
    miss: moment === 'wednesday' && jacket?.lowest != null ? { item_id: jacket.item.id, at: jacket.lowest, free_keep: 0 } : null,
  };
}
