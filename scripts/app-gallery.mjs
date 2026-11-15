// Writes the page Ben looks at to see which screens are done: every screen, light and dark, beside what its checks found.
// It reads what scripts/app-check.mjs leaves in features/app/renders/: <slug>.png, <slug>-dark.png, and <slug>.json, which is
//   { "route": "(tabs)/index", "screen": "today", "states": ["typical", "empty"], "status": "built|tests|clean|fixed", "findings": [{ "level", "id", "where", "msg" }] }
// Only "route" is required. With no status, a screen with no error is "Checks clean" and one with an error is "Checks fail".
// Run: node scripts/app-gallery.mjs [renders dir] [out file]. The page links the renders by relative path, so publish them beside it.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// Where each route goes on the page, in the order a person meets them. The first rule that matches wins.
export const GROUPS = [
  ['Tabs', r => r.startsWith('(tabs)/')],
  ['New and the camera', r => ['new', 'camera'].includes(r)],
  ['An item', r => r.startsWith('item/')],
  ['Messages', r => r.startsWith('messages')],
  ['Buying and what it is worth', r => ['worth', 'search', 'want'].includes(r) || /^(listing|product)\//.test(r)],
  ['The site', r => r.startsWith('(site)/')],
  ['Everything else', () => true],
];
const ORDER = ['(tabs)/index', '(tabs)/sell', '(tabs)/buy', '(tabs)/you'];
export const STATUS = { built: 'Built', tests: 'Tests pass', clean: 'Checks clean', fixed: 'Broken, then fixed', fail: 'Checks fail' };

export const slug = route => route.replace(/[()]/g, '').replace(/\[([^\]]+)\]/g, '$1').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'index';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Every screen app-check left, with its findings counted and its status settled.
export function screens(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8')), name = f.replace(/\.json$/, '');
    if (!d.route) throw new Error(`${join(dir, f)} has no "route"`);
    const findings = Array.isArray(d.findings) ? d.findings : [], errors = findings.filter(x => x.level === 'error');
    const status = d.status && STATUS[d.status] ? d.status : errors.length ? 'fail' : 'clean';
    return { ...d, name, findings, errors, warns: findings.length - errors.length, status: errors.length && status !== 'fail' ? 'fail' : status,
      light: existsSync(join(dir, `${name}.png`)) ? `${name}.png` : null, dark: existsSync(join(dir, `${name}-dark.png`)) ? `${name}-dark.png` : null };
  });
}

export function group(list) {
  const out = GROUPS.map(([title]) => ({ title, items: [] }));
  for (const s of list) out[GROUPS.findIndex(([, test]) => test(s.route))].items.push(s);
  for (const g of out) g.items.sort((a, b) => (ORDER.indexOf(a.route) + 1 || 99) - (ORDER.indexOf(b.route) + 1 || 99) || a.route.localeCompare(b.route));
  return out.filter(g => g.items.length);
}

export function page(list, { renders = 'renders', when = new Date() } = {}) {
  const n = k => list.filter(s => s.status === k).length, img = (f, alt) => f ? `<img src="${esc(`${renders}/${f}`)}" alt="${esc(alt)}" loading="lazy">` : '<div class="none">No render yet</div>';
  const card = s => `<article class="screen ${s.status}">
  <header><h3>${esc(s.screen ?? s.route)}</h3><span class="status">${STATUS[s.status]}</span></header>
  <p class="route">${esc(s.route)}${s.states?.length ? ` · ${s.states.map(esc).join(', ')}` : ''}</p>
  <div class="pair">${img(s.light, `${s.screen ?? s.route} in light`)}${img(s.dark, `${s.screen ?? s.route} in dark`)}</div>
  ${s.errors.length ? `<details open><summary>${s.errors.length} to fix</summary><ul>${s.errors.slice(0, 12).map(x => `<li><b>${esc(x.id)}</b> ${esc(x.where)} ${esc(x.msg)}</li>`).join('')}</ul></details>` : ''}
  ${s.warns ? `<p class="warns">${s.warns} warning${s.warns === 1 ? '' : 's'} to read</p>` : ''}
</article>`;
  return `<title>secondhand screens</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root { --page: #FFFFFF; --surface: #F1F3F5; --ink: #0A0A0A; --ink-2: rgb(10 10 10 / .65); --rule: rgb(10 10 10 / .12); --ok: #A1EACB; --fix: #F5D297; --bad: #F7C4BC; --on: #0A0A0A;
  --font: "Helvetica Neue", Arial, sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --page: #101315; --surface: #1A1D20; --ink: #ECEFF1; --ink-2: #B4BABD; --rule: rgb(236 239 241 / .14); color-scheme: dark } }
:root[data-theme="dark"] { --page: #101315; --surface: #1A1D20; --ink: #ECEFF1; --ink-2: #B4BABD; --rule: rgb(236 239 241 / .14); color-scheme: dark }
body { background: var(--page); color: var(--ink); font: 15px/1.45 var(--font); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 40px; }
h1 { font-size: 36px; line-height: 1.1; letter-spacing: -.015em; margin: 0 0 8px; }
h2 { font-size: 21px; margin: 0 0 16px; }
h3 { font-size: 18px; margin: 0; }
.sum { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.sum li { background: var(--surface); border-radius: 999px; padding: 4px 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 16px; }
.screen { background: var(--surface); border-radius: 20px; padding: 16px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.screen header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.status { border-radius: 999px; padding: 2px 10px; font-size: 13px; color: var(--on); background: var(--ok); white-space: nowrap; }
.fail .status { background: var(--bad); } .fixed .status { background: var(--fix); } .built .status, .tests .status { background: var(--page); color: var(--ink); }
.route, .warns { margin: 0; color: var(--ink-2); font-size: 13px; overflow-wrap: anywhere; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pair img, .none { width: 100%; aspect-ratio: 390 / 844; object-fit: cover; object-position: top; border-radius: 12px; border: 1px solid var(--rule); display: block; }
.none { display: grid; place-items: center; color: var(--ink-2); font-size: 13px; }
details { font-size: 13px; } summary { cursor: pointer; font-weight: 600; } ul { margin: 6px 0 0; padding-left: 18px; } li { margin-bottom: 4px; overflow-wrap: anywhere; }
</style>
<main>
<header>
  <h1>Screens</h1>
  <ul class="sum"><li>${list.length} screens</li><li>${n('clean')} checks clean</li><li>${n('fixed')} broken, then fixed</li><li>${n('fail')} to fix</li><li>${n('built') + n('tests')} built, not checked</li><li>Updated ${esc(when.toISOString().slice(0, 16).replace('T', ' '))} UTC</li></ul>
</header>
${list.length ? group(list).map(g => `<section><h2>${esc(g.title)}</h2><div class="grid">${g.items.map(card).join('\n')}</div></section>`).join('\n') : '<p>No screens have been checked yet. Run node scripts/app-check.mjs first.</p>'}
</main>
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? join(root, 'features/app/renders')), out = resolve(process.argv[3] ?? join(root, 'features/app/gallery.html'));
  const list = screens(dir);
  writeFileSync(out, page(list, { renders: relative(dirname(out), dir) || '.' }));
  console.log(`${out}: ${list.length} screens, ${list.filter(s => s.status === 'fail').length} to fix`);
}
