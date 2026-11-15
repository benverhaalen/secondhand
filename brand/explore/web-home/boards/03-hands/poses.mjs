#!/usr/bin/env node
// Every hand position in packs A, C, E and F, large, with the pair beside the wordmark in one ink, two field colors, and a
// gradient each, plus the three hands up close at header size. Drawn in the brand faces when BRAND_FONTS is set (CI).
//   node brand/explore/web-home/boards/03-hands/poses.mjs
// Unpacks @phosphor-icons/core 2.1.1, @tabler/icons 3.24.0 and heroicons 2.2.0 from npm into a temp folder (all MIT), and
// writes out/hands-<h|a|c|e|f>-poses.jpg, h being Hugeicons (@hugeicons/core-free-icons 4.4.0, MIT) and out/hands-a-c-f.jpg. Ben, 07:28, 07:29, 07:32 and 07:33 (product/words.md).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brandFaces, playwright } from '../../../../../scripts/brand-check.mjs';

const here = import.meta.dirname, root = resolve(here, '../../../../..'), out = join(here, 'out');
const tokens = readFileSync(join(root, 'brand/tokens.css'), 'utf8'), faces = brandFaces(tokens);
if (!faces) console.warn('warn: the brand faces are not here, so the wordmark is drawn in a fallback face. Set BRAND_FONTS.');

const tmp = mkdtempSync(join(tmpdir(), 'hands-'));
for (const [pkg, dir] of [['@phosphor-icons/core@2.1.1', 'ph'], ['heroicons@2.2.0', 'hi'], ['@tabler/icons@3.24.0', 'tb'], ['@hugeicons/core-free-icons@4.4.0', 'hu']]) {
  const tgz = execFileSync('npm', ['pack', pkg, '--silent', '--pack-destination', tmp], { encoding: 'utf8' }).trim().split('\n').pop();
  const to = join(tmp, dir); execFileSync('mkdir', ['-p', to]); execFileSync('tar', ['-xzf', join(tmp, tgz), '-C', to]);
}
const ph = (w, n) => join(tmp, 'ph/package/assets', w, `${n}${w === 'regular' ? '' : '-' + w}.svg`);
const hi = (s, n) => join(tmp, 'hi/package/24', s, `${n}.svg`);
const tb = (s, n) => join(tmp, 'tb/package/icons', s, `${n}.svg`);
// Tabler's hands, minus the middle finger and the icons with no hand in them (swipe, pray); only the thumbs come filled.
const TABLER = ['hand-stop', 'hand-finger', 'hand-finger-down', 'hand-finger-left', 'hand-finger-right', 'hand-click', 'hand-move', 'hand-grab',
  'hand-two-fingers', 'hand-three-fingers', 'hand-love-you', 'hand-little-finger', 'hand-ring-finger',
  'thumb-up', 'thumb-down', 'heart-handshake', 'home-hand', 'wash-hand', 'hand-off'];
const POSES = ['hand', 'hand-palm', 'hand-waving', 'hand-pointing', 'hand-tap', 'hand-swipe-left', 'hand-swipe-right', 'hand-grabbing', 'hand-fist',
  'hand-peace', 'thumbs-up', 'thumbs-down', 'handshake', 'hands-clapping', 'hands-praying', 'hand-heart', 'hand-coins', 'hand-deposit', 'hand-withdraw',
  'hand-arrow-up', 'hand-arrow-down', 'hand-eye', 'hand-soap'];
// Hugeicons Stroke Rounded, the app's own set (Art. 10.1), whose waving hand round 11 showed beside the wordmark and Ben
// asked to be slimmer. The free package ships icons as data, so each is written out as an SVG file first.
const HUGE = ['WavingHand01', 'WavingHand02', 'WavingHand', 'Hand', 'HandGrab', 'HandFist', 'HandMetal', 'HandHelping', 'HandPlatter',
  'HandCoins', 'HandHeart', 'Handshake', 'HeartHandshake', 'HandPrayer', 'HandsClapping', 'Clapping', 'Clapping01', 'Clapping02', 'OkFinger',
  'VictoryFinger', 'VictoryFinger01', 'VictoryFinger02', 'VictoryFinger03', 'LoveKoreanFinger', 'ThumbsUp', 'ThumbsDown', 'ThumbsUpDown',
  'HandPointingLeft', 'HandPointingRight', 'HandPointingDown', 'HandPointingLeft01', 'HandPointingRight01', 'HandPointingDown01',
  'TwoFinger', 'TwoFinger01', 'TwoFinger02', 'ThreeFinger', 'ThreeFinger01', 'ThreeFinger02', 'FourFinger02', 'FourFinger03'];
