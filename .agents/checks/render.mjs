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
export const EMOJI = /(?![©®™])\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u;

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

  // B28 true scale
  if (!sheet.canvas.some(([w, h]) => near(view.w, w, 1) && near(view.h, h, 1)))
    E('B28', '', `is ${view.w} by ${view.h}: a ${medium} view is ${sheet.canvas.map(c => c.join(' by ')).join(' or ')} (Part III)`);

  for (const t of text) {
    const q = short(t.text), g = ground(t, view, pal), color = rgba(t.color), name = pal.name(t.color);
    // B15 faces, B13 weights
    if (!t.display && !t.textFace) E('B15', q, `is set in ${t.family.split(',')[0]}: the faces are the text face and the display face from tokens.css (Art. 6)`);
    if (!scales.weight.has(t.weight)) E('B13', q, `is weight ${t.weight}: the weights are ${[...scales.weight].join(', ')} (Art. 6.1)`);
    else if (t.display !== (t.weight === 600)) E('B13', q, `is ${t.display ? 'the display face' : 'the text face'} at ${t.weight}: 600 is the display face's one weight and no other face uses it (Art. 6.1)`);
    else if (t.weight === 500 && !sheet.act) E('B13', q, `is weight 500: medium is for button labels and the selected tab, and a ${medium} has neither (Art. 6.1)`);
    // B14 sizes
    const mark = isMark(t);
    if (mark) { if (sheet.wordmark?.sizes && !sheet.wordmark.sizes.some(s => near(t.size, s))) E('B3', '', `the wordmark is ${t.size} px: on a ${medium} it is ${sheet.wordmark.sizes.join(' or ')} px (Part III)`); }
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
      if (t.upper || allCaps(t.text)) E('B16', q, 'is all capitals: sentence case everywhere (Art. 6.5)');
      else if (titleCase(t.text)) W('B16', q, 'looks like title case: sentence case everywhere, unless these are names (Art. 6.5)');
      if (/\bSecond[Hh]and\b|\bSECONDHAND\b/.test(t.text)) E('B3', q, 'the name is written "secondhand", lowercase (C1)');
    }
    if (EMOJI.test(t.text)) E('B23', q, 'has an emoji: no emoji anywhere (Art. 12.5)');
    for (const h of scan(t.text)) (h.id === 'O13' || h.id === 'S1' ? E : W)('B23', q, `"${h.match}" ${h.why} (product/copy.md ${h.id})`);
    if (SITES.test(t.text)) W('B11', q, `names ${SITES.exec(t.text)[0]} in words: where a marketplace is meant, show its logo from assets/platforms (C5)`);
    // C6 an amount says what it is
    if (MONEY.test(t.text) && t.alone) E('B12', q, 'is an amount with nothing beside it saying what it is: "You keep $46.95", not "$46.95" (C6)');
    // margins: text stays inside them
    const m = sheet.margin, mx = typeof m.x === 'object' ? m.x[String(view.canvas?.[0])] ?? 0 : m.x ?? 0, x0 = Math.max(mx, m.content ? (view.w - m.content) / 2 : 0);
    const [l, tp, r, b] = t.rect, off = [l < x0 - 1 || r > view.w - x0 + 1, m.top != null && tp < m.top - 1, m.bottom != null && b > view.h - m.bottom + 1];
    if (off.some(Boolean)) E('B17', q, `runs into the ${off[0] ? `${x0} px side` : off[1] ? `${m.top} px top` : `${m.bottom} px bottom`} margin of a ${medium} (Part III)`);
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
    const ok = { 'top-center': mid && cy < view.h / 4, 'top-left': cx < view.w / 2 && cy < view.h / 4 || t.size > 30, 'center': mid, 'top-or-bottom-center': mid && (cy < view.h / 4 || cy > view.h * 3 / 4), any: true }[where ?? 'any'];
    if (!ok) E('B3', '', `the wordmark sits at ${Math.round(cx)}, ${Math.round(cy)}: on a ${medium} it goes ${where.replace(/-/g, ' ')} (C1, Part III)`);
  }
  // longest text
  const count = text.filter(t => !isMark(t)).reduce((n, t) => n + words(t.text), 0);
  if (sheet.words && count > sheet.words) E('B30', '', `has ${count} words: a ${medium} view holds ${sheet.words} at most (Part III)`);

  const fields = [];
  for (const el of view.els) {
    const q = el.part ? `[${el.part}]` : `<${el.tag}>`;
    // B7 every color is a token
    for (const [what, c, inks] of [['fill', el.bg, null], ...el.borders.map(c => ['line', c, LINE_INK])]) { if (!c) continue; const n = pal.name(c);
      if (!n) E('B7', q, `has a ${what} of ${c}, which is not a color in tokens.css: use var(--token)`);
      else if (inks && !inks.has(n)) E('B7', q, `has a --${n} line: color is a ground, never a line. Lines are the hairline, ink or brick (Art. 5.1)`); }
    // B17 space, B20 radius
    for (const [prop, v] of el.space) if (v && !scales.space.has(Math.abs(v) / u) && !Object.values(sheet.margin).flatMap(x => typeof x === 'object' ? Object.values(x) : [x]).includes(Math.abs(v)))
      E('B17', q, `${prop} is ${v} px: gaps on a ${medium} are ${[...scales.space].filter(Boolean).map(s => s * u).join(', ')} (Art. 7.1${u > 1 ? `, times ${u}` : ''})`);
    for (const r of new Set(el.radius)) { const pill = r === '50%' || parseFloat(r) >= 999 || parseFloat(r) >= Math.min(el.rect[2] - el.rect[0], el.rect[3] - el.rect[1]) / 2;
      if (!pill && (r.endsWith('%') || !scales.radius.has(parseFloat(r) / u))) E('B20', q, `has a ${r} corner: corners on a ${medium} are ${[...scales.radius].filter(v => v && v < 999).map(v => v * u).join(', ')} or a pill (Art. 9.1${u > 1 ? `, times ${u}` : ''})`); }
    // B21 one depth
    if (el.borders.length && el.shadow) E('B21', q, 'has a border and a shadow: one depth, hairlines or one soft shadow, never both (Art. 9.2)');
    // B9 photos
    if (el.tag === 'img' && !el.alt) E('B9', q, 'is an image with no alt text: say what the photo shows, or name the logo (C3, C5)');
    // C4 the act
    const inkFill = ['ink', 'ink-press'].includes(pal.name(el.bg)) && pal.of('ink')?.[0] < 128, pillShape = el.radius.some(r => parseFloat(r) >= 999);
    if (inkFill && pillShape && el.hasText && !sheet.act) E('B10', q, `is a black pill: a ${medium} has no buttons, so the act is a plain line (Part III)`);
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
    if (view.els.some(o => o.photo && o.rect[0] < el.rect[2] && o.rect[2] > el.rect[0] && o.rect[1] < el.rect[3] && o.rect[3] > el.rect[1])) E('B4', q, 'the field sits behind a photo: it shrinks or moves away from photos (Art. 5.4)');
  }
  // two black pills side by side
  const acts = view.els.filter(el => ['ink', 'ink-press'].includes(pal.name(el.bg)) && el.radius.some(r => parseFloat(r) >= 999) && el.hasText && pal.of('ink')?.[0] < 128);
  for (const p of new Set(acts.map(a => a.parent))) if (acts.filter(a => a.parent === p).length > 1) E('B10', '', 'has two black pills side by side: one black pill per decision (C4)');
  // B8 color share
  // A view the field fills is the brand's one loud moment (a title slide, an end card, a sale); judge() caps how many an output has.
  view.bleed = fields.some(el => (Math.min(el.rect[2], view.w) - Math.max(el.rect[0], 0)) * (Math.min(el.rect[3], view.h) - Math.max(el.rect[1], 0)) >= .9 * view.w * view.h);
  if (view.share && view.share.color > 1 / 3 && !view.bleed) E('B8', '', `is ${Math.round(view.share.color * 100)}% color: color covers at most a third of a view, not counting photos, unless the field fills it (Art. 5.2)`);
  // B31 things of one kind are one size
  const kinds = new Map(); for (const el of view.els) if (el.part) kinds.set(el.part, [...(kinds.get(el.part) ?? []), el]);
  for (const [part, els] of kinds) { const hs = [...new Set(els.map(e => Math.round(e.rect[3] - e.rect[1])))];
    if (Math.max(...hs) - Math.min(...hs) > 1) E('B31', `[${part}]`, `is ${hs.join(', ')} px tall in different places: things of one kind are one size, whatever is in them`); }
  view.fields = fields.length;
  return out;
}

