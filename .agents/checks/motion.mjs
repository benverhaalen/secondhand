// Emil Kowalski's motion and craft rules (MIT, vendored unchanged in .agents/vendor/emil/), held on the app's source where a script can decide them.
// Each check is keyed by its row in .agents/ui-rules.json and has a test named "motion <id>:" in motion.test.mjs that shows it failing on
// the mistake it exists to catch and passing the fixed code. What no script can decide is a judge line there (E23 to E30).
// Rules the house already holds are not repeated: a raw duration in a screen (M2), ReduceMotion.Never (M1), "transition: all" in CSS (M3).
//
// | Id  | Rule                                                        | Emil's line                                                                                              | Held by |
// |-----|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|---------|
// | E1  | Only transform and opacity animate                          | animate-expo §4: "`transform` and `opacity` are free. Everything else is a layout pass."                 | script  |
// | E2  | Durations stay inside the table, under 300 ms, named        | emil-design-eng: "Rule: UI animations should stay under 300ms." animate-expo: "No approximated values."   | script  |
// | E3  | An exit is shorter than its entrance                        | emil-design-eng checklist: "Same enter/exit transition speed / Make exit faster than enter"              | script  |
// | E4  | No ease-in                                                  | animate-expo §5: "Never `ease-in` on UI. It starts slow, delaying the exact moment the user is watching." | script  |
// | E5  | Curves are the strong ones from the table                   | animate-expo §5: "Reanimated's built-ins are as weak as CSS's — use these"                               | script  |
// | E6  | Springs are configured from the table, Apple's form         | animate-expo §5: "use this form, not mass/stiffness/damping"; Hard Rule 3                                | script  |
// | E7  | While the finger is down, the element is the finger         | gestures, track phase: "position maps 1:1 to the pointer. No easing. No duration. No spring."            | script  |
// | E8  | Per-frame code never crosses to React                       | animate-expo §6: "Never `setState` from a gesture or scroll handler."; §8 haptics "never per frame"      | script  |
// | E9  | Motion runs on the UI thread, with Reanimated 4's API       | animate-expo Hard Rule 2: "Reanimated, not core `Animated`."; Never Ship: PanResponder, runOnJS          | script  |
// | E10 | A press gives way to 0.97 the moment the finger lands       | animate-expo §7: "`scale: 0.97` in 100–150ms on any pressable"; "Android ripple only in a Material-styled app" | script |
// | E11 | Nothing scales from or to 0                                 | animate-expo §4: "Never `scale(0)`. Start from `scale(0.9–0.97)` + `opacity: 0`."                        | script  |
// | E12 | No bounce that no finger threw                              | animate-expo §5: "Bounce only when the gesture carried momentum."                                         | script  |
// | E13 | Reduced motion ships with the movement                      | animate-expo Hard Rule 4: "Reduced motion ships with the animation, not as a follow-up."                 | script  |
// | E14 | Every touch target is 44 by 44, hitSlop included            | animate-expo §7: "44×44pt minimum touch target ... If the visual is smaller, add `hitSlop`"              | script  |
// | E15 | Tabs never slide; navigation keeps the platform's motion    | animate-expo §1: "Tab switches never slide."; Never Ship: "A screen transition rebuilt in JS"            | script  |
// | E16 | No `entering` on a virtualized list row                     | animate-expo Never Ship: "`entering` on a virtualized list row"                                          | script  |
// | E17 | A transition names its properties                           | animation-performance Hard Rule 4: "Never `transition: all`. List the exact properties."                 | script  |
// | E18 | Inputs are 16 or larger, and zoom is never locked           | mobile-native §4 (input under 16px zooms); Hard Rule 4: "Never disable zoom."                            | script  |
// | E19 | An image holds its space before it loads                    | break-ui CATALOG: "Slow-loading image / Layout shift without fixed dimensions or `aspect-ratio`"         | script  |
// | E20 | Initials come from whole characters                         | break-ui: "Wrong initials ... `.split(' ')[0][0]` style code / Initials from grapheme clusters"          | script  |
// | E21 | A count is pluralized                                       | break-ui: "\"1 members\", \"0 member\" / Hardcoded plural / `Intl.PluralRules`"                           | script  |
// | E22 | A number on screen goes through Intl                        | break-ui: "`1,284.000000001` ... / Raw number rendered / `Intl.NumberFormat`"                             | script  |
// | E23 | Frequency sets the budget                                   | animate-expo §1 frequency table; emil-design-eng "Never animate keyboard-initiated actions."             | judge   |
// | E24 | Things come from what was touched and leave the way they came | emil-design-eng "Make popovers origin-aware"; gestures "An element dismisses in the direction it entered." | judge |
// | E25 | A gesture feels physical and every motion can be caught     | gestures: interruptibility, "Dismiss on distance OR velocity", "Rubber-band at the edges"                 | judge   |
// | E26 | Haptics: same frame, one per action, never alone            | animate-expo §8: "Same frame as the visual." "One per user action." "Never the only feedback."            | judge   |
// | E27 | Reduced motion is gentler, not broken                       | emil-design-eng: "Reduced motion means fewer and gentler animations, not zero."                          | judge   |
// | E28 | Groups stagger 30 to 80 ms and never block                  | emil-design-eng: "Keep stagger delays short (30-80ms between items)." "never block interaction"           | judge   |
// | E29 | The worst realistic data does not break the screen          | break-ui: failure signatures and CATALOG                                                                  | judge   |
// | E30 | Loading does not move anything                              | break-ui CATALOG: "Skeletons that don't match final layout, spinners that shift content"                 | judge   |
import { read, err, warn, lineOf, withoutComments } from './util.mjs';

