import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirHash, filesUnder, piiHits, readPNG, pngChunks } from './frames/lib.mjs';

const dir = fileURLToPath(new URL('./mask/', import.meta.url));
const PINNED = { version: 1, sha256: '8717ab90791c38ff3b0376c640571836e0e3c926d096ff6222a20e4f3f717c54' };
const fx = JSON.parse(fs.readFileSync(`${dir}cases.json`, 'utf8'));
const { w: W, h: H } = fx.frame, SIDE = fx.square_side, M = fx.margin_px;

function boxOf(file) {
  const { w, h, data } = readPNG(file);
  let [x0, y0, x1, y1] = [w, h, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  return [x0, y0, x1, y1];
}

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

test('expected answers: the box is what the mask draws', () => {
  for (const c of fx.cases) assert.deepEqual(boxOf(`${dir}${c.mask}`), c.expected.box, c.id);
});

test('expected answers: the square holds the box with the margin, slid the least; item_cut only when none can; never padded', () => {
  for (const c of fx.cases) {
    const [x0, y0, x1, y1] = c.expected.box, e = c.expected;
    const fits = (s) => x0 >= M && x1 <= W - M && y0 - M >= s && y1 + M <= s + SIDE;
    const ok = Array.from({ length: H - SIDE + 1 }, (_, s) => s).filter(fits);
    assert.equal(e.item_cut, ok.length === 0, c.id);
    assert.deepEqual(e.poshmark, [0, 0, W, H], c.id);
    if (e.item_cut) { assert.equal(e.square, null); assert.equal(e.grailed, null); continue; }
    const centre = (H - SIDE) / 2, best = ok.reduce((a, b) => Math.abs(b - centre) < Math.abs(a - centre) ? b : a);
    assert.deepEqual(e.square, [0, best, W, best + SIDE], c.id);
    const [gx0, gy0, gx1, gy1] = e.grailed;
    assert.equal((gx1 - gx0) * 5, (gy1 - gy0) * 4, `${c.id} grailed is 4:5`);
    assert.ok(gy0 >= 0 && gy1 <= H, `${c.id} grailed stays inside the frame, no padding`);
    assert.ok(Math.abs((gy0 + gy1) / 2 - (best + SIDE / 2)) <= 12.5 || gy0 === 0 || gy1 === H, `${c.id} grailed centred on the square`);
  }
  assert.ok(fx.cases.some((c) => c.expected.item_cut) && fx.cases.some((c) => !c.expected.item_cut));
});

test('the check has teeth: a square that clips the box is caught', () => {
  const c = fx.cases[1], [, y0] = c.expected.box;
  assert.ok(!(y0 - M >= 50), 'the centred square (y 50) would clip case-1, so it must slide');
});
