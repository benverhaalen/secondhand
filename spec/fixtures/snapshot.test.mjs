import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./snapshot/', import.meta.url));
const PINNED = { version: 2, sha256: 'b9c638f0ac558e574c3645e47dd058b564ed96a95114cfc4c5bdb19af8fb990b' };
const manifest = JSON.parse(fs.readFileSync(`${dir}manifest.json`, 'utf8'));
const SITES = ['ebay', 'facebook', 'depop', 'poshmark', 'mercari'];
const SECTIONS = ['listings', 'offers', 'messages', 'orders', 'notifications'];
const read = (p) => JSON.parse(fs.readFileSync(dir + p, 'utf8'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(dir + f)).digest('hex');

// Reference reading of the Snapshot type: a section absent from either side is skipped, never "all gone".
const key = { listings: (x) => x.external_id, offers: (x) => x.external_id, messages: (x) => x.external_id, orders: (x) => x.external_order_id, notifications: (x) => x.external_id };
export function diff(a, b) {
  const out = [];
  const by = (s, snap) => new Map((snap[s] ?? []).map((x) => [key[s](x), x]));
  if (a.listings && b.listings) {
    const A = by('listings', a);
    for (const [id, n] of by('listings', b)) {
      const o = A.get(id);
      if (!o) continue;
      if (o.price_cents !== n.price_cents) out.push({ action: 'price.changed', ref: id, listing_external_id: id, payload: { from_cents: o.price_cents, to_cents: n.price_cents } });
      if (o.state !== n.state && n.state === 'sold') out.push({ action: 'listing.sold', ref: id, listing_external_id: id, payload: {} });
      if (o.state !== n.state && n.state === 'ended') out.push({ action: 'listing.ended', ref: id, listing_external_id: id, payload: {} });
      if (n.likes > o.likes) out.push({ action: 'like.added', ref: id, listing_external_id: id, payload: { from: o.likes, to: n.likes } });
    }
  }
  if (a.offers && b.offers) { const A = by('offers', a); for (const [id, n] of by('offers', b)) if (!A.has(id)) out.push({ action: 'offer.received', ref: id, listing_external_id: n.listing_external_id, payload: { amount_cents: n.amount_cents } }); }
  if (a.messages && b.messages) { const A = by('messages', a); for (const [id, n] of by('messages', b)) if (!A.has(id)) out.push({ action: 'message.received', ref: id, listing_external_id: n.listing_external_id, payload: { thread_ref: n.thread_ref } }); }
  if (a.orders && b.orders) { const A = by('orders', a); for (const [id, n] of by('orders', b)) if (!A.has(id) || A.get(id).state !== n.state) out.push({ action: 'order.updated', ref: id, listing_external_id: n.listing_external_id, payload: { state: n.state, price_cents: n.price_cents } }); }
  const rank = (c) => ['price.changed', 'listing.sold', 'like.added', 'listing.ended', 'offer.received', 'message.received', 'order.updated'].indexOf(c.action);
  return out.sort((x, y) => rank(x) - rank(y));
}

test('hash pinned: a changed fixture needs a new version and a new pin', () => {
  assert.equal(manifest.version, PINNED.version, 'version moved: update PINNED with the new hash');
  for (const [f, h] of Object.entries(manifest.sha256)) assert.equal(sha(f), h, `${f} changed without a manifest update`);
  assert.equal(dirHash(dir), PINNED.sha256, 'fixture bytes changed: bump version and re-pin');
});

test('every site has base, reordered, changed, public, the raw page and json, and the expected answer', () => {
  for (const s of SITES) for (const f of ['base', 'reordered', 'changed', 'public', 'expected'].map((x) => `${s}/${x}.json`).concat([`${s}/listings.page.html`, `${s}/listings.raw.json`])) assert.ok(fs.existsSync(dir + f), f);
});

test('each snapshot matches the Snapshot type: sections read are arrays, sections not read are absent', () => {
  for (const s of SITES) for (const n of ['base', 'reordered', 'changed', 'public']) {
    const x = read(`${s}/${n}.json`);
    assert.equal(x.site, s);
    assert.match(x.taken_at, /^\d{4}-\d\d-\d\dT[\d:]+Z$/);
    assert.ok(['signed_in', 'public'].includes(x.route));
    for (const sec of SECTIONS) if (sec in x) assert.ok(Array.isArray(x[sec]), `${s}/${n} ${sec}`);
  }
  for (const s of SITES) {
    const p = read(`${s}/public.json`);
    for (const sec of SECTIONS.filter((c) => c !== 'listings')) assert.ok(!(sec in p), `public ${sec} was not read, so it must be absent`);
    assert.deepEqual(read(`${s}/base.json`).orders, [], 'read and found nothing is an empty array');
  }
});

test('expected answer beside the input: reordered gives no change, changed gives the typed changes, public gives none', () => {
  for (const s of SITES) for (const p of read(`${s}/expected.json`).pairs) {
    assert.deepEqual(diff(read(`${s}/${p.from}`), read(`${s}/${p.to}`)), p.changes, `${s} ${p.from} -> ${p.to}`);
  }
  for (const s of SITES) assert.equal(read(`${s}/expected.json`).pairs[1].changes.length, 7);
});

test('the raw page and json carry the same listings as base, in the site own status words', () => {
  for (const s of SITES) {
    const base = read(`${s}/base.json`).listings, w = manifest.status_words[s];
    const html = fs.readFileSync(`${dir}${s}/listings.page.html`, 'utf8');
    const rows = [...html.matchAll(/data-ext-id="([^"]+)" data-state="([^"]+)"><span class="price">\$([\d.]+)<\/span>/g)];
    assert.deepEqual(rows.map((m) => [m[1], m[2], Math.round(m[3] * 100)]), base.map((l) => [l.external_id, w[l.state], l.price_cents]));
    const raw = read(`${s}/listings.raw.json`).items;
    assert.deepEqual(raw.map((i) => [i.id, i.status, i.price.amount]), base.map((l) => [l.external_id, w[l.state], l.price_cents]));
  }
});

test('no PII: no email, phone, street, token or location in any file; buyers are hashes', () => {
  for (const f of filesUnder(dir, '.json').concat(filesUnder(dir, '.html'))) assert.deepEqual(piiHits(fs.readFileSync(f, 'utf8')), [], f);
  for (const s of SITES) for (const o of read(`${s}/base.json`).offers) assert.match(o.buyer_ref_hash, /^[0-9a-f]{12}$/);
});

test('planted PII is caught', () => {
  assert.ok(piiHits('{"buyer":"jane.doe@example.com"}').includes('email'));
  assert.ok(piiHits('ship to 42 Maple Street').length > 0);
});
