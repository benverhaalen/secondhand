// node --test research/list/ben/levers/defaults.test.mjs research/list/ben/levers/interest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultsFor, listPrice, plan, check, POSTING } from './defaults.mjs';

const line = { price: 5000, floor: 3000, alwaysAccept: 4000 };

test('levers.json: every posting site has rules, signals, and a mark and source on every row', () => {
  assert.deepEqual(check(), []);
});

test('eBay: accept at always accept, decline only real lowballs, counter the middle ourselves', () => {
  const { set, agent } = defaultsFor('ebay', line);
  assert.equal(set.auto_accept_cents, 4000);
  assert.equal(set.auto_decline_cents, 2500, 'half the price, under the floor: a 60% first offer reaches our counter');
  assert.match(agent.join(), /D16/);
});

test('eBay: the accept line stays under Buy It Now even when always accept equals the price', () => {
  assert.equal(defaultsFor('ebay', { price: 5000, floor: 3000, alwaysAccept: 5000 }).set.auto_accept_cents, 4999);
});

test('Depop: the one auto-respond line is always accept, never the floor, so a counter never shows the floor', () => {
  const { set } = defaultsFor('depop', line);
  assert.equal(set.auto_negotiate_offer_price, 4000);
  assert.notEqual(set.auto_negotiate_offer_price, line.floor);
});

test('Depop: always accept within 5% of the price leaves auto-respond unset and our job answers', () => {
  const r = defaultsFor('depop', { price: 5000, floor: 3000, alwaysAccept: 4900 });
  assert.equal(r.set.auto_negotiate_offer_price, undefined);
  assert.match(r.agent.join(), /answer offers ourselves/);
});

test('Depop: likers get the site minimum offer automatically when it clears always accept', () => {
  assert.equal(defaultsFor('depop', line).set.auto_send_offer_price, 4700);
});

test('likers offers under always accept are not automatic', () => {
  const r = defaultsFor('mercari', { price: 5000, floor: 3000, alwaysAccept: 4800 });
  assert.equal(r.set.auto_offer_to_likers, undefined);
  assert.match(r.agent.join(), /ask first/);
});

test('Depop markdowns show a struck-through price only after the price was live a week', () => {
  assert.match(defaultsFor('depop', { ...line, daysLive: 2 }).set.markdown, /edit price/);
  assert.match(defaultsFor('depop', { ...line, daysLive: 8 }).set.markdown, /discount_price/);
});

test('Mercari: drops go through Promote and Smart Pricing stays off', () => {
  const { set } = defaultsFor('mercari', line);
  assert.match(set.markdown, /Promote/);
  assert.equal(set.smart_pricing, false);
});

test('Poshmark: Smart Sell minimum is always accept, and Offer to Likers carries the shipping note', () => {
  const r = defaultsFor('poshmark', line);
  assert.equal(r.set.smart_sell_min, 4000);
  assert.match(r.why.join(), /shipping discount/);
});

test('Facebook: nothing to set on offers; auto-reply on, boost off', () => {
  const { set, agent } = defaultsFor('facebook', line);
  assert.equal(set.availability_auto_reply, true);
  assert.equal(set.boost, false);
  assert.match(agent.join(), /no auto-accept/);
});

test('list price leaves room for offers per site, none on Facebook under $20', () => {
  assert.equal(listPrice('depop', 4000), 4700);
  assert.equal(listPrice('ebay', 4000), 4300);
  assert.equal(listPrice('facebook', 1500), 1500);
});

test('the lines must be ordered', () => {
  assert.throws(() => defaultsFor('ebay', { price: 5000, floor: 4500, alwaysAccept: 4000 }));
});

test('plan covers every posting site and never lists under always accept', () => {
  const rows = plan({ target: 4000, floor: 3000, alwaysAccept: 3800 });
  assert.deepEqual(rows.map(r => r.site), POSTING);
  for (const r of rows) assert.ok(r.price >= 3800);
});
