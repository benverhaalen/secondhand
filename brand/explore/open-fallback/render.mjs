// Draws specimen.html with the open pair only. Run: node brand/explore/open-fallback/render.mjs
// Playwright comes from the app's dependencies (run from app/ after `npm i`) or, where there is no app/node_modules, from PLAYWRIGHT_FROM (a folder with node_modules/playwright).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const from = process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM.replace(/\/?$/, '/') : new URL('../../../app/', import.meta.url);
const { chromium } = createRequire(from)('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 810, height: 700 }, deviceScaleFactor: 2 });
await p.goto(pathToFileURL(here + 'specimen.html').href);
await p.evaluate(() => document.fonts.ready);
const used = await p.evaluate(async () => [...document.fonts].map(f => `${f.family} ${f.weight} ${f.status}`));
console.log(used.join('\n'));
await p.screenshot({ path: here + 'specimen.png', fullPage: true });
await b.close();
