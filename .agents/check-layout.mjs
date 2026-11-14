#!/usr/bin/env node
// Keeps one slug per feature across features/, research/<person>/, product/features.md and packet topics.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PEOPLE = ['ben', 'nate'];
const dirs = p => existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];

export function problems(root) {
  const slugs = new Set(dirs(join(root, 'features')));
  const index = existsSync(join(root, 'product/features.md')) ? readFileSync(join(root, 'product/features.md'), 'utf8') : '';
  const out = [];
  for (const s of slugs) if (!index.includes(`../features/${s}/`)) out.push(`features/${s} is not listed in product/features.md`);
  for (const owner of dirs(join(root, 'research'))) {
    if (!PEOPLE.includes(owner)) { out.push(`research/${owner} is not a person folder (${PEOPLE.join(', ')})`); continue; }
    for (const s of dirs(join(root, 'research', owner)))
      if (!slugs.has(s) && s !== 'cross-cutting') out.push(`research/${owner}/${s} is not a feature slug or cross-cutting`);
  }
  for (const t of dirs(join(root, '.agents/team/packets')))
    if (!slugs.has(t) && t !== 'team') out.push(`.agents/team/packets/${t} is not a feature slug or team`);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const p = problems(root);
  if (p.length) { console.error(p.join('\n')); process.exit(1); }
  console.log('layout ok');
}
