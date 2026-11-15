#!/usr/bin/env node
// The edge states the UI system knows (.agents/ui-states.json), and the one command that teaches it a new one.
//   node scripts/ui-states.mjs                                              what it knows
//   node scripts/ui-states.mjs content <fill> "<value>" "<where it came up>"  extreme content for a slot: title, name, amount, count, text or photo
//   node scripts/ui-states.mjs state <kind> <name> "<where it came up>"       a state a screen, a job or a control can be in
// Content is put into every slot marked data-fill by node scripts/brand-check.mjs from then on. A state is known from then on;
// move it to "required" in the file when every screen, job or control should draw it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = '.agents/ui-states.json';
const slug = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 32) || 'case';

// Adds a piece of content, or one more sighting of content already there. Returns the row.
export function addContent(s, fill, value, where) {
  const same = s.content.find(c => c.fill === fill && c.value === value);
  if (same) { if (!same.seen.includes(where)) same.seen.push(where); return same; }
  let id = fill === 'photo' ? 'no-photo' : slug(value); while (s.content.some(c => c.id === id)) id += '-2';
  const row = { id, fill, value: fill === 'photo' ? null : value, seen: [where] }; s.content.push(row); return row;
}
// Adds a state to the known list of its kind. Returns false when the kind does not exist.
export function addState(s, kind, name, where) {
  const list = s.states[kind]; if (!list) return false;
  if (![...list.required, ...list.known].includes(name)) list.known.push(name);
  (s.seen ??= {})[`${kind} ${name}`] = [...new Set([...(s.seen[`${kind} ${name}`] ?? []), where])];
  return true;
}
export const write = s => `${JSON.stringify(s, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..'), file = join(root, FILE), s = JSON.parse(readFileSync(file, 'utf8')), [cmd, a, b, ...rest] = process.argv.slice(2);
  const usage = () => { process.stderr.write(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).join('\n') + '\n'); process.exit(2); };
  if (!cmd) {
    for (const c of s.content) console.log(`${c.fill.padEnd(7)} ${c.id.padEnd(16)} ${c.value ?? '(the photo is missing)'}`);
    for (const [k, v] of Object.entries(s.states)) console.log(`${k.padEnd(7)} draws: ${v.required.join(', ')}${v.known.length ? `. Also known: ${v.known.join(', ')}` : ''}`);
  } else if (cmd === 'content' && a && rest.length && (a === 'photo' || b)) {
    const row = addContent(s, a, b, rest.join(' ')); writeFileSync(file, write(s));
    console.log(`${row.seen.length > 1 ? `seen again (${row.seen.length} times)` : 'added'}: ${row.id}. Every slot marked data-fill="${a}" is checked with it from now on.`);
  } else if (cmd === 'state' && a && b && rest.length) {
    if (!addState(s, a, b, rest.join(' '))) { process.stderr.write(`no kind "${a}": it is one of ${Object.keys(s.states).join(', ')}\n`); process.exit(1); }
    writeFileSync(file, write(s)); console.log(`${a} state "${b}" is known. Move it to "required" in ${FILE} when every ${a} should draw it.`);
  } else usage();
}
