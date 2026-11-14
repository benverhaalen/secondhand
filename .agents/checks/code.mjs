// The code rules a script can check. The ones that need judgment are in .agents/skills/build/SKILL.md.
// Errors: a file named for nothing, a type check switched off, a swallowed error, conversation history in a comment, a test switched off.
// Warnings are guesses from the text, there to make you look: a long file, and product code that changed with no test.
import { read, err, warn, lineOf, isProductCode, isTest, withoutComments, commentsOnly } from './util.mjs';

const JS = /\.(tsx?|jsx?|mjs|cjs)$/, TS = /\.tsx?$/, PY = /\.py$/, SWIFT = /\.swift$/;
const GRAB_BAG = /(^|\/)(utils?|helpers?|misc|common)(\/|\.[a-z]+$)/;
const LONG = 400;
// A one-line string keeps its quotes and loses its words, so 'size: any' is not read as a type.
const withoutStrings = t => t.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, m => m[0] + ' '.repeat(m.length - 2) + m.at(-1));
const SWALLOWED = 'an error is swallowed: handle it, log it with log.error, or let it fail';
const OFF = 'a test is switched off: fix it, delete it and say why in the commit, or skip it on a condition that names the reason';

// [files, the part of the file to read, what to find, what to say]
const RULES = [
  [TS, 'code', /\bas\s+any\b/g, () => 'as any switches the type check off: name the real type, or check the value where it enters'],
  [TS, 'code', /:\s*any\b(?![\w$.(])/g, () => ': any switches the type check off: name the real type, or use unknown and narrow it'],
  [JS, 'comments', /@ts-(?:ignore|nocheck)\b/g, m => `${m} hides a type error: fix the type, or use @ts-expect-error with the reason`],
  [JS, 'comments', /eslint-disable(?:-next-line|-line)?(?=[ \t]*(?:\*\/|$))/gm, m => `${m} with no rule named turns every lint rule off: name the rule and the reason`],
  [PY, 'comments', /#\s*type:\s*ignore(?!\[)/g, () => 'type: ignore with no error code hides every type error on the line: name the code, as in type: ignore[attr-defined]'],
  [JS, 'code', /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g, () => SWALLOWED],
  [JS, 'code', /\.catch\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*(?:\{\s*\}|null|undefined|void 0)\s*\)/g, () => SWALLOWED],
  [PY, 'code', /\bexcept\b[^:\n]*:[ \t]*(?:\n[ \t]*)?(?:pass|\.\.\.)[ \t]*$/gm, () => SWALLOWED],
  [SWIFT, 'code', /\bcatch\s*\{\s*\}/g, () => SWALLOWED],
  [/./, 'comments', /\bas (?:we )?discussed\b|\bper (?:the|your) (?:review|request|feedback|comment)s?\b|\bas (?:you )?requested\b|\bthe user (?:asked|wanted|said|requested)\b|\bpreviously (?:this|it|we)\b|\bfixed (?:the|a) bug\b|\bchanged from\b/gi,
    m => `"${m}" is conversation or history: a comment says what the code does now and why; the rest belongs in the commit message`],
];
const TEST_RULES = [
  [JS, /(?<![\w.$])(?:it|test|describe)\.(?:skip|only)\s*\(|(?<![\w.$])(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(/g],
  [PY, /@(?:pytest\.mark\.skip|unittest\.skip)\b/g],
];

export function code(root, { files, changed = [] }) {
  const out = [], seen = new Set();
  const add = (where, msg) => { if (!seen.has(where + msg)) { seen.add(where + msg); out.push(err(where, msg)); } };
  for (const f of files) {
    if (isTest(f) && !/^\.agents\/checks\/|(^|\/)node_modules\//.test(f)) {
      const text = withoutComments(f, read(root, f) ?? '');
      for (const [ext, re] of TEST_RULES) if (ext.test(f)) for (const m of text.matchAll(re)) add(`${f}:${lineOf(text, m.index)}`, OFF);
    }
    if (!isProductCode(f)) continue;
    if (GRAB_BAG.test(f)) add(f, 'name the file for the one idea it owns (listing/price/floor.ts), so a search finds it; utils, helpers, misc and common say nothing');
    const raw = read(root, f) ?? '';
    const parts = { code: withoutStrings(withoutComments(f, raw)), comments: commentsOnly(f, raw) };
    for (const [ext, part, re, say] of RULES) if (ext.test(f)) for (const m of parts[part].matchAll(re)) add(`${f}:${lineOf(parts[part], m.index)}`, say(m[0].trim()));
    const lines = raw.split('\n').length;
    if (lines > LONG) out.push(warn(f, `${lines} lines: does this file own more than one idea? (${LONG} is a guess at where to look, not a limit)`));
  }
  const touched = changed.filter(f => files.includes(f) && isProductCode(f));
  if (touched.length && !changed.some(isTest))
    out.push(warn(`${touched[0]}${touched.length > 1 ? ` and ${touched.length - 1} more` : ''}`, 'product code changed and no test changed: write the failing test first, or say in the commit why a fast test would cost more than the change'));
  return out;
}
