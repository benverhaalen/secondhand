// Every hand position in packs A, C and F, large, with the pair beside the wordmark in one ink, two field colors, and a gradient each.
// Reads the unpacked npm packages (@phosphor-icons/core 2.1.1, heroicons 2.2.0) from ./hands; writes hands-<id>-poses.jpg to the folder given.
//   node poses.mjs <out-folder>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const H = `${import.meta.dirname}/hands`, OUT = process.argv[2];
const ph = (w, n) => `${H}/ph/package/assets/${w}/${n}${w === 'regular' ? '' : '-' + w}.svg`;
const POSES = ['hand', 'hand-palm', 'hand-waving', 'hand-pointing', 'hand-tap', 'hand-swipe-left', 'hand-swipe-right', 'hand-grabbing', 'hand-fist',
  'hand-peace', 'thumbs-up', 'thumbs-down', 'handshake', 'hands-clapping', 'hands-praying', 'hand-heart', 'hand-coins', 'hand-deposit', 'hand-withdraw',
  'hand-arrow-up', 'hand-arrow-down', 'hand-eye', 'hand-soap'];
const PACKS = {
  a: { title: 'A  Phosphor, regular', main: ph('regular', 'hand'), poses: POSES.map(n => [n, ph('regular', n)]) },
  c: { title: 'C  Phosphor, filled', main: ph('fill', 'hand'), poses: POSES.map(n => [n, ph('fill', n)]) },
  f: { title: 'F  Heroicons', main: `${H}/hi/package/24/outline/hand-raised.svg`, stroke: true,
       poses: ['hand-raised', 'hand-thumb-up', 'hand-thumb-down'].flatMap(n => [[n + ' (outline)', `${H}/hi/package/24/outline/${n}.svg`], [n + ' (solid)', `${H}/hi/package/24/solid/${n}.svg`]]) },
};
const svg = (f, sw) => readFileSync(f, 'utf8').replace(/<!--.*?-->\s*/gs, '').replace(/\s(class|width|height|aria-hidden|data-slot)="[^"]*"/g, '')
  .replace(/stroke-width="[\d.]+"/, sw ? `stroke-width="${sw}"` : '$&');
const css = `body{margin:0;background:#101315;color:#ECEFF1;font:500 22px/1.25 system-ui,sans-serif;padding:56px 64px;width:1672px}
h1{font-size:40px;margin:0 0 6px;font-weight:600} .sub{color:#CDD2D4;margin:0 0 40px;max-width:1400px}
.locks{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:56px}
.lock{background:#171B1E;border-radius:28px;padding:40px 24px 28px;display:flex;flex-direction:column;align-items:center;gap:24px}
.lu{display:flex;align-items:center;gap:20px;font-size:56px;font-weight:600;letter-spacing:-.01em} .lu svg{width:64px;height:64px;display:block}
.lu .r{transform:scaleX(-1)} .lock p{margin:0;color:#CDD2D4;font-size:19px;text-align:center}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}
.pose{background:#171B1E;border-radius:24px;padding:28px 12px 18px;display:flex;flex-direction:column;align-items:center;gap:14px}
.pose svg{width:150px;height:150px;display:block;color:#ECEFF1} .pose p{margin:0;color:#CDD2D4;font-size:18px;text-align:center}
.f svg{fill:currentColor} .f svg[fill="none"]{fill:none} .s svg{stroke:currentColor}
.solid .l{color:#A5E1FE} .solid .r{color:#A1EACB}
.f.grad .l svg{fill:url(#live)} .f.grad .r svg{fill:url(#sold)} .s.grad .l svg{stroke:url(#live)} .s.grad .r svg{stroke:url(#sold)}
.f.grad .l svg[fill="none"],.f.grad .r svg[fill="none"]{fill:none}`;
const defs = `<svg width="0" height="0" style="position:absolute"><defs>
<linearGradient id="live" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A5E1FE"/><stop offset="1" stop-color="#DDCEFE"/></linearGradient>
<linearGradient id="sold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A1EACB"/><stop offset="1" stop-color="#EBF08F"/></linearGradient></defs></svg>`;
const b = await chromium.launch();
for (const [id, p] of Object.entries(PACKS)) {
  const k = p.stroke ? 's' : 'f', m = svg(p.main, p.stroke && 1.5);
  const lock = (cls, note) => `<div class="lock ${k} ${cls}"><div class="lu"><span class="l">${m}</span><span>secondhand</span><span class="r">${m}</span></div><p>${note}</p></div>`;
  const html = `<!doctype html><style>${css}</style>${defs}<h1>${p.title}</h1><p class="sub">The pair beside the wordmark three ways, then every hand position in the pack (${p.poses.length}). Wordmark in a stand-in face; the hands are exact.</p>
  <div class="locks">${lock('', 'One ink, as now')}${lock('solid', 'Two colors from the Home field, no gradient: sky and mint')}${lock('grad', 'A gradient each: sky to lilac (live), mint to lime (sold)')}</div>
  <div class="grid">${p.poses.map(([n, f]) => `<div class="pose ${f.includes('/outline/') ? 's' : 'f'}">${svg(f, f.includes('/outline/') && 1.5)}<p>${n}</p></div>`).join('')}</div>`;
  const pg = await b.newPage({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1.5 });
  await pg.setContent(html); await pg.screenshot({ path: `${OUT}/hands-${id}-poses.jpg`, fullPage: true, type: 'jpeg', quality: 86 }); await pg.close();
}
await b.close();
