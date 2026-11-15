// The brand constitution's Part IV, held on a rendered output: a deck, a post, a story, a web page or an app mock.
// scripts/brand-check.mjs opens the output in a browser and hands what it measured to judge() here.
// The numbers for each medium are in brand/media.json; the scales and colors come from the constitution and tokens.css.
import { scan } from '../../scripts/copy-lint.mjs';
import { oklch, contrast } from './picks.mjs';

const err = (id, where, msg) => ({ level: 'error', id, where, msg });
const warn = (id, where, msg) => ({ level: 'warn', id, where, msg });

export const RING = ['lilac', 'sky', 'aqua', 'mint', 'lime', 'marigold', 'peach', 'pink'];
const SITES = /\b(?:eBay|Poshmark|Depop|Mercari|Grailed|OfferUp|Etsy|Vinted|Facebook Marketplace)\b/;
const SITE_FILE = /(?:^|[\/_.-])(ebay|depop|poshmark|mercari|facebook|grailed|offerup|etsy|vinted)(?=[\/_.-])[^\/]*\.(?:png|svg|jpe?g|webp|gif)$/i;
const SITE_NAME = { ebay: 'eBay', depop: 'Depop', poshmark: 'Poshmark', mercari: 'Mercari', facebook: 'Facebook', grailed: 'Grailed', offerup: 'OfferUp', etsy: 'Etsy', vinted: 'Vinted' };
const MONEY = /^[\s(]*[-+]?(?:[A-Z]{2,3})?\p{Sc}\s?\d[\d,.]*[kKmM]?[\s)]*$|^[\s(]*[-+]?\d[\d,.]*\s?\p{Sc}[\s)]*$/u;

// "rgb(1, 2, 3)" or "rgba(1, 2, 3, 0.5)" as [r, g, b, a]. Anything else (oklch(), color()) is not a token value.
// color(srgb 1 1 1 / 0.25) is how the browser writes a color-mix() inside a gradient.
const alphaOf = a => a == null ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : +a;
export const rgba = s => { const m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s ?? ''); if (m) return [+m[1], +m[2], +m[3], alphaOf(m[4])];
  const c = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(s ?? ''); return c ? [c[1] * 255, c[2] * 255, c[3] * 255, alphaOf(c[4])] : null; };
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3]));
const near = (a, b, room = .15) => Math.abs(a - b) <= room;
const turn = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const short = s => { const t = s.replace(/\s+/g, ' ').trim(); return `"${t.length > 40 ? t.slice(0, 37) + '...' : t}"`; };

// Words as the constitution counts them: two characters are a word in Chinese, Japanese and Korean (Art. 6, Any language).
const SEG = new Intl.Segmenter(undefined, { granularity: 'word' });
export const words = s => { const cjk = (s.match(/[぀-ヿ㐀-鿿가-힯]/g) ?? []).length;
  return Math.ceil(cjk / 2) + [...SEG.segment(s.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ').replace(/(\d)[.,](?=\d)/g, '$1'))].filter(x => x.isWordLike).length; };
// Capitals are read from the letters that have a case, leaving out words with a digit in them (a postcode, a model number).
export const allCaps = s0 => { const s = s0.split(/\s+/).filter(w => !/\d/.test(w)).join(' '), l = s.match(/[\p{Lu}\p{Ll}]/gu) ?? []; return l.length >= 4 && s === s.toUpperCase() && s !== s.toLowerCase(); };
export const titleCase = s => { const w = s.trim().split(/\s+/).filter(x => /^\p{L}{4,}$/u.test(x)); return w.length >= 3 && w.every(x => x[0] !== x[0].toLowerCase()); };

// The colors a medium may use, by token name: { light: { ink: 'rgb(10, 10, 10)', ... } } as the browser computes them.
function palette(colors, grads = {}) {
  // Two tokens may hold one value (the second ink, and the second ink on a field). The name the rules know wins.
  const rank = n => TEXT_INK.has(n) ? 0 : hueOf(n) ? 1 : LINE_INK.has(n) ? 2 : 3, byValue = new Map();
  for (const [n, v] of Object.entries(colors)) if (!byValue.has(v) || rank(n) < rank(byValue.get(v))) byValue.set(v, n);
  const name = v => byValue.get(v) ?? (v === 'rgb(255, 255, 255)' ? 'white' : null);
  return { name, of: n => rgba(colors[n]), raw: n => colors[n], has: v => name(v) != null, grads };
}
const TEXT_INK = new Set(['ink', 'on-color', 'ink-2', 'ink-disabled', 'page', 'white', 'brick', 'brick-deep', 'on-field', 'on-field-2']);
const LINE_INK = new Set(['ink', 'on-color', 'outline', 'rule', 'card-edge', 'ink-2', 'ink-disabled', 'brick', 'page', 'white']);
const hueOf = n => RING.find(h => n === h || n === `${h}-tint`);
const size = el => [el.rect[2] - el.rect[0], el.rect[3] - el.rect[1]];
// A pill by shape: the token, or a corner as round as the box allows.
const pill = el => el.radius.some(r => r === '50%' && Math.abs(size(el)[0] - size(el)[1]) > 1 || parseFloat(r) >= 999 || !r.endsWith('%') && parseFloat(r) >= Math.min(...size(el)) / 2 - .5);
const act = (el, pal) => ['ink', 'ink-press'].includes(pal.name(el.bg)) && pill(el) && el.hasText;
const cy = el => (el.rect[1] + el.rect[3]) / 2;
// How a color looks without red cones or without green cones (Machado, Oliveira and Fernandes 2009, severity 1), as a point in Oklab.
const CVD = { 'no red cones': [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]], 'no green cones': [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.01182, .04294, .968881]] };
const lin = v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
const oklab = ([r, g, b]) => { const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s]; };
export const seenAs = (rgb, kind) => oklab(CVD[kind].map(row => Math.min(1, Math.max(0, row[0] * lin(rgb[0]) + row[1] * lin(rgb[1]) + row[2] * lin(rgb[2])))));

// Every gradient is a token used as it stands: the field (C2), the wash behind a screen's header (Art. 5), any other gradient tokens.css holds.
// The one gradient written in place is a state tag, which runs from one hue's tint to its fill (ledger L18). Anything else was built by hand.
function gradientKind(el, pal) {
  const g = el.gradient, tokens = Object.entries(pal.grads).filter(([n]) => !n.endsWith('-mesh'));
  const held = tokens.find(([n, t]) => t.raw === g.raw && (n.startsWith('wash') || t.base === g.base))?.[0] ?? tokens.find(([n, t]) => alike(g.raw, t.raw) && (n.startsWith('wash') || same(rgba(g.base), rgba(t.base))))?.[0];
  if (held) return held.startsWith('wash') ? 'wash' : held.startsWith('field') ? 'field' : 'token';
  const st = stateOf(g, pal); if (st) return st.startsWith('light:') ? 'pale' : 'state';
  const names = g.colors.map(c => pal.name(c) ?? pal.light?.name(c) ?? null), hues = new Set(names.map(n => n && hueOf(n)));
  if (names.length && names.every(n => /^hot-[12]$/.test(n ?? '')) && new Set(names).size === 2) return 'tag';
  return hues.size === 1 && !hues.has(undefined) && !hues.has(null) && names.some(n => n.endsWith('-tint')) ? 'tag' : 'built';
}

