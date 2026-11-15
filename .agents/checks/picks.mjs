// Ben's brand picks and the UI loop's rules, each held by a script where a script can hold it.
// Which rule is held by what is in .agents/ui-rules.json; rules.mjs fails when a pick in the ledger has no row there.
// Every check is keyed by the id of the rule it holds, and has a test named "picks <id>:" in checks.test.mjs.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { read, err, lineOf, withoutComments } from './util.mjs';

const TOKENS = 'brand/tokens.css';
const APP = f => /^app\/src\/.*\.(tsx?|jsx?)$/.test(f) && !/\.(test|generated)\./.test(f);
const SCREEN = f => APP(f) && /\.tsx$/.test(f);

// Words a person reads on a screen: JSX text and quoted strings. `label` is true when the string names something for a screen reader.
const LABEL = /(?:accessibilityLabel|accessibilityHint|aria-label|alt|testID)\s*[=:]\s*\{?\s*$/;
function words(f, text) {
  const t = withoutComments(f, text);
  return [...t.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g), ...t.matchAll(/"([^"\n]+)"|'([^'\n]+)'|`([^`]+)`/g)]
    .map(m => ({ s: m[1] ?? m[2] ?? m[3] ?? '', i: m.index, label: LABEL.test(t.slice(Math.max(0, m.index - 40), m.index)) }));
}
// One finding per match of `re` in the words of each screen.
const inWords = (root, files, re, msg, { labels = false } = {}) => files.filter(SCREEN).flatMap(f => {
  const text = read(root, f) ?? '';
  return words(f, text).filter(w => labels || !w.label).flatMap(w => [...w.s.matchAll(re)].map(m => err(`${f}:${lineOf(text, w.i)}`, msg(m[0]))));
});

// tokens.css as { light: {name: value}, dark: {name: value} }.
function tokens(root) {
  const css = read(root, TOKENS); if (css == null) return null;
  const block = s => Object.fromEntries([...(s ?? '').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  const [light, ...rest] = css.split(/:root\[data-theme=["']dark["']\]/);
  return { css, light: block(light), dark: block(rest.join('').split('}')[0]) };
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
  L3: (root, { files }) => inWords(root, files, /\bSecond[ -]?[Hh]and\b|\bSECOND[ -]?HAND\b|\bsecond[ -]?Hand\b/g,
    m => `"${m}": the name is written "secondhand", lowercase (ledger L3)`, { labels: true }),

  // A marketplace shows as its logo. Its name is only for a screen reader.
  L6: (root, { files }) => inWords(root, files, /\b(?:eBay|Poshmark|Depop|Mercari|Grailed|OfferUp|Facebook Marketplace)\b/g,
    m => `"${m}" as words: show the logo from assets/platforms and put the name in accessibilityLabel (ledger L6)`),

  // No mono face, no Marist, no Inter, in the brand values or in the app.
  L7: (root, { files }) => {
    const BANNED = /\b(?:Inter|Marist|monospace|Courier(?: New)?|Menlo|Consolas|[A-Z][\w ]*? Mono)\b/g, out = [];
    const t = tokens(root);
    for (const [n, v] of Object.entries(t?.light ?? {})) if (n.startsWith('font-'))
      for (const m of v.matchAll(BANNED)) out.push(err(`${TOKENS}:${lineOf(t.css, t.css.indexOf(`--${n}`))}`, `--${n} names ${m[0]}: the faces are Neue Montreal and Clofie, with no mono, Marist or Inter (ledger L7, L20, L21)`));
    for (const f of files.filter(APP)) { const text = read(root, f) ?? '';
      for (const w of words(f, text)) for (const m of w.s.matchAll(BANNED)) if (/font|Font/.test(text.slice(Math.max(0, w.i - 60), w.i)))
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
    const pills = [...((grid ?? '').match(/export const PILLS\s*=\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
    if (!pills.length) return [];
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
  L19: (root, { files }) => [TOKENS, ...files.filter(APP)].flatMap(f => { const text = read(root, f) ?? '';
    return [...text.matchAll(/repeating-(?:linear|radial|conic)-gradient|feTurbulence|(?:noise|grain)[\w-]*\.(?:png|svg|jpe?g|webp)/gi)]
      .map(m => err(`${f}:${lineOf(text, m.index)}`, `${m[0]}: the gradient has no lines and no grain (ledger L19)`)); }),

  // Light and dark differ only in color.
  L22: (root, { files }) => {
    const t = tokens(root), out = [];
    const isColor = v => /^(?:#|rgba?\(|hsla?\(|oklch\()/.test(v ?? '');
    for (const n of Object.keys(t?.dark ?? {})) if (!isColor(t.light[n]))
      out.push(err(TOKENS, `dark mode changes --${n}, which is not a color: light and dark differ only in color (ledger L22)`));
    for (const f of files.filter(f => APP(f) && !f.startsWith('app/src/ui/'))) { const text = withoutComments(f, read(root, f) ?? '');
      for (const m of text.matchAll(/\buseColorScheme\b|\bAppearance\.getColorScheme\b/g))
        out.push(err(`${f}:${lineOf(text, m.index)}`, `${m[0]} in a screen: a screen never branches on light or dark; the parts in app/src/ui take the colors (ledger L22)`)); }
    return out;
  },

  // The filled button is black with depth, never pure black.
  L25: (root) => { const t = tokens(root); return /^(?:#0{3}|#0{6}|black|rgb\(0[ ,]+0[ ,]+0\))$/i.test(t?.light.ink ?? '') ? [err(TOKENS, `--ink is ${t.light.ink}: the black is never flat pure black (ledger L25)`)] : []; },

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

  // The behavior table comes before the behavior: every screen has one, written from the still screen.
  P5: (root, { files }) => files.filter(f => /^app\/src\/app\/.*\.tsx$/.test(f) && !/(^|\/)[_+][^/]*$|\+api\./.test(f)).flatMap(f => {
    const table = f.replace(/^app\/src\/app\//, 'app/behavior/').replace(/\.tsx$/, '.json'), raw = read(root, table);
    if (raw == null) return [err(f, `has no behavior table at ${table}: write what each state shows and what each control does before the code (frontend-standard §2, state 8)`)];
    let t; try { t = JSON.parse(raw); } catch { return [err(table, 'is not JSON')]; }
    const out = [];
    if (!Array.isArray(t.states) || !t.states.length || t.states.some(s => !s.state || !s.shows)) out.push(err(table, 'needs "states": a list of { state, shows }, with at least one'));
    if (!Array.isArray(t.controls) || t.controls.some(c => !c.control || !c.on_tap)) out.push(err(table, 'needs "controls": a list of { control, on_tap }, empty when the screen has none'));
    return out;
  }),
};

export const picks = (root, ctx) => Object.values(PICKS).flatMap(fn => fn(root, ctx));
