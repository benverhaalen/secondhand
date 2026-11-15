import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits, readPNG, pngChunks } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./frames/', import.meta.url));
const PINNED = { version: 1, sha256: 'f1a7bef95f8b06df12214c424468f4a67a2552dd9193bd05e025dad58b81d69c' };
const fx = JSON.parse(fs.readFileSync(`${dir}items.json`, 'utf8'));
const top = (s) => Object.entries(s).sort((a, b) => b[1] - a[1]);

test('hash pinned: a changed fixture needs a new version and a new pin', () => {
  assert.equal(fx.version, PINNED.version, 'version moved: update PINNED in this test with the new hash');
  assert.equal(dirHash(dir), PINNED.sha256, 'fixture bytes changed without a version bump');
});

test('no PII: no person, address, phone, token or location key; PNGs carry no metadata chunk', () => {
  for (const f of filesUnder(dir, '.json')) assert.deepEqual(piiHits(fs.readFileSync(f, 'utf8')), [], f);
  for (const f of filesUnder(dir, '.png')) {
    assert.deepEqual(pngChunks(fs.readFileSync(f)), ['IHDR', 'IDAT', 'IEND'], f);
    assert.ok(fs.statSync(f).size < 4096, `${f} stays a few KB`);
  }
});

test('no PII: the scan catches planted personal data', () => {
  for (const s of ['{"note":"call 555-123-4567"}', '{"note":"jo@example.com"}', '{"note":"12 Elm Street"}', '{"t":"ghp_abcdefghijklmnopqrstuvwx"}', '{"gps":1}'])
    assert.notDeepEqual(piiHits(s), [], s);
});

test('shape: 30 items, every family valid, a frame beside each, scores over the 14 families', () => {
  assert.equal(fx.items.length, 30);
  assert.equal(fx.families.length, 14);
  for (const it of fx.items) {
    assert.ok(fx.families.includes(it.confirmed_family), it.id);
    assert.deepEqual(Object.keys(it.class_scores).sort(), [...fx.families].sort(), it.id);
    assert.ok(readPNG(`${dir}${it.frame}`).w > 0, it.id);
  }
});

test('expected answers: preselect recomputes from the rule, swap from the pick', () => {
  for (const it of fx.items) {
    const [[a, sa], [, sb]] = top(it.class_scores);
    assert.equal(it.expected.preselect, sa >= fx.preselect.floor && sa - sb >= fx.preselect.margin ? a : null, it.id);
    assert.equal(it.expected.swap, it.expected.user_pick !== it.confirmed_family, it.id);
  }
});

test('capture suggestion proof: confirmed first on >= 27 of 30, wrongly preselected on <= 1, 10 wrong picks all swap, a right pick never swaps', () => {
  const firsts = fx.items.filter((it) => top(it.class_scores)[0][0] === it.confirmed_family).length;
  const wrongPre = fx.items.filter((it) => it.expected.preselect && it.expected.preselect !== it.confirmed_family).length;
  assert.ok(firsts >= 27, `confirmed first on ${firsts}`);
  assert.ok(wrongPre <= 1, `wrongly preselected on ${wrongPre}`);
  const wrong = fx.items.filter((it) => it.expected.user_pick !== it.confirmed_family);
  assert.equal(wrong.length, 10);
  assert.ok(wrong.every((it) => it.expected.swap));
  assert.ok(fx.items.filter((it) => it.expected.user_pick === it.confirmed_family).every((it) => !it.expected.swap));
});
