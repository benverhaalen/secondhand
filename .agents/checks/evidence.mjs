// What a feature's work rests on, read from the links the docs already hold, so nothing here is a second index that drifts.
// Used by scripts/evidence.mjs (what to read before building) and by check.mjs (how much research reaches the spec).
import { join, dirname, normalize } from 'node:path/posix';
import { read, stripCode } from './util.mjs';
import { slug } from './links.mjs';

export const isNote = p => /^research\/[^/]+\/[^/]+\/.+\.md$/.test(p) && !p.endsWith('README.md');

// Relative markdown links out of a file, as repo paths with their anchors.
export function outLinks(root, f) {
  const text = f.endsWith('.md') ? read(root, f) : null;
  if (text == null) return [];
  const out = [];
  for (const m of stripCode(text).matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(m[1])) continue;
    const [p, hash] = m[1].split('#');
    out.push({ path: p ? normalize(join(dirname(f), decodeURIComponent(p))) : f, hash: hash || null });
  }
  return out;
}

// decisions.md split into entries: { anchor, title, text }.
export function decisionEntries(root) {
  return (read(root, 'product/decisions.md') ?? '').split(/\n(?=## )/).slice(1)
    .map(e => { const title = e.split('\n')[0].replace(/^## /, ''); return { anchor: slug(title), title, text: e }; });
}

// A note's question, and how many claims carry each evidence mark.
export function noteInfo(root, f) {
  const text = read(root, f) ?? '';
  const n = w => (text.match(new RegExp(`\\b${w}\\b|\\[${w[0].toUpperCase()}\\]`, 'gi')) ?? []).length;
  return { title: (text.match(/^# (.+)$/m) ?? [])[1] ?? f, observed: n('observed'), asserted: n('asserted'), inferred: n('inferred') };
}

// The rows of spec/coverage.md's section for a slug whose evidence is weak, contradicted or untested.
export function coverageGaps(root, s) {
  const sec = (read(root, 'spec/coverage.md') ?? '').split(/\n(?=## )/).find(x => x.startsWith(`## ${s}\n`)) ?? '';
  return sec.split('\n').filter(l => l.startsWith('| ') && !/^\|\s*Design question|^\|-/.test(l))
    .map(l => l.split(' | ').map(c => c.replace(/^\|\s*|\s*\|$/g, '').trim()))
    .filter(c => /^(weak|no|untested)\b/i.test(c[4] ?? '')).map(c => ({ question: c[0], mark: c[4] }));
}

// Everything the work on these feature slugs rests on.
export function chain(root, files, slugs) {
  const has = new Set(files);
  const specs = slugs.map(s => `spec/features/${s}.md`).filter(f => has.has(f));
  const pages = slugs.map(s => `features/${s}/README.md`).filter(f => has.has(f));
  const cards = new Set(), words = new Set(), decided = new Set(), bySpec = new Map(), byPage = new Set(), near = new Map();
  const take = (f, inSpec, own = false) => {
    for (const l of outLinks(root, f)) {
      const other = l.path.match(/^spec\/features\/([\w-]+)\.md$|^features\/([\w-]+)\//);
      if (own && other && !slugs.includes(other[1] ?? other[2])) near.set(other[1] ?? other[2], (near.get(other[1] ?? other[2]) ?? 0) + 1);
      if (l.path === 'product/decisions.md' && l.hash) decided.add(l.hash);
      else if (l.path === 'product/words.md' && l.hash) words.add(l.hash);
      else if (isNote(l.path) && has.has(l.path)) {
        if (!inSpec) { byPage.add(l.path); continue; }
        if (!bySpec.has(l.path)) bySpec.set(l.path, new Set());
        if (l.hash) bySpec.get(l.path).add(l.hash);
      } else if (inSpec && /^spec\/determinations\/.+\.md$/.test(l.path) && has.has(l.path) && !cards.has(l.path)) cards.add(l.path);
    }
  };
  for (const f of specs) take(f, true, true);
  for (const f of [...cards]) take(f, true);
  for (const f of pages) take(f, false);
  // Decisions that point back at this feature count too, even when its spec never links them.
  const mine = p => slugs.some(s => p === `spec/features/${s}.md` || p.startsWith(`features/${s}/`) || p.startsWith(`research/${s}/`));
  const entries = decisionEntries(root);
  for (const e of entries) if ([...e.text.matchAll(/\]\(([^)\s#]+)/g)].some(m => mine(normalize(join('product', m[1]))))) decided.add(e.anchor);
  const filed = files.filter(f => isNote(f) && slugs.some(s => f.startsWith(`research/${s}/`)));
  return {
    specs, pages, cards: [...cards],
    decisions: entries.filter(e => decided.has(e.anchor)),
    words: [...words],
    cited: [...bySpec].map(([path, hashes]) => ({ path, hashes: [...hashes] })),
    pageOnly: [...byPage].filter(p => !bySpec.has(p)),
    uncited: filed.filter(f => !bySpec.has(f) && !byPage.has(f)),
    near: [...near].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([s]) => s), // the features its own spec links most
    gaps: slugs.flatMap(s => coverageGaps(root, s).map(g => ({ slug: s, ...g }))),
  };
}

// Notes that no spec file and no decision cites: research that has not reached what the code is built from.
export function unreached(root, files) {
  const cited = new Set();
  for (const f of files.filter(f => /^spec\/.+\.md$/.test(f) || f === 'product/decisions.md'))
    for (const l of outLinks(root, f)) cited.add(l.path);
  const notes = files.filter(isNote);
  return { notes: notes.length, unreached: notes.filter(n => !cited.has(n)) };
}
