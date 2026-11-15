// Tests written from a page's behavior table alone, for tables whose rows carry where to reach them in the demo:
//   states:   { state, route, shows, also?: [text], absent?: [text] }   opens the route; the screen names the state; the texts show.
//   controls: { id, in, after?: [id], does, goes?, shows?, then? }      opens the state's route, taps each id in after, then the
//             control; the tap is logged with its id, and the page goes to `goes`, or shows `shows`, or shows the control `then`.
// Plus the rule every page keeps: no tap on screen goes to a control the table does not list (copied from index.test.mjs).
import assert from 'node:assert/strict';
import { before, after } from 'node:test';
import { behavior, start } from './behavior.mjs';

export function tableTests(test, page, screenName) {
  const table = behavior(page);
  let app;
  before(async () => { app = await start(); });
  after(async () => { await app?.stop(); });
  const route = name => table.state(name).route ?? assert.fail(`${table.file}: state "${name}" has no route`);

  for (const s of table.states) test(`${table.screen}: ${s.state} shows ${s.shows}`, async () => {
    const v = await app.open(s.route);
    await v.page.locator(`[data-screen="${screenName}"]`).first().waitFor({ state: 'attached', timeout: 5000 });
    await v.shows(s.shows, { timeout: 5000 });
    for (const t of s.also ?? []) await v.shows(t);
    for (const t of s.absent ?? []) assert.equal(await v.page.getByText(t, { exact: true }).count(), 0, `${t} should not show in ${s.state}`);
  });

  for (const c of table.controls) test(`${table.screen}: ${c.id} in ${c.in} ${c.does}`, async () => {
    const v = await app.open(route(c.in));
    await v.page.locator(`[data-screen="${screenName}"]`).first().waitFor({ state: 'attached', timeout: 5000 });
    for (const a of c.after ?? []) { await v.tap(a); await v.page.waitForTimeout(150); }
    await v.tap(c.id);
    await v.saw({ type: 'tap', id: c.id });
    if (c.goes) await v.page.waitForURL(u => new URL(u).pathname === c.goes, { timeout: 5000 });
    if (c.shows) await v.shows(c.shows, { timeout: 5000 });
    if (c.then) await v.page.getByTestId(c.then).first().waitFor({ state: 'visible', timeout: 3000 });
  });

  // Every tap the screen logs is a control the table lists, so nothing on screen does something nobody wrote down. Each
  // control on the first state's screen is tapped on a fresh load, since a tap may leave the page.
  const listed = new Set(table.controls.flatMap(c => [c.id, ...(c.after ?? [])]));
  test(`${table.screen}: no tap goes to a control the table does not list`, async () => {
    const first = table.states[0], seen = [];
    const v = await app.open(first.route);
    await v.shows(first.shows, { timeout: 5000 });
    const ids = [];
    for (const el of await v.page.locator(`[data-screen="${screenName}"] [data-testid]`).all())
      if (await el.isVisible()) ids.push(await el.getAttribute('data-testid'));
    await v.page.close();
    for (const id of [...new Set(ids)].filter(id => !/-input$/.test(id))) {
      const w = await app.open(first.route);
      await w.shows(first.shows, { timeout: 5000 });
      await w.page.getByTestId(id).first().tap({ timeout: 1000 }).catch(() => {});
      seen.push(...(await w.events().catch(() => [])));
      await w.page.close();
    }
    assert.deepEqual([...new Set(seen.filter(e => e.type === 'tap' && !listed.has(e.id)).map(e => e.id))], []);
  });
  return table;
}
