#!/usr/bin/env node
// Checks a rendered output against the brand: a deck, a post, a story, a web page or an app mock, written as HTML.
//   node scripts/brand-check.mjs <file.html|http://url> --medium app|web|post|story|deck [--json]
// It opens the file in headless Chromium at the medium's real size, measures every piece of text, box and color,
// and runs the constitution's Part IV on what it measured (.agents/checks/render.mjs). Exit code 1 on any error.
// A view is each element marked data-view (a slide, a post panel, a frame). With none, it is each screenful of the page.
// The marks it reads are listed in brand/constitution.md Part IV, under the table.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { judge } from '../.agents/checks/render.mjs';
import { scales } from '../.agents/checks/brand.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i;

// The brand faces, from a folder that is never committed: BRAND_FONTS if set, else fonts/ at the repo root, else
// app/assets/fonts/ where the app reads them (both gitignored). CI unpacks them from a secret (.github/workflows/check.yml).
// A file named for Clofie is the display face at 600; ppneuemontreal-book or text-400 is the text face at 400, and
// ppneuemontreal-medium or text-500 at 500.
export function brandFaces(tokensCss, dir = process.env.BRAND_FONTS || [join(root, 'fonts'), join(root, 'app/assets/fonts')].find(existsSync) || '') {
  if (!existsSync(dir)) return null;
  const family = v => tokensCss.match(new RegExp(`--font-${v}:\\s*"([^"]+)"`))?.[1], text = family('text'), display = family('display');
  const kinds = [[/clofie|display-600/i, display, 600], [/ppneuemontreal-medium|text-500/i, text, 500], [/ppneuemontreal-book|text-400/i, text, 400]];
  const rules = readdirSync(dir).filter(f => /\.(woff2?|otf|ttf)$/i.test(f)).flatMap(f => { const k = kinds.find(([re]) => re.test(f)); if (!k || !k[1]) return [];
    const type = { woff2: 'woff2', woff: 'woff', otf: 'opentype', ttf: 'truetype' }[f.split('.').pop().toLowerCase()];
    return [`@font-face { font-family: "${k[1]}"; font-weight: ${k[2]}; font-style: normal; src: url(data:font/${type};base64,${readFileSync(join(dir, f)).toString('base64')}) format("${type}"); }`]; });
  return rules.length ? rules.join('\n') : null;
}

export function playwright() {
  for (const from of [import.meta.url, pathToFileURL(join(process.env.NODE_PATH?.split(':')[0] ?? '/nonexistent', 'x.js')).href, pathToFileURL('/opt/node-tools/x.js').href])
    try { return createRequire(from)('playwright'); } catch { /* try the next place */ }
  return null;
}

