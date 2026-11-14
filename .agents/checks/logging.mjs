// Everything that runs logs through log/ (log/README.md), and no raw log reaches this public repo.
import { read, err, warn, lineOf } from './util.mjs';
import { checkLog } from '../../spec/log.mjs';

const CODE = /\.(tsx?|jsx?|mjs|cjs|py|swift)$/;
// Tooling, research prototypes, tests and config print on purpose. The logger itself is the one place that writes lines.
const EXEMPT = /^(\.agents|scripts|spec|research|assets|brand|log)\/|(^|\/)(node_modules|Pods|\.expo|build|dist)\/|\.(test|spec|config)\.[a-z]+$|\.d\.ts$/;
const PRINT = [
  [/\.(tsx?|jsx?|mjs|cjs)$/, /\bconsole\.(log|info|warn|error|debug)\s*\(/g],
  [/\.py$/, /^[ \t]*print\s*\(/gm],
  [/\.swift$/, /\b(print|NSLog|os_log)\s*\(/g],
];
const OUTSIDE = /\bfetch\s*\(|\baxios\b|\brequests\.(get|post|put|patch|delete|request)\s*\(|\bhttpx\.|\baiohttp\b|\bURLSession\b/;
const WRAPPED = /\.a?call\s*\(/;

export function logging(root, { files }) {
  const out = [];
  for (const f of files) {
    if (/(^|\/)logs\//.test(f) || /\.log$/.test(f)) { out.push(err(f, 'raw logs are never committed; logs/ is ignored by git')); continue; }
    if (f.endsWith('.jsonl')) {
      const text = read(root, f) ?? '', first = text.split('\n').find(l => l.trim());
      let e; try { e = JSON.parse(first); } catch { e = null; }
      if (e && e.event !== undefined && e.session !== undefined) for (const p of checkLog(text).problems.slice(0, 5)) out.push(err(f, `${p} (node spec/log.mjs ${f})`));
      continue;
    }
    if (!CODE.test(f) || EXEMPT.test(f)) continue;
    const text = read(root, f) ?? '';
    for (const [ext, re] of PRINT) if (ext.test(f)) for (const m of text.matchAll(re))
      out.push(err(`${f}:${lineOf(text, m.index)}`, `${m[0].trim().replace(/\s*\($/, '')} writes a line no one can replay; use the logger (log/README.md)`));
    if (OUTSIDE.test(text) && !WRAPPED.test(text)) out.push(warn(f, 'makes an outside call with no log.call around it: is its input and result logged? (log/README.md)'));
  }
  return out;
}
