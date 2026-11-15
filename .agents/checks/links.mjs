// Every relative link and heading anchor in the docs resolves, so a summary always reaches its source.
import { existsSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path/posix'; // repo paths use forward slashes on every OS
import { read, err, warn, stripCode, lineOf } from './util.mjs';

export function slug(heading) { // GitHub's anchor rule
  return heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-');
}
export function anchors(text) {
  const seen = new Map(), out = new Set();
  for (const m of stripCode(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const s = slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')), n = seen.get(s) ?? 0;
    out.add(n ? `${s}-${n}` : s); seen.set(s, n + 1);
  }
  return out;
}
// awaited: files another person's agent cites before pushing them (.agents/awaited.json). A link to one is a question until its date, never forever.
export function links(root, { files, awaited = [], now = Date.now() }) {
  const out = [], cache = new Map(), waiting = new Map();
  const open = new Map(awaited.filter(a => Date.parse(a.until) > now).map(a => [normalize(a.path), a]));
  const anchorsOf = p => { if (!cache.has(p)) cache.set(p, anchors(read(root, p) ?? '')); return cache.get(p); };
  // A vendored skill is copied unchanged (AGENTS.md), so a link to a file its author did not ship stays as written.
  for (const f of files.filter(f => f.endsWith('.md') && !f.startsWith('.agents/vendor/'))) {
    const text = stripCode(read(root, f) ?? '');
    for (const m of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const t = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(t)) continue; // http, mailto, …
      const [path, hash] = t.split('#');
      const target = path ? normalize(join(dirname(f), decodeURIComponent(path))) : f;
      const where = `${f}:${lineOf(text, m.index)}`;
      if (!existsSync(join(root, target))) {
        if (open.has(target)) waiting.set(target, (waiting.get(target) ?? 0) + 1);
        else out.push(err(where, `link to ${t}: ${target} does not exist`));
        continue;
      }
      if (hash && target.endsWith('.md') && statSync(join(root, target)).isFile() && !anchorsOf(target).has(hash))
        out.push(err(where, `link to ${t}: no heading #${hash} in ${target}`));
    }
  }
  for (const [path, n] of waiting) { const a = open.get(path); out.push(warn(path, `${n} link${n > 1 ? 's' : ''} wait for this file from ${a.owner} until ${a.until}: ${a.why}`)); }
  for (const a of awaited) if (existsSync(join(root, a.path))) out.push(warn(a.path, 'has landed: delete its entry in .agents/awaited.json'));
  return out;
}
