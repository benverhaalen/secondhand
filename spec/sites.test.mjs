import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SITES, FACTS, fact, known, offerExpiresAt, afterAccept, sellerOffer, exposedUntil, unconfirmed } from './sites.mjs';

const at = iso => new Date(iso);
const HOUR = 3600e3;

test('every fact covers every site, with a mark and a source', () => {
  for (const [key, row] of Object.entries(FACTS)) for (const site of SITES) {
    const f = row[site];
    assert.ok(f, `${key} has no entry for ${site}: write the value, null for "the site has no such thing", or UNKNOWN`);
    assert.match(f.mark, /^(observed|asserted|inferred)$/, `${key}.${site}`);
    assert.ok(f.src, `${key}.${site} has no source`);
  }
});

test('a fact nobody has confirmed stops the caller instead of handing back a guess', () => {
  assert.throws(() => fact('offer.buyer.expires_h', 'facebook_shipped'), /no fact/);
  assert.throws(() => fact('offer.seller.expires_h', 'poshmark'), /not known/);
  assert.equal(known('offer.seller.expires_h', 'poshmark'), false);
  assert.throws(() => fact('offer.buyer.expires_hours', 'depop'), /no fact/);
});

test('offer clocks come from the site, not from a default', () => {
  const sent = at('2026-11-15T10:00:00Z');
  assert.equal(+offerExpiresAt('depop', 'buyer', sent), +sent + 24 * HOUR);
  assert.equal(+offerExpiresAt('ebay', 'buyer', sent), +sent + 24 * HOUR);
  assert.equal(+offerExpiresAt('ebay', 'counter', sent), +sent + 96 * HOUR);
  assert.equal(+offerExpiresAt('ebay', 'seller', sent), +sent + 96 * HOUR);
  assert.equal(+offerExpiresAt('mercari', 'seller', sent), +sent + 24 * HOUR);
  assert.equal(offerExpiresAt('facebook', 'buyer', sent), null, 'a chat offer has no clock');
});

test('changing one fact moves every clock that reads it', () => {
  const sent = at('2026-11-15T10:00:00Z'), was = FACTS['offer.buyer.expires_h'].depop.v;
  FACTS['offer.buyer.expires_h'].depop.v = 48;
  try { assert.equal(+offerExpiresAt('depop', 'buyer', sent), +sent + 48 * HOUR); } finally { FACTS['offer.buyer.expires_h'].depop.v = was; }
});

test('accepting an offer is a sale on some sites and only a promise on others', () => {
  // Poshmark and Mercari charge the buyer at acceptance: the other listings must come down now.
  assert.deepEqual(afterAccept('poshmark'), { sale: true, pay_within_h: null, delist_others: true });
  assert.deepEqual(afterAccept('mercari'), { sale: true, pay_within_h: null, delist_others: true });
  // Depop: the buyer has 24 hours to pay and anyone else can still buy it. Pulling the other listings now could lose the sale twice.
  assert.deepEqual(afterAccept('depop'), { sale: false, pay_within_h: 24, delist_others: false });
  assert.deepEqual(afterAccept('facebook'), { sale: false, pay_within_h: null, delist_others: false });
});

test('an offer we send must meet the site\'s floor, its wait, and must not bind an item promised elsewhere', () => {
  const now = at('2026-11-15T10:00:00Z');
  const base = { list_cents: 5000, lowest_cents: 5000, now };
  assert.equal(sellerOffer('mercari', { ...base, offer_cents: 4500 }).ok, true);
  assert.match(sellerOffer('mercari', { ...base, offer_cents: 4600 }).why, /10%/);
  assert.match(sellerOffer('mercari', { ...base, lowest_cents: 4500, offer_cents: 4200 }).why, /lowest/);
  assert.match(sellerOffer('mercari', { ...base, offer_cents: 4500, last_sent_at: at('2026-11-13T10:00:00Z') }).why, /72 hours/);
  assert.equal(sellerOffer('ebay', { ...base, offer_cents: 4750 }).ok, true);
  assert.match(sellerOffer('ebay', { ...base, offer_cents: 4750, last_sent_at: at('2026-11-14T10:00:00Z') }).why, /48 hours/);
  // Mercari's offer binds us for 24 hours if a liker accepts. With a sale in progress elsewhere that is a double sale waiting to happen.
  assert.match(sellerOffer('mercari', { ...base, offer_cents: 4500, promised_elsewhere: true }).why, /promised/);
  assert.equal(sellerOffer('depop', { ...base, offer_cents: 4750, promised_elsewhere: true }).ok, true, 'a Depop offer binds nobody');
  assert.match(sellerOffer('facebook', { ...base, offer_cents: 4500 }).why, /no offers/);
});

test('after a sale elsewhere, an open binding offer keeps the item sellable until it lapses', () => {
  const sent = at('2026-11-15T10:00:00Z');
  assert.equal(+exposedUntil('mercari', [{ sent_at: sent }]), +sent + 24 * HOUR);
  assert.equal(+exposedUntil('ebay', [{ sent_at: sent }, { sent_at: at('2026-11-15T12:00:00Z') }]), +at('2026-11-15T12:00:00Z') + 96 * HOUR);
  assert.equal(exposedUntil('depop', [{ sent_at: sent }]), null);
  assert.equal(exposedUntil('mercari', []), null);
});

test('facts that rest on memory are listed, so an adapter reads the live page before it relies on one', () => {
  const list = unconfirmed().map(u => `${u.key}.${u.site}`);
  assert.ok(list.includes('offer.buyer.expires_h.poshmark'));
  assert.ok(!list.includes('offer.buyer.expires_h.depop'));
});

test('no product code carries its own copy of an offer clock', () => {
  const files = execFileSync('git', ['ls-files', 'app/src', 'scripts', 'log'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).split('\n')
    .filter(f => /\.(tsx?|mjs|js|py)$/.test(f) && !/\.test\./.test(f));
  for (const f of files) readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split('\n').forEach((line, i) =>
    assert.ok(!(/offer/i.test(line) && /\b(24|48|72|96)\b/.test(line)), `${f}:${i + 1} holds an offer clock; read it from spec/sites.mjs`));
});
