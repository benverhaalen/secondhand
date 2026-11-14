#!/usr/bin/env node
// Replay a JSON-lines app log against the lifecycle spec: node spec/replay.mjs <log.jsonl> [site,site,...]
// Each `item.action` event must be a step the spec allows, done by an allowed actor, and keep every invariant.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initial, allActions as actions, invariants, NEVER_ALONE } from './lifecycle.mjs';

export function replay(text, sites) {
  const items = new Map(), problems = [];
  text.split('\n').forEach((line, n) => {
    if (!line.trim()) return;
    let e; try { e = JSON.parse(line); } catch { problems.push(`line ${n + 1}: not JSON`); return; }
    if (e.event !== 'item.action') return;
    const a = actions.find(x => x.name === e.action), i = sites.indexOf(e.site), label = `${e.action}(${e.site ?? ''})`;
    if (!a) { problems.push(`line ${n + 1}: ${e.action} is not in spec/lifecycle.mjs`); return; }
    if (!items.has(e.item)) items.set(e.item, initial(sites.length));
    const s = items.get(e.item);
    if (typeof e.floor === 'number') s.floor = e.floor; // the real numbers, not the model's
    const promoted = a.actor === 'user' && e.actor === 'auto' && s.auto.includes(a.kind);
    if (a.actor === 'user' && e.actor !== 'user' && !promoted) problems.push(`line ${n + 1}: ${label} needs the user but was done by ${e.actor}`);
    if (a.perSite && i < 0) { problems.push(`line ${n + 1}: unknown site ${e.site}`); return; }
    const arg = a.perKind ? e.kind : i;
    if (!a.when(s, arg)) { problems.push(`line ${n + 1}: ${label} is not allowed in this state`); return; }
    a.run(s, arg, e.actor);
    if (typeof e.price === 'number') { s.price = e.price; if (a.kind === 'priceBelowFloor' && e.actor === 'user') s.approvedPrice = e.price; }
    if (a.kind && e.actor === 'user' && !NEVER_ALONE.has(a.kind)) s.approvals[a.kind] = (s.approvals[a.kind] ?? 0) + 1;
    for (const [name, ok] of invariants) if (!ok(s)) problems.push(`line ${n + 1}: after ${label}, broke "${name}"`);
  });
  return { problems, items };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, siteList = 'ebay,facebook,depop,poshmark,mercari'] = process.argv.slice(2);
  const { problems } = replay(readFileSync(file, 'utf8'), siteList.split(','));
  console.log(problems.length ? problems.join('\n') : 'log follows the spec');
  process.exitCode = problems.length ? 1 : 0;
}
