// Writes cases.json and one mask PNG per case (255 inside the item, 0 outside). Run once; the test pins the result.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../frames/lib.mjs';

const dir = fileURLToPath(new URL('./', import.meta.url));
const W = 300, H = 400, SIDE = 300, MARGIN = 6; // 3:4 frame; the square is the width; 2% of the square side
const GRAILED_H = 375; // 4:5 at the square's width
// [name, [x0, y0, x1, y1) box]
const BOXES = [
  ['inside the centred square', [90, 120, 210, 280]],
  ['high, the square slides up', [80, 20, 220, 200]],
  ['low, the square slides down', [80, 220, 220, 390]],
  ['tight at the top, slides to the top edge', [60, 6, 240, 250]],
  ['tight at the bottom, slides to the bottom edge', [60, 150, 240, 394]],
  ['fills the square exactly less margin', [6, 56, 294, 344]],
  ['too tall, no square holds it', [100, 5, 200, 395]],
  ['too wide, margin breaks on the sides', [2, 150, 298, 250]],
  ['thin sliver', [148, 190, 152, 210]],
];

// The rule (agent proposal for the exact numbers; the order is the photo engine's): slide the square the least that holds the box with the margin.
function crops([x0, y0, x1, y1]) {
  const lo = Math.max(0, y1 + MARGIN - SIDE), hi = Math.min(H - SIDE, y0 - MARGIN), mid = (H - SIDE) / 2;
  const sideOk = x0 >= MARGIN && x1 <= W - MARGIN;
  if (!sideOk || lo > hi) return { item_cut: true, square: null, poshmark: [0, 0, W, H], grailed: null };
  const s = Math.min(hi, Math.max(lo, mid));
  const g = Math.min(H - GRAILED_H, Math.max(0, Math.floor(s + SIDE / 2 - GRAILED_H / 2)));
  return { item_cut: false, square: [0, s, W, s + SIDE], poshmark: [0, 0, W, H], grailed: [0, g, W, g + GRAILED_H] };
}

const cases = BOXES.map(([name, box], i) => {
  const data = new Uint8Array(W * H);
  for (let y = box[1]; y < box[3]; y++) data.fill(255, y * W + box[0], y * W + box[2]);
  const mask = `mask-${String(i).padStart(2, '0')}.png`;
  fs.writeFileSync(`${dir}${mask}`, encodePNG({ w: W, h: H, ch: 1, data }));
  return { id: `case-${i}`, name, mask, expected: { box, ...crops(box) } };
});
fs.writeFileSync(`${dir}cases.json`, JSON.stringify({ version: 1, note: 'masks are synthetic filled boxes; rects are [x0, y0, x1, y1) in frame pixels; item_cut means no square holds the box, so the photo is never padded', frame: { w: W, h: H }, square_side: SIDE, margin_px: MARGIN, grailed_h: GRAILED_H, cases }, null, 1) + '\n');
