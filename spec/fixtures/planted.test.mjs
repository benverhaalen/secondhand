import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits, readPNG, pngChunks } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./planted/', import.meta.url));
const PINNED = { version: 1, sha256: '1adf7a4eccb348cfd824ee14fb392b331e84c8002659bed72168927c9ce4a7b4' };
const fx = JSON.parse(fs.readFileSync(`${dir}cases.json`, 'utf8'));
const { w: W } = fx.frame, { y: TAG_Y, cell: CELL, chars: N } = fx.tag_strip;
const baseOf = (file) => fx.bases.find((b) => b.file === file);

// A reference gate: the flaw box keeps a dark pixel, and the tag strip decodes to the same text.
const flawKept = (img, [x0, y0, x1, y1]) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (img.data[(y * W + x) * 3] <= fx.flaw_dark_max) return true; return false; };
const tagText = (img) => Array.from({ length: N }, (_, i) => String.fromCharCode([...Array(8).keys()].reduce((v, b) => v | ((img.data[(TAG_Y * W + i * CELL + b) * 3] > 128 ? 1 : 0) << b), 0))).join('');
const blocks = (baseFile, edited) => { const b = baseOf(baseFile), img = readPNG(`${dir}${edited}`); return !flawKept(img, b.flaw_box) || tagText(img) !== b.tag_text; };

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

test('the bases pass their own gate', () => {
  for (const b of fx.bases) assert.equal(blocks(b.file, b.file), false, b.file);
});

test('expected answers: all 100 planted vanished flaws and changed tag texts block; the clean edits do not', () => {
  assert.equal(fx.planted.length, 100);
  assert.equal(fx.planted.filter((p) => p.change === 'vanished_flaw').length, 50);
  assert.equal(fx.planted.filter((p) => p.change === 'changed_tag_text').length, 50);
  for (const p of fx.planted) { assert.equal(p.expected.block, true); assert.equal(blocks(p.base, p.edited), true, p.id); }
  assert.ok(fx.clean.length >= 10);
  for (const c of fx.clean) { assert.equal(c.expected.block, false); assert.equal(blocks(c.base, c.edited), false, c.id); }
});

test('expected answers: level 0 differs from its input only by the transform, and a planted patch is caught', () => {
  const diffs = (l) => {
    const a = readPNG(`${dir}${l.base}`), o = readPNG(`${dir}${l.output}`), g = l.transform.gain_percent;
    let n = 0;
    for (let i = 0; i < a.data.length; i++) if (o.data[i] !== Math.min(255, Math.round((a.data[i] * g[i % 3]) / 100))) n++;
    return n;
  };
  assert.ok(fx.level0.filter((l) => !l.expected.differs_outside_transform).length >= 10);
  assert.ok(fx.level0.some((l) => l.expected.differs_outside_transform));
  for (const l of fx.level0) assert.equal(diffs(l) > 0, l.expected.differs_outside_transform, l.id);
});
