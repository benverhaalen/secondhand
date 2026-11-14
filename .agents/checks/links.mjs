// Every relative link and heading anchor in the docs resolves, so a summary always reaches its source.
import { existsSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { read, err, stripCode, lineOf } from './util.mjs';

export function slug(heading) { // GitHub's anchor rule
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-');
}
function anchors(text) {
  const seen = new Map(), out = new Set();
  for (const m of stripCode(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const s = slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')), n = seen.get(s) ?? 0;
    out.add(n ? `${s}-${n}` : s); seen.set(s, n + 1);
  }
  return out;
}
export function links(root, { files }) {
  const out = [], cache = new Map();
  const anchorsOf = p => { if (!cache.has(p)) cache.set(p, anchors(read(root, p) ?? '')); return cache.get(p); };
  for (const f of files.filter(f => f.endsWith('.md'))) {
    const text = stripCode(read(root, f) ?? '');
    for (const m of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const t = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(t)) continue; // http, mailto, …
      const [path, hash] = t.split('#');
      const target = path ? normalize(join(dirname(f), decodeURIComponent(path))) : f;
      const where = `${f}:${lineOf(text, m.index)}`;
      if (!existsSync(join(root, target))) { out.push(err(where, `link to ${t}: ${target} does not exist`)); continue; }
      if (hash && target.endsWith('.md') && statSync(join(root, target)).isFile() && !anchorsOf(target).has(hash))
        out.push(err(where, `link to ${t}: no heading #${hash} in ${target}`));
    }
  }
  return out;
}
