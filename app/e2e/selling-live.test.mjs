import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { start } from './behavior.mjs';

let app;
before(async () => { app = await start({ dark: true }); });
after(async () => { await app?.stop(); });
const money = amount_cents => ({ amount_cents, currency: 'USD' });
const auth = {
  '/v1/auth/refresh': { access_token: 'seller-test', refresh_token: 'refresh-test', expires_at: '2099-01-01T00:00:00Z' },
  '/v1/me': { id: 'seller-test', tutorial_seen: true },
  ...Object.fromEntries(['accounts','orders','wants','conversations','events','lookups'].map(name => [`/v1/${name}`, { data: [], next_cursor: null }])),
  '/v1/today': { decisions: [] },
};
function fixture() {
  let item = { id: 'owned_item', version: 4, title: 'Carhartt jacket', state: 'review', quantity: 1, location: { label: 'Madison' }, photos: [{ id: 'photo_1', url: `${app.url}/selling-photo.jpg`, role: 'front' }], listings: [], attributes: [{ name: 'size', value: 'Large', source: 'label', confirmed: true }], description: 'Brown canvas jacket.', price_cents: money(4500) };
  const writes = [];
  return { writes, get item() { return item; }, api: { ...auth,
    '/selling-photo.jpg': route => route.fulfill({ contentType: 'image/jpeg', body: readFileSync(new URL('../assets/demo-items/carhartt-jacket.jpg', import.meta.url)) }),
    '/v1/items': route => route.fulfill({ json: { data: [item], next_cursor: null } }),
    '/v1/items/owned_item': route => {
      if (route.request().method() === 'PATCH') { const edit = route.request().postDataJSON(); writes.push(edit); assert.equal(edit.version, item.version); item = { ...item, ...edit, version: item.version + 1 }; }
      return route.fulfill({ json: item });
    },
  } };
}

test('a real draft can be reviewed, saved, priced and prepared without claiming it was published', async () => {
  const f = fixture();
  const v = await app.open('/sell', { api: f.api });
  await v.tap('tile-owned_item');
  await v.tap('seller-edit');
  await v.page.getByTestId('seller-title-input').fill('Carhartt Detroit jacket');
  await v.page.getByTestId('seller-quantity-input').fill('2');
  if (process.env.SELLING_SCREENSHOTS) { await v.page.waitForTimeout(500); await v.page.screenshot({ path: `${process.env.SELLING_SCREENSHOTS}/review.png`, fullPage: true }); }
  await v.tap('seller-save');
  await v.page.waitForURL('**/item/owned_item/plan');
  assert.equal(f.item.title, 'Carhartt Detroit jacket');
  assert.equal(f.item.quantity, 2);
  await v.page.getByTestId('seller-price-input').fill('52.50');
  if (process.env.SELLING_SCREENSHOTS) { await v.page.waitForTimeout(500); await v.page.screenshot({ path: `${process.env.SELLING_SCREENSHOTS}/price.png` }); }
  await v.tap('seller-price-save');
  await v.page.waitForURL('**/item/owned_item/post');
  await v.shows('Finish on a site');
  if (process.env.SELLING_SCREENSHOTS) { await v.page.waitForTimeout(500); await v.page.screenshot({ path: `${process.env.SELLING_SCREENSHOTS}/preview.png` }); }
  assert.equal(f.item.price_cents.amount_cents, 5250);
  assert.equal(f.item.state, 'review');
  assert.deepEqual(f.writes.map(edit => edit.version), [4, 5]);
  assert.equal(await v.count('Posted', { exact: true }), 0);
  await v.page.reload();
  await v.shows('Carhartt Detroit jacket');
  await v.page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedListing = text; } } });
    window.open = url => { window.openedSite = url; return null; };
  });
  await v.tap('seller-copy');
  await v.shows('Copied');
  const copied = await v.page.evaluate(() => window.copiedListing);
  assert.match(copied, /Quantity: 2/);
  assert.match(copied, /Asking price: \$52.50/);
  await v.tap('seller-open-ebay');
  assert.equal(await v.page.evaluate(() => window.openedSite), 'https://www.ebay.com/sl/sell');
  assert.equal(f.item.state, 'review');
  assert.equal(f.writes.length, 2);
  await v.page.setViewportSize({ width: 320, height: 720 });
  assert.ok(await v.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await v.page.close();
});

test('live shipping never opens the demo label buyer', async () => {
  const f = fixture();
  const v = await app.open('/item/owned_item/ship', { api: f.api });
  await v.shows('No sale yet');
  assert.equal(await v.count('Buy label', { exact: true }), 0);
  await v.page.close();
});

