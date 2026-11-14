#!/usr/bin/env node
// Copy lint for words inside the app (the "product" surface of Ben's writing skill,
// his anti-claudish check). Ported from ~/.local/share/harness/skills/writing/scripts/lint.py
// on Ben's Mac. Flags candidates, not verdicts: one hit is punctuation, a cluster is a tell.
// Rules and fixes: product/copy.md. Usage: node scripts/copy-lint.mjs <files...>  (or stdin)
import { readFileSync } from "node:fs";

const RULES = [
  ["O13", /[—–]/g, "em or en dash (\"never use any em dashes in the ui ever\")"],
  ["C1", /\b(?:Unlock|Elevate|Supercharge|Transform|Revolutionize|Empower|Unleash|Streamline|Reimagine|Harness)\b/g, "hero verb"],
  ["C1", /\bbuilt for (?:modern|the way)\b/gi, "line that fits any product"],
  ["C2", /\b(?:seamless(?:ly)?|effortless(?:ly)?|powerful|cutting-edge|next-gen(?:eration)?|world-class|best-in-class|blazing fast|robust|intuitive|game-?chang(?:er|ing)|ai-(?:powered|driven))\b/gi, "empty adjective"],
  ["C3", /\b(?:trusted by (?:thousands|millions)|loved by teams|join thousands)\b/gi, "vague audience claim"],
  ["C3", /\b\d[\d,.]*[kKmM]?\+? (?:teams|users|companies|customers)\b/gi, "audience number, needs a real source"],
  ["C4", /\b(?:oops!? something went wrong|uh[ -]?oh|whoops|an error occurred)\b/gi, "filler system message"],
  ["C5", /^[ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)[\u{1F300}-\u{1FAFF}☀-➿⭐]/gmu, "emoji opens a heading or item"],
  ["C6", /\b(?:get started today|learn more|start your journey)\b/gi, "generic call to action"],
  ["C6", /^[ \t]*(?:submit|click here)[ \t]*$/gim, "button that does not say what happens"],
  ["C7", /\b(?:welcome back|good (?:morning|afternoon|evening)|here['’]s what['’]s)\b/gi, "greeting or status chatter"],
  ["C8", /\b(?:more than just|not just|whether you['’]re|in today['’]s [\w-]+ (?:world|landscape))\b/gi, "reframe or audience sweep"],
  ["C9", /\b(?:trusted partner|tailored to (?:your|every)|unique needs|personali[sz]ed approach|measurable results)\b/gi, "abstraction with nothing to check"],
  ["C10", /\b(?:successfully|working our magic|hang tight)\b/gi, "success or loading filler"],
  ["C11", /(?:\bnothing (?:here )?yet\s*!|\byour journey\b)/gi, "empty state as a cheer"],
  ["C12", /(?:©|\(c\))\s*20\d\d|\blorem ipsum\b/gi, "hard-coded year or placeholder text"],
  // secondhand additions (agent proposal, from product/copy.md)
  ["S1", /!(?=\s|$|["'<])/g, "exclamation mark in UI copy"],
];

// Mask inline code and URLs so they are not flagged (same as the Python original).
const mask = (t) => t.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length)).replace(/https?:\/\/\S+/g, (m) => " ".repeat(m.length));

export function scan(text) {
  const masked = mask(text);
  const out = [];
  for (const [id, re, why] of RULES) {
    re.lastIndex = 0;
    for (const m of masked.matchAll(re)) {
      const line = masked.slice(0, m.index).split("\n").length;
      out.push({ id, line, match: m[0].trim(), why });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  const inputs = files.length ? files.map((f) => [f, readFileSync(f, "utf8")]) : [["stdin", readFileSync(0, "utf8")]];
  let n = 0;
  for (const [name, text] of inputs) for (const h of scan(text)) { n++; console.log(`${name}:${h.line} ${h.id} "${h.match}" ${h.why}`); }
  console.log(n ? `${n} candidate(s). Read product/copy.md and fix the sentence, not the word.` : "clean (a clean scan means little; still read every string)");
  process.exitCode = n ? 1 : 0;
}