const APP = f => /^app\/src\/.*\.(tsx?|jsx?)$/.test(f) && !/\.(test|spec|generated)\./.test(f);
const SCREEN = f => APP(f) && !f.startsWith('app/src/ui/');
// Files that put words on a screen. Server code (app/src/edge, the engines) formats for machines.
const SHOWS = f => APP(f) && (/\.[tj]sx$/.test(f) || f.startsWith('app/src/ui/'));
const TOKENS_TS = 'app/src/ui/tokens.generated.ts', MOTION_TS = 'app/src/ui/motion.ts';
// Emil's three curves (animate-expo §5): strong ease-out, strong ease-in-out, the iOS sheet curve.
const EMIL_CURVES = [[0.23, 1, 0.32, 1], [0.77, 0, 0.175, 1], [0.32, 0.72, 0, 1]];
// The duration table (emil-design-eng §4, animate-expo §5): press 100 to 160, a select or small change 150 to 250, a sheet up to 300.
const TABLE = { feedback: [100, 160], select: [150, 250], panel: [200, 300] }, CAP = 300;

// ---- reading source without a parser ----
// The index of the quote that closes the string opening at j. A template literal's ${...} is skipped whole.
function endOfString(t, j) {
  const q = t[j];
  for (let k = j + 1; k < t.length; k++) {
    if (t[k] === '\\') { k++; continue; }
    if (t[k] === q) return k;
    if (q === '`' && t[k] === '$' && t[k + 1] === '{') k = close(t, k + 1) - 1;
  }
  return t.length;
}
// From the bracket at i, the index just past its partner, with strings skipped.
function close(t, i) {
  const pair = { '(': ')', '[': ']', '{': '}' }, stack = [];
  for (let j = i; j < t.length; j++) {
    const c = t[j];
    if (c === '"' || c === "'" || c === '`') { j = endOfString(t, j); continue; }
    if (pair[c]) stack.push(pair[c]);
    else if (c === stack.at(-1)) { stack.pop(); if (!stack.length) return j + 1; }
  }
  return t.length;
}
// The text inside the call that opens at each match of `re` (which ends at its "(").
const calls = (t, re) => [...t.matchAll(re)].map(m => { const at = m.index + m[0].length - 1; return { at: m.index, from: at + 1, name: m[1], args: t.slice(at + 1, close(t, at) - 1) }; });
// The arguments of a call, split at top-level commas.
function split(s) {
  const out = []; let from = 0;
  for (let j = 0; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'" || c === '`') j = endOfString(s, j);
    else if ('([{'.includes(c)) j = close(s, j) - 1;
    else if (c === ',') { out.push(s.slice(from, j).trim()); from = j + 1; }
  }
  const last = s.slice(from).trim(); if (last) out.push(last);
  return out;
}
// Every opening tag <Name ...>: its name, its attribute text, and where it starts.
function tags(t, name) {
  const out = [];
  for (const m of t.matchAll(new RegExp(`<(${name})(?=[\\s/>])`, 'g'))) {
    let j = m.index + m[0].length;
    for (; j < t.length && t[j] !== '>'; j++) {
      if (t[j] === '{' || t[j] === '(') j = close(t, j) - 1;
      else if (t[j] === '"' || t[j] === "'") j = endOfString(t, j);
    }
    out.push({ name: m[1], attrs: t.slice(m.index + m[0].length, j), at: m.index });
  }
  return out;
}
// The value of an attribute: the expression inside {...}, a quoted string, 'true' when bare, or null when absent.
function attr(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*`).exec(attrs);
  if (!m) return new RegExp(`(?:^|\\s)${name}(?=\\s|$|/)`).test(attrs) ? 'true' : null;
  const i = m.index + m[0].length;
  if (attrs[i] === '{') return attrs.slice(i + 1, close(attrs, i) - 1).trim();
  if (attrs[i] === '"' || attrs[i] === "'") return attrs.slice(i, endOfString(attrs, i) + 1);
  return null;
}
// The value of key: in an object's text, up to the next top-level comma.
function prop(obj, key) {
  const m = new RegExp(`(?:^|[{,\\s])${key}\\s*:\\s*`).exec(obj); if (!m) return null;
  let j = m.index + m[0].length; const from = j;
  for (; j < obj.length; j++) {
    const c = obj[j];
    if (c === '"' || c === "'" || c === '`') j = endOfString(obj, j);
    else if ('([{'.includes(c)) j = close(obj, j) - 1;
    else if (c === ',' || c === '}' || c === ')' || c === ']') break;
  }
  return obj.slice(from, j).trim();
}
// What `const NAME = ...` holds in this file, up to the end of its statement; a useMemo(() => x) gives x.
function constant(t, name) {
  const m = new RegExp(`\\b(?:const|let)\\s+${name}\\s*=\\s*`).exec(t); if (!m) return null;
  let j = m.index + m[0].length; const from = j;
  for (; j < t.length; j++) {
    const c = t[j];
    if (c === '"' || c === "'" || c === '`') j = endOfString(t, j);
    else if ('([{'.includes(c)) j = close(t, j) - 1;
    else if (c === ';' || c === '\n' && !/[.,(=?:&|+]\s*$/.test(t.slice(from, j)) && !/^\s*[.?:&|+]/.test(t.slice(j + 1))) break;
  }
  return t.slice(from, j).trim().replace(/^useMemo\(\s*\(\)\s*=>\s*([\s\S]*?),\s*\[[^\]]*\]\s*\)$/, '$1');
}
// The whole object literal around index i.
function around(t, i) {
  let depth = 0;
  for (let j = i; j >= 0; j--) { if (t[j] === '}') depth++; else if (t[j] === '{') { if (!depth) return t.slice(j, close(t, j)); depth--; } }
  return '';
}
// The body of a function named in this file (function NAME(...) {...}, or const NAME = (...) => ...).
function body(t, name) {
  const f = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(t);
  if (f) { const p = close(t, f.index + f[0].length - 1), b = t.indexOf('{', p); return b < 0 ? '' : t.slice(b, close(t, b)); }
  return constant(t, name) ?? '';
}

