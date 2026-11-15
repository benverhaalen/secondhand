import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { context, check } from './ui-proof.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ui-proof-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, value) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value)); };
  put('app/e2e/web.mjs', readFileSync(new URL('../app/e2e/web.mjs', import.meta.url), 'utf8'));
  put('app/dist/server/_expo/routes.json', { htmlRoutes: [{ page: '/(tabs)/buy', namedRegex: '^/buy$', routeKeys: {} }, { page: '/item/[id]', namedRegex: '^/item/[^/]+$', routeKeys: { id: 'id' } }] });
  put('features/app/page-jobs.json', { pages: { '(tabs)/buy': { job: 'Find an item' }, 'item/[id]': { job: 'Inspect it' } } });
  put('app/behavior/(tabs)/buy.json', { screen: '(tabs)/buy', states: [{ state: 'typical', route: '/buy' }], controls: [] });
  put('app/behavior/item/[id].json', { screen: 'item/[id]', states: [{ state: 'typical', route: '/item/chair' }], controls: [] });
  put('app/src/ui/interactions.json', { defaults: {}, controls: { search: { screen: '/buy' }, back: { screen: 'Shared kit, instantiated on the named screen rows' }, other: { screen: '/sell' } } });
  put('.agents/ui-rules.json', [{ id: 'app', media: ['app'], kind: 'check' }, { id: 'web', media: ['web'], kind: 'judge', fail: 'Web needs its purpose' }]);
  put('brand/media.json', { app: {}, web: {} });
  put('app/e2e/buy.test.mjs', "import { tableTests } from './table-tests.mjs'; tableTests(test, '(tabs)/buy', 'buy');");
  put('app/e2e/item.test.mjs', "itemPage(test, 'item/[id]', 'item');");
  put('app/e2e/shell.test.mjs', 'test("shell", () => {});');
  put('spec/interactions.md', '# Interactions\n## /buy\nSearch behavior\n## /sell\nOther behavior');
  put('spec/copy-cuts.md', '# Copy cuts\n## Buy\n| app/src/app/(tabs)/buy.tsx:1 | Cut |');
  for (const path of ['product/vision.md', 'product/ui-constitution.md', 'product/frontend-standard.md', 'product/copy.md', 'brand/constitution.md', 'brand/coder-card.md', 'brand/tokens.css', 'spec/pages.md', 'spec/ways-out.md', 'spec/edge-cases.md']) put(path, 'Existing contract');
  return { root, put };
}
const scope = { medium: 'app', routes: ['/buy'] };
const tap = '# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
function runner(f, change = () => {}) {
  return async (argv) => {
    if (argv.includes('scripts/app-check.mjs')) {
      f.renderDir = argv.includes('--out') ? relative(f.root, argv[argv.indexOf('--out') + 1]) : 'features/app/renders';
      const page = { route: '(tabs)/buy', path: '/buy', screen: 'buy', screens: { light: 1, dark: 1 }, findings: [] };
      f.put(`${f.renderDir}/tabs-buy.json`, page);
      f.put(`${f.renderDir}/tabs-buy.png`, 'light'); f.put(`${f.renderDir}/tabs-buy-dark.png`, 'dark');
      const result = { exitCode: 0, stdout: JSON.stringify({ errors: 0, pages: [page] }), stderr: '' }; change(result, f); return result;
    }
    return { exitCode: 0, stdout: argv.includes('--test') ? tap : 'gate clean', stderr: '' };
  };
}

test('context resolves real routes, selects contracts and actual calls, includes shell and marks proposals', async t => {
  const f = fixture(t), c = await context(scope, f);
  assert.deepEqual(c.missing, []);
  assert.equal(c.pages[0].route, '(tabs)/buy');
  assert.deepEqual(c.pages[0].tests, ['app/e2e/buy.test.mjs', 'app/e2e/shell.test.mjs']);
  assert.deepEqual(Object.keys(c.pages[0].controls), ['search', 'back']);
  assert.deepEqual(c.rules.map(r => r.id), ['app']);
  assert.equal(c.proposals[0].status, 'proposal');
  assert.match(c.proposals[0].sections[0].text, /Search behavior/);
  assert.deepEqual((await context({ medium: 'app', routes: ['/item/chair'] }, f)).pages[0].tests, ['app/e2e/item.test.mjs']);
  f.put('app/e2e/buy.test.mjs', "// tableTests(test, '(tabs)/buy', 'buy');\nconst example = `behavior('(tabs)/buy')`; const tableTests = () => {}; ");
  assert.match((await context(scope, f)).missing.join('\n'), /test association/);
  f.put('app/e2e/buy.test.mjs', "const b = behavior('(tabs)/buy');");
  assert.ok((await context(scope, f)).pages[0].tests.includes('app/e2e/buy.test.mjs'));
});

test('missing contract and unresolved route fail before execution', async t => {
  const f = fixture(t);
  f.put('features/app/page-jobs.json', { pages: {} });
  rmSync(join(f.root, 'app/behavior/(tabs)/buy.json'));
  const c = await context(scope, f);
  assert.match(c.missing.join('\n'), /page-jobs/); assert.match(c.missing.join('\n'), /behavior/);
  const p = await check(scope, { ...f, run: () => assert.fail('must preflight') }); assert.equal(p.status, 'failed');
  assert.match((await context({ medium: 'app', routes: ['/item/[id]'] }, f)).missing.join('\n'), /concrete/);
  assert.match((await context({ medium: 'app', routes: ['/unknown'] }, f)).missing.join('\n'), /unknown route/);
});

