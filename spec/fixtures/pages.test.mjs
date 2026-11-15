import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./pages/', import.meta.url));
const d681c029e3fef3919c1597acb8990d3db7272ab4ffbb3e7c014dd54fc1e9efe6NED = { version: 1, sha256: 'd681c029e3fef3919c1597acb8990d3db7272ab4ffbb3e7c014dd54fc1e9efe6' };
const manifest = JSON.parse(fs.readFileSync(`${dir}manifest.json`, 'utf8'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(dir + f)).digest('hex');
const cents = (p) => Math.round(parseFloat(p.replace(/[^0-9.]/g, '')) * 100);
const unesc = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

// One regex per site: what each site's own page structure puts around title, price and link.
const EXTRACT = {
  ebay: [/<li class="s-item"><a class="s-item__link" href="([^"]+)"><div class="s-item__title">(.*?)<\/div><\/a><span class="s-item__price">(.*?)<\/span>/g, (m) => [m[1], m[2], m[3]]],
  facebook: [/<a href="(\/marketplace\/item\/[^"]+)"><span data-price>(.*?)<\/span><span data-title>(.*?)<\/span>/g, (m) => [m[1], m[3], m[2]]],
  mercari: [/<a href="([^"]+)"><p data-testid="ItemName">(.*?)<\/p><\/a><span data-testid="ItemPrice">(.*?)<\/span>/g, (m) => [m[1], m[2], m[3]]],
  depop: [/<a aria-label="(.*?)" href="([^"]+)"><\/a><p aria-description="Price">(.*?)<\/p>/g, (m) => [m[2], m[1], m[3]]],
  poshmark: [/<a href="([^"]+)" class="tile-grid-redesign__meta-link"><span class="tile-grid-redesign__title"> (.*?) <\/span><span class="tile-grid-redesign__price-current"> (.*?) <\/span>/g, (m) => [m[1], m[2], m[3]]],
};
export const extract = (site, html) => {
  const [re, pick] = EXTRACT[site];
  return [...html.matchAll(re)].map((m) => { const [url, title, price] = pick(m); return { url, title: unesc(title), price_cents: cents(price) }; });
};

test('hash pinned: a changed fixture needs a new version and a new pin', () => {
  assert.equal(manifest.version, d681c029e3fef3919c1597acb8990d3db7272ab4ffbb3e7c014dd54fc1e9efe6NED.version, 'version moved: update PINNED in this test with the new hash');
  for (const e of manifest.files) for (const [f, h] of Object.entries(e.sha256)) assert.equal(sha(f), h, `${f} changed without a manifest update`);
  assert.equal(dirHash(dir), d681c029e3fef3919c1597acb8990d3db7272ab4ffbb3e7c014dd54fc1e9efe6NED.sha256, 'fixture bytes changed without a version bump');
});

test('the five sites are present; each is marked recorded or synthetic, a recorded one with its URL and date', () => {
  assert.deepEqual(manifest.files.map((e) => e.site).sort(), ['depop', 'ebay', 'facebook', 'mercari', 'poshmark']);
  for (const e of manifest.files) {
    assert.ok(['recorded', 'synthetic'].includes(e.mode), e.site);
    if (e.mode === 'recorded') assert.ok(e.source_url && e.fetched_at, e.site);
  }
});

test('expected beside input: each page extracts to exactly its expected items', () => {
  for (const e of manifest.files) {
    const exp = JSON.parse(fs.readFileSync(dir + e.expected, 'utf8'));
    const got = extract(e.site, fs.readFileSync(dir + e.page, 'utf8'));
    assert.ok(got.length >= 6, `${e.site}: ${got.length} items`);
    assert.deepEqual(got, exp.items.map(({ url, title, price_cents }) => ({ url, title, price_cents })), e.site);
    for (const it of exp.items) assert.ok(it.id && Number.isInteger(it.price_cents) && it.price_cents > 0, `${e.site} ${it.id}`);
  }
});

test('no PII: no person, address, phone, token or location in any file', () => {
  for (const f of [...filesUnder(dir, '.json'), ...filesUnder(dir, '.html')]) assert.deepEqual(piiHits(fs.readFileSync(f, 'utf8')), [], f);
});

test('no PII: a recorded page carries no seller handle, only its hash', () => {
  const depop = fs.readFileSync(`${dir}depop.html`, 'utf8');
  for (const m of depop.matchAll(/href="\/products\/([^"/]+)\//g)) assert.match(m[1], /^h[0-9a-f]{8}-/, m[1]);
  assert.doesNotMatch(depop, /cavip15/);
});

test('no PII: the scan catches planted personal data', () => {
  for (const s of ['<p>call 555-123-4567</p>', 'jo@example.com', '12 Elm Street', 'ghp_abcdefghijklmnopqrstuvwx', '"gps":1'])
    assert.notDeepEqual(piiHits(s), [], s);
});

test('extractor fails loudly on a changed page structure', () => {
  assert.deepEqual(extract('ebay', '<div>other markup</div>'), []);
});
