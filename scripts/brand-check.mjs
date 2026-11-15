#!/usr/bin/env node
// Checks a rendered output against the brand: a deck, a post, a story, a web page or an app mock, written as HTML.
//   node scripts/brand-check.mjs <file.html> --medium app|web|post|story|deck [--json]
// It opens the file in headless Chromium at the medium's real size, measures every piece of text, box and color,
// and runs the constitution's Part IV on what it measured (.agents/checks/render.mjs). Exit code 1 on any error.
// A view is each element marked data-view (a slide, a post panel, a frame). With none, it is each screenful of the page.
// Mark a photo that is not an <img> with data-photo, and each kind of repeated thing with data-part="its-name".
// In an app mock, mark the phone's own status bar and home bar data-chrome; they are skipped.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { judge } from '../.agents/checks/render.mjs';
import { scales } from '../.agents/checks/brand.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i;

export function playwright() {
  for (const from of [import.meta.url, pathToFileURL(join(process.env.NODE_PATH?.split(':')[0] ?? '/nonexistent', 'x.js')).href, pathToFileURL('/opt/node-tools/x.js').href])
    try { return createRequire(from)('playwright'); } catch { /* try the next place */ }
  return null;
}

// Runs in the page. Everything it returns is plain data.
function measure({ index, rect, faces, medium }) {
  const [vx, vy, vw, vh] = rect, els = [], texts = [], ids = new Map();
  const first = s => s.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  const inView = r => r.width > 0 && r.height > 0 && r.right > vx && r.left < vx + vw && r.bottom > vy && r.top < vy + vh;
  const rel = r => [r.left - vx, r.top - vy, r.right - vx, r.bottom - vy].map(v => Math.round(v * 10) / 10);
  const clear = c => !c || c === 'transparent' || /^rgba\((?:[^,]+,){3}\s*0\)$/.test(c);
  const shown = (el, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
  // The phone's own status bar and home bar in an app mock are not ours to set. Only the top and bottom strips can be marked.
  const chrome = el => { const c = medium === 'app' && el.closest('[data-chrome]'); if (!c) return false; const r = c.getBoundingClientRect(); return r.bottom <= vy + 60 || r.top >= vy + vh - 40; };
  // The part of a box that its scrolling or clipping ancestors let through.
  const clipped = (el, box) => { let { left, top, right, bottom } = box, scroller = false;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const r = a.getBoundingClientRect(); scroller ||= /auto|scroll/.test(s.overflowX);
      if (s.overflowX !== 'visible') { left = Math.max(left, r.left); right = Math.min(right, r.right); } if (s.overflowY !== 'visible') { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); } }
    return { left, top, right, bottom, width: right - left, height: bottom - top, scroller }; };
  for (const el of document.querySelectorAll('body, body *')) {
    const cs = getComputedStyle(el); if (!shown(el, cs) || chrome(el)) continue;
    const r = el.getBoundingClientRect(); if (!inView(r)) continue;
    const tag = el.tagName.toLowerCase(), map = el.computedStyleMap(), bi = cs.backgroundImage;
    const px = p => { const v = map.get(p); return v && v.unit === 'px' ? v.value : null; };
    const photo = ['img', 'video', 'canvas'].includes(tag) && !el.closest('[data-logo]') && !/platforms\//.test(el.currentSrc || el.src || '') || el.hasAttribute('data-photo') || /url\(/.test(bi);
    const gradient = /gradient\(/.test(bi) ? { radial: /radial-gradient\(/.test(bi), repeating: /repeating-/.test(bi),
      colors: [...new Set([...(bi.match(/rgba?\([^)]*\)/g) ?? []), cs.backgroundColor].filter(c => !clear(c)))] } : null;
    ids.set(el, els.length);
    els.push({ tag, part: el.dataset.part ?? null, rect: rel(r), parent: ids.get(el.parentElement) ?? -1, photo, gradient,
      alt: tag === 'img' ? el.getAttribute('alt') ?? '' : null, hasText: /\S/.test(el.innerText ?? ''),
      bg: clear(cs.backgroundColor) ? null : cs.backgroundColor,
      borders: [...new Set(['Top', 'Right', 'Bottom', 'Left'].filter(s => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && !clear(cs[`border${s}Color`])).map(s => cs[`border${s}Color`]))],
      radius: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(c => cs[`border${c}Radius`].split(' ')[0]).filter(v => parseFloat(v) > 0),
      shadow: cs.boxShadow !== 'none',
      space: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'row-gap', 'column-gap'].map(p => [p, px(p)]).filter(([, v]) => v) });
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/\S/.test(n.data)) continue;
    const p = n.parentElement, cs = getComputedStyle(p); if (!p || !ids.has(p) || ['script', 'style', 'noscript'].includes(p.tagName.toLowerCase())) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rs = [...range.getClientRects()].map(r => clipped(p, r)).filter(inView); if (!rs.length) continue;
    const box = { left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)), right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom)) };
    // What is behind the text, read at the middle of a line that can be seen. Text nothing shows at any point is not on the page.
    const ground = []; let seen = false;
    for (const r of rs) { const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, stack = document.elementsFromPoint(cx, cy);
      if (!stack.some(e => e === p || p.contains(e))) continue; seen = true;
      for (const e of stack) {
        const s = getComputedStyle(e), id = ids.get(e); if (id == null) continue;
        if (els[id].photo) { ground.push({ kind: 'photo' }); break; }
        if (els[id].gradient) { ground.push({ kind: 'gradient', el: id }); break; }
        if (!clear(s.backgroundColor)) { ground.push({ kind: 'fill', color: s.backgroundColor }); if (!/rgba\(/.test(s.backgroundColor)) break; }
      }
      break; }
    if (!seen) continue;
    const family = first(cs.fontFamily), group = p.parentElement && p.parentElement !== document.body ? p.parentElement : p;
    texts.push({ text: n.data, size: Math.round(parseFloat(cs.fontSize) * 10) / 10, weight: Number(cs.fontWeight), family: cs.fontFamily,
      display: family === faces.display, textFace: family === faces.text, color: cs.color, upper: cs.textTransform === 'uppercase',
      lines: new Set(rs.map(r => Math.round(r.top))).size, rect: rel(box), ground, scroller: rs.some(r => r.scroller),
      alone: !/\p{L}/u.test((group.innerText ?? '').replace(n.data, '')) });
  }
  return { index, w: vw, h: vh, els, texts };
}

