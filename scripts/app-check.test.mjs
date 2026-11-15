// app-check judges a page served over http the way a phone shows it: each screenful of a view that scrolls inside itself,
// in light or dark. Each planted defect here is one a page builder could ship, and it must fail.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPage, slug, toPath } from './app-check.mjs';
import { playwright } from './brand-check.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const pw = playwright(); let browser, server, base;
const pages = new Map();
before(async () => {
  if (!pw) return;
  browser = await pw.chromium.launch();
  server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (pages.has(url)) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(pages.get(url)); }
    // The brand files and the saved logos, at the paths the app's export would give them.
    const file = { '/brand/tokens.css': 'brand/tokens.css' }[url] ?? (/^\/assets\/platforms\/[\w/]+\.(png|svg)$/.test(url) ? url.slice(1) : null);
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'image/png' }); res.end(readFileSync(join(root, file)));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await browser?.close(); server?.close(); });

// A page shaped like React Native for web: the window never scrolls, one view inside it does.
let n = 0;
const serve = body => { const p = `/p${n++}`; pages.set(p, `<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/brand/tokens.css">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}body{overflow:hidden;background:var(--page);color:var(--ink);font-family:var(--font-text);font-weight:var(--w-text);font-size:15px}
#root{height:100%;display:flex;flex-direction:column}.scroll{flex:1;overflow-y:auto;padding:0 20px}</style><body><div id="root"><div class="scroll">${body}</div></div>`); return base + p; };
const ids = async (body, opts) => (await checkPage(serve(body), { browser, ...opts })).findings.filter(f => f.level === 'error').map(f => `${f.id} ${f.where} ${f.msg}`).join('\n');

const tabs = current => `<nav style="display:flex;padding:16px 0;font-size:13px">${['Today', 'Items', 'You'].map((t, i) => `<a href="#" style="flex:1 1 0;text-align:center" ${i ? '' : current}>${t}</a>`).join('')}</nav>`;

test('app-check: a route names the path it is visited at, and its render file', () => {
  assert.deepEqual(['index', '/', 'today', '/today', '(tabs)/today', 'items/42', '(tabs)/index'].map(toPath), ['/', '/', '/today', '/today', '/today', '/items/42', '/']);
  assert.deepEqual(['/', '/today', '/items/42'].map(slug), ['index', 'today', 'items-42']);
});

test('app-check: a current tab that grows and pushes its neighbours over fails (U7)', { skip: !pw }, async () => {
  assert.match(await ids(`${tabs('aria-selected="true"')}<style>nav a[aria-selected=true]{padding:0 14px}</style>`), /U7 .*when aria-selected on "Items"/);
});
test('app-check: a current tab drawn behind fixed slots passes U7', { skip: !pw }, async () => {
  assert.doesNotMatch(await ids(`${tabs('aria-selected="true"')}<style>nav a{position:relative}nav a[aria-selected=true]{text-decoration:underline}</style>`), /U7/);
});

test('app-check: a site logo that is not the saved square icon fails (U6)', { skip: !pw }, async () => {
  assert.match(await ids('<img alt="eBay" src="/assets/platforms/ebay.svg" style="width:24px;height:24px;margin:16px 0">'), /U6 .*as the eBay logo: a site's logo is its saved square icon/);
});
test('app-check: the saved square icon passes U6', { skip: !pw }, async () => {
  assert.doesNotMatch(await ids('<img alt="eBay" src="/assets/platforms/square/ebay.png" style="width:24px;height:24px;margin:16px 0">'), /U6/);
});

test('app-check: a defect below the fold of a screen that scrolls inside itself is found, on the screenful it is in', { skip: !pw }, async () => {
  const found = await checkPage(serve(`<div style="height:1500px"></div><img alt="Depop" src="/assets/platforms/depop.svg" style="width:24px;height:24px">`), { browser });
  assert.ok(found.screens >= 2, `measured ${found.screens} screenful(s)`);
  assert.match(found.findings.map(f => `${f.id} ${f.where}`).join('\n'), /U6 screen [2-9]/);
});

test('app-check: --dark opens the page in the dark scheme, so ink written as a light-mode value fails there and only there (B6)', { skip: !pw }, async () => {
  const body = `<style>@media (prefers-color-scheme: dark){.scroll{background:var(--page)}}</style><p style="color:#0A0A0A;margin-top:40px">You keep $46.95</p>`;
  assert.doesNotMatch(await ids(body), /B6 .*You keep/);
  assert.match(await ids(body, { dark: true }), /B6 .*"You keep \$46\.95".*contrast/);
});
