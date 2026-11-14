import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractListings, diff, emptyState, sign, verify, createMonitor, blocked, siteOf, RETRY_AFTER_S } from './monitor.mjs';

const card = (id, price, title = 'Carhartt Detroit jacket') => `<div class="card"><a href="/listing/${title.replace(/ /g, '-')}-${id}">${title}</a><span>$${price}</span></div>`;
const A = '6551f0a1b2c3d4e5f6a7b8c9', B = '6551f0a1b2c3d4e5f6a7b8ca', C = '6551f0a1b2c3d4e5f6a7b8cb';
const page = (...cards) => `<html><title>Search</title><body>${cards.join('')}</body></html>`;
const row = (site_id, price, more = {}) => ({ site: 'poshmark', site_id, url: `https://poshmark.com/listing/x-${site_id}`, title: 't', price, currency: 'USD', sold: false, ...more });

test('extract: listing links with the price that follows each', () => {
  const rows = extractListings(page(card(A, 120), card(B, '1,250.00')), 'poshmark');
  assert.deepEqual(rows.map(r => [r.site_id, r.price]), [[A, 120], [B, 1250]]);
  assert.equal(rows[0].url, `https://poshmark.com/listing/Carhartt-Detroit-jacket-${A}`);
});

test('extract: JSON-LD gives title, price and sold, and wins over the link guess', () => {
  const ld = `<script type="application/ld+json">${JSON.stringify({ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', item: { '@type': 'Product', name: 'Levis 501', url: 'https://www.grailed.com/listings/777', offers: { price: '45.00', priceCurrency: 'USD', availability: 'https://schema.org/SoldOut' } } }] })}</script>`;
  const [r] = extractListings(`<html>${ld}<a href="/listings/777">x</a> $999</html>`, 'grailed');
  assert.deepEqual([r.site_id, r.title, r.price, r.sold, r.guessed], ['777', 'Levis 501', 45, true, undefined]);
});

test('extract: the same listing linked twice is one row; eBay ids come from /itm/', () => {
  assert.equal(extractListings(page(card(A, 10), card(A, 10)), 'poshmark').length, 1);
  assert.equal(extractListings('<a href="https://www.ebay.com/itm/some-title/167003929710?x=1">a</a> US $90.00', 'ebay')[0].site_id, '167003929710');
  assert.equal(siteOf('https://www.ebay.com/sch/i.html?_nkw=x&_sop=10'), 'ebay');
});

test('diff: the first check seeds silently, the second reports only what is new', () => {
  const one = diff(emptyState(), [row(A, 100), row(B, 80)], { now: 1 });
  assert.deepEqual(one.events, []);
  const two = diff(one.state, [row(A, 100), row(B, 80), row(C, 60)], { now: 2 });
  assert.deepEqual(two.events.map(e => [e.type, e.site_id]), [['listing.new', C]]);
});

test('diff: with a cap, new listings over it stay quiet and a drop under it fires once', () => {
  let s = diff(emptyState(), [row(A, 300)], { cap: 250 }).state;
  let out = diff(s, [row(A, 300), row(B, 400)], { cap: 250 });
  assert.deepEqual(out.events, []);
  out = diff(out.state, [row(A, 240), row(B, 400)], { cap: 250 });
  assert.deepEqual(out.events.map(e => [e.type, e.site_id, e.was]), [['price.drop', A, 300]]);
  out = diff(out.state, [row(A, 230), row(B, 400)], { cap: 250 });
  assert.deepEqual(out.events, [], 'already under the cap: no second alert');
});

test('diff: with no cap, a drop needs 10% under the lowest seen, on an item of $10 or more', () => {
  let s = diff(emptyState(), [row(A, 100), row(B, 8)]).state;
  let out = diff(s, [row(A, 95), row(B, 4)]);
  assert.deepEqual(out.events, [], '5% is not a drop, and $8 items are too small');
  out = diff(out.state, [row(A, 85), row(B, 4)]);
  assert.deepEqual(out.events.map(e => [e.type, e.lowest]), [['price.drop', 95]]);
  out = diff(out.state, [row(A, 100)]);
  out = diff(out.state, [row(A, 90)]);
  assert.deepEqual(out.events.filter(e => e.type === 'price.drop'), [], 'back up then down to 90 is not under the lowest seen (85)');
});

test('diff: gone waits for two checks, and a listing that comes back is not reported', () => {
  let s = diff(emptyState(), [row(A, 100), row(B, 80)]).state;
  let out = diff(s, [row(A, 100)]);
  assert.deepEqual(out.events, []);
  const back = diff(out.state, [row(A, 100), row(B, 80)]);
  assert.deepEqual(back.events, []);
  out = diff(out.state, [row(A, 100)]);
  assert.deepEqual(out.events.map(e => [e.type, e.site_id]), [['listing.gone', B]]);
  assert.deepEqual(diff(out.state, [row(A, 100)]).events, [], 'reported once');
});

