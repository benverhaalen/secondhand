import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { words, allCaps, titleCase, sheetAgrees, seenAs } from './render.mjs';
import { scan } from '../../scripts/copy-lint.mjs';
import { check, playwright } from '../../scripts/brand-check.mjs';
import { mediaCss } from '../../scripts/media-css.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
const constitution = readFileSync(join(root, 'brand/constitution.md'), 'utf8'), media = JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8'));

test('render: words count two CJK characters as one, and case is read from the letters', () => {
  assert.equal(words('You keep $46.95'), 3);
  assert.equal(words('古着を売る'), 3);
  assert.ok(allCaps('SOLD TODAY') && !allCaps('Sold today') && !allCaps('$38') && !allCaps('M'));
  assert.ok(titleCase('What You Keep Today') && !titleCase('What you keep today') && !titleCase('Carhartt Detroit'));
  const emoji = s => scan(s).some(h => h.id === 'S2');
  assert.ok(emoji('Sold 🎉') && emoji('ok ✨') && emoji('🇺🇸') && emoji('1️⃣') && emoji('❤️') && !emoji('You keep $46.95 © ™ → 3×') && !emoji('#1 ↗'));
  assert.deepEqual(scan('♥ ↗').map(h => h.id), ['S3', 'S3']);
});

