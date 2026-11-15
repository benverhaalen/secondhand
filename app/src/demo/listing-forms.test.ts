import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FIT, FIT_TYPE, LISTING_FORMS, RETURNS, fitOf, listingTitle, titleOn } from './listing-forms.ts';
import { TITLES } from './edges.ts';

const fit = JSON.parse(readFileSync(new URL('../../../research/list/ben/platforms/platform-fit.json', import.meta.url), 'utf8'));

test('each site form is the one platform-fit.json holds, so the copy never drifts from its source', () => {
  for (const [site, form] of Object.entries(LISTING_FORMS)) {
    const p = fit.platforms[site];
    assert.ok(p, `platform-fit.json has no ${site}`);
    assert.equal(form.title, p.title.where === 'title' ? 'title' : 'description_line_1', `${site} title place`);
    assert.equal(form.title_max, p.title.max, `${site} title max`);
    assert.equal(form.photos_max, p.photos.max, `${site} photos max`);
    assert.equal(form.cover, p.photos.cover_ratio, `${site} cover`);
    assert.deepEqual(form.aim, p.title.aim, `${site} title aim`);
    assert.equal(form.size_label, !!p.title.size_label, `${site} size label`);
  }
});

test('a title is cut at a whole word inside the site limit, and a short one is left alone', () => {
  const cut = titleOn('ebay', TITLES.long);
  assert.ok(cut.length <= 80, cut);
  assert.ok(TITLES.long.startsWith(cut));
  assert.ok(!/[\s,]$/.test(cut));
  assert.equal(titleOn('ebay', 'Lamp'), 'Lamp');
  assert.equal(titleOn('depop', TITLES.long), TITLES.long);
  assert.equal(titleOn('ebay', TITLES.unbroken + TITLES.unbroken).length, 80);
});

const attrs = (o: Record<string, string>) => Object.entries(o).map(([name, value]) => ({ name, value }));

test('each site gets the title its own buyers search: size spelled out where the site labels it, model added where the title is short', () => {
  const jacket = attrs({ brand: 'Carhartt', size: 'L' });
  assert.equal(listingTitle('depop', 'Carhartt Detroit Jacket J97, brown duck, L', jacket), 'Carhartt Detroit Jacket J97, brown duck, size L');
  assert.equal(listingTitle('ebay', 'Carhartt Detroit Jacket J97, brown duck, L', jacket), 'Carhartt Detroit Jacket J97, brown duck, L');
  const sw = attrs({ model: 'HEG-001', storage: '64 GB' });
  assert.equal(listingTitle('ebay', 'Nintendo Switch OLED, white, with dock', sw), 'Nintendo Switch OLED, white, with dock, HEG-001, 64 GB');
  assert.equal(listingTitle('facebook', 'Nintendo Switch OLED, white, with dock', sw), 'Nintendo Switch OLED, white, with dock');
  assert.equal(listingTitle('poshmark', 'Retro-X fleece, cream, M', attrs({ brand: 'Patagonia', size: 'M' })), 'Patagonia Retro-X fleece, cream, size M');
  for (const site of Object.keys(LISTING_FORMS) as (keyof typeof LISTING_FORMS)[]) {
    assert.ok(listingTitle(site, TITLES.long, []).length <= LISTING_FORMS[site].aim[1], site);
  }
});

test('which site a kind of thing goes to is the verdict platform-fit.json holds, word for word', () => {
  for (const [type, sites] of Object.entries(FIT)) {
    assert.ok(Object.values(FIT_TYPE).includes(type) || type === 'fan_apparel', `${type} is mapped from a demo category or an item's kind`);
    for (const [site, [verdict, why]] of Object.entries(sites)) {
      const [v, w] = fit.fit[type][site];
      assert.equal(verdict, v, `${type} on ${site}`);
      const said = w.replace(/'/g, '’').replace('but Depop ships', 'but it ships').replace('which Facebook does', 'which a local site does')
        .replace('is core eBay', 'is core here').replace('eBay has the fan buyer', 'another site has the fan buyer');
      assert.equal(why, said, `${type} on ${site} reason`);
    }
  }
  assert.equal(fitOf({ category: 'furniture' }, 'poshmark')?.verdict, 'blocked');
  assert.equal(fitOf({ category: 'furniture' }, 'depop')?.why.startsWith('A Home'), true);
  // A fan tee is apparel, but its own kind decides: eBay has the fan buyer, not the menswear one.
  assert.equal(fitOf({ category: 'apparel' }, 'ebay')?.verdict, 'good');
  assert.equal(fitOf({ category: 'apparel', kind: 'fan_apparel' }, 'ebay')?.verdict, 'best');
  for (const line of Object.values(RETURNS)) assert.ok(line.length <= 36, `${line} fits one caption line`);
});
