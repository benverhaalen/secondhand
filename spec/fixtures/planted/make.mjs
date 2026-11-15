// Writes cases.json and the PNGs: 10 base photos, 100 planted edits that must block, 10 clean edits that must not, 15 level-0 outputs.
// A photo is 112x48: a grey background, an item block, a dark flaw disc, and a tag strip where each character is 8 px wide and each bit of its code is a column of 4 bright pixels.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../frames/lib.mjs';

const dir = fileURLToPath(new URL('./', import.meta.url));
const W = 112, H = 48, TAG_Y = 38, BG = [200, 200, 200], FLAW = [40, 40, 40], BRIGHT = [250, 250, 250], DARK = [20, 20, 20];
const TAGS = ['SIZE M 100%COT', 'SIZE L 80%WOOL', 'SIZE 42 EU LEA', 'SIZE S 95%POLY', 'MODEL X1 2019 '];
const ITEM = [[90, 60, 140], [60, 120, 90], [150, 90, 60], [70, 90, 160], [130, 130, 60]];

const px = (img, x, y, c) => img.data.set(c, (y * W + x) * 3);
const get = (img, x, y) => Array.from(img.data.subarray((y * W + x) * 3, (y * W + x) * 3 + 3));
function drawChar(img, i, ch) {
  for (let b = 0; b < 8; b++) for (let r = 0; r < 4; r++) for (let k = 0; k < 1; k++) px(img, i * 8 + b, TAG_Y + r, (ch.charCodeAt(0) >> b) & 1 ? BRIGHT : DARK);
}
function base(b) {
  const img = { w: W, h: H, ch: 3, data: new Uint8Array(W * H * 3) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px(img, x, y, y >= TAG_Y ? DARK : x >= 8 && x < 104 && y >= 4 && y < 34 ? ITEM[b % 5] : BG);
  const flaw = { x0: 20 + (b % 5) * 12, y0: 10 + (b % 3) * 6, x1: 0, y1: 0 };
  flaw.x1 = flaw.x0 + 8; flaw.y1 = flaw.y0 + 8;
  for (let y = flaw.y0; y < flaw.y1; y++) for (let x = flaw.x0; x < flaw.x1; x++) px(img, x, y, FLAW);
  const tag = TAGS[b % 5];
  [...tag].forEach((ch, i) => drawChar(img, i, ch));
  return { img, flaw, tag };
}
const save = (name, img) => fs.writeFileSync(`${dir}${name}`, encodePNG(img));
const clone = (img) => ({ ...img, data: new Uint8Array(img.data) });
const bases = Array.from({ length: 10 }, (_, b) => base(b));
bases.forEach((b, i) => save(`base-${i}.png`, b.img));

const planted = [], clean = [];
for (let i = 0; i < 100; i++) {
  const bi = i % 10, { img, flaw, tag } = bases[bi], out = clone(img);
  if (i < 50) {
    for (let y = flaw.y0; y < flaw.y1; y++) for (let x = flaw.x0; x < flaw.x1; x++) px(out, x, y, ITEM[bi % 5]);
    planted.push({ id: `planted-${String(i).padStart(3, '0')}`, base: `base-${bi}.png`, edited: `planted-${String(i).padStart(3, '0')}.png`, change: 'vanished_flaw', expected: { block: true, reason: 'flaw_vanished' } });
  } else {
    const at = i % tag.length, to = String.fromCharCode(tag.charCodeAt(at) ^ (1 << (i % 5)));
    drawChar(out, at, to);
    planted.push({ id: `planted-${String(i).padStart(3, '0')}`, base: `base-${bi}.png`, edited: `planted-${String(i).padStart(3, '0')}.png`, change: 'changed_tag_text', expected: { block: true, reason: 'tag_text_changed' } });
  }
  save(`planted-${String(i).padStart(3, '0')}.png`, out);
}
// Clean edits: a colour shift on the item block only; flaw and tag untouched. They must not block.
for (let i = 0; i < 10; i++) {
  const { img, flaw } = bases[i], out = clone(img);
  for (let y = 4; y < 34; y++) for (let x = 8; x < 104; x++) {
    const inFlaw = x >= flaw.x0 - 1 && x < flaw.x1 + 1 && y >= flaw.y0 - 1 && y < flaw.y1 + 1;
    if (!inFlaw) { const c = get(img, x, y); px(out, x, y, c.map((v) => Math.min(255, v + 6))); }
  }
  save(`clean-${i}.png`, out);
  clean.push({ id: `clean-${i}`, base: `base-${i}.png`, edited: `clean-${i}.png`, change: 'item_colour_nudge', expected: { block: false } });
}
// Level 0 outputs: a per-channel gain in percent over the whole frame. Violating outputs also paint a 6x6 patch.
const level0 = [];
for (let i = 0; i < 15; i++) {
  const { img } = bases[i % 10], gain = [100 + (i % 4) * 5, 100, 100 - (i % 3) * 4], out = clone(img);
  for (let p = 0; p < W * H; p++) for (let c = 0; c < 3; c++) out.data[p * 3 + c] = Math.min(255, Math.round((img.data[p * 3 + c] * gain[c]) / 100));
  const violates = i >= 10;
  if (violates) for (let y = 14; y < 20; y++) for (let x = 60; x < 66; x++) px(out, x, y, [255, 0, 255]);
  save(`level0-${String(i).padStart(2, '0')}.png`, out);
  level0.push({ id: `level0-${String(i).padStart(2, '0')}`, base: `base-${i % 10}.png`, output: `level0-${String(i).padStart(2, '0')}.png`, transform: { gain_percent: gain }, expected: { differs_outside_transform: violates } });
}
fs.writeFileSync(`${dir}cases.json`, JSON.stringify({
  version: 1,
  note: 'synthetic photos: a grey frame, a block, a dark flaw disc, a tag strip of 8 px cells whose columns are the bits of each character; a gate blocks when the flaw box loses its dark pixels or the decoded tag text moves',
  frame: { w: W, h: H }, tag_strip: { y: TAG_Y, cell: 8, chars: 14 }, flaw_dark_max: 45,
  bases: bases.map((b, i) => ({ file: `base-${i}.png`, flaw_box: [b.flaw.x0, b.flaw.y0, b.flaw.x1, b.flaw.y1], tag_text: b.tag })),
  planted, clean, level0,
}, null, 1) + '\n');
