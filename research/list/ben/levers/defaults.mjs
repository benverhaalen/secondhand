// What secondhand sets on each site's own pricing tools when an item is listed,
// from the person's two lines (floor and always accept) and the plan's price.
//   node defaults.mjs <list> <floor> <always_accept> [days_live]   one item, every posting site, in dollars
//   node defaults.mjs check                                        every site has rules and every row a source
// Money is in cents inside. Site facts live in levers.json; this file only does arithmetic on them.
// Every output is an *agent proposal* (research/list/ben/levers-and-signals.md, "Defaults").
import { readFileSync } from 'node:fs';

export const data = JSON.parse(readFileSync(new URL('./levers.json', import.meta.url), 'utf8'));
export const POSTING = ['ebay', 'depop', 'poshmark', 'mercari', 'facebook'];

const pct = (cents, p) => Math.round(cents * p);
// Round down to a whole dollar: list prices on these sites end in whole dollars far more often than not.
export const dollars = cents => Math.floor(cents / 100) * 100;

// The opening ask on a site: the target price with room for the site's usual offer.
// `room` is the prior from levers.json; money D13 replaces it with the learned d per site and category.
export function listPrice(site, targetCents) {
  const r = data.sites[site].rules;
  if (r.room_min_cents && targetCents < r.room_min_cents) return targetCents;
  return dollars(targetCents / (1 - r.room));
}

// The settings for one site. Returns { site, set: {...native settings}, agent: [...what our job does], why: [...] }.
// Lines: price p, floor f, always accept a, all in cents. daysLive: how long the current price has been live.
export function defaultsFor(site, { price: p, floor: f, alwaysAccept: a, daysLive = 0 }) {
  if (!(f <= a && a <= p)) throw new Error(`need floor <= always_accept <= price, got ${f}, ${a}, ${p}`);
  const r = data.sites[site].rules;
  const set = {}, agent = [], why = [];

  // 1. Accepting. Where the site has an auto-accept, it is the person's always-accept line.
  if (r.auto_accept === 'accept_and_decline') {
    // eBay: the accept line must sit below Buy It Now; there is no auto-counter, so the decline line is set
    // low enough that real first offers (mean about 61% of list on eBay) reach our job, which counters.
    set.best_offer = true;
    set.auto_accept_cents = Math.min(a, p - 1);
    set.auto_decline_cents = Math.min(f, pct(p, r.decline_below_share));
    agent.push('counter offers between the two lines within minutes (money D16)');
    why.push(`offers under ${Math.round(r.decline_below_share * 100)}% of the price are declined by eBay; the buyer can offer again`);
  } else if (r.auto_accept === 'accept_and_counter_at_line') {
    // Depop and Poshmark: one line both accepts at or above and counters below at exactly that line.
    // Set at the floor, every lowball would be countered at the floor, which tells buyers the floor.
    const cap = pct(p, 1 - r.offer_min_discount);
    if (a <= cap) {
      set[r.auto_accept_field] = a;
      why.push('one line accepts and counters; it is set at always accept so a counter never shows the floor');
    } else {
      agent.push('answer offers ourselves: always accept is too close to the price for the site tool');
    }
    agent.push('offers the site tool countered and the buyer answered go through money D16');
    if (r.note) why.push(r.note);
  } else {
    agent.push('answer offers in chat or the inbox within minutes (money D16); the site has no auto-accept');
  }

  // 2. Offers to people who liked, saved, watched or bagged it. The first one is the site minimum (likers who wait
  // for a deal exist, so start small), and only when it is at or above always accept, so it never needs asking.
  if (r.likers_offer) {
    const offer = dollars(pct(p, 1 - r.likers_offer.min_discount));
    if (offer >= a) {
      if (r.likers_offer.auto_field) set[r.likers_offer.auto_field] = offer;
      else agent.push(`offer $${offer / 100} to likers when the plan says (listing D17)`);
      if (r.likers_offer.shipping_discount_required) why.push('Poshmark requires a shipping discount with an offer to likers; it counts toward the discount');
    } else agent.push('offers to likers ask first: the site minimum discount lands under always accept');
  }

  // 3. How a planned price drop is made on this site.
  const m = r.markdown;
  if (m.route === 'discount_tool' && daysLive >= data.rules.strikethrough_min_days) set.markdown = m.tool;
  else if (m.route === 'discount_tool') set.markdown = 'edit price (the old price has not been live long enough to show it struck through)';
  else set.markdown = m.tool;
  if (m.min_step) why.push(`each drop is at least ${Math.round(m.min_step * 100)}%: ${m.why}`);

  // 4. Site tools that would fight our plan stay off.
  for (const off of r.keep_off ?? []) set[off.setting] = false;
  for (const on of r.turn_on ?? []) set[on.setting] = true;
  return { site, set, agent, why };
}

// The plan on every posting site from one target price and the person's two lines (all in cents).
export function plan({ target, floor, alwaysAccept, daysLive = 0, sites = POSTING }) {
  return sites.map(site => {
    const price = Math.max(listPrice(site, target), alwaysAccept);
    return { price, ...defaultsFor(site, { price, floor, alwaysAccept, daysLive }) };
  });
}

export function check() {
  const errors = [];
  if (!data.rules?.strikethrough_min_days) errors.push('rules.strikethrough_min_days');
  for (const site of POSTING) {
    const s = data.sites[site];
    if (!s?.rules) { errors.push(`${site}: no rules`); continue; }
    for (const k of ['room', 'auto_accept', 'markdown']) if (s.rules[k] === undefined) errors.push(`${site}: rules.${k}`);
    for (const kind of ['levers', 'signals'])
      for (const row of s[kind] ?? []) if (!row.mark || !row.source) errors.push(`${site} ${kind} ${row.id}: mark and source`);
    if (!s.signals?.length) errors.push(`${site}: no signals`);
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'check') {
    const e = check();
    console.log(e.length ? e.join('\n') : 'ok');
    process.exit(e.length ? 1 : 0);
  }
  const [target, floor, alwaysAccept, daysLive = 0] = [cmd, ...rest].map(Number);
  if (!target) { console.log('usage: node defaults.mjs <target> <floor> <always_accept> [days_live] | check'); process.exit(1); }
  const c = x => Math.round(x * 100);
  for (const row of plan({ target: c(target), floor: c(floor), alwaysAccept: c(alwaysAccept), daysLive }))
    console.log(`${row.site}: list $${row.price / 100}\n  set ${JSON.stringify(row.set)}\n  agent ${row.agent.join('; ')}\n  why ${row.why.join('; ')}`);
}
