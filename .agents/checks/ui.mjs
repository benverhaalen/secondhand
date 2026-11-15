// App code uses brand tokens and passes the copy rules (brand/coder-card.md, product/copy.md).
import { read, err, warn, lineOf } from './util.mjs';
import { scan } from '../../scripts/copy-lint.mjs';

const UI = /\.(tsx|jsx|ts|js|css|scss|html|vue|svelte|swift)$/;
// A file named tokens.css is where the raw values live (the site's copy is made by web/scripts/tokens.mjs).
const NOT_APP = /^(brand|research|assets|scripts|\.agents|node_modules)\/|(^|\/)\.|\.test\.|\.config\.|\.generated\.|(^|\/)tokens\.css$/;
// Strings a person reads: JSX/HTML text and quoted literals.
export const strings = t => [...t.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g), ...t.matchAll(/"([^"\n]*[A-Za-z ][^"\n]*)"|'([^'\n]*[A-Za-z ][^'\n]*)'/g)]
  .map(m => ({ s: m[1] ?? m[2] ?? '', i: m.index }));

export function ui(root, { files }) {
  const out = [];
  for (const f of files.filter(f => UI.test(f) && !NOT_APP.test(f))) {
    const text = read(root, f) ?? '';
    const code = text.replace(/var\(--[\w-]+\)/g, '');
    for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?|oklch)\(/g))
      if (!/^#\d+$/.test(m[0]) || m[0].length > 4) out.push(err(`${f}:${lineOf(code, m.index)}`, `raw color ${m[0]}: use var(--token) from brand/tokens.css`));
    // A font-face block defines a family, it does not set one: its name is not a use of a literal font.
    const used = code.replace(/@font-face\s*\{[^}]*\}/g, m => m.replace(/[^\n]/g, ' '));
    for (const m of used.matchAll(/font-?[Ff]amily["']?\s*[:=]\s*["']?([^;"'\n,}]+)/g))
      if (!/^\s*(var\(|inherit|`?\$\{)/.test(m[1]) && m[1].trim()) out.push(err(`${f}:${lineOf(code, m.index)}`, `font ${m[1].trim()}: use the font token from brand/tokens.css`));
    // The server's code (edge, engines) holds no words a person reads in the app; its strings are code.
    if (!/^app\/src\/(edge|engines)\//.test(f)) for (const { s, i } of strings(text)) for (const h of scan(s)) {
      const where = `${f}:${lineOf(text, i)}`, msg = `"${h.match}" ${h.why} (product/copy.md ${h.id})`;
      // Every hit is an error: all text passes the anti-claudish pass (Ben, 10:11, product/words.md).
      out.push(err(where, msg));
    }
  }
  return out;
}
