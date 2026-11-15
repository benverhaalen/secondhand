#!/usr/bin/env node
// Checks every screen of the app on its real render: node scripts/app-check.mjs [route ...] [--dark] [--sheet] [--json]
// It exports the web build (skipped while fresh), serves it, opens each route at 390 x 844 and runs the brand checks
// (.agents/checks/render.mjs, the app medium) on the live page, each screenful of a screen that scrolls.
// It saves features/app/renders/<route>[-dark].png at 2x; --sheet also saves contact.png, every screen side by side.
// No routes means every route in the export. Exit code 1 on any error.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, playwright } from './brand-check.mjs';
import { judge } from '../.agents/checks/render.mjs';
import { scales } from '../.agents/checks/brand.mjs';
import { path as visitPath, routes, serve } from '../app/e2e/web.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const RENDERS = join(root, 'features/app/renders');
const W = 390, H = 844, MAX_SCREENS = 8;

// "today", "/today", "(tabs)/today" and "items/42" are the paths /today and /items/42; "index" and "/" are /.
export const toPath = route => visitPath(String(route).replace(/^\/+/, '') || 'index');
export const slug = p => p.replace(/^\/+|\/+$/g, '').replace(/[^\w.-]+/g, '-') || 'index';

// Waits until the screen has drawn: the network is quiet, fonts are in, and no animation is still running.
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    const end = Date.now() + 1500;
    while (Date.now() < end && document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}
// The element the screen scrolls in. React Native for web scrolls inside a view, never the window.
const scroller = page => page.evaluate(() => {
  const all = [document.scrollingElement, ...document.querySelectorAll('body *')].filter(e => e && e.scrollHeight > e.clientHeight + 1 && (e === document.scrollingElement || /auto|scroll/.test(getComputedStyle(e).overflowY)));
  const el = all.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  return el ? { height: el.scrollHeight, view: el.clientHeight } : { height: innerHeight, view: innerHeight };
});
const scrollTo = (page, y) => page.evaluate(y => {
  const all = [document.scrollingElement, ...document.querySelectorAll('body *')].filter(e => e && e.scrollHeight > e.clientHeight + 1 && (e === document.scrollingElement || /auto|scroll/.test(getComputedStyle(e).overflowY)));
  const el = all.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]; if (el) { el.style.scrollBehavior = 'auto'; el.scrollTop = y; }
}, y);

// A browser that opens every page the way a phone would: the color scheme set, the page settled after it loads, and scrolled to y.
// brand-check's collect() opens its own pages through this, so it measures the app as a person sees it.
function phone(browser, { dark, y = 0 }) {
  return { newPage: async (opts = {}) => {
    const page = await browser.newPage({ ...opts, colorScheme: dark ? 'dark' : 'light' });
    // The token probe in collect() reads the theme from data-theme, so the dark page names it.
    if (dark) await page.addInitScript(() => { const set = () => document.documentElement?.setAttribute('data-theme', 'dark'); set(); addEventListener('DOMContentLoaded', set); });
    const goto = page.goto.bind(page);
    page.goto = async (url, o) => { const r = await goto(url, { waitUntil: 'load', ...o }); await settle(page); if (y) { await scrollTo(page, y); await settle(page); } return r; };
    return page;
  } };
}

let rules;
const context = () => rules ??= {
  sheet: JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8')).app,
  states: JSON.parse(readFileSync(join(root, '.agents/ui-states.json'), 'utf8')),
  tokensCss: readFileSync(join(root, 'brand/tokens.css'), 'utf8'),
  scales: scales(readFileSync(join(root, 'brand/constitution.md'), 'utf8')),
};

// Checks one page at url: every screenful, as a phone shows it. Returns the findings (deduplicated across screenfuls) and how many screenfuls.
export async function checkPage(url, { browser, dark = false } = {}) {
  const { sheet, states, tokensCss, scales } = context();
  const look = await browser.newPage({ viewport: { width: W, height: H }, colorScheme: dark ? 'dark' : 'light' });
  await look.goto(url, { waitUntil: 'load' }); await settle(look);
  const { height, view } = await scroller(look); await look.close();
  const screens = Math.min(MAX_SCREENS, Math.max(1, Math.ceil((height - 1) / view)));
  const findings = [], seen = new Set();
  for (let i = 0; i < screens; i++) {
    const y = Math.min(i * view, height - view);
    const facts = await collect(url, { medium: 'app', sheet, tokensCss, browser: phone(browser, { dark, y }), cases: states.content, kinds: Object.keys(states.states) });
    for (const f of judge(facts, { medium: 'app', sheet, scales, colors: facts.colors, states: states.states })) {
      const where = f.where.replace(/^view \d+/, screens > 1 ? `screen ${i + 1}` : 'screen'), key = `${f.id}|${f.where.replace(/^view \d+/, '')}|${f.msg}`;
      if (!seen.has(key)) { seen.add(key); findings.push({ ...f, where }); }
    }
  }
  return { findings, screens };
}

