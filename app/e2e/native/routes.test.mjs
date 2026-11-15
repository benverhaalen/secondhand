import test from 'node:test';
import assert from 'node:assert/strict';
import { routesFromRenders, attachmentToSlug, routesEnv } from './routes.mjs';

const renders = [
  { slug: 'tabs-index', route: '(tabs)/index' },
  { slug: 'tabs-sell', route: '(tabs)/sell' },
  { slug: 'sell-offline', route: 'sell?state=offline' },
  { slug: 'item-id', route: 'item/[id]' },
];

test('default routes preserve render slugs, normalize tabs, skip parameters and add stage', () => {
  assert.deepEqual(routesFromRenders(renders), [
    { slug: 'tabs-index', route: '/' },
    { slug: 'tabs-sell', route: '/sell' },
    { slug: 'sell-offline', route: '/sell?state=offline' },
    { slug: 'stage', route: '/item/it_stage/post?world=stage&flip=poshmark,mercari,facebook' },
  ]);
});

test('selection accepts slugs and equivalent paths without renaming render attachments', () => {
  assert.deepEqual(routesFromRenders(renders, ['sell', '(tabs)/index', 'sell-offline', '/sell']), [
    { slug: 'tabs-sell', route: '/sell' },
    { slug: 'tabs-index', route: '/' },
    { slug: 'sell-offline', route: '/sell?state=offline' },
  ]);
  assert.throws(() => routesFromRenders(renders, ['missing']), /No render/);
  assert.throws(() => routesFromRenders(renders, ['item/[id]']), /No render/);
});

test('attachment suffixes preserve underscores and distinguish trees', () => {
  const uuid = 'F3B8B6AB-1234-4567-89AB-0123456789AB';
  assert.deepEqual(attachmentToSlug(`item_it_stage_0_${uuid}.png`), { slug: 'item_it_stage', kind: 'png' });
  assert.deepEqual(attachmentToSlug(`tabs-index.tree_0_${uuid}.txt`), { slug: 'tabs-index', kind: 'tree' });
  assert.equal(attachmentToSlug('unrelated.txt'), null);
  assert.equal(attachmentToSlug(`../escape_0_${uuid}.png`), null);
});

test('environment preserves query strings and rejects harness separators and unsafe slugs', () => {
  assert.equal(routesEnv(routesFromRenders(renders, ['tabs-index', 'stage'])),
    'tabs-index|/;stage|/item/it_stage/post?world=stage&flip=poshmark,mercari,facebook');
  for (const route of ['/x;y', '/x|y', '/x\ny']) {
    assert.throws(() => routesEnv([{ slug: 'x', route }]), /Invalid/);
  }
  assert.throws(() => routesEnv([{ slug: '../x', route: '/' }]), /Invalid/);
});

test('reads a tree named the way xcresulttool 26 names it', () => {
  assert.deepEqual(attachmentToSlug('buy-world-buyer_0_1464B124-C13B-421D-A2B6-64A205ADBD58.tree'), { slug: 'buy-world-buyer', kind: 'tree' });
});
