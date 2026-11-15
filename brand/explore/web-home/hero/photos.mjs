#!/usr/bin/env node
// Writes photos.js, the list of photos the hero's wall draws from: every tile in ../photos/wall/tiles with its kind,
// from credits.json. Until those are fetched it falls back to ../photos/items.
//   node brand/explore/web-home/hero/photos.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname, wall = join(here, '../photos/wall'), credits = join(wall, 'credits.json');
let list = [];
if (existsSync(credits)) {
  const c = JSON.parse(readFileSync(credits, 'utf8'));
  list = Object.entries(c).filter(([n]) => existsSync(join(wall, 'tiles', `${n}.webp`))).map(([n, v]) => ({ src: `../photos/wall/tiles/${n}.webp`, kind: v.kind, alt: v.query[0].toUpperCase() + v.query.slice(1) }));
}
if (list.length < 24) list = readdirSync(join(here, '../photos/items')).filter(f => f.endsWith('.webp')).map(f => ({ src: `../photos/items/${f}`, kind: 'clothes', alt: f.replace(/\.webp$/, '').replace(/-/g, ' ') }));
writeFileSync(join(here, 'photos.js'), `// Written by photos.mjs: ${list.length} photos for the wall.\nwindow.WALL = ${JSON.stringify(list)};\n`);
console.log(`${list.length} photos, ${new Set(list.map(p => p.kind)).size} kinds`);
