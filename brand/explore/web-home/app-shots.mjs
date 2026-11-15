#!/usr/bin/env node
// Draws the app screens the website shows, from the app's own build, on every build (L61; Ben, 10:24: "the website should
// update screenshots from the respective parts of the app according to the app code itself. rerender on each build").
//   node brand/explore/web-home/app-shots.mjs [--all-heights]
// Reads app-screens.json. Each shot names an app path (with its ?world= or ?case=), light or dark, and the moment the site
// sells with it: the text the shot is scrolled to, so that moment sits at the top of the frame. A site page is an ad, not a
// tool (Ben, 10:32), so a shot is the one moment of its step, never a whole working screen to read.
// Writes app/<id>.png: the phone's 390 x 844 screen at 2x, cut at the shot's height (844 unless it says), and app/shots.json with the commit it
// was drawn from. --all-heights also writes app/<id>-full.png, the whole screen, for choosing a moment.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '../../../app/e2e/web.mjs';
import { playwright } from '../../../scripts/brand-check.mjs';
import { INSETS, insetScript } from '../../../scripts/composition.mjs';

const here = import.meta.dirname, root = resolve(here, '../../..'), out = join(here, 'app');
const { shots } = JSON.parse(readFileSync(join(here, 'app-screens.json'), 'utf8'));
const full = process.argv.includes('--all-heights');
const pw = playwright(); if (!pw) throw new Error('Playwright is not installed here');
mkdirSync(out, { recursive: true });
const site = await serve({ log: console.log }), browser = await pw.chromium.launch(), drawn = [], blank = [];
try {
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: 390, height: s.viewport ?? 844 }, deviceScaleFactor: 2, colorScheme: s.dark === false ? 'light' : 'dark' });
    await page.addInitScript(insetScript(INSETS));
    await page.goto(site.url + s.path, { waitUntil: 'load' });
    await page.emulateMedia({ colorScheme: s.dark === false ? 'light' : 'dark', reducedMotion: 'reduce' });
    // Settled as the app check settles a screen: the network quiet, the fonts in, no animation still running.
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    // The server sends the screen drawn light; it is right only once the app has taken over in the browser.
    await page.waitForTimeout(2500);
    await page.evaluate(async () => {
      await document.fonts.ready; const end = Date.now() + 3000;
      while (Date.now() < end && (document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity) || !document.querySelector('[data-screen]'))) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    // The moment: scroll the screen's own scroller so the named text sits under the top inset, as a person would scroll it.
    await page.waitForTimeout(800);  // a sheet slides in by script, which no animation list shows
    const found = s.moment ? await page.evaluate(({ text, top }) => {
      const el = [...document.querySelectorAll('body *')].find(e => !e.children.length && e.textContent.trim() === text);
      if (!el) return false;
      let sc = el.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc) { sc.scrollTop += el.getBoundingClientRect().top - top; return 0; }
      // Nothing scrolls it (a sheet laid out whole on a tall page): the shot is cut from where the moment starts.
      return Math.max(0, Math.round(el.getBoundingClientRect().top - top));
    }, { text: s.moment, top: s.top ?? 120 }) : 0;
    if (found === false) throw new Error(`${s.id}: "${s.moment}" is not on ${s.path} any more; the app changed, so choose the moment again in app-screens.json`);
    await page.waitForTimeout(500);
    // Every scroller at its top unless a moment was named, as the screen opens.
    if (!s.moment) await page.evaluate(() => { for (const e of document.querySelectorAll('body *')) if (e.scrollTop) e.scrollTop = 0; });
    await page.waitForTimeout(300);
    const png = await page.screenshot({ path: join(out, `${s.id}.png`), clip: { x: 0, y: found, width: 390, height: s.height ?? 844 } });
    // A shot of one flat color compresses to almost nothing: the screen did not draw, and a blank phone never reaches the site.
    if (png.length < 30000) { blank.push(`${s.id} (${s.path})`); console.log(`${s.id}  ${s.path}  came out blank`); }
    if (full) { await page.setViewportSize({ width: 390, height: 2400 }); await page.waitForTimeout(400); await page.screenshot({ path: join(out, `${s.id}-full.png`), fullPage: true }); }
    drawn.push({ id: s.id, path: s.path, moment: s.moment ?? null }); await page.close();
    console.log(`${s.id}  ${s.path}${s.moment ? `  at "${s.moment}"` : ''}`);
  }
} finally { await browser.close(); site.close(); }
const commit = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return null; } })();
writeFileSync(join(out, 'shots.json'), JSON.stringify({ commit, faces: !!process.env.BRAND_FONTS, shots: drawn }, null, 2) + '\n');
if (blank.length) { console.error(`blank: ${blank.join(', ')}. The app does not draw these on the web right now; the site keeps no stale copy (L61).`); process.exit(1); }
