// What the You tab, its pages and first launch share in their behavior tests: one test per control in a table, where a
// control may name the path it lives on ("path"), the world ("world"), the taps that reveal it ("before"), where it leads
// ("goes"), the change it logs ("logs"), or that it is disabled ("disabled").
import assert from 'node:assert/strict';

export const at = (path, world) => (world ? `${path}${path.includes('?') ? '&' : '?'}world=${world}` : path);

export function youControlTests(test, table, app, fallback) {
  for (const c of table.controls) test(`${table.screen}: ${c.id} ${c.does ?? ''}`.trim(), async () => {
    const s = await app().open(at(c.path ?? fallback, c.world));
    for (const id of c.before ?? []) { await s.tap(id); await s.page.waitForTimeout(350); }
    if (c.disabled) {
      const el = s.page.getByTestId(c.id);
      await el.waitFor({ state: 'visible', timeout: 3000 });
      assert.equal(await el.getAttribute('aria-disabled'), 'true', `${c.id} should be disabled`);
      await el.tap({ force: true }).catch(() => {});
      assert.equal((await s.events()).filter(e => e.type === 'tap' && e.id === c.id).length, 0, `${c.id} is disabled and should log no tap`);
      return;
    }
    await s.tap(c.id);
    await s.saw({ type: 'tap', id: c.id });
    if (c.logs) await s.saw(c.logs);
    if (c.goes) await s.page.waitForURL(u => new URL(u).pathname === c.goes, { timeout: 3000 });
  });
}
