#!/usr/bin/env node
// Renders a board of website section variants in the brand faces and audits each one.
//   node brand/explore/web-home/boards/render.mjs <board folder> [...]
// Each variant (<id>.html, listed in board.json) is drawn at 1440 x 900 and 390 x 844, first screen only, with the
// faces from BRAND_FONTS (or fonts/) injected, and checked with scripts/brand-check.mjs on the web medium.
// Writes <board>/out/<id>-1440.png, <id>-390.png, audit.json and board.png (the variants side by side, captioned).
// The board page embeds the licensed faces, so it is drawn from a temp folder and never written into the repo.
// A board with "motion": true is drawn with its animations running and paused at 30 s, and each variant also gets a
// motion audit (what animates, how fast, the text contrast at its worst moment, how much of the screen shows clothing,
// whether Reduce Motion stops it) and a 6 s recording, <id>-<w>.mp4, plus board-phone.mp4 with the phones side by side.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brandFaces, check, playwright } from '../../../../scripts/brand-check.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const tokens = readFileSync(join(root, 'brand/tokens.css'), 'utf8');
const faces = brandFaces(tokens);
if (!faces) console.warn('warn: the brand faces are not here, so these renders use a fallback face. Set BRAND_FONTS.');
const pw = playwright(); if (!pw) throw new Error('Playwright is not installed here');
const browser = await pw.chromium.launch();

