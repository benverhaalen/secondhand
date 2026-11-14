// Decisions trace to a person's words, and those words are never edited.
import { read, err } from './util.mjs';

export function provenance(root, { wordsBase }) {
  const out = [];
  const words = read(root, 'product/words.md');
  if (words != null && wordsBase != null) { // append only: every line that was there is still there
    const now = new Map();
    for (const l of words.split('\n')) now.set(l, (now.get(l) ?? 0) + 1);
    for (const l of wordsBase.split('\n')) {
      if (!l.trim()) continue;
      if (!now.get(l)) out.push(err('product/words.md', `a published line changed or was removed: "${l.slice(0, 80)}". Add a note below the quote instead.`));
      else now.set(l, now.get(l) - 1);
    }
  }
  const decisions = read(root, 'product/decisions.md');
  for (const e of (decisions ?? '').split(/\n(?=## )/).slice(1))
    if (!/Agreed by:/.test(e)) out.push(err('product/decisions.md', `"${e.split('\n')[0]}" has no "Agreed by:" line`));
  const vision = read(root, 'product/vision.md') ?? '';
  const decided = vision.split(/\n(?=## )/).find(s => s.startsWith('## Decided')) ?? '';
  for (const l of decided.split('\n').filter(l => /^\s*- /.test(l)))
    if (!/\]\((?:\.\/)?(?:words|decisions)\.md/.test(l)) out.push(err('product/vision.md', `Decided line without a link to words.md or decisions.md: "${l.trim().slice(0, 80)}"`));
  return out;
}
