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
    const found = s.moment ? await page.evaluate(({ text, top, sheet }) => {
      const el = [...document.querySelectorAll('body *')].find(e => !e.children.length && e.textContent.trim() === text);
      if (!el) return false;
      let sc = el.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc) { sc.scrollTop += el.getBoundingClientRect().top - top; return 0; }
      // Nothing scrolls it (a sheet laid out whole on a tall page): the shot is cut from where the moment starts, or with
      // from: "sheet" from the top edge of the sheet that holds it, so its rounded top is the frame's top and nothing behind shows.
      if (sheet) { let e = el; while (e && !(parseFloat(getComputedStyle(e).borderTopLeftRadius) > 0 && e.getBoundingClientRect().width >= innerWidth * 0.9)) e = e.parentElement; return e ? Math.round(e.getBoundingClientRect().top) : false; }
      return Math.max(0, Math.round(el.getBoundingClientRect().top - top));
    }, { text: s.moment, top: s.top ?? 120, sheet: s.from === 'sheet' }) : 0;
    if (found === false) throw new Error(`${s.id}: "${s.moment}" is not on ${s.path} any more; the app changed, so choose the moment again in app-screens.json`);
    await page.waitForTimeout(500);
    // A cut through a line of text reads as a broken screen, which an ad can't afford (10:32): move the cut, never more than 240 px, until
    // both edges fall between lines. A scrolled screen moves its scroller (its top edge is the scroller's own top); a screen
    // cut from a tall page moves the cut.
    const H = s.height ?? 844;
    const y = s.moment ? await page.evaluate(({ text, keep, y0, H, fixed }) => {
      const leaf = t => [...document.querySelectorAll('body *')].find(e => !e.children.length && e.textContent.trim() === t);
      const el = leaf(text), kept = keep && leaf(keep)?.getBoundingClientRect();
      if (keep && !kept) return undefined;
      let sc = el.parentElement; while (sc && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      // Only text a person can see: a line under a sheet or off the page is no line to cut, but a line half off the top is.
      const seen = (n, b) => { const t = Math.max(b.top, 0), u = Math.min(b.bottom, innerHeight); if (u <= t) return false; const y = (t + u) / 2;
        const hit = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 0), innerWidth - 1), y); return !!hit && (n.parentElement.contains(hit) || hit.contains(n.parentElement)); };
      const lines = [], walk = document.createTreeWalker(sc ?? document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode());) if (n.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(n); for (const b of r.getClientRects()) if (b.height && seen(n, b)) lines.push(b); }
      const cuts = (edge, d) => lines.some(b => b.top + d < edge + 8 && b.bottom + d > edge - 8);  // a line keeps 8 px from either edge, clear of the card's corner
      const top = sc ? Math.max(0, sc.getBoundingClientRect().top) : y0, bottom = y0 + H;
      // d > 0 shows more of what is above: the scroller's content moves down, or the cut moves up.
      // What the step's line talks about (keep) stays whole in the frame, so the caption never names something cut off.
      const holds = (a, b, d) => !kept || (kept.top + d >= a + 8 && kept.bottom + d <= b - 8);
      const ok = d => sc ? !cuts(top, d) && !cuts(bottom, d) && holds(top, bottom, d) : !cuts(y0 - d, 0) && !cuts(bottom - d, 0) && y0 - d >= 0 && holds(y0 - d, bottom - d, 0);
      const d = (fixed ? [0] : [...Array(241).keys()].flatMap(i => i ? [i, -i] : [0])).find(ok);
      if (d === undefined) return null;
      if (sc) { sc.scrollTop -= d; return y0; }
      return y0 - d;
    }, { text: s.moment, keep: s.keep ?? null, y0: found, H, fixed: s.from === 'sheet' }) : found;
    if (y === undefined) throw new Error(`${s.id}: "${s.keep}" is not on ${s.path} any more; the app changed, so choose what to keep again in app-screens.json`);
    if (y === null) throw new Error(`${s.id}: every cut within 240 px of "${s.moment}" goes through a line of text (or, from the sheet, its bottom does); choose another moment or height`);
    await page.waitForTimeout(300);
    // Every scroller at its top unless a moment was named, as the screen opens.
    if (!s.moment) await page.evaluate(() => { for (const e of document.querySelectorAll('body *')) if (e.scrollTop) e.scrollTop = 0; });
    await page.waitForTimeout(300);
    const png = await page.screenshot({ path: join(out, `${s.id}.png`), clip: { x: 0, y, width: 390, height: H } });
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
