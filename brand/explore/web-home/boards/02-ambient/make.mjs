#!/usr/bin/env node
// Writes the three variants of board 2 (a.html, b.html, c.html) from one template, so they differ only in what moves.
//   node brand/explore/web-home/boards/02-ambient/make.mjs
// Shared by all three: dark by default in the look of the dark Today (Ben, 05:49), the line alone (his pick on board 1), the two hands
// beside the wordmark (L52; Phosphor's open hand as a stand-in until R35 is drawn), and "second hand" set in Clofie.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname, root = join(here, '../../../../..');
const hand = readFileSync(join(here, '../../photos/hand.svg'), 'utf8')
  .replace('<svg ', '<svg class="hand" aria-hidden="true" width="24" height="24" ');
const items = ['hoodie', 'jacket', 'tee', 'jeans', 'pants', 'fleece', 'dunks', 'tee-close'];
const alt = { hoodie: 'A red Chico hoodie', jacket: 'A brown Carhartt jacket', tee: 'A yellow Marquette tee', jeans: 'Folded Levi’s 501 jeans', pants: 'Black Carhartt pants', fleece: 'A cream Patagonia fleece', dunks: 'Grey Nike Dunks', 'tee-close': 'The Marquette tee’s print, close' };
const tile = n => `<img src="../../photos/items/${n}.webp" alt="${alt[n]}" width="208" height="208" loading="eager" decoding="async">`;
// The garment outlines traced from Ben's own items (research/studio/ben/templates), every third point.
const outline = n => {
  const d = readFileSync(join(root, `research/studio/ben/templates/${n}.svg`), 'utf8').match(/ d="([^"]+)"/)[1];
  const pts = [...d.matchAll(/(\d+) (\d+)/g)].filter((_, i) => i % 3 === 0).map(m => `${m[1]} ${m[2]}`);
  return `M ${pts.join(' L ')} Z`;
};

const variants = {
  a: {
    note: 'A. The rail: real listing photos drift sideways through the field, like a rack you walk past.',
    css: `
  .stage { display: grid; align-content: center; gap: var(--s-4); }
  .row { display: flex; gap: var(--s-4); width: max-content; animation: rail 100s linear infinite; }
  .row:nth-child(2) { animation-direction: reverse; animation-duration: 120s; }
  .row img { width: 128px; height: 128px; border-radius: 20px; object-fit: cover; }
  @keyframes rail { to { transform: translateX(-50%); } }
  @media (max-width: 760px) { .row img { width: 96px; height: 96px; } .stage { gap: var(--s-2); } .row { gap: var(--s-2); } }`,
    ambient: () => {
      const row = list => `<div class="row">${[...list, ...list].map(tile).join('')}</div>`;
      return `<div class="stage ambient field-card" data-field aria-hidden="true">${row(items) + row([...items.slice(4), ...items.slice(0, 4)])}</div>`;
    },
  },
  b: {
    note: 'B. One at a time: the field holds one item, and every 3 seconds the next one slides in, like a rack moving along.',
    css: `
  .stage { display: grid; place-items: center; }
  .stage img { grid-area: 1 / 1; width: 208px; height: 208px; border-radius: 20px; object-fit: cover; transform: translateX(160%); animation: rack 24s var(--ease-out) infinite; }
  ${items.map((_, i) => `.stage img:nth-child(${i + 1}) { animation-delay: ${i * 3 - 24}s; }`).join(' ')}
  @keyframes rack { 0% { transform: translateX(160%); } 1.6%, 12.5% { transform: translateX(0); } 14.1%, 100% { transform: translateX(-160%); } }
  @media (max-width: 760px) { .stage img { width: 168px; height: 168px; } }`,
    ambient: () => `<div class="stage ambient field-card" data-field aria-hidden="true">${items.map(tile).join('')}</div>`,
  },
  c: {
    note: 'C. The stitches: the outlines of a tee, a hoodie and a pair of pants, traced from real items, drift behind the line as dashed seams. No field.',
    css: `
  .hero { grid-template-rows: 1fr; }
  .ambient { position: absolute; inset: 0; z-index: -1; overflow: hidden; }
  .ambient svg { position: absolute; width: 34vmax; height: auto; fill: none; stroke: rgb(255 255 255 / .16); stroke-width: 6; stroke-dasharray: 14 10;
    animation: float 48s ease-in-out infinite alternate; }
  .ambient svg path { animation: sew 6s linear infinite; }
  .ambient .s1 { left: -6vmax; top: 6%; } .ambient .s2 { right: -8vmax; top: 18%; animation-duration: 56s; animation-delay: -20s; }
  .ambient .s3 { left: 30%; bottom: -22vmax; animation-duration: 64s; animation-delay: -36s; }
  @keyframes float { from { transform: translate(0, 0) rotate(-4deg); } to { transform: translate(3vmax, -2vmax) rotate(4deg); } }
  @keyframes sew { to { stroke-dashoffset: -48; } }
  @media (max-width: 760px) { .ambient svg { width: 64vmax; } }`,
    ambient: () => `<div class="ambient" aria-hidden="true">${['shirt', 'sweatshirt', 'pants'].map((n, i) => `<svg class="s${i + 1}" viewBox="0 0 1200 1600"><path d="${outline(n)}"/></svg>`).join('')}</div>`,
  },
};

