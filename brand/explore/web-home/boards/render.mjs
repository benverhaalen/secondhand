#!/usr/bin/env node
// Renders a board of website section variants in the brand faces and audits each one.
//   node brand/explore/web-home/boards/render.mjs <board folder> [...]
// Each variant (<id>.html, listed in board.json) is drawn at 1440 x 900 and 390 x 844, first screen only, with the
// faces from BRAND_FONTS (or fonts/) injected, and checked with scripts/brand-check.mjs on the web medium.
// Writes <board>/out/<id>-1440.png, <id>-390.png, audit.json and board.png (the variants side by side, captioned).
// The board page embeds the licensed faces, so it is drawn from a temp folder and never written into the repo.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

for (const dir of process.argv.slice(2).map(d => resolve(d))) {
  const board = JSON.parse(readFileSync(join(dir, 'board.json'), 'utf8')), out = join(dir, 'out'); mkdirSync(out, { recursive: true });
  const audit = { board: board.title, question: board.question, faces: !!faces, variants: [] };
  for (const v of board.variants) {
    const file = join(dir, `${v.id}.html`), row = { id: v.id, label: v.label };
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      if (faces) await page.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }); }, faces);
      await page.goto(pathToFileURL(file).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
      row[w] = await page.evaluate(firstScreen);
      await page.screenshot({ path: join(out, `${v.id}-${w}.png`) });
      await page.close();
    }
    const { findings } = await check(file, 'web', { browser });
    // The field may fill one view per canvas; checking both canvases in one run counts two, so that line is dropped.
    const errors = findings.filter(f => f.level === 'error' && !/the field fills \d views/.test(f.msg));
    row.brand_errors = errors.map(f => `${f.id} ${f.where} ${f.msg}`);
    row.brand_warnings = findings.filter(f => f.level !== 'error').length;
    audit.variants.push(row);
    console.log(`${v.id}: ${errors.length} error(s), ${row[1440].words} words on the first screen, pill at ${row[1440].pill_y}px`);
  }
  writeFileSync(join(out, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
  // The board: desktop renders side by side with the phone render beside each, and the measured lines under them.
  const cell = v => { const a = audit.variants.find(r => r.id === v.id), d = a[1440];
    return `<figure><div class="pair"><img class="d" src="${v.id}-1440.png"><img class="m" src="${v.id}-390.png"></div>
      <figcaption><b>${v.label}</b><span>${d.words} words on the first screen · button ${d.pill_y}px from the top · headline ${d.headline_lines} lines · ${d.photos} photo${d.photos === 1 ? '' : 's'} · ${a.brand_errors.length} brand errors</span></figcaption></figure>`; };
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
}
await browser.close();
