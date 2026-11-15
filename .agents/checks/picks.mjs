// Ben's brand picks and the UI loop's rules, each held by a script where a script can hold it.
// Which rule is held by what is in .agents/ui-rules.json; rules.mjs fails when a pick in the ledger has no row there.
// Every check is keyed by the id of the rule it holds, and has a test named "picks <id>:" in checks.test.mjs.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { read, err, lineOf, withoutComments } from './util.mjs';

const TOKENS = 'brand/tokens.css';
const APP = f => /^app\/src\/.*\.(tsx?|jsx?)$/.test(f) && !/\.(test|generated)\./.test(f);

// Words a person reads: JSX text (also beside an expression or on its own line) and quoted strings.
// `label` is true when the string names something for a screen reader. `jsx` is true for text between tags.
const LABEL = /(?:accessibilityLabel|accessibilityHint|aria-label|alt|testID)\s*[=:]\s*\{?\s*$/;
const CODE = /;|=>|\b(?:import|export|const|let|return|function|else|catch|finally|typeof|extends)\b|^\s*[)\]&|?:.,]/;
function words(f, text) {
  const t = withoutComments(f, text), lineAt = i => t.slice(t.lastIndexOf('\n', i) + 1, (t.indexOf('\n', i) + 1 || t.length + 1) - 1);
  const jsx = /\.[tj]sx$/.test(f) ? [...t.matchAll(/([>}][^<>{}]*[A-Za-z][^<>{}]*)(?=[<{])/g)].filter(m => !CODE.test(m[1].slice(1))).map(m => ({ s: m[1], i: m.index, jsx: true, label: false })) : [];
  const quoted = [...t.matchAll(/"([^"\n]+)"|'([^'\n]+)'|`([^`]+)`/g)]
    .filter(m => !/^\s*import\b|\bfrom\s+['"]|\blog\.\w+\s*\(|\brequire\s*\(/.test(lineAt(m.index)) && !/^(?:https?:|\.{0,2}\/|@\/)/.test(m[1] ?? m[2] ?? m[3]))
    .map(m => ({ s: m[1] ?? m[2] ?? m[3], i: m.index, jsx: false, label: LABEL.test(t.slice(Math.max(0, m.index - 60), m.index)) }));
  return [...jsx, ...quoted];
}
// One finding per match of `re` in the words of each app file. `phrases` skips a quoted single word, which is a value, not a sentence.
const inWords = (root, files, re, msg, { labels = false, phrases = false } = {}) => files.filter(APP).flatMap(f => {
  const text = read(root, f) ?? '';
  return words(f, text).filter(w => (labels || !w.label) && (!phrases || w.jsx || /\s/.test(w.s.trim())))
    .flatMap(w => [...w.s.matchAll(re)].map(m => err(`${f}:${lineOf(text, w.i)}`, msg(m[0]))));
});

// tokens.css as { light: {name: value}, dark: {name: value} }.
function tokens(root) {
  const css = read(root, TOKENS); if (css == null) return null;
  const block = s => Object.fromEntries([...(s ?? '').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  const [light, ...rest] = css.split(/:root\[data-theme=["']?dark["']?\]|prefers-color-scheme:\s*dark/);
  return { css, light: block(light), dark: block(rest.map(r => r.split('}')[0]).join(';')) };
}
const HEX = /^#[0-9a-f]{6}$/i;
const lin = c => (c /= 255) <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const rgb = h => [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16)));
export function oklch(hex) {
  const [r, g, b] = rgb(hex);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, bb = .0259040371 * l + .7827717662 * m - .808675766 * s;
  return { L: .2104542553 * l + .793617785 * m - .0040720468 * s, C: Math.hypot(a, bb), H: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
}
export function contrast(a, b) {
  const y = h => { const [r, g, bl] = rgb(h); return .2126 * r + .7152 * g + .0722 * bl; };
  const [hi, lo] = [y(a), y(b)].sort((p, q) => q - p);
  return (hi + .05) / (lo + .05);
}
// The family: every hue that has a tint and a deep. Lime's fill and brick's fill are set apart on purpose (constitution Art. 5, The family).
const OWN_FILL = new Set(['lime', 'brick']);
const family = light => Object.keys(light).filter(n => HEX.test(light[n]) && HEX.test(light[`${n}-tint`] ?? '') && HEX.test(light[`${n}-deep`] ?? ''));
const spread = xs => Math.max(...xs) - Math.min(...xs);
const turn = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

export const PICKS = {
  // The wordmark is "secondhand", lowercase, wherever the app writes it.
  L3: (root, { files }) => inWords(root, files, /\bSecond[Hh]and\b|\bSECONDHAND\b|\bsecondHand\b/g,
    m => `"${m}": the name is written "secondhand", lowercase (ledger L3)`, { labels: true }),

  // A marketplace shows as its logo. Its name is only for a screen reader.
  L6: (root, { files }) => inWords(root, files, /\b(?:eBay|Poshmark|Depop|Mercari|Grailed|OfferUp|Etsy|Vinted|Facebook Marketplace)\b/g,
    m => `"${m}" as words: show the logo from assets/platforms and put the name in accessibilityLabel (ledger L6)`, { phrases: true }),

  // No mono face, no Marist, no Inter, in the brand values or in the app.
  L7: (root, { files }) => {
    const BANNED = /\bInter(?:[_-]\w+)?\b|\bMarist\w*|\b[Mm]onospace\b|\b[Cc]ourier(?: New)?\b|\b[Mm]enlo\b|\b[Cc]onsolas\b|\b[A-Z]\w*(?: ?Mono)(?:[_-]\w+)?\b/g, out = [];
    const t = tokens(root);
    for (const [n, v] of Object.entries(t?.light ?? {})) if (n.startsWith('font-'))
      for (const m of v.matchAll(BANNED)) out.push(err(`${TOKENS}:${lineOf(t.css, t.css.indexOf(`--${n}`))}`, `--${n} names ${m[0]}: the faces are Neue Montreal and Clofie, with no mono, Marist or Inter (ledger L7, L20, L21)`));
    for (const f of files.filter(APP)) { const text = read(root, f) ?? '';
      for (const w of words(f, text)) for (const m of w.s.matchAll(BANNED)) if (/font-?family|fontFamily|useFonts|loadAsync|fontFace/i.test(text.slice(Math.max(0, w.i - 80), w.i)))
        out.push(err(`${f}:${lineOf(text, w.i)}`, `font ${m[0]}: no mono, Marist or Inter; take the face from the Txt part (ledger L7, L20, L21)`)); }
    return out;
  },

  // Plain words a person can say back: no statistics notation on a screen.
  L8: (root, { files }) => inWords(root, files, /\bn\s*=\s*\d+|\bp\s*[<=]\s*0?\.\d+|\bsample size\b|\bconfidence interval\b|\bstd\.? dev\b|[σμ±]/gi,
    m => `"${m}" is statistics notation: say it in words a person could say back, such as "from 41 sales" (ledger L8)`),

  // No counter of what needs the person against what was handled.
  L13: (root, { files }) => inWords(root, files, /(?:\b\d+|\})\s+needs? you\b|(?:\b\d+|\})\s+handled\b/gi,
    m => `"${m.replace(/^\}/, '…')}": no count of what needs you against what was handled (ledger L13)`),

  // Every state has one fill and one icon, decided once: each pill in grid.ts has a row in states.ts.
  L15: (root) => {
    const grid = read(root, 'app/src/sell/grid.ts'), states = read(root, 'app/src/ui/states.ts');
    if (grid == null) return [];
    const pills = [...(grid.match(/export const PILLS\b[^=]*=\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
    if (!pills.length) return [err('app/src/sell/grid.ts', "can't read PILLS as a list of quoted names, so no state would be checked (ledger L15)")];
    if (states == null) return [err('app/src/ui/states.ts', 'is missing: every pill needs its fill and its icon in one place (ledger L15, L24)')];
    return pills.filter(p => { const row = states.match(new RegExp(`['"]?${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*:\\s*\\{([^}]*)\\}`))?.[1] ?? ''; return !/\bfill\s*:/.test(row) || !/\bicon\s*:/.test(row); })
      .map(p => err('app/src/ui/states.ts', `the pill "${p}" has no fill and icon: a state is never shown by color alone, and no screen invents one (ledger L15, L24)`));
  },

  // Platform logos are square.
  L17: (root, { files }) => files.filter(f => /^assets\/platforms\/square\/.*\.png$/.test(f)).flatMap(f => {
    const p = join(root, f); if (!existsSync(p)) return [];
    const b = readFileSync(p); if (b.length < 24 || b.toString('latin1', 1, 4) !== 'PNG') return [err(f, 'is not a PNG, so its shape cannot be measured (ledger L17)')];
    const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
    return w === h ? [] : [err(f, `is ${w} by ${h}: platform logos are square, 1:1 (ledger L17)`)];
  }),

  // The gradient is soft: no lines and no grain, in the brand values or in the app.
  L19: (root, { files }) => [TOKENS, ...files.filter(f => APP(f) && f.startsWith('app/src/ui/'))].flatMap(f => { const text = f === TOKENS ? read(root, f) ?? '' : withoutComments(f, read(root, f) ?? '');
    return [...text.matchAll(/repeating-(?:linear|radial|conic)-gradient|feTurbulence|(?:noise|grain)[\w-]*\.(?:png|svg|jpe?g|webp)/gi)]
      .map(m => err(`${f}:${lineOf(text, m.index)}`, `${m[0]}: the gradient has no lines and no grain (ledger L19)`)); }),

  // Light and dark differ only in color.
  L22: (root, { files }) => {
    const t = tokens(root), out = [];
    const isColor = v => /^(?:#|rgba?\(|hsla?\(|oklch\()/.test(v ?? '') || (/^var\(--([\w-]+)\)$/.test(v ?? '') && isColor(t.light[v.slice(6, -1)]));
    for (const n of Object.keys(t?.dark ?? {})) if (!isColor(t.light[n]))
      out.push(err(TOKENS, `dark mode changes --${n}, which is not a color: light and dark differ only in color (ledger L22)`));
    for (const f of files.filter(f => APP(f) && !f.startsWith('app/src/ui/'))) { const text = withoutComments(f, read(root, f) ?? '');
      for (const m of text.matchAll(/\buseColorScheme\b|\bAppearance\.getColorScheme\b/g))
        out.push(err(`${f}:${lineOf(text, m.index)}`, `${m[0]} in a screen: a screen never branches on light or dark; the parts in app/src/ui take the colors (ledger L22)`)); }
    return out;
  },

  // The filled button is black with depth, never pure black.
  L25: (root) => { const t = tokens(root); return /^(?:#0{3}|#0{6}|black|rgb\(0[ ,]+0[ ,]+0\))$/i.test(t?.light.ink ?? '') ? [err(TOKENS, `--ink is ${t.light.ink}: the black is never flat pure black (ledger L25)`)] : []; },

  // The text face is PP Neue Montreal 2.6: it is the first family the brand values name.
  L38: (root) => { const t = tokens(root); if (!t) return []; const first = (t.light['font-text'] ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '');
    return first === 'PP Neue Montreal' ? [] : [err(TOKENS, `--font-text starts with "${first}": the text face is PP Neue Montreal 2.6, Book and Medium (ledger L38)`)]; },

  // The palette is one family: every hue's tint, fill and deep are built the same way, with the hue kept.
  L33: (root) => {
    const t = tokens(root); if (!t) return [];
    const hues = family(t.light), out = [], at = n => oklch(t.light[n]);
    for (const [step, names, room] of [['tint', hues.map(h => `${h}-tint`), .012], ['fill', hues.filter(h => !OWN_FILL.has(h)), .012], ['deep', hues.map(h => `${h}-deep`), .012]]) {
      if (names.length < 2) continue;
      const Ls = names.map(n => at(n).L);
      if (spread(Ls) > room) { const mid = [...Ls].sort((a, b) => a - b)[Ls.length >> 1];
        for (const n of names.filter(n => Math.abs(at(n).L - mid) > room / 2)) out.push(err(TOKENS, `--${n} is at lightness ${at(n).L.toFixed(3)} and the other ${step}s are at ${mid.toFixed(3)}: a new color is a hue run through the same steps, never a hand-picked hex (ledger L33)`)); }
    }
    for (const h of hues) { const steps = [`${h}-tint`, h, `${h}-deep`].map(n => at(n).H), off = Math.max(turn(steps[0], steps[1]), turn(steps[1], steps[2]), turn(steps[0], steps[2]));
      if (off > 6) out.push(err(TOKENS, `the steps of --${h} drift ${off.toFixed(0)} degrees of hue apart: tint, fill and deep keep one hue (ledger L33)`)); }
    return out;
  },

  // Every fill takes black text and every deep takes white text.
  A2: (root) => {
    const t = tokens(root); if (!t) return [];
    const ink = HEX.test(t.light['on-color'] ?? '') ? t.light['on-color'] : '#0A0A0A', out = [];
    for (const h of family(t.light)) {
      for (const n of [`${h}-tint`, ...(h === 'brick' ? [] : [h])]) { const c = contrast(t.light[n], ink); if (c < 7) out.push(err(TOKENS, `black text on --${n} is ${c.toFixed(1)}:1, under 7:1 (ledger A2)`)); }
      for (const n of [`${h}-deep`, ...(h === 'brick' ? [h] : [])]) { const c = contrast(t.light[n], '#FFFFFF'); if (c < 4.5) out.push(err(TOKENS, `white text on --${n} is ${c.toFixed(1)}:1, under 4.5:1 (ledger A2)`)); }
    }
    return out;
  },

  // Words on a screen use the real marks: a curly apostrophe and the ellipsis character.
  D5: (root, { files }) => inWords(root, files, /[A-Za-z]'[a-z]|\.\.\./g,
    m => `${m === '...' ? 'three dots' : `a straight apostrophe in "${m}"`}: on a screen, write ${m === '...' ? 'the ellipsis character …' : 'the curly apostrophe ’'} (brand-round-10.md §4)`, { phrases: true }),

  // Motion is optional: the phone's Reduce Motion is never overridden.
  M1: (root, { files }) => files.filter(APP).flatMap(f => { const text = withoutComments(f, read(root, f) ?? '');
    return [...text.matchAll(/\bReduceMotion\.Never\b/g)].map(m => err(`${f}:${lineOf(text, m.index)}`, 'ReduceMotion.Never keeps an animation running for someone who turned motion off: give it a still version instead (frontend-standard §3, Optional)')); }),

  // Every motion is named: a screen takes its duration from app/src/ui/motion.ts, never a raw number.
  M2: (root, { files }) => files.filter(f => APP(f) && !f.startsWith('app/src/ui/')).flatMap(f => { const text = withoutComments(f, read(root, f) ?? '');
    return [...text.matchAll(/\b(?:duration|delay)\s*:\s*\d+|\bwith(?:Timing|Delay)\s*\(\s*[^,()]*,?\s*\{?\s*\d{2,}/g)]
      .map(m => err(`${f}:${lineOf(text, m.index)}`, `"${m[0].replace(/\s+/g, ' ')}" is a raw duration: use a named motion from app/src/ui/motion.ts, and add one there with its reason if none fits (frontend-standard §3)`)); }),

  // Nothing listens to scroll or reads the scroll position by hand, and nothing animates every property.
  M3: (root, { files }) => files.filter(f => (APP(f) || /^(?:site|web)\/.*\.(?:tsx?|jsx?|css)$/.test(f)) && !/\.test\./.test(f)).flatMap(f => { const text = f.endsWith('.css') ? read(root, f) ?? '' : withoutComments(f, read(root, f) ?? '');
    return [...text.matchAll(/addEventListener\(\s*['"`](?:scroll|wheel)['"`]|\bwindow\.(?:scrollY|pageYOffset)\b|\bonscroll\s*=|transition\s*:\s*['"`]?all\b/g)]
      .map(m => err(`${f}:${lineOf(text, m.index)}`, /transition/.test(m[0]) ? '"transition: all" animates every property: name transform or opacity (frontend-standard §3, Cheap to render)' : `${m[0]}: tie motion to scroll with a scroll timeline, an IntersectionObserver or Reanimated's scroll handler, never a listener (frontend-standard §3)`)); }),

  // Every named motion says what it is for.
  M4: (root, { files }) => {
    const f = 'app/src/ui/motion.ts', text = read(root, f), WHY = ['feedback', 'origin', 'state', 'progress', 'story', 'recognition'];
    if (text == null) return files.some(x => x.startsWith('app/src/ui/') && x.endsWith('.tsx')) ? [err(f, 'is missing: every motion in the app is named there with its reason (frontend-standard §3)')] : [];
    const body = withoutComments(f, text), at = body.search(/export const MOTIONS\b[^=]*=\s*\{/);
    if (at < 0) return [err(f, "can't read MOTIONS, so no motion's reason would be checked")];
    return [...body.slice(at).matchAll(/^\s*['"]?([\w ]+)['"]?\s*:\s*\{([^}]*)\}/gm)]
      .filter(m => !WHY.includes(m[2].match(/\bwhy\s*:\s*['"](\w+)['"]/)?.[1]))
      .map(m => err(f, `the motion "${m[1]}" has no reason: say which of ${WHY.join(', ')} it is for, or remove it. "It looked good" is not one (frontend-standard §3, Purpose or nothing)`));
  },

  // The behavior table comes before the behavior: every screen has one, written from the still screen.
  P5: (root, { files }) => files.filter(f => /^app\/src\/app\/.*\.tsx$/.test(f) && !/(^|\/)[_+][^/]*$|\+api\.|\.test\./.test(f)).flatMap(f => {
    const table = f.replace(/^app\/src\/app\//, 'app/behavior/').replace(/\.tsx$/, '.json'), raw = read(root, table);
    if (raw == null) return [err(f, `has no behavior table at ${table}: write what each state shows and what each control does before the code (frontend-standard §2, state 8)`)];
    let t; try { t = JSON.parse(raw); } catch { return [err(table, 'is not JSON')]; }
    const out = [];
    if (!Array.isArray(t?.states) || !t.states.length || t.states.some(s => !s?.state || !s?.shows)) out.push(err(table, 'needs "states": a list of { state, shows }, with at least one'));
    if (!Array.isArray(t?.controls) || t.controls.some(c => !c?.control || !c?.on_tap)) out.push(err(table, 'needs "controls": a list of { control, on_tap }, empty when the screen has none'));
    else if (!t.controls.length && /\bonPress\b/.test(withoutComments(f, read(root, f) ?? ''))) out.push(err(table, `lists no controls, and ${f} has something to press: write what each one does`));
    return out;
  }),
};

export const picks = (root, ctx) => Object.values(PICKS).flatMap(fn => fn(root, ctx));
