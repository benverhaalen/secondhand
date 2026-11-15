#!/usr/bin/env node
// Writes brand/media.css from brand/media.json and brand/tokens.css: the sizes, margins and scaled gaps of a post, a story and a deck,
// as variables, so an output off the app never writes a raw number.
//   node scripts/media-css.mjs          writes the file
//   node scripts/media-css.mjs --check  exits 1 when the file is not what media.json makes
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

export function mediaCss(media, tokensCss) {
  const names = re => [...new Set([...tokensCss.matchAll(re)].map(m => m[1]))];
  const space = names(/--(s-\d+)\s*:/g), radius = names(/--(r-(?!pill)[\w-]+)\s*:/g);
  const out = ['/* Made from media.json by scripts/media-css.mjs. Do not edit it: change media.json and run the script.',
    '   Link tokens.css, then this file, and set data-medium on <html>. The app and the website use tokens.css alone. */'];
  for (const [name, s] of Object.entries(media)) {
    if (!s.roles) continue;
    const [w, h] = s.canvas[0], sizes = Object.values(s.sizes)[0], m = s.margin;
    out.push(`[data-medium="${name}"] {`,
      `  --u: ${s.unit};`,
      `  --canvas-w: ${w}px; --canvas-h: ${h}px;`,
      `  --margin-x: ${m.x}px; --margin-top: ${m.top}px; --margin-bottom: ${m.bottom}px;`,
      `  ${s.roles.map((r, i) => `--mt-${r}: ${sizes[i]}px;`).join(' ')}${s.peak ? ` --mt-peak: ${s.peak}px;` : ''} --mt-wordmark: ${s.wordmark.sizes[0]}px;`,
      '}');
  }
  out.push('/* The space and radius scales, times the medium\'s unit: --ms-3 on a deck is --s-3 times 2. */',
    '[data-medium] {',
    `  ${space.map(n => `--m${n}: calc(var(--${n}) * var(--u));`).join(' ')}`,
    `  ${radius.map(n => `--m${n}: calc(var(--${n}) * var(--u));`).join(' ')}`,
    '}');
  return out.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = join(root, 'brand/media.css'), want = mediaCss(JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8')), readFileSync(join(root, 'brand/tokens.css'), 'utf8'));
  if (!process.argv.includes('--check')) writeFileSync(file, want);
  else { let have = ''; try { have = readFileSync(file, 'utf8'); } catch { /* missing */ }
    if (have !== want) { console.error('brand/media.css is not what brand/media.json makes: run node scripts/media-css.mjs'); process.exit(1); } }
}
