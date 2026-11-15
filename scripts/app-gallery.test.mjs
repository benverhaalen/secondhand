import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { screens, group, page, slug } from './app-gallery.mjs';

test('app-gallery: routes become file names, and screens group by where a person meets them', () => {
  assert.equal(slug('(tabs)/index'), 'tabs-index');
  assert.equal(slug('item/[id]/ship'), 'item-id-ship');
  const g = group(['messages/[id]', '(tabs)/you', 'camera', '(tabs)/index', 'dev/parts', 'listing/[id]', '(site)/index'].map(route => ({ route })));
  assert.deepEqual(g.map(x => x.title), ['Tabs', 'New and the camera', 'Messages', 'Buying and what it is worth', 'The site', 'Everything else']);
  assert.deepEqual(g[0].items.map(x => x.route), ['(tabs)/index', '(tabs)/you']);
});

test('app-gallery: a screen with an error is "Checks fail" whatever status it claims, and a missing render says so', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gallery-'));
  try {
    writeFileSync(join(dir, 'tabs-index.json'), JSON.stringify({ route: '(tabs)/index', screen: 'today', states: ['typical', 'empty'], findings: [{ level: 'warn', id: 'L2', where: 'view 1', msg: 'm' }] }));
    writeFileSync(join(dir, 'tabs-index.png'), ''); writeFileSync(join(dir, 'tabs-index-dark.png'), '');
    writeFileSync(join(dir, 'camera.json'), JSON.stringify({ route: 'camera', status: 'fixed', findings: [{ level: 'error', id: 'B6', where: 'view 1 "Hold still"', msg: 'sits on a photo' }] }));
    const list = screens(dir), today = list.find(s => s.route === '(tabs)/index'), cam = list.find(s => s.route === 'camera');
    assert.equal(today.status, 'clean'); assert.equal(today.warns, 1); assert.equal(today.dark, 'tabs-index-dark.png');
    assert.equal(cam.status, 'fail'); assert.equal(cam.light, null);
    const html = page(list, { renders: 'renders', when: new Date('2026-11-15T04:30:00Z') });
    assert.match(html, /<img src="renders\/tabs-index\.png" alt="today in light"/);
    assert.match(html, /No render yet/);
    assert.match(html, /<b>B6<\/b> view 1 &quot;Hold still&quot; sits on a photo/);
    assert.match(html, /1 checks clean.*1 to fix/s);
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ screen: 'x' }));
    assert.throws(() => screens(dir), /has no "route"/);
  } finally { rmSync(dir, { recursive: true }); }
});
