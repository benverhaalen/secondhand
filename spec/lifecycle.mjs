// Executable spec of an item's life across sites (product/functions.md §1, decisions: tiers, paid beats dibs).
// The model is small on purpose; the checker walks every interleaving, like a TLA+ model check.
// The app's real state machine must keep these invariants; port the tests when it exists.

// decisions.md, "automation runs in tiers that learn": Never alone is address, pickup time, payment.
export const NEVER_ALONE = new Set(['address', 'pickupTime', 'payment']);
// An Ask the user approved PROMOTE_AFTER times can become Auto ("Always do this").
export const PROMOTE_AFTER = 3;
// Kinds that can never be promoted. Never alone is Ben's rule. priceBelowFloor is an *agent proposal*:
// the floor invariant breaks if it is promotable (see lifecycle.test.mjs), so Ben has to choose.
export const NEVER_PROMOTED = new Set([...NEVER_ALONE, 'priceBelowFloor']);

// One listing on one site. delistFailed is still up on the site, so a buyer can still pay for it.
export const LISTING_STATES = ['none', 'posting', 'live', 'postFailed', 'delisting', 'delisted', 'delistFailed'];
const BUYABLE = new Set(['live', 'delistFailed']);
const STEP = 10, START = 60, FLOOR = 50;

export const initial = n => ({
  listings: Array.from({ length: n }, () => ({ st: 'none', paid: false })),
  sale: null, dibs: null, price: START, floor: FLOOR, approvedPrice: null, pickup: null, addressShared: false,
  approvals: {}, auto: [], decisions: [],
});
const copy = s => structuredClone(s);
const open = (s, d) => { if (!s.decisions.includes(d)) s.decisions.push(d); };
const close = (s, d) => { s.decisions = s.decisions.filter(x => x !== d); };
const perSite = (name, actor, kind, when, run) => ({ name, actor, kind, perSite: true, when, run });
const once = (name, actor, kind, when, run) => ({ name, actor, kind, when, run });

export const actions = [
  perSite('post', 'user', 'firstPost', (s, i) => s.sale === null && s.listings[i].st === 'none', (s, i) => { s.listings[i].st = 'posting'; }),
  perSite('postOk', 'site', null, (s, i) => s.listings[i].st === 'posting', (s, i) => { s.listings[i].st = 'live'; }),
  perSite('postFail', 'site', null, (s, i) => s.listings[i].st === 'posting', (s, i) => { s.listings[i].st = 'postFailed'; open(s, `failed:${i}`); }),
  perSite('retry', 'user', null, (s, i) => s.listings[i].st === 'postFailed' && s.sale === null, (s, i) => { s.listings[i].st = 'posting'; close(s, `failed:${i}`); }),
  perSite('buyerPays', 'site', null, (s, i) => BUYABLE.has(s.listings[i].st) && !s.listings[i].paid, (s, i) => {
    s.listings[i].paid = true;
    if (s.sale === null) { s.sale = i; if (s.dibs !== null && s.dibs !== i) open(s, `dibsLost:${s.dibs}`); } // paid beats dibs
    else open(s, `refund:${i}`); // a second sale: the delist had not landed, or it failed and the listing stayed up
  }),
  perSite('refund', 'user', 'payment', (s, i) => s.decisions.includes(`refund:${i}`), (s, i) => { s.listings[i].paid = false; s.listings[i].st = 'delisting'; close(s, `refund:${i}`); close(s, `failed:${i}`); }),
  perSite('dibs', 'site', null, (s, i) => s.sale === null && s.dibs === null && s.listings[i].st === 'live', (s, i) => { s.dibs = i; open(s, `dibs:${i}`); }),
  perSite('delist', 'auto', 'delistAfterSale', (s, i) => s.sale !== null && i !== s.sale && s.listings[i].st === 'live' && !s.listings[i].paid, (s, i) => { s.listings[i].st = 'delisting'; }),
  perSite('delistOk', 'site', null, (s, i) => s.listings[i].st === 'delisting', (s, i) => { s.listings[i].st = 'delisted'; }),
  perSite('delistFail', 'site', null, (s, i) => s.listings[i].st === 'delisting', (s, i) => { s.listings[i].st = 'delistFailed'; open(s, `failed:${i}`); }),
  perSite('retryDelist', 'auto', 'delistAfterSale', (s, i) => s.listings[i].st === 'delistFailed' && !s.listings[i].paid, (s, i) => { s.listings[i].st = 'delisting'; close(s, `failed:${i}`); }),
  once('markdown', 'auto', 'markdown', s => s.sale === null && s.price - STEP >= s.floor, s => { s.price -= STEP; }),
  // Only a user's tap sets approvedPrice, so a below-floor price that automation set breaks "price floor".
  once('belowFloor', 'user', 'priceBelowFloor', s => s.sale === null && s.price - STEP < s.floor && s.price > STEP,
    (s, _i, actor) => { s.price -= STEP; if (actor === 'user') s.approvedPrice = s.price; }),
  once('offerPickup', 'auto', 'offerWindows', s => s.sale !== null && s.pickup === null, s => { s.pickup = 'offered'; }),
  once('confirmPickup', 'user', 'pickupTime', s => s.pickup === 'offered', s => { s.pickup = 'confirmed'; }),
  once('shareAddress', 'user', 'address', s => s.pickup === 'confirmed' && !s.addressShared, s => { s.addressShared = true; }),
];

