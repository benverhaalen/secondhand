// What each marketplace does, as single facts that timers, messages and checks read. Agent proposal.
// One fact lives in one place: a clock, a floor or a binding rule is written here once, with its evidence mark
// and the note it came from, and everything else derives from it. Server-side only: the app is sent the
// computed time or verdict, never the rule. Listing limits (title length, tags, photos) stay in
// research/list/ben/platforms/platform-fit.json, and fees stay in the money fee table (determinations/money.md).
// A value of null means the site has no such thing. UNKNOWN means nobody has confirmed it: fact() throws,
// so no caller can fall back to a guess.

export const SITES = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
export const UNKNOWN = Symbol('unknown');

const N = 'research/list/ben/platforms/';
const obs = (v, src) => ({ v, mark: 'observed', src: N + src });
const say = (v, src) => ({ v, mark: 'asserted', src: N + src });
const chat = say(null, 'facebook-marketplace.md#9-pricing-and-offers'); // local Facebook sales have no offer object, only chat
const open = src => say(UNKNOWN, src);
// A fact read on the site's own page, filed in a note outside Ben's platform folder.
const seen = (v, src) => ({ v, mark: 'observed', src });

export const FACTS = {
  // Hours a buyer's offer stays open.
  'offer.buyer.expires_h': { ebay: obs(24, 'ebay.md#9-pricing-and-offers'), depop: obs(24, 'depop.md#9-pricing-and-offers'), poshmark: say(24, 'poshmark.md#9-pricing-and-offers'), mercari: obs(24, 'mercari.md#9-pricing-and-offers'), facebook: chat },
  // Hours a counteroffer stays open.
  'offer.counter.expires_h': { ebay: obs(96, 'ebay.md#9-pricing-and-offers'), depop: obs(24, 'depop.md#9-pricing-and-offers'), poshmark: say(24, 'poshmark.md#9-pricing-and-offers'), mercari: obs(24, 'mercari.md#9-pricing-and-offers'), facebook: chat },
  // Hours an offer we send to likers or watchers stays open.
  'offer.seller.expires_h': { ebay: obs(96, 'ebay.md#9-pricing-and-offers'), depop: seen(336, 'research/list/nate/ranking-levers-per-site.md#depop'), poshmark: open('poshmark.md#9-pricing-and-offers'), mercari: obs(24, 'mercari.md#9-pricing-and-offers'), facebook: chat },
  // Least percent under the listing price for an offer we send.
  'offer.seller.min_off_pct': { ebay: obs(5, 'ebay.md#9-pricing-and-offers'), depop: obs(5, 'depop.md#9-pricing-and-offers'), poshmark: say(10, 'poshmark.md#9-pricing-and-offers'), mercari: obs(10, 'mercari.md#9-pricing-and-offers'), facebook: chat },
  // Whether a repeat offer must also undercut the lowest price the item has had.
  'offer.seller.under_lowest': { ebay: obs(false, 'ebay.md#9-pricing-and-offers'), depop: obs(false, 'depop.md#9-pricing-and-offers'), poshmark: say(true, 'poshmark.md#9-pricing-and-offers'), mercari: obs(true, 'mercari.md#9-pricing-and-offers'), facebook: chat },
  // Hours to wait before sending offers on the same item again. null: no wait stated.
  'offer.seller.repeat_h': { ebay: obs(48, 'ebay.md#9-pricing-and-offers'), depop: obs(null, 'depop.md#9-pricing-and-offers'), poshmark: open('poshmark.md#9-pricing-and-offers'), mercari: obs(72, 'mercari.md#9-pricing-and-offers'), facebook: chat },
  // Whether a buyer accepting our offer is a sale we must honour.
  'offer.seller.binds': { ebay: obs(true, 'ebay.md#9-pricing-and-offers'), depop: obs(false, 'depop.md#9-pricing-and-offers'), poshmark: say(true, 'poshmark.md#9-pricing-and-offers'), mercari: obs(true, 'mercari.md#9-pricing-and-offers'), facebook: chat },
  // Whether the buyer is charged the moment an offer is accepted.
  'accept.charges_buyer': { ebay: obs(true, 'ebay.md#9-pricing-and-offers'), depop: obs(false, 'depop.md#9-pricing-and-offers'), poshmark: say(true, 'poshmark.md#9-pricing-and-offers'), mercari: say(true, 'mercari.md#9-pricing-and-offers'), facebook: say(false, 'facebook-marketplace.md#9-pricing-and-offers') },
  // Hours the buyer has to pay after acceptance, where acceptance does not charge.
  'accept.pay_within_h': { ebay: obs(null, 'ebay.md#9-pricing-and-offers'), depop: obs(24, 'depop.md#9-pricing-and-offers'), poshmark: say(null, 'poshmark.md#9-pricing-and-offers'), mercari: say(null, 'mercari.md#9-pricing-and-offers'), facebook: say(null, 'facebook-marketplace.md#9-pricing-and-offers') },
  // Whether deleting and relisting for visibility is against the site's rules or its ranking.
  'relist.penalized': { ebay: say(false, 'ebay.md#12-the-algorithm'), depop: obs(false, 'depop.md#12-the-algorithm'), poshmark: say(true, 'poshmark.md#13-rules-that-bite'), mercari: obs(true, 'mercari.md#13-rules-that-bite'), facebook: say(false, 'facebook-marketplace.md#12-the-algorithm') },
};