const hu = (() => {
  const icons = createRequire(import.meta.url)(join(tmp, 'hu/package/dist/cjs/index.js')), dir = join(tmp, 'hu/outline'); mkdirSync(dir, { recursive: true });
  const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  return HUGE.filter(n => icons[`${n}FreeIcons`]).map(n => {
    const body = icons[`${n}FreeIcons`].map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([k]) => !['key', 'stroke', 'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'color'].includes(k)).map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')}/>`).join('');
    const file = join(dir, `${kebab(n).slice(1)}.svg`);
    writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);
    return [kebab(n).slice(1), file];
  });
})();
const PACKS = {
  h: { title: 'Hugeicons, the app\'s set (round 11\'s waving hand)', main: hu[0][1], poses: hu },
  a: { title: 'A  Phosphor, regular', main: ph('regular', 'hand'), poses: POSES.map(n => [n, ph('regular', n)]) },
  c: { title: 'C  Phosphor, filled', main: ph('fill', 'hand'), poses: POSES.map(n => [n, ph('fill', n)]) },
  e: { title: 'E  Tabler', main: tb('outline', 'hand-stop'),
       poses: [...TABLER.map(n => [n, tb('outline', n)]), ...['thumb-up', 'thumb-down'].map(n => [`${n} (filled)`, tb('filled', n)])] },
  f: { title: 'F  Heroicons', main: hi('outline', 'hand-raised'),
       poses: ['hand-raised', 'hand-thumb-up', 'hand-thumb-down'].flatMap(n => [[`${n} (outline)`, hi('outline', n)], [`${n} (solid)`, hi('solid', n)]]) },
};
// Stroke icons at 1.5, as on the board, so they read slimmer than the wordmark's stems.
const svg = f => readFileSync(f, 'utf8').replace(/<!--.*?-->\s*/gs, '').replace(/\s(class|width|height|aria-hidden|data-slot)="[^"]*"/g, '')
  .replace(/stroke-width="[\d.]+"/, f.includes('/outline/') ? 'stroke-width="1.5"' : '$&');
const kind = f => f.includes('/outline/') ? 's' : 'f';

const css = `${faces ?? ''} ${tokens}
body{margin:0;background:#101315;color:#ECEFF1;font:400 22px/1.25 var(--font-text);padding:56px 64px;width:1672px}
.wm{font-family:var(--font-display);font-weight:var(--w-display);letter-spacing:-.01em}
h1{font:500 40px/1.2 var(--font-text);margin:0 0 6px} .sub{color:#CDD2D4;margin:0 0 40px;max-width:1400px}
.locks{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:56px}
.lock{background:#171B1E;border-radius:28px;padding:40px 24px 28px;display:flex;flex-direction:column;align-items:center;gap:24px}
.lu{display:flex;align-items:baseline;gap:.2em;font-size:56px;line-height:1} .lu svg{width:1em;height:1em;display:block} .r svg{transform:scaleX(-1)}
.lock p,.pose p{margin:0;color:#CDD2D4;font-size:19px;text-align:center}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}
.pose{background:#171B1E;border-radius:24px;padding:28px 12px 18px;display:flex;flex-direction:column;align-items:center;gap:14px}
.pose svg{width:150px;height:150px;display:block}
.f svg{fill:currentColor} .f svg[fill="none"]{fill:none} .s svg{stroke:currentColor}
.solid .l{color:var(--sky)} .solid .r{color:var(--mint)}
.f.grad .l svg{fill:url(#live)} .f.grad .r svg{fill:url(#sold)} .s.grad .l svg{stroke:url(#live)} .s.grad .r svg{stroke:url(#sold)}
.close{display:flex;gap:40px} .card{background:#101315;border-radius:28px;padding:32px 40px 40px;width:520px}
.big svg{width:420px;height:420px;display:block;margin:0 auto} .card .lu{font-size:30px;margin-top:28px;justify-content:center}
.card .lt{background:#fff;color:#0A0A0A;border-radius:999px;padding:14px;margin-top:20px}`;
// The ring's own colors (brand/tokens.css): sky to lilac is the "live" gradient's pair, mint to lime the "sold" one's.
const defs = `<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="live" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A5E1FE"/><stop offset="1" stop-color="#DDCEFE"/></linearGradient>
<linearGradient id="sold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A1EACB"/><stop offset="1" stop-color="#EBF08F"/></linearGradient></defs></svg>`;
const pair = (m, k, cls = '') => `<div class="lu ${k} ${cls}"><span class="l">${m}</span><span class="wm">secondhand</span><span class="r">${m}</span></div>`;

const fit = readFileSync(join(here, '../../hands-fit.js'), 'utf8');
const browser = await playwright().chromium.launch();
const shoot = async (html, file, width = 1800) => {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1.5 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${defs}${html}`);
  await page.evaluate(() => document.fonts.ready); await page.addScriptTag({ content: fit });
  await page.evaluate(() => document.querySelectorAll('.lu').forEach(l => fitHands(l, l.querySelector('.wm'), l.querySelectorAll('.l svg, .r svg'))));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, file), fullPage: true, type: 'jpeg', quality: 86 }); await page.close();
  console.log(file);
};
for (const [id, p] of Object.entries(PACKS)) {
  const m = svg(p.main), k = kind(p.main);
  const lock = (cls, note) => `<div class="lock">${pair(m, k, cls)}<p>${note}</p></div>`;
  await shoot(`<h1>${p.title}</h1><p class="sub">The pair beside the wordmark three ways, each hand as tall as the wordmark and on its baseline, then every hand position in the pack (${p.poses.length}).</p>
  <div class="locks">${lock('', 'One ink, as now')}${lock('solid', 'Two colors from the Home field, no gradient: sky and mint')}${lock('grad', 'A gradient each: sky to lilac, mint to lime')}</div>
  <div class="grid">${p.poses.map(([n, f]) => `<div class="pose ${kind(f)}">${svg(f)}<p>${n}</p></div>`).join('')}</div>`, `hands-${id}-poses.jpg`);
}
await shoot(`<div class="close">${['a', 'c', 'f'].map(i => PACKS[i]).map(p => { const m = svg(p.main), k = kind(p.main);
  return `<div class="card"><p class="sub" style="margin:0 0 16px">${p.title}</p><div class="big ${k}">${m}</div>${pair(m, k)}${pair(m, k, 'lt')}</div>`; }).join('')}</div>`,
  'hands-a-c-f.jpg', 1800);
await browser.close();
rmSync(tmp, { recursive: true, force: true });
