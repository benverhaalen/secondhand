#!/usr/bin/env node
// Checks the hero on every kind of screen and records it moving, in the brand faces.
//   node brand/explore/web-home/hero/check.mjs
// Widths from a small phone to a wide desktop, a phone on its side and two tablets: no sideways scroll, the button on
// the first screen, the menu under 900 and the links above it, controls at least 44 tall, the two faces matched. The
// text's worst contrast over the moving wall and through every field it turns into, how many photos a visitor sees in
// a minute, and no script error on any screen. With RECORD=1, two recordings, phone and desktop: the open, the wall,
// then "See how it works". Writes out/: one still per screen, menu.jpg, screens.jpg and audit.json, and the
// recordings open-390.mp4 and open-1440.mp4 when asked for. Exits 1 when a screen breaks.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { brandFaces, check, playwright } from '../../../../scripts/brand-check.mjs';
import { contrastFloor } from '../boards/audit.mjs';

const here = import.meta.dirname, root = resolve(here, '../../../..'), out = join(here, 'out'), file = join(here, 'index.html');
mkdirSync(out, { recursive: true });
const faces = brandFaces(readFileSync(join(root, 'brand/tokens.css'), 'utf8'));
if (!faces) console.warn('warn: the brand faces are not here, so this uses a fallback face. Set BRAND_FONTS.');
const browser = await playwright().chromium.launch();
const SCREENS = [[320, 568, 'small phone'], [375, 667, 'phone'], [390, 844, 'phone'], [430, 932, 'large phone'], [844, 390, 'phone on its side'],
  [768, 1024, 'iPad'], [820, 1180, 'iPad Air'], [1024, 768, 'iPad on its side'], [1180, 820, 'iPad Air on its side'], [1440, 900, 'laptop'], [1920, 1080, 'desktop']];

const open = async (w, h, opts = {}, query = '?intro=0') => {
  const touch = w < 1024 || h > w;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch && w < 900, ...opts });
  const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  if (faces) await page.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }); }, faces);
  await page.goto(pathToFileURL(file).href + query); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  return { ctx, page };
};

const facts = () => {
  const vis = el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const h1 = document.querySelector('.hero-t'), pill = document.querySelector('.copy .pill'), btn = document.querySelector('.menu-btn'), nav = document.querySelector('header nav');
  const tall = el => vis(el) ? Math.round(el.getBoundingClientRect().height) : null;
  return {
    sideways: document.documentElement.scrollWidth - innerWidth,
    headline_lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
    headline_px: parseFloat(getComputedStyle(h1).fontSize),
    button_bottom: Math.round(pill.getBoundingClientRect().bottom), first_screen: innerHeight,
    menu: vis(btn), links: vis(nav), button_h: tall(pill), menu_h: tall(btn),
    hl_fit: getComputedStyle(document.documentElement).getPropertyValue('--hl-fit') || null,
    logos_round: [...document.querySelectorAll('.logos img')].every(i => getComputedStyle(i).borderRadius === '50%'),
  };
};