// A picture of the whole screen at 2x: as tall as its content, so nothing below the fold is missed.
export async function shoot(url, file, { browser, dark = false } = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  try {
    await page.goto(url, { waitUntil: 'load' }); await settle(page);
    const { height, view } = await scroller(page);
    if (height > view) { await page.setViewportSize({ width: W, height: Math.min(H * MAX_SCREENS, H + height - view) }); await settle(page); }
    await page.screenshot({ path: file });
  } finally { await page.close(); }
}

// Every screen side by side, light above dark when both were checked, with its route under it.
export async function contactSheet(shots, file, { browser }) {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  try {
    const cell = s => `<figure><img src="data:image/png;base64,${readFileSync(s.file).toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
    await page.setContent(`<!doctype html><style>body{margin:0;padding:24px;background:#e9e9e9;font:500 15px system-ui;display:flex;gap:24px;align-items:flex-start;width:max-content}
      figure{margin:0;display:flex;flex-direction:column;gap:8px}img{width:${W}px;display:block;border-radius:24px;box-shadow:0 0 0 1px #0002}figcaption{text-align:center}</style>${shots.map(cell).join('')}`);
    await page.waitForFunction(() => [...document.images].every(i => i.complete));
    await page.screenshot({ path: file, fullPage: true });
  } finally { await page.close(); }
}

const line = f => `${f.level === 'error' ? 'ERROR' : 'warn '} ${f.id}  ${f.where}  ${f.msg}`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flags = new Set(args.filter(a => a.startsWith('--'))), asked = args.filter(a => !a.startsWith('--'));
  const unknown = [...flags].filter(f => !['--dark', '--sheet', '--json'].includes(f));
  if (unknown.length) { process.stderr.write(`unknown ${unknown.join(' ')}\n${readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n')}\n`); process.exit(2); }
  const pw = playwright(); if (!pw) { process.stderr.write('Playwright is not installed here, so nothing can be rendered\n'); process.exit(2); }
  const json = flags.has('--json'), say = json ? () => {} : s => console.log(s);
  let site;
  try { site = await serve({ log: say }); } catch (e) { process.stderr.write(`${e.message}\n`); process.exit(2); }
  const browser = await pw.chromium.launch(), report = [], shots = [];
  try {
    let paths = asked.map(toPath);
    if (!paths.length) {
      const all = routes();
      for (const r of all.filter(r => r.dynamic)) say(`warn  skipped ${r.page}: it needs a real value, so name it, as in  node scripts/app-check.mjs ${r.path.replace(/\[\.*(\w+)\]/g, '1')}`);
      paths = all.filter(r => !r.dynamic).map(r => r.path);
    }
    mkdirSync(RENDERS, { recursive: true });
    for (const p of paths) for (const dark of flags.has('--dark') ? [false, true] : [false]) {
      const url = site.url + p, name = `${slug(p)}${dark ? '-dark' : ''}`, file = join(RENDERS, `${name}.png`);
      const status = await fetch(url).then(r => r.status, () => 0);
      if (status === 404) { report.push({ route: p, dark, findings: [{ level: 'error', id: 'A0', where: p, msg: 'no screen answers at this path (404): check the file under app/src/app' }] }); say(`\n${p}${dark ? ' dark' : ''}\nERROR A0  ${p}  no screen answers at this path (404)`); continue; }
      const { findings, screens } = await checkPage(url, { browser, dark });
      await shoot(url, file, { browser, dark }); shots.push({ file, label: `${p}${dark ? ' dark' : ''}` });
      report.push({ route: p, dark, screens, render: file, findings });
      const n = findings.filter(f => f.level === 'error').length;
      say(`\n${p}${dark ? ' dark' : ''}  (${screens} screenful${screens > 1 ? 's' : ''})`);
      for (const f of findings) say(line(f));
      say(`${n ? `${n} error(s)` : 'ok'}  ${file.slice(root.length + 1)}`);
    }
    let sheet = null;
    if (flags.has('--sheet') && shots.length) { sheet = join(RENDERS, 'contact.png'); await contactSheet(shots, sheet, { browser }); say(`\ncontact sheet  ${sheet.slice(root.length + 1)}`); }
    const errors = report.reduce((n, r) => n + r.findings.filter(f => f.level === 'error').length, 0);
    if (json) process.stdout.write(JSON.stringify({ errors, sheet, pages: report }, null, 2) + '\n');
    else say(`\n${report.length} screen(s) checked, ${errors ? `${errors} error(s).` : 'app checks ok.'} A pass means the rules were followed, not that it looks good: look at the renders, then run break-ui.`);
    process.exitCode = errors ? 1 : 0;
  } finally { await browser.close(); await site.close(); }
}
