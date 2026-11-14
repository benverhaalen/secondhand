// Decisions trace to a person's words, and those words are never edited.
import { read, err } from './util.mjs';

// Who can agree to a decision. Agents never can. How many must agree is DECIDERS_NEEDED:
// product/vision.md says both; until Ben settles whether that holds while Nate is away, the check needs one.
export const DECIDERS = ['Ben', 'Nate'];
export const DECIDERS_NEEDED = 1;

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
  for (const e of (decisions ?? '').split(/\n(?=## )/).slice(1)) {
    const line = (e.match(/Agreed by:([^\n]*)/) ?? [])[1];
    if (line == null) { out.push(err('product/decisions.md', `"${e.split('\n')[0]}" has no "Agreed by:" line`)); continue; }
    const who = DECIDERS.filter(d => new RegExp(`\\b${d}\\b`).test(line));
    if (who.length < DECIDERS_NEEDED) out.push(err('product/decisions.md', `"${e.split('\n')[0]}" is agreed by ${who.join(' and ') || 'nobody who can decide'}; it needs ${DECIDERS_NEEDED === DECIDERS.length ? DECIDERS.join(' and ') : `one of ${DECIDERS.join(', ')}`}`));
  }
  const vision = read(root, 'product/vision.md') ?? '';
  const decided = vision.split(/\n(?=## )/).find(s => s.startsWith('## Decided')) ?? '';
  for (const l of decided.split('\n').filter(l => /^\s*- /.test(l)))
    if (!/\]\((?:\.\/)?(?:words|decisions)\.md#[^)\s]+\)/.test(l)) out.push(err('product/vision.md', `Decided line without a link to the exact entry in words.md or decisions.md (with #anchor): "${l.trim().slice(0, 80)}"`));
  return out;
}
