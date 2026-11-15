import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SITES, EVENT_KINDS } from './event.ts';
import type { Change, Site, Snapshot } from './event.ts';
import { diff, fromFeed, diffSweep, toEvent } from './differ.ts';

const at = '2026-11-14T12:00:00Z';
function snapshot(site: Site = 'depop'): Snapshot {
  return {
    site, account_id: 'a1', user_id: 'u1', taken_at: at, route: 'signed_in',
    listings: [
      { external_id: 'L1', state: 'live', price_cents: 5000, likes: 2 },
      { external_id: 'L2', state: 'live', price_cents: 6000, likes: 0 },
    ],
    offers: [
      { external_id: 'O1', listing_external_id: 'L1', amount_cents: 3000, state: 'open' },
      { external_id: 'O2', listing_external_id: 'L2', amount_cents: 4000, state: 'declined' },
    ],
    messages: [
      { external_id: 'M1', thread_ref: 'T1', listing_external_id: 'L1', at, from: 'buyer' },
      { external_id: 'M2', thread_ref: 'T2', at, from: 'us' },
    ],
    orders: [
      { external_order_id: 'R1', listing_external_id: 'L1', state: 'paid', price_cents: 5000 },
      { external_order_id: 'R2', listing_external_id: 'L2', state: 'shipped', price_cents: 6000 },
    ],
    notifications: [
      { external_id: 'N1', kind: 'listing.sold', ref: 'old1', at },
      { external_id: 'N2', kind: 'unmapped', at },
    ],
  };
}
function reversed(s: Snapshot): Snapshot {
  const next = structuredClone(s);
  for (const key of ['listings', 'offers', 'messages', 'orders', 'notifications'] as const) {
    next[key]?.reverse();
  }
  return next;
}
function changed(s: Snapshot): Snapshot {
  const next = reversed(s);
  const l1 = next.listings!.find(x => x.external_id === 'L1')!;
  Object.assign(l1, { state: 'sold', price_cents: 4200, likes: 4 });
  next.listings!.find(x => x.external_id === 'L2')!.state = 'ended';
  next.offers!.find(x => x.external_id === 'O1')!.amount_cents = 3200;
  next.offers!.push({ external_id: 'O3', listing_external_id: 'L2', amount_cents: 4100, state: 'open' });
  next.messages!.push(
    { external_id: 'M3', thread_ref: 'T1', listing_external_id: 'L1', at, from: 'buyer' },
    { external_id: 'M4', thread_ref: 'T2', at, from: 'us' },
  );
  next.orders!.find(x => x.external_order_id === 'R1')!.state = 'shipped';
  next.orders!.push({ external_order_id: 'R3', listing_external_id: 'L2', state: 'paid', price_cents: 6000 });
  return next;
}
function expected(site: Site): Change[] {
  const row = (action: Change['action'], ref: string, listing: string, payload = {}, value?: string | number): Change => ({
    action, site, account_id: 'a1', ref, listing_external_id: listing, payload,
    dedupe_key: `${site}:a1:${action}:${ref}${value === undefined ? '' : `:${value}`}`,
  });
  return [
    row('listing.sold', 'L1', 'L1'),
    row('price.changed', 'L1', 'L1', { from_cents: 5000, to_cents: 4200 }, 4200),
    row('like.added', 'L1', 'L1', { from: 2, to: 4 }, 4),
    row('listing.ended', 'L2', 'L2'),
    row('offer.received', 'O1', 'L1', { amount_cents: 3200 }, 3200),
    row('offer.received', 'O3', 'L2', { amount_cents: 4100 }, 4100),
    row('message.received', 'M3', 'L1', { thread_ref: 'T1' }),
    row('order.updated', 'R1', 'L1', { state: 'shipped', price_cents: 5000 }, 'shipped'),
    row('order.updated', 'R3', 'L2', { state: 'paid', price_cents: 6000 }, 'paid'),
  ];
}
for (const site of SITES) {
  test(`${site}: a reordered snapshot -> no changes`, () => {
    const prev = snapshot(site);
    assert.deepEqual(diff(prev, reversed(prev)), []);
    assert.deepEqual(fromFeed(prev, reversed(prev)), []);
    assert.deepEqual(diffSweep(prev, reversed(prev)), []);
  });
  test(`${site}: changed pair -> expected changes and stable keys`, () => {
    const prev = snapshot(site);
    const next = changed(prev);
    assert.deepEqual(diff(prev, next), expected(site));
    assert.deepEqual(diff(reversed(prev), reversed(next)), expected(site));
    assert.deepEqual(diff(prev, next), diff(prev, next));
  });
}
test('a price change -> one price.changed', () => {
  const prev = snapshot();
  const next = structuredClone(prev);
  next.listings![0].price_cents = 4200;
  assert.deepEqual(diff(prev, next), [expected('depop')[1]]);
});
test('a section not read -> no removals', () => {
  for (const section of ['listings', 'offers', 'messages', 'orders', 'notifications'] as const) {
    const full = changed(snapshot());
    const unread = structuredClone(full);
    delete unread[section];
    const only: Snapshot = { site: full.site, account_id: full.account_id, user_id: full.user_id, taken_at: at, route: full.route };
    Object.assign(only, { [section]: full[section] });
    const empty = { ...only, [section]: [] };
    const missing = { ...only };
    delete missing[section];
    for (const fn of [diff, fromFeed, diffSweep]) {
      assert.deepEqual(fn(missing, only), []);
      assert.deepEqual(fn(only, missing), []);
      assert.deepEqual(fn(only, empty), []);
    }
    assert.equal(diff(unread, full).some(c => c.action === 'listing.ended'), false);
  }
});
test('null previous snapshot establishes a silent baseline', () => {
  for (const fn of [diff, fromFeed, diffSweep]) assert.deepEqual(fn(null, changed(snapshot())), []);
});
test('empty sections were read: new offers, buyer messages and orders emit', () => {
  const next = snapshot();
  const prev = { ...next, listings: [], offers: [], messages: [], orders: [], notifications: [] };
  assert.deepEqual(diff(prev, next).map(c => [c.action, c.ref]), [
    ['offer.received', 'O1'], ['offer.received', 'O2'], ['message.received', 'M1'],
    ['order.updated', 'R1'], ['order.updated', 'R2'],
  ]);
});
test('only the requested transitions emit', () => {
  const prev = snapshot();
  const next = structuredClone(prev);
  prev.listings![0].state = 'draft';
  next.listings![0].state = 'ended';
  next.listings![1].likes = undefined;
  next.offers![1].amount_cents = 4500;
  next.orders![0].price_cents = 4200;
  next.messages![0].at = '2026-11-14T13:00:00Z';
  assert.deepEqual(diff(prev, next), []);
  prev.listings![0].state = 'ended';
  next.listings![0].state = 'sold';
  assert.deepEqual(diff(prev, next).map(c => c.action), ['listing.sold']);
});
test('likes falling or first becoming readable do not emit', () => {
  const prev = snapshot();
  const next = structuredClone(prev);
  next.listings![0].likes = 1;
  delete prev.listings![1].likes;
  next.listings![1].likes = 4;
  assert.deepEqual(diff(prev, next), []);
});
test('feed and section report the same sale -> one change', () => {
  const prev = snapshot();
  const next = structuredClone(prev);
  next.listings![0].state = 'sold';
  next.notifications!.push({ external_id: 'N3', kind: 'listing.sold', ref: 'L1', at });
  assert.deepEqual(fromFeed(prev, next), [expected('depop')[0]]);
  assert.deepEqual(diffSweep(prev, next), [expected('depop')[0]]);
});
test('feed supports all EventKinds, ignores old and unknown notifications, falls back to notification id', () => {
  const prev = snapshot();
  const next = structuredClone(prev);
  next.notifications!.push(...EVENT_KINDS.map((kind, i) => ({ external_id: `new${String(i).padStart(2, '0')}`, kind, at })));
  next.notifications!.push({ external_id: 'unknown', kind: 'other', at });
  const changes = fromFeed(prev, next);
  assert.deepEqual(fromFeed(reversed(prev), reversed(next)), changes);
  assert.deepEqual(changes.map(c => c.action), [...EVENT_KINDS]);
  changes.forEach((c, i) => assert.equal(c.dedupe_key, `depop:a1:${c.action}:new${String(i).padStart(2, '0')}`));
});
test('feed uses section values for matching keys and takes precedence in sweep order', () => {
  const prev = snapshot();
  const next = changed(prev);
  const sectionChanges = expected('depop');
  next.notifications!.push(...[...sectionChanges].reverse().map((c, i) => ({ external_id: `new${i}`, kind: c.action, ref: c.ref, at })));
  assert.deepEqual(fromFeed(prev, next), [...sectionChanges].reverse());
  assert.deepEqual(diffSweep(prev, next), [...sectionChanges].reverse());
});
test('dedupe keys distinguish account, site and new value', () => {
  const prev = snapshot();
  const next = structuredClone(prev);
  next.listings![0].price_cents = 4200;
  const key = diff(prev, next)[0].dedupe_key;
  for (const other of [{ ...next, account_id: 'a2' }, { ...next, site: 'ebay' as const }]) {
    assert.notEqual(diff({ ...prev, account_id: other.account_id, site: other.site }, other)[0].dedupe_key, key);
  }
  next.listings![0].price_cents = 4100;
  assert.notEqual(diff(prev, next)[0].dedupe_key, key);
});
test('differs do not mutate snapshots or return aliases into them', () => {
  const prev = snapshot();
  const next = changed(prev);
  const before = structuredClone({ prev, next });
  for (const fn of [diff, fromFeed, diffSweep]) {
    const result = fn(prev, next);
    if (result.length) result[0].payload.extra = true;
  }
  assert.deepEqual({ prev, next }, before);
});
test('toEvent preserves external references in payload, uses site actor and observation time', () => {
  const change = expected('depop')[1];
  const context = { user_id: 'u1', source: 'watcher_signed_in' as const, observed_at: at, trace_id: 'trace1' };
  const event = toEvent(change, context);
  assert.deepEqual(event, {
    ...context, action: change.action, site: 'depop', account_id: 'a1',
    actor: 'site', effective_at: at, dedupe_key: change.dedupe_key,
    payload: { ref: 'L1', listing_external_id: 'L1', from_cents: 5000, to_cents: 4200 },
  });
  event.payload!.extra = true;
  assert.equal(change.payload.extra, undefined);
  assert.equal('listing_id' in event, false);
});