// Share of a screenshot that is color, photo or neutral. Runs in the page, on a copy shrunk to 320 wide.
async function share({ png, photos, w, h }) {
  const bmp = await createImageBitmap(await (await fetch(png)).blob()), k = 320 / w, W = 320, H = Math.max(1, Math.round(h * k));
  const c = new OffscreenCanvas(W, H), g = c.getContext('2d'); g.drawImage(bmp, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data, lin = v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4, n = { color: 0, photo: 0, neutral: 0 };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (photos.some(([l, t, r, b]) => x >= l * k && x < r * k && y >= t * k && y < b * k)) { n.photo++; continue; }
    const i = (y * W + x) * 4, r = lin(d[i]), gr = lin(d[i + 1]), b = lin(d[i + 2]);
    const L = Math.cbrt(.4122214708 * r + .5363325363 * gr + .0514459929 * b), M = Math.cbrt(.2119034982 * r + .6806995451 * gr + .1073969566 * b), S = Math.cbrt(.0883024619 * r + .2817188376 * gr + .6299787005 * b);
    Math.hypot(1.9779984951 * L - 2.428592205 * M + .4505937099 * S, .0259040371 * L + .7827717662 * M - .808675766 * S) > .02 ? n.color++ : n.neutral++;
  }
  return { color: n.color / (W * H), photo: n.photo / (W * H), neutral: n.neutral / (W * H) };
}