test('fresh execution receipts hash inputs and renders; structural pass is not sensory or native proof', async t => {
  const f = fixture(t), calls = [], run = runner(f);
  f.put('features/app/renders/tabs-buy.json', 'unrelated preexisting artifact');
  const p = await check(scope, { ...f, run: async a => { calls.push(a); return run(a); } });
  assert.equal(p.status, 'checks-passed');
  assert.equal(calls.filter(a => a.includes('--test')).length, 2);
  assert.ok(calls.find(a => a.includes('scripts/app-check.mjs')).includes('--out'));
  assert.equal(readFileSync(join(f.root, 'features/app/renders/tabs-buy.json'), 'utf8'), 'unrelated preexisting artifact');
  assert.ok(p.inputs.every(i => i.sha256)); assert.equal(p.renders.length, 3);
  assert.match(p.limits.join(' '), /web rendition/); assert.match(p.limits.join(' '), /sensory/);
  assert.equal(JSON.parse(readFileSync(p.receipt, 'utf8')).status, p.status);
});

test('command failure, zero or all skipped tests fail', async t => {
  for (const output of [{ exitCode: 1, stdout: tap }, { exitCode: 0, stdout: '# tests 0\n# pass 0\n# skipped 0\n' }, { exitCode: 0, stdout: '# tests 2\n# pass 0\n# skipped 2\n' }]) {
    const f = fixture(t), good = runner(f), p = await check(scope, { ...f, run: a => a.includes('--test') ? { ...output, stderr: '' } : good(a) });
    assert.equal(p.status, 'failed');
  }
});

test('wrong route, missing and preexisting render, render errors, and source changes fail', async t => {
  for (const mutate of [
    r => { const d = JSON.parse(r.stdout); d.pages[0].route = 'sell'; r.stdout = JSON.stringify(d); },
    (r, f) => rmSync(join(f.root, f.renderDir, 'tabs-buy.png')),
    (r, f) => { const p = `${f.renderDir}/tabs-buy.json`, d = JSON.parse(readFileSync(join(f.root, p), 'utf8')); f.put(p, { ...d, path: '/wrong' }); },
    r => { const d = JSON.parse(r.stdout); d.errors = 1; r.stdout = JSON.stringify(d); },
    (r, f) => f.put('app/src/ui/changed.ts', 'changed during proof'),
  ]) { const f = fixture(t); assert.equal((await check(scope, { ...f, run: runner(f, mutate) })).status, 'failed'); }
  const f = fixture(t); await runner(f)(['scripts/app-check.mjs']);
  await new Promise(r => setTimeout(r, 20));
  const p = await check(scope, { ...f, run: async a => a.includes('scripts/app-check.mjs') ? { exitCode: 0, stdout: JSON.stringify({ errors: 0, pages: [{ route: '(tabs)/buy', path: '/buy', screen: 'buy', screens: { light: 1, dark: 1 }, findings: [] }] }), stderr: '' } : { exitCode: 0, stdout: tap, stderr: '' } });
  assert.equal(p.status, 'failed'); assert.match(p.missing.join('\n'), /fresh/);
});

test('web reuses its checker but lacks journey proof; video never aliases story', async t => {
  const f = fixture(t); f.put('landing.html', '<h1>Buy</h1>');
  const c = await context({ medium: 'web', source: 'landing.html' }, f);
  assert.deepEqual(c.rules.map(r => r.id), ['web']);
  assert.ok(c.commands.some(c => c.argv.includes('scripts/brand-check.mjs')));
  const p = await check({ medium: 'web', source: 'landing.html' }, { ...f, run: async () => ({ exitCode: 0, stdout: '{}', stderr: '' }) });
  assert.equal(p.status, 'failed'); assert.match(p.missing.join('\n'), /behavior.*visual/);
  const video = await context({ medium: 'video', source: 'clip.mp4' }, f);
  assert.equal(video.commands.length, 0); assert.match(video.missing.join('\n'), /temporal.*audio/);
});

test('shared app scope expands to concrete behavior consumers and refuses missing mappings', async t => {
  const f = fixture(t), c = await context({ ...scope, shared: true }, f);
  assert.deepEqual(c.pages.map(p => p.route), ['(tabs)/buy', 'item/[id]']);
  assert.deepEqual(c.missing, []);
  f.put('app/e2e/item.test.mjs', 'test("no association", () => {});');
  assert.match((await context({ ...scope, shared: true }, f)).missing.join(' '), /test association for item/);
});

test('proposal sections follow dynamic route templates and explicit shared headings', async t => {
  const f = fixture(t);
  f.put('spec/interactions.md', '## Shared defaults\nCommon\n## /buy\nBuy\n## /you/defaults\nUnrelated\n## /item/{id}\nItem behavior');
  const buy = await context(scope, f);
  assert.equal(buy.proposals[0].sections.length, 2);
  const item = await context({ medium: 'app', routes: ['/item/chair'] }, f);
  assert.ok(item.proposals[0].sections.some(s => s.text.includes('Item behavior')));
});

test('two concrete paths sharing one app-check artifact cannot masquerade as two proofs', async t => {
  const f = fixture(t);
  const p = await check({ medium: 'app', routes: ['/item/chair', '/item/table'] }, { ...f, run: () => assert.fail('must reject overwritten evidence') });
  assert.equal(p.status, 'failed'); assert.match(p.missing.join(' '), /same render artifact.*separately/);
});
