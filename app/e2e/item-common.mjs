// The tests the Item, Plan and Post preview tables share (app/behavior/item/[id]/{index,plan,post}.json), on the web build.
// Rows carry where to reach them in the demo:
//   states:   { state, route, after?, shows, also?, absent?, skeleton?, missing? }
//   controls: { id, control, on_tap, route?, after?, at?, goes?, shows?, then?, gone?, refused?, missing? }
// `after` is the steps first: a testID is pressed, [testID, text] is typed into and sent with Enter. `at` presses the part at
// that point inside it (a scrim the sheet mostly covers). A `shows` that starts with ~ is matched inside a longer line.
// A row marked missing is what the spec asks for and the page lacks: its test runs, and fails until the page has it.
import assert from 'node:assert/strict';
import { before, after, afterEach } from 'node:test';
import { behavior, start } from './behavior.mjs';

export function itemPage(test, page, label) {
  const table = behavior(page);
  let app;
  before(async () => { app = await start(); });
  after(async () => { await app?.stop(); });
  // Each test's pages close after it, so a long run doesn't keep a hundred pages open in one browser.
  const pages = [];
  afterEach(async () => { for (const p of pages.splice(0)) await p.close().catch(() => {}); });
  const ctx = { table, app: () => app, open: async (route, opts) => { const s = await app.open(route, opts); pages.push(s.page); return s; } };

  test(`${label}: every state and control names what a person sees and what it does`, () => {
    for (const st of table.states) assert.ok(st.state && st.shows, `state ${JSON.stringify(st).slice(0, 80)} needs state and shows`);
    for (const c of table.controls) assert.ok(c.id && c.control && c.on_tap, `control ${c.id} needs id, control and on_tap`);
  });

  for (const st of table.states) test(`${label}: ${st.state}${st.missing ? ' (missing)' : ''} shows ${st.shows.slice(0, 70)}`, async () => {
    if (!st.route) assert.fail(`${st.state}: no demo route reaches it (${st.why})`);
    const s = await reach(ctx, st.route, st.after);
    // A loading state's shows is a description; its skeleton is what is checked, and its words on screen are in also.
    if (st.skeleton) await s.page.locator('[data-skeleton="true"]').first().waitFor({ state: 'visible', timeout: 5000 });
    else await shows(s, st.shows, 5000);
    for (const t of st.also ?? []) await shows(s, t);
    for (const t of st.absent ?? []) assert.equal(await s.page.getByText(t, { exact: true }).count(), 0, `${t} should not show in ${st.state}`);
  });

  for (const c of table.controls) test(`${label}: ${c.id}${c.route ? ` on ${c.route}` : ''}${c.missing ? ' (missing)' : ''} ${c.on_tap.slice(0, 80)}`, async () => {
    const s = await reach(ctx, c.route ?? table.route, c.after);
    if (c.refused) {
      const el = s.page.getByTestId(c.id).first(); await el.waitFor({ state: 'visible', timeout: 3000 });
      await el.tap();
    } else {
      await press(s, c.id, c.at);
      await s.saw({ type: 'tap', id: c.id });
    }
    if (c.goes) await s.page.waitForURL(u => new URL(u).pathname === c.goes, { timeout: 5000 });
    if (c.shows) await shows(s, c.shows, 5000);
    if (c.then) await s.page.getByTestId(c.then).first().waitFor({ state: 'visible', timeout: 3000 });
    if (c.gone) await s.page.getByText(c.gone, { exact: true }).first().waitFor({ state: 'hidden', timeout: 3000 });
  });

  // Every tap the page logs on its own path is a control the table lists, in every state, so nothing on screen does something
  // nobody wrote down. Taps after a link leaves the page belong to another table (app/e2e/README.md).
  test(`${label}: no tap on this page goes to a control the table does not list`, async () => {
    const listed = new Set(table.controls.map(c => c.id)), stray = new Set();
    for (const st of table.states.filter(st => st.route && !st.missing)) {
      const s = await reach(ctx, st.route, st.after), path = new URL(s.page.url()).pathname;
      for (const el of await s.page.locator('[data-testid]').all()) {
        const id = await el.getAttribute('data-testid').catch(() => null);
        if (!id || /-input$/.test(id) || !(await el.isVisible().catch(() => false))) continue;
        await el.tap({ timeout: 500 }).catch(() => {});
        if (new URL(s.page.url()).pathname !== path) break;
      }
      for (const e of await s.events().catch(() => [])) if (e.type === 'tap' && e.screen === path && !listed.has(e.id)) stray.add(`${st.route}: ${e.id}`);
      await s.page.close();
    }
    assert.deepEqual([...stray], []);
  });
  return ctx;
}

// Opens a route and runs its steps: a testID is pressed, [testID, text] is typed and sent.
export async function reach(ctx, route, steps = []) {
  const s = await ctx.open(route);
  await s.page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 8000 });
  for (const step of steps ?? []) {
    if (Array.isArray(step)) { const el = s.page.getByTestId(step[0]); await el.waitFor({ state: 'visible', timeout: 3000 }); await el.fill(step[1]); await el.press('Enter'); }
    else await press(s, step);
    await s.page.waitForTimeout(150);
  }
  return s;
}

export async function press(s, id, at) {
  const el = s.page.getByTestId(id).first();
  await el.waitFor({ state: 'visible', timeout: 3000 });
  await el.tap(at ? { position: { x: at[0], y: at[1] } } : {});
}

export const shows = (s, text, timeout = 3000) => text.startsWith('~')
  ? s.page.getByText(text.slice(1), { exact: false }).first().waitFor({ state: 'visible', timeout })
  : s.shows(text, { timeout });

// What a screen reader is told about a switch: its role and whether it is on (ways-out Everywhere, VoiceOver).
export async function switchState(s, id) {
  return s.page.getByTestId(id).first().evaluate(el => ({ role: el.getAttribute('role'), checked: el.getAttribute('aria-checked'), label: el.getAttribute('aria-label') }));
}
