// The brand constitution's Part IV, held on a rendered output: a deck, a post, a story, a web page or an app mock.
// scripts/brand-check.mjs opens the output in a browser and hands what it measured to judge() here.
// The numbers for each medium are in brand/media.json; the scales and colors come from the constitution and tokens.css.
import { scan } from '../../scripts/copy-lint.mjs';
import { oklch, contrast } from './picks.mjs';

const err = (id, where, msg) => ({ level: 'error', id, where, msg });
const warn = (id, where, msg) => ({ level: 'warn', id, where, msg });

export const RING = ['lilac', 'sky', 'aqua', 'mint', 'lime', 'marigold', 'peach', 'pink'];
const SITES = /\b(?:eBay|Poshmark|Depop|Mercari|Grailed|OfferUp|Etsy|Vinted|Facebook Marketplace)\b/;
const MONEY = /^[\s(]*[-+]?[$€£¥]\s?\d[\d,.]*[kKmM]?[\s)]*$/;

// "rgb(1, 2, 3)" or "rgba(1, 2, 3, 0.5)" as [r, g, b, a]. Anything else (oklch(), color()) is not a token value.
export const rgba = s => { const m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s ?? ''); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]] : null; };
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const over = (top, under) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3]));
const near = (a, b, room = .5) => Math.abs(a - b) <= room;
const turn = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const short = s => { const t = s.replace(/\s+/g, ' ').trim(); return `"${t.length > 40 ? t.slice(0, 37) + '...' : t}"`; };

// Words as the constitution counts them: two characters are a word in Chinese, Japanese and Korean (Art. 6, Any language).
export const words = s => { const cjk = (s.match(/[぀-ヿ㐀-鿿가-힯]/g) ?? []).length;
  return Math.ceil(cjk / 2) + (s.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’.,$%-]*/gu) ?? []).length; };
export const allCaps = s => { const l = s.match(/\p{L}/gu) ?? []; return l.length >= 4 && s === s.toUpperCase() && s !== s.toLowerCase(); };
export const titleCase = s => { const w = s.trim().split(/\s+/).filter(x => /^\p{L}{4,}$/u.test(x)); return w.length >= 3 && w.every(x => x[0] !== x[0].toLowerCase()); };

// The colors a medium may use, by token name: { light: { ink: 'rgb(10, 10, 10)', ... } } as the browser computes them.
function palette(colors) {
  const byValue = new Map(Object.entries(colors).map(([n, v]) => [v, n]).reverse());
  const name = v => byValue.get(v) ?? (v === 'rgb(255, 255, 255)' ? 'white' : null);
  return { name, of: n => rgba(colors[n]), has: v => name(v) != null };
}
const TEXT_INK = new Set(['ink', 'on-color', 'ink-2', 'ink-disabled', 'page', 'white', 'brick', 'brick-deep']);
const LINE_INK = new Set(['ink', 'on-color', 'outline', 'rule', 'ink-2', 'ink-disabled', 'brick', 'page', 'white']);
const hueOf = n => RING.find(h => n === h || n === `${h}-tint`);
const size = el => [el.rect[2] - el.rect[0], el.rect[3] - el.rect[1]];
// A pill by shape: the token, or a corner as round as the box allows.
const pill = el => el.radius.some(r => r === '50%' && Math.abs(size(el)[0] - size(el)[1]) > 1 || parseFloat(r) >= 999 || !r.endsWith('%') && parseFloat(r) >= Math.min(...size(el)) / 2 - .5);
const act = (el, pal) => ['ink', 'ink-press'].includes(pal.name(el.bg)) && pill(el) && el.hasText;

// A gradient is a state tag when it runs from one hue's tint to its fill (ledger L18). Any other gradient is a field (C2).
function gradientKind(el, pal) {
  const names = el.gradient.colors.map(c => pal.name(c));
  const hues = new Set(names.map(n => n && hueOf(n)));
  return hues.size === 1 && !hues.has(undefined) && !hues.has(null) && names.some(n => n.endsWith('-tint')) ? 'tag' : 'field';
}

