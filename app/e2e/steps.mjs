// The tests for a page whose table names a route per state and per control (Messages, a thread, Ship, Pickup). Each state is
// one route; a control may need taps first (`after`, such as opening its sheet) or words typed (`fill: [testID, text]`).
//   pageTests(test, behavior('item/[id]/ship'), () => app);
import assert from 'node:assert/strict';
import { controlTests } from './behavior.mjs';

// Opens the control's route, types what it needs, and presses what leads to it.
export async function reach(app, table, c = {}) {
  const s = await app.open(c.route ?? table.route);
  if (c.fill) { const el = s.page.getByTestId(c.fill[0]); await el.waitFor({ state: 'visible', timeout: 3000 }); await el.fill(c.fill[1]); }
  for (const id of c.after ?? []) await s.tap(id);
  if (c.drag) await drag(s, ...c.drag);
  return s;
}

// Drags the part with this testID sideways by dx pixels, the way a thumb does: press, move in steps, let go.
export async function drag(s, id, dx) {
  const el = s.page.getByTestId(id); await el.waitFor({ state: 'visible', timeout: 3000 });
  const b = await el.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await s.page.mouse.move(x, y); await s.page.mouse.down();
  for (let i = 1; i <= 10; i++) await s.page.mouse.move(x + (dx * i) / 10, y);
  await s.page.mouse.up();
}

export function pageTests(test, table, app) {
  const name = table.screen;
  test(`${name}: every state names its route and what it shows`, () => {
    for (const st of table.states) assert.ok((st.route || st.world) && st.shows, `${st.state} needs a route (or world) and shows`);
  });
  const routeOf = st => st.route ?? (st.world === 'clearing' ? table.route : `${table.route}?world=${st.world}`);
  for (const st of table.states) test(`${name}: ${st.state} shows ${st.shows}`, async () => {
    const s = await app().open(routeOf(st));
    await s.shows(st.shows);
  });
  // Every tap the screen logs is a control the table lists, in every state, so nothing does something nobody wrote down.
  test(`${name}: no tap goes to a control the table does not list`, async () => {
    const listed = new Set(table.controls.map(c => c.id)), stray = [];
    for (const st of table.states) {
      const route = routeOf(st), s = await app().open(route), path = new URL(s.page.url()).pathname;
      await s.shows(st.shows);
      for (const el of await s.page.locator('[data-testid]').all()) if (await el.isVisible().catch(() => false)) await el.tap({ timeout: 1000 }).catch(() => {});
      for (const e of await s.events()) if (e.type === 'tap' && e.screen === path && !listed.has(e.id)) stray.push(`${route}: ${e.id}`);
    }
    assert.deepEqual(stray, []);
  });
  controlTests(test, table, c => reach(app(), table, c));
}