export const known = (key, site) => FACTS[key]?.[site] !== undefined && FACTS[key][site].v !== UNKNOWN;
export function fact(key, site) {
  const f = FACTS[key]?.[site];
  if (!f) throw new Error(`no fact ${key} for ${site}`);
  if (f.v === UNKNOWN) throw new Error(`${key} is not known for ${site}: read it from the live page (${f.src})`);
  return f.v;
}
// Facts taken from memory or a seller blog. An adapter reads the live page before it relies on one.
export const unconfirmed = () => Object.entries(FACTS).flatMap(([key, row]) => Object.entries(row).filter(([, f]) => f.mark !== 'observed').map(([site]) => ({ key, site })));

const HOUR = 3600e3;
const plus = (t, h) => h === null ? null : new Date(+t + h * HOUR);

// kind: buyer (an offer to us), counter, or seller (an offer we sent). null: the site puts no clock on it.
export const offerExpiresAt = (site, kind, sentAt) => plus(sentAt, fact(`offer.${kind}.expires_h`, site));

// What accepting an offer means. Where the buyer is charged at once it is a sale and every other listing comes down.
// Where it is only a promise, the other listings stay up until the money arrives (paid beats dibs, lifecycle.mjs).
export function afterAccept(site) {
  const sale = fact('accept.charges_buyer', site);
  return { sale, pay_within_h: fact('accept.pay_within_h', site), delist_others: sale };
}

// May we send this offer now? promised_elsewhere: a sale or an accepted offer is in progress on another site.
export function sellerOffer(site, { list_cents, offer_cents, lowest_cents = list_cents, last_sent_at = null, now, promised_elsewhere = false }) {
  const no = why => ({ ok: false, why });
  const min = fact('offer.seller.min_off_pct', site);
  if (min === null) return no('this site has no offers to send');
  if (promised_elsewhere && fact('offer.seller.binds', site)) return no('the item is promised on another site, and an accepted offer here would be a second sale');
  const cap = c => Math.floor(c * (100 - min) / 100);
  if (offer_cents > cap(list_cents)) return no(`must be at least ${min}% under the listing price`);
  if (fact('offer.seller.under_lowest', site) && lowest_cents < list_cents && offer_cents > cap(lowest_cents)) return no(`must be at least ${min}% under the lowest price so far`);
  const wait = fact('offer.seller.repeat_h', site);
  if (wait !== null && last_sent_at && +now < +last_sent_at + wait * HOUR) return no(`wait ${wait} hours between offers on one item`);
  return { ok: true };
}

// After a sale elsewhere: the time until which offers we already sent could still be accepted here. null: none bind.
export function exposedUntil(site, sentOffers) {
  if (!sentOffers.length || !fact('offer.seller.binds', site)) return null;
  return new Date(Math.max(...sentOffers.map(o => +offerExpiresAt(site, 'seller', o.sent_at))));
}
