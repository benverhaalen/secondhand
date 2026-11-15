import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { start, WAIT } from './behavior.mjs';
import { JOBS, observe, judgeJob } from '../../scripts/page-jobs.mjs';

let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });
const pages = [['today', '/'], ['sell', '/sell'], ['buy', '/buy'], ['you', '/you']];

async function openPhone(route, options) {
  const screen = await app.open(route, options);
  await screen.page.addInitScript(() => { globalThis.__phoneInsets = { top: 59, bottom: 34 }; });
  await screen.page.reload({ waitUntil: 'load' });
  return screen;
}

for (const dark of [false, true]) for (const [name, path] of pages) {
  test(`shell: ${name} in ${dark ? 'dark' : 'light'} has the shared header and icon-only aligned navigation`, async () => {
    const screen = await openPhone(`${path}?world=clearing`, { dark });
    const page = screen.page;
    await page.getByTestId('nav-inbox').waitFor({ state: 'visible', timeout: WAIT });
    await page.evaluate(() => document.fonts.ready);
    const route = `(tabs)/${name === 'today' ? 'index' : name}`;
    const row = JOBS[route];
    const job = await page.evaluate(observe, row);
    assert.deepEqual(judgeJob(job, row, { route }).filter(f => f.id === 'J1'), [], 'the rendered title matches its page contract');
    const shell = await page.evaluate(() => {
      const rect = el => el && el.getBoundingClientRect().toJSON();
      const nav = document.querySelector('[data-part="nav"]');
      const mark = document.querySelector('[data-part="wordmark"]');
      const head = document.querySelector('[data-part="page-head"]');
      const title = head && [...head.querySelectorAll('[data-role]')].find(e => /^(today|sell|buy|you)$/i.test(e.textContent));
      const bar = document.querySelector('[data-part="tab-bar"]');
      return {
        nav: rect(nav), mark: rect(mark), logoText: rect(mark?.querySelector('[data-role]')), title: rect(title), inbox: rect(document.querySelector('[data-testid="nav-inbox"]')),
        logoSize: mark && parseFloat(getComputedStyle(mark.querySelector('[data-role]')).fontSize),
        titleText: title?.innerText, titleSize: title && parseFloat(getComputedStyle(title).fontSize),
        text: bar?.innerText.trim(),
        centers: [...(bar?.querySelectorAll('svg') ?? [])].map(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; }),
        display: [...document.querySelectorAll('[data-role="title"], [data-role="heading"]')].map(el => ({ source: el.textContent, shown: el.innerText, transform: getComputedStyle(el).textTransform })),
      };
    });
    assert.ok(shell.nav && shell.mark, 'the main header contains the secondhand wordmark');
    assert.ok(shell.nav.y >= 59, 'header clears the phone status area');
    assert.ok(Math.abs(shell.logoText.x - shell.nav.x) <= 1, 'logo text is at the left edge of the header');
    assert.ok(Math.abs(shell.inbox.x + shell.inbox.width - shell.nav.right) <= 1, 'messages is at the right edge');
    assert.ok(Math.abs(shell.mark.y + shell.mark.height / 2 - shell.inbox.y - shell.inbox.height / 2) <= 1, 'logo and messages share a row');
    assert.ok(shell.title.y >= shell.nav.bottom, 'page name is below the logo row');
    assert.equal(shell.titleText, name);
    assert.ok(shell.titleSize < shell.logoSize, 'page name is smaller than the logo');
    assert.equal(shell.text, '', 'the bottom pill has no visible text');
    assert.equal(shell.centers.length, 5, 'four destinations and New remain');
    assert.ok(Math.max(...shell.centers) - Math.min(...shell.centers) <= 1, `icons share a vertical center: ${shell.centers}`);
    for (const text of shell.display) {
      assert.equal(text.transform, 'lowercase');
      assert.equal(text.shown, text.source.toLowerCase(), 'Clofie renders lowercase without changing source content');
    }
    for (const label of ['Today', 'Sell', 'New', 'Buy', 'You']) {
      assert.equal(await page.locator('[data-part="tab-bar"]').getByRole('button', { name: label, exact: true }).count(), 1, `${label} retains an accessible label`);
    }
    if (process.env.SHELL_SCREENSHOTS) {
      mkdirSync(process.env.SHELL_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: join(process.env.SHELL_SCREENSHOTS, `${name}-${dark ? 'dark' : 'light'}.png`) });
    }
    await screen.tap('nav-inbox');
    await page.waitForURL(u => u.pathname === '/messages', { timeout: WAIT });
    await page.close();
  });
}

test('shell: all four tabs and New keep their destinations', async () => {
  const screen = await openPhone('/?world=clearing');
  for (const [name, path] of [...pages.slice(1), pages[0]]) {
    await screen.tap(`tab-${name}`);
    await screen.page.waitForURL(u => u.pathname === path, { timeout: WAIT });
  }
  await screen.tap('tab-new');
  await screen.page.waitForURL(u => u.pathname === '/new', { timeout: WAIT });
  await screen.page.close();
});

test('shell: Sell keeps Select and Done usable below the header', async () => {
  const screen = await openPhone('/sell?world=clearing');
  await screen.tap('sell-select');
  await screen.page.getByTestId('select-done').waitFor({ state: 'visible', timeout: WAIT });
  await screen.tap('select-done');
  await screen.page.getByTestId('sell-select').waitFor({ state: 'visible', timeout: WAIT });
  await screen.page.close();
});

// Ben, 11:27, on the decision card: "Scrolling down hides the bar and any scroll up brings it back". On every tab the logo
// row slides away under the status strip as the page scrolls down, and a small scroll up brings it back whole.
for (const [name, path] of pages) test(`shell: ${name}'s logo row leaves on scroll down and comes back on any scroll up`, async () => {
  const screen = await openPhone(`${path}?world=flipper`);
  const page = screen.page;
  await page.getByTestId('nav-inbox').waitFor({ state: 'visible', timeout: WAIT });
  const navTop = () => page.evaluate(() => document.querySelector('[data-part="top-bar"] [data-part="nav"]').getBoundingClientRect().top);
  const room = await page.evaluate(() => { const s = [...document.querySelectorAll('div')].find(d => /(auto|scroll)/.test(getComputedStyle(d).overflowY) && d.scrollHeight > d.clientHeight); return s ? s.scrollHeight - s.clientHeight : 0; });
  const rest = await navTop();
  assert.ok(rest >= 59, `at rest the logo row clears the status area: ${rest}`);
  if (room < 200) { await page.close(); return; } // a page shorter than the screen has nothing to hide the bar for
  await page.mouse.move(195, 420);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(30); }
  await page.waitForTimeout(300);
  assert.ok(await navTop() < 59 - 40, `scrolled down, the logo row is gone: ${await navTop()}`);
  await page.mouse.wheel(0, -40);
  await page.waitForTimeout(500);
  assert.equal(Math.round(await navTop()), Math.round(rest), 'a small scroll up brings the logo row back to its place');
  await page.close();
});
