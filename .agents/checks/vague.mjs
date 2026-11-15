// A brand rule has one reading. Ben, 2026-11-15: "it all gives little wiggle room for ambiguity".
// In the articles listed in SCOPE, a rule line that leans on a word of degree or frequency must carry what pins it down
// on the same line: a number, a token or value in backticks, or the id of a check or a code (B12, C4, L29).
// Words inside a quotation are someone's words, not a rule, and are not read. Add an article to SCOPE when its owner is ready.
import { read, err, lineOf } from './util.mjs';

const FILE = 'brand/constitution.md';
export const SCOPE = [4, 5, 6, 7, 8, 9, 10, 'III'];   // 'III' is Part III, the media
const WORDS = ['usually', 'generally', 'typically', 'often', 'sometimes', 'rarely', 'normally', 'where appropriate', 'as appropriate', 'as needed', 'when needed',
  'if possible', 'where possible', 'sparingly', 'subtle', 'subtly', 'slightly', 'a little', 'a bit', 'roughly', 'approximately', 'somewhat', 'fairly', 'quite',
  'mostly', 'nearly', 'almost', 'several', 'a few', 'various', 'and so on', 'etc', 'try to', 'ideally', 'preferably', 'should', 'reasonable', 'reasonably',
  'appropriate', 'enough', 'too much', 'too many', 'faint', 'faintly', 'slow', 'slowly', 'small', 'large', 'big', 'tight', 'loose', 'airy', 'generous', 'heavy'];
const HEDGE = new RegExp(`\\b(?:${WORDS.join('|').replace(/ /g, '\\s+')})\\b`, 'gi');
// What pins a word down: a digit, a backticked value, or an id such as B12, C4, L29, R17, E1.
const PINNED = /\d|`[^`]+`/;
// Not rule text: a quotation, a link (its words name a source, such as "round 7"), a time of day and an html comment.
const strip = line => line.replace(/"[^"]*"|“[^”]*”|\[[^\]]*\]\([^)]*\)|\b\d\d:\d\d\b|<!--.*?-->/g, m => ' '.repeat(m.length));

export function vague(root, { scope = SCOPE } = {}) {
  const text = read(root, FILE); if (text == null) return [];
  const out = []; let article = null, at = 0;
  for (const line of text.split('\n')) {
    const head = line.match(/^#{2,3}\s+(?:Article\s+(\d+)|Part\s+(III)\b|Part\b)/);
    if (head) article = head[1] ? Number(head[1]) : head[2] ?? null;
    if (article != null && scope.includes(article) && !/^#/.test(line)) {
      const body = strip(line);
      if (!PINNED.test(body)) for (const m of body.matchAll(HEDGE))
        out.push(err(`${FILE}:${lineOf(text, at)}`, `"${m[0]}" with nothing on the line to pin it down: give the number, the token in backticks or the id of the check that decides it, or cut the word (${article === 'III' ? 'Part III' : `Article ${article}`})`));
    }
    at += line.length + 1;
  }
  return out;
}