// What is behind a piece of text, as one opaque color where that can be known.
function ground(t, view, pal) {
  let tint = null;
  for (const g of t.ground) {
    if (g.kind === 'photo') return { kind: 'photo' };
    if (g.kind === 'gradient') { const el = view.els[g.el]; return { kind: gradientKind(el, pal), el }; }
    const c = rgba(g.color); if (!c) return { kind: 'unknown', raw: g.color };
    if (c[3] >= .99) return { kind: 'fill', raw: g.color, color: tint ? over(tint, c) : c, name: tint ? null : pal.name(g.color) };
    tint = tint ? [...over(tint, c), 1 - (1 - tint[3]) * (1 - c[3])] : c;
  }
  const page = pal.of('page') ?? [255, 255, 255, 1];
  return { kind: 'fill', color: tint ? over(tint, page) : page, name: tint ? null : 'page' };
}

function checkView(view, ctx) {
  const { sheet, scales, pal, medium } = ctx, out = [], at = `view ${view.index + 1}`, u = sheet.unit ?? 1;
  const E = (id, where, msg) => out.push(err(id, `${at} ${where}`.trim(), msg)), W = (id, where, msg) => out.push(warn(id, `${at} ${where}`.trim(), msg));
  const text = view.texts, sizes = sheet.sizes[String(view.canvas?.[0])] ?? Object.values(sheet.sizes)[0], top = Math.max(...sizes);
  const isMark = t => t.display && t.text.trim().toLowerCase() === 'secondhand';
  const sizesOf = w => Array.isArray(w?.sizes) ? w.sizes : w?.sizes?.[String(view.canvas?.[0])] ?? Object.values(w?.sizes ?? {})[0] ?? [], markSizes = sizesOf(sheet.wordmark);

  // B28 true scale
  if (!sheet.canvas.some(([w, h]) => near(view.w, w, 1) && (near(view.h, h, 1) || sheet.scrolls && view.h > h)))
    E('B28', '', `is ${Math.round(view.w)} by ${Math.round(view.h)}: a ${medium} view is ${sheet.canvas.map(c => c.join(' by ')).join(' or ')}${sheet.scrolls ? ', or taller when it scrolls' : ''} (Part III)`);

  for (const t of text) {
    const q = short(t.text), g = ground(t, view, pal), color = rgba(t.color), name = pal.name(t.color);
    // B15 faces, B13 weights
    if (!t.display && !t.textFace) E('B15', q, `is set in ${t.family.split(',')[0]}: the faces are the text face and the display face from tokens.css (Art. 6)`);
    if (!scales.weight.has(t.weight)) E('B13', q, `is weight ${t.weight}: the weights are ${[...scales.weight].join(', ')} (Art. 6.1)`);
    else if (t.display !== (t.weight === 600)) E('B13', q, `is ${t.display ? 'the display face' : 'the text face'} at ${t.weight}: 600 is the display face's one weight and no other face uses it (Art. 6.1)`);
    else if (t.weight === 500 && !sheet.act) E('B13', q, `is weight 500: medium is for button labels and the selected tab, and a ${medium} has neither (Art. 6.1)`);
    else if (t.weight === 500 && !t.control) E('B13', q, 'is weight 500 and is not a button label or the selected tab: everything else is 400, and stands out by size or ink (Art. 6.1)');
    // B14 sizes
    const mark = isMark(t);
    if (mark) { if (markSizes.length && !markSizes.some(s => near(t.size, s))) E('B3', '', `the wordmark is ${t.size} px: on a ${medium}${Array.isArray(sheet.wordmark.sizes) ? '' : ` ${view.canvas[0]} wide`} it is ${markSizes.join(' or ')} px (Part III)`); }
    else if (t.size > top + .5) { if (!sheet.peak || t.size > sheet.peak + .5) E('B14', q, `is ${t.size} px: the largest size on a ${medium} is ${sheet.peak ?? top} (Part III)`); }
    else if (!sizes.some(s => near(t.size, s))) E('B14', q, `is ${t.size} px: the sizes on a ${medium} are ${sizes.join(', ')} (Part III)`);
    // A7 where the display face goes
    if (t.display && !mark) {
      if (/\d/.test(t.text)) E('A7', q, 'sets a number in the display face: amounts and numbers are in the text face (Art. 6)');
      if (t.size < 21 * u - .5) E('A7', q, `is the display face at ${t.size} px: it is for the wordmark and headings of ${21 * u} px and up (Art. 6)`);
      if (t.lines > 1) E('A7', q, `is the display face on ${t.lines} lines: a display heading fits on one line (Art. 6)`);
    }
    // B7 every color is a token, and color is a ground, never ink
    if (!name) E('B7', q, `is colored ${t.color}, which is not a color in tokens.css: use var(--token)`);
    else if (!TEXT_INK.has(name)) E('B7', q, `is --${name} text: color is a ground, never ink. Text is ink, the second ink, or white on black, brick and the deep steps (Art. 5.1)`);
    // B6 what the text sits on
    if (g.kind === 'photo') E('B6', q, 'sits on a photo: text over a photo goes on the field or a white bar, in black (Art. 5.1)');
    else if (g.kind === 'field' || g.kind === 'tag' || (g.name && hueOf(g.name))) { if (name && !['ink', 'on-color'].includes(name) || name === 'ink' && pal.of('ink')?.[0] > 128) E('B6', q, `is --${name ?? 'a raw color'} on ${g.kind === 'fill' ? `--${g.name}` : g.kind === 'tag' ? 'a state tag' : 'the field'}: text on a color is --on-color, black in light and dark (Art. 5.1)`); }
    else if (g.kind === 'fill' && color) { const c = contrast(hex(over(color, g.color)), hex(g.color)), need = t.size >= 24 ? 3 : 4.5;
      if (c < need) E('B6', q, `has ${c.toFixed(1)}:1 contrast with what is behind it; it needs ${need}:1 (Art. 5.1)`); }
    // B16 case, B23 words, B11 site names
    if (!mark) {
      if (t.upper || allCaps(t.text) && words(t.text) > 1) E('B16', q, 'is all capitals: sentence case everywhere (Art. 6.5)');
      else if (allCaps(t.text)) W('B16', q, 'is one word in capitals: that is for a name its maker writes that way (IKEA, HDMI), never for emphasis (Art. 6.5)');
      else if (titleCase(t.text)) W('B16', q, 'looks like title case: sentence case everywhere, unless these are names (Art. 6.5)');
      if (/\bSecond[Hh]and\b|\bSECONDHAND\b/.test(t.text)) E('B3', q, 'the name is written "secondhand", lowercase (C1)');
    }
    for (const h of scan(t.text)) (['O13', 'S1', 'S2'].includes(h.id) ? E : W)('B23', q, `"${h.match}" ${h.why} (product/copy.md ${h.id})`);
    if (SITES.test(t.text)) W('B11', q, `names ${SITES.exec(t.text)[0]} in words: where a marketplace is meant, show its logo from assets/platforms (C5)`);
    // C6 an amount says what it is
    if (MONEY.test(t.text) && t.alone) E('B12', q, 'is an amount with nothing beside it saying what it is: "You keep $46.95", not "$46.95" (C6)');
    if (MONEY.test(t.text)) { const own = view.els[t.el], up = own && view.els[own.parent], th = t.rect[3] - t.rect[1];
      const band = [own, up && size(up)[1] <= 2 * th ? up : null].find(e => e && !act(e, pal) && (e.gradient || hueOf(pal.name(e.bg))));
      if (band) E('B12', q, 'has a band of color behind it: an amount stands out by size alone, with no highlight (C6)'); }
    // B34 text a box cuts off ends in an ellipsis, and text stays inside the part that holds it
    if (t.cut && !t.dots) E('B34', q, 'is cut off by its box with no ellipsis: text that can run long ends in an ellipsis or wraps (ledger L37)');
    const home = (() => { for (let i = t.el; i >= 0; i = view.els[i].parent) if (view.els[i].part) return view.els[i]; return null; })();
    if (home && !t.cut && (t.full[0] < home.rect[0] - 1 || t.full[2] > home.rect[2] + 1 || t.full[1] < home.rect[1] - 1 || t.full[3] > home.rect[3] + 1)) E('B34', q, `spills out of [${home.part}]: a thing holds what is in it (ledger L37)`);
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
  const heads = text.filter(t => t.display && !isMark(t));
  if (heads.length > 1) E('A7', '', `has ${heads.length} display headings (${heads.map(t => short(t.text)).join(', ')}): one per view besides the wordmark (Art. 6)`);
  // B3 the wordmark's place
  for (const t of text.filter(isMark)) {
    if (t.text.trim() !== 'secondhand') E('B3', '', `the wordmark reads "${t.text.trim()}": it is "secondhand", lowercase (C1)`);
    const cx = (t.rect[0] + t.rect[2]) / 2, cy = (t.rect[1] + t.rect[3]) / 2, where = sheet.wordmark?.at, mid = near(cx, view.w / 2, 2);
    const ok = { 'top-center': mid && cy < view.h / 4, 'top-left': cx < view.w / 2 && cy < view.h / 4 || t.size > Math.min(...markSizes) + 1, 'center': mid, 'top-or-bottom-center': mid && (cy < view.h / 4 || cy > view.h * 3 / 4), any: true }[where ?? 'any'];
    if (!ok) E('B3', '', `the wordmark sits at ${Math.round(cx)}, ${Math.round(cy)}: on a ${medium} it goes ${where.replace(/-/g, ' ')} (C1, Part III)`);
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
    const near = [...text.filter(o => o !== t && hits(o.rect, zone)).map(o => short(o.text)),
      ...view.els.filter((el, i) => !up.has(i) && el.part !== 'hand' && (el.paints || el.bg || el.borders.length) && hits(el.rect, zone) && !(el.rect[0] <= t.rect[0] && el.rect[1] <= t.rect[1] && el.rect[2] >= t.rect[2] && el.rect[3] >= t.rect[3])).map(el => el.part ? `[${el.part}]` : `<${el.tag}>`)];
    if (near.length) E('B32', '', `${[...new Set(near)].slice(0, 3).join(', ')} sits within ${unit} px of the wordmark: nothing but its ground comes within half its type size (C1)`);
  }
  // B33 logos in a row (C5): one height, one gap, none taller than the wordmark's type
  const rows = new Map(); for (const el of view.els) if (el.logo) rows.set(el.parent, [...(rows.get(el.parent) ?? []), el]);
  for (const logos of rows.values()) { const hs = logos.map(l => Math.round(l.rect[3] - l.rect[1])), cap = markSizes[0];
    if (Math.max(...hs) - Math.min(...hs) > 1) E('B33', '', `logos in one row are ${[...new Set(hs)].join(', ')} px tall: logos in a row share one height (C5)`);
    if (cap && logos.length > 1 && Math.max(...hs) > cap + 1) E('B33', '', `a logo is ${Math.max(...hs)} px tall: none is taller than the wordmark's type, ${cap} px on a ${medium} (C5)`);
    const line = logos.filter(l => Math.abs(l.rect[1] - logos[0].rect[1]) < 2).sort((a, b) => a.rect[0] - b.rect[0]), gaps = line.slice(1).map((l, i) => Math.round(l.rect[0] - line[i].rect[2]));
    if (gaps.length > 1 && Math.max(...gaps) - Math.min(...gaps) > 1) E('B33', '', `logos in one row sit ${[...new Set(gaps)].join(', ')} px apart: one gap (C5)`); }
  // longest text
  const count = text.filter(t => !isMark(t)).reduce((n, t) => n + words(t.text), 0);
  if (sheet.words && count > sheet.words) E('B30', '', `has ${count} words: a ${medium} view holds ${sheet.words} at most (Part III)`);

  const fields = [], holdsPhoto = new Set();
  view.els.forEach((el, i) => { if (el.photo) for (let j = i; j >= 0; j = view.els[j].parent) holdsPhoto.add(j); });
  for (const el of view.els) {
    const q = el.part ? `[${el.part}]` : `<${el.tag}>`;
    // B7 every color is a token
    for (const [what, c, inks] of [['fill', el.bg, null], ...el.borders.map(c => ['line', c, LINE_INK])]) { if (!c) continue; const n = pal.name(c);
      if (!n) E('B7', q, `has a ${what} of ${c}, which is not a color in tokens.css: use var(--token)`);
      else if (inks && !inks.has(n)) E('B7', q, `has a --${n} line: color is a ground, never a line. Lines are the hairline, ink or brick (Art. 5.1)`); }
    // B17 space, B20 radius
    for (const [prop, v] of el.space) if (v && !scales.space.has(Math.abs(v) / u) && !Object.values(sheet.margin).flatMap(x => typeof x === 'object' ? Object.values(x) : [x]).includes(Math.abs(v)))
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
    if (el.tag === 'img' && (el.noAlt || !el.alt && (el.logo || Math.max(...size(el)) > 32 * u))) E('B9', q, 'is an image with no alt text: say what the photo shows, or name the logo (C3, C5)');
    if (el.item && !holdsPhoto.has(view.els.indexOf(el))) E('B9', q, 'is an item with no photo in it: every item is shown by its photo (C3)');
    // C4 the act
    if (act(el, pal) && !sheet.act) E('B10', q, `is a black pill: a ${medium} has no buttons, so the act is a plain line (Part III)`);
    // gradients
    if (el.gradient) {
      if (el.gradient.repeating) E('B5', q, 'uses a repeating gradient: the field has no lines and no grain (C2)');
      if (gradientKind(el, pal) === 'field') fields.push(el);
    }
  }
  // B4 one field per view, B5 a soft mesh of three ring colors
  if (fields.length > 1) E('B4', '', `has ${fields.length} gradients: one field per view (C2)`);
  for (const el of fields) {
    const q = el.part ? `[${el.part}]` : `<${el.tag}>`, names = [...new Set(el.gradient.colors.map(c => pal.name(c) ?? c))], off = names.filter(n => !RING.includes(n));
    if (off.length) E('B5', q, `the field uses ${off.map(n => n.startsWith('rgb') ? n : `--${n}`).join(', ')}: a field is three of the eight ring fills, never dark, saturated or a tint (C2)`);
    else if (names.length !== 3) E('B5', q, `the field has ${names.length} color${names.length === 1 ? '' : 's'}: a field is a soft mesh of three (C2)`);
    else { const hs = names.map(n => oklch(hex(pal.of(n))).H), far = Math.max(turn(hs[0], hs[1]), turn(hs[1], hs[2]), turn(hs[0], hs[2]));
      if (far > 140) E('B5', q, `the field mixes --${names.join(', --')}, ${Math.round(far)} degrees apart: no two field colors sit near opposite each other (C2)`); }
    if (!el.gradient.radial) E('B5', q, 'the field is a straight gradient: it is a soft mesh of blurred points, written with radial gradients (C2)');
  }
  // two black pills side by side
  // C4 one act per decision: two black pills never share a box, or a card (the nearest thing marked data-part)
  const acts = view.els.filter(el => act(el, pal)), card = a => { for (let i = a.parent; i >= 0; i = view.els[i].parent) if (view.els[i].part) return i; return -1; };
  for (const p of new Set(acts.map(a => a.parent))) if (acts.filter(a => a.parent === p).length > 1) E('B10', '', 'has two black pills side by side: one black pill per decision (C4)');
  for (const c of new Set(acts.map(card))) if (c >= 0 && acts.filter(a => card(a) === c).length > 1 && new Set(acts.filter(a => card(a) === c).map(a => a.parent)).size > 1) E('B10', `[${view.els[c].part}]`, 'holds two black pills: one per card (C4)');
  // B8 color share
  // A view the field fills is the brand's one loud moment (a title slide, an end card, a sale); judge() caps how many an output has.
  view.bleed = fields.some(el => (Math.min(el.rect[2], view.w) - Math.max(el.rect[0], 0)) * (Math.min(el.rect[3], view.h) - Math.max(el.rect[1], 0)) >= .9 * view.w * view.h);
  if (view.share && view.share.color > 1 / 3 && !view.bleed) E('B8', '', `is ${Math.round(view.share.color * 100)}% color: color covers at most a third of a view, not counting photos, unless the field fills it (Art. 5.2)`);
  // L2 not only black and white: a view with no color and no photo. A warning, because a closing slide may be the wordmark alone.
  if (view.share && view.share.color < .005 && !view.els.some(e => e.photo)) W('L2', '', 'is only black, white and gray, with no color ground and no photo: it will read as no brand (ledger L2)');
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
  const pal = palette(colors), ctx = { medium, sheet, scales, pal }, per = facts.views.map(v => checkView(v, ctx)), out = per.flat(), n = facts.views.length;
  const byIndex = new Map(facts.views.map((v, i) => [v.index, i])), stress = (facts.stressed ?? []).flatMap(v => underStress(v, facts.views[byIndex.get(v.index)], per[byIndex.get(v.index)], ctx));
  const once = new Set(); for (const o of stress) { const k = `${o.where} ${o.msg}`; if (!once.has(k)) { once.add(k); out.push(o); } }
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
  const kinds = new Map(); for (const v of facts.views) for (const el of v.els) if (el.part && el.part !== 'hand') { const k = `${v.canvas?.[0]} ${el.part}`; kinds.set(k, [...(kinds.get(k) ?? []), { el, view: v.index + 1 }]); }
  for (const [k, all] of kinds) { const part = k.split(' ')[1], set = (xs, i) => [...new Set(xs.map(x => Math.round(size(x.el)[i])))].sort((a, b) => a - b), spread = xs => Math.max(...xs) - Math.min(...xs) > 1;
    const hs = set(all, 1), ws = set(all.filter(x => x.el.fit !== 'content' && !x.el.logo), 0), at = `${new Set(all.map(x => x.view)).size > 1 ? 'views' : 'view'} ${[...new Set(all.map(x => x.view))].join(', ')}`;
    if (spread(hs)) out.push(err('B31', `${at} [${part}]`, `is ${hs.join(', ')} px tall in different places: things of one kind are one size, whatever is in them`));
    if (ws.length && spread(ws)) out.push(err('B31', `${at} [${part}]`, `is ${ws.join(', ')} px wide in different places: things of one kind are one size, whatever is in them. Where a width should follow its words, mark it data-fit="content"`)); }
  const where = sheet.wordmark?.views;
  marks.forEach((m, i) => { if (m.length && (where === 'last' && i !== n - 1 || where === 'first-last' && i !== 0 && i !== n - 1))
    out.push(err('B3', `view ${i + 1}`, `carries the wordmark: on a ${medium} it goes on ${where === 'last' ? 'the last view' : 'the first and last views'} only (Part III)`)); });
  if (sheet.wordmark?.same) { const ys = marks.flat().map(t => Math.round(t.rect[1])); if (Math.max(...ys) - Math.min(...ys) > 1) out.push(err('B3', medium, 'the wordmark moves between views: it sits in the same place on every view of a series (C1)')); }
  const withField = facts.views.filter(v => v.fields).length;
  if (sheet.fields && withField > sheet.fields) out.push(err('B4', medium, `${withField} views carry the field: a ${medium} uses it on ${sheet.fields} at most (Part III)`));
  const bleeds = facts.views.filter(v => v.bleed).length, most = sheet.fields ?? 1;
  if (bleeds > most) out.push(err('B8', medium, `the field fills ${bleeds} views: it fills ${most} at most on a ${medium}, and sits on one card or band everywhere else (C2, Part III)`));
  if (facts.fontsLoaded === false) out.push(warn('B15', medium, 'the brand faces are not installed on this machine, so line counts, widths and margins were measured in a fallback face'));
  return out;
}

// brand/media.json and the constitution's Part III table hold the same numbers; this fails when they drift apart.
export function sheetAgrees(constitution, media) {
  const rows = Object.fromEntries([...constitution.matchAll(/^\|\s*(Canvas|Margins|Wordmark \(C1\)|Text sizes|Longest text|Unit|Act \(C4\))[^|]*\|(.*)\|\s*$/gm)].map(m => [m[1], m[2].split('|')]));
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
  });
  return out;
}