// Runs in the page. Everything it returns is plain data.
function measure({ index, rect, faces, medium, kinds = [] }) {
  const [vx, vy, vw, vh] = rect, els = [], texts = [], ids = new Map();
  // A thing that names itself and the state it is drawn in: data-job="pricing" data-state="running". The kinds are the keys of "states" in .agents/ui-states.json.
  const marksOf = el => el.dataset.state == null && !kinds.some(k => el.dataset[k]) ? null : { state: el.dataset.state ?? null, skip: el.dataset.skip ?? '', names: Object.fromEntries(kinds.filter(k => el.dataset[k]).map(k => [k, el.dataset[k]])) };
  const first = s => s.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  const inView = r => r.width > 0 && r.height > 0 && r.right > vx && r.left < vx + vw && r.bottom > vy && r.top < vy + vh;
  const rel = r => [r.left - vx, r.top - vy, r.right - vx, r.bottom - vy].map(v => Math.round(v * 10) / 10);
  const clear = c => !c || c === 'transparent' || /^rgba\((?:[^,]+,){3}\s*0\)$/.test(c);
  const shown = (el, cs) => cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0;
  // The phone's own status bar and home bar in an app mock are not ours to set. Only the top and bottom strips can be marked.
  const chrome = el => { const c = medium === 'app' && el.closest('[data-chrome]'); if (!c) return false; const r = c.getBoundingClientRect(); return r.bottom <= vy + 60 || r.top >= vy + vh - 40; };
  // The part of a box that its scrolling or clipping ancestors let through.
  // cut: a box that hides its overflow (not one that scrolls) took part of it away. dots: that box ends cut text with an ellipsis or a line clamp.
  const clipped = (el, box) => { let { left, top, right, bottom } = box, scroller = false, cut = false, dots = false;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const r = a.getBoundingClientRect(), was = [left, top, right, bottom]; scroller ||= /auto|scroll/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1;
      if (s.overflowX !== 'visible') { left = Math.max(left, r.left); right = Math.min(right, r.right); } if (s.overflowY !== 'visible') { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
      const lost = was[2] - was[0] - Math.max(0, right - left) > 1 && /hidden|clip/.test(s.overflowX) || was[3] - was[1] - Math.max(0, bottom - top) > 1 && /hidden|clip/.test(s.overflowY);
      if (lost && !scroller && !a.hasAttribute('data-view')) { cut = true; dots ||= s.textOverflow === 'ellipsis' || (s.webkitLineClamp ?? 'none') !== 'none'; } }
    return { left, top, right, bottom, width: right - left, height: bottom - top, scroller, cut, dots }; };
  for (const el of document.querySelectorAll('html, body, body *')) {
    const cs = getComputedStyle(el); if (!shown(el, cs) || chrome(el)) continue;
    const r = el.getBoundingClientRect(); if (!inView(r)) continue;
    const tag = el.tagName.toLowerCase(), map = el.computedStyleMap(), bi = cs.backgroundImage;
    const px = p => { const v = map.get(p); return v && v.unit === 'px' ? v.value : null; };
    const photo = ['img', 'video', 'canvas'].includes(tag) && !el.closest('[data-logo]') && !/platforms\//.test(el.currentSrc || el.src || '') || el.hasAttribute('data-photo') || /url\(/.test(bi) && !(cs.backgroundRepeat.startsWith('no-repeat') && cs.backgroundSize.split(' ').every(v => v === 'auto' || v.endsWith('px') && parseFloat(v) <= 32));
    const gradient = /gradient\(/.test(bi) ? { raw: bi, base: cs.backgroundColor, radial: /radial-gradient\(/.test(bi), repeating: /repeating-/.test(bi), conic: /conic-gradient\(/.test(bi),
      colors: [...new Set([...(bi.match(/(?:rgba?|hsla?|oklch|oklab|lch|lab|color|color-mix)\((?:[^()]|\([^()]*\))*\)/g) ?? []), cs.backgroundColor].filter(c => !clear(c)))] } : null;
    ids.set(el, els.length);
    const logo = tag === 'img' && !photo;
    els.push({ tag, part: el.dataset.part ?? null, current: el.hasAttribute('aria-current') && el.getAttribute('aria-current') !== 'false', item: el.hasAttribute('data-item'), link: el.matches('a[href], [role=link]'), button: el.matches('button, [role=button]'), pointer: cs.cursor === 'pointer', block: !/^inline/.test(cs.display) && cs.display !== 'contents', fit: el.dataset.fit ?? null, fill: el.dataset.fill ?? null, marks: marksOf(el), rect: rel(r), parent: ids.get(el.parentElement) ?? -1, photo, logo, gradient, paints: tag === 'img' || tag === 'svg' || photo || !!gradient,
      alt: tag === 'img' ? el.getAttribute('alt') : el.getAttribute('aria-label'), src: tag === 'img' ? decodeURI(el.currentSrc || el.src || '') : /url\(/.test(bi) ? decodeURI(bi.match(/url\(["']?([^"')]+)/)?.[1] ?? '') : null, noAlt: tag === 'img' && !el.hasAttribute('alt'), hasText: /\S/.test(el.innerText ?? ''),
      bg: clear(cs.backgroundColor) ? null : cs.backgroundColor,
      borders: [...new Set(['Top', 'Right', 'Bottom', 'Left'].filter(s => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && !clear(cs[`border${s}Color`])).map(s => cs[`border${s}Color`]))],
      radius: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(c => cs[`border${c}Radius`].split(' ')[0]).filter(v => parseFloat(v) > 0),
      corners: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(c => { const v = cs[`border${c}Radius`].split(' ')[0]; return Math.min(v.endsWith('%') ? parseFloat(v) / 100 * Math.min(r.width, r.height) : parseFloat(v) || 0, r.width / 2, r.height / 2); }),
      // A shadow is depth when it is soft. A layer with no blur is a ring: the focus ring, a selected photo.
      shadow: cs.boxShadow !== 'none' && cs.boxShadow.split(/,(?![^(]*\))/).some(l => parseFloat(l.replace(/rgba?\([^)]*\)|inset/g, '').trim().split(/\s+/)[2]) > 0),
      space: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'row-gap', 'column-gap'].map(p => [p, px(p)]).filter(([, v]) => v) });
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/\S/.test(n.data)) continue;
    const p = n.parentElement, cs = getComputedStyle(p); if (!p || !ids.has(p) || ['script', 'style', 'noscript'].includes(p.tagName.toLowerCase())) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    // A line set tighter than its glyph box (line-height under about 1.2) is measured as the line, so a heading that starts on a margin is on it.
    const lh = parseFloat(cs.lineHeight), line = r => { const cut = lh && r.height > lh ? (r.height - lh) / 2 : 0; return { left: r.left, right: r.right, top: r.top + cut, bottom: r.bottom - cut, width: r.width, height: r.height - 2 * cut }; };
    // Faded to nothing (a toast that has left), or clipped to a dot (a label only a screen reader gets): not on the page.
    let alpha = 1; for (let a = p; a && a !== document.documentElement; a = a.parentElement) alpha *= Number(getComputedStyle(a).opacity);
    const all = [...range.getClientRects()].map(r => clipped(p, line(r))), rs = all.filter(inView).filter(r => r.width > 1.5 && r.height > 1.5); if (!rs.length || alpha < .05) continue;
    const box = { left: Math.min(...rs.map(r => r.left)), top: Math.min(...rs.map(r => r.top)), right: Math.max(...rs.map(r => r.right)), bottom: Math.max(...rs.map(r => r.bottom)) };
    // What is behind the text, read at the middle of a line that can be seen. Text nothing shows at any point is not on the page.
    const ground = []; let seen = false;
    const solid = e => { const id = ids.get(e); return id != null && (els[id].photo || els[id].gradient || /^rgb\(/.test(getComputedStyle(e).backgroundColor) || Number(getComputedStyle(e).backgroundColor.match(/[\d.]+(?=\)$)/)?.[0]) >= .99); };
    for (const r of rs) { const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, stack = document.elementsFromPoint(cx, cy);
      // Text that taps pass through (pointer-events: none) never shows up at its own point, so it is taken as seen. Anything else must be there,
      // with nothing solid painted over it: a row scrolled under a bar, or behind a floating button, is covered.
      const at = stack.findIndex(e => e === p || p.contains(e)); if (at < 0 && cs.pointerEvents !== 'none') continue;
      if (stack.slice(0, Math.max(at, 0)).some(e => !e.contains(p) && solid(e))) continue; seen = true;
      for (const e of at < 0 ? stack : stack.slice(at)) {
        const s = getComputedStyle(e), id = ids.get(e); if (id == null) continue;
        if (els[id].photo) { ground.push({ kind: 'photo' }); break; }
        if (els[id].gradient) { ground.push({ kind: 'gradient', el: id }); break; }
        if (!clear(s.backgroundColor)) { ground.push({ kind: 'fill', color: s.backgroundColor }); if (!/rgba\(/.test(s.backgroundColor)) break; }
      }
      break; }
    if (!seen) continue;
    // What has been done to the letters: a transform, a filter or a fade anywhere above them, and a shadow, stroke, outline or motion on them.
    const fx = []; for (let a = p; a && a !== document.body && !a.hasAttribute('data-view'); a = a.parentElement) { const s = getComputedStyle(a);
      if (s.transform !== 'none' && !/^matrix\(1, 0, 0, 1, 0, 0\)$|^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\)$/.test(s.transform)) fx.push('transformed'); if (s.filter !== 'none') fx.push('filtered'); if (Number(s.opacity) < 1) fx.push('faded'); if (s.animationName !== 'none') fx.push('moving'); }
    if (cs.textShadow !== 'none') fx.push('shadowed'); if (parseFloat(cs.webkitTextStrokeWidth) > 0) fx.push('stroked'); if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) fx.push('outlined');
    const family = first(cs.fontFamily);
    // An amount is alone when no words sit with it: in its own box, or in the row or block that holds it, up to three boxes out and never the whole view.
    let group = p; for (let a = p.parentElement, i = 0; a && i < 3 && a !== document.body && !a.hasAttribute('data-view'); a = a.parentElement, i++) { group = a; if (/\p{L}/u.test((a.innerText ?? '').replace(n.data, ''))) break; }
    // lead: the first words of their block, set from its start edge. Those are the left edges the eye lines up.
    let blk = p; while (blk.parentElement && blk !== document.body && /^inline|contents/.test(getComputedStyle(blk).display)) blk = blk.parentElement;
    const firstText = document.createTreeWalker(blk, NodeFilter.SHOW_TEXT, { acceptNode: x => /\S/.test(x.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }).nextNode();
    const lead = firstText === n && /^(?:start|left|-webkit-auto)$/.test(getComputedStyle(blk).textAlign) && !/center|end|around|between|evenly/.test(getComputedStyle(blk.parentElement ?? blk).justifyContent);
    const press = p.closest('button, a, summary, [role=button], [role=link]'), control = !!press, controlAt = press ? ids.get(press) ?? -1 : -1, disabled = !!p.closest('[disabled], [aria-disabled="true"]');
    texts.push({ text: n.data, size: Math.round(parseFloat(cs.fontSize) * 10) / 10, lh: parseFloat(cs.lineHeight) ? Math.round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) * 1000) / 1000 : null, tr: Math.round((parseFloat(cs.letterSpacing) || 0) / parseFloat(cs.fontSize) * 1000) / 1000, weight: Number(cs.fontWeight), family: cs.fontFamily,
      display: family === faces.display, textFace: family === faces.text, color: cs.webkitTextFillColor || cs.color, upper: cs.textTransform === 'uppercase',
      caps: cs.textTransform === 'capitalize' ? 'capitalized by CSS' : cs.fontVariantCaps !== 'normal' ? 'set in small capitals' : null, italic: cs.fontStyle !== 'normal', stroked: parseFloat(cs.webkitTextStrokeWidth) > 0,
      lines: new Set(rs.map(r => Math.round(r.top))).size, rect: rel(box), ground, el: ids.get(p), fx: [...new Set(fx)], scroller: rs.some(r => r.scroller), control, controlAt, disabled, lead, opacity: alpha,
      cut: all.some(r => r.cut), dots: all.some(r => r.dots), fill: p.closest('[data-fill]')?.dataset.fill ?? null, full: rel(range.getBoundingClientRect()), ink: (() => { const f = rel(range.getBoundingClientRect()), g = document.createElement('canvas').getContext('2d'); g.font = cs.font; const m = g.measureText(n.data);
        // The range box is the font's content area; the letters sit inside it. A thing holds its ink, which is what a person sees.
        return m.fontBoundingBoxAscent ? [f[0], f[1] + Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent), f[2], f[3] - Math.max(0, m.fontBoundingBoxDescent - m.actualBoundingBoxDescent)] : f; })(),
      alone: !/\p{L}/u.test((group.innerText ?? '').replace(n.data, '')) });
  }
  return { index, w: vw, h: vh, els, texts };
}

// Where a state moves things (U7). Runs in the page. For each group of siblings where one is marked current (aria-current, aria-selected,
// aria-pressed, aria-checked, or a class such as "on" or "active" that only it has), the mark is moved to each sibling in turn,
// and every sibling, everything inside them, and their parent must stay where it was. A state changes how a thing looks, not where things sit.
function shifts({ rect }) {
  const [vx, vy, vw, vh] = rect, out = [], done = new Set(), ARIA = ['aria-current', 'aria-selected', 'aria-pressed', 'aria-checked'], CLASS = /^(?:is-)?(?:on|active|current|selected|sel)$/;
  const inView = r => r.width > 0 && r.height > 0 && r.right > vx && r.left < vx + vw && r.bottom > vy && r.top < vy + vh;
  const name = e => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 24) || `<${e.tagName.toLowerCase()}${e.dataset.part ? ` ${e.dataset.part}` : ''}>`;
  const still = document.createElement('style'); still.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }'; document.head.append(still);
  for (const cur of document.querySelectorAll('body *')) {
    const aria = ARIA.find(a => cur.hasAttribute(a) && cur.getAttribute(a) !== 'false');
    if (!aria && ![...cur.classList].some(c => CLASS.test(c))) continue;
    const p = cur.parentElement; if (!p || done.has(p) || !inView(cur.getBoundingClientRect())) continue;
    const sibs = [...p.children].filter(s => s.tagName === cur.tagName && getComputedStyle(s).display !== 'none'); if (sibs.length < 2 || !sibs.includes(cur)) continue;
    const only = [...cur.classList].filter(c => CLASS.test(c) && sibs.every(s => s === cur || !s.classList.contains(c)));
    if (!aria && !only.length) continue;
    done.add(p);
    const was = sibs.map(s => ({ s, v: aria ? s.getAttribute(aria) : null, c: s.className }));
    const snap = () => ({ p: p.getBoundingClientRect(), all: sibs.map(s => [s, ...s.querySelectorAll('*')].map(e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return cs.display === 'none' || cs.visibility === 'hidden' || !b.width || !b.height ? null : { e, b }; })) });
    const on = aria && cur.getAttribute(aria), mark = to => { for (const s of sibs) { if (aria) s.setAttribute(aria, s === to ? on : 'false');
      for (const c of only) s.classList.toggle(c, s === to); } };
    const base = snap();
    for (const to of sibs) { if (to === cur) continue; mark(to); const now = snap(), how = aria ? `${aria} on "${name(to)}"` : `.${only[0]} on "${name(to)}"`, seen = new Set();
      const d = (a, b) => Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height));
      if (d(base.p, now.p) > .5) out.push({ how, who: `the row holding "${name(cur)}"`, by: Math.round(d(base.p, now.p)) });
      base.all.forEach((list, i) => list.forEach((x, j) => { const y = now.all[i][j]; if (!x || !y || seen.has(i)) return; const m = d(x.b, y.b);
        if (m > .5) { seen.add(i); out.push({ how, who: name(x.e), by: Math.round(m * 10) / 10 }); } })); }
    for (const w of was) { if (aria) { if (w.v == null) w.s.removeAttribute(aria); else w.s.setAttribute(aria, w.v); } w.s.className = w.c; }
  }
  still.remove();
  return out.slice(0, 6);
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
// The darkest and the lightest pixel under each box, read from a screenshot taken with the text hidden. Runs in the page.
async function under({ png, boxes }) {
  const bmp = await createImageBitmap(await (await fetch(png)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  const lin = v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  return boxes.map(([l, t, r, b]) => { const x = Math.max(0, Math.floor(l)), y = Math.max(0, Math.floor(t)), w = Math.min(bmp.width, Math.ceil(r)) - x, h = Math.min(bmp.height, Math.ceil(b)) - y; if (w < 1 || h < 1) return null;
    const d = g.getImageData(x, y, w, h).data; let lo = null, hi = null, min = 2, max = -1;
    for (let i = 0; i < d.length; i += 4) { const L = .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); if (L < min) { min = L; lo = [d[i], d[i + 1], d[i + 2]]; } if (L > max) { max = L; hi = [d[i], d[i + 1], d[i + 2]]; } }
    return { lo, hi }; });
}

// The same pixels as page.screenshot({ clip }) (checked on every render fixture), taken through Chromium's own call with its fast PNG
// setting, about twice as fast on a full slide. Its clip is measured from the top of the document, page.screenshot's from the viewport.
async function snap(page, clip) {
  const cdp = await page.context().newCDPSession(page);
  const [x, y] = await page.evaluate(() => [scrollX, scrollY]);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, x: clip.x + x, y: clip.y + y, scale: 1 }, optimizeForSpeed: true });
  await cdp.detach();
  return `data:image/png;base64,${data}`;
}

