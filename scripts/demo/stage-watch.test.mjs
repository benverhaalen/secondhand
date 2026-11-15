import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listedAt, check, confirm, message, run, MAX_PER_CHECK } from './stage-watch.mjs';

// Poshmark ids are MongoDB ObjectIds; 6551f0a1 is 2023-11-13T09:47:13Z.
const A = '6551f0a1b2c3d4e5f6a7b8c9', B = '6551f0a1b2c3d4e5f6a7b8ca', C = '6551f0a1b2c3d4e5f6a7b8cb';
const card = (id, price) => `<div><a href="/listing/Carhartt-Detroit-jacket-${id}">Carhartt Detroit jacket</a><span>$${price}</span></div>`;
const page = (...cards) => `<html><title>Search</title><body>${cards.join('')}</body></html>`;
const listing = (id, price, availability = 'InStock') => `<html><script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: 'Carhartt Detroit jacket', url: `https://poshmark.com/listing/Carhartt-Detroit-jacket-${id}`, offers: { price: String(price), priceCurrency: 'USD', availability: `https://schema.org/${availability}` } })}</script></html>`;
const opts = { site: 'poshmark', now: 1_700_000_000_000 };

test('listedAt: a Poshmark id carries its creation time; other sites give none', () => {
  assert.equal(listedAt('poshmark', A), Date.parse('2023-11-13T09:47:13Z'));
  assert.equal(listedAt('ebay', '167003929710'), null);
  assert.equal(listedAt('poshmark', 'not-an-id'), null);
});

test('check: the first read seeds silently, the next names only what is new', () => {
  const one = check(undefined, page(card(A, 80), card(B, 60)), opts);
  assert.deepEqual(one.candidates, []);
  assert.equal(one.seen, 2);
  const two = check(one.state, page(card(C, 18), card(A, 80), card(B, 60)), opts);
  assert.deepEqual(two.candidates.map(c => c.site_id), [C]);
});

test('check: a listing that drops a lot is a candidate too (the booth variant)', () => {
  const one = check(undefined, page(card(A, 60)), opts);
  const two = check(one.state, page(card(A, 20)), opts);
  assert.deepEqual(two.candidates.map(c => [c.type, c.site_id]), [['price.drop', A]]);
});

test('check: a bot wall is reported and changes nothing', () => {
  const one = check(undefined, page(card(A, 80)), opts);
  const two = check(one.state, '<html><title>Just a moment...</title></html>', opts);
  assert.equal(two.blocked, true);
  assert.equal(two.state, one.state);
  assert.deepEqual(two.candidates, []);
});

test('check: more new listings than a stage needs are cut to the cheapest few', () => {
  const ids = Array.from({ length: 6 }, (_, i) => `6551f0a1b2c3d4e5f6a7b8d${i}`);
  const one = check(undefined, page(card(A, 80)), opts);
  const two = check(one.state, page(...ids.map((id, i) => card(id, 50 - i)), card(A, 80)), opts);
  assert.equal(two.candidates.length, MAX_PER_CHECK);
  assert.deepEqual(two.candidates.map(c => c.price), [45, 46, 47]);
});

test('confirm: only the listing page decides, at or under the cap and still for sale', () => {
  const cand = { site: 'poshmark', site_id: C, url: `https://poshmark.com/listing/x-${C}`, price: 18, price_guessed: true };
  assert.equal(confirm(cand, listing(C, 18), 25).price, 18);
  assert.equal(confirm(cand, listing(C, 25), 25).price, 25);
  assert.equal(confirm(cand, listing(C, 26), 25), null);
  assert.equal(confirm(cand, listing(C, 18, 'SoldOut'), 25), null);
  assert.equal(confirm(cand, '<html>no data</html>', 25), null);
});

test('message: says what, how much, where, and how long after listing it was found', () => {
  const m = message({ title: 'Carhartt Detroit jacket', price: 18, site: 'poshmark', url: 'https://poshmark.com/listing/x', listed_at: 1_000_000, found_at: 1_041_000 }, 25);
  assert.equal(m.title, 'Under $25: $18 on Poshmark');
  assert.equal(m.body, 'Carhartt Detroit jacket. Found 41 s after it was listed.');
  const n = message({ title: null, price: 18, site: 'ebay', url: 'u', listed_at: null, found_at: 5 }, 25);
  assert.equal(n.body, 'A new listing under your price.');
});

test('run: seeds, catches the new listing, confirms it, sends one alert, and stops on time', async () => {
  let t = opts.now, reads = 0;
  const pages = [page(card(A, 80)), page(card(A, 80)), page(card(C, 18), card(A, 80))];
  const fetchPage = async url => url.includes('/listing/') ? listing(C, 18) : pages[Math.min(reads++, pages.length - 1)];
  const sent = [];
  const out = await run({
    url: 'https://poshmark.com/search?query=carhartt&sort_by=added_desc', cap: 25, every_s: 10, for_min: 1,
    notify: 'https://ntfy.sh/topic', click: 'https://app.example/want',
    fetchPage, post: async (u, body, headers) => { sent.push({ u, body, headers }); return { ok: true }; },
    sleep: async ms => { t += ms; }, now: () => t,
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].u, 'https://ntfy.sh/topic');
  assert.equal(sent[0].headers.Title, 'Under $25: $18 on Poshmark');
  assert.equal(sent[0].headers.Click, 'https://app.example/want');
  assert.equal(out.alerts.length, 1);
  assert.ok(out.checks >= 6 && out.checks <= 7, `checks ${out.checks}`);
});

test('run: a blocked site backs off instead of hammering it', async () => {
  let t = opts.now; const waits = [];
  await run({
    url: 'https://poshmark.com/search?query=x', cap: 25, every_s: 10, for_min: 3,
    fetchPage: async () => '<html><title>Access Denied</title></html>', post: async () => ({ ok: true }),
    sleep: async ms => { waits.push(ms); t += ms; }, now: () => t,
  });
  assert.deepEqual(waits.slice(0, 4), [20_000, 40_000, 60_000, 60_000]);
});

test('run: refuses a check faster than every 5 seconds', async () => {
  await assert.rejects(run({ url: 'https://poshmark.com/search?query=x', cap: 25, every_s: 2, for_min: 1, fetchPage: async () => '', post: async () => ({}), sleep: async () => {}, now: () => 0 }), /every_s/);
});