// "Always do this": the user promotes a kind they approved PROMOTE_AFTER times. Never alone is never offered.
export const promote = (blocked = NEVER_PROMOTED) => ({
  name: 'promote', actor: 'user', kind: null, perKind: true,
  when: (s, k) => (s.approvals[k] ?? 0) >= PROMOTE_AFTER && !s.auto.includes(k) && !blocked.has(k),
  run: (s, k) => { s.auto.push(k); s.auto.sort(); },
});
export const allActions = [...actions, promote()];

export const invariants = [
  ['one kept sale', s => s.listings.every((l, i) => !l.paid || i === s.sale || s.decisions.includes(`refund:${i}`))],
  ['sale was paid', s => s.sale === null || s.listings[s.sale].paid],
  ['price floor', s => s.price >= s.floor || (s.approvedPrice !== null && s.price >= s.approvedPrice)],
  ['failures are visible', s => s.listings.every((l, i) => !['postFailed', 'delistFailed'].includes(l.st) || s.decisions.includes(`failed:${i}`))],
  ['dibs holder told when outbid', s => s.dibs === null || s.sale === null || s.sale === s.dibs || s.decisions.includes(`dibsLost:${s.dibs}`)],
  ['never alone stays with the user', s => !s.auto.some(k => NEVER_ALONE.has(k))],
];

// The pill one item shows across all its listings. *Agent proposal*: what needs you beats what is fine.
// Names are the decided Sell pills (decisions.md, the Sell tab), plus Failed in the brand's failed color.
export function itemPill(s) {
  if (s.listings.some((_, i) => s.decisions.includes(`failed:${i}`))) return 'Failed';
  if (s.decisions.some(d => d.startsWith('refund:'))) return 'Failed';
  if (s.sale !== null) return 'Sold';
  if (s.listings.some(l => BUYABLE.has(l.st))) return 'Live';
  return 'Review';
}

const kinds = acts => [...new Set(acts.map(a => a.kind).filter(Boolean))];
function* next(s, acts) {
  for (const a of acts) {
    if (a.perKind) { for (const k of kinds(acts)) if (a.when(s, k)) { const t = copy(s); a.run(t, k); yield [`promote(${k})`, t, a, 'user']; } continue; }
    const sites = a.perSite ? s.listings.map((_, i) => i) : [null];
    const actors = a.actor === 'user' && s.auto.includes(a.kind) ? ['user', 'auto'] : [a.actor];
    for (const i of sites) for (const actor of actors) if (a.when(s, i)) {
      const t = copy(s); a.run(t, i, actor);
      if (actor === 'user' && a.kind && !NEVER_ALONE.has(a.kind)) // approvals of an Ask, counted toward "Always do this"
        t.approvals[a.kind] = Math.min(PROMOTE_AFTER, (t.approvals[a.kind] ?? 0) + 1);
      t.decisions.sort();
      yield [`${a.name}${a.perSite ? `(${i})` : ''}${actor !== a.actor ? '@auto' : ''}`, t, a, actor];
    }
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
