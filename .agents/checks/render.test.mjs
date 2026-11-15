import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { words, allCaps, titleCase, sheetAgrees } from './render.mjs';
import { scan } from '../../scripts/copy-lint.mjs';
import { check, playwright } from '../../scripts/brand-check.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
const constitution = readFileSync(join(root, 'brand/constitution.md'), 'utf8'), media = JSON.parse(readFileSync(join(root, 'brand/media.json'), 'utf8'));

test('render: words count two CJK characters as one, and case is read from the letters', () => {
  assert.equal(words('You keep $46.95'), 3);
  assert.equal(words('古着を売る'), 3);
  assert.ok(allCaps('SOLD TODAY') && !allCaps('Sold today') && !allCaps('$38') && !allCaps('M'));
  assert.ok(titleCase('What You Keep Today') && !titleCase('What you keep today') && !titleCase('Carhartt Detroit'));
  const emoji = s => scan(s).some(h => h.id === 'S2');
  assert.ok(emoji('Sold 🎉') && emoji('ok ✨') && emoji('🇺🇸') && !emoji('You keep $46.95 © ™ → 3×'));
});

test('render: brand/media.json holds the same numbers as Part III of the constitution, and a drift fails', () => {
  assert.deepEqual(sheetAgrees(constitution, media), []);
  const drift = structuredClone(media); drift.post.margin.x = 80; drift.deck.words = 25;
  const bad = sheetAgrees(constitution, drift).map(o => `${o.where} ${o.msg}`).join('\n');
  assert.match(bad, /post margins disagrees/); assert.match(bad, /deck longest text disagrees/);
  assert.match(sheetAgrees('# no table', media)[0].msg, /can't read the Part III media table/);
});

// Each rule is shown failing on the output it exists to catch, in a real browser. A machine with no browser skips these.
const pw = playwright(); let browser, dir;
before(async () => { if (pw) { browser = await pw.chromium.launch(); dir = mkdtempSync(join(tmpdir(), 'render-')); } });
after(async () => { await browser?.close(); if (dir) rmSync(dir, { recursive: true }); });

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const css = `*{margin:0;padding:0;box-sizing:border-box}body{background:var(--page);color:var(--ink);font-family:var(--font-text);font-weight:400}
.s{width:1920px;height:1080px;padding:96px;position:relative;overflow:hidden}.p{width:1080px;height:1350px;padding:72px;position:relative;overflow:hidden}
.h{font-size:64px;font-family:var(--font-display);font-weight:600}.b{font-size:32px}.m{font-family:var(--font-display);font-weight:600;font-size:64px}.f{background:var(--field)}`;
const TITLE = '<section class="s f" data-view><p class="m">secondhand</p><p class="b">Sell used things from one app</p></section>', END = '<section class="s" data-view><p class="m">secondhand</p></section>';
const deck = mid => `${TITLE}<section class="s" data-view>${mid}</section>${END}`;
let n = 0;
async function ids(body, medium = 'deck') {
  const f = join(dir, `${n++}.html`);
  writeFileSync(f, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(join(root, 'brand/tokens.css')).href}"><style>${css}</style><body>${body}`);
  return (await check(f, medium, { browser })).findings.filter(o => o.level === 'error').map(o => `${o.id} ${o.where} ${o.msg}`);
}

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
  ['B3', 'the wordmark on a middle slide', deck('<p class="m">secondhand</p>'), /B3 view 2 carries the wordmark/],
  ['B3', 'no wordmark at all', '<section class="s" data-view><p class="b">Listed in a minute</p></section>', /B3 .*no wordmark/],
  ['B30', 'too many words', deck(`<p class="b">${'used things sell faster with good photos '.repeat(3)}</p>`), /B30 .*21 words/],
  ['B4', 'two fields in one view', deck('<div class="f" style="height:160px"></div><div class="f" style="height:160px"></div>'), /B4 .*2 gradients/],
  ['B5', 'a field with a dark color', deck('<div style="height:160px;background:radial-gradient(at 0 0,var(--mint),transparent 60%),radial-gradient(at 100% 100%,var(--sky-deep),transparent 60%),var(--sky)"></div>'), /B5 .*--sky-deep/],
  ['B5', 'a flat two-stop gradient', deck('<div style="height:160px;background:linear-gradient(var(--sky),var(--mint))"></div>'), /B5 .*2 colors/],
  ['B5', 'a field of opposite colors', deck('<div style="height:160px;background:radial-gradient(at 0 0,var(--lilac),transparent 60%),radial-gradient(at 100% 100%,var(--marigold),transparent 60%),var(--lime)"></div>'), /B5 .*degrees apart/],
  ['B8', 'color over a third of the view', deck('<div style="position:absolute;inset:0 0 40% 0;background:var(--mint)"></div>'), /B8 .*60% color/],
  ['B8', 'the field filling too many slides', `${TITLE}<section class="s f" data-view><p class="b">One</p></section><section class="s f" data-view><p class="b">Two</p></section>${END}`, /B8 .*fills 3 views|B4 .*3 views carry/],
  ['B31', 'one kind of thing at two sizes', deck('<div data-part="card-item" style="height:160px;background:var(--gray)"></div><div data-part="card-item" style="height:200px;background:var(--gray)"></div>'), /B31 \S+ \S+ \[card-item\] is 160, 200 px tall/],
  ['B3', 'a wordmark that moves between post panels', '<section class="p" data-view><p class="m" style="font-size:40px;text-align:center">secondhand</p></section><section class="p" data-view><p class="m" style="font-size:40px;text-align:center;margin-top:96px">secondhand</p></section>', /B3 .*moves between views/, 'post'],
];
for (const [id, what, body, re, medium] of CASES) test(`render ${id}: ${what} fails`, { skip: !pw }, async () => assert.match((await ids(body, medium)).join('\n'), re));

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