test('capture sends Sell intent and opens its own persisted draft for review', async () => {
  const f = fixture(); let started;
  const capture = { id: 'capture_own', item_id: f.item.id, version: 1, purpose: 'sell', coverage: { needed: [], kept: [] }, plan: { status: 'done', fields: [], questions: [], process: [] } };
  const v = await app.open('/camera?mode=sell', { api: { ...f.api,
    '/v1/captures': route => { started = route.request().postDataJSON(); return route.fulfill({ json: capture }); },
    '/v1/captures/capture_own/finish': { jobs: [], item: { id: f.item.id } },
  } });
  await v.tap('cam-done');
  await v.shows('Review item');
  await v.tap('capture-messages');
  await v.page.waitForURL('**/item/owned_item/edit');
  assert.equal(started.purpose, 'sell'); assert.equal(started.intent, 'sell');
  assert.equal(await v.page.getByTestId('seller-title-input').inputValue(), f.item.title);
  await v.page.close();
});

test('stale edits preserve input and failed reload never presents the old version as fresh', async () => {
  const f = fixture(); let saved = false;
  const v = await app.open('/item/owned_item/edit', { api: { ...f.api,
    '/v1/items/owned_item': route => {
      if (route.request().method() === 'PATCH') { saved = true; return route.fulfill({ status: 409, json: { code: 'stale', message: 'changed' } }); }
      return saved ? route.fulfill({ status: 503, json: { code: 'unavailable', message: 'Could not reload this item.' } }) : route.fulfill({ json: f.item });
    },
  } });
  await v.page.getByTestId('seller-title-input').fill('My edited jacket title');
  await v.tap('seller-save');
  await v.shows('This item changed. Reload it before saving again.');
  assert.equal(await v.page.getByTestId('seller-title-input').inputValue(), 'My edited jacket title');
  await v.tap('seller-reload');
  await v.shows('Could not reload this item.');
  assert.equal(await v.countId('seller-save'), 0);
  await v.page.close();
});

test('price guidance failures leave manual pricing available without inventing a range', async () => {
  const f = fixture(); let asked;
  const v = await app.open('/item/owned_item/plan', { api: { ...f.api,
    '/v1/valuations': route => { asked = route.request().postDataJSON(); return route.fulfill({ status: 503, json: { code: 'unavailable', message: 'Price evidence is not available.' } }); },
  } });
  await v.tap('seller-appraise');
  await v.shows('Price evidence is not available.');
  assert.deepEqual(asked, { item_id: f.item.id, purpose: 'sell' });
  await v.page.getByTestId('seller-price-input').fill('0');
  await v.tap('seller-price-save');
  await v.shows('Enter a price greater than zero with no more than two decimal places.');
  assert.equal(f.writes.length, 0);
  await v.page.getByTestId('seller-price-input').fill('49.99');
  await v.tap('seller-price-save');
  await v.page.waitForURL('**/item/owned_item/post');
  assert.equal(f.item.price_cents.amount_cents, 4999);
  await v.page.close();
});

test('live listing prices never enter the draft save-and-preview path', async () => {
  const f = fixture();
  const live = { ...f.item, state: 'live', listings: [{ id: 'listing_own', site: 'ebay', state: 'live', price_cents: money(4500), url: 'https://www.ebay.com/itm/123456789' }] };
  const v = await app.open('/item/owned_item/plan', { api: { ...f.api, '/v1/items/owned_item': live } });
  await v.shows('Change live prices on the selling site.');
  assert.equal(await v.countId('seller-price-save'), 0);
  assert.equal(f.writes.length, 0);
  await v.page.close();
});

test('sales with unknown fees remain visible and fulfillment never invents a payout or label', async () => {
  const f = fixture();
  const sale = { id: 'sale_own', kind: 'sale', item_id: f.item.id, site: 'ebay', state: 'to_ship', price_cents: money(4500), fees_cents: null, shipping_cents: money(500), payout_cents: null };
  const v = await app.open('/sell', { api: { ...f.api, '/v1/orders': { data: [sale], next_cursor: null } } });
  await v.tap('sell-page-sales');
  await v.shows('To ship · Net pending');
  await v.tap('sale-sale_own');
  await v.shows('Net pending');
  assert.equal(await v.countId('buy-label'), 0);
  await v.shows('Open selling site');
  if (process.env.SELLING_SCREENSHOTS) { await v.page.waitForTimeout(500); await v.page.screenshot({ path: `${process.env.SELLING_SCREENSHOTS}/sale.png` }); }
  await v.page.close();
});

 test('price guidance reads actual engine quantiles and dirty closing preserves the edit', async () => {
  const f = fixture();
  const job = { id: 'price_job', item_id: f.item.id, state: 'done', result: { range: { q10: 3500, q50: 4500, q90: 5500, state: 'not_checked_yet' } } };
  const v = await app.open('/item/owned_item/plan', { api: { ...f.api, '/v1/valuations': job, '/v1/jobs/price_job': job } });
  await v.tap('seller-appraise');
  await v.shows('$35.00 to $55.00');
  await v.shows('Rough estimate from comparable items.');
  await v.page.getByTestId('seller-price-input').fill('60');
  await v.page.getByTestId('sheet-scrim').click({ position: { x: 10, y: 5 } });
  await v.shows('Leave without saving?');
  await v.tap('seller-price-keep');
  assert.equal(await v.page.getByTestId('seller-price-input').inputValue(), '60');
  assert.equal(f.writes.length, 0);
  await v.page.close();
});