// React Native has no var(), so the app writes the wash and the state gradients out in code. Such a gradient is read as the
// token it stands for when its layers have the token's shape and its stops the token's colors. Clear is clear, whatever its rgb.
const STOP = /(?:rgba?|color)\((?:[^()]|\([^()]*\))*\)|transparent/g;
const layers = raw => raw.replace(/(?:,\s*none)+$/, '').replace(/linear-gradient\(180deg,\s*/g, 'linear-gradient(');
const stops = raw => (layers(raw).match(STOP) ?? []).map(c => c === 'transparent' ? [0, 0, 0, 0] : rgba(c));
const same = (a, b) => !!a && !!b && (a[3] < .01 && b[3] < .01 || [0, 1, 2].every(i => Math.abs(a[i] - b[i]) <= 1.5) && Math.abs(a[3] - b[3]) <= .01);
const alike = (raw, token) => { const a = stops(raw), b = stops(token); return layers(raw).replace(STOP, 'C') === layers(token).replace(STOP, 'C') && a.length === b.length && a.every((c, i) => same(c, b[i])); };

// A state gradient (Art. 5, State gradients): the field's mesh, with its first color under it, every stop mixed toward the
// ground by one amount between none and --field-calm-max. The amount follows the deadline, so any one amount passes.
// In light the three colors are the state's own, mixed toward white. In dark they are the dark --field-1 to -3 for every
// state, mixed toward --surface, and the tag carries the state (Ben, 07:10). Returns the state, 'deep', or 'light:<state>'
// for a light state gradient drawn in dark.
export const STATES = ['need', 'sold', 'live', 'paid'];
const mixedFrom = (seen, ref, to, most) => { const j = [0, 1, 2].reduce((a, b) => Math.abs(to[b] - ref[0][b]) > Math.abs(to[a] - ref[0][a]) ? b : a), span = to[j] - ref[0][j], t = Math.abs(span) < 8 ? 0 : (seen[0][j] - ref[0][j]) / span;
  return t >= -.01 && t <= most + .01 && seen.every((c, i) => c[3] > .99 && [0, 1, 2].every(k => Math.abs(c[k] - (ref[i][k] + (to[k] - ref[i][k]) * t)) <= 1.5)); };
export function stateOf(g, pal) {
  const mesh = pal.grads['field-mesh'], L = pal.light ?? pal; if (!mesh || layers(g.raw).replace(STOP, 'C') !== layers(mesh.raw).replace(STOP, 'C')) return null;
  const got = stops(g.raw), want = stops(mesh.raw), base = rgba(g.base);
  if (!base || got.length !== want.length || got.some((c, i) => !c || (c[3] < .01) !== (want[i][3] < .01))) return null;
  const seen = [base, ...got.filter(c => c[3] >= .01)], most = pal.calmMax ?? .58, dark = (pal.of('page')?.[0] ?? 255) < 128; if (seen.length !== 3) return null;
  if (dark) { const ref = [1, 2, 3].map(k => pal.of(`field-${k}`)), to = pal.of('surface'); if (to && ref.every(Boolean) && mixedFrom(seen, ref, to, most)) return 'deep'; }
  for (const s of STATES) { const ref = [1, 2, 3].map(k => L.of(`field-${s}-${k}`)); if (ref.some(r => !r)) continue;
    if (mixedFrom(seen, ref, [255, 255, 255], most)) return dark ? `light:${s}` : s; }
  return null;
}

// What is behind a piece of text, as one opaque color where that can be known.
function ground(t, view, pal) {
  let tint = null, wash = false;
  for (const g of t.ground) {
    if (g.kind === 'photo') return { kind: 'photo' };
    if (g.kind === 'gradient') { const el = view.els[g.el], kind = gradientKind(el, pal); if (kind === 'wash') { wash = true; break; } return { kind, el }; }
    const c = rgba(g.color); if (!c) return { kind: 'unknown', raw: g.color };
    if (c[3] >= .99) return { kind: 'fill', raw: g.color, color: tint ? over(tint, c) : c, name: tint ? null : pal.name(g.color) };
    tint = tint ? [...over(tint, c), 1 - (1 - tint[3]) * (1 - c[3])] : c;
  }
  const page = pal.of('page') ?? [255, 255, 255, 1];
  return { kind: 'fill', color: tint ? over(tint, page) : page, name: tint ? null : 'page', wash };
}

function checkView(view, ctx) {
  const { sheet, scales, pal, medium } = ctx, out = [], at = `view ${view.index + 1}`, u = sheet.unit ?? 1;
  const E = (id, where, msg) => out.push(err(id, `${at} ${where}`.trim(), msg)), W = (id, where, msg) => out.push(warn(id, `${at} ${where}`.trim(), msg));
  const text = view.texts, sizes = sheet.sizes[String(view.canvas?.[0])] ?? Object.values(sheet.sizes)[0], top = Math.max(...sizes);
  const isMark = t => t.display && t.text.trim().toLowerCase() === 'secondhand';
  // A state tag keeps its light fill and black text in dark (Art. 5, Dark mode 4), so it and what is on it are read in the
  // light palette first. In light mode that is the same palette.
  const lit = new Set(); view.els.forEach((el, i) => { if (lit.has(el.parent) || el.part === 'tag') lit.add(i); });
  const both = pal.light ? { ...pal.light, name: v => pal.light.name(v) ?? pal.name(v) } : pal, P = i => lit.has(i) ? both : pal;
  const sizesOf = w => Array.isArray(w?.sizes) ? w.sizes : w?.sizes?.[String(view.canvas?.[0])] ?? Object.values(w?.sizes ?? {})[0] ?? [], markSizes = sizesOf(sheet.wordmark);

  // B28 true scale
  if (!sheet.canvas.some(([w, h]) => near(view.w, w, 1) && (near(view.h, h, 1) || sheet.scrolls && view.h > h)))
    E('B28', '', `is ${Math.round(view.w)} by ${Math.round(view.h)}: a ${medium} view is ${sheet.canvas.map(c => c.join(' by ')).join(' or ')}${sheet.scrolls ? ', or taller when it scrolls' : ''} (Part III)`);

  for (const t of text) {
    const q = short(t.text), g = ground(t, view, pal), color = rgba(t.color), inks = P(t.el), name = inks.name(t.color);
    // B15 faces, B13 weights
    if (/(?:^|,)\s*["']?inter(?: [\w ]+)?["']?\s*(?:,|$)/i.test(t.family)) E('B15', q, 'names Inter in its font list: Inter is banned, even as a fallback (Art. 6)');
    if (!t.display && !t.textFace) E('B15', q, `is set in ${t.family.split(',')[0]}: the faces are the text face and the display face from tokens.css (Art. 6)`);
    if (t.weight !== (t.display ? 600 : ctx.textWeight)) E('B13', q, `is ${t.display ? 'the display face' : 'the text face'} at weight ${t.weight}: text is ${ctx.textWeight} everywhere and the display face is 600, so nothing stands out by weight (Art. 6.1)`);
    if (t.italic) E('B13', q, 'is italic: the faces have no italic, so this is a slanted fake (Art. 6)');
    if (t.stroked && !isMark(t)) E('B13', q, 'has a stroke on its letters: that is a fake bold (Art. 6)');
    // B14 sizes
    const mark = isMark(t);
    if (mark) { if (markSizes.length && !markSizes.some(s => near(t.size, s))) E('B3', '', `the wordmark is ${t.size} px: on a ${medium}${Array.isArray(sheet.wordmark.sizes) ? '' : ` ${view.canvas[0]} wide`} it is ${markSizes.join(' or ')} px (Part III)`); }
    else if (t.size > top + .5) { if (!sheet.peak || t.size > sheet.peak + .5) E('B14', q, `is ${t.size} px: the largest size on a ${medium} is ${sheet.peak ?? top} (Part III)`); }
    else if (!sizes.some(s => near(t.size, s))) E('B14', q, `is ${t.size} px: the sizes on a ${medium} are ${sizes.join(', ')} (Part III)`);
    // B14 off the app, a size of 32 and up is set at leading 1.1 and tracking -0.02em; the wordmark is -0.01em (Art. 6.4, 6.12)
    if (u > 1 && t.size >= 32 && t.lh !== undefined) { const want = mark ? -.01 : -.02;
      if (t.lh == null || Math.abs(t.lh - 1.1) > .02 || Math.abs(t.tr - want) > .003) E('B14', q, `is set at leading ${t.lh ?? 'normal'} and tracking ${t.tr}em: on a ${medium}${mark ? ' the wordmark' : ' a size of 32 and up'} is leading 1.1 and tracking ${want}em (Art. 6.12)`); }
    // A7 where the display face goes
    if (t.display && /[^\x20-\x7E‘’“”…]/.test(t.text)) E('A7', q, 'has letters the display face does not hold (it has no accents and one script): the text face takes this line (Art. 6)');
    if (t.display && !mark) {
      if (/\d/.test(t.text)) E('A7', q, 'sets a number in the display face: amounts and numbers are in the text face (Art. 6)');
      if (t.size < 21 * u - .5) E('A7', q, `is the display face at ${t.size} px: it is for the wordmark and headings of ${21 * u} px and up (Art. 6)`);
      if (t.lines > 1) E('A7', q, `is the display face on ${t.lines} lines: a display heading fits on one line (Art. 6)`);
    }
    // B7 every color is a token, and color is a ground, never ink
    if (!name) E('B7', q, `is colored ${t.color}, which is not a color in tokens.css: use var(--token)`);
    else if (!TEXT_INK.has(name)) E('B7', q, `is --${name} text: color is a ground, never ink. Text is ink, the second ink, or white on black, brick and the deep steps (Art. 5.1)`);
    // B6 what the text sits on
    // Over a gradient there is no one color behind the text, so contrast is read from the pixels under it, at the worst point.
    const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]), ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const sampled = t.under && color && g.kind !== 'photo' && !(t.disabled && name === 'ink-disabled');
    if (sampled) { const a = color[3] * (t.opacity ?? 1), ends = [t.under.lo, t.under.hi], inside = a >= .99 && lum(color) > lum(ends[0]) && lum(color) < lum(ends[1]);
      const worst = inside ? 1 : Math.min(...ends.map(p => ratio(lum(over([color[0], color[1], color[2], a], p)), lum(p)))), need = g.wash ? 7 : t.size >= 24 ? 3 : 4.5;
      if (worst < need) E('B6', q, `has ${worst.toFixed(1)}:1 contrast at its worst point over ${g.wash ? 'the wash' : g.kind === 'field' ? 'the field' : 'the gradient'}; it needs ${need}:1 (Art. 5.1${g.wash ? ', Art. 5 The wash' : ''})`); }
    if (g.kind === 'photo') E('B6', q, 'sits on a photo: text over a photo goes on the field or a white bar, in black (Art. 5.1)');
    else if (g.kind === 'state' || g.kind === 'pale') { const ok = ['on-field', 'on-field-2'].map(pal.raw).filter(Boolean);
      if (g.kind === 'state' && !ok.includes(t.color)) E('B6', q, `is ${name ? `--${name}` : t.color} on a state gradient: text on it is --on-field or --on-field-2, the ink of its mode, light in dark and black in light (Art. 5, State gradients 3)`); }
    else if (g.kind === 'field' || g.kind === 'built') { const ok = ['on-field', 'on-field-2'].map(pal.raw).filter(Boolean);
      if (ok.length ? !ok.includes(t.color) : !['ink', 'on-color'].includes(name)) E('B6', q, `is --${name ?? 'a raw color'} on the field: text on the field is --on-field or --on-field-2, the ink of its mode (Art. 5.1)`); }
    else if (g.kind !== 'fill' || g.name && hueOf(g.name)) { if (name && !['ink', 'on-color'].includes(name) || name === 'ink' && inks.of('ink')?.[0] > 128) E('B6', q, `is --${name ?? 'a raw color'} on ${g.kind === 'fill' ? `--${g.name}` : g.kind === 'tag' ? 'a state tag' : 'a gradient'}: text on a color is --on-color, black in light and dark (Art. 5.1)`); }
    if (name?.startsWith('on-field') && !['field', 'built', 'state', 'pale'].includes(g.kind)) E('B7', q, `is --${name} off the field: that ink is for text on the field (Art. 5.1)`);
    else if (g.kind === 'fill' && color && !sampled && !(t.disabled && name === 'ink-disabled')) { const c = contrast(hex(over([color[0], color[1], color[2], color[3] * (t.opacity ?? 1)], g.color)), hex(g.color)), need = t.size >= 24 ? 3 : 4.5;
      if (c < need) E('B6', q, `has ${c.toFixed(1)}:1 contrast with what is behind it; it needs ${need}:1 (Art. 5.1)`); }
    // B17 on the web, text that wraps sits in a column of about 75 characters, 36 times its size (Part III)
    if (medium === 'web' && t.lines >= 2 && t.rect[2] - t.rect[0] > 36 * t.size + 1) E('B17', q, `runs ${Math.round(t.rect[2] - t.rect[0])} px wide on ${t.lines} lines at ${t.size} px: a column of text is ${Math.round(36 * t.size)} px at most, about 75 characters (Part III)`);
    // B16 case, B23 words, B11 site names
    if (!mark) {
      if (t.upper || allCaps(t.text) && words(t.text) > 1) E('B16', q, 'is all capitals: sentence case everywhere (Art. 6.5)');
      else if (allCaps(t.text)) W('B16', q, 'is one word in capitals: that is for a name its maker writes that way (IKEA, HDMI), never for emphasis (Art. 6.5)');
      else if (t.caps) E('B16', q, `is ${t.caps}: sentence case everywhere (Art. 6.5)`);
      else if (titleCase(t.text)) W('B16', q, 'looks like title case: sentence case everywhere, unless these are names (Art. 6.5)');
      if (/\bSecond[Hh]and\b|\bSECONDHAND\b/.test(t.text)) E('B3', q, 'the name is written "secondhand", lowercase (C1)');
    }
    for (const h of scan(t.text)) (['O13', 'S1', 'S2'].includes(h.id) ? E : W)('B23', q, `"${h.match}" ${h.why} (product/copy.md ${h.id})`);
    if (/\s--\s/.test(t.text)) E('B23', q, 'uses "--" as a dash: no dashes (product/copy.md O13)');
    if (SITES.test(t.text)) W('B11', q, `names ${SITES.exec(t.text)[0]} in words: where a marketplace is meant, show its logo from assets/platforms (C5)`);
    // C6 an amount says what it is
    if (MONEY.test(t.text) && t.alone) E('B12', q, 'is an amount with nothing beside it saying what it is: "You keep $46.95", not "$46.95" (C6)');
    if (MONEY.test(t.text)) { const own = view.els[t.el], up = own && view.els[own.parent], th = t.rect[3] - t.rect[1];
      const band = [own, up && size(up)[1] <= 2 * th ? up : null].find(e => e && !act(e, pal) && (e.gradient || hueOf(pal.name(e.bg))));
      if (band) E('B12', q, 'has a band of color behind it: an amount stands out by size alone, with no highlight (C6)'); }
    // B34 text a box cuts off ends in an ellipsis, and text stays inside the part that holds it
    if (t.cut && !t.dots) E('B34', q, 'is cut off by its box with no ellipsis: text that can run long ends in an ellipsis or wraps (ledger L37)');
    const home = (() => { for (let i = t.el; i >= 0; i = view.els[i].parent) if (view.els[i].part) return view.els[i]; return null; })();
    if (home && !t.cut && !t.scroller && (t.full[0] < home.rect[0] - 1 || t.full[2] > home.rect[2] + 1 || (t.ink ?? t.full)[1] < home.rect[1] - 1 || (t.ink ?? t.full)[3] > home.rect[3] + 1)) E('B34', q, `spills out of [${home.part}]: a thing holds what is in it (ledger L37)`);
    // margins: text stays inside them
    const m = sheet.margin, mx = typeof m.x === 'object' ? m.x[String(view.canvas?.[0])] ?? 0 : m.x ?? 0, x0 = mx;
    const [l, tp, r, b] = t.rect, off = [!t.scroller && (l < x0 - 1 || r > view.w - x0 + 1), m.top != null && tp < m.top - 1, m.bottom != null && b > view.h - m.bottom + 1];
    if (off.some(Boolean)) E('B17', q, `runs into the ${off[0] ? `${x0} px side` : off[1] ? `${m.top} px top` : `${m.bottom} px bottom`} margin of a ${medium} (Part III)`);
    else if (m.content && r - l > m.content + 1) E('B17', q, `is ${Math.round(r - l)} px wide: content on a ${medium} is ${m.content} px wide at most (Part III)`);
  }

  // The one peak number (C6): above the largest text size, a number, in the text face, once per view.
  const peaks = text.filter(t => !isMark(t) && t.size > top + .5 && (!sheet.peak || t.size <= sheet.peak + .5));
  if (peaks.length > 1) E('B14', '', `has ${peaks.length} pieces of text above ${top} px: one peak number per view (C6)`);
  for (const t of peaks) if (!/\d/.test(t.text) || t.display) E('B14', short(t.text), `is above ${top} px and is not a number in the text face: only the one peak amount goes that large (C6)`);
  // A7 one display heading per view besides the wordmark
  // A heading with a second phrase, or one split across two pieces of markup, is one heading: count the blocks. A web window may show several sections.
  const heads = text.filter(t => t.display && !isMark(t)), blocks = new Set(heads.map(t => { for (let i = t.el; i >= 0; i = view.els[i].parent) if (view.els[i].block) return i; return t.el; }));
  if (blocks.size > 1 && medium !== 'web') E('A7', '', `has ${blocks.size} display headings (${heads.map(t => short(t.text)).join(', ')}): one per view besides the wordmark (Art. 6)`);
  // B3 the wordmark's place
  for (const t of text.filter(isMark)) {
    if (t.text.trim() !== 'secondhand') E('B3', '', `the wordmark reads "${t.text.trim()}": it is "secondhand", lowercase (C1)`);
    const cx = (t.rect[0] + t.rect[2]) / 2, cy = (t.rect[1] + t.rect[3]) / 2, where = sheet.wordmark?.at, mid = near(cx, view.w / 2, 2);
    const ok = { 'top-center': mid && cy < view.h / 4, 'top-left': cx < view.w / 2 && cy < view.h / 4 || t.size > Math.min(...markSizes) + 1, 'center': mid && cy > view.h / 3 && cy < view.h * 2 / 3, 'top-or-bottom-center': mid && (cy < view.h / 4 || cy > view.h * 3 / 4), 'bottom-left': cx < view.w / 2 && cy > view.h * 3 / 4, any: true }[where ?? 'any'];
    // Alone at its closing size, the wordmark is in the middle of the view, whatever its place on the other views.
    const alone = near(t.size, sheet.wordmark?.alone ?? -1), middle = mid && cy > view.h / 3 && cy < view.h * 2 / 3;
    if (alone ? !middle : !ok) E('B3', '', `the wordmark sits at ${Math.round(cx)}, ${Math.round(cy)}: ${alone ? `alone at ${t.size} px it goes in the middle of the view` : `on a ${medium} it goes ${where.replace(/-/g, ' ')}`} (C1, Part III)`);
  }
  // B32 the wordmark's kit (C1): once per view, untouched, on the page or the field, with one unit of clear space around it
  const marks = text.filter(isMark), hits = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  // A web page short enough to show its header and its footer in one window has both wordmarks, at their two sizes.
  if (marks.length > 1 && !(sheet.scrolls && new Set(marks.map(t => Math.round(t.size))).size === marks.length)) E('B32', '', `carries the wordmark ${marks.length} times: once per view (C1)`);
  for (const t of marks) {
    if (t.fx.length) E('B32', '', `the wordmark is ${t.fx.join(' and ')}: it is never transformed, shadowed, outlined, stroked, filtered, faded or moved (C1)`);
    const own = view.els[t.el], g = ground(t, view, pal), n = pal.name(t.color);
    if (own && (own.bg || own.borders.length)) E('B32', '', 'the wordmark has a fill or a box of its own (C1)');
    if (n && !['ink', 'on-color', 'page', 'white'].includes(n)) E('B32', '', `the wordmark is --${n}: it is black or white (C1)`);
    if (g.kind === 'tag' || g.kind === 'fill' && g.name !== 'page' && !(g.name === 'ink' && n !== 'ink')) E('B32', '', `the wordmark sits on ${g.name ? `--${g.name}` : 'a color'}: it goes on the page or the field (C1)`);
    const unit = t.size / 2, zone = [t.rect[0] - unit, t.rect[1] - unit, t.rect[2] + unit, t.rect[3] + unit], up = new Set(); for (let i = t.el; i >= 0; i = view.els[i].parent) up.add(i);
    const brandPart = i => { for (; i >= 0; i = view.els[i].parent) if (view.els[i].part === 'brand-mark') return true; return false; };
    const near = [...text.filter(o => o !== t && hits(o.rect, zone)).map(o => short(o.text)),
      ...view.els.filter((el, i) => !up.has(i) && !brandPart(i) && (el.paints || el.bg || el.borders.length) && hits(el.rect, zone) && !(el.rect[0] <= t.rect[0] && el.rect[1] <= t.rect[1] && el.rect[2] >= t.rect[2] && el.rect[3] >= t.rect[3])).map(el => el.part ? `[${el.part}]` : `<${el.tag}>`)];
    if (near.length) E('B32', '', `${[...new Set(near)].slice(0, 3).join(', ')} sits within ${unit} px of the wordmark: nothing but its ground comes within half its type size (C1)`);
  }
  // B33 logos in a row (C5): one height, one gap, none taller than the wordmark's type
  const rows = []; for (const el of view.els.filter(e => e.logo).sort((a, b) => cy(a) - cy(b))) { const row = rows.at(-1); if (row && Math.min(row[0].rect[3], el.rect[3]) - Math.max(row[0].rect[1], el.rect[1]) >= Math.min(size(row[0])[1], size(el)[1]) / 2) row.push(el); else rows.push([el]); }
  for (const logos of rows) { const hs = logos.map(l => Math.round(l.rect[3] - l.rect[1])), cap = markSizes[0];
    if (Math.max(...hs) - Math.min(...hs) > 1) E('B33', '', `logos in one row are ${[...new Set(hs)].sort((a, b) => a - b).join(', ')} px tall: logos in a row share one height (C5)`);
    if (cap && logos.length > 1 && Math.max(...hs) > cap + 1) E('B33', '', `a logo is ${Math.max(...hs)} px tall: none is taller than the wordmark's type, ${cap} px on a ${medium} (C5)`);
    // The gap is read inside one box: logos on one line in two different cards are not spaced against each other,
    // and a logo whose box was not measured has no row to be spaced in.
    for (const p of new Set(logos.map(l => l.parent).filter(p => p >= 0))) { const line = logos.filter(l => l.parent === p).sort((a, b) => a.rect[0] - b.rect[0]), gaps = line.slice(1).map((l, i) => Math.round(l.rect[0] - line[i].rect[2]));
      if (gaps.length > 1 && Math.max(...gaps) - Math.min(...gaps) > 1) E('B33', '', `logos in one row sit ${[...new Set(gaps)].join(', ')} px apart: one gap (C5)`); } }
  // longest text
  const count = text.filter(t => !isMark(t)).reduce((n, t) => n + words(t.text), 0);
  if (sheet.words && count > sheet.words) E('B30', '', `has ${count} words: a ${medium} view holds ${sheet.words} at most (Part III)`);

  const fields = [], washes = [], holdsPhoto = new Set();
  view.els.forEach((el, i) => { if (el.photo) for (let j = i; j >= 0; j = view.els[j].parent) holdsPhoto.add(j); });
  for (const el of view.els) {
    const q = el.part ? `[${el.part}]` : `<${el.tag}>`;
    // B7 every color is a token
    const k = view.els.indexOf(el), state = el.gradient && ['state', 'pale'].includes(gradientKind(el, pal));
    // A state gradient's base is its first color mixed toward its ground, which stateOf() has already read against the tokens.
    for (const [what, c, inks] of [['fill', state ? null : el.bg, null], ...el.borders.map(c => ['line', c, LINE_INK])]) { if (!c) continue; const n = P(k).name(c);
      if (!n) E('B7', q, `has a ${what} of ${c}, which is not a color in tokens.css: use var(--token)`);
      else if (inks && !inks.has(n)) E('B7', q, `has a --${n} line: color is a ground, never a line. Lines are the hairline, ink or brick (Art. 5.1)`); }
    // B17 space, B20 radius
    for (const [prop, v] of Math.min(...size(el)) <= 2 ? [] : el.space) if (v && !scales.space.has(Math.abs(v) / u) && !Object.values(sheet.margin).flatMap(x => typeof x === 'object' ? Object.values(x) : [x]).includes(Math.abs(v)) && !ctx.lengths.includes(Math.abs(v)))
      E('B17', q, `${prop} is ${v} px: gaps on a ${medium} are ${[...scales.space].filter(Boolean).map(s => s * u).join(', ')} (Art. 7.1${u > 1 ? `, times ${u}` : ''})`);
    for (const r of new Set(el.radius)) { const round = r === '50%' || parseFloat(r) >= 999 || parseFloat(r) >= Math.min(...size(el)) / 2;
      if (!round && (r.endsWith('%') || !scales.radius.has(parseFloat(r) / u))) E('B20', q, `has a ${r} corner: corners on a ${medium} are ${[...scales.radius].filter(v => v && v < 999).map(v => v * u).join(', ')} or a pill (Art. 9.1${u > 1 ? `, times ${u}` : ''})`); }
    // A photo or a logo on a canvas that does not scroll: each side stops at the edge of the view or stays inside the margin, and none runs past the edge.
    if ((el.photo || el.logo) && !sheet.scrolls) { const m = sheet.margin, mx = typeof m.x === 'object' ? 0 : m.x ?? 0, [l, t, r, b] = el.rect;
      const sides = [['left', l, mx], ['top', t, m.top ?? 0], ['right', view.w - r, mx], ['bottom', view.h - b, m.bottom ?? 0]];
      const past = sides.find(([, d]) => d < -1), inMargin = sides.find(([, d, room]) => d > 1 && d < room - 1);
      if (past) E('B17', q, `runs ${Math.round(-past[1])} px past the ${past[0]} edge of the view, so part of it is cut off (Part III)`);
      else if (inMargin) E('B17', q, `stops ${Math.round(inMargin[1])} px from the ${inMargin[0]} edge: on a ${medium} it stays inside the ${inMargin[2]} px margin or runs all the way to the edge (Part III)`); }
    // B21 one depth
    if (el.borders.length && el.shadow) E('B21', q, 'has a border and a shadow: one depth, hairlines or one soft shadow, never both (Art. 9.2)');
    // B9 photos
    // A small picture with alt="" is an icon that says nothing, which is how HTML marks one. A photo or a logo says what it is.
    if (el.tag === 'img' && (el.noAlt || !(el.alt ?? '').trim() && (el.logo || Math.max(...size(el)) > 32 * u))) E('B9', q, 'is an image with no alt text: say what the photo shows, or name the logo (C3, C5)');
    if (el.item && !holdsPhoto.has(view.els.indexOf(el))) E('B9', q, 'is an item with no photo in it: every item is shown by its photo (C3)');
    // C4 the act
    if (!sheet.act && !act(el, pal) && ['ink', 'ink-press'].includes(pal.name(el.bg)) && el.hasText && size(el)[0] * size(el)[1] < .1 * view.w * view.h) E('B10', q, `is a black button: a ${medium} has no buttons, so the act is a plain line (Part III)`);
    if (act(el, pal) && !sheet.act) E('B10', q, `is a black pill: a ${medium} has no buttons, so the act is a plain line (Part III)`);
    // gradients
    if (el.gradient) { const kind = gradientKind(el, pal), held = Object.keys(pal.grads).filter(n => !n.endsWith('-mesh')).map(n => `var(--${n})`).join(', ');
      if (kind === 'pale') E('B5', q, 'is a light state gradient in dark: in dark a state gradient is the deep field, --field-1 to -3 mixed toward --surface, and its tag carries the state (Art. 5, State gradients 3)');
      if (kind === 'built') E('B5', q, `is a gradient built by hand: a gradient is a token used as it stands${held ? ` (${held})` : ''}, never rebuilt (C2)`);
      // A tag is a chip, not a ground, so its gradient is not a field (B4 counts grounds); B5 still holds it to its tokens.
      let chip = false; for (let j = view.els.indexOf(el); j >= 0 && !chip; j = view.els[j].parent) chip = view.els[j].part === 'tag';
      if (['field', 'built', 'state', 'pale'].includes(kind) && !chip) fields.push(el);
      if (kind === 'wash') washes.push(el);
    }
  }
  // B4 one field per view, and the wash once, at the top of a screen, no taller than --wash-h
  if (fields.length > 1) E('B4', '', `has ${fields.length} gradients: one field per view (C2)`);
  if (washes.length > 1) E('B4', '', `has the wash ${washes.length} times: it appears at most once on a screen (Art. 5)`);
  for (const el of washes) { const q = el.part ? `[${el.part}]` : `<${el.tag}>`, tall = (ctx.named['wash-h'] ?? 200) * u;
    if (!['app', 'web'].includes(medium)) E('B4', q, `uses the wash on a ${medium}: it sits behind the header of a screen and nowhere else (Art. 5)`);
    else if (el.rect[1] > 1 || size(el)[1] > tall + 1) E('B4', q, `the wash runs from ${Math.round(el.rect[1])} to ${Math.round(el.rect[3])} px: it starts at the top of the screen and is ${tall} px tall at most (Art. 5)`);
  }
  // two black pills side by side
  // C4 one act per decision: two black pills never share a box, or a card (the nearest thing marked data-part)
  const acts = view.els.filter(el => act(el, pal)), card = a => { for (let i = a.parent; i >= 0; i = view.els[i].parent) if (view.els[i].part) return i; return -1; };
  // Side by side is read from where they sit: two full-size black pills on one row. A selected chip is black too, and smaller.
  const big = acts.filter(a => size(a)[1] >= 44 * u - 1);
  if (big.some((a, i) => big.slice(i + 1).some(b => Math.abs(cy(a) - cy(b)) < size(a)[1] / 2))) E('B10', '', 'has two black pills side by side: one black pill per decision (C4)');
  for (const c of new Set(big.map(card))) if (c >= 0 && big.filter(a => card(a) === c).length > 1 && !/list|grid|feed/.test(view.els[c].part)) E('B10', `[${view.els[c].part}]`, 'holds two black pills: one per card (C4)');
  // B8 color share
  // A view the field fills is the brand's one loud moment (a title slide, an end card, a sale); judge() caps how many an output has.
  view.bleed = fields.some(el => (Math.min(el.rect[2], view.w) - Math.max(el.rect[0], 0)) * (Math.min(el.rect[3], view.h) - Math.max(el.rect[1], 0)) >= .9 * view.w * view.h);
  // The wash is not counted: B4 caps it by its own height, and Ben asked for it stronger (03:22, "more intense than shown now"). Its box is taken off the ceiling.
  const washed = washes.reduce((n, el) => n + Math.max(0, Math.min(el.rect[2], view.w) - Math.max(el.rect[0], 0)) * Math.max(0, Math.min(el.rect[3], view.h) - Math.max(el.rect[1], 0)), 0) / (view.w * view.h);
  if (view.share && view.share.color > 1 / 3 + washed && !view.bleed) E('B8', '', `is ${Math.round(view.share.color * 100)}% color${washed ? `, with a wash that covers ${Math.round(washed * 100)}%` : ''}: color covers at most a third of a view, not counting photos or the wash, unless the field fills it (Art. 5.2)`);
  // B37 off the app, a view is one of its medium's layouts and holds what that layout holds (Part III)
  if (sheet.layouts) { const heads = text.filter(t => t.display && !isMark(t)).length, photos = view.els.filter(e => e.photo).length, rows = view.els.filter(e => e.part === 'row').length, nums = text.filter(t => !t.display && t.size >= top - .5).length, rest = text.filter(t => !isMark(t)).length;
    const holds = { title: [fields.length === 1 && view.bleed && heads === 1 && !photos && !rows && !nums, 'the field filling the view, with one heading'], statement: [heads === 1 && !photos && !rows && !nums && !view.bleed, 'one heading, with one line under it at most'],
      number: [nums === 1 && !heads && !photos && !rows, 'one number with the words that say what it is, and no heading'], list: [heads <= 1 && rows >= 2 && rows <= 6 && !photos && !nums, 'two to six rows, each a [row], under one heading at most'],
      item: [photos === 1 && !rows && !nums, 'one photo, with one heading or one line'], close: [marks.length === 1 && !rest && !photos, 'the wordmark alone'] }[view.layout];
    if (!view.layout) E('B37', '', `names no layout: a ${medium} view is data-layout="${sheet.layouts.join('", "')}" (Part III)`);
    else if (!sheet.layouts.includes(view.layout) || !holds) E('B37', '', `is the layout "${view.layout}", which a ${medium} does not have: its layouts are ${sheet.layouts.join(', ')} (Part III)`);
    else if (!holds[0]) E('B37', '', `is the layout "${view.layout}" and does not hold what that is: ${holds[1]} (Part III)`); }
  // U4 two colors that mark different things stay apart for an eye with no red or no green cones, a dark ground is never brown, and a tag is never color alone
  const hues = [...new Set(view.els.filter(e => e.hasText && hueOf(pal.name(e.bg))).map(e => pal.name(e.bg)))];
  for (const [kind] of Object.entries(CVD)) for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) { if (hueOf(hues[i]) === hueOf(hues[j])) continue;
    const d = Math.hypot(...seenAs(pal.of(hues[i]), kind).map((v, k) => v - seenAs(pal.of(hues[j]), kind)[k]));
    if (d < .05) W('U4', '', `--${hues[i]} and --${hues[j]} are ${d.toFixed(3)} apart to an eye with ${kind}: two colors that mark different things in one view stay .05 apart in Oklab`); }
  for (const el of view.els) { const c = rgba(el.bg); if (!c || c[3] < .99) continue; const o = oklch(hex(c));
    if (o.L < .5 && o.C > .03 && o.H >= 70 && o.H <= 115) E('U4', el.part ? `[${el.part}]` : `<${el.tag}>`, `has a dark ground of ${el.bg} in the yellow to olive band, which reads as brown`);
    if (/tag/.test(el.part ?? '') && hueOf(pal.name(el.bg)) && !el.hasText && !view.els.some(k => k.parent === view.els.indexOf(el) && (k.tag === 'img' || k.tag === 'svg'))) E('U4', `[${el.part}]`, 'shows its state by color alone: a tag carries a word or an icon'); }
  // U5 nothing sits in a corner's curve: inside a rounded box, content keeps the box's padding from the arc as well as from the straight edges.
  // A thing with its own corner is measured from that corner, so a photo concentric with its card passes.
  const padOf = (b, side) => b.space.find(([p]) => p === `padding-${side}`)?.[1] ?? 0, painted = e => e.bg || e.borders.length || e.gradient || e.photo;
  const boxOf = (id, self) => { for (let k = self ? id : view.els[id]?.parent ?? -1; k >= 0; k = view.els[k].parent) { const b = view.els[k]; if (painted(b) && b.corners?.some(r => r > 0)) return pill(b) ? null : b; } return null; };
  const inCurve = (rect, own, b) => { for (const [i, sx, sy] of [[0, 'left', 'top'], [1, 'right', 'top'], [2, 'right', 'bottom'], [3, 'left', 'bottom']]) {
    const r = b.corners[i], p = Math.min(padOf(b, sx), padOf(b, sy)), dx = sx === 'left' ? rect[0] - b.rect[0] : b.rect[2] - rect[2], dy = sy === 'top' ? rect[1] - b.rect[1] : b.rect[3] - rect[3];
    const e = Math.min(own, r), ax = r - dx - e, ay = r - dy - e; if (!r || !p || dx < 1 || dy < 1 || ax <= 0 || ay <= 0) continue;
    const d = r - e - Math.hypot(ax, ay); if (d < p - 1) return `sits ${Math.max(0, d).toFixed(0)} px from the curve of the ${sy} ${sx} corner of ${b.part ? `[${b.part}]` : `<${b.tag}>`}: the padding there is ${p} px, so it moves in until the curve is that far too`; } return null; };
  for (const t of text) { const b = t.el == null ? null : boxOf(t.el, true), h = (t.rect[3] - t.rect[1]) / (t.lines || 1), ink = Math.max(0, (h - t.size * .72) / 2);
    const bad = b && inCurve([t.rect[0], t.rect[1] + ink, t.rect[2], t.rect[3] - ink], 0, b); if (bad) E('U5', `"${t.text.trim().slice(0, 24)}"`, bad); }
  view.els.forEach((el, id) => { if (!(painted(el) || el.tag === 'img' || el.tag === 'svg')) return; const b = boxOf(id, false);
    const bad = b && inCurve(el.rect, Math.max(0, ...(el.corners ?? [0])), b); if (bad) E('U5', el.part ? `[${el.part}]` : `<${el.tag}>`, bad); });
  // L29 the tab you are on is marked by a pill behind its icon, 56 by 32 in --tab-on, and no other tab has one
  const tabs = view.els.map((el, id) => ({ el, id })).filter(o => o.el.part === 'tab'), within = (k, id) => { for (let i = k; i >= 0; i = view.els[i].parent) if (i === id) return true; return false; };
  if (tabs.length > 1) { const pills = id => view.els.filter((e, k) => e.bg && e.bg === pal.raw('tab-on') && within(k, id)), on = tabs.filter(o => o.el.current);
    if (on.length !== 1) E('L29', '[tab]', `${on.length} tabs are marked aria-current: the tab you are on is marked, and it is one`);
    for (const o of tabs) { const p = pills(o.id);
      if (o.el.current && !p.some(e => Math.abs(size(e)[0] - 56 * u) <= 1 && Math.abs(size(e)[1] - 32 * u) <= 1)) E('L29', '[tab]', `the current tab has ${p.length ? `a pill of ${size(p[0]).map(Math.round).join(' by ')}` : 'no pill behind its icon'}: it is ${56 * u} by ${32 * u} in --tab-on, so the tab you are on is not told by ink alone`);
      if (!o.el.current && p.length) E('L29', '[tab]', 'a tab you are not on has the pill: only the current tab is marked'); } }
  // U2 a countdown is calm: no seconds, and past a day it is a day and a time
  for (const t of text) { const h = /\b(\d{2,3})\s?h\b/.exec(t.text), at = (() => { for (let i = t.el; i >= 0; i = view.els[i].parent) if (view.els[i].part) return i; return -1; })(), part = at >= 0 ? view.els[at].part : '';
    if (h && Number(h[1]) > 24) E('U2', short(t.text), `counts ${h[1]} hours: past a day, show the day and the time`);
    if (/\b\d+m \d+s\b|\b\d{1,2}:\d{2}:\d{2}\b/.test(t.text) || /countdown/.test(part) && /\b\d+\s?s\b/.test(t.text)) E('U2', short(t.text), 'counts seconds: a countdown never ticks by the second');
    // U1 what does nothing never looks pressable
    // A tag inside a card that is pressed as a whole is not itself pressable (frontend standard 5): the press must start at the tag or inside it.
    let from = t.el; while (view.els[from]?.pointer && view.els[from].parent >= 0 && view.els[view.els[from].parent].pointer) from = view.els[from].parent;
    const presses = t.control && (t.controlAt == null || t.controlAt < 0 || within(t.controlAt, at)) || view.els[t.el]?.pointer && within(from, at);
    if (/tag|badge|count/.test(part) && presses) E('U1', short(t.text), `is a [${part}] that looks pressable: a tag, a count or a countdown is not a button`); }
  // U1 what opens a screen says so: a row that is a link ends in a chevron, and a button is a filled or outlined shape
  view.els.forEach((el, i) => { const inside = k => { for (let j = k.parent; j >= 0; j = view.els[j].parent) if (j === i) return true; return false; };
    if (el.link && el.block && size(el)[0] > .6 * view.w && !view.els.some(k => (k.tag === 'svg' || k.tag === 'img' && Math.max(...size(k)) <= 32 * u) && inside(k) && (k.rect[0] + k.rect[2]) / 2 > el.rect[2] - .2 * size(el)[0]))
      E('U1', el.part ? `[${el.part}]` : `<${el.tag}>`, 'is a row that opens a screen and ends in no chevron: nothing shows it can be pressed');
    // The fill may sit on a child that covers the whole button, as a Press wrapper around a pill draws it. A photo counts as a
    // picture whether it is an img or a background image, as react-native-web draws one, and a photo slot ([photo...]) counts
    // while its image is still fading in.
    const covers = k => inside(k) && (k.bg || k.borders.length || k.gradient) && k.rect[0] <= el.rect[0] + 1 && k.rect[1] <= el.rect[1] + 1 && k.rect[2] >= el.rect[2] - 1 && k.rect[3] >= el.rect[3] - 1;
    // Judged only when the whole button is on screen: a row cut by the fold has its chevron below, and the next screenful sees it whole.
    const whole = el.rect[0] >= -1 && el.rect[1] >= -1 && el.rect[2] <= view.w + 1 && el.rect[3] <= view.h + 1;
    if (whole && el.button && el.part !== 'tab' && el.hasText && !el.bg && !el.borders.length && !el.gradient && !view.els.some(k => (k.tag === 'svg' || k.tag === 'img' || k.photo || /^photo/.test(k.part ?? '')) && inside(k) || covers(k))) E('U1', el.part ? `[${el.part}]` : `<${el.tag}>`, 'is a button with no fill and no outline: a button is a pill or a filled shape'); });
  // B36 edges line up or clearly differ: two blocks of text, one above the other, never start 1 to 3 px apart
  // Words inside a small box of their own (a tag, a pill, a button) start where the box's padding puts them, so they are left out.
  const boxed = t => { for (let i = t.el; i >= 0; i = view.els[i].parent) if (view.els[i].bg || view.els[i].borders.length) return size(view.els[i])[0] < view.w / 2; return false; };
  const leads = text.filter(t => t.lead && !t.scroller && !t.control && !boxed(t));
  for (let i = 0; i < leads.length; i++) for (let j = i + 1; j < leads.length; j++) { const a = leads[i], b = leads[j], d = Math.abs(a.rect[0] - b.rect[0]);
    if (d >= 1 && d <= 3 && Math.abs(a.rect[2] - b.rect[2]) > 1 && Math.abs(a.rect[0] + a.rect[2] - b.rect[0] - b.rect[2]) > 2 && (a.rect[3] <= b.rect[1] || b.rect[3] <= a.rect[1])) { E('B36', `${short(a.text)} and ${short(b.text)}`, `start ${Math.round(a.rect[0])} and ${Math.round(b.rect[0])} px from the left: edges line up exactly or sit clearly apart, never almost`); i = leads.length; break; } }
  if (view.els.length > 12 && !view.els.some(e => e.part)) W('B31', '', 'marks nothing data-part, so nothing was checked for one size: mark each kind of repeated thing');
  // L2 not only black and white: a view with no color and no photo. A warning, because a closing slide may be the wordmark alone.
  if (view.share && view.share.color < .005 && !view.els.some(e => e.photo)) W('L2', '', 'is only black, white and gray, with no color ground and no photo: it will read as no brand (ledger L2)');
  // U6 a site's logo is its saved square icon (ledger L17; Ben, 03:49: "you should always use the icdons you grabbed"). A picture whose file or alt names a marketplace, or that sits where a logo goes, comes from assets/platforms/square/.
  for (const el of view.els) { if (el.src == null) continue; const file = el.src.split(/[?#]/)[0], site = SITE_NAME[(file.match(SITE_FILE) ?? [])[1]?.toLowerCase()] ?? (SITES.test(el.alt ?? '') && (el.alt ?? '').trim().split(/\s+/).length <= 2 ? SITES.exec(el.alt)[0] : null);
    if ((site || el.logo) && !/assets\/platforms\/square\/[a-z]+(?:\.[0-9a-f]{20,32})?\.png$/.test(file)) E('U6', `<${el.tag}${el.alt ? ` "${el.alt}"` : ''}>`, `shows ${file.startsWith('data:') ? 'an inline picture' : file.split('/').slice(-3).join('/')} as ${site ? `the ${site} logo` : 'a logo'}: a site's logo is its saved square icon, assets/platforms/square/${(site ?? 'site').toLowerCase().split(' ')[0]}.png (ledger L17)`); }
  // U7 a state changes how a thing looks, never where it or its neighbours sit (Ben, 03:49: "when the gray box is there, things are moving over"). scripts/brand-check.mjs moves the current mark to each sibling and measures.
  for (const s of view.shifts ?? []) E('U7', `"${s.who}"`, `moves ${s.by} px when ${s.how}: a state changes how a thing looks, never where it or its neighbours sit. Give every item the same box in every state (fixed slots, the state drawn inside or behind)`);
  view.fields = fields.length;
  return out;
}

// B34 the same view with extreme content in its marked slots (.agents/ui-states.json): every part keeps its size, and nothing new breaks.
function underStress(view, base, baseOut, ctx) {
  const c = view.stress, at = `view ${view.index + 1} with ${c.id}`, out = [], seen = new Set(baseOut.map(o => o.msg));
  const parts = v => v.els.filter(e => e.part && e.part !== 'hand'), a = parts(base), b = parts(view);
  a.forEach((el, i) => { const now = b[i]; if (!now || now.part !== el.part) return; const [w0, h0] = size(el).map(Math.round), [w1, h1] = size(now).map(Math.round);
    if (Math.abs(h1 - h0) > 1 || el.fit !== 'content' && Math.abs(w1 - w0) > 1) out.push(err('B34', `${at} [${el.part}]`, `goes from ${w0} by ${h0} to ${w1} by ${h1} px: a thing keeps its size whatever is in it (ledger L37)`)); });
  const filled = view.texts.filter(t => t.fill === c.fill), hits = (p, q) => Math.min(p[2], q[2]) - Math.max(p[0], q[0]) > 1 && Math.min(p[3], q[3]) - Math.max(p[1], q[1]) > 1;
  for (const t of filled) for (const o of view.texts) if (o !== t && !filled.includes(o) && hits(t.rect, o.rect)) out.push(err('B34', `${at} ${short(t.text)}`, `runs over ${short(o.text)}: long content wraps, shrinks to an ellipsis or pushes, and never covers what is beside it (ledger L37)`));
  // The rules that depend on how much room content takes, run again. What was already wrong before the content changed is not said twice.
  for (const o of checkView(view, ctx)) if (['B34', 'B17', 'B32', 'A7'].includes(o.id) && o.level === 'error' && !seen.has(o.msg)) out.push({ ...o, where: o.where.replace(/^view \d+/, at) });
  return out;
}

// facts: { views: [...], stressed: [...], fontsLoaded }, as scripts/brand-check.mjs collects them. Returns the findings.
export function judge(facts, { medium, sheet, scales, colors, states = {} }) {
  const pal = Object.assign(palette(colors, facts.grads ?? {}), { light: facts.lightColors ? palette(facts.lightColors, facts.grads ?? {}) : null, calmMax: facts.calmMax ?? null }), ctx = { medium, sheet, scales, pal, lengths: facts.lengths ?? [], named: facts.named ?? {}, textWeight: facts.textWeight ?? 400 }, per = facts.views.map(v => checkView(v, ctx)), out = per.flat(), n = facts.views.length;
  const byIndex = new Map(facts.views.map((v, i) => [v.index, i])), stress = (facts.stressed ?? []).flatMap(v => underStress(v, facts.views[byIndex.get(v.index)], per[byIndex.get(v.index)], ctx));
  const once = new Set(); for (const o of stress) { const k = `${o.where} ${o.msg}`; if (!once.has(k)) { once.add(k); out.push(o); } }
  // B28 everything that shows was measured
  if (!facts.views.some(v => v.texts.length)) out.push(err('B28', medium, 'no text was measured, so nothing was checked: is this the right file?'));
  if (facts.scaled) out.push(err('B28', medium, 'the page, or a view, is zoomed or scaled: a view is drawn at its real size (Art. 7.6)'));
  if (facts.outside?.length) out.push(err('B28', medium, `${facts.outside.map(short).join(', ')} sits outside every data-view, so nothing checked it: put it in a view or take it out`));
  if (facts.screens > 40) out.push(err('B28', medium, `the page is ${facts.screens} screens tall and the first 40 were checked: mark its sections data-view, or split it`));
  // B35 a thing that names itself draws every state it can be in: data-screen="today" data-state="empty" on a view, data-job or data-control on a part
  const drawn = new Map(), note = (m, at) => { if (!m) return; for (const [kind, name] of Object.entries(m.names)) { const k = `${kind} ${name}`, d = drawn.get(k) ?? { kind, name, have: new Set(), skip: new Map(), at };
    if (m.state) d.have.add(m.state); else out.push(err('B35', at, `names the ${kind} "${name}" and no state: add data-state`));
    for (const s of m.skip.split(';')) { const [id, why] = s.split(':').map(x => x.trim()); if (id) d.skip.set(id, why ?? ''); } drawn.set(k, d); } };
  for (const v of facts.views) { note(v.marks, `view ${v.index + 1}`); for (const el of v.els) note(el.marks, `view ${v.index + 1} [${el.part ?? el.tag}]`); }
  for (const d of drawn.values()) { const list = states[d.kind]; if (!list) continue; const known = [...list.required, ...list.known];
    for (const s of d.have) if (!known.includes(s)) out.push(err('B35', `${d.kind} "${d.name}"`, `is drawn in the state "${s}", which is not on the list: add it with node scripts/ui-states.mjs state ${d.kind} ${s} "<where it came up>", so every ${d.kind} is asked about it`));
    for (const [s, why] of d.skip) if (!why) out.push(err('B35', `${d.kind} "${d.name}"`, `skips "${s}" with no reason: data-skip="${s}: why it can't happen"`));
    const missing = list.required.filter(s => !d.have.has(s) && !d.skip.has(s));
    if (missing.length) out.push(err('B35', `${d.kind} "${d.name}"`, `is not drawn ${missing.length === 1 ? 'in the state' : 'in the states'} ${missing.join(', ')}: draw each, or say why it can't happen with data-skip="${missing[0]}: why"`)); }
  const marks = facts.views.map(v => v.texts.filter(t => t.display && t.text.trim().toLowerCase() === 'secondhand'));
  // Every output carries the wordmark. An app screen may be a sheet, which has no navigation bar, so there it is a warning.
  if (!marks.some(m => m.length)) out.push((medium === 'app' ? warn : err)('B3', medium, medium === 'app' ? 'has no wordmark: a main screen carries "secondhand" in its navigation bar, and a sheet does not (C1)' : 'has no wordmark: every output carries "secondhand" in the display face (C1, Art. 14.2)'));
  // B31 things of one kind are one size, on every view of the output at one width
  const kinds = new Map(); for (const v of facts.views) for (const el of v.els) if (el.part && el.part !== 'brand-mark') { const k = `${v.canvas?.[0]} ${el.part}`; kinds.set(k, [...(kinds.get(k) ?? []), { el, view: v.index + 1 }]); }
  for (const [k, all] of kinds) { const part = k.split(' ')[1], set = (xs, i) => [...new Set(xs.map(x => Math.round(size(x.el)[i])))].sort((a, b) => a - b), spread = xs => Math.max(...xs) - Math.min(...xs) > 1;
    const hs = set(all, 1), ws = set(all.filter(x => x.el.fit !== 'content' && !x.el.logo), 0), at = `${new Set(all.map(x => x.view)).size > 1 ? 'views' : 'view'} ${[...new Set(all.map(x => x.view))].join(', ')}`;
    if (spread(hs)) out.push(err('B31', `${at} [${part}]`, `is ${hs.join(', ')} px tall in different places: things of one kind are one size, whatever is in them`));
    // A part whose name has a size in tokens.css is that size: [card-decision] is --card-decision-h tall, [site-badge] is --site-badge square.
    // A longer name falls back to its family: [tag-kind] takes --tag-h.
    const named = facts.named ?? {}, token = (suffix) => { for (let name = part; name; name = name.replace(/-?[^-]+$/, '')) if (named[name + suffix] != null) return [name + suffix, named[name + suffix] * (sheet.unit ?? 1)]; return null; };
    const tall = token('-h') ?? token(''), wide = token('-w') ?? token('');
    if (tall && hs.some(h => Math.abs(h - tall[1]) > 1)) out.push(err('B31', `${at} [${part}]`, `is ${hs.join(', ')} px tall: a [${part}] is --${tall[0]}, ${tall[1]} px`));
    if (wide && ws.some(w => Math.abs(w - wide[1]) > 1)) out.push(err('B31', `${at} [${part}]`, `is ${ws.join(', ')} px wide: a [${part}] is --${wide[0]}, ${wide[1]} px`));
    const rs = [...new Set(all.map(x => [...new Set(x.el.radius)].join(' ') || '0'))];
    if (rs.length > 1) out.push(err('B31', `${at} [${part}]`, `has corners of ${rs.join(' and ')}: things of one kind have one corner`));
    if (ws.length && spread(ws)) out.push(err('B31', `${at} [${part}]`, `is ${ws.join(', ')} px wide in different places: things of one kind are one size, whatever is in them. Where a width should follow its words, mark it data-fit="content"`)); }
  const where = sheet.wordmark?.views;
  // A medium that carries the wordmark on every view sets it small, and once large and alone on the closing view (C1, the deck line).
  const alone = sheet.wordmark?.alone;
  if (where === 'every') marks.forEach((m, i) => { if (!m.length && marks.some(x => x.length)) out.push(err('B3', `view ${i + 1}`, `has no wordmark: on a ${medium} it sits on every view (C1, Part III)`)); });
  if (alone) marks.forEach((m, i) => { for (const t of m) if (near(t.size, alone)) { const heads = facts.views[i].texts.filter(o => o.display && o !== t);
    if (i !== n - 1) out.push(err('B3', `view ${i + 1}`, `sets the wordmark at ${alone} px: that size is for the closing view, where it stands alone (C1)`));
    else if (heads.length) out.push(err('B3', `view ${i + 1}`, `sets the wordmark at ${alone} px beside the heading ${short(heads[0].text)}: at that size it stands alone, or it reads as a heading (C1)`)); } });
  marks.forEach((m, i) => { if (m.length && (where === 'last' && i !== n - 1 || where === 'first-last' && i !== 0 && i !== n - 1))
    out.push(err('B3', `view ${i + 1}`, `carries the wordmark: on a ${medium} it goes on ${where === 'last' ? 'the last view' : 'the first and last views'} only (Part III)`)); });
  if (sheet.wordmark?.same) { const ys = marks.flat().map(t => Math.round(t.rect[1])); if (Math.max(...ys) - Math.min(...ys) > 1) out.push(err('B3', medium, 'the wordmark moves between views: it sits in the same place on every view of a series (C1)')); }
  const withField = facts.views.filter(v => v.fields).length;
  if (sheet.fields && withField > sheet.fields) out.push(err('B4', medium, `${withField} views carry the field: a ${medium} uses it on ${sheet.fields} at most (Part III)`));
  const bleeds = facts.views.filter(v => v.bleed).length, most = sheet.fields ?? 1;
  if (bleeds > most) out.push(err('B8', medium, `the field fills ${bleeds} views: it fills ${most} at most on a ${medium}, and sits on one card or band everywhere else (C2, Part III)`));
  if (facts.fontsLoaded === false) out.push((facts.fontsRequired ? err : warn)('B15', medium, facts.fontsRequired ? 'the brand faces in BRAND_FONTS did not load, so nothing was measured in them: check the folder holds the Clofie and PP Neue Montreal files' : 'the brand faces are not on this machine, so line counts, widths and margins were measured in a fallback face. Put the files in fonts/ (gitignored) or set BRAND_FONTS'));
  return out;
}

// brand/media.json and the constitution's Part III table hold the same numbers; this fails when they drift apart.
export function sheetAgrees(constitution, media) {
  const rows = Object.fromEntries([...constitution.matchAll(/^\|\s*(Canvas|Margins|Wordmark \(C1\)|Text sizes|Longest text|Unit|Act \(C4\)|Layouts)[^|]*\|(.*)\|\s*$/gm)].map(m => [m[1], m[2].split('|')]));
  const head = (constitution.match(/^\|\s*\|\s*App\s*\|.*$/m)?.[0] ?? '').split('|').slice(2, -1).map(s => s.trim());
  const key = h => ({ App: 'app', Website: 'web', 'Instagram post / carousel': 'post', 'Story / Reel / video': 'story', 'Pitch deck': 'deck' })[h];
  const nums = s => new Set((s.replace(/C\d|Art\.\s*\d+/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number)), out = [];
  if (!head.length || Object.keys(rows).length < 7) return [{ level: 'error', where: 'brand/constitution.md', msg: "can't read the Part III media table, so brand/media.json is checked against nothing" }];
  head.forEach((h, i) => { const s = media[key(h)]; if (!s) { out.push({ level: 'error', where: 'brand/media.json', msg: `has no sheet for the Part III column "${h}"` }); return; }
    const flat = x => x == null ? [] : typeof x === 'object' ? Object.values(x).flatMap(flat) : [x];
    const pairs = { Canvas: s.canvas.flat(), Margins: flat(s.margin), 'Wordmark (C1)': flat(s.wordmark?.sizes), Unit: [s.unit ?? 1], 'Text sizes': [...Object.keys(s.sizes).map(Number).filter(() => Object.keys(s.sizes).length > 1), ...flat(s.sizes), ...flat(s.peak)], 'Longest text': flat(s.words) };
    for (const [row, mine] of Object.entries(pairs)) { const cell = rows[row][i], theirs = row === 'Wordmark (C1)' ? new Set([...cell.matchAll(/(\d+(?:\.\d+)?) px/g)].map(m => Number(m[1]))) : nums(cell), a = new Set(mine);
      const missing = [...theirs].filter(v => !a.has(v)), extra = [...a].filter(v => !theirs.has(v) && !(row === 'Canvas' && theirs.size && theirs.size < a.size));
      if (row === 'Longest text' && !s.words) continue;
      if (missing.length || extra.length) out.push({ level: 'error', where: `brand/media.json ${key(h)}`, msg: `${row.toLowerCase()} disagrees with Part III of the constitution (${[missing.length && `the table has ${missing.join(', ')}`, extra.length && `the sheet has ${extra.join(', ')}`].filter(Boolean).join('; ')}): change both in one commit` }); }
    if (/^\s*None\b/.test(rows['Act (C4)'][i]) === !!s.act) out.push({ level: 'error', where: `brand/media.json ${key(h)}`, msg: `"act" is ${!!s.act} and the Act row of Part III says "${rows['Act (C4)'][i].trim()}": change both in one commit` });
    const named = (rows.Layouts?.[i] ?? '').match(/\b[a-z]+\b/g) ?? [], mine = s.layouts ?? [];
    if (named.join() !== mine.join()) out.push({ level: 'error', where: `brand/media.json ${key(h)}`, msg: `layouts disagree with Part III of the constitution (the table has ${named.join(', ') || 'none'}; the sheet has ${mine.join(', ') || 'none'}): change both in one commit` });
  });
  return out;
}