// The tokens as the browser reads them depend only on tokens.css and the theme, so each browser reads them once.
const tokenReads = new WeakMap();
function readTokens(browser, tokensCss, theme, names) {
  const reads = tokenReads.get(browser) ?? tokenReads.set(browser, new Map()).get(browser), key = `${theme}\n${tokensCss}`;
  if (!reads.has(key)) reads.set(key, probeTokens(browser, tokensCss, theme, names));
  return reads.get(key).then(structuredClone);
}
async function probeTokens(browser, tokensCss, theme, names) {
  const probe = await browser.newPage(); await probe.setContent(`<html><style>${tokensCss}</style><body><i id="p"></i>`); await probe.evaluate(t => { if (t) document.documentElement.dataset.theme = t; }, theme);
  const got = await probe.evaluate(({ names, grads, lengths }) => { const p = document.getElementById('p'), cs = getComputedStyle(p), out = { colors: {}, faces: {}, lengths: [], named: {}, grads: {} }; p.style.display = 'block';
    const read = () => { const o = {}; for (const n of [...new Set(names)]) { p.style.color = 'rgb(1, 2, 3)'; p.style.color = `var(--${n})`; const a = cs.color; p.parentElement.style.color = 'rgb(3, 2, 1)'; p.style.color = `var(--${n})`; if (cs.color === a) o[n] = a; p.parentElement.style.color = ''; } return o; };
    // The light palette too: a state gradient and a state tag stay light in dark (Art. 5), so what sits on them is read in light.
    const root = document.documentElement, was = root.dataset.theme; out.colors = read(); root.dataset.theme = 'light'; out.light = read(); if (was) root.dataset.theme = was; else delete root.dataset.theme;
    out.calmMax = parseFloat(getComputedStyle(root).getPropertyValue('--field-calm-max')) / 100 || null;
    // The gradients the tokens hold (the field, the wash), as the browser writes them, so a page's gradient can be told from one it rebuilt.
    for (const n of grads) { p.style.background = `var(--${n})`; if (/gradient\(/.test(cs.backgroundImage)) out.grads[n] = { raw: cs.backgroundImage, base: cs.backgroundColor }; p.style.background = ''; }
    for (const [k, v] of lengths) { p.style.width = `var(--${k})`; out.lengths.push(parseFloat(cs.width) || v); out.named[k] = parseFloat(cs.width) || v; }
    for (const f of ['text', 'display']) { p.style.fontFamily = `var(--font-${f})`; out.faces[f] = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase(); }
    out.textWeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--w-text')) || 400;
    return out; }, { names, grads: [...new Set([...tokensCss.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1]))], lengths: [...tokensCss.matchAll(/--((?!s-|t-|r-|lh-|tr-)[\w-]+)\s*:\s*(\d+(?:\.\d+)?)px\s*;/g)].map(m => [m[1], Number(m[2])]) });
  await probe.close();
  return got;
}

