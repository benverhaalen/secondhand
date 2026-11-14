// Everything that runs logs through log/ (log/README.md), and no raw log reaches this public repo.
// The print rule is an error. The outside-call and random rules are warnings: they are guesses from the text, there to make you look.
import { read, err, warn, lineOf, isProductCode, withoutComments } from './util.mjs';
import { checkLog } from '../../spec/log.mjs';

// Tooling, research prototypes, tests and config print on purpose, and the logger itself is the one place that writes lines (isProductCode in util.mjs).
const PRINT = [
  [/\.(tsx?|jsx?|mjs|cjs)$/, /(?<![\w.$])console\s*\.\s*\w+\s*\(|=\s*console\b|\bprocess\.std(?:out|err)\.write\s*\(/g],
  [/\.py$/, /(?<![\w.])p?print\s*\(|\bsys\.std(?:out|err)\.write\s*\(|(?<![\w.])logging\.(?:debug|info|warning|error|exception|critical|log)\s*\(/g],
  [/\.swift$/, /(?<![\w.]|func\s)(?:print|debugPrint|NSLog|os_log)\s*\(/g],
];
const OUTSIDE = /(?<![\w.])fetch\s*\(|\baxios\b|\brequests\.\w+\s*\(|\bhttpx\.|\baiohttp\b|\burllib\b|\bURLSession\b|\bXMLHttpRequest\b|\bnew WebSocket\b|\b(?:generate|stream)(?:Text|Object)\s*\(|\.(?:responses|completions|messages)\.create\s*\(|\bsubprocess\./;
const WRAPPED = /\.a?call\s*\(\s*['"](?:http|model|tool|browser|db|native)['"]/;
const RANDOM = /\bMath\.random\s*\(|(?<![\w.])random\.(?:random|randint|randrange|choice|shuffle|uniform)\s*\(/;

export function logging(root, { files }) {
  const out = [];
  for (const f of files) {
    if (/\.log$/.test(f) || /(^|\/)logs\/.*\.(jsonl|ndjson|json|txt|tsv)$/.test(f)) { out.push(err(f, 'raw logs are never committed; logs/ is ignored by git')); continue; }
    if (f.endsWith('.jsonl')) {
      const text = read(root, f) ?? '', first = text.split('\n').find(l => l.trim());
      let e; try { e = JSON.parse(first); } catch { e = null; }
      if (e && e.event !== undefined && e.session !== undefined) for (const p of checkLog(text).problems.slice(0, 5)) out.push(err(f, `${p} (node spec/log.mjs ${f})`));
      continue;
    }
    if (!isProductCode(f)) continue;
    const text = withoutComments(f, read(root, f) ?? '');
    for (const [ext, re] of PRINT) if (ext.test(f)) for (const m of text.matchAll(re))
      out.push(err(`${f}:${lineOf(text, m.index)}`, `${m[0].trim().replace(/\s*\($/, '').replace(/^=\s*/, '')} writes a line no one can replay; use the logger (log/README.md)`));
    if (OUTSIDE.test(text) && !WRAPPED.test(text)) out.push(warn(f, 'makes an outside call with no log.call around it: is its input and result logged? (log/README.md)'));
    if (RANDOM.test(text)) out.push(warn(f, 'uses its own random numbers: log.random() comes from the logged seed, so the run can be replayed'));
  }
  return out;
}
