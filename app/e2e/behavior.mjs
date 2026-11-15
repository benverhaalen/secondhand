// What a behavior test needs: the page's behavior table, and the web build opened in a phone-sized browser with its event log.
//   const table = behavior('index');               // app/behavior/index.json: states, controls, back
//   const app = await start();                      // exports if stale, serves, launches Chromium
//   const screen = await app.open('/', { api: { '/v1/health': { ok: true, state: 'SUCCEEDED' } } });
//   await screen.tap('accept');                     // presses the part whose testID is "accept"
//   await screen.saw({ type: 'tap', id: 'accept' }); // waits for that event in globalThis.__events
//   await app.stop();
// Tests read the event log, not pixels (frontend-standard §2 state 9).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appDir, serve } from './web.mjs';
import { playwright } from '../../scripts/brand-check.mjs';

export function behavior(page) {
  const file = join(appDir, 'behavior', `${page}.json`), table = JSON.parse(readFileSync(file, 'utf8'));
  return { ...table, file, states: table.states ?? [], controls: table.controls ?? [], state: name => table.states?.find(s => s.state === name) ?? assert.fail(`${file} has no state "${name}"`) };
}

// True when every key of want is in got with the same value (deep for plain objects).
const fits = (got, want) => got != null && Object.entries(want).every(([k, v]) => v && typeof v === 'object' ? fits(got[k], v) : got[k] === v);

export async function start({ dark = false } = {}) {
  const pw = playwright(); if (!pw) throw new Error('Playwright is not installed here');
  const site = await serve(), browser = await pw.chromium.launch();
  return {
    url: site.url,
    // Opens a route at 390 x 844. api answers the app's own requests with fixed data, by path: a value is sent as JSON,
    // a function gets the Playwright route, 'fail' drops the connection, and { wait: ms, body } answers late.
    async open(route, { api = {}, dark: d = dark } = {}) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: d ? 'dark' : 'light', hasTouch: true });
      for (const [path, answer] of Object.entries(api)) await page.route(u => new URL(u).pathname === path, async r => {
        if (typeof answer === 'function') return answer(r);
        if (answer === 'fail') return r.abort('connectionrefused');
        if (answer && typeof answer === 'object' && 'wait' in answer) { await new Promise(res => setTimeout(res, answer.wait)); return answer.body === 'fail' ? r.abort('connectionrefused') : r.fulfill({ json: answer.body }); }
        return r.fulfill({ json: answer });
      });
      await page.goto(site.url + route, { waitUntil: 'load' });
      return screen(page);
    },
    async stop() { await browser.close(); await site.close(); },
  };
}

function screen(page) {
  const self = {
    page,
    events: () => page.evaluate(() => structuredClone(globalThis.__events ?? [])),
    // Presses the part with this testID (React Native for web writes it as data-testid). Fails if it is not on screen.
    async tap(id) { const el = page.getByTestId(id); await el.waitFor({ state: 'visible', timeout: 3000 }); await el.tap(); },
    // Waits until an event with these fields is in the log, and returns it.
    async saw(want, { timeout = 3000 } = {}) {
      const end = Date.now() + timeout;
      for (;;) { const got = (await self.events()).find(e => fits(e, want)); if (got) return got;
        if (Date.now() > end) assert.fail(`no event like ${JSON.stringify(want)} in globalThis.__events: ${JSON.stringify(await self.events()).slice(0, 600)}`);
        await page.waitForTimeout(50); }
    },
    // Waits until this text is on screen (a string is matched exactly, a RegExp as a pattern).
    async shows(text, { timeout = 3000 } = {}) { await page.getByText(text, { exact: typeof text === 'string' }).first().waitFor({ state: 'visible', timeout }); },
    path: () => new URL(page.url()).pathname,
  };
  return self;
}

// One test per control in the table: pressing it logs a tap with its id, and leads where the table says.
// Pass node:test's test, the table, and how to open the screen with each control showing.
export function controlTests(test, table, open) {
  for (const c of table.controls) test(`${table.screen}: ${c.id} ${c.does ?? ''}`.trim(), async () => {
    const s = await open(c);
    await s.tap(c.id);
    await s.saw({ type: 'tap', id: c.id });
    if (c.goes) await s.page.waitForURL(u => new URL(u).pathname === c.goes, { timeout: 3000 });
  });
}