test('a reordered snapshot -> no changes', () => {
  for (const site of SITES) {
    const prev = snapshot(site);
    assert.deepEqual(diffSweep(prev, reversed(prev)), [], site);
  }
});
test('a newly observed sold listing emits, but a missing listing is not ended', () => {
  const prev = snapshot();
  const next = { ...prev, listings: [{ external_id: 'L3', state: 'sold' as const, price_cents: 4200 }] };
  assert.deepEqual(diff(prev, next).map(c => [c.action, c.ref]), [['listing.sold', 'L3']]);
});
test('duplicate feed facts produce one change, with unrelated section changes after the feed', () => {
  const prev = snapshot();
  const next = changed(prev);
  next.notifications!.push(
    { external_id: 'N3', kind: 'listing.sold', ref: 'L1', at },
    { external_id: 'N4', kind: 'listing.sold', ref: 'L1', at },
  );
  assert.deepEqual(fromFeed(prev, next), [expected('depop')[0]]);
  assert.deepEqual(diffSweep(prev, next), expected('depop'));
});

// The shared fixture (spec/fixtures/snapshot): states are already normalised (live/sold/ended/draft), so the
// site words in manifest.status_words are the platform adapter's job, not the differ's.
for (const site of SITES) {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../../../../spec/fixtures/snapshot/${site}/${f}`, import.meta.url), 'utf8'));
  test(`fixture ${site}: reordered gives nothing, changed gives expected.json's changes (the differ's own shapes)`, () => {
    const base: Snapshot = read('base.json');
    const pairs = read('expected.json').pairs;
    assert.deepEqual(diffSweep(base, read('reordered.json')), []);
    assert.deepEqual(diffSweep(base, read('public.json')), []);
    const got = diffSweep(base, read('changed.json'));
    assert.deepEqual(got.map(c => ({ action: c.action, ref: c.ref, ...(c.listing_external_id !== undefined ? { listing_external_id: c.listing_external_id } : {}), payload: c.payload })), pairs[1].changes);
    for (const c of got) assert.ok(c.dedupe_key.startsWith(`${site}:${base.account_id}:${c.action}:${c.ref}`));
    assert.equal(new Set(got.map(c => c.dedupe_key)).size, got.length);
  });
}