export async function collect(file, { medium, sheet, tokensCss, browser, cases = [], kinds = [] }) {
  const faces = brandFaces(tokensCss);
  const names = [...tokensCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].filter(m => COLOR.test(m[2].trim()) || /^var\(--/.test(m[2].trim())).map(m => m[1]);
  const views = [], stressed = [], outside = []; let colors, lightColors, calmMax, lengths = [], named = {}, grads = {}, textWeight = 400, fontsLoaded = true, screens = 0, scaled = false;
  for (const canvas of sheet.canvas) {
    const page = await browser.newPage({ viewport: { width: canvas[0], height: canvas[1] }, deviceScaleFactor: 1 });
    await page.goto(/^https?:\/\//.test(file) ? file : pathToFileURL(resolve(file)).href);
    if (faces) { await page.addStyleTag({ content: faces }); await page.evaluate(() => Promise.all([...document.fonts].map(f => f.load().catch(() => null)))); }
    await page.evaluate(() => document.fonts.ready);
    const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? '');
    const got = await readTokens(browser, tokensCss, theme, names);
    colors = got.colors; lightColors = got.light; calmMax = got.calmMax; lengths = got.lengths; named = got.named; grads = got.grads; textWeight = got.textWeight;
    // A face is here when text set in it measures differently from the same text in two generic fallbacks. document.fonts.check() says yes to a face it has never heard of.
    fontsLoaded &&= await page.evaluate(f => { const g = document.createElement('canvas').getContext('2d'), w = font => { g.font = font; return g.measureText('secondhand $46.95 Wag').width; };
      return [f.text, f.display].every(face => ['monospace', 'serif'].some(fb => w(`40px "${face}", ${fb}`) !== w(`40px ${fb}`)) && ['monospace', 'serif'].every(fb => w(`40px "${face}", ${fb}`) === w(`40px "${face}", ${fb === 'serif' ? 'monospace' : 'serif'}`))); }, got.faces);
    const marked = await page.evaluate(() => document.querySelectorAll('[data-view]').length);
    scaled ||= await page.evaluate(() => [document.documentElement, document.body, ...document.querySelectorAll('[data-view]')].some(el => { const s = getComputedStyle(el); return s.transform !== 'none' || Number(s.zoom || 1) !== 1 || (s.scale ?? 'none') !== 'none'; }));
    const tall = Math.ceil(await page.evaluate(() => document.documentElement.scrollHeight) / canvas[1]), steps = marked || Math.min(40, tall); if (!marked) screens = Math.max(screens, tall);
    // Once one view is marked, everything that shows belongs in a view. Text outside them all would be checked by nothing.
    if (marked) outside.push(...await page.evaluate(() => { const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (!/\S/.test(n.data) || p.closest('[data-view], script, style, noscript, template')) continue; const s = getComputedStyle(p), r = p.getBoundingClientRect();
        if (s.display !== 'none' && s.visibility !== 'hidden' && r.width > 1.5 && r.height > 1.5) out.push(n.data.trim().slice(0, 40)); }
      return out.slice(0, 3); }));
    // Measures view i as it stands now. With a screenshot it also reads the share of color.
    const shot = async (i, index, old) => {
      const rect = await page.evaluate(({ i, marked, h }) => {
        if (!marked) { scrollTo({ top: i * h, behavior: 'instant' }); return [0, 0, innerWidth, innerHeight]; }
        const el = document.querySelectorAll('[data-view]')[i]; el.scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' });
        const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, { i, marked, h: canvas[1] });
      // A screen that scrolls is measured whole: the window grows to its height for this view.
      const tall = sheet.scrolls && marked && rect[3] > canvas[1] + 1;
      if (tall) { await page.setViewportSize({ width: canvas[0], height: Math.ceil(rect[3]) }); await page.evaluate(i => document.querySelectorAll('[data-view]')[i].scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' }), i); }
      if (tall) { const r = await page.evaluate(i => { const b = document.querySelectorAll('[data-view]')[i].getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }, i); rect.splice(0, 4, ...r); }
      const view = await page.evaluate(measure, { index, rect, faces: got.faces, medium, kinds });
      view.marks = marked ? await page.evaluate(({ i, kinds }) => { const d = document.querySelectorAll('[data-view]')[i].dataset; return d.state == null && !kinds.some(k => d[k]) ? null : { state: d.state ?? null, skip: d.skip ?? '', names: Object.fromEntries(kinds.filter(k => d[k]).map(k => [k, d[k]])) }; }, { i, kinds }) : null;
      if (!old) view.shifts = await page.evaluate(shifts, { rect });
      view.layout = marked ? await page.evaluate(i => document.querySelectorAll('[data-view]')[i].dataset.layout ?? null, i) : null;
      if (old) view.share = old.share;
      else { const clip = { x: Math.max(0, rect[0]), y: Math.max(0, rect[1]), width: Math.min(rect[2], canvas[0]), height: Math.min(rect[3], tall ? Math.ceil(rect[3]) : canvas[1]) };
        const png = await snap(page, clip);
        view.share = await page.evaluate(share, { png, photos: view.els.filter(e => e.photo).map(e => e.rect), w: clip.width, h: clip.height });
        // Text over a gradient has no one color behind it, so its ground is read from the pixels, with the text hidden (Ben, 03:22: "how do you ensure when you layer colors whether its readable or not").
        const over = view.texts.map((t, k) => t.ground.some(g => g.kind === 'gradient') ? k : -1).filter(k => k >= 0);
        if (over.length) { const hide = await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; transition: none !important; }' });
          const bare = await snap(page, clip); await hide.evaluate(e => e.remove());
          const got = await page.evaluate(under, { png: bare, boxes: over.map(k => view.texts[k].rect) }); over.forEach((k, j) => { view.texts[k].under = got[j]; }); } }
      if (tall) await page.setViewportSize({ width: canvas[0], height: canvas[1] });
      return { ...view, canvas, medium };
    };
    const mine = [];
    for (let i = 0; i < steps; i++) { const v = await shot(i, views.length); views.push(v); mine.push(v); }
    // The same views again with each piece of extreme content from .agents/ui-states.json put into the slots marked data-fill, then put back.
    for (const c of marked ? cases : []) {
      const slots = await page.evaluate(c => { const slots = [...document.querySelectorAll(`[data-fill="${c.fill}"]`)];
        window.__undo = slots.map(el => { if (c.fill !== 'photo') { const was = { el, html: el.innerHTML }; el.textContent = c.value; return was; }
          const img = el.matches('img') ? el : el.querySelector('img') ?? el, was = { el: img, src: img.getAttribute('src'), bg: img.style.backgroundImage }; img.removeAttribute('src'); img.style.backgroundImage = 'none'; return was; });
        return slots.map(el => [...document.querySelectorAll('[data-view]')].findIndex(v => v.contains(el))); }, c);
      for (const i of [...new Set(slots)].filter(i => i >= 0)) stressed.push({ ...await shot(i, mine[i].index, mine[i]), stress: c });
      await page.evaluate(() => { for (const u of window.__undo ?? []) { if ('html' in u) u.el.innerHTML = u.html; else { if (u.src != null) u.el.setAttribute('src', u.src); u.el.style.backgroundImage = u.bg; } } });
    }
    await page.close();
  }
  return { views, stressed, colors, lightColors, calmMax, lengths, named, grads, textWeight, fontsLoaded, fontsRequired: !!process.env.BRAND_FONTS, outside: [...new Set(outside)], screens, scaled };
}

export async function check(file, medium, { browser } = {}) {
  const media = JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8')), sheet = media[medium];
  if (!sheet) throw new Error(`no medium "${medium}" in brand/media.json; it has ${Object.keys(media).join(', ')}`);
  const pw = browser ? null : playwright(); if (!browser && !pw) throw new Error('Playwright is not installed here, so nothing can be rendered');
  const b = browser ?? await pw.chromium.launch();
  try {
    const states = JSON.parse(readFileSync(join(root, '.agents/ui-states.json'), 'utf8'));
    const facts = await collect(file, { medium, sheet, tokensCss: readFileSync(join(root, 'brand/tokens.css'), 'utf8'), browser: b, cases: states.content, kinds: Object.keys(states.states) });
    return { facts, findings: judge(facts, { medium, sheet, scales: scales(readFileSync(join(root, 'brand/constitution.md'), 'utf8')), colors: facts.colors, states: states.states }) };
  } finally { if (!browser) await b.close(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--medium'), medium = at < 0 ? null : args[at + 1], file = args.find((a, i) => !a.startsWith('--') && i !== at + 1);
  const stop = msg => { process.stderr.write(`${msg}\n`); process.exit(2); };
  if (file && medium && !/^https?:\/\//.test(file) && !existsSync(file)) stop(`no file ${file}`);
  if (file && medium && !Object.keys(JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8'))).includes(medium)) stop(`no medium "${medium}": it is app, web, post, story or deck`);
  if (!file || !medium) { process.stderr.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n') + '\n'); process.exit(2); }
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