const audit = { faces: !!faces, screens: [] }; let broken = 0;
for (const [w, h, name] of SCREENS) {
  const { ctx, page } = await open(w, h);
  await page.evaluate(() => window.__hero.step(4000));
  const f = { w, h, name, ...(await page.evaluate(facts)) };
  f.problems = [
    f.sideways > 0 && `scrolls sideways by ${f.sideways}px`,
    f.button_bottom > f.first_screen && `the button is ${f.button_bottom - f.first_screen}px below the first screen`,
    w < 900 && !f.menu && 'no menu button under 900',
    w >= 900 && !f.links && 'no links at 900 and up',
    f.button_h < 44 && `the button is ${f.button_h}px tall`,
    f.menu && f.menu_h < 44 && `the menu button is ${f.menu_h}px tall`,
    !f.logos_round && 'a store logo is not round',
    ...page.errors.map(e => `a script error: ${e}`),
  ].filter(Boolean);
  broken += f.problems.length;
  await page.screenshot({ path: join(out, `${w}x${h}.jpg`), type: 'jpeg', quality: 82 });
  // Six moments in each of the four fields the overlay turns through (32 s each), so the floor covers every color.
  if (w === 390 || w === 1440) f.contrast_floor = await contrastFloor(page, { text: '.copy h1, .copy .lead', at: [...Array(24).keys()], move: (p) => p.evaluate(() => window.__hero.step(5300)) });
  if (w === 390) {
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    f.photos_in_a_minute = await page.evaluate(() => { window.__hero.step(60000); return { shown: window.__hero.shown(), pool: window.__hero.pool(), kinds: window.__hero.kinds() }; });
    await page.click('.menu-btn'); await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, 'menu.jpg'), type: 'jpeg', quality: 82 });
  }
  audit.screens.push(f); await ctx.close();
  console.log(`${w} x ${h} ${name}: ${f.problems.length ? f.problems.join('; ') : 'ok'}, headline ${f.headline_lines} lines at ${f.headline_px}px${f.contrast_floor ? `, contrast floor ${f.contrast_floor}:1` : ''}`);
}

// The recordings: the open, a few seconds of the wall, then the button and the wall leaving.
for (const [w, h] of process.env.RECORD === '1' ? [[390, 844], [1440, 900]] : []) {
  const vdir = mkdtempSync(join(tmpdir(), 'hero-'));
  const { ctx, page } = await open(w, h, { deviceScaleFactor: 1, recordVideo: { dir: vdir, size: { width: w, height: h } } }, '?intro=1');
  await page.waitForTimeout(5200); await page.click('.copy .pill'); await page.waitForTimeout(2600);
  await ctx.close();
  const webm = join(vdir, readdirSync(vdir).find(f => f.endsWith('.webm')));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', '-an', join(out, `open-${w}.mp4`)]);
  rmSync(vdir, { recursive: true, force: true });
}

const { findings } = await check(file, 'web', { browser });
// The hero is taller than one view, so the field behind it counts in two; render.mjs drops the same line.
audit.brand_errors = findings.filter(f => f.level === 'error' && !/the field fills \d views/.test(f.msg)).map(f => `${f.id} ${f.where} ${f.msg}`);

// One sheet of every screen, to scale.
const tmp = mkdtempSync(join(tmpdir(), 'screens-')), sheet = join(tmp, 'screens.html');
writeFileSync(sheet, `<!doctype html><meta charset="utf-8"><style>${faces ?? ''} body{margin:0;padding:40px;background:#E9ECEE;font:500 16px/1.3 "PP Neue Montreal",sans-serif;display:flex;flex-wrap:wrap;gap:32px;align-items:flex-start}
  figure{margin:0} img{display:block;border-radius:12px;box-shadow:0 0 0 1px rgb(0 0 0/.1)} figcaption{margin-top:8px;color:rgb(10 10 10/.65)}</style>
  ${audit.screens.map(s => `<figure><img src="${pathToFileURL(join(out, `${s.w}x${s.h}.jpg`)).href}" width="${Math.round(s.w * 0.4)}"><figcaption>${s.w} × ${s.h}, ${s.name}${s.problems.length ? ' · ' + s.problems.join('; ') : ''}</figcaption></figure>`).join('')}`);
const p = await browser.newPage({ viewport: { width: 2200, height: 900 } });
await p.goto(pathToFileURL(sheet).href); await p.waitForTimeout(300);
await p.screenshot({ path: join(out, 'screens.jpg'), type: 'jpeg', quality: 82, fullPage: true }); await p.close();
rmSync(tmp, { recursive: true, force: true });

writeFileSync(join(out, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
await browser.close();
console.log(`${audit.brand_errors.length} brand error(s); ${broken} screen problem(s)`);
process.exit(broken ? 1 : 0);
