// The brand constitution's scales (Part IV: B13 weights, B17 spacing, B20 radius) hold in tokens.css and in app code.
import { read, err, lineOf } from './util.mjs';

const UI = /\.(tsx|jsx|ts|js|css|scss|html|vue|svelte)$/;
const NOT_APP = /^(brand|research|assets|scripts|spec|\.agents|node_modules)\/|(^|\/)\.|\.test\.|\.config\./;

export function scales(constitution) {
  const row = id => (constitution.match(new RegExp(`^\\|\\s*${id}\\s*\\|.*$`, 'm')) ?? [''])[0];
  const set = id => { const m = row(id).match(/\{([^}]*)\}/); return m ? new Set(m[1].split(',').map(x => Number(x.trim()))) : null; };
  return { weight: set('B13'), space: set('B17'), radius: set('B20') };
}
// Lengths in px (a bare number is px, as in React styles); rem counts as 16px; negative margins use their size.
// Any other unit (em, pt, %, vh) can't be checked against a px scale, so it comes back NaN and fails: use a token.
const px = v => [...v.replace(/var\([^)]*\)/g, '').matchAll(/(-?\d*\.?\d+)(px|rem|em|pt|vh|vw|ch|ex|%)?/g)]
  .map(([, n, u]) => !u || u === 'px' ? Math.abs(Number(n)) : u === 'rem' ? Math.abs(Number(n)) * 16 : NaN);

export function brand(root, { files }) {
  const c = read(root, 'brand/constitution.md'); if (!c) return [];
  const s = scales(c), out = [];
  // Fail closed: if a row is reworded so its set can't be read, the check would pass everything.
  for (const [k, id] of [['weight', 'B13'], ['space', 'B17'], ['radius', 'B20']])
    if (!s[k]?.size || [...s[k]].some(Number.isNaN)) out.push(err('brand/constitution.md', `can't read the ${id} scale as "{a, b, c}" in its Part IV row, so nothing would be checked against it; keep the set in braces`));
  const tokens = read(root, 'brand/tokens.css') ?? '';
  const bad = (set, vals) => set ? vals.filter(v => !set.has(v)) : [];  // a missing set is already an error above
  for (const m of tokens.matchAll(/--(s-\d+|r-[\w-]+)\s*:\s*([^;]+);/g)) {
    const [kind, set, id] = m[1].startsWith('s') ? ['spacing', s.space, 'B17'] : ['radius', s.radius, 'B20'];
    for (const v of bad(set, px(m[2]))) out.push(err(`brand/tokens.css:${lineOf(tokens, m.index)}`, `--${m[1]}: ${v}px is not in the constitution's ${kind} scale (${id}); change both in one commit`));
  }
  for (const f of files.filter(f => UI.test(f) && !NOT_APP.test(f))) {
    const t = read(root, f) ?? '';
    const rules = [
      [/font-?[Ww]eight["']?\s*[:=]\s*["']?(\d{3})/g, v => [Number(v)], s.weight, 'B13 weight'],
      [/\b(?:margin|padding|gap|row-gap|column-gap)(?:-?[A-Za-z]*)?["']?\s*[:=]\s*["']?([^;,"'\n}]+)/g, px, s.space, 'B17 spacing'],
      [/border-?[Rr]adius["']?\s*[:=]\s*["']?([^;,"'\n}]+)/g, px, s.radius, 'B20 radius'],
    ];
    for (const [re, parse, set, id] of rules) for (const m of t.matchAll(re))
      for (const v of bad(set, parse(m[1]))) out.push(err(`${f}:${lineOf(t, m.index)}`, `${Number.isNaN(v) ? m[1].trim() : v} is off the ${id} scale in brand/constitution.md (written "${m[1].trim()}"); use a token`));
  }
  return out;
}