for (const [id, v] of Object.entries(variants)) {
  writeFileSync(join(here, `${id}.html`), `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>secondhand</title>
<link rel="stylesheet" href="../../../../tokens.css">
<link rel="stylesheet" href="../../site.css">
<!-- Written by make.mjs. ${v.note} -->
<style>
  .lockup { display: inline-flex; align-items: center; text-decoration: none; }
  .lockup .hand { margin-inline: 12px; }
  .lockup .hand:first-child { margin-left: 0; } .lockup .hand:last-child { margin-right: 0; transform: scaleX(-1); }
  .hl { font-family: var(--font-display); font-weight: var(--w-display); white-space: nowrap; letter-spacing: -0.01em; }
  header { color: var(--ink); }
  .hero { position: relative; isolation: isolate; min-height: 100svh; display: grid; grid-template-rows: 1fr auto; gap: var(--s-8); padding: 72px var(--mx) var(--mx); background: var(--page); }
  .copy { align-self: center; }
  .hero .lead { color: var(--ink-2); margin-top: var(--s-6); }
  .hero .act { margin-top: var(--s-7); display: flex; gap: var(--s-6); justify-content: center; align-items: center; flex-wrap: wrap; }
  /* the field, as the dark Today holds it: one card, corners 36, deep colors, drifting */
  .field-card { height: clamp(208px, 30svh, 288px); border-radius: 36px; overflow: hidden; background: var(--field); background-size: 160% 160%; animation: drift var(--drift) ease-in-out infinite alternate; }
  .field-card img { background: var(--surface); }
  @media (max-width: 760px) { .field-card { height: 248px; } .hero { gap: var(--s-7); } .copy { padding-top: var(--s-7); } }
  @media (prefers-reduced-motion: reduce) { .ambient, .ambient * { animation: none !important; } .stage img:not(:first-child) { visibility: hidden; } .stage img:first-child { transform: none; } }
${v.css}
</style>
</head>
<body>
<main>
  <section class="hero">
    <header>
      <div class="wrap">
        <a class="lockup" href="#" aria-label="secondhand">${hand}<span class="wordmark">secondhand</span>${hand}</a>
        <nav aria-label="Pages"><a href="#">How it works</a><a href="#">Sites and fees</a><a href="#">The data</a><a href="#">FAQ</a></nav>
        <a class="signin" href="#">Sign in</a>
      </div>
    </header>
    <div class="copy center">
      <h1 class="hero-t">Your <span class="hl">second hand</span>, for everything secondhand.</h1>
      <p class="lead">Take one photo. It's priced, posted on five sites and sold for you.</p>
      <div class="act"><a class="pill" href="#">Try it</a><div class="logos" aria-label="Posts to">
        <img src="../../../../../assets/platforms/square/ebay.png" alt="eBay">
        <img src="../../../../../assets/platforms/square/depop.png" alt="Depop">
        <img src="../../../../../assets/platforms/square/poshmark.png" alt="Poshmark">
        <img src="../../../../../assets/platforms/square/mercari.png" alt="Mercari">
        <img src="../../../../../assets/platforms/square/facebook.png" alt="Facebook Marketplace">
      </div></div>
    </div>
    ${v.ambient()}
  </section>
</main>
</body>
</html>
`);
  console.log(`${id}.html`);
}