// What a visitor gets from the first screen, measured on the page.
const firstScreen = () => {
  const vh = innerHeight, vis = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh && r.width > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  const words = [...document.querySelectorAll('h1, h2, p, a, button, span, li')].filter(e => vis(e) && !e.children.length).map(e => e.textContent.trim()).join(' ').split(/\s+/).filter(Boolean).length;
  const pill = [...document.querySelectorAll('.pill.glow, .pill')].find(vis), h1 = document.querySelector('h1');
  const photos = [...document.querySelectorAll('img')].filter(i => vis(i) && i.getBoundingClientRect().width > 120).length;
  return { words, pill_y: pill ? Math.round(pill.getBoundingClientRect().top) : null, headline_lines: h1 ? Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)) : null, photos,
    fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight}`) };
};

// Every running animation is paused at one moment, so a still or a measurement is the same on every run.
const seek = (page, ms) => page.evaluate(t => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, ms);

// What moves and how: the animated properties, the fastest speed in px/s, and how much of the first screen shows clothing.
const motionFacts = () => {
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
const contrastFloor = async page => {
  const boxes = await page.evaluate(() => [...document.querySelectorAll('h1, .lead')].map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e).color; e.dataset.ink = c; return { x: r.x, y: r.y, width: r.width, height: r.height, ink: c }; }));
  await page.addStyleTag({ content: 'h1, .lead { color: transparent !important; }' });
  let floor = Infinity;
  for (const t of [0, 12000, 24000, 36000, 48000, 60000]) {
    await seek(page, t);
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

for (const dir of process.argv.slice(2).map(d => resolve(d))) {
  const board = JSON.parse(readFileSync(join(dir, 'board.json'), 'utf8')), out = join(dir, 'out'); mkdirSync(out, { recursive: true });
  const audit = { board: board.title, question: board.question, faces: !!faces, variants: [] };
  for (const v of board.variants) {
    const file = join(dir, `${v.id}.html`), row = { id: v.id, label: v.label };
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const open = async (opts = {}) => {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: board.motion ? 'no-preference' : 'reduce', ...opts });
        const page = await ctx.newPage();
        if (faces) await page.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }); }, faces);
        await page.goto(pathToFileURL(file).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
        return { ctx, page };
      };
      const { ctx, page } = await open();
      if (board.motion) await seek(page, 30000);
      row[w] = await page.evaluate(firstScreen);
      await page.screenshot({ path: join(out, `${v.id}-${w}.png`) });
      if (board.motion) {
        Object.assign(row[w], await page.evaluate(motionFacts), { contrast_floor: await contrastFloor(page) });
        const still = await open({ reducedMotion: 'reduce' });
        row[w].moves_under_reduce_motion = await still.page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
        await still.ctx.close();
        // 6 s of it moving, at the real speed, from 20 s in.
        const vdir = mkdtempSync(join(tmpdir(), 'video-')), rec = await open({ deviceScaleFactor: 1, recordVideo: { dir: vdir, size: { width: w, height: h } } });
        await rec.page.evaluate(() => { for (const a of document.getAnimations()) a.currentTime = 20000; }); await rec.page.waitForTimeout(6000);
        await rec.ctx.close();
        const webm = join(vdir, readdirSync(vdir).find(f => f.endsWith('.webm')));
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-sseof', '-6', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', '-an', join(out, `${v.id}-${w}.mp4`)]);
        rmSync(vdir, { recursive: true, force: true });
      }
      await ctx.close();
    }
    const { findings } = await check(file, 'web', { browser });
    // The field may fill one view per canvas; checking both canvases in one run counts two, so that line is dropped.
    const errors = findings.filter(f => f.level === 'error' && !/the field fills \d views/.test(f.msg));
    row.brand_errors = errors.map(f => `${f.id} ${f.where} ${f.msg}`);
    row.brand_warnings = findings.filter(f => f.level !== 'error').length;
    audit.variants.push(row);
    console.log(`${v.id}: ${errors.length} error(s), ${row[1440].words} words on the first screen, pill at ${row[1440].pill_y}px` +
      (board.motion ? `, contrast floor ${row[390].contrast_floor}:1 phone and ${row[1440].contrast_floor}:1 desktop, ${Math.round(row[390].clothing_share * 100)}% clothing on a phone` : ''));
  }
  writeFileSync(join(out, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
  // The board: desktop renders side by side with the phone render beside each, and the measured lines under them.
  const cell = v => { const a = audit.variants.find(r => r.id === v.id), d = a[1440];
    return `<figure><div class="pair"><img class="d" src="${v.id}-1440.png"><img class="m" src="${v.id}-390.png"></div>
      <figcaption><b>${v.label}</b><span>${d.words} words on the first screen · button ${d.pill_y}px from the top · headline ${d.headline_lines} lines · ${d.photos} photo${d.photos === 1 ? '' : 's'} · ${a.brand_errors.length} brand errors</span>${board.motion ? (m => `<span>Clothing fills ${Math.round(m.clothing_share * 100)}% of a phone screen · text contrast at its worst ${m.contrast_floor}:1 · fastest ${m.fastest_px_s} px/s · moves ${m.animated.join(', ')}${m.compositor_only ? '' : ' (repaints)'} · ${m.moves_under_reduce_motion ? 'still moves' : 'stops'} under Reduce Motion</span>`)(a[390]) : ''}</figcaption></figure>`; };
  const html = `<!doctype html><meta charset="utf-8"><style>${faces ?? ''}
    body{margin:0;padding:48px;background:#E9ECEE;font:500 22px/1.35 "PP Neue Montreal",sans-serif;color:#0A0A0A}
    h1{font:600 40px/1.1 "Clofie","PP Neue Montreal",sans-serif;margin:0 0 8px} p{margin:0 0 32px;color:rgb(10 10 10/.65)}
    .grid{display:grid;grid-template-columns:repeat(${board.variants.length},1fr);gap:40px} figure{margin:0}
    .pair{display:grid;grid-template-columns:1440fr 390fr;gap:16px;align-items:start} .pair img{width:100%;border-radius:16px;display:block;box-shadow:0 0 0 1px rgb(10 10 10/.08)}
    figcaption{margin-top:16px;display:grid;gap:4px} figcaption span{color:rgb(10 10 10/.65);font-size:18px}</style>
    <h1>${board.title}</h1><p>${board.question} ${board.purpose} ${faces ? 'Drawn in the brand faces.' : 'Drawn in a fallback face: the brand faces were not available.'}</p><div class="grid">${board.variants.map(cell).join('')}</div>`;
  const tmp = mkdtempSync(join(tmpdir(), 'board-')), boardHtml = join(tmp, 'board.html');
  writeFileSync(boardHtml, html.replaceAll('src="', `src="${pathToFileURL(out).href}/`));
  const page = await browser.newPage({ viewport: { width: 2400 * board.variants.length / 3 + 96, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(boardHtml).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, 'board.png'), fullPage: true }); await page.close();
  rmSync(tmp, { recursive: true, force: true });
  if (board.motion) {
    const ids = board.variants.map(v => v.id), ins = ids.flatMap(id => ['-i', join(out, `${id}-390.mp4`)]);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', `${ids.map((_, i) => `[${i}:v]pad=iw+24:ih:12:0:color=0xE9ECEE[v${i}]`).join(';')};${ids.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${ids.length}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', join(out, 'board-phone.mp4')]);
  }
}
await browser.close();
