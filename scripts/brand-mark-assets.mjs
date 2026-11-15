import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playwright } from './brand-check.mjs';
const root = resolve(import.meta.dirname, '..');
const mark = readFileSync(resolve(root, 'brand/mark.svg'), 'utf8');
for (const dir of ['app/assets/brand', 'web/public/brand']) {
  mkdirSync(resolve(root, dir), { recursive: true });
  for (const file of ['mark.svg', 'mark-light.svg']) copyFileSync(resolve(root, 'brand', file), resolve(root, dir, file));
}
const shape = mark.replace(/<svg[^>]*>|<\/svg>/g, '');
const wash = '<defs><linearGradient id="wash" x2="1" y2="1"><stop stop-color="#0A4C65"/><stop offset=".6" stop-color="#101315"/><stop offset="1" stop-color="#03523B"/></linearGradient></defs><path fill="url(#wash)" d="M0 0H1024V1024H0Z"/>';
const svg = (content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${content}</svg>`;
const at = (scale) => `<g transform="translate(${(1024 - 100 * scale) / 2} ${(1024 - 116 * scale) / 2}) scale(${scale})">${shape}</g>`;
const browser = await playwright().chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  for (const [name, art, size] of [
    ['icon.png', svg(wash + at(6.2)), 1024],
    ['android-icon-background.png', svg(wash), 1024],
    ['android-icon-foreground.png', svg(at(4.5)), 1024],
    ['android-icon-monochrome.png', svg(at(4.5)).replace(/#(?:ECEFF1|A1EACB)/g, '#FFFFFF'), 1024],
    ['splash-icon.png', svg(at(8)), 512],
    ['favicon.png', svg(wash + at(7)), 64],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${art}`);
    await page.screenshot({ path: resolve(root, 'app/assets/images', name), omitBackground: true });
  }
  copyFileSync(resolve(root, 'app/assets/images/icon.png'), resolve(root, 'web/public/brand/icon.png'));
} finally { await browser.close(); }
console.log('Generated app, adaptive, splash and favicon assets from brand/mark.svg');
