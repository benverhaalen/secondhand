// Executable spec of an item's life across sites (product/functions.md §1, decisions: tiers, paid beats dibs).
// The model is small on purpose; the checker walks every interleaving, like a TLA+ model check.
// The app's real state machine must keep these invariants; port the tests when it exists.

export const NEVER_ALONE = new Set(['address', 'pickupTime', 'payment']); // decisions.md: "Never alone"
const STEP = 20, START = 100, FLOOR = 60;

export const initial = n => ({
  listings: Array.from({ length: n }, () => ({ st: 'none', paid: false })),
  sale: null, dibs: null, price: START, floor: FLOOR, belowFloorOk: false, pickup: null, decisions: [],
});
const copy = s => structuredClone(s);
const open = (s, d) => { if (!s.decisions.includes(d)) s.decisions.push(d); };
const close = (s, d) => { s.decisions = s.decisions.filter(x => x !== d); };
const perSite = (name, actor, kind, when, run) => ({ name, actor, kind, perSite: true, when, run });
const once = (name, actor, kind, when, run) => ({ name, actor, kind, when, run });

export const actions = [
  perSite('post', 'user', 'firstPost', (s, i) => s.sale === null && s.listings[i].st === 'none', (s, i) => { s.listings[i].st = 'posting'; }),
  perSite('postOk', 'site', null, (s, i) => s.listings[i].st === 'posting', (s, i) => { s.listings[i].st = 'live'; }),
  perSite('postFail', 'site', null, (s, i) => s.listings[i].st === 'posting', (s, i) => { s.listings[i].st = 'failed'; open(s, `failed:${i}`); }),
  perSite('retry', 'user', null, (s, i) => s.listings[i].st === 'failed' && s.sale === null, (s, i) => { s.listings[i].st = 'posting'; close(s, `failed:${i}`); }),
  perSite('buyerPays', 'site', null, (s, i) => s.listings[i].st === 'live' && !s.listings[i].paid, (s, i) => {
    s.listings[i].paid = true;
    if (s.sale === null) { s.sale = i; if (s.dibs !== null && s.dibs !== i) open(s, `dibsLost:${s.dibs}`); } // paid beats dibs
    else open(s, `refund:${i}`); // a second sale before the delist landed
  }),
  perSite('refund', 'user', 'payment', (s, i) => s.decisions.includes(`refund:${i}`), (s, i) => { s.listings[i].paid = false; s.listings[i].st = 'delisting'; close(s, `refund:${i}`); }),
  perSite('dibs', 'site', null, (s, i) => s.sale === null && s.dibs === null && s.listings[i].st === 'live', (s, i) => { s.dibs = i; open(s, `dibs:${i}`); }),
  perSite('delist', 'auto', 'delistAfterSale', (s, i) => s.sale !== null && i !== s.sale && s.listings[i].st === 'live' && !s.listings[i].paid, (s, i) => { s.listings[i].st = 'delisting'; }),
  perSite('delistOk', 'site', null, (s, i) => s.listings[i].st === 'delisting', (s, i) => { s.listings[i].st = 'delisted'; }),
  perSite('delistFail', 'site', null, (s, i) => s.listings[i].st === 'delisting', (s, i) => { s.listings[i].st = 'failed'; open(s, `failed:${i}`); }),
  once('markdown', 'auto', 'markdown', s => s.sale === null && s.price - STEP >= s.floor, s => { s.price -= STEP; }),
  once('belowFloor', 'user', 'priceBelowFloor', s => s.sale === null && s.price - STEP < s.floor && s.price > STEP, s => { s.price -= STEP; s.belowFloorOk = true; }),
  once('offerPickup', 'auto', 'offerWindows', s => s.sale !== null && s.pickup === null, s => { s.pickup = 'offered'; }),
  once('confirmPickup', 'user', 'pickupTime', s => s.pickup === 'offered', s => { s.pickup = 'confirmed'; }),
];

export const invariants = [
  ['one kept sale', s => s.listings.every((l, i) => !l.paid || i === s.sale || s.decisions.includes(`refund:${i}`))],
  ['sale was paid', s => s.sale === null || s.listings[s.sale].paid],
  ['price floor', s => s.price >= s.floor || s.belowFloorOk],
  ['failures are visible', s => s.listings.every((l, i) => l.st !== 'failed' || s.decisions.includes(`failed:${i}`))],
  ['dibs holder told when outbid', s => s.dibs === null || s.sale === null || s.sale === s.dibs || s.decisions.includes(`dibsLost:${s.dibs}`)],
];

function* next(s, acts) {
  for (const a of acts) {
    const sites = a.perSite ? s.listings.map((_, i) => i) : [null];
    for (const i of sites) if (a.when(s, i)) { const t = copy(s); a.run(t, i); t.decisions.sort(); yield [a.perSite ? `${a.name}(${i})` : a.name, t, a]; }
  }
}

export function explore(start, acts, invs) {
  const key = s => JSON.stringify(s), seen = new Map([[key(start), null]]), queue = [start], sold = [];
  const trace = s => { const out = []; for (let k = key(s); seen.get(k); k = seen.get(k)[0]) out.unshift(seen.get(k)[1]); return out; };
  for (let s; (s = queue.shift());) {
    for (const [name, ok] of invs) if (!ok(s)) return { violation: { name, trace: trace(s), state: s }, states: seen.size, sold };
    if (s.sale !== null) sold.push(s);
    for (const [label, t] of next(s, acts)) { const k = key(t); if (!seen.has(k)) { seen.set(k, [key(s), label]); queue.push(t); } }
  }
  return { violation: null, states: seen.size, sold };
}

// From s, can automation and the sites alone (no user taps) bring every other listing down or flag it?
export function settles(s, acts) {
  const auto = acts.filter(a => a.actor !== 'user');
  const done = t => t.listings.every((l, i) => i === t.sale || ['none', 'delisted'].includes(l.st) || t.decisions.includes(`failed:${i}`) || t.decisions.includes(`refund:${i}`));
  const seen = new Set([JSON.stringify(s)]), queue = [s];
  for (let t; (t = queue.shift());) {
    if (done(t)) return true;
    for (const [, u] of next(t, auto)) { const k = JSON.stringify(u); if (!seen.has(k)) { seen.add(k); queue.push(u); } }
  }
  return false;
}