test('diff: sold on the page is reported at once; an empty page after a full one is suspicious, not forty sales', () => {
  const s = diff(emptyState(), [row(A, 100), row(B, 80)]).state;
  assert.deepEqual(diff(s, [row(A, 100, { sold: true }), row(B, 80)]).events.map(e => [e.type, e.reason]), [['listing.gone', 'sold']]);
  const empty = diff(s, []);
  assert.equal(empty.suspicious, true);
  assert.deepEqual(empty.events, []);
  assert.equal(empty.state.items[A].missing, 0);
});

test('webhook signature: verifies, and fails on a changed body, a wrong secret or an old timestamp', () => {
  const body = '{"a":1}', t = 1_800_000_000, h = sign(body, 's3', t);
  assert.equal(verify(body, h, 's3', { now: t * 1000 }), true);
  assert.equal(verify('{"a":2}', h, 's3', { now: t * 1000 }), false);
  assert.equal(verify(body, h, 'other', { now: t * 1000 }), false);
  assert.equal(verify(body, h, 's3', { now: (t + 301) * 1000 }), false);
  assert.equal(verify(body, 'garbage', 's3'), false);
});

function rig(pages) {
  let t = 1_800_000_000_000, i = 0; const posts = []; let hookUp = true;
  const mon = createMonitor({ now: () => t, fetchPage: async () => { const p = pages[Math.min(i++, pages.length - 1)]; if (p instanceof Error) throw p; return p; }, post: async (url, body, headers) => { if (!hookUp) return { ok: false, status: 500 }; posts.push({ url, body: JSON.parse(body), raw: body, headers }); return { ok: true, status: 200 }; } });
  return { mon, posts, wait: s => { t += s * 1000; }, hook: up => { hookUp = up; }, now: () => t };
}

test('monitor: seeds, then one signed webhook for a new listing, on schedule', async () => {
  const r = rig([page(card(A, 100)), page(card(A, 100), card(B, 90))]);
  r.mon.add({ id: 'm1', url: 'https://poshmark.com/search?query=detroit&sort_by=added_desc', intervalS: 300, webhook: 'https://app.example/hook', secret: 'k' });
  assert.deepEqual(await r.mon.tick(), { checked: 1, sent: 0 });
  assert.deepEqual(await r.mon.tick(), { checked: 0, sent: 0 }, 'not due yet');
  r.wait(300);
  assert.deepEqual(await r.mon.tick(), { checked: 1, sent: 1 });
  assert.deepEqual(r.posts[0].body.events.map(e => [e.type, e.site_id, e.price]), [['listing.new', B, 90]]);
  assert.equal(verify(r.posts[0].raw, r.posts[0].headers['secondhand-signature'], 'k', { now: r.now() }), true);
});

test('monitor: a failed webhook is retried after 1, 5 and 15 minutes, then set aside', async () => {
  const r = rig([page(card(A, 100)), page(card(A, 100), card(B, 90))]);
  r.mon.add({ id: 'm1', url: 'https://poshmark.com/search?query=x', intervalS: 86400, webhook: 'https://app.example/hook', secret: 'k' });
  await r.mon.check('m1'); await r.mon.check('m1');
  r.hook(false);
  assert.equal(await r.mon.deliver(), 0);
  for (const s of RETRY_AFTER_S.slice(0, 2)) { r.wait(s - 1); assert.equal(await r.mon.deliver(), 0); assert.equal(r.mon.outbox()[0].due_at > r.now(), true, 'not retried early'); r.wait(1); await r.mon.deliver(); }
  r.hook(true); r.wait(RETRY_AFTER_S[2]);
  assert.equal(await r.mon.deliver(), 1);
  assert.equal(r.mon.outbox().length, 0);
  assert.equal(r.posts.length, 1, 'delivered once');
});

test('monitor: a block or a failed fetch sends nothing false, says "behind" after two misses, then "recovered"', async () => {
  const wall = '<html><title>Just a moment...</title></html>';
  assert.equal(blocked(wall), true);
  const r = rig([page(card(A, 100), card(B, 90)), wall, new Error('timeout'), page(card(A, 100), card(B, 90), card(C, 70))]);
  r.mon.add({ id: 'm1', url: 'https://poshmark.com/search?query=x', webhook: 'https://app.example/hook', secret: 'k' });
  await r.mon.check('m1');
  assert.equal((await r.mon.check('m1')).why, 'blocked');
  assert.match((await r.mon.check('m1')).why, /fetch failed/);
  assert.equal(r.mon.get('m1').status, 'behind');
  const ok = await r.mon.check('m1');
  await r.mon.deliver();
  assert.deepEqual(r.posts.flatMap(p => p.body.events.map(e => e.type)), ['monitor.behind', 'monitor.recovered', 'listing.new']);
  assert.deepEqual(ok.events.filter(e => e.type === 'listing.gone'), [], 'nothing was reported gone while blocked');
});

test('monitor: refuses a site with no adapter and an interval under a minute', () => {
  const { mon } = rig([]);
  assert.throws(() => mon.add({ id: 'x', url: 'https://example.com/search' }), /no adapter/);
  assert.throws(() => mon.add({ id: 'x', url: 'https://poshmark.com/search?query=x', intervalS: 10 }), /hammer/);
});
