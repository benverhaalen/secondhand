#!/usr/bin/env node
// Checks every screen of the app on its real render: node scripts/app-check.mjs [route ...] [--sheet] [--json]
// It exports the web build (skipped while fresh), serves it, opens each route at 390 x 844 in light and in dark, and runs
// the brand checks (.agents/checks/render.mjs, the app medium) on the live page, each screenful of a screen that scrolls.
// Per route it writes features/app/renders/<slug>.png, <slug>-dark.png (2x) and <slug>.json, which scripts/app-gallery.mjs reads.
// --sheet also saves contact.png, every screen side by side. No routes means every route, and then features/app/gallery.html too.
// Exit code 1 on any error.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, playwright } from './brand-check.mjs';
import { page as galleryPage, screens, slug } from './app-gallery.mjs';
import { judge } from '../.agents/checks/render.mjs';
import { scales } from '../.agents/checks/brand.mjs';
import { find, routes, serve } from '../app/e2e/web.mjs';
import { compose, INSETS, insetScript, snapshot } from './composition.mjs';
import { measure, signatures, standards, typeAcross } from './standards.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const RENDERS = join(root, 'features/app/renders');
const W = 390, H = 844, MAX_SCREENS = 8;
export { slug };

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
    // A screen's required states are drawn across its ?state= pages, so checkRoute asks that question once per route, not per page.
    for (const f of judge(facts, { medium: 'app', sheet, scales, colors: facts.colors, states: states.states }).filter(f => !(f.id === 'B35' && /^screen "/.test(f.where) && /^is not drawn in the state/.test(f.msg)))) {
      const where = f.where.replace(/^view \d+/, screens > 1 ? `screen ${i + 1}` : 'screen'), key = `${f.id}|${f.where.replace(/^view \d+/, '')}|${f.msg}`;
      if (!seen.has(key)) { seen.add(key); findings.push({ ...f, where }); }
    }
  }
  return { findings, screens };
}

// Each route's type signatures, so one run can say when a size is set two ways across the app (U15).
export const typeSeen = {};

// How the first screen is composed, judged with the phone's insets (scripts/composition.mjs, Art. 7.11 to 7.16).
export async function checkComposition(url, { browser, route, typical = true }) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  try {
    await page.addInitScript(insetScript(INSETS));
    await page.goto(url, { waitUntil: 'load' }); await settle(page);
    const m = await page.evaluate(measure);
    typeSeen[route] = signatures({ texts: m.texts.filter(t => !t.bar) });
    return [...compose(await page.evaluate(snapshot, { insetTop: INSETS.top }), { route, typical }), ...standards(m)];
  } finally { await page.close(); }
}

