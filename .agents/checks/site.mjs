// The website is the app's family (Ben, 09:24: "for each of those problems can you ensure they are enforced in website
// mocks"). On every site page and board, held here on the source:
//   S1  a color comes from tokens.css, never written in place (a mask's alpha is not a color)
//   S3  an app screen is one app-shots.mjs draws from the app's build, never a saved copy (L61)
//   S2  a device the app doesn't use (a shadow on text, a filter, a mask, a gradient, a keyframe animation, glass) cites
//       the Locked ledger row where Ben said yes to it, in a comment in the same rule: "/* L56 */"
// The spacing, radius and weight scales are brand.mjs's, which reads these files too. The rendered checks (B and U rules,
// the faces loading) run on every render in hero/check.mjs and boards/render.mjs, which fail on an error.
import { read, err, warn, lineOf } from './util.mjs';

// The first screen being rebuilt with Ben now, the shared stylesheet and every new board are held to it. The older pages
// and the boards of rounds already picked (01 to 04) are told what to fix until their turn comes.
export const SITE = /^brand\/explore\/web-home\/(?!.*\/(?:out|renders|photos)\/).*\.(?:css|html)$/;
export const HELD = /^brand\/explore\/web-home\/(?:hero\/|boards\/(?!0[1-4]-)|site\.css$)/;

const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/i;
// The brand's own depth: the pill's glow, the focus ring, the card shadows, and the one soft shadow Art. 9.2 lets a medium pick.
const APP_SHADOW = /^(?:none|var\(--(?:pill-glow|focus-ring|shadow-card|shadow-stack|shadow-soft)\))$/;
const DEVICE = [
  [/^text-shadow$/, v => v !== 'none', 'a shadow on text'],
  [/^box-shadow$/, v => !APP_SHADOW.test(v), 'a shadow'],
  [/^(?:-webkit-)?backdrop-filter$/, v => v !== 'none', 'glass'],
  [/^filter$/, v => v !== 'none', 'a filter'],
  [/^(?:-webkit-)?mask(?:-image)?$/, v => v !== 'none', 'a mask'],
  [/^animation(?:-name)?$/, v => !/^none\b/.test(v), 'a keyframe animation'],
  [/^(?:background(?:-image)?|border-image)$/, v => /(?:linear|radial|conic)-gradient\(/.test(v.replace(/var\([^)]*\)/g, '')), 'a gradient written in place'],
];

// The rows Ben locked, by number: only his yes opens a device. A row an agent decided does not.
export function locked(ledger) {
  const part = ledger.split(/^## /m).find(s => s.startsWith('Locked')) ?? '';
  return new Set([...part.matchAll(/^\|\s*(L\d+)\s*\|/gm)].map(m => m[1]));
}

// Each declaration with the comments of the rule it sits in (from the rule's selector to its closing brace).
function declarations(css) {
  const out = [], bare = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  for (const m of bare.matchAll(/([a-z-]+)\s*:\s*([^;{}]+?)\s*(?=;|\})/gi)) {
    const open = bare.lastIndexOf('}', m.index) + 1, close = bare.indexOf('}', m.index);
    out.push({ prop: m[1].toLowerCase(), value: m[2].trim(), at: m.index, notes: css.slice(open, close < 0 ? css.length : close) });
  }
  for (const m of bare.matchAll(/@keyframes\s+([\w-]+)/g)) {
    const open = bare.lastIndexOf('}', m.index) + 1;
    out.push({ prop: '@keyframes', value: m[1], at: m.index, notes: css.slice(open, bare.indexOf('{', m.index)) });
  }
  return out;
}
// The CSS in a page: its <style> blocks and style attributes, each kept at its place so lines still count.
const cssOf = (f, t) => f.endsWith('.css') ? t : t.replace(/<style[^>]*>([\s\S]*?)<\/style>|style="([^"]*)"|[^]/g, (m, a, b) => a != null ? m.replace(/<\/?style[^>]*>/g, s => ' '.repeat(s.length)) : b != null ? ' '.repeat(7) + `{${b}}` : m === '\n' ? '\n' : ' ');

// S3: the site shows the app only as app-shots.mjs draws it from the app's build (L61; Ben, 10:24). A saved render from
// features/app/renders or a shot app-screens.json doesn't list is a copy that drifts from the app.
const SHOTS = 'brand/explore/web-home/app-screens.json';
function shots(root, f, t, say) {
  const listed = new Set((JSON.parse(read(root, SHOTS) ?? '{"shots":[]}').shots ?? []).map(s => s.id)), out = [];
  for (const m of t.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)) {
    const src = m[1], where = `${f}:${lineOf(t, m.index)}`, shot = src.match(/(?:^|\/)web-home\/app\/([\w-]+)\.png$|^(?:\.\.\/)+app\/([\w-]+)\.png$/);
    if (/features\/app\/renders\//.test(src)) out.push(say(where, `${src} is a saved app render: list the screen in ${SHOTS} and use app/<id>.png, which app-shots.mjs redraws from the app on every build (S3, L61)`));
    else if (shot && !listed.has(shot[1] ?? shot[2])) out.push(say(where, `${src} is not a shot ${SHOTS} lists, so no build redraws it (S3, L61)`));
  }
  return out;
}

export function site(root, { files }) {
  const ok = locked(read(root, 'brand/ledger.md') ?? ''), out = [];
  for (const f of files.filter(f => SITE.test(f))) {
    const t = read(root, f); if (t == null) continue;
    const css = cssOf(f, t), say = HELD.test(f) ? err : warn;
    if (f.endsWith('.html')) out.push(...shots(root, f, t, say));
    for (const d of declarations(css)) {
      const where = `${f}:${lineOf(css, d.at)}`;
      if (d.prop !== '@keyframes' && !/^(?:-webkit-)?mask/.test(d.prop) && !d.prop.startsWith('--') && RAW_COLOR.test(d.value.replace(/var\([^)]*\)/g, '')))
        out.push(say(where, `${d.prop}: ${d.value} writes a color in place: use a token from brand/tokens.css, as the app does (S1)`));
      const dev = d.prop === '@keyframes' ? 'a keyframe animation' : DEVICE.find(([p, on]) => p.test(d.prop) && on(d.value))?.[2];
      if (!dev) continue;
      // Motion the constitution's website row names (the field drifts, sections reveal once) may cite it instead: Art. 11.
      const cited = [...d.notes.matchAll(/\b[LAR]\d+\b/g)].map(m => m[0]), motion = dev === 'a keyframe animation' && /\bArt\. 11\b/.test(d.notes);
      if (!motion && !cited.some(c => ok.has(c))) out.push(say(where, `${d.prop === '@keyframes' ? `@keyframes ${d.value}` : `${d.prop}: ${d.value}`} is ${dev}, which the app does not use: cite the Locked row in brand/ledger.md where Ben said yes to it in a comment in this rule${cited.length ? ` (${cited.join(', ')} ${cited.length > 1 ? 'are' : 'is'} not Locked)` : ''}, or build it from the app's parts (S2)`));
    }
  }
  return out;
}