// ---- brand values ----
// The token objects of tokens.generated.ts: { motion: { feedback: 150 }, size: {...}, type: { t15: { fontSize: 15 } } }.
function tokens(root) {
  const t = read(root, TOKENS_TS) ?? '', out = {};
  for (const m of t.matchAll(/export const (\w+) = \{([\s\S]*?)\n\} as const;/g)) {
    out[m[1]] = {};
    for (const [, k, v] of m[2].matchAll(/^\s*(\w+):\s*(.+?),?\s*$/gm)) { try { out[m[1]][k] = JSON.parse(v); } catch { out[m[1]][k] = v; } }
  }
  return out;
}
// The named motions of motion.ts: { sheet: { why: 'origin', ms: 'motion.panel' } }.
const motions = root => Object.fromEntries([...withoutComments(MOTION_TS, read(root, MOTION_TS) ?? '').matchAll(/^\s*['"]?(\w+)['"]?\s*:\s*\{\s*why\s*:\s*['"](\w+)['"]\s*,\s*ms\s*:\s*([^}]+?)\s*\}/gm)].map(m => [m[1], { why: m[2], ms: m[3] }]));
// A length or a duration as a number: a literal, '120ms' or '.3s', a token (motion.panel, size.controlMin, space.s3), a named motion, or a constant in this file.
function num(e, ctx, t = '') {
  e = String(e ?? '').trim(); let m;
  if (/^-?\d*\.?\d+$/.test(e)) return Number(e);
  if ((m = /^['"`](\d*\.?\d+)(ms|s)['"`]$/.exec(e))) return Number(m[1]) * (m[2] === 's' ? 1000 : 1);
  if ((m = /^(motion|size|space|radius)\.(\w+)$/.exec(e))) return typeof ctx.tk[m[1]]?.[m[2]] === 'number' ? ctx.tk[m[1]][m[2]] : null;
  if ((m = /^MOTIONS\.(\w+)\.ms$/.exec(e))) return ctx.motions[m[1]] ? num(ctx.motions[m[1]].ms, ctx) : null;
  if (/^[A-Z_][A-Z0-9_]*$|^[a-z]\w*$/.test(e) && t) { const c = constant(t, e); return c && c !== e ? num(c, ctx) : null; }
  return null;
}
// The style objects an element's style={...} names, read from inline literals, styles.x in this file's StyleSheet.create, and type.tNN.
// `whole` is false when part of the style comes from somewhere a script can't follow (a prop, a function).
function styleOf(expr, t, ctx) {
  if (expr == null) return { objs: [], whole: true, none: true };
  const sheet = (() => { const m = /StyleSheet\.create\(\s*\{/.exec(t); if (!m) return {}; const o = t.slice(m.index + m[0].length - 1, close(t, m.index + m[0].length - 1));
    return Object.fromEntries(split(o.slice(1, -1)).map(e => /^(\w+)\s*:\s*(\{[\s\S]*\})$/.exec(e)).filter(Boolean).map(m => [m[1], m[2]])); })();
  const objs = []; let whole = true;
  const walk = s => {
    s = s.trim().replace(/^\(\s*\{\s*\w+\s*\}\s*\)\s*=>\s*/, '');
    if (!s || /^(?:null|undefined|false|true)$/.test(s)) return;
    if (s.startsWith('[')) { split(s.slice(1, close(s, 0) - 1)).forEach(walk); return; }
    if (s.startsWith('{')) { objs.push(s); return; }
    let m;
    if ((m = /^[\w.!]+\s*&&\s*([\s\S]+)$/.exec(s))) { walk(m[1]); return; }
    if ((m = /^[\w.!]+\s*\?\s*([\s\S]+?)\s*:\s*([\s\S]+)$/.exec(s))) { walk(m[1]); walk(m[2]); return; }
    if ((m = /^styles\.(\w+)$/.exec(s)) && sheet[m[1]]) { objs.push(sheet[m[1]]); return; }
    if ((m = /^type\.(t\d+)$/.exec(s)) && ctx.tk.type?.[m[1]]) { objs.push(`{ fontSize: ${ctx.tk.type[m[1]].fontSize} }`); return; }
    if (/^StyleSheet\.absoluteFill(?:Object)?$/.test(s)) { objs.push('{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }'); return; }
    whole = false;
  };
  walk(expr);
  return { objs, whole, none: false };
}
// The largest value a key takes across the style objects, as a number; null when none sets it to a number.
const most = (objs, keys, ctx, t) => { const v = objs.flatMap(o => keys.map(k => num(prop(o.replace(/\.\.\.type\.(t\d+)/g, (_, k) => `fontSize: ${ctx.tk.type?.[k]?.fontSize}`), k), ctx, t))).filter(x => x != null); return v.length ? Math.max(...v) : null; };

const say = (id, skill, msg) => `${msg} (${id}, Emil Kowalski ${skill})`;
const each = (files, pick, fn) => files.filter(pick).flatMap(f => fn(f));

// The checks. Each takes (root, { files }) and the shared context, and returns findings.
export const MOTION = {
  // Layout properties re-run layout on every frame for the node and its siblings. An absolutely placed element with no children is exempt
  // (animate-expo §4), and says so in a comment just above: "// absolute, no children: the tab pill".
  E1: (root, { files }, ctx) => each(files, APP, f => {
    const raw = read(root, f) ?? '', t = withoutComments(f, raw), out = [];
    const LAYOUT = /[{,]\s*(width|height|(?:min|max)(?:Width|Height)|margin\w*|padding\w*|top|left|right|bottom|inset\w*|flex(?:Grow|Shrink|Basis)?|gap|rowGap|columnGap|border\w*Width|fontSize|lineHeight|letterSpacing|elevation)\s*:/g;
    const exempt = at => { const lines = raw.slice(0, at).split('\n').slice(-3).join('\n'); return /absolute/i.test(lines) && /no children|childless/i.test(lines); };
    for (const c of calls(t, /\b(useAnimatedStyle|useAnimatedProps)\s*\(/g)) {
      const extra = c.name === 'useAnimatedProps' ? /[{,]\s*(intensity|blurAmount)\s*:/g : null;
      for (const m of [...c.args.matchAll(LAYOUT), ...(extra ? c.args.matchAll(extra) : [])]) {
        const at = c.from + m.index + m[0].length; if (exempt(at)) continue;
        out.push(err(`${f}:${lineOf(t, at)}`, say('E1', 'animate-expo §4', `${c.name} animates ${m[1]}: ${m[1] === 'elevation' ? 'animating elevation redraws the shadow every frame' : /intensity|blur/.test(m[1]) ? 'animating blur redraws it every frame; crossfade the opacity of a still blur' : 'that re-runs layout every frame'}. Animate transform and opacity (an absolutely placed element with no children may animate its size: say so in a comment above)`)));
      }
    }
    for (const m of t.matchAll(/transitionProperty\s*:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g))
      for (const p of m[1].matchAll(/['"]([\w-]+)['"]/g)) if (/^(?:width|height|(?:min|max)-?(?:width|height)|margin\w*|padding\w*|top|left|right|bottom|flex\w*|gap|fontSize|elevation)$/i.test(p[1]))
        out.push(err(`${f}:${lineOf(t, m.index)}`, say('E1', 'animation-performance', `the transition names ${p[1]}, a layout property: transition transform and opacity`)));
    return out;
  }),

  // The tokens sit inside Emil's table; no timed motion anywhere passes 300 ms; and a screen names its duration in the forms M2 does not read.
  E2: (root, { files }, ctx) => {
    const out = [];
    for (const [k, v] of Object.entries(ctx.tk.motion ?? {})) {
      const [lo, hi] = TABLE[k] ?? [0, CAP];
      if (typeof v === 'number' && (v < lo || v > hi)) out.push(err(TOKENS_TS, say('E2', 'emil-design-eng §4', `motion.${k} is ${v} ms: ${TABLE[k] ? `the table puts it between ${lo} and ${hi}` : `UI motion stays at ${CAP} ms or under`}; change --t-${k} in brand/tokens.css`)));
    }
    const story = e => /MOTIONS\.(\w+)/.test(e) && ['story', 'recognition'].includes(ctx.motions[e.match(/MOTIONS\.(\w+)/)[1]]?.why);
    for (const f of files.filter(APP)) {
      const t = withoutComments(f, read(root, f) ?? ''), found = [];
      for (const c of calls(t, /\b(withTiming)\s*\(/g)) { const d = prop(split(c.args)[1] ?? '', 'duration'); if (d) found.push([c.at, d]); }
      for (const m of t.matchAll(/\.duration\(\s*([^()]*?)\s*\)/g)) found.push([m.index, m[1]]);
      for (const m of t.matchAll(/transitionDuration\s*:\s*(\[[^\]]*\]|[^,}\n]+)/g)) for (const d of m[1].startsWith('[') ? split(m[1].slice(1, -1)) : [m[1]]) found.push([m.index, d]);
      for (const [at, d] of found) { const ms = num(d, ctx, t);
        if (ms != null && ms > CAP && !story(d)) out.push(err(`${f}:${lineOf(t, at)}`, say('E2', 'emil-design-eng §4', `a ${ms} ms motion: UI motion stays at ${CAP} ms or under. A spring for a sheet; a shorter named motion for the rest`))); }
      if (SCREEN(f)) for (const m of t.matchAll(/\.(duration|delay)\(\s*\d|\b(?:transition|animation)(?:Duration|Delay)\s*:\s*(?:\[\s*)?['"`]?\d/g))
        out.push(err(`${f}:${lineOf(t, m.index)}`, say('E2', 'animate-expo Hard Rule 3', `"${m[0]}…" is a raw duration in a screen: take it from app/src/ui/motion.ts`)));
    }
    return out;
  },

  // On one element with both, the exit is shorter than the entrance. A preset with no .duration() runs Reanimated's default, 300 ms.
  E3: (root, { files }, ctx) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    const ms = e => { if (e == null) return null; if (/^[A-Z_][A-Z0-9_]*$|^[a-z]\w*$/.test(e)) e = constant(t, e); if (!e || !/^[A-Z]\w*(?:\.\w+\([^()]*\))*$/.test(e.replace(/\s+/g, ''))) return null;
      const d = /\.duration\(\s*([^()]*?)\s*\)/.exec(e); return d ? num(d[1], ctx, t) : 300; };
    for (const tag of tags(t, '[A-Z][\\w.]*')) {
      const enter = ms(attr(tag.attrs, 'entering')), exit = ms(attr(tag.attrs, 'exiting'));
      if (enter != null && exit != null && exit >= enter) out.push(err(`${f}:${lineOf(t, tag.at)}`, say('E3', 'emil-design-eng checklist; animate-expo RECIPES "Exit ~20% faster than entry"', `<${tag.name}> leaves in ${exit} ms and arrives in ${enter} ms: the exit is shorter than the entrance`)));
    }
    return out;
  }),

  // ease-in starts slow, at the moment the person watches most.
  E4: (root, { files }) => each(files, APP, f => { const t = withoutComments(f, read(root, f) ?? '');
    return [...t.matchAll(/\bEasing\.in\(|(?:TimingFunction|easing)\s*:\s*(?:\[[^\]]*)?['"](?:ease-in|easeIn)['"]/g)]
      .map(m => err(`${f}:${lineOf(t, m.index)}`, say('E4', 'animate-expo §5', `${m[0].trim()} is ease-in, which delays the moment the person is watching: use the strong ease-out, Easing.bezier(0.23, 1, 0.32, 1)`))); }),

  // A curve is one of Emil's three, or a curve the brand tokens name. Reanimated's and CSS's built-ins are too weak; linear is for progress, ease for color.
  E5: (root, { files }, ctx) => {
    const css = read(root, 'brand/tokens.css') ?? '', out = [];
    const brand = [...css.matchAll(/--(ease[\w-]*)\s*:\s*cubic-bezier\(([^)]*)\)/g)].map(m => ({ name: m[1], at: m.index, c: m[2].split(',').map(Number) }));
    const same = (a, b) => a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) < 1e-3);
    const allowed = c => [...EMIL_CURVES, ...brand.map(b => b.c)].some(k => same(c, k));
    // The brand's own curve is a question for Ben, not an error in a screen that follows it.
    for (const b of brand) if (!EMIL_CURVES.some(k => same(b.c, k)))
      out.push(warn(`brand/tokens.css:${lineOf(css, b.at)}`, say('E5', 'emil-design-eng §3', `--${b.name} is cubic-bezier(${b.c.join(', ')}), weaker than Emil's ease-out cubic-bezier(0.23, 1, 0.32, 1): "the built-in CSS easings are too weak". Keep it or change it with Ben`)));
    for (const f of files.filter(APP)) {
      const t = withoutComments(f, read(root, f) ?? '');
      for (const m of t.matchAll(/\bEasing\.bezier\(([^)]*)\)|cubic-bezier\(([^)]*)\)/g)) { const c = (m[1] ?? m[2]).split(',').map(Number);
        if (!allowed(c)) out.push(err(`${f}:${lineOf(t, m.index)}`, say('E5', 'animate-expo §5', `${m[0]} is a curve from neither Emil's table nor brand/tokens.css: use EASE_OUT (0.23, 1, 0.32, 1), EASE_IN_OUT (0.77, 0, 0.175, 1) or EASE_SHEET (0.32, 0.72, 0, 1)`))); }
      for (const m of t.matchAll(/\bEasing\.(out|inOut|quad|cubic|poly|sin|circle|exp)\b|(?:TimingFunction|easing)\s*:\s*(?:\[[^\]]*)?['"](ease-out|ease-in-out|easeOut|easeInOut)['"]/g))
        out.push(err(`${f}:${lineOf(t, m.index)}`, say('E5', 'animate-expo §5', `${m[1] ? `Easing.${m[1]}` : `'${m[2]}'`} is a built-in curve, too weak for UI: use the strong ease-out or ease-in-out bezier from the table`)));
    }
    return out;
  },

  // A spring takes Apple's two parameters, at the table's values: duration 300 or 400, dampingRatio 0.8 or 1 (animate-expo §5 and its recipes).
  E6: (root, { files }, ctx) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    for (const m of t.matchAll(/\{[^{}]*\b(?:dampingRatio|stiffness|damping|mass)\s*:[^{}]*\}/g)) {
      const o = m[0], at = `${f}:${lineOf(t, m.index)}`;
      if (/\b(?:stiffness|mass|damping)\s*:/.test(o)) { out.push(err(at, say('E6', 'animate-expo §5', 'a spring set by mass, stiffness or damping: use Apple\'s form, { duration, dampingRatio }, from the table'))); continue; }
      const d = num(prop(o, 'duration'), ctx, t), r = num(prop(o, 'dampingRatio'), ctx, t);
      if (d != null && ![300, 400].includes(d) || r != null && ![0.8, 1].includes(r)) out.push(err(at, say('E6', 'animate-expo §5', `a spring of ${d ?? '?'} ms at dampingRatio ${r ?? '?'}: the table has 400 at 1 to settle, 400 at 0.8 after a drag, 300 at 0.8 for a sheet`)));
    }
    for (const c of calls(t, /\b(withSpring)\s*\(/g)) if (split(c.args).length < 2) out.push(err(`${f}:${lineOf(t, c.at)}`, say('E6', 'animate-expo Hard Rule 3', 'withSpring with no config runs a spring nobody chose: pass one from the table')));
    for (const m of t.matchAll(/\.(stiffness|mass|damping)\(/g)) out.push(err(`${f}:${lineOf(t, m.index)}`, say('E6', 'animate-expo §5', `.${m[1]}() sets a spring by physics: use .duration() and .dampingRatio() from the table`)));
    return out;
  }),

  // While the finger is down the element is the finger. How it settles after release is judged (E25): Emil's own swipe-to-delete
  // leaves on a timed curve once it commits, so "a spring on release" is not a rule a script can hold without failing his code.
  E7: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? '');
    return handlers(t).filter(h => h.phase === 'track').flatMap(h => [...h.body.matchAll(/\b(withSpring|withTiming|withDecay)\(/g)]
      .map(m => err(`${f}:${lineOf(t, h.at)}`, say('E7', 'gestures, track phase', `${m[1]} in ${h.on}: while the finger is down the element follows it 1:1, with no easing, duration or spring`))));
  }),

  // Frame by frame, nothing re-renders React, calls back into it, or buzzes.
  E8: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    const frames = [...handlers(t).filter(h => h.phase === 'track'),
      ...calls(t, /\b(useAnimatedScrollHandler)\s*\(/g).map(c => ({ on: c.name, body: c.args, at: c.at })),
      ...tags(t, '[\\w.]+').map(g => ({ on: 'onScroll', body: attr(g.attrs, 'onScroll') ?? '', at: g.at })).filter(h => h.body && !/^\w+$/.test(h.body))];
    for (const h of frames) for (const m of h.body.matchAll(/(?<![.\w])(set[A-Z]\w*)\(|\b(scheduleOnRN|runOnJS)\(|\b(Haptics)\.\w+\(/g))
      out.push(err(`${f}:${lineOf(t, h.at)}`, say('E8', 'animate-expo §6', m[1] ? `${m[1]}() in ${h.on} re-renders React every frame: write a shared value and read it in useAnimatedStyle`
        : m[2] ? `${m[2]} in ${h.on} calls the React runtime every frame: do it in onEnd, or in a useAnimatedReaction when a threshold is crossed` : `a haptic in ${h.on} fires every frame: one per action, at the moment it commits`)));
    return out;
  }),

  // Core Animated and PanResponder run motion through the JS thread; runOnJS is gone in Reanimated 4; .value hides a shared value from the compiler.
  E9: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [], at = i => `${f}:${lineOf(t, i)}`;
    for (const m of t.matchAll(/import\s*(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react-native['"]/g))
      for (const n of m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0])) if (['Animated', 'PanResponder'].includes(n))
        out.push(err(at(m.index), say('E9', 'animate-expo Hard Rule 2', `${n} from react-native runs motion on the JS thread: use ${n === 'Animated' ? 'react-native-reanimated' : 'Gesture.Pan() from react-native-gesture-handler'}`)));
    for (const m of t.matchAll(/\brunOnJS\b/g)) out.push(err(at(m.index), say('E9', 'animate-expo §6', 'runOnJS is deprecated in Reanimated 4: use scheduleOnRN from react-native-worklets')));
    for (const [, name] of t.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*use(?:SharedValue|DerivedValue)\s*\(/g))
      for (const m of t.matchAll(new RegExp(`\\b${name}\\.value\\b`, 'g'))) out.push(err(at(m.index), say('E9', 'animate-expo §6', `${name}.value: read and write shared values with .get() and .set(), the form the React Compiler can see`)));
    if (/\bwith(?:Timing|Spring)\(|\bAnimated\./.test(t)) for (const m of t.matchAll(/\bKeyboard\.addListener\(/g))
      out.push(err(at(m.index), say('E9', 'animate-expo RECIPES, keyboard', 'motion that follows the keyboard from Keyboard.addListener lags it: use react-native-keyboard-controller')));
    return out;
  }),

  // A press scales to 0.97 on press-in, the same on both platforms (and brand Art. 11, Press).
  E10: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [], at = i => `${f}:${lineOf(t, i)}`;
    // Where a press sets its scale: scale: pressed ? x : 1, pressed && { scale: x }, a style named for the press, or a scale set in onPressIn.
    const scales = [...t.matchAll(/\bscale\s*:\s*pressed\s*\?\s*(\d*\.\d+)|\bpressed\s*&&\s*\{[^{}]*?(?:\{\s*)?scale\s*:\s*(\d*\.\d+)|\b\w*[pP]ress\w*\s*:\s*\{[^{}]*?(?:\{\s*)?scale\s*:\s*(\d*\.\d+)/g)].map(m => [m.index, m[1] ?? m[2] ?? m[3]]);
    for (const p of t.matchAll(/\bonPressIn\b/g)) for (const m of t.slice(p.index, p.index + 300).split(/\bonPressOut\b/)[0].matchAll(/\b\w*[sS]cale\w*\.set\(\s*with(?:Timing|Spring)\(\s*(\d*\.\d+)|\bscale\s*:\s*(\d*\.\d+)/g)) scales.push([p.index, m[1] ?? m[2]]);
    for (const [i, v] of scales) if (Number(v) !== 0.97) out.push(err(at(i), say('E10', 'animate-expo §7', `a press scales to ${v}: a pressed thing gives way to 0.97, no more and no less`)));
    for (const m of t.matchAll(/\bandroid_ripple\b/g)) out.push(err(at(m.index), say('E10', 'animate-expo §7', 'android_ripple: a ripple belongs to a Material app; secondhand gives the same 0.97 press on both platforms')));
    for (const m of t.matchAll(/<(Touchable(?:Opacity|Highlight|WithoutFeedback))\b/g)) out.push(err(at(m.index), say('E10', 'animate-expo §7', `${m[1]} dims or does nothing on press: use Pressable with the 0.97 scale`)));
    if (/<Pressable\b/.test(t) && !/\bpressed\b|\bonPressIn\b/.test(t)) out.push(err(f, say('E10', 'animate-expo §7', 'a Pressable that shows nothing when the finger lands: "Feedback on press-in, commit on press-out"')));
    return out;
  }),

  E11: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [], at = i => `${f}:${lineOf(t, i)}`;
    const msg = what => say('E11', 'animate-expo §4', `${what}: nothing appears from nothing. Start from 0.95 to 0.97 with opacity 0`);
    for (const m of t.matchAll(/\bscale[XY]?\s*:\s*0(?![.\d])|scale\(\s*0\s*\)/g)) out.push(err(at(m.index), msg(m[0])));
    for (const m of t.matchAll(/\b(Zoom(?:In|Out)\w*)\b/g)) out.push(err(at(m.index), msg(`${m[1]} scales from or to 0`)));
    for (const [, name] of t.matchAll(/\b(?:const|let)\s+(\w*[sS]cale\w*)\s*=\s*useSharedValue\(\s*0\s*\)/g)) out.push(err(at(t.indexOf(name)), msg(`${name} starts at 0`)));
    for (const m of t.matchAll(/\b(\w*[sS]cale\w*)\.set\(\s*(?:with\w+\(\s*)?0(?![.\d])/g)) out.push(err(at(m.index), msg(`${m[1]} goes to 0`)));
    return out;
  }),

  E12: (root, { files }) => each(files, APP, f => { const t = withoutComments(f, read(root, f) ?? '');
    return [...t.matchAll(/\b(Bounce(?:In|Out)\w*)\b|\bEasing\.(bounce|elastic|back)\b/g)].map(m => err(`${f}:${lineOf(t, m.index)}`,
      say('E12', 'animate-expo §5; gestures', `${m[1] ?? `Easing.${m[2]}`} bounces something no finger threw: bounce belongs only at the end of a drag (and brand Art. 11: no bounce)`))); }),

  // A file that moves things (a transform in an animated style, a moving preset, a layout transition, a transform transition) handles Reduce Motion.
  E13: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? '');
    const moves = calls(t, /\b(useAnimatedStyle)\s*\(/g).some(c => /\btransform\s*:/.test(c.args))
      || /\b(?:Slide|Zoom|Bounce|Flip|Stretch|LightSpeed|Roll|Pinwheel|Rotate)(?:In|Out)\w*\b|\bFade(?:In|Out)(?:Up|Down|Left|Right)\b|\b(?:Linear|Sequenced|Fading|Jumping|Curved|Entry|EntryExit)Transition\b|\bKeyframe\b/.test(t)
      || /transitionProperty\s*:\s*(?:\[[^\]]*)?['"]transform['"]/.test(t);
    if (!moves || /\buseReducedMotion\b|\breduceMotion\s*[:(]|\bReduceMotion\.System\b|\bReducedMotionConfig\b/.test(t)) return [];
    return [err(f, say('E13', 'animate-expo Hard Rule 4', 'moves things and never asks about Reduce Motion: read useReducedMotion() and give the still version (a crossfade or an instant change), or set reduceMotion: ReduceMotion.System on each animation'))];
  }),

  // A target smaller than 44 grows with hitSlop, not with its look. Only sizes the script can read are judged.
  E14: (root, { files }, ctx) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    for (const tag of tags(t, 'Pressable|Touchable\\w+|RectButton|BorderlessButton|BaseButton')) {
      const { objs } = styleOf(attr(tag.attrs, 'style'), t, ctx), h = most(objs, ['height', 'minHeight'], ctx, t), w = most(objs, ['width', 'minWidth'], ctx, t);
      if (h == null && w == null) continue;
      const slop = attr(tag.attrs, 'hitSlop'), all = num(slop, ctx, t);
      if (slop != null && all == null && !slop.startsWith('{')) continue;
      const side = k => all ?? num(prop(slop ?? '', k), ctx, t) ?? num(prop(slop ?? '', /top|bottom/.test(k) ? 'vertical' : 'horizontal'), ctx, t) ?? 0;
      for (const [d, v, a, b] of [['tall', h, 'top', 'bottom'], ['wide', w, 'left', 'right']]) if (v != null && v + side(a) + side(b) < 44)
        out.push(err(`${f}:${lineOf(t, tag.at)}`, say('E14', 'animate-expo §7', `<${tag.name}> is ${v + side(a) + side(b)} ${d} to a finger: a target is at least 44 by 44. Add hitSlop to reach it, and keep the look`)));
    }
    return out;
  }),

  E15: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [], at = i => `${f}:${lineOf(t, i)}`;
    for (const g of tags(t, '(?:Native)?Tabs(?:\\.Screen)?')) for (const m of g.attrs.matchAll(/\banimation\s*:\s*['"](\w+)['"]/g)) if (m[1] !== 'none')
      out.push(err(at(g.at), say('E15', 'animate-expo §1', `<${g.name}> sets animation '${m[1]}': tab switches never slide or fade; tabs are peers, so animation: 'none'`)));
    for (const g of tags(t, 'Stack(?:\\.Screen)?')) for (const m of g.attrs.matchAll(/\b(animationDuration|transitionSpec|cardStyleInterpolator)\s*:/g))
      out.push(err(at(g.at), say('E15', 'animate-expo §5 and RECIPES', `${m[1]} on <${g.name}> rewrites the platform's screen transition: keep the native one`)));
    for (const m of t.matchAll(/from\s*['"]@react-navigation\/stack['"]/g)) out.push(err(at(m.index), say('E15', 'animate-expo Never Ship', 'the JS stack rebuilds screen transitions in JS: use the native stack (Expo Router\'s Stack)')));
    return out;
  }),

  // Rows are recycled, so an entrance re-fires every time a row scrolls back into view.
  E16: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    for (const g of tags(t, '(?:Animated\\.)?(?:FlatList|FlashList|SectionList|LegendList)')) {
      const r = attr(g.attrs, 'renderItem'); if (!r) continue;
      if (/\bentering\s*=/.test(/^\w+$/.test(r) ? body(t, r) : r)) out.push(err(`${f}:${lineOf(t, g.at)}`, say('E16', 'animate-expo Never Ship', `<${g.name}> gives its rows an entering animation: rows are recycled, so it re-fires on scroll. Animate the list once, or use itemLayoutAnimation for reflow`)));
    }
    return out;
  }),

  // Reanimated's CSS transitions animate every property when transitionProperty is left out (M3 holds "transition: all" in CSS).
  E17: (root, { files }) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    for (const m of t.matchAll(/transitionProperty\s*:\s*(?:\[[^\]]*)?['"]all['"]/g)) out.push(err(`${f}:${lineOf(t, m.index)}`, say('E17', 'animation-performance Hard Rule 4', "transitionProperty 'all' animates whatever changes next: name the properties, transform and opacity")));
    for (const m of t.matchAll(/\btransitionDuration\s*:/g)) if (!/\btransitionProperty\s*:/.test(around(t, m.index)))
      out.push(err(`${f}:${lineOf(t, m.index)}`, say('E17', 'animation-performance Hard Rule 4', 'a transition with no transitionProperty animates every property: name them, transform and opacity')));
    return out;
  }),

  E18: (root, { files }, ctx) => each(files, APP, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    for (const g of tags(t, '(?:Animated\\.)?TextInput')) {
      const s = styleOf(attr(g.attrs, 'style'), t, ctx), size = s.none ? 14 : most(s.objs, ['fontSize'], ctx, t);
      if (size != null && size < 16) out.push(err(`${f}:${lineOf(t, g.at)}`, say('E18', 'mobile-native §4', `<${g.name}> sets text at ${size}${s.none ? ' (the default)' : ''}: under 16 the phone zooms into the field. Use type.t18, the size for text you type`)));
    }
    for (const m of t.matchAll(/user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0)?(?![.\d])|userScalable\s*:\s*false|maximumScale\s*:\s*1(?![.\d])/g))
      out.push(err(`${f}:${lineOf(t, m.index)}`, say('E18', 'mobile-native Hard Rule 4', `${m[0]} stops people zooming: never disable zoom; set inputs to 16 instead`)));
    return out;
  }),

  // A photo with no size takes none until it loads, then pushes everything below it.
  E19: (root, { files }, ctx) => each(files, SHOWS, f => {
    const t = withoutComments(f, read(root, f) ?? ''), out = [];
    for (const g of tags(t, '(?:Animated\\.)?(?:Image|ImageBackground)')) {
      if (attr(g.attrs, 'width') && attr(g.attrs, 'height')) continue;
      const s = styleOf(attr(g.attrs, 'style'), t, ctx); if (!s.whole) continue;
      const has = k => s.objs.some(o => prop(o, k) != null);
      if (!(has('width') && has('height') || has('aspectRatio') || has('flex') || has('position') && (has('top') || has('inset'))))
        out.push(err(`${f}:${lineOf(t, g.at)}`, say('E19', 'break-ui CATALOG, Images', `<${g.name}> has no size before it loads, so the layout jumps when it arrives: give it a width and height or an aspectRatio`)));
    }
    return out;
  }),

  E20: (root, { files }) => each(files, SHOWS, f => { const t = withoutComments(f, read(root, f) ?? '');
    return [...t.matchAll(/\.charAt\(\s*0\s*\)|\[0\]\[0\]|\.(?:slice|substring|substr)\(\s*0\s*,\s*1\s*\)/g)].map(m => err(`${f}:${lineOf(t, m.index)}`,
      say('E20', 'break-ui', `${m[0]} takes half of an emoji or an accented letter for "🦊 Fox" or "Ólafur": take the first grapheme with Intl.Segmenter`))); }),

  // A count followed by a plural noun, written in place: "1 offers".
  E21: (root, { files }) => each(files, SHOWS, f => { const t = withoutComments(f, read(root, f) ?? '');
    return [...t.matchAll(/\$?\{\s*([\w.]+?)\s*\}\s+([a-z]{3,}s)\b/g)].filter(m => /(?:\.length|^n|^count|Count|^total|Total|^num\w*)$/.test(m[1]))
      .map(m => err(`${f}:${lineOf(t, m.index)}`, say('E21', 'break-ui', `"{${m[1]}} ${m[2]}" reads "1 ${m[2]}" at one: pluralize with Intl.PluralRules or a string per count`))); }),

  E22: (root, { files }) => each(files, SHOWS, f => { const t = withoutComments(f, read(root, f) ?? '');
    return [...t.matchAll(/\.toFixed\(|`[^`]*\$\$\{|['"]\$['"]\s*\+|\+\s*['"]\$['"]/g)].map(m => err(`${f}:${lineOf(t, m.index)}`,
      say('E22', 'break-ui', `${m[0].includes('toFixed') ? '.toFixed()' : 'a "$" glued to a number'} shows 1284 with no separator and one currency for everyone: format with Intl.NumberFormat in the person's locale`))); }),
};

// The handlers of each gesture in this file: Gesture.Pan().onUpdate(...) chains and Gesture Handler 3's usePanGesture({ onUpdate }).
// phase: 'track' while the finger is down, 'release' once it lifts.
function handlers(t) {
  const out = [], PHASE = { onUpdate: 'track', onChange: 'track', onEnd: 'release', onFinalize: 'release', onDeactivate: 'release' };
  for (const m of t.matchAll(/\bGesture\.(Pan|Pinch|Rotation|Fling|Tap|LongPress)\(\s*\)/g)) {
    let j = m.index + m[0].length;
    for (let c; (c = /^\s*\.(\w+)\(/.exec(t.slice(j))); ) {
      const open = j + c[0].length - 1, end = close(t, open);
      if (PHASE[c[1]]) out.push({ on: c[1], phase: PHASE[c[1]], body: t.slice(open + 1, end - 1), at: open });
      j = end;
    }
  }
  for (const c of calls(t, /\buse(Pan|Pinch|Rotation|Fling|Tap|LongPress)Gesture\s*\(/g))
    for (const k of Object.keys(PHASE)) { const b = prop(c.args, k); if (b) out.push({ on: k, phase: PHASE[k], body: b, at: c.at + c.args.indexOf(k) }); }
  return out;
}

export function motion(root, ctx) {
  const shared = { tk: tokens(root), motions: motions(root) };
  return Object.values(MOTION).flatMap(fn => fn(root, ctx, shared));
}