// facts: { views: [...], fontsLoaded }, as scripts/brand-check.mjs collects them. Returns the findings.
export function judge(facts, { medium, sheet, scales, colors }) {
  const pal = palette(colors), ctx = { medium, sheet, scales, pal }, out = facts.views.flatMap(v => checkView(v, ctx)), n = facts.views.length;
  const marks = facts.views.map(v => v.texts.filter(t => t.display && t.text.trim().toLowerCase() === 'secondhand'));
  if (!marks.some(m => m.length)) out.push(err('B3', medium, 'has no wordmark: every output carries "secondhand" in the display face (C1, Art. 14.2)'));
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
  const rows = Object.fromEntries([...constitution.matchAll(/^\|\s*(Canvas|Margins|Wordmark \(C1\)|Text sizes|Longest text)\s*\|(.*)\|\s*$/gm)].map(m => [m[1], m[2].split('|')]));
  const head = (constitution.match(/^\|\s*\|\s*App\s*\|.*$/m)?.[0] ?? '').split('|').slice(2, -1).map(s => s.trim());
  const key = h => ({ App: 'app', Website: 'web', 'Instagram post / carousel': 'post', 'Story / Reel / video': 'story', 'Pitch deck': 'deck' })[h];
  const nums = s => new Set((s.replace(/C\d|Art\.\s*\d+/g, '').match(/\d+(?:\.\d+)?/g) ?? []).map(Number)), out = [];
  if (!head.length || Object.keys(rows).length < 5) return [{ level: 'error', where: 'brand/constitution.md', msg: "can't read the Part III media table, so brand/media.json is checked against nothing" }];
  head.forEach((h, i) => { const s = media[key(h)]; if (!s) { out.push({ level: 'error', where: 'brand/media.json', msg: `has no sheet for the Part III column "${h}"` }); return; }
    const flat = x => x == null ? [] : typeof x === 'object' ? Object.values(x).flatMap(flat) : [x];
    const pairs = { Canvas: s.canvas.flat(), Margins: flat(s.margin), 'Wordmark (C1)': s.wordmark?.sizes ?? [], 'Text sizes': [...Object.keys(s.sizes).map(Number).filter(() => Object.keys(s.sizes).length > 1), ...flat(s.sizes), ...flat(s.peak)], 'Longest text': flat(s.words) };
    for (const [row, mine] of Object.entries(pairs)) { const cell = rows[row][i], theirs = row === 'Wordmark (C1)' ? new Set([...cell.matchAll(/(\d+(?:\.\d+)?) px/g)].map(m => Number(m[1]))) : nums(cell), a = new Set(mine);
      const missing = [...theirs].filter(v => !a.has(v)), extra = [...a].filter(v => !theirs.has(v) && !(row === 'Canvas' && theirs.size && theirs.size < a.size));
      if (row === 'Longest text' && !s.words) continue;
      if (missing.length || extra.length) out.push({ level: 'error', where: `brand/media.json ${key(h)}`, msg: `${row.toLowerCase()} disagrees with Part III of the constitution (${[missing.length && `the table has ${missing.join(', ')}`, extra.length && `the sheet has ${extra.join(', ')}`].filter(Boolean).join('; ')}): change both in one commit` }); }
  });
  return out;
}
