#!/usr/bin/env node
// The UI rule set, from .agents/ui-rules.json.
//   node scripts/ui-rules.mjs judge [medium]             the fail list to hand a fresh judge, and nothing else (app, web, post, story or deck)
//   node scripts/ui-rules.mjs seen "<finding>" <where>   note a finding from a critique, an audit or a correction
//   node scripts/ui-rules.mjs tally                      how much of the rule set a script holds
// A finding noted twice fails node .agents/check.mjs until it becomes a check or a judge line.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, load, tally, judgeBrief } from '../.agents/checks/rules.mjs';

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
// Adds a sighting to the lesson with this finding, or starts one. Returns the row.
export function seen(list, finding, where) {
  let row = list.find(r => r?.kind === 'lesson' && typeof r.finding === 'string' && same(r.finding, finding));
  if (!row) { const n = Math.max(0, ...list.map(r => Number(/^X(\d+)$/.exec(r?.id ?? '')?.[1] ?? 0))) + 1; list.push(row = { id: `X${n}`, kind: 'lesson', finding: finding.trim(), seen: [] }); }
  if (!Array.isArray(row.seen)) row.seen = [];
  if (!row.seen.includes(where)) row.seen.push(where);
  return row;
}
// One row per line, built field by field so no string value is touched.
export const write = list => `[\n${list.map(r => `  { ${Object.entries(r).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`).join(',\n')}\n]\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..'), [cmd, finding, ...rest] = process.argv.slice(2), where = rest.join(' ');
  const list = load(root);
  if (!Array.isArray(list)) { process.stderr.write(`${RULES} is missing or not a JSON list\n`); process.exit(1); }
  if (cmd === 'judge') {
    const media = Object.keys(JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8')));
    if (finding && !media.includes(finding)) { process.stderr.write(`no medium "${finding}": it is one of ${media.join(', ')}\n`); process.exit(1); }
    process.stdout.write(`${judgeBrief(list, finding)}\n`);
  }
  else if (cmd === 'tally') process.stdout.write(`${tally(root)}\n`);
  else if (cmd === 'seen' && finding && where) {
    const row = seen(list, finding, where);
    writeFileSync(join(root, RULES), write(list));
    process.stdout.write(row.seen.length >= 2
      ? `${row.id} has now come up ${row.seen.length} times. Make it a check in .agents/checks/picks.mjs with a failing test, or a judge row with a "fail" line, and change its kind.\n`
      : `${row.id} noted. If a script could find it, write the check now instead of waiting for a second time.\n`);
  } else { process.stderr.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n') + '\n'); process.exit(1); }
}
