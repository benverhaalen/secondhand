// Writes items.json and the 30 first-frame PNGs. Run once; the test pins the result.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './lib.mjs';

const dir = fileURLToPath(new URL('./', import.meta.url));
const FAMILIES = ['apparel', 'shoes', 'bags', 'jewellery_watches', 'furniture', 'lighting_home', 'electronics', 'appliances_tools', 'media', 'cards_collectibles', 'toys_lego', 'bikes_sports', 'baby_gear', 'other'];
const MARGIN = 0.2, FLOOR = 0.5; // assist_preselect_margin and the top-score floor
// [top score, second score] for the 30 items; the first 28 have the confirmed family on top.
const TS = [[.8,.1],[.7,.2],[.9,.05],[.6,.2],[.55,.3],[.85,.1],[.75,.15],[.65,.2],[.95,.02],[.5,.25],[.45,.3],[.8,.12],[.7,.1],[.6,.35],[.9,.06],[.52,.3],[.78,.1],[.66,.2],[.88,.07],[.58,.2],[.72,.18],[.83,.1],[.4,.3],[.69,.2],[.77,.1],[.62,.2],[.92,.04],[.55,.2],[.35,.3],[.7,.12]];
const WRONG = new Set([2, 5, 8, 11, 14, 17, 20, 23, 26, 29]); // 10 wrong picks on purpose

const items = TS.map(([top, second], i) => {
  const confirmed = FAMILIES[i % 14];
  const wrongTop = FAMILIES[(i + 5) % 14];
  // 28: confirmed second behind a close wrong top (no preselect); 29: confirmed second behind a clear wrong top (the one wrong preselect).
  const first = i < 28 ? confirmed : wrongTop;
  const sec = i < 28 ? FAMILIES[(i + 3) % 14] : confirmed;
  const others = FAMILIES.filter((f) => f !== first && f !== sec);
  const rest = Math.round((1 - top - second) / others.length * 1e4) / 1e4;
  const class_scores = Object.fromEntries(FAMILIES.map((f) => [f, f === first ? top : f === sec ? second : rest]));
  const preselect = top >= FLOOR && top - second >= MARGIN ? first : null;
  const pick = WRONG.has(i) ? FAMILIES[(i + 7) % 14] : confirmed;
  const w = 24, h = 32, data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inside = x >= 4 && x < 20 && y >= 6 && y < 26;
    const c = inside ? [40 + (i % 14) * 16, 200 - (i % 14) * 8, 90 + (i % 5) * 30] : [235, 235, 235];
    data.set(c, (y * w + x) * 3);
  }
  const frame = `frame-${String(i).padStart(2, '0')}.png`;
  fs.writeFileSync(`${dir}${frame}`, encodePNG({ w, h, ch: 3, data }));
  return { id: `item-${String(i).padStart(2, '0')}`, frame, confirmed_family: confirmed, class_scores, expected: { preselect, user_pick: pick, swap: pick !== confirmed } };
});
fs.writeFileSync(`${dir}items.json`, JSON.stringify({ version: 1, note: 'synthetic frames: a coloured block on grey; the answers are the confirmed family, the preselect rule (top >= 0.5, margin >= 0.2) and the swap on a wrong pick', families: FAMILIES, preselect: { floor: FLOOR, margin: MARGIN }, items }, null, 1) + '\n');
