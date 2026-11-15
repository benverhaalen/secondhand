import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { site, locked } from './site.mjs';

// A site with a ledger in which Ben locked L56 and an agent decided A1.
const LEDGER = '# Brand ledger\n\n## Locked (Ben said it)\n\n| # | Decision | Ben\'s words |\n|---|---|---|\n| L56 | A shadow under the hero text | words |\n\n## Decided by agents (means; Ben can veto)\n\n| # | Decision | Where |\n|---|---|---|\n| A1 | Colors | here |\n';
function findings(files) {
  const all = { 'brand/ledger.md': LEDGER, ...files }, root = mkdtempSync(join(tmpdir(), 'site-'));
  for (const [p, s] of Object.entries(all)) { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), s); }
  try { return site(root, { files: Object.keys(all) }); } finally { rmSync(root, { recursive: true }); }
}
const errs = files => findings(files).filter(o => o.level === 'error').map(o => `${o.where} ${o.msg}`).join('\n');
const HERO = 'brand/explore/web-home/hero/hero.css';

test('site: only rows under Locked count as Ben\'s yes', () => {
  assert.deepEqual([...locked(LEDGER)], ['L56']);
});

test('site S1: a color written in place fails; a token, a mask\'s alpha and a token mixed with transparent pass', () => {
  assert.match(errs({ [HERO]: '.a { color: #0A0A0A; }' }), /hero\.css:1 color: #0A0A0A writes a color in place/);
  assert.match(errs({ [HERO]: '.a {\n  background: rgb(255 255 255 / .72);\n}' }), /hero\.css:2 background/);
  assert.equal(errs({ [HERO]: '.a { color: var(--ink); background: color-mix(in srgb, var(--page) 60%, transparent); mask-image: linear-gradient(#000 72px, rgb(0 0 0 / .6) 168px); /* L56 */ }' }), '');
});

test('site S2: a device the app does not use needs a Locked row cited in its rule', () => {
  assert.match(errs({ [HERO]: '.copy h1 { text-shadow: 0 2px 24px var(--page); }' }), /text-shadow: .* is a shadow on text, which the app does not use/);
  assert.match(errs({ [HERO]: '/* A1 */ .copy h1 { text-shadow: 0 2px 24px var(--page); }' }), /\(A1 is not Locked\)/);
  assert.equal(errs({ [HERO]: '/* the shadow under the line (L56) */\n.copy h1 { text-shadow: 0 2px 24px var(--page); }' }), '');
  assert.match(errs({ [HERO]: '@keyframes wave { to { rotate: 12deg; } }' }), /@keyframes wave is a keyframe animation/);
  assert.match(errs({ [HERO]: '.p { background: linear-gradient(var(--sky), var(--mint)); }' }), /a gradient written in place/);
  assert.match(errs({ [HERO]: '.p { backdrop-filter: blur(12px); }' }), /is glass/);
});

test('site S2: the app\'s own depth and the field token pass without a citation', () => {
  assert.equal(errs({ [HERO]: '.pill { box-shadow: var(--pill-glow); } .f { background: var(--field); } .n { filter: none; }' }), '');
});

test('site: a page inside an <style> block and a style attribute is read, with its line', () => {
  assert.match(errs({ 'brand/explore/web-home/boards/04-hover/a.html': '<!doctype html>\n<style>\n.a { color: #fff; }\n</style>\n<p style="color: rgb(1 2 3)">x</p>' }), /a\.html:3 color: #fff[\s\S]*a\.html:5 color: rgb/);
});

test('site: an older page is told, not blocked, and renders and photos are not read', () => {
  const f = findings({ 'brand/explore/web-home/faq.html': '<style>.a { color: #fff; }</style>', 'brand/explore/web-home/hero/out/x.html': '<style>.a { color: #fff; }</style>' });
  assert.deepEqual(f.map(o => [o.level, o.where]), [['warn', 'brand/explore/web-home/faq.html:1']]);
});

test('site: a board from a round already picked is told; a new board is held', () => {
  const css = '<style>.a { color: #fff; }</style>';
  assert.deepEqual(findings({ 'brand/explore/web-home/boards/02-ambient/a.html': css, 'brand/explore/web-home/boards/04-hover/a.html': css }).map(o => o.level), ['warn', 'error']);
});

test('site S2: motion the website row names may cite Art. 11, and a soft shadow or animation: none needs nothing', () => {
  assert.equal(errs({ [HERO]: '/* sections reveal once (Art. 11) */\n.reveal { animation: arrive linear both; }\n.c { box-shadow: var(--shadow-soft); animation: none !important; }' }), '');
  assert.match(errs({ [HERO]: '/* Art. 11 */ .t { text-shadow: 0 1px 2px var(--page); }' }), /a shadow on text/);
});
