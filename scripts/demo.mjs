#!/usr/bin/env node
// Records the app driving itself on its sample data, as phone clips for the website and the video.
//   node scripts/demo.mjs [name ...] [--light]
// Each demo is a plan in brand/explore/web-home/demos/<name>.json: { title, shows, steps }, where a step is
// { open: "/route" }, { tap: "<testID>" }, { scroll: px }, { type: ["<testID>", "words"] } or { wait: ms }.
// The real web build is exported if stale and served (app/e2e/web.mjs), so the app answers from spec/examples and
// nothing live is touched. Each clip is 390 x 844 at 2x, dark unless --light, with a ring where a finger taps, and is
// written to demos/out/<name>.mp4 with a still of its last frame (.jpg). The method is Magic UW's demo video: the real app on a
// labelled sample, driven by its own controls. No name means every plan. About 10 s a clip after the first export.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { serve } from '../app/e2e/web.mjs';
import { playwright } from './brand-check.mjs';

const dir = resolve(import.meta.dirname, '../brand/explore/web-home/demos'), out = join(dir, 'out');
const args = process.argv.slice(2), light = args.includes('--light'), names = args.filter(a => !a.startsWith('--'));
const KINDS = ['open', 'tap', 'scroll', 'type', 'wait'];

// Reads and checks a plan, so a typo fails before a browser starts.
export function plan(file) {
  const p = JSON.parse(readFileSync(file, 'utf8'));
  if (!p.title || !Array.isArray(p.steps) || !p.steps.length) throw new Error(`${file}: needs a title and steps`);
  p.steps.forEach((s, i) => { const k = Object.keys(s); if (k.length !== 1 || !KINDS.includes(k[0])) throw new Error(`${file}: step ${i + 1} is ${JSON.stringify(s)}; a step is one of ${KINDS.join(', ')}`); });
  if (!('open' in p.steps[0])) throw new Error(`${file}: the first step opens a route`);
  return p;
}

// A ring where the finger lands, as iOS shows touches in a screen recording.
const touches = () => addEventListener('pointerdown', e => {
  const r = document.createElement('div');
  r.style.cssText = `position:fixed;left:${e.clientX - 22}px;top:${e.clientY - 22}px;width:44px;height:44px;border-radius:50%;background:rgb(255 255 255/.35);border:2px solid rgb(255 255 255/.8);box-shadow:0 0 0 1px rgb(0 0 0/.2);pointer-events:none;z-index:2147483647;transition:opacity .4s,transform .4s`;
  document.body.append(r); requestAnimationFrame(() => requestAnimationFrame(() => { r.style.opacity = '0'; r.style.transform = 'scale(1.3)'; }));
  setTimeout(() => r.remove(), 500);
}, true);

async function record(browser, url, name, p) {
  const vdir = mkdtempSync(join(tmpdir(), 'demo-'));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    colorScheme: light ? 'light' : 'dark', recordVideo: { dir: vdir, size: { width: 780, height: 1688 } } });
  const t0 = Date.now(), page = await ctx.newPage(); await page.addInitScript(touches);
  let start = 0;
  for (const s of p.steps) {
    if (s.open) { await page.goto(url + s.open, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); if (!start) start = (Date.now() - t0) / 1000; }
    else if (s.tap) { const el = page.getByTestId(s.tap).first(); await el.waitFor({ state: 'visible', timeout: 5000 }); await el.scrollIntoViewIfNeeded(); await el.tap(); }
    else if (s.type) { const el = page.getByTestId(s.type[0]).first(); await el.tap(); await el.pressSequentially(s.type[1], { delay: 60 }); }
    else if (s.scroll) { await page.mouse.move(195, 500); for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, s.scroll / 12); await page.waitForTimeout(25); } }
    else if (s.wait) await page.waitForTimeout(s.wait);
  }
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 80 });
  await ctx.close();
  const webm = join(vdir, readdirSync(vdir).find(f => f.endsWith('.webm')));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', '-an', join(out, `${name}.mp4`)]);
  rmSync(vdir, { recursive: true, force: true });
  return ((Date.now() - t0) / 1000 - start).toFixed(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && (!names.length || names.includes(basename(f, '.json'))));
  if (!files.length) throw new Error(`no demo plans named ${names.join(', ')} in ${dir}`);
  const plans = files.map(f => [basename(f, '.json'), plan(join(dir, f))]);
  mkdirSync(out, { recursive: true });
  const t = Date.now(), site = await serve({ log: m => console.log(m) }), browser = await playwright().chromium.launch();
  try { for (const [name, p] of plans) console.log(`${name}: ${await record(browser, site.url, name, p)} s clip, ${p.title}`); }
  finally { await browser.close(); await site.close(); }
  console.log(`${plans.length} clip(s) in ${((Date.now() - t) / 1000).toFixed(0)} s, in ${out}`);
}
