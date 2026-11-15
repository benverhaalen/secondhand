import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AMOUNTS, WORLDS, WORLD_NAMES, connectionState, countdown, feed, groups, headline, insights, pill, shelves, usd, when, world } from './index.ts';

const all = WORLD_NAMES.map(n => [n, world(n)] as const);

test('every amount is whole cents, so no screen formats a float', () => {
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (/_cents$|^(low|high)$/.test(k) && x !== null && x !== undefined && typeof x === 'number') assert.ok(Number.isInteger(x), `${path}.${k} = ${x}`);
      walk(x, `${path}.${k}`);
    }
  };
  for (const [n, w] of all) walk(w, n);
});

test('every row points at something that exists in its world', () => {
  for (const [n, w] of all) {
    const items = new Set(w.items.map(i => i.id)), listings = new Set(w.items.flatMap(i => i.listings.map(l => l.id)));
    for (const d of w.decisions) if (d.item_id) assert.ok(items.has(d.item_id), `${n} ${d.id} -> ${d.item_id}`);
    for (const o of w.orders) assert.ok(items.has(o.item_id), `${n} ${o.id}`);
    for (const o of w.offers) assert.ok(listings.has(o.listing_id), `${n} ${o.id}`);
    for (const c of w.conversations) if (c.item_id) assert.ok(items.has(c.item_id), `${n} ${c.id}`);
    const convs = new Set(w.conversations.map(c => c.id));
    for (const m of w.messages) assert.ok(convs.has(m.conversation_id), `${n} ${m.id}`);
  }
});

test('words a person reads: curly apostrophes, no site names, no emoji, no dashes, no exclamations', () => {
  const said: [string, string][] = [];
  for (const [n, w] of all) {
    for (const d of w.decisions) { said.push([`${n} ${d.id}.why`, d.why]); for (const o of d.options) said.push([`${n} ${d.id}.${o.id}`, `${o.label} ${o.does}`]); }
    for (const m of w.messages) if (m.actor !== 'counterpart') said.push([`${n} ${m.id}`, m.text]);
    for (const e of w.events) said.push([`${n} ${e.event_id}`, e.why]);
    for (const i of w.items) said.push([`${n} ${i.id}`, i.title]);
  }
  for (const [where, s] of said) {
    assert.doesNotMatch(s, /[A-Za-z]'[a-z]/, `${where}: straight apostrophe in "${s}"`);
    assert.doesNotMatch(s, /\b(?:eBay|Poshmark|Depop|Mercari|Facebook Marketplace)\b/, `${where}: a site named in words, "${s}"`);
    assert.doesNotMatch(s, /[—–!]|\p{Extended_Pictographic}/u, `${where}: "${s}"`);
  }
});

test('the top of Today: money kept since the last open, else the next setup step, never $0', () => {
  const c = headline(world('clearing'));
  assert.equal(c?.kind, 'kept_since_last_open');
  assert.equal(c?.sub, '2 sold, after fees');
  assert.equal(c?.label, 'Since yesterday');
  const kept = world('clearing').orders.filter(o => o.id === 'ord_kin' || o.id === 'ord_tee').reduce((a, o) => a + o.price_cents - o.fees_cents - o.shipping_cents, 0);
  assert.equal(c?.value, kept);
  assert.equal(headline(world('new'))?.kind, 'next_setup_step');
  assert.equal(headline(world('one')), null);
});

test('Today orders by tier, then the soonest deadline, and groups batches and queues', () => {
  const f = feed(world('clearing'));
  const tiers = f.map(d => ['now', 'when_you_can', 'good_to_know'].indexOf(d.feed));
  assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b));
  assert.equal(f[0].id, 'dec_addr');
  const g = groups(world('flipper'));
  assert.equal(g.find(x => x.key === 'first_post')?.cards.length, 40);
  assert.equal(g.find(x => x.key === 'buy_label')?.cards.length, 5, 'the label due within a day stands alone');
  assert.equal(g.find(x => x.key === 'dec_fl0')?.form, 'single');
});

test('every connection state shows up in some world', () => {
  const seen = new Set(all.flatMap(([, w]) => w.connections.map(connectionState)));
  assert.deepEqual([...seen].sort(), ['connected', 'error', 'loading', 'not_connected']);
});

test('pills and shelves come from the rows', () => {
  const w = world('clearing'), by = (id: string) => pill(w, w.items.find(i => i.id === id)!);
  assert.equal(by('it_jacket'), 'Offer');
  assert.equal(by('it_kindle'), 'Ship by');
  assert.equal(by('it_lamp'), 'Slow');
  assert.equal(by('it_hoodie'), 'Researching');
  assert.equal(pill(world('edge'), world('edge').items.find(i => i.id === 'it_fail')!), 'Failed');
  assert.ok(shelves(w).find(s => s.id === 'kept')?.items.some(i => i.id === 'it_dunks'));
  assert.equal(shelves(world('new')).every(s => s.items.length === 0), true);
});

test('You numbers are after fees and add up', () => {
  const i = insights(world('clearing'));
  assert.equal(i.sold, 4);
  assert.equal(i.kept_cents, i.earned_cents - i.fees_cents);
  assert.ok(i.by_site.some(r => r.site === 'facebook' && r.sold === 1));
});

test('break content holds the extremes', () => {
  const e = world('edge');
  assert.ok(e.offers.some(o => o.state === 'expired'));
  assert.ok(e.items.some(i => i.listings.some(l => l.state === 'postFailed')));
  assert.ok(e.items.some(i => i.listings.some(l => l.price_cents === AMOUNTS.zero)));
  assert.ok(e.items.some(i => i.title.length > 120));
  assert.deepEqual(['acting', 'failed', 'expired'].filter(s => e.decisions.some(d => d.state === s)), ['acting', 'failed', 'expired']);
  assert.equal(Object.keys(WORLDS).length, 7);
});

test('formatters', () => {
  assert.equal(usd(8500), '$85');
  assert.equal(usd(7735), '$77.35');
  assert.equal(usd(AMOUNTS.huge), '$12,499.99');
  assert.equal(usd(0), '$0');
  assert.equal(usd(-1278), '-$12.78');
  assert.equal(countdown('2026-11-15T21:40:00Z'), '3h 40m');
  assert.equal(countdown('2026-11-15T17:00:00Z'), null);
  assert.equal(when('2026-11-16T00:00:00Z'), 'today at 6 pm');
});