// A picture of the whole screen at 2x: as tall as its content, so nothing below the fold is missed. It has the phone's
// insets, so the top of a screen shows what sits under the clock on an iPhone.
export async function shoot(url, file, { browser, dark = false } = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  try {
    await page.addInitScript(insetScript(INSETS));
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

// The page names itself: data-screen on the screen's root, and data-state there (or on each data-view) for the state it is drawn in.
const names = page => page.evaluate(() => {
  const el = document.querySelector('[data-screen]'), states = [el, ...document.querySelectorAll('[data-view][data-state]')].flatMap(e => (e?.dataset.state ?? '').split(/[\s,]+/)).filter(Boolean);
  return { screen: el?.dataset.screen ?? null, states: [...new Set(states)], skip: el?.dataset.skip ?? '', catalog: !!document.querySelector('[data-sheet]'), wash: !!document.querySelector('[data-part="wash"]'), top: !!document.querySelector('[data-part="nav"],[data-part="page-head"]') };
});
async function readNames(url, { browser }) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  try { await page.goto(url, { waitUntil: 'load' }); await settle(page); return await names(page); } finally { await page.close(); }
}
// A status a person or a builder set ("tests", "fixed") stands while the checks stay clean.
const kept = file => { try { const s = JSON.parse(readFileSync(file, 'utf8')).status; return ['built', 'tests', 'fixed'].includes(s) ? s : null; } catch { return null; } };

// U8 the wash sits at the top of every page that has a top (a nav or a tab's title), and on nothing else: a sheet, the
// camera and a full-screen moment have none. Ben, 06:21: "sometimes the gradient at the top of the screen is there or isnt
// there"; 09:56: "the gradient at the top of the screen is on some pages and not on others". Screen draws it by default.
export function washRule(route, hasWash, hasTop = true) {
  if (hasTop && !hasWash) return { level: 'error', id: 'U8', where: 'screen', msg: 'has a top with no wash under it: every page with a nav or a title carries the wash, so no page looks unlike the next (<Screen> draws it whenever it has a nav)' };
  if (!hasTop && hasWash) return { level: 'error', id: 'U8', where: 'screen', msg: 'has the wash with no nav or title above it: the wash marks the top of a page, so a sheet or a full-screen moment has none' };
  return null;
}

// Checks one route light and dark, saves <slug>.png, <slug>-dark.png and <slug>.json, and returns what it wrote.
export async function checkRoute({ route, path }, { browser, base, out = RENDERS }) {
  const name = slug(route), json = join(out, `${name}.json`), url = base + path;
  const status = await fetch(url).then(r => r.status, () => 0);
  if (status === 404 || !status) {
    const result = { route, screen: null, states: [], status: 'fail', findings: [{ level: 'error', id: 'A0', where: path, msg: `no screen answers at ${path} (${status || 'no answer'}): check the file under app/src/app` }] };
    writeFileSync(json, JSON.stringify(result, null, 2) + '\n'); return { ...result, path, screens: 0 };
  }
  const findings = [], screens = {};
  for (const dark of [false, true]) {
    const got = await checkPage(url, { browser, dark });
    screens[dark ? 'dark' : 'light'] = got.screens;
    findings.push(...got.findings.map(f => dark ? { ...f, where: `dark ${f.where}` } : f));
    await shoot(url, join(out, `${name}${dark ? '-dark' : ''}.png`), { browser, dark });
  }
  // A finding the light and the dark run share is one finding. A kit sheet (<Screen sheet="parts">, data-sheet) is a catalog
  // of every part, not one view, so the rules about what one view holds (one field, how much color, one heading, a wordmark, its states) only warn there.
  const own = await readNames(url, { browser }), catalog = own.catalog, composition = new Set(['B3', 'B4', 'B8', 'B12', 'A7', 'B35']);
  const seen = new Set(), list = findings.filter(f => { const k = `${f.id}|${f.where.replace(/^dark /, '')}|${f.msg}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(f => catalog && composition.has(f.id) ? { ...f, level: 'warn' } : f);
  // B35 for the screen: every required state is drawn on one of its pages, url?state=<s> (app/src/demo/screen.ts), or skipped with why.
  // The state page drops ?world= and replaces any ?state=, so a route checked with its own query asks the same question.
  const washed = own.catalog ? null : washRule(route, own.wash, own.top); if (washed) list.push(washed);
  if (!catalog) list.push(...await checkComposition(url, { browser, route, typical: !new URL(url).searchParams.has('state') }));
  const have = new Set(own.states), skip = new Map();
  const skips = n => { for (const x of n.skip.split(';')) { const [id, why] = x.split(':').map(y => y.trim()); if (id) skip.set(id, why ?? ''); } };
  skips(own);
  const required = context().states.states.screen?.required ?? [];
  for (const st of required) { if (have.has(st) || skip.get(st)) continue; const at = new URL(url); at.searchParams.delete('world'); at.searchParams.set('state', st); const n = await readNames(at.href, { browser }); n.states.forEach(x => have.add(x)); skips(n); }
  const missing = own.screen && !catalog ? required.filter(st => !have.has(st) && !skip.get(st)) : [];
  if (missing.length) list.push({ level: 'error', id: 'B35', where: `screen "${own.screen}"`, msg: `is not drawn ${missing.length === 1 ? 'in the state' : 'in the states'} ${missing.join(', ')}, at ${path}?state=<state> or anywhere on its pages: draw each from useScreen() (app/src/demo/screen.ts), or say why it can't happen with <Screen skip="${missing[0]}: why">` });
  const errors = list.filter(f => f.level === 'error').length;
  const result = { route, ...own, states: [...have], status: errors ? 'fail' : kept(json) ?? 'clean', findings: list };
  writeFileSync(json, JSON.stringify(result, null, 2) + '\n');
  return { ...result, path, screens };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), flags = new Set(args.filter(a => a.startsWith('--'))), asked = args.filter(a => !a.startsWith('--'));
  const unknown = [...flags].filter(f => !['--dark', '--sheet', '--json'].includes(f));
  if (unknown.length) { process.stderr.write(`unknown ${unknown.join(' ')}\n${readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n')}\n`); process.exit(2); }
  const pw = playwright(); if (!pw) { process.stderr.write('Playwright is not installed here, so nothing can be rendered\n'); process.exit(2); }
  const json = flags.has('--json'), say = json ? () => {} : s => console.log(s);
  let site;
  try { site = await serve({ log: say }); } catch (e) { process.stderr.write(`${e.message}\n`); process.exit(2); }
  const browser = await pw.chromium.launch(), report = [];
  try {
    const all = routes(); let todo = asked.map(a => find(a, all));
    if (!asked.length) {
      for (const r of all.filter(r => r.dynamic)) say(`warn  skipped ${r.route}: it needs a real value, so name one, as in  node scripts/app-check.mjs ${r.path.replace(/\[\.*(\w+)\]/g, '1')}`);
      todo = all.filter(r => !r.dynamic);
    }
    for (const r of todo.filter(r => !r.path)) say(`warn  skipped ${r.route}: it needs a real value, so name a path, as in  item/1`);
    mkdirSync(RENDERS, { recursive: true });
    for (const r of todo.filter(r => r.path)) {
      const got = await checkRoute(r, { browser, base: site.url });
      report.push(got);
      const n = got.findings.filter(f => f.level === 'error').length;
      say(`\n${got.route}  ${got.path}${got.screen ? `  screen ${got.screen}` : ''}${got.states.length ? `  states ${got.states.join(', ')}` : ''}`);
      for (const f of got.findings) say(line(f));
      say(`${n ? `${n} error(s)` : 'ok'}  features/app/renders/${slug(got.route)}${got.screens ? '{.png,-dark.png,.json}' : '.json'}`);
    }
    // U15 across the app: the same size set two ways on two screens is the same break as on one.
    const across = report.length > 1 ? typeAcross(typeSeen) : [];
    if (across.length) { say('\nthe whole app'); for (const f of across) say(line(f)); }
    let sheet = null, gallery = null;
    if (flags.has('--sheet') && report.length) {
      sheet = join(RENDERS, 'contact.png');
      const shots = report.flatMap(r => r.screens ? ['', '-dark'].map(d => ({ file: join(RENDERS, `${slug(r.route)}${d}.png`), label: `${r.route}${d && ' dark'}` })) : []);
      await contactSheet(shots, sheet, { browser }); say(`\ncontact sheet  features/app/renders/contact.png`);
    }
    // A full run leaves the gallery current, so Ben sees every screen beside what its checks found.
    if (!asked.length) { gallery = join(root, 'features/app/gallery.html'); writeFileSync(gallery, galleryPage(screens(RENDERS), { renders: relative(dirname(gallery), RENDERS) })); say(`gallery  features/app/gallery.html`); }
    const errors = report.reduce((n, r) => n + r.findings.filter(f => f.level === 'error').length, 0) + across.length;
    if (json) process.stdout.write(JSON.stringify({ errors, sheet, gallery, pages: report }, null, 2) + '\n');
    else say(`\n${report.length} screen(s) checked in light and dark, ${errors ? `${errors} error(s).` : 'app checks ok.'} A pass means the rules were followed, not that it looks good: look at the renders, then run break-ui.`);
    process.exitCode = errors ? 1 : 0;
  } finally { await browser.close(); await site.close(); }
}
