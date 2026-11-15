#!/usr/bin/env node
// The UI rule set, from .agents/ui-rules.json.
//   node scripts/ui-rules.mjs judge                      the fail list to hand a fresh judge, and nothing else
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
  let row = list.find(r => r.kind === 'lesson' && same(r.finding, finding));
  if (!row) { const n = Math.max(0, ...list.map(r => Number(/^X(\d+)$/.exec(r.id)?.[1] ?? 0))) + 1; list.push(row = { id: `X${n}`, kind: 'lesson', finding: finding.trim(), seen: [] }); }
  if (!row.seen.includes(where)) row.seen.push(where);
  return row;
}
const write = list => `[\n${list.map(r => `  ${JSON.stringify(r).replace(/^\{/, '{ ').replace(/\}$/, ' }').replace(/","/g, '", "').replace(/":/g, '": ')}`).join(',\n')}\n]\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..'), [cmd, finding, where] = process.argv.slice(2);
  const list = load(root);
  if (!Array.isArray(list)) { process.stderr.write(`${RULES} is missing or not a JSON list\n`); process.exit(1); }
  if (cmd === 'judge') process.stdout.write(`${judgeBrief(list)}\n`);
  else if (cmd === 'tally') process.stdout.write(`${tally(root)}\n`);
  else if (cmd === 'seen' && finding && where) {
    const row = seen(list, finding, where);
    writeFileSync(join(root, RULES), write(list));
    process.stdout.write(row.seen.length >= 2
      ? `${row.id} has now come up ${row.seen.length} times. Make it a check in .agents/checks/picks.mjs with a failing test, or a judge row with a "fail" line, and change its kind.\n`
      : `${row.id} noted. If a script could find it, write the check now instead of waiting for a second time.\n`);
  } else { process.stderr.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 6).join('\n') + '\n'); process.exit(1); }
}
