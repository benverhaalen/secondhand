// App code uses brand tokens and passes the copy rules (brand/coder-card.md, product/copy.md).
import { read, err, warn, lineOf } from './util.mjs';
import { scan } from '../../scripts/copy-lint.mjs';

const UI = /\.(tsx|jsx|ts|js|css|scss|html|vue|svelte|swift)$/;
const NOT_APP = /^(brand|research|assets|scripts|\.agents|node_modules)\/|(^|\/)\.|\.test\.|\.config\./;
// Strings a person reads: JSX/HTML text and quoted literals.
const strings = t => [...t.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g), ...t.matchAll(/"([^"\n]*[A-Za-z ][^"\n]*)"|'([^'\n]*[A-Za-z ][^'\n]*)'/g)]
  .map(m => ({ s: m[1] ?? m[2] ?? '', i: m.index }));

export function ui(root, { files }) {
  const out = [];
  for (const f of files.filter(f => UI.test(f) && !NOT_APP.test(f))) {
    const text = read(root, f) ?? '';
    const code = text.replace(/var\(--[\w-]+\)/g, '');
    for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgba?|hsla?|oklch)\(/g))
      if (!/^#\d+$/.test(m[0]) || m[0].length > 4) out.push(err(`${f}:${lineOf(code, m.index)}`, `raw color ${m[0]}: use var(--token) from brand/tokens.css`));
    for (const m of code.matchAll(/font-?[Ff]amily["']?\s*[:=]\s*["']?([^;"'\n,}]+)/g))
      if (!/^\s*(var\(|inherit|\$\{)/.test(m[1]) && m[1].trim()) out.push(err(`${f}:${lineOf(code, m.index)}`, `font ${m[1].trim()}: use the font token from brand/tokens.css`));
    for (const { s, i } of strings(text)) for (const h of scan(s)) {
      const where = `${f}:${lineOf(text, i)}`, msg = `"${h.match}" ${h.why} (product/copy.md ${h.id})`;
      out.push(h.id === 'O13' ? err(where, msg) : warn(where, msg));
    }
  }
  return out;
}
