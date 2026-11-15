// What the board and hero checks measure on a page that moves. Shared by render.mjs and ../hero/check.mjs.

// Every running animation is paused at one moment, so a still or a measurement is the same on every run.
export const seek = (page, ms) => page.evaluate(t => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, ms);

// What moves and how: the animated properties, the fastest speed in px/s, and how much of the first screen shows clothing.
export const motionFacts = () => {
  // Only what moves behind the line; the field's own drift (C2) is the same on every variant.
  const anims = document.getAnimations().filter(a => a.effect.target.closest('.ambient') && !a.effect.target.matches('.field-card')), props = new Set();
  for (const a of anims) for (const k of a.effect.getKeyframes()) for (const p of Object.keys(k)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p);
  let fastest = 0;
  for (const a of anims) { const el = a.effect.target, t = a.currentTime, r1 = el.getBoundingClientRect(); a.currentTime = t + 1000; const r2 = el.getBoundingClientRect(); a.currentTime = t;
    fastest = Math.max(fastest, Math.hypot(r2.x - r1.x, r2.y - r1.y)); }
  // How much of the first screen shows clothing: a 40 by 80 grid of points, each asking what is drawn there.
  let hits = 0, n = 0;
  for (let i = 0; i < 40; i++) for (let j = 0; j < 80; j++) { n++;
    const el = document.elementsFromPoint((i + .5) * innerWidth / 40, (j + .5) * innerHeight / 80).find(e => e.closest('.ambient') && (e.tagName === 'IMG' || e.tagName === 'path'));
    if (el) hits++; }
  return { animated: [...props].sort(), compositor_only: [...props].every(p => p === 'transform' || p === 'opacity'), fastest_px_s: Math.round(fastest), clothing_share: +(hits / n).toFixed(2) };
};

// The worst contrast between the text and whatever passes behind it, over one minute: the text is hidden, the ground under
// each text box is read pixel by pixel at six moments, and the lowest ratio against the text color is kept.
export const contrastFloor = async (page, { at = [0, 12000, 24000, 36000, 48000, 60000], move, text = 'h1, .lead' } = {}) => {
  const boxes = await page.evaluate(sel => [...document.querySelectorAll(sel)].map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e).color; e.dataset.ink = c; return { x: r.x, y: r.y, width: r.width, height: r.height, ink: c }; }).filter(b => b.width > 0 && b.y >= 0 && b.y + b.height <= innerHeight), text);
  await page.addStyleTag({ content: `${text} { color: transparent !important; }` });
  let floor = Infinity;
  for (const t of at) {
    if (move) await move(page, t); else await seek(page, t);
    for (const b of boxes) {
      const png = (await page.screenshot({ clip: { x: b.x, y: b.y, width: b.width, height: b.height } })).toString('base64');
      const r = await page.evaluate(async ({ png, ink }) => {
        const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d');
        x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, img.width, img.height).data;
        const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4, L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const [ir, ig, ib] = ink.match(/[\d.]+/g).map(Number), li = L(ir, ig, ib); let worst = Infinity;
        for (let i = 0; i < d.length; i += 4) { const lb = L(d[i], d[i + 1], d[i + 2]); worst = Math.min(worst, (Math.max(li, lb) + 0.05) / (Math.min(li, lb) + 0.05)); }
        return worst;
      }, { png, ink: b.ink });
      floor = Math.min(floor, r);
    }
  }
  return +floor.toFixed(2);
};