// Opens the output at each of the medium's canvas sizes and measures every view.
export async function collect(file, { medium, sheet, tokensCss, browser }) {
  const names = [...tokensCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].filter(m => COLOR.test(m[2].trim()) || /^var\(--/.test(m[2].trim())).map(m => m[1]);
  const views = []; let colors, fontsLoaded = true;
  for (const canvas of sheet.canvas) {
    const page = await browser.newPage({ viewport: { width: canvas[0], height: canvas[1] }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve(file)).href); await page.evaluate(() => document.fonts.ready);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? '');
    const probe = await browser.newPage(); await probe.setContent(`<html data-theme="${theme}"><style>${tokensCss}</style><body><i id="p"></i>`);
    const got = await probe.evaluate(names => { const p = document.getElementById('p'), cs = getComputedStyle(p), out = { colors: {}, faces: {} };
      for (const n of [...new Set(names)]) { p.style.color = 'rgb(1, 2, 3)'; p.style.color = `var(--${n})`; const a = cs.color; p.parentElement.style.color = 'rgb(3, 2, 1)'; p.style.color = `var(--${n})`; if (cs.color === a) out.colors[n] = a; p.parentElement.style.color = ''; }
      for (const f of ['text', 'display']) { p.style.fontFamily = `var(--font-${f})`; out.faces[f] = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase(); }
      return out; }, names);
    await probe.close(); colors = got.colors;
    fontsLoaded &&= await page.evaluate(f => document.fonts.check(`16px "${f.text}"`) && document.fonts.check(`16px "${f.display}"`), got.faces);
    const marked = await page.evaluate(() => document.querySelectorAll('[data-view]').length);
    const steps = marked || Math.min(12, Math.ceil(await page.evaluate(() => document.documentElement.scrollHeight) / canvas[1]));
    for (let i = 0; i < steps; i++) {
      const rect = await page.evaluate(({ i, marked, h }) => {
        if (!marked) { scrollTo(0, i * h); return [0, 0, innerWidth, innerHeight]; }
        const el = document.querySelectorAll('[data-view]')[i]; el.scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' });
        const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, { i, marked, h: canvas[1] });
      // A screen that scrolls is measured whole: the window grows to its height for this view.
      const tall = sheet.scrolls && marked && rect[3] > canvas[1] + 1;
      if (tall) { await page.setViewportSize({ width: canvas[0], height: Math.ceil(rect[3]) }); await page.evaluate(i => document.querySelectorAll('[data-view]')[i].scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' }), i); }
      if (tall) { const r = await page.evaluate(i => { const b = document.querySelectorAll('[data-view]')[i].getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }, i); rect.splice(0, 4, ...r); }
      const view = await page.evaluate(measure, { index: views.length, rect, faces: got.faces, medium });
      const clip = { x: Math.max(0, rect[0]), y: Math.max(0, rect[1]), width: Math.min(rect[2], canvas[0]), height: Math.min(rect[3], tall ? Math.ceil(rect[3]) : canvas[1]) };
      const png = `data:image/png;base64,${(await page.screenshot({ clip })).toString('base64')}`;
      view.share = await page.evaluate(share, { png, photos: view.els.filter(e => e.photo).map(e => e.rect), w: clip.width, h: clip.height });
      views.push({ ...view, canvas, medium });
      if (tall) await page.setViewportSize({ width: canvas[0], height: canvas[1] });
    }
    await page.close();
  }
  return { views, colors, fontsLoaded };
}

export async function check(file, medium, { browser } = {}) {
  const media = JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8')), sheet = media[medium];
  if (!sheet) throw new Error(`no medium "${medium}" in brand/media.json; it has ${Object.keys(media).join(', ')}`);
  const pw = browser ? null : playwright(); if (!browser && !pw) throw new Error('Playwright is not installed here, so nothing can be rendered');
  const b = browser ?? await pw.chromium.launch();
  try {
    const facts = await collect(file, { medium, sheet, tokensCss: readFileSync(join(root, 'brand/tokens.css'), 'utf8'), browser: b });
    return { facts, findings: judge(facts, { medium, sheet, scales: scales(readFileSync(join(root, 'brand/constitution.md'), 'utf8')), colors: facts.colors }) };
  } finally { if (!browser) await b.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--')), medium = args[args.indexOf('--medium') + 1];
  if (!file || !args.includes('--medium')) { process.stderr.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n') + '\n'); process.exit(2); }
  const { facts, findings } = await check(file, medium);
  if (args.includes('--json')) process.stdout.write(JSON.stringify({ findings, views: facts.views.map(v => ({ index: v.index, share: v.share })) }, null, 2) + '\n');
  else {
    for (const f of findings) console.log(`${f.level === 'error' ? 'ERROR' : 'warn '} ${f.id}  ${f.where}  ${f.msg}`);
    const n = findings.filter(f => f.level === 'error').length;
    console.log(`${facts.views.length} view(s), ${facts.views.map(v => `${Math.round(v.share.color * 100)}%`).join(' ')} color. ${n ? `${n} error(s).` : `brand checks ok${findings.length ? ` (${findings.length} warning(s) to read)` : ''}`}`);
    console.log('A pass means the rules were followed, not that it looks good. Hand the render to a fresh judge with: node scripts/ui-rules.mjs judge');
  }
  process.exitCode = findings.some(f => f.level === 'error') ? 1 : 0;
}
