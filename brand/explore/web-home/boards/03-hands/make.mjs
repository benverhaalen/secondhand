#!/usr/bin/env node
// Writes board 3: six open hands beside the wordmark, so Ben can pick (L52, R35; Ben, 07:09: "help me decide them").
//   node brand/explore/web-home/boards/03-hands/make.mjs
// Each hand is an open-licensed icon (photos/hands/README.md), stroke icons set at 1.5 so they read slimmer than the
// app's 2 (Ben, round 11: "a slimmer hand"). Each variant shows the pair at the header size on dark and on white, at the
// size of the open, and in the header of a phone.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname, hands = join(here, '../../photos/hands');
export const HANDS = {
  a: ['phosphor-hand-regular', 'A. Phosphor, regular'],
  b: ['phosphor-hand-light', 'B. Phosphor, light'],
  c: ['phosphor-hand-fill', 'C. Phosphor, filled'],
  d: ['lucide-hand', 'D. Lucide, at 1.5'],
  e: ['tabler-hand-stop', 'E. Tabler, at 1.5'],
  f: ['heroicons-hand-raised', 'F. Heroicons, at 1.5'],
};
export const svg = (name, size) => readFileSync(join(hands, `${name}.svg`), 'utf8')
  .replace(/<!--.*?-->\s*/gs, '').replace(/\s(class|width|height)="[^"]*"/g, '').replace(/stroke-width="[\d.]+"/, 'stroke-width="1.5"')
  .replace('<svg', `<svg class="hand" aria-hidden="true" width="${size}" height="${size}"`).replace(/\s+/g, ' ').trim();

const pair = (n, size, word) => `<span class="lockup" style="--h:${size}px">${svg(n, size)}<span class="wm" style="font-size:${word}px">secondhand</span>${svg(n, size)}</span>`;
for (const [id, [name, label]] of Object.entries(HANDS)) writeFileSync(join(here, `${id}.html`), `<!doctype html>
<html lang="en" data-theme="dark">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>secondhand</title>
<link rel="stylesheet" href="../../../../tokens.css"><link rel="stylesheet" href="../../site.css">
<!-- Written by make.mjs. ${label}. -->
<style>
  body { min-height: 100svh; display: grid; place-content: center; gap: var(--s-8); padding: var(--s-8) var(--s-6); text-align: center; }
  .lockup { display: inline-flex; align-items: center; color: var(--ink); }
  .lockup .hand { flex: none; } .lockup .hand:first-child { margin-right: calc(var(--h) / 2); } .lockup .hand:last-child { margin-left: calc(var(--h) / 2); transform: scaleX(-1); }
  .wm { font-family: var(--font-display); font-weight: var(--w-display); letter-spacing: var(--tr-21); line-height: 1; }
  .light { background: #FFFFFF; color: #0A0A0A; border-radius: 36px; padding: var(--s-7); }
  .light .lockup { color: #0A0A0A; }
</style></head>
<body>
  <div>${pair(name, 24, 21)}</div>
  <div>${pair(name, 48, 42)}</div>
  <div class="light">${pair(name, 24, 21)}</div>
</body></html>
`);
writeFileSync(join(here, 'board.json'), JSON.stringify({
  title: 'The hands beside the wordmark',
  question: 'Which open hand sits on either side of secondhand?',
  purpose: 'The pair is the charm at the top of every page and the two hands that meet when the site opens. Shown at the header size, at the size of the open, and on white.',
  variants: Object.entries(HANDS).map(([id, [, label]]) => ({ id, label })),
}, null, 2) + '\n');
console.log(Object.keys(HANDS).join(' '));
