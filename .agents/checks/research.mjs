// A research note says who made it, when, and how sure each claim is.
import { read, err } from './util.mjs';

export function research(root, { files }) {
  const out = [];
  for (const f of files.filter(f => /^research\/[^/]+\/[^/]+\/.+\.md$/.test(f) && !f.endsWith('README.md'))) {
    const text = read(root, f) ?? '';
    if (!/^Researched \d{4}-\d{2}-\d{2} by \S/m.test(text.split('\n').slice(0, 6).join('\n')))
      out.push(err(f, 'needs "Researched YYYY-MM-DD by <person> (<agent>)" in its first lines (research/README.md)'));
    if (!/\b(observed|asserted|inferred)\b|\[[OAI]\]/i.test(text))
      out.push(err(f, 'no claim is marked observed, asserted or inferred (research/README.md)'));
  }
  return out;
}
