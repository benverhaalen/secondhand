import { posix } from 'node:path';
import { read, err, lineOf, withoutStrings } from './util.mjs';
import { imports } from './bundle.mjs';

// The phone runs JavaScript on Hermes, which lacks some APIs Chromium has, so the web checks pass and the app dies on
// the phone (November 15, 2026: every open of You crashed on `new Intl.PluralRules`). Walks every screen's imports.
const screen = /^app\/src\/app\/(?:.*\/)?[^/]+\.tsx?$/;
const skip = /\.test\.tsx?$|\+api\.ts$|^app\/src\/edge\//;
const extensions = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx'];
const LACKS = [
  [/\bIntl\s*\.\s*PluralRules\b/g, 'Intl.PluralRules', 'use plural() from app/src/ui/parts/mark.ts'],
  [/\bIntl\s*\.\s*(Segmenter|ListFormat|RelativeTimeFormat|DisplayNames|Locale)\b/g, 'Intl.$1', 'format it by hand'],
  [/\bnew\s+TextDecoder\b/g, 'TextDecoder', 'decode by hand or keep it on the server'],
  [/\bimport\s*\.\s*meta\b/g, 'import.meta', 'pass the value in'],
];

export function hermes(root, { files }) {
  const available = new Set(files), seen = new Set(), out = [];
  const visit = (file, from) => {
    if (seen.has(file) || skip.test(file)) return;
    seen.add(file);
    const raw = read(root, file);
    if (raw === null) return;
    const code = withoutStrings(file, raw);
    for (const [re, name, fix] of LACKS) for (const m of code.matchAll(re)) {
      const api = name.replace('$1', m[1] ?? '');
      out.push(err(`${file}:${lineOf(code, m.index)}`, `${api} does not exist on the phone (Hermes on iOS), so the app crashes when ${from} loads; ${fix}`));
    }
    for (const spec of imports(file, raw)) {
      if (spec.startsWith('node:')) { out.push(err(file, `imports ${spec}, which the phone bundle cannot resolve (reached from ${from})`)); continue; }
      if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
      const base = spec.startsWith('@/') ? posix.join('app/src', spec.slice(2)) : posix.join(posix.dirname(file), spec);
      if (base === '..' || base.startsWith('../') || posix.isAbsolute(base)) continue;
      const target = extensions.map(ext => base + ext).find(p => available.has(p));
      if (target) visit(target, from);
    }
  };
  for (const f of files.filter(f => screen.test(f) && !skip.test(f))) visit(f, f);
  return out;
}