test('render: brand/media.json holds the same numbers as Part III of the constitution, and a drift fails', () => {
  assert.deepEqual(sheetAgrees(constitution, media), []);
  const drift = structuredClone(media); drift.post.margin.x = 80; drift.deck.words = 25;
  const bad = sheetAgrees(constitution, drift).map(o => `${o.where} ${o.msg}`).join('\n');
  assert.match(bad, /post margins disagrees/); assert.match(bad, /deck longest text disagrees/);
  drift.deck.unit = 3; drift.post.act = true; drift.story.layouts = ['item', 'collage']; drift.web.wordmark.sizes['390'] = [21, 48];
  const worse = sheetAgrees(constitution, drift).map(o => `${o.where} ${o.msg}`).join('\n');
  assert.match(worse, /deck unit disagrees/); assert.match(worse, /story layouts disagree/); assert.match(worse, /post "act" is true/); assert.match(worse, /web wordmark \(c1\) disagrees/);
  assert.match(sheetAgrees('# no table', media)[0].msg, /can't read the Part III media table/);
});

// Each rule is shown failing on the output it exists to catch, in a real browser. A machine with no browser skips these.
const pw = playwright(); let browser, dir;
before(async () => { if (pw) { browser = await pw.chromium.launch(); dir = mkdtempSync(join(tmpdir(), 'render-')); } });
after(async () => { await browser?.close(); if (dir) rmSync(dir, { recursive: true }); });

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const css = `*{margin:0;padding:0;box-sizing:border-box}body{background:var(--page);color:var(--ink);font-family:var(--font-text);font-weight:400}
.s{width:1920px;height:1080px;padding:96px;position:relative;overflow:hidden;line-height:1.1}.s *,.p *,.st *{letter-spacing:-.02em}.p{width:1080px;height:1350px;padding:72px;position:relative;overflow:hidden;line-height:1.1}
.h{font-size:64px;font-family:var(--font-display);font-weight:600}.b{font-size:32px}.s .m,.p .m,.st .m,.m{font-family:var(--font-display);font-weight:600;font-size:64px;letter-spacing:-.01em}.f{background:var(--field)}`;
// On a deck the wordmark sits bottom left of every slide at 32, and alone at 64 on the closing slide.
const MARK = '<p class="m" style="font-size:32px;position:absolute;left:96px;bottom:96px">secondhand</p>';
const TITLE = `<section class="s f" data-view><p class="b">Sell used things from one app</p>${MARK}</section>`, END = '<section class="s" data-view style="display:grid;place-items:center"><p class="m">secondhand</p></section>';
const deck = mid => `${TITLE}<section class="s" data-view>${mid}${MARK}</section>${END}`;
let n = 0;
async function ids(body, medium = 'deck', level = 'error', theme = '') {
  const f = join(dir, `${n++}.html`), link = name => `<link rel="stylesheet" href="${pathToFileURL(join(root, 'brand', name)).href}">`;
  writeFileSync(f, `<!doctype html><html data-medium="${medium}"${theme && ` data-theme="${theme}"`}><meta charset="utf-8">${link('tokens.css')}${link('media.css')}<style>${css}</style><body>${body}`);
  // The fixtures here are the least markup that shows one rule, so they name no layout. B37 has its own cases, on the templates.
  return (await check(f, medium, { browser })).findings.filter(o => o.level === level && !/names no layout/.test(o.msg)).map(o => `${o.id} ${o.where} ${o.msg}`);
}
// CI sets CI=true and installs a browser. There, a missing browser fails, so these tests can't be skipped without anyone seeing.
test('render: a browser is here when the checks run in CI', () => { if (process.env.CI) assert.ok(pw, 'Playwright is not installed, so no rule was tested on a render'); });

test('render: a deck that follows the brand passes', { skip: !pw }, async () => {
  assert.deepEqual(await ids(deck('<p class="h">What you keep</p><div><p class="b">You keep</p><p style="font-size:200px">$46.95</p></div>')), []);
});

const CASES = [
  ['B28', 'a slide at the wrong size', `<section data-view style="width:1280px;height:720px"><p class="m">secondhand</p></section>`, /B28 .*1280 by 720/],
  ['B15', 'a face that is not ours', deck('<p class="b" style="font-family:Arial">Listed in a minute</p>'), /B15 .*Arial/],
  ['B13', 'bold text', deck('<p class="b" style="font-weight:700">Listed in a minute</p>'), /B13 .*weight 700/],
  ['B13', 'medium weight where there are no buttons', deck('<p class="b" style="font-weight:500">Listed in a minute</p>'), /B13 .*weight 500/],
  ['B14', 'a size off the set', deck('<p style="font-size:28px">Listed in a minute</p>'), /B14 .*28 px/],
  ['B14', 'two peak numbers', deck('<p class="b">You keep</p><p style="font-size:200px">$46.95</p><p style="font-size:160px">$12</p>'), /B14 .*one peak number/],
  ['A7', 'a number in the display face', deck('<p class="h">Sold in 3 days</p>'), /A7 .*number in the display face/],
  ['A7', 'two display headings', deck('<p class="h">What you keep</p><p class="h">Where it sold</p>'), /A7 .*2 display headings/],
  ['B7', 'colored text', deck('<p class="b" style="color:var(--sky-deep)">Listed in a minute</p>'), /B7 .*--sky-deep text/],
  ['B7', 'a color that is not a token', deck('<div style="background:#ff0000;height:64px"></div>'), /B7 .*rgb\(255, 0, 0\)/],
  ['B6', 'text on a photo', deck(`<div style="position:relative"><img alt="A jacket" src="${PX}" style="width:800px;height:400px;display:block"><p class="b" style="position:absolute;top:32px;left:32px">Carhartt jacket</p></div>`), /B6 .*sits on a photo/],
  ['B6', 'white text on the field', `<section class="s f" data-view><p class="m">secondhand</p><p class="b" style="color:var(--page)">Sell used things</p></section>${END}`, /B6 .*on the field/],
  ['B6', 'text too faint to read', deck('<p class="b" style="color:var(--ink-disabled)">Listed in a minute</p>'), /B6 .*contrast/],
  ['B16', 'all capitals', deck('<p class="b">LISTED IN A MINUTE</p>'), /B16 .*all capitals/],
  ['B16', 'capitals by CSS', deck('<p class="b" style="text-transform:uppercase">Listed in a minute</p>'), /B16 .*all capitals/],
  ['B23', 'an emoji', deck('<p class="b">Sold 🎉</p>'), /B23 .*emoji/],
  ['B23', 'an exclamation mark and an em dash', deck('<p class="b">Sold — fast!</p>'), /B23 .*dash[\s\S]*B23 .*exclamation/],
  ['B12', 'an amount that does not say what it is', deck('<div><p style="font-size:200px">$46.95</p></div>'), /B12 .*nothing beside it/],
  ['B17', 'text in the margin', deck('<p class="b" style="position:absolute;left:20px;top:200px">Listed in a minute</p>'), /B17 .*96 px side margin/],
  ['B17', 'a gap off the scale', deck('<div style="padding:30px"><p class="b">Listed in a minute</p></div>'), /B17 .*padding-top is 30 px/],
  ['B20', 'a corner off the scale', deck('<div style="border-radius:10px;background:var(--gray)"><p class="b">Listed in a minute</p></div>'), /B20 .*10px corner/],
  ['B21', 'a border and a shadow together', deck('<div style="border:var(--card-border);box-shadow:var(--shadow-soft)"><p class="b">Listed in a minute</p></div>'), /B21 .*border and a shadow/],
  ['B9', 'a photo with no alt text', deck(`<img src="${PX}" style="width:400px;height:400px">`), /B9 .*no alt text/],
  ['B10', 'a button on a slide', deck('<span class="b" style="background:var(--ink);color:var(--page);border-radius:var(--r-pill);padding:16px 32px">Accept $38</span>'), /B10 .*black pill/],
  ['B3', 'the name with a capital', deck('<p class="b">Secondhand lists it for you</p>'), /B3 .*lowercase/],
  ['B3', 'a slide with no wordmark', `${TITLE}<section class="s" data-view><p class="b">Listed in a minute</p></section>${END}`, /B3 view 2 has no wordmark/],
  ['B3', 'the wordmark at heading size before the closing slide', `<section class="s" data-view><p class="m">secondhand</p></section>${END}`, /B3 view 1 sets the wordmark at 64 px: that size is for the closing view/],
  ['B3', 'the wordmark at heading size beside a heading', `${TITLE}<section class="s" data-view><p class="m">secondhand</p><p class="h" style="margin-top:96px">What you keep</p></section>`, /B3 view 2 sets the wordmark at 64 px beside the heading/],
  ['B3', 'no wordmark at all', '<section class="s" data-view><p class="b">Listed in a minute</p></section>', /B3 .*no wordmark/],
  ['B30', 'too many words', deck(`<p class="b">${'used things sell faster with good photos '.repeat(3)}</p>`), /B30 .*21 words/],
  ['B4', 'two fields in one view', deck('<div class="f" style="height:160px"></div><div class="f" style="height:160px"></div>'), /B4 .*2 gradients/],
  ['B5', 'a field with a dark color', deck('<div style="height:160px;background:radial-gradient(at 0 0,var(--mint),transparent 60%),radial-gradient(at 100% 100%,var(--sky-deep),transparent 60%),var(--sky)"></div>'), /B5 .*built by hand/],
  ['B5', 'a flat two-stop gradient', deck('<div style="height:160px;background:linear-gradient(var(--sky),var(--mint))"></div>'), /B5 .*built by hand/],
  ['B5', 'a field of opposite colors', deck('<div style="height:160px;background:radial-gradient(at 0 0,var(--lilac),transparent 60%),radial-gradient(at 100% 100%,var(--marigold),transparent 60%),var(--lime)"></div>'), /B5 .*built by hand/],
  ['B8', 'color over a third of the view', deck('<div style="position:absolute;inset:0 0 40% 0;background:var(--mint)"></div>'), /B8 .*60% color/],
  ['B8', 'the field filling too many slides', `${TITLE}<section class="s f" data-view><p class="b">One</p></section><section class="s f" data-view><p class="b">Two</p></section>${END}`, /B8 .*fills 3 views/],
  ['B31', 'one kind of thing at two sizes', deck('<div data-part="card-item" style="height:160px;background:var(--gray)"></div><div data-part="card-item" style="height:200px;background:var(--gray)"></div>'), /B31 \S+ \S+ \[card-item\] is 160, 200 px tall/],
  ['B3', 'a wordmark that moves between post panels', '<section class="p" data-view><p class="m" style="font-size:40px;text-align:center">secondhand</p></section><section class="p" data-view><p class="m" style="font-size:40px;text-align:center;margin-top:96px">secondhand</p></section>', /B3 .*moves between views/, 'post'],
];
// An app mock: the phone's own bars are skipped, a screen may be taller than the phone, a row may scroll past the margin, and text an ancestor clips is not on the page.
const app = (inner, h = 844) => `<section data-view style="width:390px;height:${h}px;position:relative;overflow:hidden"><div data-chrome style="height:54px;font:600 16px Arial">9:41</div><p class="m" style="font-size:21px;text-align:center">secondhand</p>${inner}</section>`;
test('render: an app mock with a status bar, a tall screen, a scrolling row and clipped text passes', { skip: !pw }, async () => {
  assert.deepEqual(await ids(app(`<div style="overflow-x:auto;white-space:nowrap;padding:0 20px;margin-top:16px"><span style="font-size:15px">Draft</span>${'<span style="font-size:15px;padding:0 64px">Live</span>'.repeat(6)}</div>
    <div style="height:20px;overflow:hidden;padding:0 20px"><p style="font-size:15px;height:20px">Carhartt jacket</p><p style="font-size:15px">Hidden below the fold of its box</p></div>
    <img alt="A jacket" src="${PX}" style="width:350px;height:200px;margin:0 20px;display:block">`, 1200), 'app'), []);
});
CASES.push(['B15', 'a status bar marked in the middle of the screen', app('<div data-chrome style="margin:200px 20px 0;font:400 15px Arial">Not a status bar</div>'), /B15 .*Arial/, 'app'],
  ['B28', 'a slide taller than the deck', `<section class="s" data-view style="height:1400px"><p class="m">secondhand</p></section>`, /B28 .*1920 by 1400/]);
const PILL = 'background:var(--ink);color:var(--page);border-radius:var(--r-pill);padding:16px 32px;font:500 15px var(--font-text);border:0';
test('render: on an app screen a button label is medium, a small icon needs no words, a name in capitals is let through, and a sheet has no wordmark', { skip: !pw }, async () => {
  assert.deepEqual(await ids(app(`<div style="padding:16px 20px"><button style="${PILL}">Accept $38</button><p style="font-size:15px;margin-top:16px">IKEA</p><img alt="" src="${PX}" style="width:16px;height:16px;display:block"></div>`), 'app'), []);
  assert.deepEqual(await ids('<section data-view style="width:390px;height:844px;padding:20px"><p style="font-size:18px">Change the price</p><div style="height:64px;background:var(--mint-tint);margin-top:16px"></div></section>', 'app'), []);
});
test('render: a price list, a kind whose width follows its words, and the scaled variables in media.css pass on a deck', { skip: !pw }, async () => {
  const row = (a, b) => `<div style="display:flex;gap:var(--ms-7);padding:var(--ms-3) 0"><span class="b">${a}</span><span><span class="b">${b}</span></span></div>`;
  assert.deepEqual(await ids(deck(`<p class="h" style="font-size:var(--mt-heading)">What you keep</p><div>${row('Consignment', '$3')}${row('secondhand', '$17')}</div>
    <div style="display:flex;gap:var(--ms-4)"><span class="b" data-part="chip" data-fit="content" style="background:var(--gray);border-radius:var(--mr-card);padding:var(--ms-2) var(--ms-4)">Shoes</span><span class="b" data-part="chip" data-fit="content" style="background:var(--gray);border-radius:var(--mr-card);padding:var(--ms-2) var(--ms-4)">Jackets</span></div>`)), []);
});
test('render: a view with no color and no photo gets a warning that it reads as no brand', { skip: !pw }, async () => {
  assert.match((await ids(deck('<p class="b">Listed in a minute</p>'), 'deck', 'warn')).join('\n'), /L2 view 2 is only black, white and gray/);
});
test('render: brand/media.css is what brand/media.json makes', () => {
  assert.equal(readFileSync(join(root, 'brand/media.css'), 'utf8'), mediaCss(media, readFileSync(join(root, 'brand/tokens.css'), 'utf8')), 'run node scripts/media-css.mjs');
});
// A web page: no data-view, so each screenful is a view, at 1440 and at 390. The header sits on the 64 px margin and the footer wordmark is the hero's size.
const web = main => `<header style="padding:16px 64px"><p class="m" style="font-size:21px">secondhand</p></header><main style="padding:48px 64px;min-height:1400px">${main}</main><footer style="padding:64px"><p class="m" style="font-size:var(--t-hero)">secondhand</p></footer>`;
test('render: a web page passes at both widths', { skip: !pw }, async () => {
  assert.deepEqual(await ids(web('<p style="font-size:18px;max-width:600px">Sell used things from one app</p><div class="f" style="height:160px;margin-top:48px"></div>'), 'web'), []);
});
const STORY = last => `<section data-view class="st" style="width:1080px;height:1920px;padding:250px 96px 340px;line-height:1.1"><p style="font-size:48px">Listed in a minute</p><div class="f" style="height:480px;margin-top:96px"></div></section><section data-view class="st" style="width:1080px;height:1920px;display:grid;place-items:center;line-height:1.1">${last}</section>`;
test('render: a story with the wordmark on its end card passes', { skip: !pw }, async () => {
  assert.deepEqual(await ids(STORY('<p class="m" style="font-size:120px">secondhand</p>'), 'story'), []);
});
CASES.push(['B9', 'an item with no photo', deck('<div data-item><p class="b">Carhartt jacket</p></div>'), /B9 .*item with no photo/],
  ['B10', 'two black pills in one card', app(`<div data-part="card" style="margin:16px 20px"><div><button style="${PILL}">Accept $38</button></div><div style="margin-top:16px"><button style="${PILL}">Send a counter</button></div></div>`), /B10 .*\[card\] holds two black pills/, 'app'],
  ['B10', 'a black pill with a round corner that is not the token', deck('<span class="b" style="display:inline-block;background:var(--ink);color:var(--page);border-radius:64px;padding:16px 32px">Accept $38</span>'), /B10 .*black pill/],
  ['B13', 'medium weight on text that is not a button', app('<p style="font-size:15px;font-weight:500;padding:16px 20px">Carhartt jacket</p>'), /B13 .*not a button label/, 'app'],
  ['B12', 'a band of color behind an amount', deck('<div><p class="b">You keep <span style="background:var(--lime)">$46.95</span></p></div>'), /B12 .*band of color/],
  ['B16', 'a phrase in capitals', deck('<p class="b">SOLD TODAY</p>'), /B16 .*all capitals/],
  ['B31', 'one kind of thing at two widths', deck('<div style="display:flex;gap:16px"><div data-part="tile" style="height:160px;width:160px;background:var(--gray)"></div><div data-part="tile" style="height:160px;width:240px;background:var(--gray)"></div></div>'), /B31 view 2 \[tile\] is 160, 240 px wide/],
  ['B31', 'one kind of thing at two sizes on two slides', `${TITLE}<section class="s" data-view><div data-part="tile" style="height:160px;background:var(--gray)"></div></section><section class="s" data-view><div data-part="tile" style="height:240px;background:var(--gray)"></div></section>${END}`, /B31 views 2, 3 \[tile\] is 160, 240 px tall/],
  ['B17', 'a photo that runs off the slide', deck(`<img alt="A jacket" src="${PX}" style="position:absolute;right:-200px;top:96px;width:800px;height:400px">`), /B17 .*200 px past the right edge/],
  ['B17', 'a photo that stops in the margin', deck(`<img alt="A jacket" src="${PX}" style="position:absolute;right:40px;top:96px;width:800px;height:400px">`), /B17 .*stops 40 px from the right edge/],
  ['B17', 'a web paragraph in a column too wide to read', web('<p style="font-size:18px;width:900px">' + 'Sell used things from one app and keep what you make. '.repeat(6) + '</p>'), /B17 .*a column of text is 648 px at most/, 'web'],
  ['B17', 'web text wider than the content width', web('<p style="font-size:18px;width:1300px">' + 'Sell used things from one app and keep what you make. '.repeat(8) + '</p>'), /B17 .*1200 px wide at most/, 'web'],
  ['B3', 'a web footer wordmark at the wrong size for the width', web('<p style="font-size:18px">Sell used things</p>').replace('var(--t-hero)', '86.5px'), /B3 .*390 wide it is 21 or 50 px/, 'web'],
  ['B30', 'too many words on a story frame', STORY('<p class="m" style="font-size:120px">secondhand</p>').replace('Listed in a minute', 'Used things sell faster with good photos and honest words'), /B30 .*10 words/, 'story'],
  ['B3', 'a story wordmark before the end card', STORY('<p style="font-size:48px">Sold</p>').replace('<p style="font-size:48px">Listed', '<p class="m" style="font-size:120px;text-align:center;margin-bottom:96px">secondhand</p><p style="font-size:48px">Listed'), /B3 view 1 carries the wordmark/, 'story']);
// What a fresh agent got past the checker, and what it failed that was on brand (brand/explore/system-audit, 2026-11-15).
test('render: a row under a solid bar, a toast that has faded out, a label for screen readers, a focus ring, a disabled button and a heading with a second phrase all pass', { skip: !pw }, async () => {
  assert.deepEqual(await ids(app(`<div style="position:relative;padding:0 20px;margin-top:16px"><p style="font-size:15px;color:var(--ink-disabled)">Under the bar</p><div style="position:absolute;inset:0;background:var(--page)"></div></div>
    <p style="font-size:15px;opacity:0;font-family:Arial;padding:0 20px">Gone</p><span style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;font-family:Arial">For a screen reader</span>
    <div style="padding:16px 20px"><button style="${PILL};box-shadow:var(--focus-ring);border:1px solid var(--outline)">Accept $38</button>
    <button disabled style="font:500 15px var(--font-text);background:var(--gray);color:var(--ink-disabled);border:0;border-radius:var(--r-pill);padding:16px 32px;margin-top:16px">Send</button>
    <h1 style="font:600 36px/1.125 var(--font-display);white-space:nowrap;margin-top:16px">Today <span style="color:var(--ink-2)">here</span></h1></div>`), 'app'), []);
});
CASES.push(['B15', 'text that taps pass through, in a face that is not ours', deck('<p class="b" style="pointer-events:none;font-family:Arial">Listed in a minute</p>'), /B15 .*Arial/],
  ['B15', 'Inter named as a fallback', deck('<p class="b" style="font-family:var(--font-text), Inter">Listed in a minute</p>'), /B15 .*names Inter/],
  ['B13', 'italic text', deck('<p class="b" style="font-style:italic">Listed in a minute</p>'), /B13 .*is italic/],
  ['A7', 'an accent in the display face', deck('<p class="h">Vêtements</p>'), /A7 .*does not hold/],
  ['B16', 'words capitalized by CSS', deck('<p class="b" style="text-transform:capitalize">listed in a minute</p>'), /B16 .*capitalized by CSS/],
  ['B23', 'two hyphens used as a dash', deck('<p class="b">Sold -- fast</p>'), /B23 .*"--" as a dash/],
  ['B12', 'an amount in euros with the sign after it', deck('<div><p style="font-size:200px">46,95 €</p></div>'), /B12 .*nothing beside it/],
  ['B10', 'a black button with square corners on a slide', deck('<span class="b" style="display:inline-block;background:var(--ink);color:var(--page);border-radius:8px;padding:16px 32px">Accept the offer</span>'), /B10 .*black button/],
  ['B5', 'a pinwheel gradient', deck('<div style="height:160px;background:conic-gradient(var(--sky),var(--mint),var(--lime),var(--sky))"></div>'), /B5 .*built by hand/],
  ['B28', 'a slide left unmarked between marked slides', `${TITLE}<section class="s"><p class="b" style="font-family:Arial">Nobody checks this</p></section>${END}`, /B28 .*"Nobody checks this" sits outside every data-view/],
  ['B28', 'a page zoomed to one and a half times', `<style>body{zoom:1.5}</style>${app('')}`, /B28 .*zoomed or scaled/, 'app'],
  ['B14', 'two lines at the peak size on an app screen', app('<div style="padding:0 20px"><p style="font-size:50px">Big words</p><p style="font-size:50px">More big words</p></div>'), /B14 .*one peak number/, 'app'],
  ['B3', 'a story wordmark at the top of its end card', STORY('<p class="m" style="font-size:120px;align-self:start;margin-top:250px">secondhand</p>'), /B3 .*goes center/, 'story']);
// Ben's notes on the dark mode render, 02:18: color blindness, countdowns, and what looks pressable.
const TAG = (c, w) => `<span data-part="tag-kind" style="display:inline-block;font-size:13px;background:var(--${c});color:var(--on-color);padding:4px 8px;border-radius:var(--r-photo);margin:16px 0 0 20px">${w}</span>`;
CASES.push(['U4', 'a dark ground that reads as brown', app('<div style="margin:16px 20px;height:64px;background:#432E02"></div>'), /U4 .*reads as brown/, 'app'],
  ['U4', 'a tag that is color alone', app('<span data-part="tag-kind" style="display:inline-block;width:32px;height:20px;background:var(--mint);margin:16px 20px"></span>'), /U4 .*color alone/, 'app'],
  ['U2', 'a countdown past a day in hours', app('<p style="font-size:13px;padding:16px 20px">Ends in 26h</p>'), /U2 .*26 hours/, 'app'],
  ['U2', 'a countdown that ticks by the second', app('<p style="font-size:13px;padding:16px 20px">Ends in 4m 12s</p>'), /U2 .*counts seconds/, 'app'],
  ['U1', 'a tag that looks pressable', app(TAG('mint', 'Live').replace('style="', 'style="cursor:pointer;')), /U1 .*looks pressable/, 'app'],
  ['U1', 'a row that opens a screen with no chevron', app('<a href="#x" style="display:block;margin:16px 20px;font-size:15px;color:var(--ink);text-decoration:none">Ship the Nike Dunks by tomorrow</a>'), /U1 .*no chevron/, 'app'],
  ['U1', 'a button that is bare words', app('<button style="font:500 15px var(--font-text);background:none;border:0;margin:16px 20px;color:var(--ink)">Send a counter</button>'), /U1 .*no fill and no outline/, 'app'],
  ['B36', 'two lines that start two pixels apart', app('<p style="font-size:15px;margin:16px 0 0 20px">Carhartt jacket</p><p style="font-size:15px;margin:16px 0 0 22px">Nike Dunks</p>'), /B36 .*start 20 and 22 px/, 'app'],
  ['B31', 'a notice that is not the height the tokens give a notice', app('<div data-part="notice" style="margin:16px 20px;height:64px;background:var(--gray)"></div>'), /B31 view 1 \[notice\] is 64 px tall: a \[notice\] is --notice-h, 56 px/, 'app'],
  ['B31', 'a kind tag that is not the height the tokens give a tag', app(TAG('mint', 'Live')), /B31 view 1 \[tag-kind\] is \d+ px tall: a \[tag-kind\] is --tag-h, 20 px/, 'app'],
  ['B31', 'one kind of thing with two corners', deck('<div data-part="tile" style="height:160px;background:var(--gray);border-radius:var(--mr-card)"></div><div data-part="tile" style="height:160px;background:var(--gray);border-radius:var(--mr-photo);margin-top:32px"></div>'), /B31 .*corners of \d+px and \d+px/]);
test('render: seen with no red or no green cones, the four state fills stay apart, and two tints of near hues do not', () => {
  const d = (a, b, k) => Math.hypot(...seenAs(a, k).map((v, i) => v - seenAs(b, k)[i])), sky = [165, 225, 254], mint = [161, 234, 203], lime = [235, 240, 143], marigold = [245, 210, 151];
  for (const k of ['no red cones', 'no green cones']) for (const [a, b] of [[sky, mint], [sky, lime], [sky, marigold], [mint, lime], [mint, marigold], [lime, marigold]]) assert.ok(d(a, b, k) >= .05, `${a} ${b} ${k} ${d(a, b, k)}`);
  assert.ok(d([165, 225, 254], [168, 226, 250], 'no red cones') < .05);
});
// Edge states. The checker refills every slot marked data-fill with each piece of extreme content in .agents/ui-states.json and checks the view again.
const SLOT = 'font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
test('render: a tile of a fixed size that ends long text with an ellipsis and keeps its photo slot passes with every extreme', { skip: !pw }, async () => {
  assert.deepEqual(await ids(app(`<div data-part="tile" data-item style="margin:16px 20px;width:350px;height:72px;display:flex;gap:12px;overflow:hidden">
    <img data-fill="photo" alt="A jacket" src="${PX}" style="width:72px;height:72px;flex:none;background:var(--gray)"><div style="min-width:0;flex:1"><p data-fill="title" style="${SLOT}">Nike Dunks</p>
    <p style="${SLOT}">Offer <span data-fill="amount">$38</span> from <span data-fill="name">Sam</span></p></div></div>`), 'app'), []);
});
const SCREEN = (attrs, inner = '') => `<section data-view ${attrs} style="width:390px;height:844px;padding:20px"><p class="m" style="font-size:21px;text-align:center">secondhand</p><div class="f" style="height:64px;margin-top:32px"></div>${inner}</section>`;
test('render: a screen that draws a state and says why the others cannot happen passes', { skip: !pw }, async () => {
  assert.deepEqual(await ids(SCREEN('data-screen="about" data-state="typical" data-skip="new: it is the same on day one; empty: it holds no list; one: it holds no list; dense: it holds no list; loading: it is built in; failed: it is built in; offline: it is built in"'), 'app'), []);
});
CASES.push(['B34', 'a chip that grows with its words', app('<div data-part="chip" style="margin:16px 20px;display:inline-block;background:var(--gray);padding:8px 12px"><span data-fill="title" style="font-size:15px">Nike Dunks</span></div>'), /B34 view 1 with short-title \[chip\] goes from/, 'app'],
  ['B34', 'a long title cut off with no ellipsis', app('<div data-part="chip" style="margin:16px 20px;width:200px;height:36px;background:var(--gray)"><p data-fill="title" style="font-size:15px;white-space:nowrap;overflow:hidden">Nike Dunks</p></div>'), /B34 view 1 with long-title .*cut off by its box with no ellipsis/, 'app'],
  ['B34', 'a long title that spills out of its tile', app('<div data-part="chip" style="margin:16px 20px;width:200px;height:36px;background:var(--gray);white-space:nowrap"><span data-fill="title" style="font-size:15px">Nike Dunks</span></div>'), /B34 view 1 with long-title .*spills out of \[chip\]/, 'app'],
  ['B34', 'a tile that collapses when its photo is missing', app(`<div data-part="tile" data-item style="margin:16px 20px;width:350px"><img data-fill="photo" alt="A jacket" src="${PX}" style="width:100%;display:block"></div>`), /B34 view 1 with no-photo \[tile\] goes from 350 by 350 to/, 'app'],
  ['B34', 'a long amount that runs over the words beside it', app('<div style="margin:16px 20px;position:relative;height:20px"><span data-fill="amount" style="font-size:15px;position:absolute;left:0">$38</span><span style="font-size:15px;position:absolute;left:40px">offered today</span></div>'), /B34 view 1 with big-amount .*runs over "offered today"/, 'app'],
  ['B35', 'a screen drawn in one state only', SCREEN('data-screen="today" data-state="typical"'), /B35 screen "today" is not drawn in the states new, empty, one, dense, loading, failed, offline/, 'app'],
  ['B35', 'a state nobody has listed', SCREEN('data-screen="today" data-state="haunted"'), /B35 screen "today" is drawn in the state "haunted", which is not on the list/, 'app'],
  ['B35', 'a job drawn only while it runs', SCREEN('', '<p data-job="pricing" data-state="running" style="font-size:15px;margin-top:16px">Pricing on eBay</p>'), /B35 job "pricing" is not drawn in the states started, arrived, failed, slow/, 'app']);
const LOGO = h => `<img alt="eBay" data-logo src="${pathToFileURL(join(root, 'assets/platforms/square/ebay.png')).href}" style="height:${h}px;width:${h}px;margin-right:16px">`;
CASES.push(['B32', 'a tilted wordmark with a shadow', `<section class="s" data-view><p class="m" style="display:inline-block;transform:rotate(-4deg);text-shadow:0 2px 4px var(--scrim)">secondhand</p></section>`, /B32 .*transformed and shadowed/],
  ['B32', 'a line crowding the wordmark', `<section class="s" data-view><p class="m">secondhand</p><p class="b">Sell used things</p></section>`, /B32 .*"Sell used things" sits within 32 px/],
  ['B32', 'the wordmark twice on a slide', `<section class="s" data-view><p class="m">secondhand</p><p class="m" style="margin-top:96px">secondhand</p></section>`, /B32 .*2 times/],
  ['B32', 'the wordmark on a gray box', `<section class="s" data-view><div style="background:var(--gray);padding:64px"><p class="m">secondhand</p></div></section>`, /B32 .*sits on --gray/],
  ['B33', 'logos of two heights in a row', deck(`<div>${LOGO(48)}${LOGO(64)}</div>`), /B33 .*48, 64 px tall/],
  ['B33', 'a row of logos taller than the wordmark', deck(`<div>${LOGO(96)}${LOGO(96)}</div>`), /B33 .*96 px tall: none is taller/]);
test('render: a logo standing alone where a photo would be passes at any size', { skip: !pw }, async () => assert.deepEqual(await ids(deck(`<div>${LOGO(160)}</div>`)), []));
// The wash and the field are tokens, used as they stand. The field takes the ink of its mode, and the wash is not a field.
const WASH = (style = 'top:0', inner = '') => `<header style="position:absolute;left:0;right:0;${style};height:var(--wash-h);background:var(--wash)">${inner}</header>`;
test('render: the wash behind the header of a screen passes, with the field on a card under it, in light and dark', { skip: !pw }, async () => {
  const body = app(`${WASH('top:0', '<p style="font-size:15px;position:absolute;top:120px;left:20px">Today</p>')}<div class="f" style="position:absolute;top:220px;left:20px;right:20px;height:156px;padding:16px"><p style="font-size:15px;color:var(--on-field)">You keep</p><p style="font-size:13px;color:var(--on-field-2)">after fees</p></div>`);
  assert.deepEqual(await ids(body, 'app'), []); assert.deepEqual(await ids(body, 'app', 'error', 'dark'), []);
});
CASES.push(['B4', 'the wash twice on a screen', app(`${WASH()}${WASH()}`), /B4 .*the wash 2 times/, 'app'],
  ['B4', 'the wash halfway down a screen', app(WASH('top:300px')), /B4 .*starts at the top of the screen/, 'app'],
  ['B4', 'the wash on a slide', deck(`<div style="height:160px;background:var(--wash)"></div>`), /B4 .*uses the wash on a deck/],
  ['B6', 'text faded until it cannot be read on the field', app('<div class="f" style="margin:16px 20px;height:156px;padding:16px"><p style="font-size:15px;color:var(--on-field-2);opacity:.5">after fees</p></div>'), /B6 .*"after fees" has [\d.]+:1 contrast at its worst point over the field; it needs 4.5:1/, 'app'],
  ['B6', 'the second ink over the wash', app(WASH('top:0', '<p style="font-size:15px;position:absolute;top:120px;left:20px;color:var(--ink-2)">3 need you</p>')), /B6 .*at its worst point over the wash; it needs 7:1/, 'app'],
  ['B7', 'the ink of the field used off the field', app('<p style="font-size:15px;margin:16px 20px;color:var(--on-field-2)">after fees</p>'), /B7 .*off the field/, 'app', 'dark'],
  ['B6', 'the second ink of the page used on a dark field', app('<div class="f" style="margin:16px 20px;height:156px;padding:16px"><p style="font-size:15px;color:var(--ink-2)">after fees</p></div>'), /B6 .*on the field/, 'app', 'dark']);
// Ben, 02:46: the countdown "a little too close to the corner. think of the shape and the extreme ends".
const CARD = inner => app(`<div data-part="card-decision" style="margin:16px 20px;height:156px;border-radius:36px;background:var(--gray);padding:16px;position:relative">${inner}</div>`);
test('render: a countdown 24 from the edge of a card with a 36 corner, and a photo concentric with it, pass', { skip: !pw }, async () => {
  assert.deepEqual(await ids(CARD(`<img data-photo alt="A jacket" src="${PX}" style="width:72px;height:72px;border-radius:20px;display:block"><span style="position:absolute;top:16px;right:24px;font-size:13px;line-height:18px">2h left</span>`), 'app'), []);
});
CASES.push(['U5', 'a countdown in the curve of a card corner', CARD('<span style="position:absolute;top:16px;right:16px;font-size:13px;line-height:18px">2h left</span>'), /U5 .*"2h left" sits 1\d px from the curve of the top right corner of \[card-decision\]/, 'app'],
  ['U5', 'a square photo in the curve of a card corner', CARD(`<img data-photo alt="A jacket" src="${PX}" style="width:72px;height:72px;display:block">`), /U5 .*<img> sits \d+ px from the curve of the top left corner/, 'app']);
// The templates in brand/templates are where a deck, a post and a story start, so they pass, and a change to a rule that breaks them is seen here.
for (const medium of ['deck', 'post', 'story']) test(`render: the ${medium} template passes`, { skip: !pw }, async () =>
  assert.deepEqual((await check(join(root, `brand/templates/${medium}.html`), medium, { browser })).findings.filter(o => o.level === 'error').map(o => `${o.id} ${o.where} ${o.msg}`), []));
// A slide is one of the deck's six layouts, and holds what that layout holds.
const SLIDE = (layout, inner) => `<html data-medium="deck"><link rel="stylesheet" href="${pathToFileURL(join(root, 'brand/tokens.css')).href}"><link rel="stylesheet" href="${pathToFileURL(join(root, 'brand/media.css')).href}"><link rel="stylesheet" href="${pathToFileURL(join(root, 'brand/templates/layouts.css')).href}"><body><section data-view ${layout}><div class="content">${inner}</div><p class="wordmark">secondhand</p></section><section data-view data-layout="close"><p class="wordmark">secondhand</p></section>`;
for (const [what, layout, inner, re] of [['a slide that names no layout', '', '<p class="body">Listed in a minute</p>', /B37 view 1 names no layout/],
  ['a layout the deck does not have', 'data-layout="collage"', '<p class="body">Listed in a minute</p>', /B37 view 1 is the layout "collage", which a deck does not have/],
  ['a number slide with a heading on it', 'data-layout="number"', '<h2 class="heading">What you keep</h2><p class="body">You keep</p><p class="peak">$17</p>', /B37 view 1 is the layout "number" and does not hold what that is/],
  ['a list of seven rows', 'data-layout="list"', `<ul class="rows">${'<li data-part="row"><p class="body">Shoots</p></li>'.repeat(7)}</ul>`, /B37 view 1 is the layout "list" and does not hold what that is: two to six rows/]])
  test(`render B37: ${what} fails`, { skip: !pw }, async () => { const f = join(dir, `layout-${n++}.html`); writeFileSync(f, `<!doctype html>${SLIDE(layout, inner)}`);
    assert.match((await check(f, 'deck', { browser })).findings.map(o => `${o.id} ${o.where} ${o.msg}`).join('\n'), re); });
CASES.push(['B14', 'slide text at the browser\'s own leading and tracking', deck('<p class="b" style="line-height:normal;letter-spacing:0">Listed in a minute</p>'), /B14 .*is set at leading normal and tracking 0em: on a deck a size of 32 and up is leading 1.1/]);
CASES.push(['B37', 'a slide in a layout the deck does not have', `<section class="s" data-view data-layout="collage"><p class="b">Listed in a minute</p>${MARK}</section>${END}`, /B37 .*"collage", which a deck does not have/]);
CASES.push(['B3', 'the closing wordmark in a corner', `${TITLE}<section class="s" data-view><p class="m">secondhand</p></section>`, /B3 .*alone at 64 px it goes in the middle/]);
// U6 and U7 came from Ben's corrections at 03:49: logos that were not the saved square icons, and tabs that slid over when the current one changed.
const SQ = site => pathToFileURL(join(root, `assets/platforms/square/${site}.png`)).href, OLD = site => pathToFileURL(join(root, `assets/platforms/${site}.svg`)).href;
const TABS = (slot, on) => app(`<nav style="position:absolute;left:0;right:0;bottom:34px;height:50px;display:flex;justify-content:space-around;align-items:center;font-size:13px">${['Today', 'Items', 'You'].map((t, i) => `<a href="#" style="${slot}" ${i ? '' : on}>${t}</a>`).join('')}</nav><style>nav a.on{padding:4px 16px;background:var(--gray)}nav a[aria-current=page] i{opacity:1}nav a i{position:absolute;inset:0;opacity:0;background:var(--gray);border-radius:var(--r-pill)}</style>`);
test('render U6 and U7: saved square logos, and a current tab drawn behind fixed slots, pass', { skip: !pw }, async () => {
  const found = await ids(app(`<div style="display:flex;gap:8px;padding:16px 20px"><img alt="eBay" src="${SQ('ebay')}" style="width:24px;height:24px"><img alt="Depop" src="${SQ('depop')}" style="width:24px;height:24px"></div>`), 'app');
  assert.deepEqual(found.filter(f => /^U[67]/.test(f)), []);
  const tabs = await ids(app(`<nav style="position:absolute;left:0;right:0;bottom:34px;height:50px;display:flex;font-size:13px">${['Today', 'Items', 'You'].map((t, i) => `<a href="#" style="flex:1 1 0;text-align:center;position:relative;line-height:50px" ${i ? '' : 'aria-current="page"'}><i></i>${t}</a>`).join('')}</nav><style>nav a i{position:absolute;inset:9px 20%;opacity:0;background:var(--gray);border-radius:var(--r-pill);z-index:-1}nav a[aria-current=page] i{opacity:1}</style>`), 'app');
  assert.deepEqual(tabs.filter(f => /^U7/.test(f)), []);
});
CASES.push(['U6', 'an old line-drawn logo in place of the square icon', app(`<img alt="eBay" src="${OLD('ebay')}" style="width:24px;height:24px;margin:16px 20px">`), /U6 .*platforms\/ebay\.svg as the eBay logo: a site's logo is its saved square icon/, 'app'],
  ['U6', 'a copy of the icon kept somewhere else', app(`<img alt="Depop" src="${PX}" data-x style="width:24px;height:24px;margin:16px 20px">`), /U6 .*an inline picture as the Depop logo/, 'app'],
  ['U7', 'a current tab whose gray box pushes the others over', TABS('', 'class="on"'), /U7 .*moves [\d.]+ px when \.on on "Items"/, 'app'],
  ['U7', 'a current tab marked by aria-current that grows', app(`<nav style="display:flex;gap:8px;padding:16px 20px;font-size:13px">${['Today', 'Items', 'You'].map((t, i) => `<a href="#" ${i ? '' : 'aria-current="page"'}>${t}</a>`).join('')}</nav><style>nav a[aria-current=page]{padding:0 12px}</style>`), /U7 .*when aria-current on "Items"/, 'app']);
for (const [id, what, body, re, medium, theme] of CASES) test(`render ${id}: ${what} fails`, { skip: !pw }, async () => assert.match((await ids(body, medium, 'error', theme)).join('\n'), re));

// The rule list knows the render checks, the media, and Part IV's "Runs" column.
import { mkdirSync } from 'node:fs';
import { rules, judgeBrief } from './rules.mjs';
import { ui } from './ui.mjs';
function repo(files) {
  const r = mkdtempSync(join(tmpdir(), 'rules-'));
  for (const [p, s] of Object.entries(files)) { mkdirSync(join(r, p, '..'), { recursive: true }); writeFileSync(join(r, p), s); }
  return r;
}
test('rules: a render holder with no check, a medium that does not exist, and a Part IV row that disagrees all fail', () => {
  const base = { 'brand/media.json': '{"deck":{},"post":{}}', '.agents/checks/render.mjs': "E('B8', '', 'x')", '.agents/checks/render.test.mjs': "['B8', 'too much color', x]",
    'brand/constitution.md': '| B8 | Color | Pixels | Script |\n| B2 | Squint | Blur | Look |\n| B22 | Icons | One set | Not built |\n' };
  const run = list => { const r = repo({ ...base, '.agents/ui-rules.json': JSON.stringify(list) }); try { return rules(r).map(o => `${o.where} ${o.msg}`).join('\n'); } finally { rmSync(r, { recursive: true }); } };
  const good = [{ id: 'B8', kind: 'check', by: 'render:B8', media: ['deck'] }, { id: 'B2', kind: 'judge', fail: 'Fail if the logo is seen first.', media: ['deck', 'post'] }];
  assert.equal(run(good), '');
  assert.match(run([{ id: 'B8', kind: 'check', by: 'render:B9' }, good[1]]), /render:B9 needs a check/);
  assert.match(run([{ ...good[0], media: ['tv'] }, good[1]]), /"media" is a list of the media/);
  assert.match(run([good[0]]), /B2 runs as "Look" in Part IV and has no row/);
  assert.match(run([...good, { id: 'B22', kind: 'judge', fail: 'Fail if two icon sets.' }]), /B22 is "Not built" in Part IV and has a row/);
});
test('rules: a deck judge gets only the lines that name a deck, and the app gets the lines with no medium', () => {
  const list = [{ id: 'L9', kind: 'judge', fail: 'Fail if a.' }, { id: 'G2', kind: 'judge', fail: 'Fail if b.', media: ['deck'] }, { id: 'B1', kind: 'judge', fail: 'Fail if c.', media: ['app', 'deck'] }];
  assert.equal(judgeBrief(list, 'deck'), 'G2: Fail if b.\nB1: Fail if c.');
  assert.equal(judgeBrief(list), 'L9: Fail if a.\nB1: Fail if c.');
  assert.equal(judgeBrief(list, 'web'), 'L9: Fail if a.');
});
test('ui: an emoji in app copy is an error', () => {
  const r = repo({ 'app/src/app/x.tsx': '<Txt>Sold 🎉</Txt>' });
  try { assert.match(ui(r, { files: ['app/src/app/x.tsx'] }).filter(o => o.level === 'error').map(o => o.msg).join('\n'), /emoji/); } finally { rmSync(r, { recursive: true }); }
});
